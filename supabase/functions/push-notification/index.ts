import { createClient } from "npm:@supabase/supabase-js@2";
import {
  ApplicationServer,
  importVapidKeys,
  PushMessageError,
  Urgency,
} from "jsr:@negrel/webpush@0.5.0";

type NotificationRecord = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  url?: string;
  data?: Record<string, unknown>;
  push_status?: string;
};

type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  subscription: {
    endpoint: string;
    keys: { auth: string; p256dh: string };
  };
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const expectedSecret = Deno.env.get("PUSH_WEBHOOK_SECRET");
  const suppliedSecret = request.headers.get("x-agrolyst-push-secret");
  if (!expectedSecret || !suppliedSecret || suppliedSecret !== expectedSecret) {
    return json({ error: "Unauthorized webhook" }, 401);
  }

  let payload: { type?: string; table?: string; schema?: string; record?: NotificationRecord };
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid JSON payload" }, 400);
  }

  if (payload.type !== "INSERT" || payload.table !== "notifications" ||
      payload.schema !== "public" || !payload.record?.id) {
    return json({ ignored: true, reason: "Not a new public notification row" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const privateJwk = Deno.env.get("VAPID_PRIVATE_JWK");
  const publicJwk = Deno.env.get("VAPID_PUBLIC_JWK");
  if (!supabaseUrl || !serviceKey || !privateJwk || !publicJwk) {
    return json({
      error: "Push delivery is not configured. Add Supabase service credentials and VAPID JWK secrets.",
    }, 503);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { data: notification, error: notificationError } = await admin
      .from("notifications")
      .select("id,user_id,title,body,url,data,push_status")
      .eq("id", payload.record.id)
      .maybeSingle();

    if (notificationError) throw notificationError;
    if (!notification) return json({ ignored: true, reason: "Notification row no longer exists" });
    if (notification.push_status === "sent" || notification.push_status === "no_subscribers") {
      return json({ ok: true, skipped: true, push_status: notification.push_status });
    }

    await admin.from("notifications").update({
      push_attempted_at: new Date().toISOString(),
      push_error: null,
    }).eq("id", notification.id);

    const { data: subscriptions, error: subscriptionsError } = await admin
      .from("push_subscriptions")
      .select("id,user_id,endpoint,subscription")
      .eq("user_id", notification.user_id)
      .eq("is_active", true);

    if (subscriptionsError) throw subscriptionsError;

    if (!subscriptions || subscriptions.length === 0) {
      await admin.from("notifications").update({
        push_status: "no_subscribers",
        push_error: null,
      }).eq("id", notification.id);
      return json({ ok: true, push_status: "no_subscribers" });
    }

    const vapidKeys = await importVapidKeys({
      privateKey: JSON.parse(privateJwk),
      publicKey: JSON.parse(publicJwk),
    });
    const applicationServer = await ApplicationServer.new({
      vapidKeys,
      contactInformation: "mailto:support@agrolystfarms.com",
    });

    const message = JSON.stringify({
      title: notification.title,
      body: notification.body,
      url: notification.url || "/account.html",
      tag: "agrolyst-" + notification.id,
      data: notification.data || {},
    });

    let successes = 0;
    const failures: string[] = [];
    for (const raw of subscriptions as PushSubscriptionRow[]) {
      try {
        const subscriber = applicationServer.subscribe(raw.subscription);
        await subscriber.pushTextMessage(message, {
          ttl: 86400,
          urgency: Urgency.High,
          topic: ("ag" + notification.id.replaceAll("-", "")).slice(0, 32),
        });
        successes++;
      } catch (error) {
        if (error instanceof PushMessageError && error.isGone()) {
          await admin.from("push_subscriptions").update({ is_active: false }).eq("id", raw.id);
        }
        failures.push(error instanceof Error ? error.message.slice(0, 220) : "Unknown push delivery error");
      }
    }

    if (successes > 0) {
      await admin.from("notifications").update({
        push_status: "sent",
        push_sent_at: new Date().toISOString(),
        push_error: failures.length ? failures.join("; ").slice(0, 1000) : null,
      }).eq("id", notification.id);
      return json({ ok: true, push_status: "sent", delivered_to: successes, failed: failures.length });
    }

    await admin.from("notifications").update({
      push_status: "failed",
      push_error: failures.join("; ").slice(0, 1000) || "No active subscriptions delivered.",
    }).eq("id", notification.id);
    return json({ ok: false, push_status: "failed", failed: failures.length }, 502);
  } catch (error) {
    console.error("Agrolyst push delivery failed:", error);
    return json({ error: "Push delivery failed. Check Edge Function logs for details." }, 500);
  }
});

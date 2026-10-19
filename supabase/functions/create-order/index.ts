import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://agrolystfarms.com",
  "https://www.agrolystfarms.com",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
]);

function responseHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://agrolystfarms.com",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json; charset=utf-8",
  };
}
function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders(origin) });
}
function cleanString(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (origin && !allowedOrigins.has(origin)) return json({ error: "This website is not allowed to place orders." }, 403, origin);
  if (req.method === "OPTIONS") return new Response("ok", { headers: responseHeaders(origin) });
  if (req.method !== "POST") return json({ error: "Use POST to place an order." }, 405, origin);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing required Supabase function environment configuration.");
      return json({ error: "Checkout is temporarily unavailable. Please contact Agrolyst." }, 503, origin);
    }

    const body = await req.json();
    const customer = body?.customer ?? {};
    const name = cleanString(customer.name, 120);
    const phone = cleanString(customer.phone, 30);
    const email = cleanString(customer.email, 254);
    if (name.length < 2 || phone.length < 7) return json({ error: "Enter your name and a valid phone number." }, 400, origin);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Enter a valid email address." }, 400, origin);

    const fulfillment = body?.fulfillment;
    if (!["delivery", "farm_pickup"].includes(fulfillment)) return json({ error: "Choose delivery or farm pickup." }, 400, origin);
    const paymentMethod = body?.payment_method;
    if (paymentMethod !== "bank_transfer") return json({ error: "Bank transfer is the only currently enabled checkout method." }, 400, origin);

    const deliveryAddress = cleanString(body?.delivery_address, 500);
    const deliveryArea = cleanString(body?.delivery_area, 120);
    const deliveryState = cleanString(body?.delivery_state || "Ogun", 120);
    const deliveryZoneId = cleanString(body?.delivery_zone_id, 64);
    if (fulfillment === "delivery" && (!deliveryAddress || !deliveryArea || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(deliveryZoneId))) {
      return json({ error: "Enter your delivery address, area and choose an available delivery zone." }, 400, origin);
    }

    const preferredDateRaw = cleanString(body?.preferred_delivery_at, 64);
    const preferredDate = new Date(preferredDateRaw);
    const now = Date.now();
    if (!preferredDateRaw || Number.isNaN(preferredDate.getTime()) || preferredDate.getTime() < now + 30 * 60 * 1000 || preferredDate.getTime() > now + 90 * 24 * 60 * 60 * 1000) {
      return json({ error: "Choose a pickup or delivery date at least 30 minutes from now and within the next 90 days." }, 400, origin);
    }

    if (!Array.isArray(body?.items) || body.items.length < 1 || body.items.length > 50) return json({ error: "Your cart must contain between 1 and 50 products." }, 400, origin);
    const items = [];
    for (const item of body.items) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(item?.product_id ?? ""))) return json({ error: "A product in your cart is invalid. Refresh the shop and try again." }, 400, origin);
      const quantity = Number(item?.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1000000) return json({ error: "A product quantity is invalid." }, 400, origin);
      items.push({ product_id: item.product_id, quantity });
    }
    const notes = cleanString(body?.customer_notes, 2000);
    const deliveryTimeSlot = cleanString(body?.delivery_time_slot, 80);

    // Only use a user ID derived from a valid Supabase Auth access token; never trust one from JSON.
    let userId: string | null = null;
    const authorization = req.headers.get("authorization") ?? "";
    const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
    if (bearer && !bearer.startsWith("sb_publishable_") && anonKey) {
      const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data: userData, error: userError } = await authClient.auth.getUser(bearer);
      if (!userError && userData.user) userId = userData.user.id;
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await admin.rpc("create_checkout_order", {
      p_order: {
        customer_name: name,
        customer_email: email || null,
        customer_phone: phone,
        fulfillment,
        delivery_address: fulfillment === "delivery" ? deliveryAddress : null,
        delivery_area: fulfillment === "delivery" ? deliveryArea : null,
        delivery_state: fulfillment === "delivery" ? deliveryState : null,
        delivery_zone_id: fulfillment === "delivery" ? deliveryZoneId : null,
        preferred_delivery_at: preferredDate.toISOString(),
        delivery_time_slot: deliveryTimeSlot || null,
        payment_method: paymentMethod,
        customer_notes: notes || null,
      },
      p_items: items,
      p_user_id: userId,
    });
    if (error) {
      console.warn("Checkout validation failed:", error.message);
      const message = error.message || "We could not place your order.";
      return json({ error: message.includes("create_checkout_order") ? "Checkout is not ready yet. Please contact Agrolyst." : message }, 400, origin);
    }
    return json({ success: true, order: data }, 201, origin);
  } catch (error) {
    console.error("Unexpected checkout error:", error instanceof Error ? error.message : String(error));
    return json({ error: "We could not complete checkout. Please review your details or contact Agrolyst." }, 500, origin);
  }
});

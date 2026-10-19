import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const allowedOrigins = new Set([
  "https://agrolystfarms.com",
  "https://www.agrolystfarms.com",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
]);
const mimeExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

function headers(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://agrolystfarms.com",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json; charset=utf-8",
  };
}
function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: headers(origin) });
}
function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function phoneDigits(value: string) { return value.replace(/\D/g, ""); }

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (origin && !allowedOrigins.has(origin)) return json({ error: "This website is not allowed to submit receipts." }, 403, origin);
  if (req.method === "OPTIONS") return new Response("ok", { headers: headers(origin) });
  if (req.method !== "POST") return json({ error: "Use POST to submit a payment receipt." }, 405, origin);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) return json({ error: "Receipt upload is temporarily unavailable." }, 503, origin);

    const form = await req.formData();
    const orderNumber = clean(form.get("order_number"), 40).toUpperCase();
    const phone = clean(form.get("customer_phone"), 30);
    const file = form.get("receipt");
    if (!orderNumber || phoneDigits(phone).length < 7) return json({ error: "Enter the order reference and the phone number used at checkout." }, 400, origin);
    if (!(file instanceof File)) return json({ error: "Choose a receipt image or PDF file." }, 400, origin);
    if (!Object.hasOwn(mimeExtensions, file.type)) return json({ error: "Receipts must be JPG, PNG, WebP or PDF files." }, 400, origin);
    if (file.size < 1 || file.size > 5 * 1024 * 1024) return json({ error: "The receipt file must be smaller than 5 MB." }, 400, origin);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id,order_number,customer_phone,payment_method,payment_state,status")
      .eq("order_number", orderNumber)
      .maybeSingle();

    // Use the order reference plus the checkout phone as a confirmation for guest orders.
    if (orderError || !order || phoneDigits(order.customer_phone || "") !== phoneDigits(phone)) {
      return json({ error: "We could not match that order reference and phone number. Please check both details." }, 404, origin);
    }
    if (order.payment_method !== "bank_transfer" || order.payment_state === "paid" || order.status === "cancelled") {
      return json({ error: "This order cannot accept a new bank-transfer receipt." }, 409, origin);
    }

    const path = `${order.id}/${crypto.randomUUID()}.${mimeExtensions[file.type]}`;
    const { error: uploadError } = await admin.storage
      .from("payment-receipts")
      .upload(path, file, { contentType: file.type, cacheControl: "0", upsert: false });
    if (uploadError) {
      console.error("Receipt storage upload failed:", uploadError.message);
      return json({ error: "The receipt could not be uploaded. Please try again." }, 500, origin);
    }

    const { data: payment, error: paymentLookupError } = await admin
      .from("payments")
      .select("id")
      .eq("order_id", order.id)
      .eq("method", "bank_transfer")
      .in("status", ["unpaid", "pending_verification"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (paymentLookupError || !payment) {
      await admin.storage.from("payment-receipts").remove([path]);
      return json({ error: "We could not find a pending bank-transfer record for this order." }, 409, origin);
    }

    const { error: paymentUpdateError } = await admin.from("payments")
      .update({ receipt_path: path, status: "pending_verification", updated_at: new Date().toISOString() })
      .eq("id", payment.id)
      .in("status", ["unpaid", "pending_verification"]);
    if (paymentUpdateError) {
      await admin.storage.from("payment-receipts").remove([path]);
      console.error("Receipt payment update failed:", paymentUpdateError.message);
      return json({ error: "The receipt uploaded, but its status could not be updated. Please contact Agrolyst with your order reference." }, 500, origin);
    }
    const { error: orderUpdateError } = await admin.from("orders")
      .update({ payment_state: "pending_verification", updated_at: new Date().toISOString() })
      .eq("id", order.id);
    if (orderUpdateError) console.warn("Order payment state update failed:", orderUpdateError.message);

    return json({ success: true, message: "Receipt received. Agrolyst will verify the transfer before marking your order as paid." }, 200, origin);
  } catch (error) {
    console.error("Receipt upload failed:", error instanceof Error ? error.message : String(error));
    return json({ error: "The receipt could not be submitted. Please try again." }, 500, req.headers.get("origin"));
  }
});

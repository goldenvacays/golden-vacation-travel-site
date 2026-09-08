/* GET /.netlify/functions/exp-status?session_id=cs_...
   What the confirmation page polls. Reads the Checkout Session and its PaymentIntent metadata; returns only what the guest needs. */
import { json, stripe, bookingSummary } from "./_exp-shared.mjs";

export const handler = async (event) => {
  const sid = (event.queryStringParameters || {}).session_id || "";
  if (!/^cs_[A-Za-z0-9_]+$/.test(sid)) return json(400, { ok: false, error: "Bad session" });
  try {
    const s = await stripe(`/checkout/sessions/${sid}?expand[]=payment_intent`, null, "GET");
    if (s.payment_status !== "paid") return json(200, { ok: true, status: "UNPAID" });
    const m = s.metadata || {};
    const pim = (s.payment_intent && s.payment_intent.metadata) || {};
    const status = pim.rezdy_status || "PROCESSING";
    const summary = bookingSummary(m);
    return json(200, { ok: true, status, order: pim.rezdy_order || "", ...summary, confirm: pim.confirm || m.confirm || "live" });
  } catch (e) {
    console.warn("status", e.message);
    return json(200, { ok: false, error: "Not found" });
  }
};

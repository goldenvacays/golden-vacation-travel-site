/* POST /.netlify/functions/exp-webhook  (Stripe -> us)
   On checkout.session.completed (paid):
     JamWest (confirm=live): create the booking in the park's Rezdy account as the agent, record the payment against it
       (agent collects). If the park's system fails after the card has been charged, the booking is flagged NEEDS_ATTENTION
       and an alert form submission goes to the team so a person confirms it by hand.
     every other tour (confirm=team): paid means confirmed; the booking goes to the team's inbox (exp-bookings form) and a
       person books it with the operator and sends the guest their details.
   The outcome is written into the PaymentIntent's metadata, which is what the confirmation page and the records read. */
import { json, verifyStripeSignature, stripe, rezdy, rezdyProduct, netlifyForm, bookingSummary, longDate, usd } from "./_exp-shared.mjs";

async function createRezdyBooking(m, paymentIntentId) {
  const code = m.rezdy_code, start = m.rezdy_start;
  if (!code || !start) throw new Error("No Rezdy product on the session");
  /* quantities must use the product's own price option labels */
  let adultLabel = "Adult", childLabel = "Child";
  try {
    const p = await rezdyProduct(code);
    const opts = (p.priceOptions || []).map((o) => o.label);
    adultLabel = opts.find((l) => /adult/i.test(l)) || opts[0] || adultLabel;
    childLabel = opts.find((l) => /child|kid/i.test(l)) || childLabel;
  } catch (e) { console.warn("product options", e.message); }
  const quantities = [{ optionLabel: adultLabel, value: Number(m.adults) || 1 }];
  if (Number(m.children) > 0) quantities.push({ optionLabel: childLabel, value: Number(m.children) });
  const total = Number(m.total_usd) || 0;
  const pickupText = m.pickup_label ? `${m.pickup_label}${m.pickup_hotel ? `, ${m.pickup_hotel}` : ""}` : "";
  const comments = [`Booked and paid on goldenvacays.com (${m.ref}).`, m.choices ? `Choice: ${m.choices}.` : "", pickupText ? `Pickup: ${pickupText}.` : "", m.ship ? `Cruise: ${m.ship}.` : "", `Guest phone ${m.phone}.`].filter(Boolean).join(" ");
  const body = {
    resellerReference: m.ref,
    resellerComments: comments,
    sendNotifications: true,
    customer: { firstName: m.first, lastName: m.last, email: m.email, phone: m.phone },
    items: [{ productCode: code, startTimeLocal: start, quantities, ...(m.pickup_label && m.pickup !== "own" ? { pickupLocation: { locationName: m.pickup_hotel || m.pickup_label, ...(m.pickup_hotel ? { address: `${m.pickup_hotel} (${m.pickup_label})` } : {}) } } : {}) }],
    payments: [{ type: "CREDITCARD", amount: total, currency: "USD", label: `Paid online via goldenvacays.com, Stripe ${paymentIntentId}`, recipient: "AGENT" }],
    fields: [{ label: "Special requirements", value: comments }],
  };
  const res = await rezdy("/bookings", { method: "POST", body: JSON.stringify(body) });
  const booking = res.booking || res;
  return { orderNumber: booking.orderNumber || "", status: booking.status || "CONFIRMED" };
}

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "POST only" });
  const raw = event.isBase64Encoded ? Buffer.from(event.body || "", "base64").toString("utf8") : (event.body || "");
  const sig = event.headers["stripe-signature"] || event.headers["Stripe-Signature"];
  if (!verifyStripeSignature(raw, sig, process.env.STRIPE_WEBHOOK_SECRET)) return json(400, { error: "Bad signature" });
  let evt; try { evt = JSON.parse(raw); } catch { return json(400, { error: "Bad JSON" }); }
  if (evt.type !== "checkout.session.completed") return json(200, { received: true, ignored: evt.type });
  const session = evt.data.object;
  if (session.payment_status !== "paid") return json(200, { received: true, ignored: "unpaid" });
  const m = session.metadata || {};
  const piId = typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent && session.payment_intent.id);
  if (!m.ref || !piId) return json(200, { received: true, ignored: "not an experiences session" });

  /* idempotency: Stripe retries; never book twice */
  try {
    const pi = await stripe(`/payment_intents/${piId}`, null, "GET");
    if (pi.metadata && pi.metadata.rezdy_status && pi.metadata.rezdy_status !== "") return json(200, { received: true, already: pi.metadata.rezdy_status });
  } catch (e) { console.warn("pi lookup", e.message); }

  const summary = bookingSummary(m);
  const team = m.confirm === "team" || !m.rezdy_code; // no live calendar: paid means confirmed, and a person books it with the operator
  let outcome;
  if (team) {
    outcome = { rezdy_status: "CONFIRMED", rezdy_order: "", rezdy_error: "", confirm: "team" };
  } else {
    try {
      const r = await createRezdyBooking(m, piId);
      outcome = { rezdy_status: r.status === "CONFIRMED" ? "CONFIRMED" : "PENDING_SUPPLIER", rezdy_order: r.orderNumber, rezdy_error: "", confirm: "live" };
    } catch (e) {
      console.error("rezdy booking failed", m.ref, e.message, e.body ? JSON.stringify(e.body).slice(0, 500) : "");
      outcome = { rezdy_status: "NEEDS_ATTENTION", rezdy_order: "", rezdy_error: String(e.message || "unknown").slice(0, 200), confirm: "live" };
    }
  }
  try { await stripe(`/payment_intents/${piId}`, { metadata: outcome }); } catch (e) { console.error("pi metadata", e.message); }

  const statusLine = team ? "PAID · confirmed to the guest · book it with the operator and send their details" : outcome.rezdy_status;
  await netlifyForm("exp-bookings", { ref: m.ref, venue: m.venue_name, product: m.product_name, when: summary.when, guests: summary.guests, pickup: summary.pickup, customer: `${m.first} ${m.last}`, email: m.email, phone: m.phone, total: usd(Number(m.total_usd)), status: statusLine, order: outcome.rezdy_order, note: [m.choices, m.ship ? `Cruise: ${m.ship}` : "", `Stripe ${piId}`].filter(Boolean).join(" · ") });
  if (outcome.rezdy_status === "NEEDS_ATTENTION") {
    await netlifyForm("exp-alerts", { ref: m.ref, venue: m.venue_name, product: m.product_name, when: summary.when, customer: `${m.first} ${m.last} · ${m.phone} · ${m.email}`, total: usd(Number(m.total_usd)), error: `PAID but the park booking failed: ${outcome.rezdy_error}. Book it by hand and reply to the guest.` });
  }
  return json(200, { received: true, ref: m.ref, status: outcome.rezdy_status });
};

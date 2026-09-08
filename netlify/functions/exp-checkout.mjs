/* POST /.netlify/functions/exp-checkout
   Body: {slug, product, date, time, date2, flightIn, flightOut, adults, children, pickup, pickupHotel, choices[], ref, ship, customer:{first,last,email,phone}}
   Prices are recomputed here from the catalogue; the browser's numbers are never trusted.
   JamWest (live calendar): re-checks seats with the park first. Every other instant venue ("team"): no seat check, the guest is
   confirmed on payment and the team books it with the operator by hand. Then opens a Stripe Checkout Session and returns {url}. */
import { json, SITE, findVenue, findProduct, isLive, liveCalendar, isFlightPanel, dateProblem, visitorTotal, pickupOf, rezdyCodeFor, rezdySessions, timeToLocal, stripe, longDate, todayJamaica } from "./_exp-shared.mjs";

const clean = (s, n = 120) => String(s || "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, n);

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "POST only" });
  let b; try { b = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "Bad JSON" }); }
  const venue = findVenue(b.slug), product = findProduct(venue, b.product);
  if (!venue || !product) return json(404, { error: "Unknown product" });
  if (venue.booking !== "instant" || !product.visitor || product.request || !isLive(product)) return json(400, { error: "This one is booked by WhatsApp, not on the spot." });
  const prob = dateProblem(venue, product, b.date);
  if (prob) return json(400, { error: prob });
  const c = b.customer || {};
  const first = clean(c.first, 60), last = clean(c.last, 60), email = clean(c.email, 120), phone = clean(c.phone, 40);
  if (!first || !last) return json(400, { error: "We need a first and last name for the booking." });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(400, { error: "That email doesn't look right." });
  if (!phone) return json(400, { error: "We need a phone or WhatsApp number." });
  const choices = Array.isArray(b.choices) ? b.choices.map((x) => clean(x, 40)).filter(Boolean) : [];
  if (product.choose) {
    const ok = choices.length === product.choose.pick && choices.every((x) => product.choose.from.includes(x));
    if (!ok) return json(400, { error: `Pick ${product.choose.pick} for this one.` });
  }
  const priced = visitorTotal(venue, product, b.adults, b.children, b.pickup);
  if (!priced || priced.error) return json(400, { error: (priced && priced.error) || "Couldn't price that." });
  const live = liveCalendar(venue), flight = isFlightPanel(venue);
  const hasTimes = !!(product.times && product.times.length);
  const timeLabel = hasTimes || live ? clean(b.time, 20) : "";
  const wantLocal = timeLabel ? timeToLocal(timeLabel) : null;
  if ((hasTimes || live) && (!wantLocal || (hasTimes && !product.times.map(timeToLocal).includes(wantLocal)))) return json(400, { error: "Pick a start time." });
  /* airport lounges: the flight numbers are the booking */
  const legs = flight ? (product.legs || "both") : "";
  const flightIn = flight && legs !== "out" ? clean(b.flightIn, 12).toUpperCase() : "";
  const flightOut = flight && legs !== "in" ? clean(b.flightOut, 12).toUpperCase() : "";
  const date2 = flight && legs === "both" ? clean(b.date2, 10) : "";
  if (flight) {
    if (legs !== "out" && !/^[A-Z0-9]{2,3}\s?\d{1,4}[A-Z]?$/.test(flightIn)) return json(400, { error: "We need the arriving flight number, e.g. BA2263." });
    if (legs !== "in" && !/^[A-Z0-9]{2,3}\s?\d{1,4}[A-Z]?$/.test(flightOut)) return json(400, { error: "We need the departing flight number, e.g. BA2262." });
    if (legs === "both" && (!/^\d{4}-\d{2}-\d{2}$/.test(date2) || date2 < b.date)) return json(400, { error: "Pick the departure date too." });
  }
  const ref = /^GV-EXP-[A-Z0-9]{4}$/.test(b.ref || "") ? b.ref : `GV-EXP-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  /* JamWest: confirm the seats exist before taking money. Team venues: nothing to check live. */
  let code = "", start = "";
  if (live) {
    try {
      code = await rezdyCodeFor(venue, product, choices);
      if (!code) return json(409, { error: "This option can't be confirmed live right now." });
      const sessions = await rezdySessions(code, b.date);
      const s = sessions.find((x) => x.start.slice(11, 19) === wantLocal);
      if (!s) return json(409, { error: `No ${timeLabel} departure on ${longDate(b.date)}. Pick another time.` });
      const need = priced.adults + priced.children;
      if (s.seats < need) return json(409, { error: s.seats > 0 ? `Only ${s.seats} place${s.seats === 1 ? "" : "s"} left at ${timeLabel}.` : `Nothing left at ${timeLabel}.` });
      start = s.start;
    } catch (e) {
      console.warn("checkout availability", e.message);
      return json(409, { error: "The park's live calendar didn't answer." });
    }
  }

  const pk = pickupOf(venue, b.pickup);
  const pickupHotel = pk && pk.key !== "own" ? clean(b.pickupHotel, 80) : "";
  if (pk && pk.key !== "own" && !pickupHotel) return json(400, { error: "Which hotel should the driver collect you from?" });
  const whenDesc = flight
    ? [flightIn ? `arrives ${longDate(b.date)} on ${flightIn}` : "", flightOut ? `departs ${longDate(legs === "both" ? date2 : b.date)} on ${flightOut}` : ""].filter(Boolean).join(", ")
    : `${longDate(b.date)}${timeLabel ? ` at ${timeLabel}` : ""}`;
  const desc = `${product.name}, ${whenDesc}, ${priced.adults} adult${priced.adults === 1 ? "" : "s"}${priced.children ? `, ${priced.children} child${priced.children === 1 ? "" : "ren"}` : ""}${choices.length ? ` (${(product.choose && product.choose.fixed ? `${product.choose.fixed} + ` : "") + choices.join(" + ")})` : ""}`;
  const metadata = {
    ref, slug: venue.slug, product: product.id, venue_name: venue.name, product_name: product.name, confirm: live ? "live" : "team",
    date: b.date, time: timeLabel, date2, flight_in: flightIn, flight_out: flightOut, rezdy_code: code, rezdy_start: start,
    adults: String(priced.adults), children: String(priced.children), pickup: pk ? pk.key : "", pickup_label: pk ? pk.label : "", pickup_hotel: pickupHotel,
    choices: choices.join(" + "), ship: clean(b.ship, 120), first, last, email, phone, total_usd: String(priced.total), rezdy_status: "",
  };
  try {
    const session = await stripe("/checkout/sessions", {
      mode: "payment",
      customer_email: email,
      client_reference_id: ref,
      line_items: [{ quantity: 1, price_data: { currency: "usd", unit_amount: Math.round(priced.total * 100), product_data: { name: `${venue.name}: ${product.name}`, description: desc } } }],
      metadata,
      payment_intent_data: { metadata, description: `${ref} ${venue.name}: ${desc}` },
      success_url: `${SITE}/experiences/booked?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE}/experiences/${venue.slug}?cancelled=1`,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      allow_promotion_codes: false,
      billing_address_collection: "auto",
      phone_number_collection: { enabled: false },
    });
    return json(200, { url: session.url, ref });
  } catch (e) {
    console.error("stripe session", e.message);
    return json(502, { error: "The payment page didn't open." });
  }
};

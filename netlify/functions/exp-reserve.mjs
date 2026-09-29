/* POST /.netlify/functions/exp-reserve
   Pay on arrival for the JamWest tours (Adventure Park, Water Park, Catamaran), for dates today to 7 days out.
   Same body and the same checks as exp-checkout (price worked out here, never taken from the page), but no card:
   the booking goes to the exp-bookings form marked PAY ON ARRIVAL (the team books it with JamWest and sends the details)
   and the guest gets a "Reserved" email. Body: {slug, product, date, time, adults, children, pickup, pickupHotel, choices[], ref, customer:{first,last,email,phone}} */
import { netlifyForm, json, SITE, findVenue, findProduct, isLive, liveCalendar, isFlightPanel, dateProblem, visitorTotal, pickupOf, rezdyCodeFor, rezdySessions, timeToLocal, stripe, longDate, todayJamaica, shipDayProblem } from "./_exp-shared.mjs";
import { SHIP } from "./_exp-data.mjs";

const clean = (s, n = 120) => String(s || "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, n);

export const handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "POST only" });
  let b; try { b = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "Bad JSON" }); }
  const venue = findVenue(b.slug), product = findProduct(venue, b.product);
  if (!venue || !product) return json(404, { error: "Unknown product" });
  if (!/^jamwest/.test(venue.slug)) return json(400, { error: "Pay on arrival is only for the JamWest tours." });
  if (venue.booking !== "instant" || !product.visitor || product.request || !isLive(product)) return json(400, { error: "This one is booked by WhatsApp, not on the spot." });
  const prob = dateProblem(venue, product, b.date, undefined, b.children);
  if (prob) return json(400, { error: prob });
  const daysOut = Math.round((Date.parse(`${b.date}T00:00:00Z`) - Date.parse(`${todayJamaica()}T00:00:00Z`)) / 864e5);
  if (!(daysOut >= 0 && daysOut <= 7)) return json(400, { error: "Pay on arrival is for dates in the next 7 days. For later dates, pay by card." });
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
      if (code) {
        const sessions = await rezdySessions(code, b.date);
        const s = sessions.find((x) => x.start.slice(11, 19) === wantLocal);
        if (!s) return json(409, { error: `No ${timeLabel} departure on ${longDate(b.date)}. Pick another time.` });
        const need = priced.adults + priced.children;
        if (s.seats < need) return json(409, { error: s.seats > 0 ? `Only ${s.seats} place${s.seats === 1 ? "" : "s"} left at ${timeLabel}.` : `Nothing left at ${timeLabel}.` });
        start = s.start;
      }
    } catch (e) { console.warn("reserve availability (team books it by hand)", e.message); }
  }

  const pk = pickupOf(venue, b.pickup);
  const pickupHotel = pk && pk.key !== "own" ? clean(b.pickupHotel, 80) : "";
  if (pk && pk.key !== "own" && !pickupHotel) return json(400, { error: "Which hotel should the driver collect you from?" });
  /* cruise guests: the port they gave (or a port chosen as the pickup) and their all-aboard time decide whether this fits a ship day */
  const portSlug = SHIP && SHIP.venues[venue.slug] !== 0 ? (SHIP.ports[b.port] ? b.port : (pk && SHIP.ports[pk.key] ? pk.key : "")) : "";
  const aboard = /^\d{3,4}$/.test(String(b.aboard || "")) ? Number(b.aboard) : 0;
  const shipProb = shipDayProblem(venue, product, timeLabel, portSlug, aboard);
  if (shipProb) return json(400, { error: shipProb });
  const whenDesc = flight
    ? [flightIn ? `arrives ${longDate(b.date)} on ${flightIn}` : "", flightOut ? `departs ${longDate(legs === "both" ? date2 : b.date)} on ${flightOut}` : ""].filter(Boolean).join(", ")
    : `${longDate(b.date)}${timeLabel ? ` at ${timeLabel}` : ""}`;
  const desc = `${product.name}, ${whenDesc}, ${priced.adults} adult${priced.adults === 1 ? "" : "s"}${priced.children ? `, ${priced.children} child${priced.children === 1 ? "" : "ren"}` : ""}${choices.length ? ` (${(product.choose && product.choose.fixed ? `${product.choose.fixed} + ` : "") + choices.join(" + ")})` : ""}`;
  const guests = `${priced.adults} adult${priced.adults === 1 ? "" : "s"}${priced.children ? `, ${priced.children} child${priced.children === 1 ? "" : "ren"}` : ""}`;
  const pickupText = pk && pk.key !== "own" ? `${pk.label}: ${pickupHotel}` : "Making their own way";
  const total = `US$${priced.total}`;
  await netlifyForm("exp-bookings", { ref, venue: venue.name, product: product.name, when: whenDesc, guests, pickup: pickupText, customer: `${first} ${last}`, email, phone, total,
    status: "PAY ON ARRIVAL · nothing charged online · book it with JamWest as pay on arrival and send the guest their details",
    order: code ? `Rezdy ${code}` : "", note: [choices.length ? choices.join(" + ") : "", "Guest pays on arrival"].filter(Boolean).join(" · ") });
  const key = process.env.RESEND_API_KEY;
  if (key) {
    const esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const lines = [["Tour", `${venue.name}, ${product.name}`], ["When", whenDesc], ["Guests", guests], ["Pickup", pickupText], ["You pay on arrival", total]];
    const text = [`Hi ${first},`, "", `You're booked in. You pay ${total} when you arrive. Nothing was charged online.`, "", ...lines.map(([k, v]) => `${k}: ${v}`), "",
      `Your reference is ${ref}. One of our travel professionals will send your pickup details shortly.`, "Questions? WhatsApp +1 876 360 1567 or call 876 817 3467.", "", "Golden Vacation & Travel"].join("\n");
    const html = `<div style="font-family:Archivo,Helvetica,Arial,sans-serif;color:#0E0F0E;max-width:560px;line-height:1.5;font-size:16px"><p>Hi ${esc(first)},</p><p><b>You're booked in. You pay ${esc(total)} when you arrive.</b> Nothing was charged online.</p><table style="border-collapse:collapse;font-size:15px;margin:10px 0">${lines.map(([k, v]) => `<tr><td style="padding:6px 14px 6px 0;color:#5A5F57;vertical-align:top">${esc(k)}</td><td style="padding:6px 0;vertical-align:top">${esc(v)}</td></tr>`).join("")}</table><p>Your reference is <b style="background:#F2B93B;padding:2px 8px;border-radius:999px">${esc(ref)}</b>. One of our travel professionals will send your pickup details shortly.</p><p style="font-size:14px;margin-top:22px">Questions? WhatsApp +1 876 360 1567 or call 876 817 3467.<br><b>Golden Vacation &amp; Travel</b></p></div>`;
    try {
      const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: process.env.EXP_FROM || "Golden Experiences <experiences@goldenvacays.com>", to: [email], reply_to: process.env.GROUPS_REPLY_TO || "goldentravellers@outlook.com", subject: `Reserved: ${venue.name}, ${whenDesc} (${ref})`, text, html }) });
      if (!r.ok) console.error("reserve email", r.status, await r.text());
    } catch (e) { console.error("reserve email", e.message); }
  }
  return json(200, { ok: true, ref });
};

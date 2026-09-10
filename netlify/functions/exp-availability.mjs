/* GET /.netlify/functions/exp-availability?slug=jamwest&product=atv&date=2026-09-19&choice=Zipline|Horseback
   Live sessions for one product on one date, from the venue's Rezdy account. Never errors loudly: {ok:false} means "confirm by WhatsApp". */
import { json, findVenue, findProduct, isLive, liveCalendar, dateProblem, rezdyCodeFor, rezdySessions, timeToLocal } from "./_exp-shared.mjs";

export const handler = async (event) => {
  const q = event.queryStringParameters || {};
  const venue = findVenue(q.slug), product = findProduct(venue, q.product);
  if (!venue || !product) return json(404, { ok: false, error: "Unknown product" });
  if (venue.booking !== "instant" || !product.visitor || product.request || !isLive(product)) return json(200, { ok: false, error: "Not bookable on the spot" });
  const prob = dateProblem(venue, product, q.date);
  if (prob) return json(200, { ok: false, error: prob });
  /* no live calendar: the printed times stand, and the team confirms the booking after payment */
  if (!liveCalendar(venue)) return json(200, { ok: true, manual: true, date: q.date, sessions: (product.times || []).map((t) => ({ time: t, seats: null })) });
  const choices = (q.choice || "").split("|").filter(Boolean);
  try {
    const code = await rezdyCodeFor(venue, product, choices);
    if (!code) return json(200, { ok: false, error: "No live calendar for this option yet" });
    const sessions = await rezdySessions(code, q.date);
    const allowed = new Set((product.times || []).map(timeToLocal));
    const list = sessions
      .filter((s) => !allowed.size || allowed.has(s.start.slice(11, 19)))
      .map((s) => ({ time: s.time, start: s.start, seats: Math.max(0, Number(s.seats) || 0) }))
      .sort((a, b) => (a.start < b.start ? -1 : 1));
    return json(200, { ok: true, code, date: q.date, sessions: list }, { "Cache-Control": "private, max-age=60" });
  } catch (e) {
    console.warn("availability", e.message);
    return json(200, { ok: false, error: "Live availability is offline" });
  }
};

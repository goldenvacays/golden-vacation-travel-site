/* The facts every /resorts/<slug>/ page shares, booking page or status page: whether the resort is open (from
   public/map/resorts.js, the Airtable sync), the plain answer to "Is it open?", open resorts like it close by, airport
   drive times and transfer prices (data/transfers.json, data/transfer-rates.json), the tours near it (the lead of its
   /experiences/near/ page) and the quick answers, with their FAQPage data. Used by build-staycations.mjs (the eight
   booking pages) and build-resort-status.mjs (every other resort). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
const resortsJs = fs.readFileSync(path.join(ROOT, "public/map/resorts.js"), "utf8");
export const RESORTS = JSON.parse(resortsJs.slice(resortsJs.indexOf("["), resortsJs.lastIndexOf("]") + 1));
const T = read("data/transfers.json"), RATES = read("data/transfer-rates.json");
const STAY = read("data/staycations-resorts.json");
export const BOOKING = new Set(STAY.map((r) => r.slug));

export const slugify = (s) => String(s).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
export const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY = process.env.RESORTS_DAY || new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);
const [yy, mm, dd] = DAY.split("-").map(Number);
export const CHECKED = `${dd} ${MON[mm - 1]} ${yy}`, CHECKED_LONG = `${dd} ${MONTH[mm - 1]} ${yy}`;
const longWhen = (w) => String(w || "").replace(/\b(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4})\b/, (m, d, mo, y) => `${d} ${MONTH[MON.indexOf(mo)]} ${y}`).replace(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4})$/, (m, mo, y) => `${MONTH[MON.indexOf(mo)]} ${y}`);
const dated = (w) => /\d/.test(w || "");

export const byName = (name) => RESORTS.find((r) => r.name === name);
export const bySlug = (slug) => RESORTS.find((r) => slugify(r.name) === slug);
export const isOpen = (r) => ["Open", "Closing soon"].includes(r.status);
const ADULTS = new Set(read("data/resort-audience.json").adults);
export const adultsOnly = (r) => ADULTS.has(r.name) || /adults[ -]only/i.test(`${r.note} ${r.category}`);
export const photoOf = (r) => (r.photo ? `/map/${r.photo}` : "");
export const areaName = (r) => (r.area === "Ocho Rios & Runaway Bay" ? "Ocho Rios" : r.area);

/* the answer to "Is it open?": the big word, the sentence under it, the colour */
export function answer(r) {
  const n = r.name, a = areaName(r), w = longWhen(r.when);
  switch (r.status) {
    case "Open": return { big: "Yes, it’s open.", line: `${n} is open and taking bookings in ${a}, Jamaica.`, tone: "ok" };
    case "Closing soon": return { big: "Yes, for now.", line: `${n} is open now and closing for renovation${dated(r.when) ? ` (${w})` : ""}.`, tone: "warn" };
    case "Reopening": return { big: "Not yet.", line: dated(r.when) ? `${n} is closed and reopening ${w}.` : `${n} is closed and reopening. The date is not confirmed yet.`, tone: "warn" };
    case "Closed": return { big: "No.", line: `${n} is closed, and no reopening date has been announced.`, tone: "no" };
    case "Coming soon": return { big: "Not yet.", line: `${n} is a new resort coming to ${a}${dated(r.when) ? `, opening ${w}` : ". No opening date has been announced yet"}.`, tone: "new" };
    case "New": return { big: "Not yet.", line: `${n} is a new resort opening ${w} in ${a}.`, tone: "new" };
    case "Permanently closed": return { big: "No.", line: `${n} has closed permanently.`, tone: "no" };
    default: return { big: r.status, line: `${n}: ${r.status}.`, tone: "no" };
  }
}

/* open resorts like it, closest first: same kind of stay (adults only or not) counts more than the coast */
const km = (a, b) => { const R = 6371, t = Math.PI / 180, dLa = (b.lat - a.lat) * t, dLo = (b.lng - a.lng) * t; const x = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
/* all-inclusive resorts and plain hotels / villas are different stays: suggestions stay with the same kind */
export const isAllInclusive = (r) => !/hotel/i.test(r.category || "All-inclusive");
export function alternatives(r, n = 3) {
  if (!r.lat) return [];
  const cands = RESORTS.filter((x) => x !== r && x.status === "Open" && x.show !== "No" && x.lat && (x.photo || !isAllInclusive(x)))
    .map((x) => ({ x, d: km(r, x), s: km(r, x) + (adultsOnly(x) !== adultsOnly(r) ? 200 : 0) + (isAllInclusive(x) !== isAllInclusive(r) ? 150 : 0) + (x.region !== r.region ? 25 : 0) }))
    .sort((p, q) => p.s - q.s);
  /* a brand people stay loyal to (Sandals, Couples, RIU...) leads with its own nearest open resort */
  const brand = (x) => x.name.split(/\s+/)[0].toLowerCase();
  const same = cands.find((c) => brand(c.x) === brand(r) && adultsOnly(c.x) === adultsOnly(r));
  const pick = same ? [same, ...cands.filter((c) => c !== same)] : cands;
  return pick.slice(0, n).map(({ x, d }) => ({ r: x, slug: slugify(x.name), away: driveFromKm(d) }));
}
const driveFromKm = (d) => { const m = Math.max(5, Math.round((d * 1.9) / 5) * 5); return m < 60 ? `about ${m} min away` : `about ${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}` : ""} away`; };

/* airport drive times and transfer prices: the zone the resort sits in, the cheapest one-way car */
export function zoneOf(r) {
  const ovr = (T.site.hotelZones || {})[r.name];
  if (ovr) return ovr;
  for (const z of T.zones) { const u = z.rule; if (!u || u.region !== r.region) continue; if (u.lngMax != null && !(r.lng < u.lngMax)) continue; if (u.lngMin != null && !(r.lng >= u.lngMin)) continue; return z.key; }
  for (const z of T.zones) if (z.regions && z.regions.includes(r.region)) return z.key;
  return null;
}
const AIRPORTS = [["MBJ", "Montego Bay airport (MBJ)"], ["OCJ", "Ocho Rios airport (OCJ)"], ["KIN", "Kingston airport (KIN)"]];
export function transfers(r) {
  const z = zoneOf(r); if (!z) return [];
  const rows = AIRPORTS.map(([a, label]) => {
    const p = (((RATES.zones[z] || {})[a] || {}).in || []).map((x) => x[3]); const d = (T.drive[a] || {})[z];
    return p.length && d ? { a, label, drive: d, usd: Math.min(...p), mins: toMin(d) } : null;
  }).filter(Boolean).sort((p, q) => p.mins - q.mins);
  return rows.slice(0, 2);
}
const toMin = (s) => { const h = /(\d+) h(?: (\d+))?/.exec(s); if (h) return +h[1] * 60 + (+h[2] || 0); const m = /(\d+)(?: to \d+)? min/.exec(s); return m ? +m[1] : 999; };

/* the tours near it: the first sentence of its near page's lead */
const AREA_PAGE = { negril: "negril", lucea: "lucea", mobay: "montego-bay", falmouth: "falmouth", ocho: "ocho-rios", south: "south-coast" };
export function nearby(slug) {
  const r = RESORTS.find((x) => slugify(x.name) === slug);
  if (r && !isAllInclusive(r)) {
    /* hotels and villas: their tours live on the area page */
    const a = AREA_PAGE[r.region]; if (!a) return null;
    const f = path.join(ROOT, "public/experiences/area", `${a}.html`); if (!fs.existsSync(f)) return null;
    const m = /class="nr-lead">([\s\S]*?)<\/p>/.exec(fs.readFileSync(f, "utf8")); if (!m) return null;
    const text = m[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
    return { text: (text.match(/^[^.]+\./) || [text])[0], href: `/experiences/area/${a}` };
  }
  const f = path.join(ROOT, "public/experiences/near", `${slug}.html`);
  if (!fs.existsSync(f)) return null;
  const h = fs.readFileSync(f, "utf8"); const m = /class="nr-lead">([\s\S]*?)<\/p>/.exec(h);
  if (!m) return null;
  const text = m[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
  return { text: (text.match(/^[^.]+\./) || [text])[0], href: `/experiences/near/${slug}` };
}

/* the quick answers, as text (the page and the FAQPage data say the same thing) */
export function faqs(r, { booking = false } = {}) {
  const a = answer(r), alts = alternatives(r), tr = transfers(r), n = r.name;
  const altNames = alts.map((x) => x.r.name);
  const list = [[`Is ${n} open?`, `${a.big} ${a.line} Golden Vacation & Travel checked this on ${CHECKED_LONG}.`]];
  if (!isOpen(r) && r.status !== "Permanently closed" && altNames.length) list.push([`Where can I stay instead of ${n}?`, `The closest open resorts like it are ${altNames.slice(0, -1).join(", ")} and ${altNames[altNames.length - 1]}. Golden Vacation & Travel can quote any of them for your dates.`]);
  if (r.status === "Reopening" && dated(r.when)) list.push([`Can I book ${n} for after it reopens?`, `Yes. Golden Vacation & Travel can quote stays from ${longWhen(r.when)}. If the date moves, we move your booking.`]);
  if (tr.length) list.push([`How far is ${n} from the airport?`, `${tr.map((t, i) => `${i ? t.drive : cap(t.drive)} from ${t.label}`).join(", and ")}. A Golden Vacation & Travel private transfer for up to 3 people starts at US$${tr[0].usd} one way, taxes included.`]);
  if (isOpen(r)) list.push([`Can Jamaica residents book ${n} in J$?`, `Yes. Golden Vacation & Travel quotes ${n} in J$ or US$, and you can pay in either.`]);
  return list;
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export const faqLd = (list) => ({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: list.map(([q, t]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: t } })) });

/* the resort itself as schema.org Resort: name, place, photo, status line, and a from-price when we have one */
export function resortLd(r, { url, image, fromUsd = null, rooms = null } = {}) {
  const o = { "@context": "https://schema.org", "@type": isAllInclusive(r) ? "Resort" : "Hotel", name: r.name, url, description: answer(r).line,
    address: { "@type": "PostalAddress", addressLocality: areaName(r), addressCountry: "JM" } };
  if (r.lat) o.geo = { "@type": "GeoCoordinates", latitude: r.lat, longitude: r.lng };
  if (image) o.image = image;
  if (r.formerly) o.alternateName = r.formerly;
  if (rooms) o.numberOfRooms = rooms;
  if (fromUsd) o.priceRange = `From US$${fromUsd} per person per night`;
  if (isOpen(r)) o.makesOffer = { "@type": "Offer", url, priceCurrency: "USD", ...(fromUsd ? { price: fromUsd } : {}), offeredBy: { "@id": "https://goldenvacays.com/#organization" } };
  return o;
}
/* titles under 70 characters and descriptions of 160 or less (Bing's limits): first candidate that fits */
export const fit = (max, ...c) => c.find((x) => x && x.length <= max) || c[c.length - 1].slice(0, max - 1).replace(/\s+\S*$/, "") + "…";

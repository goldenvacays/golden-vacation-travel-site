/* GET /.netlify/functions/q-tripadvisor?hotel=chatrium-riverside
   Live Tripadvisor photos, rating and the three latest reviews for a hotel on a private quote page (/q/...),
   through the same Terra key as exp-tripadvisor (TRIPADVISOR_API_KEY, TRIPADVISOR_API_BASE, TRIPADVISOR_API_VERSION).
   Same rules as the tours:
     - only the Location ID is ever cached; photos, ratings and reviews are fetched fresh on every call and never stored;
     - the response carries Tripadvisor's own rating icons and the links back their linking policy asks for;
     - robots.txt already disallows /.netlify/functions/, and the quote pages are noindex.
   Billing (Discover): details 1 + reviews 1 + photos 1 per hotel load, plus up to 3 for a catalog search
   until the hotel's locationId is pinned below (the log line says which ID to pin). */
import { json } from "./_exp-shared.mjs";

const BASE = process.env.TRIPADVISOR_API_BASE || "https://terra.tripadvisor.com/api";
const VERSION = process.env.TRIPADVISOR_API_VERSION || "2";

// Hotels the quote pages can ask for. Pin locationId once the log shows it, to skip the billed search.
const HOTELS = {
  "chatrium-riverside": { search: "Chatrium Hotel Riverside Bangkok", country: "TH", lat: 13.7069, lng: 100.5101, locationId: null },
  "lebua-state-tower": { search: "lebua at State Tower", country: "TH", lat: 13.72156, lng: 100.51692, locationId: null },
  "shangri-la-bangkok": { search: "Shangri-La Bangkok", country: "TH", lat: 13.72143, lng: 100.51424, locationId: null },
  "avani-riverside": { search: "Avani+ Riverside Bangkok Hotel", country: "TH", lat: 13.70522, lng: 100.49111, locationId: null },
  "ramada-menam": { search: "Ramada Plaza by Wyndham Bangkok Menam Riverside", country: "TH", lat: 13.70757, lng: 100.50597, locationId: null },
};

const idCache = {};
let pausedUntil = 0;

async function ta(path, params = {}) {
  const key = process.env.TRIPADVISOR_API_KEY;
  if (!key) throw new Error("TRIPADVISOR_API_KEY is not set");
  if (Date.now() < pausedUntil) { const e = new Error("paused after a rate limit"); e.status = 429; throw e; }
  const q = new URLSearchParams();
  if (VERSION && !path.startsWith("/catalog/")) q.set("version", VERSION);
  for (const [k, v] of Object.entries(params)) if (v != null && v !== "") q.set(k, String(v));
  const go = async () => {
    const res = await fetch(`${BASE}${path}?${q}`, { headers: { "X-API-Key": key, Accept: "application/json" } });
    const body = await res.json().catch(() => ({}));
    if (res.status === 429) pausedUntil = Date.now() + 60 * 1000;
    return { res, body };
  };
  let { res, body } = await go();
  if (!res.ok && res.status === 400 && q.has("version") && /version/i.test(JSON.stringify(body))) { q.delete("version"); ({ res, body } = await go()); }
  if (res.ok) return body;
  const e = new Error([body.title, body.detail, body.message].filter(Boolean).join(" / ") || `Tripadvisor ${res.status}`); e.status = res.status; throw e;
}

const km = (a, b) => { if (!a || a.latitude == null || b.lat == null) return Infinity; const R = 6371, dLat = (b.lat - a.latitude) * Math.PI / 180, dLng = (b.lng - a.longitude) * Math.PI / 180; const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(s)); };

function pick(v) {
  if (typeof v === "string") return v;
  if (!Array.isArray(v) || !v.length) return "";
  const isEn = (t) => /^en\b/i.test(t.language || "");
  return (v.find((t) => t && t.primary && isEn(t) && t.value) || v.find((t) => t && t.primary && t.value) || v.find((t) => t && isEn(t) && t.value) || v.find((t) => t && t.value) || {}).value || "";
}

async function locationIdFor(slug, h) {
  if (h.locationId) return String(h.locationId);
  if (idCache[slug]) return idCache[slug];
  const body = await ta("/catalog/locations/search", { query: h.search, search_type: "NAME", country_code: h.country, category: "HOTEL", size: 3 });
  const hits = (body.data || []).map((x) => x.location || x).filter((l) => l && l.id);
  if (!hits.length) return null;
  hits.sort((a, b) => km(a.coordinates, h) - km(b.coordinates, h));
  idCache[slug] = String(hits[0].id);
  console.log("tripadvisor id", slug, idCache[slug], pick(hits[0].names), "(pin this in q-tripadvisor.mjs)");
  return idCache[slug];
}

function summary(loc) {
  const overall = (loc.traveler_ratings && loc.traveler_ratings.overall) || loc.overall_rating || {};
  const rank = (loc.rankings || []).find((r) => r && r.display_text) || {};
  const urls = (loc.urls && loc.urls.tripadvisor) || {};
  return { name: pick(loc.names), rating: Number(overall.rating || 0), count: Number(overall.count || 0), ratingImage: overall.icon_url || "",
           ranking: rank.display_text || "", url: urls.main || "", writeReview: urls.write_review || "" };
}

const TRIP = { BUSINESS: "Business", COUPLES: "Couples", FAMILY: "Family", FRIENDS: "Friends", SOLO: "Solo" };
const review = (r) => ({
  rating: Number(r.rating || 0), ratingImage: (r.rating_icon_url && r.rating_icon_url.url) || "",
  title: pick(r.title), text: pick(r.text), date: r.publish_ts ? String(r.publish_ts).slice(0, 10) : "",
  user: (r.user && r.user.username) || "", tripType: TRIP[r.trip_type] || "", url: r.url || "",
});

// A photo object can carry several sizes; take the one nearest 1000px wide.
function photo(p) {
  const found = [];
  (function walk(o, d) {
    if (!o || typeof o !== "object" || d > 4) return;
    if (typeof o.url === "string" && /^https:\/\//.test(o.url)) found.push({ url: o.url, w: Number(o.width || 0) });
    for (const k of Object.keys(o)) if (o[k] && typeof o[k] === "object") walk(o[k], d + 1);
  })(p, 0);
  if (!found.length) return null;
  found.sort((a, b) => Math.abs((a.w || 1000) - 1000) - Math.abs((b.w || 1000) - 1000));
  const owner = /MANAGEMENT|OWNER|PROFESSIONAL/i.test(JSON.stringify(p.source || p.type || p.photo_type || ""));
  return { url: found[0].url, caption: pick(p.caption || p.captions), by: (p.user && p.user.username) || "", owner };
}

export const handler = async (event) => {
  const qs = event.queryStringParameters || {};
  const slug = qs.hotel || "";
  const why = qs.why === "1";
  const h = HOTELS[slug];
  if (!h) return json(404, { ok: false });
  try {
    const id = await locationIdFor(slug, h);
    if (!id) return json(200, { ok: false, reason: "not found" });
    const [detailsR, reviewsR, photosR] = await Promise.allSettled([
      ta(`/locations/${id}`, { locale: "en-US" }),
      ta(`/locations/${id}/reviews`, { language: "en", sort_by: "MOST_RECENT", size: 3 }),
      ta(`/locations/${id}/photos`, { locale: "en-US", size: 5 }),
    ]);
    let loc = detailsR.status === "fulfilled" ? detailsR.value : null;
    if (!loc) loc = await ta(`/catalog/locations/${id}`, { locale: "en-US" }).catch(() => null);
    const s = loc ? summary(loc) : {};
    const reviews = reviewsR.status === "fulfilled" ? (reviewsR.value.data || []).slice(0, 3).map(review) : [];
    let photos = photosR.status === "fulfilled" ? (photosR.value.data || []).map(photo).filter(Boolean) : [];
    photos = photos.filter((p) => p.owner).concat(photos.filter((p) => !p.owner)).slice(0, 5); // the hotel's own photos first
    if (photosR.status === "rejected") console.warn("tripadvisor photos", slug, photosR.reason && photosR.reason.message);
    if (reviewsR.status === "rejected") console.warn("tripadvisor reviews", slug, reviewsR.reason && reviewsR.reason.message);
    const showRating = s.rating && s.count >= 5;
    return json(200, {
      ok: Boolean(showRating || photos.length), id,
      ...(showRating ? s : { name: s.name || "", url: s.url || "" }),
      reviews: showRating ? reviews : [], photos,
      ...(why ? { why: [detailsR, reviewsR, photosR].filter((r) => r.status === "rejected").map((r) => r.reason && r.reason.message).join(" | ") } : {}),
    });
  } catch (e) {
    console.warn("tripadvisor", slug, e.status || "", e.message);
    return json(200, { ok: false, reason: "offline", ...(why ? { why: `${e.status || ""} ${e.message}`.trim() } : {}) });
  }
};

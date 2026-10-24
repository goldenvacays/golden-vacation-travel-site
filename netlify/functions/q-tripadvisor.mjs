/* GET /.netlify/functions/q-tripadvisor?hotel=chatrium-riverside
   Live Tripadvisor photos, rating and the three latest reviews for a hotel on a private quote page (/q/...),
   through the same Terra key as exp-tripadvisor (TRIPADVISOR_API_KEY, TRIPADVISOR_API_BASE, TRIPADVISOR_API_VERSION).
   Same rules as the tours:
     - only the Location ID is ever cached; photos, ratings and reviews are fetched fresh on every call and never stored;
     - the response carries Tripadvisor's own rating icons and the links back their linking policy asks for;
     - robots.txt already disallows /.netlify/functions/, and the quote pages are noindex.
   Billing (Discover): details 1 + reviews 1 + photos 1 per hotel load, plus up to 3 for a catalog search
   until the hotel's locationId is pinned below (the log line says which ID to pin).
   Photos: pictures of the hotel itself, from the hotel's own uploads, at 1000px; logos, small images, menus and
   people shots are left out (see usable()). ?why=1 lists every photo Tripadvisor sent with its id, so a hotel can
   get "photos: [ids]" (shown first, in that order) or "skipPhotos: [ids]" in HOTELS below. */
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

/* A Terra photo is { id, caption, photo: { original_size_url, original_width, original_height }, source: { name:
   "Management" | "Traveler" }, user: { username, avatar_url: { url } }, cv_metadata?: { scene, attractiveness_score } }.
   Only photo.original_size_url is the picture: user.avatar_url is the uploader's profile picture (a selfie, a logo or
   Tripadvisor's default art) and is never shown. The CDN resizes with ?w=<px>&h=-1 (the height follows the width): only
   round widths work (w=799 or w=640 fail to load), and it never enlarges, so a smaller original comes back at its own size. */
const PHOTO_W = 1000;
const GOOD_SCENES = ["exterior", "view", "pool", "room", "common_area", "interior", "beach", "dining", "spa", "bathroom"];
const NOT_THE_HOTEL = /\b(logos?|awards?|certificates?|certified|menus?|staff|team|chefs?|managers?|selfie|portrait|bride|groom|wedding)\b/i;
const HOTEL_SHOT = /\b(exterior|facade|façade|building|tower|views?|river|riverside|skyline|pool|suites?|rooms?|bedroom|balcony|terrace|lobby|rooftop|garden|night)\b/i;

function sized(url, w) {
  try { const u = new URL(url); u.searchParams.set("w", String(w)); u.searchParams.set("h", "-1"); u.searchParams.set("s", "1"); return u.toString(); }
  catch { return ""; }
}

function photo(p) {
  const info = (p && p.photo) || {};
  const src = typeof info.original_size_url === "string" ? info.original_size_url : "";
  if (!/^https:\/\//.test(src) || /avatar/i.test(src)) return null;
  const w = Number(info.original_width || 0), h = Number(info.original_height || 0);
  const cv = p.cv_metadata || {};
  return {
    id: p.id, w, h, caption: pick(p.caption),
    owner: /^management$/i.test(String((p.source && p.source.name) || "")),
    scene: String(cv.scene || "").toLowerCase(), score: Number(cv.attractiveness_score || 0),
    url: sized(src, PHOTO_W),
  };
}

// Pictures of the hotel itself: big enough for the card, no logos, menus or people shots.
function usable(p, h, minW = 600) {
  if (!p || !p.url) return false;
  if ((h.skipPhotos || []).includes(p.id)) return false;
  if (p.w && p.w < minW) return false;                         // logos and thumbnails are small
  if (NOT_THE_HOTEL.test(p.caption)) return false;
  if (p.scene && !GOOD_SCENES.includes(p.scene)) return false; // Tripadvisor's own label says it is not the hotel ("other", "food", "menu"...)
  return true;
}

// Lower comes first: the building, views, pool and rooms lead, bathrooms, gyms and meeting rooms go last, and tall
// shots (which crop badly in the landscape card) come after the wide ones; ties keep Tripadvisor's order (newest first).
const BACK_ROOM = /\b(bath(room)?|toilet|shower|gym|fitness|meeting|conference|business|ballroom|corridor|hallway|elevator|lift)\b/i;
const rank = (p) => (p.scene ? GOOD_SCENES.indexOf(p.scene) * 10 - p.score * 5 : HOTEL_SHOT.test(p.caption) ? 20 : BACK_ROOM.test(p.caption) ? 60 : 50)
  + (p.w && p.h > p.w * 1.25 ? 100 : 0);

function choosePhotos(list, h, max = 6) {
  const all = list.map(photo).filter(Boolean);
  const ok = all.filter((p) => usable(p, h));
  let pool = ok.filter((p) => p.owner);                                   // the hotel's own photos
  if (!pool.length) pool = all.filter((p) => p.owner && usable(p, h, 400) && p.w && Math.abs(p.w - p.h) > p.w * 0.1); // older, smaller ones, never square (logos are)
  if (!pool.length) pool = ok.filter((p) => !p.owner && p.scene);         // travelers' only when the hotel has none, and only scenes Tripadvisor has labelled
  const pinned = (h.photos || []).map((id) => all.find((p) => p.id === id)).filter(Boolean);
  const rest = pool.filter((p) => !pinned.includes(p)).map((p, i) => ({ p, i }))
    .sort((a, b) => rank(a.p) - rank(b.p) || a.i - b.i).map((x) => x.p);
  return { chosen: pinned.concat(rest).slice(0, max), all };
}

// Enough photos to choose from; if the API turns the page size down, ask again for fewer.
const photosFor = (id) => ta(`/locations/${id}/photos`, { locale: "en-US", size: 30 })
  .catch((e) => (e.status === 400 ? ta(`/locations/${id}/photos`, { locale: "en-US", size: 10 }) : Promise.reject(e)));

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
      photosFor(id),
    ]);
    let loc = detailsR.status === "fulfilled" ? detailsR.value : null;
    if (!loc) loc = await ta(`/catalog/locations/${id}`, { locale: "en-US" }).catch(() => null);
    const s = loc ? summary(loc) : {};
    const reviews = reviewsR.status === "fulfilled" ? (reviewsR.value.data || []).slice(0, 3).map(review) : [];
    const picked = photosR.status === "fulfilled" ? choosePhotos(photosR.value.data || [], h) : { chosen: [], all: [] };
    const photos = picked.chosen.map((p) => ({ url: p.url, caption: p.caption, owner: p.owner }));
    if (photosR.status === "rejected") console.warn("tripadvisor photos", slug, photosR.reason && photosR.reason.message);
    if (reviewsR.status === "rejected") console.warn("tripadvisor reviews", slug, reviewsR.reason && reviewsR.reason.message);
    const showRating = s.rating && s.count >= 5;
    return json(200, {
      ok: Boolean(showRating || photos.length), id,
      ...(showRating ? s : { name: s.name || "", url: s.url || "" }),
      reviews: showRating ? reviews : [], photos,
      ...(why ? { why: [detailsR, reviewsR, photosR].filter((r) => r.status === "rejected").map((r) => r.reason && r.reason.message).join(" | "),
                  pool: picked.all.map((p) => [p.id, p.owner ? "hotel" : "traveler", p.scene || "-", p.score ? p.score.toFixed(2) : "-", `${p.w}x${p.h}`,
                    picked.chosen.includes(p) ? "SHOWN" : "", p.caption.slice(0, 50)].join(" · ")) } : {}),
    });
  } catch (e) {
    console.warn("tripadvisor", slug, e.status || "", e.message);
    return json(200, { ok: false, reason: "offline", ...(why ? { why: `${e.status || ""} ${e.message}`.trim() } : {}) });
  }
};

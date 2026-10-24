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
   get "photos: [ids]" (shown first, in that order) or "skipPhotos: [ids]" in HOTELS below.
   Star ratings: Tripadvisor sent no accommodation.star_rating for these hotels (October 2026; ?why=1 shows what it
   sends now), so each quote page prints the hotel class itself. */
import { json } from "./_exp-shared.mjs";

const BASE = process.env.TRIPADVISOR_API_BASE || "https://terra.tripadvisor.com/api";
const VERSION = process.env.TRIPADVISOR_API_VERSION || "2";

// Hotels the quote pages can ask for. Pin locationId once the log shows it, to skip the billed search (the search
// endpoints only allow 1 call a second, so a page of unpinned hotels runs into Tripadvisor's limit).
const HOTELS = {
  "chatrium-riverside": { search: "Chatrium Hotel Riverside Bangkok", country: "TH", lat: 13.7069, lng: 100.5101, locationId: 1315544 },
  "lebua-state-tower": { search: "lebua at State Tower", country: "TH", lat: 13.72156, lng: 100.51692, locationId: 301007,
    skipPhotos: [710859943, 710859945] }, // a 3-bedroom suite and an unnamed suite: the quote is for the 2-bedroom suite
  "shangri-la-bangkok": { search: "Shangri-La Bangkok", country: "TH", lat: 13.72143, lng: 100.51424, locationId: 307155,
    skipPhotos: [459681138] }, // a member of staff greeting a guest: people, not the hotel
  "avani-riverside": { search: "Avani+ Riverside Bangkok Hotel", country: "TH", lat: 13.70522, lng: 100.49111, locationId: 8822150 },
  "ramada-menam": { search: "Ramada Plaza Bangkok Menam Riverside", country: "TH", lat: 13.70757, lng: 100.50597, locationId: 305711,
    skipPhotos: [460450652, 460449226, 460449215, 460449250] }, // the 2020 hygiene set: masked staff cleaning rooms and at check-in

  // Things to do on the quote pages: Tripadvisor's listing for each place, for its photos, rating and reviews. Landmarks
  // have no owner's photos, so travelers' photos are allowed (travelerPhotos), minus the ones of people (see usable()).
  "chaophraya-cruise": { search: "The Chaophraya Cruise", country: "TH", category: "ATTRACTION", locationId: 3181688, travelerPhotos: true },
  "floating-market": { search: "Damnoen Saduak Floating Market", country: "TH", category: "ATTRACTION", locationId: 317729, travelerPhotos: true },
  "grand-palace": { search: "The Grand Palace", country: "TH", category: "ATTRACTION", locationId: 317603, travelerPhotos: true },
  "ayutthaya": { search: "Historic City of Ayutthaya", country: "TH", category: "ATTRACTION", locationId: 549787, travelerPhotos: true },
  "ayutthaya-park": { search: "Ayutthaya Historical Park", country: "TH", category: "ATTRACTION", locationId: 18194283, travelerPhotos: true },
};

const idCache = {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pausedUntil = 0;

/* Discover allows 10 calls a second. A 429 no longer fails the card: the call waits a moment and tries once more, and
   other calls from the same instance wait out that moment instead of piling in. A server error or a dropped connection
   also gets one more try, half a second later.
   Time: Netlify stops a function at 10 seconds, and Tripadvisor sometimes sits on a call for several. Each try gets at
   most 4 seconds and everything has to finish by `until` (7.5 seconds after the page asked), so a slow call is cut
   short and the answer goes back as partial, which the page asks for once more, instead of the whole card failing. */
const TRY_MS = 4000;
async function ta(path, params = {}, until = Date.now() + 7500) {
  const key = process.env.TRIPADVISOR_API_KEY;
  if (!key) throw new Error("TRIPADVISOR_API_KEY is not set");
  if (Date.now() < pausedUntil) await sleep(Math.max(0, Math.min(pausedUntil, until - 1500) - Date.now()));
  const q = new URLSearchParams();
  if (VERSION && !path.startsWith("/catalog/")) q.set("version", VERSION);
  for (const [k, v] of Object.entries(params)) if (v != null && v !== "") q.set(k, String(v));
  const go = async () => {
    const left = until - Date.now();
    if (left < 700) return { res: { ok: false, status: 0 }, body: { message: "no time left for Tripadvisor" } };
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), Math.min(TRY_MS, left));
    try {
      const res = await fetch(`${BASE}${path}?${q}`, { headers: { "X-API-Key": key, Accept: "application/json" }, signal: ctl.signal });
      let body = {};
      try { body = await res.json(); } catch (err) { if (ctl.signal.aborted) throw err; } // a body cut off by the clock is a failure, not an empty answer
      return { res, body };
    } catch (err) {
      return { res: { ok: false, status: 0 }, body: { message: ctl.signal.aborted ? `Tripadvisor did not answer within ${Math.round(Math.min(TRY_MS, left) / 100) / 10}s` : `connection: ${(err && err.message) || err}` } };
    } finally { clearTimeout(timer); }
  };
  let { res, body } = await go();
  if (res.status === 429 || res.status === 0 || res.status >= 500) {
    const wait = res.status === 429 ? 1200 + Math.round(Math.random() * 400) : 500;
    if (res.status === 429) pausedUntil = Math.max(pausedUntil, Date.now() + wait);
    if (until - Date.now() > wait + 1000) { await sleep(wait); ({ res, body } = await go()); }
  }
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

async function locationIdFor(slug, h, until) {
  if (h.locationId) return String(h.locationId);
  if (idCache[slug]) return idCache[slug];
  const body = await ta("/catalog/locations/search", { query: h.search, search_type: "NAME", country_code: h.country, category: h.category || "HOTEL", size: 3 }, until);
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
const TRAVELER_PEOPLE = /\b(me|us|my|our|we|family|friends?|kids?|daughter|son|wife|husband|girlfriend|boyfriend|mom|mum|dad)\b/i;
function usable(p, h, minW = 800) {
  if (!p || !p.url) return false;
  if ((h.skipPhotos || []).includes(p.id)) return false;
  if (p.w && p.w < minW) return false;                         // logos and thumbnails are small
  if (NOT_THE_HOTEL.test(p.caption)) return false;
  if (!p.owner && TRAVELER_PEOPLE.test(p.caption)) return false; // a traveler's "me at the palace" is a photo of people
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
  if (!pool.length) pool = ok.filter((p) => !p.owner && (p.scene || h.travelerPhotos)); // travelers' only when the owner has none: at hotels only scenes Tripadvisor has labelled, at landmarks any (travelerPhotos)
  const pinned = (h.photos || []).map((id) => all.find((p) => p.id === id)).filter(Boolean);
  const rest = pool.filter((p) => !pinned.includes(p)).map((p, i) => ({ p, i }))
    .sort((a, b) => rank(a.p) - rank(b.p) || a.i - b.i).map((x) => x.p);
  return { chosen: pinned.concat(rest).slice(0, max), all };
}

/* The photos endpoint gives 5 photos a call (asking for more brought nothing new). When fewer than 3 of the first five
   are usable (Ramada's are mostly 2020 shots of staff in masks) and Tripadvisor's own page count says there are more,
   the next page is asked for once (one more billed call, only for that hotel). ?why=1 shows the page counts, and
   ?why=1&page=N asks for page N first, to check how the paging works. */
const photosFor = (id, until, page) => ta(`/locations/${id}/photos`, { locale: "en-US", size: 5, page }, until);

export const handler = async (event) => {
  const qs = event.queryStringParameters || {};
  const slug = qs.hotel || "";
  const why = qs.why === "1";
  const probePage = why && /^\d{1,2}$/.test(qs.page || "") ? Number(qs.page) : undefined;
  const h = HOTELS[slug];
  if (!h) return json(404, { ok: false });
  const until = Date.now() + 7500; // everything Tripadvisor has to say, inside Netlify's 10 seconds
  try {
    const id = await locationIdFor(slug, h, until);
    if (!id) return json(200, { ok: false, reason: "not found" });
    // 150ms apart rather than all three at once, so a page of hotels never bursts past the per-second limit
    const [detailsR, reviewsR, photosR] = await Promise.allSettled([
      ta(`/locations/${id}`, { locale: "en-US" }, until),
      sleep(150).then(() => ta(`/locations/${id}/reviews`, { language: "en", sort_by: "MOST_RECENT", size: 3 }, until)),
      sleep(300).then(() => photosFor(id, until, probePage)),
    ]);
    let loc = detailsR.status === "fulfilled" ? detailsR.value : null;
    if (!loc && until - Date.now() > 1500) loc = await ta(`/catalog/locations/${id}`, { locale: "en-US" }, until).catch(() => null);
    const s = loc ? summary(loc) : {};
    const reviews = reviewsR.status === "fulfilled" ? (reviewsR.value.data || []).slice(0, 3).map(review) : [];
    let list = photosR.status === "fulfilled" ? photosR.value.data || [] : [];
    const pg = (photosR.status === "fulfilled" && photosR.value.pagination) || {};
    let picked = choosePhotos(list, h), extraPage = null;
    if (picked.chosen.length < 3 && Number(pg.total_pages) > 1 && Number(pg.page) < Number(pg.total_pages) && until - Date.now() > 2000) {
      extraPage = Number(pg.page) + 1; // the page Tripadvisor says it gave us, plus one
      const more = await photosFor(id, until, extraPage).catch((e) => { console.warn("tripadvisor photos page", extraPage, slug, e.message); return null; });
      const seen = new Set(list.map((p) => p && p.id));
      if (more && Array.isArray(more.data)) { list = list.concat(more.data.filter((p) => p && !seen.has(p.id))); picked = choosePhotos(list, h); }
    }
    const photos = picked.chosen.map((p) => ({ url: p.url, caption: p.caption, owner: p.owner }));
    if (photosR.status === "rejected") console.warn("tripadvisor photos", slug, photosR.reason && photosR.reason.message);
    if (reviewsR.status === "rejected") console.warn("tripadvisor reviews", slug, reviewsR.reason && reviewsR.reason.message);
    const showRating = s.rating && s.count >= 5;
    return json(200, {
      ok: Boolean(showRating || photos.length), id,
      ...(showRating ? s : { name: s.name || "", url: s.url || "" }),
      reviews: showRating ? reviews : [], photos,
      ...([detailsR, reviewsR, photosR].some((r) => r.status === "rejected") ? { partial: true } : {}), // the page asks once more
      ...(why ? { why: [detailsR, reviewsR, photosR].filter((r) => r.status === "rejected").map((r) => r.reason && r.reason.message).join(" | "),
                  ms: 7500 - (until - Date.now()),
                  starRating: !loc ? "no details" : loc.accommodation ? (loc.accommodation.star_rating ?? "none sent") : "no accommodation block",
                  photoPages: { asked: probePage ?? "default", page: pg.page ?? null, size: pg.size ?? null, total: pg.total_elements ?? null, pages: pg.total_pages ?? null, extraPage },
                  pool: picked.all.map((p) => [p.id, p.owner ? "hotel" : "traveler", p.scene || "-", p.score ? p.score.toFixed(2) : "-", `${p.w}x${p.h}`,
                    picked.chosen.includes(p) ? "SHOWN" : "", p.caption.slice(0, 50)].join(" · ")) } : {}),
    });
  } catch (e) {
    console.warn("tripadvisor", slug, e.status || "", e.message);
    return json(200, { ok: false, reason: "offline", ...(why ? { why: `${e.status || ""} ${e.message}`.trim() } : {}) });
  }
};

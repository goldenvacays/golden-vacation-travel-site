#!/usr/bin/env node
/*
  Airport transfers: private rides from Montego Bay (MBJ), Kingston (KIN) and Ocho Rios (OCJ) airport to every resort on the island,
  and hotel to hotel. Search first (hotel, airport, way, people, dates), then a table of vehicles with a price each, then Choose and pay.

  Reads data/transfers.json (copy, zones, drive times) and data/transfer-rates.json (prices, from Hana's rate sheet) and writes:
    public/transfers/index.html               the page, served at /transfers
    public/transfers/checkout.html            the checkout page (who's travelling, then Stripe's card form on the page), /transfers/checkout
    public/transfers/booked.html              the page a guest lands on after paying, served at /transfers/booked
    public/assets/transfers-rates.js          the prices as a script the page loads (window.GV_TR_RATES)
    netlify/functions/_tr-data.mjs            the same prices as a module for the checkout function (recomputed server-side)
  Same shape as the Experiences section: flat files, Bold design, getaways.css (tokens) + home.css + experiences.css (components)
  + /assets/transfers.css and transfers.js for the search bar, the results table and the checkout page.
  Hotels come from the resort list the status page uses (public/map/resorts.js); a hotel prices at its own row in the rate sheet
  when it has one, otherwise at its zone's fallback; a villa or Airbnb prices at its zone.

  Usage:
    node scripts/build-transfers.mjs                        write the pages
    node scripts/build-transfers.mjs --zones                print which hotel prices at which sheet row or zone
    node scripts/build-transfers.mjs --bundle out.html      single-file preview (inline CSS/JS/images/rates)
    node scripts/build-transfers.mjs --bundle out.html --artifact   same, without the html/head/body shell (for the Artifact tool)
*/
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { islandSvg, jpegSize, roundRing, ringPath } from "./lib-island.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const T = JSON.parse(fs.readFileSync(path.join(ROOT, "data/transfers.json"), "utf8"));
const R = JSON.parse(fs.readFileSync(path.join(ROOT, "data/transfer-rates.json"), "utf8"));
const H = JSON.parse(fs.readFileSync(path.join(ROOT, "data/home.json"), "utf8"));
const G = JSON.parse(fs.readFileSync(path.join(ROOT, "data/getaways.json"), "utf8"));
const X = fs.existsSync(path.join(ROOT, "data/experiences.json")) ? JSON.parse(fs.readFileSync(path.join(ROOT, "data/experiences.json"), "utf8")) : { site: {}, venues: [] };
const S = { ...G.site, email: X.site.email || H.footer.email, hours: X.site.hours || "Replies come within working hours." };
const BASE = "/transfers";
const ASSETS = "/assets";
const IMG = `${ASSETS}/img`;
const IMG_DIR = path.join(ROOT, "public/assets/img");
const BUNDLE = args.includes("--bundle") ? args[args.indexOf("--bundle") + 1] : null;
const ARTIFACT = args.includes("--artifact");
const NOINDEX = args.includes("--noindex");
const NOTE = args.includes("--note") ? args[args.indexOf("--note") + 1] : "";
const TODAY = new Date().toISOString().slice(0, 10);
const STAMP = crypto.createHash("md5").update(["public/assets/transfers.css", "public/assets/transfers.js"].map((f) => fs.readFileSync(path.join(ROOT, f), "utf8")).join("\n")).digest("hex").slice(0, 8);
const RATES_STAMP = crypto.createHash("md5").update(JSON.stringify(R)).digest("hex").slice(0, 8);
const EXP_STAMP = crypto.createHash("md5").update(["public/assets/experiences.css", "public/assets/experiences.js"].map((f) => fs.readFileSync(path.join(ROOT, f), "utf8")).join("\n")).digest("hex").slice(0, 8);
const CHROME_STAMP = crypto.createHash("md5").update(fs.readFileSync(path.join(ROOT, "public/assets/chrome.js"), "utf8")).digest("hex").slice(0, 8);

/* ---------- helpers ---------- */
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const usd = (n) => `US$${fmt(n)}`;
const noDash = (s) => String(s).replace(/—/g, ",").replace(/–/g, "to");
const usedImages = new Set();
const img = (file) => { usedImages.add(file); return `${IMG}/${file}`; };
const pic = (file, alt, extra = "") => `<img src="${img(file)}" alt="${esc(alt)}"${/loading=/.test(extra) ? "" : ' loading="lazy"'} decoding="async"${extra}>`;
/* the island: the hero photo clipped to the coastline of Jamaica, the three airports pinned where they are (scripts/lib-island.mjs) */
const JM = JSON.parse(fs.readFileSync(path.join(ROOT, "data/jamaica.json"), "utf8"));
const island = (photo) => islandSvg({ ring: JM.ring, airports: T.airports, photoUrl: img(photo.file), size: jpegSize(path.join(IMG_DIR, photo.file)), focus: photo.focus, alt: photo.alt, esc });
const wa = (text) => `https://wa.me/${S.whatsapp}?text=${encodeURIComponent(text)}`;
const waHome = wa("Hi Golden Vacation! I'd like an airport transfer in Jamaica. Ref GV-TR");

const ICONS = {
  arrow: '<path d="M5 12h14"></path><path d="M13 6l6 6-6 6"></path>',
  pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle>',
  chat: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>',
  menu: '<path d="M3 12h18M3 6h18M3 18h18"></path>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M16 2v4M8 2v4M3 10h18"></path>',
  clock: '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>',
  check: '<path d="M20 6L9 17l-5-5"></path>',
  x: '<path d="M18 6L6 18M6 6l12 12"></path>',
  car: '<path d="M5 17h14M6 17l1.5-5h9L18 17M4 17v2h2v-2M18 17v2h2v-2"></path><path d="M7.5 12L9 8h6l1.5 4"></path>',
  plane: '<path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 11l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 2.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"></path>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2"></rect><path d="M2 10h20"></path>',
  bolt: '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"></path>',
  tag: '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"></path><circle cx="7" cy="7" r="1.5"></circle>',
  search: '<circle cx="11" cy="11" r="7"></circle><path d="M21 21l-4.3-4.3"></path>',
  bag: '<path d="M6 7h12l1 14H5L6 7z"></path><path d="M9 7V5a3 3 0 0 1 6 0v2"></path>',
  back: '<path d="M19 12H5"></path><path d="M11 18l-6-6 6-6"></path>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2"></rect><path d="M8 11V8a4 4 0 0 1 8 0v3"></path>',
  hotel: '<path d="M3 21V7l9-4 9 4v14"></path><path d="M9 21v-6h6v6M9 11h.01M15 11h.01"></path>',
};
const icon = (name, size = 20, sw = 2.2) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;display:block">${ICONS[name]}</svg>`;
const kicker = (text, light = false) => `<span class="kicker${light ? " kicker-light" : ""}">${esc(text)}</span>`;
const btn = (label, href, kind = "black", size = "", iconName = "arrow", extra = "") => `<a class="btn btn-${kind}${size ? ` btn-${size}` : ""}" href="${href}"${extra}>${esc(label)}${iconName ? icon(iconName, 18) : ""}</a>`;
const currency = () => `<div class="curr" role="group" aria-label="Currency"><button type="button" data-c="USD" class="on">US$</button><button type="button" data-c="JMD">J$</button></div>`;
const longShort = (long, short) => `<span class="long">${esc(long)}</span><span class="short">${esc(short || long)}</span>`;

const NAV = [["Getaways", "/getaways/"], ["Staycations", "/#staycations"], ["Jamaica", "/#coming"], ["Experiences", "/experiences/"], ["Transfers", "/transfers/"], ["Groups", "/group-inquiry"], ["Resort status", "/hotel-status"]];
const ZONE = Object.fromEntries(T.zones.map((z) => [z.key, z]));

/* ---------- hotels: the resort list, each priced at its sheet row or its zone ---------- */
const resortsJs = fs.readFileSync(path.join(ROOT, "public/map/resorts.js"), "utf8");
const RESORTS = JSON.parse(resortsJs.slice(resortsJs.indexOf("["), resortsJs.lastIndexOf("]") + 1));
const slugify = (s) => String(s).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const ZONE_OVERRIDE = T.site.hotelZones || {}; // a hotel that prices in a different zone from its region (the sheet's own rows)
const RATE_KEY_BY_NAME = {};
for (const [key, h] of Object.entries(R.hotels)) for (const n of h.matches || []) RATE_KEY_BY_NAME[n] = key;
function zoneOf(r) {
  for (const z of T.zones) {
    const rule = z.rule;
    if (!rule || rule.region !== r.region) continue;
    if (rule.lngMax != null && !(r.lng < rule.lngMax)) continue;
    if (rule.lngMin != null && !(r.lng >= rule.lngMin)) continue;
    return z.key;
  }
  for (const z of T.zones) if (z.regions && z.regions.includes(r.region)) return z.key;
  return null;
}
const HIDE = new Set(T.site.hide || []); // closed hotels kept off the transfers list, by name
const HOTELS = RESORTS.filter((r) => r.status !== "Permanently closed" && r.lat && r.lng && !HIDE.has(r.name))
  .map((r) => ({ name: r.name, slug: slugify(r.name), zone: ZONE_OVERRIDE[r.name] || (RATE_KEY_BY_NAME[r.name] ? R.hotels[RATE_KEY_BY_NAME[r.name]].zone : zoneOf(r)), rate: RATE_KEY_BY_NAME[r.name] || null }))
  .filter((h) => h.zone)
  .concat(T.zones.flatMap((z) => (z.places || []).filter((name) => !HIDE.has(name) && !RESORTS.some((r) => r.name === name || slugify(r.name) === slugify(name))).map((name) => ({ name, slug: slugify(name), zone: ZONE_OVERRIDE[name] || z.key, rate: RATE_KEY_BY_NAME[name] || null }))))
  .sort((a, b) => a.name.localeCompare(b.name));
if (args.includes("--zones")) {
  for (const h of HOTELS) console.log(`${h.name.padEnd(46)} ${h.zone.padEnd(12)} ${h.rate ? "sheet: " + R.hotels[h.rate].name : "zone fallback"}`);
  const unmatched = Object.values(R.hotels).flatMap((h) => h.matches.filter((n) => !RESORTS.some((r) => r.name === n)));
  if (unmatched.length) console.log("\nsheet names that match no resort:", unmatched.join(", "));
  process.exit(0);
}
/* ---------- the route map on the checkout page: the coastline outline, every pin projected into the same 1000-wide space ---------- */
const MAP = (() => {
  const ring = JM.ring, lons = ring.map((p) => p[0]), lats = ring.map((p) => p[1]);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons), minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const kx = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const W = 1000, scale = W / ((maxLon - minLon) * kx), Hh = (maxLat - minLat) * scale;
  const proj = (lng, lat) => [+((lng - minLon) * kx * scale).toFixed(1), +((maxLat - lat) * scale).toFixed(1)];
  /* the coastline is 510 points (OpenStreetMap, one roughly every 2 km) with the corners rounded off, so the shape
     is the real one and it still looks smooth at the lens's 9x. A spline THROUGH the points bulged past the coast
     and tied the Palisadoes spit at Kingston into a loop, which is why the island used to look wrong. */
  const d = ringPath(roundRing(ring.map(([lo, la]) => proj(lo, la))));
  const byName = Object.fromEntries(RESORTS.map((r) => [r.name, r]));
  /* where each area sits: the middle of its hotels, or a hand-placed point for areas whose places carry no coordinates */
  const FALLBACK = { mobay: [18.49, -77.92], "mobay-nonai": [18.49, -77.9], "rose-hall": [18.51, -77.83], lucea: [18.45, -78.17], "hanover-villas": [18.45, -78.0], falmouth: [18.49, -77.65], "runaway-bay": [18.45, -77.33], "ocho-rios": [18.41, -77.11], negril: [18.27, -78.34], "south-coast": [18.07, -77.95], "treasure-beach": [17.88, -77.76], kingston: [18.01, -76.79], "blue-mountains": [18.08, -76.65], "port-antonio": [18.18, -76.45] };
  const zones = {}, hotels = {};
  for (const z of T.zones) {
    const pts = HOTELS.filter((h) => h.zone === z.key && byName[h.name] && byName[h.name].lat).map((h) => [byName[h.name].lat, byName[h.name].lng]);
    const [la, lo] = pts.length ? [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length] : (FALLBACK[z.key] || [18.2, -77.5]);
    zones[z.key] = proj(lo, la);
  }
  for (const h of HOTELS) { const r = byName[h.name]; if (r && r.lat && r.lng) hotels[h.slug] = proj(r.lng, r.lat); }
  const airports = Object.fromEntries(T.airports.map((a) => [a.code, proj(a.lng, a.lat)]));
  /* the roads: a small graph of towns. Coastal legs follow the coastline (nudged a little inland, like the road does); inland legs are
     the highways and the hill roads. The page picks the shortest way through the graph, so Kingston to Negril goes the south road
     through Mandeville and Kingston to Montego Bay goes Ocho Rios and the north coast, the way the drivers actually go. */
  const NODES = { negril: [18.27, -78.34], lucea: [18.45, -78.17], hopewell: [18.46, -78.02], "montego-bay": [18.47, -77.92], MBJ: [T.airports[0].lat, T.airports[0].lng], "rose-hall": [18.51, -77.83], falmouth: [18.49, -77.65], "runaway-bay": [18.45, -77.33], "ocho-rios": [18.41, -77.11], OCJ: null, "port-antonio": [18.18, -76.45], "morant-bay": [17.88, -76.41], kingston: [18.0, -76.79], KIN: null,
    "spanish-town": [17.99, -76.95], "bog-walk": [18.1, -77.0], linstead: [18.14, -77.03], moneague: [18.28, -77.1], papine: [18.03, -76.74], "strawberry-hill": [18.08, -76.65], "old-harbour": [17.94, -77.11], "may-pen": [17.96, -77.24], mandeville: [18.04, -77.5], "santa-cruz": [18.06, -77.7], "treasure-beach": [17.89, -77.76], "black-river": [18.03, -77.85], whitehouse: [18.07, -77.95], bluefields: [18.17, -78.03], "savanna-la-mar": [18.22, -78.13], montpelier: [18.35, -77.98] };
  for (const a of T.airports) NODES[a.code] = [a.lat, a.lng];
  const nodes = Object.fromEntries(Object.entries(NODES).map(([k, [la, lo]]) => [k, proj(lo, la)]));
  /* [from, to, coast?] : a coastal leg walks the coastline between the two; an inland leg is a straight run */
  const EDGES = [["negril", "lucea", 1], ["lucea", "hopewell", 1], ["hopewell", "montego-bay", 1], ["montego-bay", "MBJ", 1], ["MBJ", "rose-hall", 1], ["rose-hall", "falmouth", 1], ["falmouth", "runaway-bay", 1], ["runaway-bay", "ocho-rios", 1], ["ocho-rios", "OCJ", 1], ["OCJ", "port-antonio", 1], ["port-antonio", "morant-bay", 1], ["morant-bay", "KIN", 1], ["KIN", "kingston", 0],
    ["treasure-beach", "black-river", 1], ["black-river", "whitehouse", 1], ["whitehouse", "bluefields", 1], ["bluefields", "savanna-la-mar", 1], ["savanna-la-mar", "negril", 1],
    ["kingston", "spanish-town", 0], ["spanish-town", "bog-walk", 0], ["bog-walk", "linstead", 0], ["linstead", "moneague", 0], ["moneague", "ocho-rios", 0], ["kingston", "papine", 0], ["papine", "strawberry-hill", 0],
    ["spanish-town", "old-harbour", 0], ["old-harbour", "may-pen", 0], ["may-pen", "mandeville", 0], ["mandeville", "santa-cruz", 0], ["santa-cruz", "treasure-beach", 0], ["santa-cruz", "black-river", 0], ["montego-bay", "montpelier", 0], ["montpelier", "savanna-la-mar", 0]];
  /* the coastline nudged inland, so a coastal leg reads as the road and not the surf; orientation decides which side is inland.
     The road walks every fourth coastline point: at the full 2 km spacing a 7-unit inland nudge folds back on itself
     around every cove, and the road is a road, not a survey. */
  const pts = ring.filter((_, i) => i % 4 === 0).map(([lo, la]) => proj(lo, la));
  let area = 0; for (let i = 0; i < pts.length; i++) { const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length]; area += x1 * y2 - x2 * y1; }
  const sgn = area > 0 ? 1 : -1; /* in screen space (y down), a positive area means the ring runs clockwise on screen */
  const coast = pts.map((p, i) => { const a = pts[(i - 1 + pts.length) % pts.length], b = pts[(i + 1) % pts.length]; const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1; const nx = (-dy / l) * sgn, ny = (dx / l) * sgn; return [+(p[0] + nx * 7).toFixed(1), +(p[1] + ny * 7).toFixed(1)]; });
  const cum = [0]; for (let i = 1; i <= coast.length; i++) cum.push(cum[i - 1] + Math.hypot(coast[i % coast.length][0] - coast[i - 1][0], coast[i % coast.length][1] - coast[i - 1][1]));
  const nearest = ([x, y]) => { let best = 0, bd = Infinity; coast.forEach((c, i) => { const d = Math.hypot(c[0] - x, c[1] - y); if (d < bd) { bd = d; best = i; } }); return best; };
  const nodeIdx = Object.fromEntries(Object.entries(nodes).map(([k, p]) => [k, nearest(p)]));
  const anchors = { MBJ: "MBJ", KIN: "KIN", OCJ: "OCJ", negril: "negril", lucea: "lucea", "hanover-villas": "hopewell", mobay: "montego-bay", "mobay-nonai": "montego-bay", "rose-hall": "rose-hall", falmouth: "falmouth", "runaway-bay": "runaway-bay", "ocho-rios": "ocho-rios", kingston: "kingston", "blue-mountains": "strawberry-hill", "port-antonio": "port-antonio", "treasure-beach": "treasure-beach", "south-coast": "whitehouse" };
  return { W, H: +Hh.toFixed(1), d, zones, hotels, airports, roads: { nodes, edges: EDGES, coast, cum: cum.map((n) => +n.toFixed(1)), idx: nodeIdx, anchors } };
})();

/* the cheapest one-way car price on the page, for the meta description */
const fromPrice = () => { const ps = Object.values(R.rates).concat(Object.values(R.zones || {})).flatMap((a) => Object.values(a)).flatMap((t) => t.in || []).filter((o) => o[0] === "car").map((o) => o[3]); return ps.length ? Math.min(...ps) : null; };
/* Club MoBay and Club Kingston prices from the tours data, so the cards never drift */
const loungePrice = (slug) => { const v = X.venues.find((v) => v.slug === slug); if (!v) return ""; const ps = v.products.filter((p) => p.visitor).map((p) => p.visitor.usd); return ps.length ? `from ${usd(Math.min(...ps))}` : ""; };

/* ---------- chrome (same as the Experiences section) ---------- */
function head({ title, description, pathname, image, jsonld = [], noindex = false, bodyClass = "" }) {
  const url = `${S.origin}${pathname}`;
  const og = `${S.origin}${image ? img(image) : `${IMG}/${H.meta.ogImage}`}`;
  const ld = jsonld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n");
  /* Analytics loads after the page has painted. As a plain async tag it was taking 3.5s of the browser's attention
     while the guest waited on a blank checkout; queueing the events first means nothing is lost by waiting. */
  const ga = S.ga4 ? `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${S.ga4}');
addEventListener('load',function(){setTimeout(function(){var s=document.createElement('script');s.async=1;s.src='https://www.googletagmanager.com/gtag/js?id=${S.ga4}';document.head.appendChild(s);},1200);});</script>` : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<meta name="robots" content="${NOINDEX || noindex ? "noindex,follow" : "index,follow"}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(S.brand)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${og}">
<meta property="og:locale" content="en_JM">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${og}">
<meta name="theme-color" content="#0E0F0E">
<link rel="icon" type="image/x-icon" href="/favicon.ico">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="preload" href="${ASSETS}/fonts/archivo.woff2" as="font" type="font/woff2" crossorigin>
<style>@font-face{font-family:'Archivo';font-style:normal;font-display:swap;font-weight:100 900;font-stretch:62% 125%;src:url(${ASSETS}/fonts/archivo.woff2) format('woff2-variations')}</style>
<link rel="stylesheet" href="/getaways/assets/getaways.css">
<link rel="stylesheet" href="/assets/home.css">
<link rel="stylesheet" href="${ASSETS}/experiences.css?v=${EXP_STAMP}">
<link rel="stylesheet" href="${ASSETS}/transfers.css?v=${STAMP}">
${ld}
${ga}
<script>window.GV_CONFIG=${JSON.stringify({ base: BASE, whatsapp: S.whatsapp, jmdRate: S.jmdRate })};</script>
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ""}>`;
}

function nav() {
  const links = NAV.map(([l, h]) => `<a href="${h}">${esc(l)}</a>`).join("");
  return `<header class="nav wrap" role="banner">
  <div class="nav-l"><a class="wordmark hh" href="/" aria-label="Golden Vacation, home">GOLDEN VACATION</a></div>
  <nav class="nav-links" aria-label="Main">${links}</nav>
  <div class="nav-r">
    ${currency()}
    <a class="icon-btn icon-btn-black mob" href="${waHome}" aria-label="WhatsApp us" data-where="nav">${icon("chat", 20)}</a>
    <button class="icon-btn menu-btn mob" type="button" aria-label="Menu" aria-expanded="false" aria-controls="menu">${icon("menu", 24, 2.4)}</button>
    ${btn("WhatsApp", waHome, "black", "sm", "chat", ' data-where="nav"').replace('class="btn', 'class="desk btn')}
  </div>
</header>
<nav id="menu" class="menu mob" aria-label="Menu">${links}${currency()}</nav>`;
}

function footer() {
  const F = H.footer;
  const comingHref = (key) => wa(H.coming.doors.find((d) => d.key === key).message);
  const col = (t, items) => `<div class="foot-col"><span>${esc(t)}</span>${items.map(([l, h]) => `<a href="${h}">${esc(l)}</a>`).join("")}</div>`;
  const fix = (h) => (h === "whatsapp" ? waHome : h.startsWith("#") ? `/${h}` : h);
  const book = F.book.map(([l, h]) => [l, fix(h)]);
  if (!book.some(([, h]) => h.replace(/\/$/, "") === BASE)) book.splice(1, 0, ["Airport transfers", BASE]);
  const help = F.help.map(([l, h]) => [l, fix(h)]);
  const coming = F.coming.map(([l, k]) => [l, comingHref(k)]);
  return `<footer class="foot" role="contentinfo"><div class="wrap" style="display:flex;flex-direction:column;gap:32px">
  <div class="foot-grid">
    <div class="foot-brand"><a class="wordmark hh" href="/">GOLDEN VACATION</a><p>${esc(S.footerAddress)}<br>WhatsApp ${esc(S.whatsappDisplay)} · Call ${esc(S.phone)}<br>${esc(S.iata)}</p></div>
    ${col("Book", book)}
    ${col("Coming to Jamaica", coming)}
    ${col("Help", help)}
  </div>
  <div class="foot-links mob">${NAV.map(([l, h]) => `<a href="${h}">${esc(l)}</a>`).join("")}<a href="${waHome}">Contact</a></div>
  <div class="foot-bot"><span>© 2026 Golden Vacation &amp; Travel Limited · St Ann, Jamaica · <a href="/terms/">Terms</a> · <a href="/privacy/">Privacy</a></span><span><a href="${S.instagram}" rel="noopener">Instagram</a> · <a href="${S.facebook}" rel="noopener">Facebook</a></span></div>
</div></footer>`;
}

/* Stripe.js is loaded from Stripe's own host, on the checkout page only (the card form is Stripe's iframe; no card detail touches the site) */
const STRIPE_JS = "https://js.stripe.com/dahlia/stripe.js";
/* chrome.js carries the US$/J$ switch, the mobile menu and the WhatsApp tracking: the only parts of getaways.js and
   home.js a transfers page uses. Stripe's script loads on the pay page alone, so the rest of the section never
   pays for 243K it has nothing to do with. */
const scripts = (cfg, withRates, withStripe = false) => `<script>window.GV_TR=${JSON.stringify(cfg)};</script>
<script src="${ASSETS}/chrome.js?v=${CHROME_STAMP}" defer></script>
${withRates ? `<script src="${ASSETS}/transfers-rates.js?v=${RATES_STAMP}" defer></script>\n` : ""}${withStripe ? `<script src="${STRIPE_JS}" defer></script>\n` : ""}<script src="${ASSETS}/transfers.js?v=${STAMP}" defer></script>`;

/* ---------- the page ---------- */
function transfersPage() {
  const P = T.page, SR = P.search, RS = P.results, CK = P.checkout;
  const from = fromPrice();
  const airports = T.airports.map((a) => `<option value="${a.code}">${esc(a.short)}</option>`).join("");
  const trips = T.trips.map((t) => `<option value="${t.key}">${esc(t.label)}</option>`).join("");
  const people = Array.from({ length: T.site.maxGuests }, (_, i) => `<option value="${i + 1}"${i + 1 === 2 ? " selected" : ""}>${i + 1}</option>`).join("") + `<option value="17">More than ${T.site.maxGuests}</option>`;
  const points = P.trust.map((t, i) => `<span class="tr-point">${icon(["tag", "plane", "bolt", "card", "chat"][i] || "check", 18, 2.4)}${esc(t)}</span>`).join("");
  const why = P.why.points.map(([t, p], i) => `<div class="hstep"><span class="n">0${i + 1}</span><div><b>${esc(t)}</b><p>${esc(noDash(p))}</p></div></div>`).join("");
  const faqs = P.questions.items.map(([q, a]) => `<div class="faq-i"><b>${esc(q)}</b><p>${esc(noDash(a))}</p></div>`).join("");
  const also = P.also.items.map((it) => { const price = it.venue ? loungePrice(it.venue) : ""; return `<a class="pair" href="${it.wa ? wa(it.wa) : it.href}">${it.img ? `<span class="pair-img">${pic(it.img, it.alt)}</span>` : ""}<span class="pair-t"><b>${esc(it.title)}</b><small>${esc(noDash(it.sub))}</small></span>${price ? `<span class="pair-p">${esc(price)}</span>` : ""}${icon(it.wa ? "chat" : "arrow", 18, 2.4)}</a>`; }).join("");
  const jsonld = [
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Golden Vacation & Travel", item: S.origin }, { "@type": "ListItem", position: 2, name: "Airport transfers", item: `${S.origin}${BASE}` }] },
    { "@context": "https://schema.org", "@type": "Service", name: "Jamaica airport transfers", serviceType: "Airport transfer", provider: { "@type": "TravelAgency", name: "Golden Vacation & Travel" }, areaServed: "Jamaica", description: P.sub, ...(from != null ? { offers: { "@type": "Offer", price: from, priceCurrency: "USD", description: "Private car, one way, from Montego Bay airport" } } : {}) },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: P.questions.items.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: noDash(a) } })) },
  ];
  const cfg = {
    page: "transfers", whatsapp: S.whatsapp, origin: S.origin, jmdRate: S.jmdRate, today: TODAY, base: BASE, maxGuests: T.site.maxGuests, email: S.email,
    hotels: HOTELS.map((h) => [h.name, h.slug, h.zone, h.rate || "", (T.site.hotelAliases || {})[h.name] || ""]), // [name, slug, zone, rate row, extra search words]
    zones: T.zones.map((z) => ({ key: z.key, name: z.name, airbnb: z.airbnbLabel, aliases: z.aliases || [], hidden: !!z.hidden })),
    airports: T.airports, trips: T.trips, vehicles: T.vehicles, includes: T.includes, drive: T.drive, copy: { results: RS, search: SR },
  };
  const title = `Jamaica airport transfers | Montego Bay, Kingston and Ocho Rios airport to your hotel${from != null ? `, from ${usd(from)}` : ""}`;
  const description = `Private airport transfers in Jamaica: search your hotel, pick the airport and the date, choose the vehicle, pay by card. Resorts across the island, one price per vehicle with taxes included${from != null ? `, from ${usd(from)}` : ""}. Booked by Golden Vacation & Travel, St Ann, Jamaica.`;
  return `${head({ title, description, pathname: BASE, image: P.heroPhoto.file, jsonld, bodyClass: "exp tr tr-page" })}
${nav()}
<main class="tr-main" id="top">
<section class="hub-hero poster tr-hero" aria-label="Airport transfers">
  <div class="wrap tr-hero-in">
    <div class="tr-hero-t">
      ${kicker(P.kicker, true)}
      <h1 class="hh">${esc(P.titleA)} <span class="gold">${esc(P.titleB)}</span></h1>
      <p>${longShort(noDash(P.sub), noDash(P.subMobile))}</p>
    </div>
    <div class="tr-island">
      ${island(P.heroPhoto)}
      <p class="tr-island-cap"><small>${esc(P.heroPhoto.tag)}</small><b class="hh">${esc(P.heroPhoto.title)}</b></p>
    </div>
  </div>
</section>

<section class="tr-searchwrap wrap" aria-label="Search">
  <form class="tr-search" id="search" novalidate>
    <div class="tr-row tr-row-main">
      <div class="tr-f tr-f-hotel hotel-q"><label class="pf-l" for="s-hotel">${esc(SR.hotel)}</label><span class="pf-in">${icon("pin", 18)}<input type="search" id="s-hotel" placeholder="${esc(SR.hotelPlaceholder)}" autocomplete="off" autocapitalize="words" aria-autocomplete="list" aria-controls="s-hotel-list"><button type="button" id="s-hotel-clear" class="clr" aria-label="Clear" hidden>${icon("x", 16, 2.6)}</button></span><ul class="hotel-list" id="s-hotel-list" role="listbox" hidden></ul></div>
      <div class="tr-f tr-f-airport"><label class="pf-l" for="s-airport">${esc(SR.airport)}</label><span class="pf-in">${icon("plane", 18)}<select id="s-airport">${airports}</select></span></div>
      <div class="tr-f tr-f-trip"><label class="pf-l" for="s-trip">${esc(SR.trip)}</label><span class="pf-in">${icon("car", 18)}<select id="s-trip">${trips}</select></span></div>
      <div class="tr-f tr-f-people"><label class="pf-l" for="s-people">${esc(SR.people)}</label><span class="pf-in">${icon("users", 18)}<select id="s-people">${people}</select></span></div>
    </div>
    <div class="tr-row tr-row-name" id="s-name-wrap" hidden><div class="tr-f"><span class="pf-in">${icon("pin", 18)}<input type="text" id="s-name" placeholder="Villa or Airbnb name, for the driver" autocomplete="off"></span></div></div>
    <div class="tr-row tr-row-to" id="s-to-wrap" hidden>
      <div class="tr-f tr-f-hotel hotel-q"><label class="pf-l" for="s-to">${esc(SR.to)}</label><span class="pf-in">${icon("pin", 18)}<input type="search" id="s-to" placeholder="${esc(SR.toPlaceholder)}" autocomplete="off" autocapitalize="words" aria-autocomplete="list" aria-controls="s-to-list"><button type="button" id="s-to-clear" class="clr" aria-label="Clear" hidden>${icon("x", 16, 2.6)}</button></span><ul class="hotel-list" id="s-to-list" role="listbox" hidden></ul></div>
      <div class="tr-f" id="s-to-name-wrap" hidden><span class="pf-l">&nbsp;</span><span class="pf-in">${icon("pin", 18)}<input type="text" id="s-to-name" placeholder="Villa or Airbnb name, for the driver" autocomplete="off"></span></div>
    </div>
    <div class="tr-row tr-row-when" id="s-in-wrap">
      <div class="tr-f"><label class="pf-l" id="s-date-l" for="s-date">${esc(SR.dateIn)}</label><span class="pf-in">${icon("calendar", 18)}<input type="date" id="s-date"></span></div>
      <div class="tr-f" id="s-flight-in-wrap"><label class="pf-l" for="s-flight-in">${esc(SR.flightIn)}</label><span class="pf-in">${icon("plane", 18)}<input type="text" id="s-flight-in" placeholder="e.g. AA1497" autocapitalize="characters" autocomplete="off"></span></div>
      <div class="tr-f" id="s-time-in-wrap"><label class="pf-l" id="s-time-l" for="s-time">${esc(SR.timeIn)}</label><span class="pf-in pf-in-time">${icon("clock", 18)}<input type="time" id="s-time" autocomplete="off"></span></div>
    </div>
    <div class="tr-row tr-row-when" id="s-out-wrap" hidden>
      <div class="tr-f"><label class="pf-l" for="s-date2">${esc(SR.dateOut)}</label><span class="pf-in">${icon("calendar", 18)}<input type="date" id="s-date2"></span></div>
      <div class="tr-f"><label class="pf-l" for="s-flight-out">${esc(SR.flightOut)}</label><span class="pf-in">${icon("plane", 18)}<input type="text" id="s-flight-out" placeholder="e.g. AA1496" autocapitalize="characters" autocomplete="off"></span></div>
      <div class="tr-f"><label class="pf-l" for="s-time2">${esc(SR.timeOut)}</label><span class="pf-in pf-in-time">${icon("clock", 18)}<input type="time" id="s-time2" autocomplete="off"></span></div>
    </div>
    <div class="tr-row tr-row-go">
      <p class="tr-hint" id="s-hint">${esc(SR.hint)}</p>
      <button class="btn btn-gold btn-lg tr-go" type="submit" id="s-go">${icon("search", 18, 2.6)}${esc(SR.go)}</button>
    </div>
  </form>
  <div class="tr-points" aria-label="Why book here">${points}</div>
</section>

<section class="tr-results wrap" id="results" hidden aria-live="polite">
  <div class="sec-head"><div>${kicker(RS.kicker)}<h2 class="hh" id="r-title"></h2><p class="sec-sub" id="r-sub"></p></div></div>
  <div class="rt-block"><div class="rt-block-h"><b>${esc(RS.private)}</b><small id="r-note"></small></div><div class="rt-table" id="r-table"></div></div>
  ${RS.shared ? `<div class="rt-block rt-shared"><div class="rt-block-h"><b>${esc(RS.shared)}</b><span class="tag tag-white">Not ready yet</span></div><p class="rt-shared-p">${esc(RS.sharedNote)} ${btn("Ask on WhatsApp", waHome, "outline", "sm", "chat", ' id="r-shared-wa"')}</p></div>` : ""}
  <p class="pf-hint rt-fine">${esc(RS.fine)} ${esc(T.driveNote)}</p>
</section>

<section class="tr-why wrap" id="why">
  <div class="how-sec"><div class="sec-head why-head"><div>${kicker(P.why.kicker)}<h2 class="hh">${esc(P.why.title)}</h2></div></div><div class="hsteps five">${why}</div></div>
</section>

<section class="faqs tr-faqs" id="questions">
  <div class="wrap faq-grid">
    <div class="faq-side">${kicker(P.questions.kicker)}<h2 class="hh">${esc(P.questions.title)}</h2><p class="sec-sub">${esc(P.questions.sub)}</p>${btn("Ask on WhatsApp", waHome, "black", "", "chat")}</div>
    <div class="faq">${faqs}</div>
  </div>
</section>

<section class="tr-also wrap"><div class="often"><div class="sec-head"><div>${kicker(P.also.kicker)}<b class="hh">${esc(P.also.title)}</b></div></div><div class="pairs">${also}</div></div></section>

<section class="cta-band">
  <div class="wrap cta-in">
    <div>${kicker(P.cta.kicker, true)}<h2 class="hh">${esc(P.cta.title)}</h2><p>${esc(noDash(P.cta.sub))} ${esc(S.hours)}</p></div>
    <div class="cta-btns">${btn("WhatsApp us", waHome, "gold", "lg", "chat")}<a class="cta-call" href="tel:${S.phoneTel}">Or call ${esc(S.phone)}</a></div>
  </div>
</section>
</main>
${footer()}
${scripts(cfg, true)}
</body></html>`;
}

/* ---------- checkout page: the ride, who's travelling, and Stripe's card form on the page ---------- */
const field = (id, label, type, placeholder, autocomplete, extra = "") => `<label class="pf-f" for="${id}"><span class="pf-l">${esc(label)}</span><span class="pf-in"><input type="${type}" id="${id}" placeholder="${esc(placeholder)}" autocomplete="${autocomplete}"${extra}></span></label>`;
/* the sample ride the single-file preview shows when nothing was chosen (the live page reads the ride from the URL) */
function previewBooking() {
  const zone = "negril", offers = (R.zones[zone] && R.zones[zone].MBJ && R.zones[zone].MBJ.both) || [];
  const o = offers.find((x) => x[1] === 5) || offers[0] || ["minivan", 5, 5, 190];
  return { v: 1, ref: "GV-TR-K7Q2", hotel: "royalton-negril", zone, placeKind: "hotel", placeName: "", place: "Royalton Negril", hotel2: "", zone2: "", place2Kind: "", place2Name: "", place2: "", airport: "MBJ", trip: "both", people: 4, vehicle: o[0], seats: o[1], bags: o[2], price: o[3], multi: o[4] ? 1 : 0, date: "2026-12-19", date2: "2026-12-26", flightIn: "AA1497", flightOut: "AA1496", timeIn: "14:35", timeOut: "11:10", time: "", veh: T.vehicles[o[0]].label + (o[4] ? ", two or more" : ""), ride: "Montego Bay airport to Negril, round trip", drive: (T.drive.MBJ || {})[zone] || "", when: "Arrives Sat 19 Dec 2026 on AA1497 at 2:35pm. Departs Sat 26 Dec 2026 on AA1496 at 11:10am", guests: "4 people" };
}
/* the config both checkout pages need: the copy, the map and the words the search already showed the guest */
function ckConfig(page) {
  const CK = T.page.checkout;
  return { page, whatsapp: S.whatsapp, origin: S.origin, jmdRate: S.jmdRate, today: TODAY, base: BASE, maxGuests: T.site.maxGuests, email: S.email, includes: T.includes, copy: { checkout: CK },
    airports: T.airports.map((a) => ({ code: a.code, name: a.name })), zones: Object.fromEntries(T.zones.map((z) => [z.key, z.name])), map: { zones: MAP.zones, hotels: MAP.hotels, airports: MAP.airports, roads: MAP.roads, names: Object.fromEntries(T.zones.map((z) => [z.key, z.mapName || z.name.split(/ and | villa/)[0]])) }, previewBooking: previewBooking() };
}

/* the dark band at the top of both pages: the back link, the title, the route map and the three steps.
   step is which one is current, so page one lights 02 and the pay page lights 03. */
function ckHero(CK, step, titleA, titleB, back, backHref) {
  const steps = CK.steps.map(([t, sub], i) => `<li data-i="${i + 1}"><span class="n">0${i + 1}</span><span class="ck-step-t"><b>${esc(t)}</b><small data-sub="${esc(sub)}">${esc(sub)}</small></span></li>`).join("");
  return `<section class="ck-hero poster" aria-label="Checkout">
  <div class="wrap ck-hero-in">
    <a class="ck-back" id="ck-back" href="${backHref}">${icon("back", 16, 2.4)}${esc(back)}</a>
    <div class="ck-hero-t">
      ${kicker(CK.pageKicker, true)}
      <h1 class="hh">${esc(titleA)} <span class="gold">${esc(titleB)}</span></h1>
    </div>
    <div class="ck-map" id="ck-map" aria-hidden="true">
      <svg class="ck-map-svg" viewBox="-20 -60 ${MAP.W + 40} ${(MAP.H + 150).toFixed(0)}" data-h="${MAP.H}">
        <defs><clipPath id="ck-map-clip"><circle id="ck-map-clipc" r="0"/></clipPath></defs>
        <path class="ck-map-land" d="${MAP.d}"/>
        <path class="ck-map-route" id="ck-map-route" d=""/>
        <g class="ck-map-pin a" id="ck-map-a"><circle r="16"/><circle r="6"/><text id="ck-map-al" y="-30" text-anchor="middle"></text></g>
        <g class="ck-map-pin b" id="ck-map-b"><circle r="16"/><circle r="6"/><text id="ck-map-bl" y="-30" text-anchor="middle"></text></g>
        <!-- short hops (airport and hotel a few minutes apart) get a magnifier: the same coastline zoomed in a circle, the route drawn inside it -->
        <g class="ck-map-zoom" id="ck-map-zoom" hidden>
          <line class="ck-map-tie" id="ck-map-tie"/>
          <circle class="ck-map-spot" id="ck-map-spot" r="10"/>
          <circle class="ck-map-lens-bg" id="ck-map-lens-bg" r="0"/>
          <g clip-path="url(#ck-map-clip)"><g id="ck-map-zoom-in"><path class="ck-map-land zoomed" d="${MAP.d}"/><path class="ck-map-route zoomed" id="ck-map-zroute" d=""/></g></g>
          <circle class="ck-map-lens" id="ck-map-lens" r="0"/>
          <g class="ck-map-pin a" id="ck-map-za"><circle r="16"/><circle r="6"/><text id="ck-map-zal" y="-30" text-anchor="middle"></text></g>
          <g class="ck-map-pin b" id="ck-map-zb"><circle r="16"/><circle r="6"/><text id="ck-map-zbl" y="-30" text-anchor="middle"></text></g>
        </g>
      </svg>
    </div>
    <ol class="ck-steps" id="ck-steps" data-step="${step}" aria-label="Steps">${steps}</ol>
  </div>
</section>`;
}

/* the total, shown on both pages so the number is never off the screen while the guest is deciding */
const ckTotal = (CK) => `<div class="ck-tot"><div class="ck-tot-h"><span class="ck-lbl">${esc(CK.total)}</span><span class="ck-secure">${icon("lock", 14, 2.6)}${esc(CK.secureTag)}</span></div><div class="ck-tot-v"><b><span class="usd-v" id="ck-total"></span><span class="jmd-v" id="ck-total-j"></span></b><span><span class="usd-v" id="ck-jmd"></span><span class="jmd-v" id="ck-usd"></span></span></div><small id="ck-tot-sub"></small></div>`;
const ckEmpty = (CK) => `<div class="ck-empty" id="ck-empty" hidden>${kicker("Airport transfers")}<h2 class="hh">${esc(CK.emptyTitle)}</h2><p>${esc(CK.emptyText)}</p>${btn(CK.emptyCta, `${BASE}/`, "black")}</div>`;

/* ---------- page one: the ride and who's travelling ---------- */
function checkoutPage() {
  const CK = T.page.checkout;
  return `${head({ title: "Book your ride | Airport transfers", description: "Your details for your Jamaica airport transfer with Golden Vacation & Travel.", pathname: `${BASE}/checkout`, noindex: true, bodyClass: "exp tr tr-ck" })}
${nav()}
<main id="ckpage">
${ckHero(CK, 2, CK.pageTitleA, CK.pageTitleB, CK.back, `${BASE}/`)}
<div class="ck-main wrap">
  <div class="ck-grid" id="ck-grid">
    <div class="ck-left">
      <section class="ck-ride" id="ck-ride" aria-label="Your ride">
        <div class="ck-ride-top"><span class="ck-lbl">${esc(CK.yourRide)}</span><a class="ck-act" id="ck-ride-change" href="${BASE}/">${esc(CK.change)}</a></div>
        <b class="hh" id="ck-ride-title"></b>
        <div class="ck-route" id="ck-route">
          <span class="ck-node"><i id="ck-route-ia">${icon("plane", 18, 2.4)}</i><b id="ck-route-a"></b><small id="ck-route-as"></small></span>
          <span class="ck-line"><small id="ck-route-mid"></small></span>
          <span class="ck-node"><i id="ck-route-ib">${icon("pin", 18, 2.4)}</i><b id="ck-route-b"></b><small id="ck-route-bs"></small></span>
        </div>
        <span id="ck-ride-when"></span>
      </section>
      <section class="ck-card ck-guest" id="ck-guest" aria-label="Who's travelling">
        <form id="ck-form" novalidate>
          <div class="ck-card-h">${kicker(CK.kicker)}<h2 class="hh">${esc(CK.title)}</h2></div>
          ${field("ck-name", "Name on the booking", "text", "First and last name", "name")}
          <div class="ck-two">${field("ck-email", "Email for the confirmation", "email", "you@example.com", "email", ' inputmode="email"')}${field("ck-phone", "WhatsApp or phone", "tel", "+1 305 555 0100", "tel", ' inputmode="tel"')}</div>
          ${field("ck-note", "Anything for the driver?", "text", "Child seat, a stop, a lot of bags", "off", ' maxlength="200"')}
          <p class="ck-hint" id="ck-hint"></p>
          <button class="btn btn-gold btn-lg btn-full" type="submit" id="ck-go">${esc(CK.continueCta)}${icon("arrow", 18, 2.4)}</button>
        </form>
      </section>
    </div>
    <aside class="ck-card ck-sum" id="ck-sum" aria-label="Your total">
      ${ckTotal(CK)}
      <div class="ck-inc" id="ck-inc"></div>
      <p class="pf-alt">${esc(CK.alt)} <a href="#" id="ck-wa">${esc(CK.altLink)}</a>.</p>
    </aside>
  </div>
  ${ckEmpty(CK)}
</div>
</main>
${footer()}
${scripts(ckConfig("checkout"), false)}
</body></html>`;
}

/* ---------- page two: the card form. Stripe's script loads only here. ---------- */
function payPage() {
  const CK = T.page.checkout;
  const row = (id, ic, action, actionId, isLink) => `<div class="ck-row" id="${id}"><span class="ck-row-ic">${icon(ic, 20)}</span><div class="ck-row-t"><b id="${id}-t"></b><span id="${id}-d"></span></div>${isLink ? `<a class="ck-act" id="${actionId}" href="${BASE}/">${esc(action)}</a>` : `<a class="ck-act" id="${actionId}" href="${BASE}/checkout">${esc(action)}</a>`}</div>`;
  return `${head({ title: "Pay for your ride | Airport transfers", description: "Payment for your Jamaica airport transfer with Golden Vacation & Travel.", pathname: `${BASE}/pay`, noindex: true, bodyClass: "exp tr tr-ck tr-pay" })}
${nav()}
<main id="ckpage">
${ckHero(CK, 3, CK.payTitleA, CK.payTitleB, CK.payBack, `${BASE}/checkout`)}
<div class="ck-main wrap">
  <!-- three cards, laid out by grid-area: the ride and the guest folded top left, what's included under them,
       the card form down the right. On a phone they stack in the order that matters: ride, card form, included. -->
  <div class="ck-grid pay" id="ck-grid">
    <div class="ck-card ck-rows" id="ck-rows">
      ${row("ck-row-ride", "car", CK.change, "ck-row-ride-change", true)}
      ${row("ck-row-guest", "users", CK.edit, "ck-row-edit", false)}
      <p class="ck-rows-note" id="ck-rows-note"></p>
    </div>
    <aside class="ck-card ck-pay" id="ck-pay" aria-label="Payment">
      <div class="ck-card-h" id="ck-pay-head">${kicker(CK.lastKicker)}<h2 class="hh" id="ck-pay-title" tabindex="-1">${esc(CK.lastTitle)}</h2></div>
      ${ckTotal(CK)}
      <div class="ck-div"></div>
      <div class="ck-stripe" id="ck-stripe"></div>
      <p class="pf-alt">${esc(CK.alt)} <a href="#" id="ck-wa">${esc(CK.altLink)}</a>.</p>
    </aside>
    <div class="ck-card ck-incs"><span class="ck-lbl">${esc(CK.included || "Included")}</span><div class="ck-inc" id="ck-inc"></div></div>
  </div>
  ${ckEmpty(CK)}
</div>
</main>
${footer()}
${scripts(ckConfig("pay"), false, true)}
</body></html>`;
}

/* ---------- booked page ---------- */
function bookedPage(previewState = "") {
  return `${head({ title: "Your ride is booked | Airport transfers", description: "Booking confirmation for your Jamaica airport transfer with Golden Vacation & Travel.", pathname: `${BASE}/booked`, noindex: true, bodyClass: "exp tr exp-booked" })}
${nav()}
<main class="booked wrap" id="booked" data-state="loading">
  <div class="booked-card">
    <div class="state" data-for="loading">${kicker("One moment")}<h1 class="hh">Confirming your ride.</h1><p>Your card has been charged and we're confirming the booking now. This takes a few seconds.</p></div>
    <div class="state" data-for="team" hidden>${kicker("Booked")}<h1 class="hh">Your ride is booked.</h1><p>Your card went through and the transfer is confirmed. One of our travel professionals is sending the driver's details (name, vehicle, where to meet) to <b id="bk-email-t"></b> and your WhatsApp before you fly, during working hours. Nothing more to do.</p><dl class="bk-dl" id="bk-details-t"></dl><p class="bk-order">Booking reference <b id="bk-ref-t"></b></p></div>
    <div class="state" data-for="pending" hidden>${kicker("Paid, being confirmed")}<h1 class="hh">Your card went through. We're confirming the driver by hand.</h1><p>One of our travel professionals is confirming this ride now. You'll have the driver's details by WhatsApp or email within the hour, during working hours. Nothing more to do.</p><dl class="bk-dl" id="bk-details-p"></dl><p class="bk-order">Booking reference <b id="bk-ref-p"></b></p></div>
    <div class="state" data-for="unknown" hidden>${kicker("Hmm")}<h1 class="hh">We can't find that booking.</h1><p>If you've just paid, give it a minute and refresh. If you closed the payment page before paying, nothing was charged and you can start again.</p></div>
    <div class="bk-btns">${btn("Message us on WhatsApp", wa("Hi Golden Vacation! I've just booked an airport transfer on your website and I have a question. Ref "), "outline", "", "chat", ' id="bk-wa"')}${btn("Back to transfers", BASE, "black")}</div>
  </div>
  <form name="tr-bookings" data-netlify="true" netlify-honeypot="bot-field" hidden><input type="text" name="bot-field"><input type="text" name="ref"><input type="text" name="route"><input type="text" name="vehicle"><input type="text" name="when"><input type="text" name="guests"><input type="text" name="place"><input type="text" name="customer"><input type="email" name="email"><input type="text" name="phone"><input type="text" name="total"><input type="text" name="status"><textarea name="note"></textarea></form>
  <form name="tr-enquiries" data-netlify="true" netlify-honeypot="bot-field" hidden><input type="text" name="bot-field"><input type="text" name="ref"><input type="text" name="route"><input type="text" name="vehicle"><input type="text" name="when"><input type="text" name="guests"><input type="text" name="place"><input type="text" name="total"><input type="text" name="page"><textarea name="message"></textarea></form>
  <form name="wa-exits" data-netlify="true" hidden><input type="text" name="visit"><input type="text" name="ref"><input type="text" name="page"><input type="text" name="where"><input type="text" name="total"><textarea name="context"></textarea></form>
</main>
${footer()}
${scripts({ page: "booked", whatsapp: S.whatsapp, base: BASE, ...(previewState ? { previewState } : {}) }, false)}
</body></html>`;
}

/* ---------- write ---------- */
const pages = [
  ["public/transfers/index.html", transfersPage(), "transfers"],
  ["public/transfers/checkout.html", checkoutPage(), "checkout"],
  ["public/transfers/pay.html", payPage(), "pay"],
  ["public/transfers/booked.html", bookedPage(), "booked"],
];
const EXCEPTIONS = (R.exceptions || []).map((x) => ({ airport: x.airport, zone: x.zone, seats: x.seats, hotels: x.hotels.map((n) => { const h = HOTELS.find((h) => h.name.toLowerCase() === n.toLowerCase() || h.slug === slugify(n) || h.slug === slugify("Hotel " + n) || slugify(h.name) === slugify(n.replace(/^Hotel /i, ""))); if (!h) console.warn(`exception hotel not on the list: ${n}`); return h ? h.slug : null; }).filter(Boolean) }));
const ratesPublic = { hotels: Object.fromEntries(Object.entries(R.hotels).map(([k, h]) => [k, { name: h.name, zone: h.zone }])), rates: R.rates, zones: R.zones, links: R.links || {}, exceptions: EXCEPTIONS };
const ratesJs = `/* Generated by scripts/build-transfers.mjs from data/transfer-rates.json. Do not edit by hand. Prices in US$ per vehicle, taxes included. */\nwindow.GV_TR_RATES=${JSON.stringify(ratesPublic)};\n`;

if (!BUNDLE) {
  for (const [rel, html] of pages) {
    const f = path.join(ROOT, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, html);
    console.log("wrote", rel, `${(html.length / 1024).toFixed(0)}K`);
  }
  fs.writeFileSync(path.join(ROOT, "public/assets/transfers-rates.js"), ratesJs);
  console.log("wrote public/assets/transfers-rates.js", `${(ratesJs.length / 1024).toFixed(0)}K`);
  /* The searchable list of Jamaica places, for any page that needs to look one up (the front page search fetches
     it on the first keystroke rather than carrying 120 hotels in its HTML). Names and areas only, never a price. */
  const places = { hotels: HOTELS.map((h) => [h.name, h.slug, h.zone, (T.site.hotelAliases || {})[h.name] || ""]), zones: T.zones.filter((z) => !z.hidden).map((z) => [z.key, z.name, z.airbnbLabel || "", (z.aliases || []).join(" ")]) };
  fs.writeFileSync(path.join(ROOT, "public/assets/jm-places.json"), JSON.stringify(places));
  console.log("wrote public/assets/jm-places.json", `${places.hotels.length} hotels, ${places.zones.length} areas`);
  const dataModule = `/* Generated by scripts/build-transfers.mjs from data/transfers.json and data/transfer-rates.json. Do not edit by hand. Customer prices only. */
export const TR = ${JSON.stringify({ airports: T.airports, trips: T.trips, vehicles: T.vehicles, maxGuests: T.site.maxGuests, zones: T.zones.map((z) => ({ key: z.key, name: z.name })), hotels: ratesPublic.hotels, rates: R.rates, zoneRates: R.zones, links: R.links || {}, exceptions: EXCEPTIONS, hotelKeys: Object.fromEntries(HOTELS.map((h) => [h.slug, { name: h.name, zone: h.zone, rate: h.rate || "" }])) })};
`;
  fs.writeFileSync(path.join(ROOT, "netlify/functions/_tr-data.mjs"), dataModule);
  console.log("wrote netlify/functions/_tr-data.mjs", `${(dataModule.length / 1024).toFixed(0)}K`);
  const smPath = path.join(ROOT, "public/sitemap.xml");
  if (fs.existsSync(smPath)) {
    const entries = `<url>\n  <loc>${S.origin}${BASE}</loc>\n  <lastmod>${TODAY}T00:00:00+00:00</lastmod>\n  <priority>0.8</priority>\n</url>`;
    let sm = fs.readFileSync(smPath, "utf8").replace(/\n*<!-- transfers -->[\s\S]*?<!-- \/transfers -->\n*/, "\n");
    sm = sm.replace(/\s*<\/urlset>\s*$/, `\n\n<!-- transfers -->\n${entries}\n<!-- /transfers -->\n\n</urlset>\n`);
    fs.writeFileSync(smPath, sm);
    console.log("sitemap: transfers url added");
  }
  const missing = [...usedImages].filter((f) => !fs.existsSync(path.join(IMG_DIR, f)));
  if (missing.length) console.warn("MISSING IMAGES:", missing.join(", "));
  console.log(`${HOTELS.length} hotels on the list, ${HOTELS.filter((h) => h.rate).length} priced at their own sheet row, the rest at their zone`);
} else {
  const css = ["public/getaways/assets/getaways.css", "public/assets/home.css", "public/assets/experiences.css", "public/assets/transfers.css"].map((f) => fs.readFileSync(path.join(ROOT, f), "utf8")).join("\n");
  const js = ["public/getaways/assets/getaways.js", "public/assets/home.js"].map((f) => fs.readFileSync(path.join(ROOT, f), "utf8")).join("\n") + "\n" + ratesJs + "\n" + fs.readFileSync(path.join(ROOT, "public/assets/transfers.js"), "utf8");
  const stripHead = (html) => html.replace(/^[\s\S]*?<body[^>]*>/, "").replace(/<\/body><\/html>\s*$/, "");
  const cfgOf = (html) => { const m = html.match(/<script>window\.GV_TR=(\{[\s\S]*?\});<\/script>/); return m ? m[1] : "{}"; };
  const bodyClassOf = (html) => { const m = html.match(/<body class="([^"]*)"/); return m ? m[1] : ""; };
  const all = [...pages, ["", bookedPage("team"), "booked-team"]];
  const sections = all.map(([, html, key]) => {
    const inner = stripHead(html).replace(/<script>window\.GV_TR=[\s\S]*?<\/script>\s*/, "").replace(/<script src="[^"]*" defer><\/script>\s*/g, "");
    return `<section class="pv-page" id="pv-${key}" data-body="${bodyClassOf(html)}" data-cfg='${cfgOf(html).replace(/'/g, "&#39;")}' hidden>${inner}</section>`;
  }).join("\n");
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Golden Transfers preview</title>
<meta name="robots" content="noindex,nofollow">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100,400;100,500;100,600;100,700;110,800;110,900&display=swap">
<style>${css}
.pv-bar{position:sticky;top:0;z-index:50;display:flex;gap:10px;align-items:center;padding:8px 14px;background:#F2B93B;color:#0E0F0E;font:800 13px/1.2 Archivo,system-ui,sans-serif}
.pv-bar select{font:inherit;padding:6px 8px;border-radius:8px;border:2px solid #0E0F0E;background:#fff;max-width:60vw}
.pv-bar span{opacity:.75;font-weight:600}</style>
<script>window.GV_CONFIG=${JSON.stringify({ base: BASE, whatsapp: S.whatsapp, jmdRate: S.jmdRate, preview: true })};</script>
</head>
<body class="exp tr">
<div class="pv-bar"><b>PREVIEW</b><select id="pv-pick" aria-label="Page"><option value="transfers">Airport transfers</option><option value="checkout">Checkout</option><option value="booked-team">After paying</option></select><span>${esc(NOTE || "Nothing here is live. Site links open goldenvacays.com in a new tab.")}</span></div>
<div id="pv-root">${sections}</div>
<script>${js}</script>
<script>
(function(){
  var pages=Array.prototype.slice.call(document.querySelectorAll('.pv-page'));
  var pick=document.getElementById('pv-pick');
  function show(key){
    var el=document.getElementById('pv-'+key)||document.getElementById('pv-transfers'); key=el.id.slice(3);
    pages.forEach(function(p){p.hidden=(p!==el);});
    el.className='pv-page '+(el.getAttribute('data-body')||'exp tr');
    try{window.GV_TR=JSON.parse(el.getAttribute('data-cfg')||'{}');}catch(e){window.GV_TR={};}
    pick.value=key; window.scrollTo(0,0);
    if(window.GV_TR_INIT) window.GV_TR_INIT(el);
  }
  pick.addEventListener('change',function(){location.hash='#'+pick.value;});
  window.GV_TR_PREVIEW_GO=function(key){var c=document.getElementById('pv-'+key);if(c)c.removeAttribute('data-inited');if(location.hash==='#'+key){show(key);}else{location.hash='#'+key;}};
  window.addEventListener('hashchange',function(){show((location.hash||'#transfers').slice(1));});
  document.addEventListener('click',function(e){var a=e.target.closest('a');if(!a)return;var h=a.getAttribute('href')||'';
    if(h.indexOf('#')===0){return;}
    if(h.charAt(0)==='/'){a.setAttribute('target','_blank');a.href='${S.origin}'+h;}
  });
  show((location.hash||'#transfers').slice(1));
})();
</script>
</body></html>`;
  const imgMap = {};
  for (const f of usedImages) {
    const p = path.join(IMG_DIR, f);
    if (!fs.existsSync(p)) continue;
    imgMap[f] = `data:image/jpeg;base64,${fs.readFileSync(p).toString("base64")}`;
    html = html.split(`src="${IMG}/${f}"`).join(`data-gvimg="${f}"`).split(`href="${IMG}/${f}"`).join(`data-gvimg="${f}"`);
  }
  html = html.replace("</body></html>", `<script>(function(){var M=${JSON.stringify(imgMap)};document.querySelectorAll('[data-gvimg]').forEach(function(i){var u=M[i.getAttribute('data-gvimg')]||'';if(i.tagName.toLowerCase()==='image')i.setAttribute('href',u);else i.src=u;i.removeAttribute('loading');});})();</script></body></html>`);
  let out = html;
  if (ARTIFACT) out = html.replace(/^<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n/, "").replace(/<\/head>\n<body class="exp tr">/, '<div class="exp tr">').replace(/<\/body><\/html>$/, "</div>");
  fs.writeFileSync(BUNDLE, out);
  console.log("wrote", BUNDLE, `${(out.length / 1024).toFixed(0)}K`);
}

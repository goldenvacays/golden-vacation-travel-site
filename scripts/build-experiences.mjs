#!/usr/bin/env node
/*
  Golden Experiences: the Jamaica tours, day passes and airport lounges section of goldenvacays.com.
  Reads data/experiences.json and writes:
    public/experiences/index.html                 the hub
    public/experiences/<venue>.html               one page per venue, served at /experiences/<venue> (Netlify serves .html files at the bare path)
    public/experiences/booked.html                the page a guest lands on after paying
    public/experiences/near/<hotel>.html          one page per hotel, served at /experiences/near/<hotel>
  Flat files on purpose: the section goes up through GitHub's web uploader, which commits one directory at a time.
  Bold design: /getaways/assets/getaways.css (tokens) + /assets/experiences.css (this section's components).

  Usage:
    node scripts/build-experiences.mjs                       write the pages
    node scripts/build-experiences.mjs --bundle out.html     single-file preview (all pages, hash router, inline CSS/JS/images)
    node scripts/build-experiences.mjs --bundle out.html --artifact   same, without the html/head/body shell (for the Artifact tool)
*/
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { roundRing, ringPath, jpegSize } from "./lib-island.mjs";
import { nearMap } from "./lib-nearmap.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const X = JSON.parse(fs.readFileSync(path.join(ROOT, "data/experiences.json"), "utf8"));
const JM = JSON.parse(fs.readFileSync(path.join(ROOT, "data/jamaica.json"), "utf8"));
const H = JSON.parse(fs.readFileSync(path.join(ROOT, "data/home.json"), "utf8"));
const G = JSON.parse(fs.readFileSync(path.join(ROOT, "data/getaways.json"), "utf8"));
const S = { ...G.site, ...X.site };
const BASE = "/experiences";
const ASSETS = "/assets";
const IMG = `${ASSETS}/img/exp`;
const IMG_DIR = path.join(ROOT, "public/assets/img/exp");
const args = process.argv.slice(2);
const BUNDLE = args.includes("--bundle") ? args[args.indexOf("--bundle") + 1] : null;
const ARTIFACT = args.includes("--artifact");
const NOINDEX = args.includes("--noindex");
const TODAY = new Date().toISOString().slice(0, 10);
/* a short fingerprint of the section's CSS and JS goes on their URLs, so a browser never keeps an old copy after a deploy */
/* near.css (the near-hotel and area pages, the hub's hotel list, the tour pages' "Staying nearby?") carries its own fingerprint */
const NEAR_STAMP = crypto.createHash("md5").update(fs.readFileSync(path.join(ROOT, "public/assets/near.css"), "utf8")).digest("hex").slice(0, 8);
const STAMP = crypto.createHash("md5").update(["public/assets/experiences.css", "public/assets/experiences.js"].map((f) => fs.readFileSync(path.join(ROOT, f), "utf8")).join("\n")).digest("hex").slice(0, 8);

/* ---------- helpers ---------- */
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const usd = (n) => `US$${fmt(n)}`;
const jmd = (n) => `J$${fmt(n)}`;
const jmdOf = (n) => `≈ J$${fmt(Math.round((n * S.jmdRate) / 100) * 100)}`;
const noDash = (s) => String(s).replace(/—/g, ",").replace(/–/g, "to");
const usedImages = new Set();
const img = (file) => { usedImages.add(file); return `${IMG}/${file}`; };
const small = (file) => file.replace(/\.jpg$/, "-s.jpg");
const pic = (file, alt, extra = "") => `<img src="${img(file)}" alt="${esc(alt)}"${/loading=/.test(extra) ? "" : ' loading="lazy"'} decoding="async"${extra}>`; // a hero image passes loading="eager" itself; the first loading attribute is the one browsers honour
const wa = (text) => `https://wa.me/${S.whatsapp}?text=${encodeURIComponent(text)}`;
const waHome = wa("Hi Golden Vacation! I'm looking at your tours and day passes and I'd like some help choosing. Ref GV-EXP");
const live = (p) => !p.until || p.until >= TODAY;

const ICONS = {
  arrow: '<path d="M5 12h14"></path><path d="M13 6l6 6-6 6"></path>',
  pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle>',
  chat: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>',
  menu: '<path d="M3 12h18M3 6h18M3 18h18"></path>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M16 2v4M8 2v4M3 10h18"></path>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"></path>',
  clock: '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>',
  check: '<path d="M20 6L9 17l-5-5"></path>',
  x: '<path d="M18 6L6 18M6 6l12 12"></path>',
  alert: '<path d="M12 9v4M12 17h.01"></path><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"></path>',
  car: '<path d="M5 17h14M6 17l1.5-5h9L18 17M4 17v2h2v-2M18 17v2h2v-2"></path><path d="M7.5 12L9 8h6l1.5 4"></path>',
  plane: '<path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 11l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 2.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"></path>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2"></rect><path d="M2 10h20"></path>',
  bolt: '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path>',
  ship: '<path d="M2 20c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 6 0"></path><path d="M4 16l-1-5 9-3 9 3-1 5"></path><path d="M12 8V3M9 5h6"></path>',
  id: '<rect x="3" y="5" width="18" height="14" rx="2"></rect><circle cx="9" cy="12" r="2.2"></circle><path d="M14 10h4M14 14h4M6 17c0-1.7 1.3-3 3-3s3 1.3 3 3"></path>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"></path>',
  home: '<path d="M4 11l8-6 8 6"></path><path d="M6 10v9h12v-9"></path>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"></rect><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"></rect><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"></rect><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"></rect>',
  ticket: '<path d="M4 7.5h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z"></path><path d="M14.5 7.5v10"></path>',
  wave: '<path d="M2 15c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 6 0"></path><path d="M2 9.5c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 6 0"></path>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"></path>',
  back: '<path d="M19 12H5"></path><path d="M11 6l-6 6 6 6"></path>',
  chev: '<path d="M6 9l6 6 6-6"></path>',
  photo: '<rect x="3" y="5" width="18" height="14" rx="2"></rect><circle cx="8.5" cy="10" r="1.5"></circle><path d="M21 16l-5-5-8 8"></path>',
};
const icon = (name, size = 20, sw = 2.2) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;display:block">${ICONS[name]}</svg>`;
const tag = (text, tone = "black") => `<span class="tag tag-${tone}">${esc(text)}</span>`;
const kicker = (text, light = false) => `<span class="kicker${light ? " kicker-light" : ""}">${esc(text)}</span>`;
const biglink = (label, href, extra = "") => `<a class="biglink" href="${href}"${extra}>${esc(label)}${icon("arrow", 20, 2.4)}</a>`;
const btn = (label, href, kind = "black", size = "", iconName = "arrow", extra = "") => `<a class="btn btn-${kind}${size ? ` btn-${size}` : ""}" href="${href}"${extra}>${esc(label)}${iconName ? icon(iconName, 18) : ""}</a>`;
const currency = () => `<div class="curr" role="group" aria-label="Currency"><button type="button" data-c="USD" class="on">US$</button><button type="button" data-c="JMD">J$</button></div>`;
const ticker = (items) => { const one = items.map((it) => `<span class="t hh">${esc(it)}</span><span class="dot"></span>`).join(""); return `<div class="ticker" aria-hidden="true"><div class="ticker-in">${one}${one}</div></div>`; };
const longShort = (long, short) => `<span class="long">${esc(long)}</span><span class="short">${esc(short || long)}</span>`;
const dual = (n) => `<span class="usd-v">${usd(n)}</span><span class="jmd-v">${jmdOf(n)}</span>`;

const NAV = [["Getaways", "/getaways/"], ["Staycations", "/#staycations"], ["Jamaica", "/#coming"], ["Experiences", `${BASE}/`], ["Transfers", "/transfers/"], ["Groups", "/groups/"], ["Resort status", "/hotel-status/"]];
const CATS = Object.fromEntries(X.hub.categories);
const AREAS = Object.fromEntries(X.hub.areas);
const venueBySlug = Object.fromEntries(X.venues.map((v) => [v.slug, v]));

/* ---------- hotels (from the resort list the status page uses) and drive times ---------- */
const resortsJs = fs.readFileSync(path.join(ROOT, "public/map/resorts.js"), "utf8");
const RESORTS = JSON.parse(resortsJs.slice(resortsJs.indexOf("["), resortsJs.lastIndexOf("]") + 1));
const slugify = (s) => String(s).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
/* the smaller hotels (boutique, cliff and beach hotels, B&Bs) the site already knows from the transfers list, by area.
   They are not on the resort status list, so each carries the middle of its area instead of its own pin (drive times
   come from the area), and its page points at an airport transfer instead of the status page. */
const T_ZONES = JSON.parse(fs.readFileSync(path.join(ROOT, "data/transfers.json"), "utf8")).zones || [];
const ZONE_REGION = { negril: "negril", mobay: "mobay", "mobay-nonai": "mobay", "rose-hall": "mobay", lucea: "lucea", "hanover-villas": "lucea", falmouth: "falmouth", "runaway-bay": "ocho", "ocho-rios": "ocho", "south-coast": "south", "treasure-beach": "south" };
const ZONE_POINT = { negril: [18.27, -78.34], mobay: [18.49, -77.92], "mobay-nonai": [18.49, -77.9], "rose-hall": [18.51, -77.83], lucea: [18.45, -78.17], "hanover-villas": [18.45, -78.0], falmouth: [18.49, -77.65], "runaway-bay": [18.45, -77.33], "ocho-rios": [18.41, -77.11], "south-coast": [18.07, -77.95], "treasure-beach": [17.88, -77.76] };
const ZONE_AREA = { negril: "Negril", mobay: "Montego Bay", "mobay-nonai": "Montego Bay", "rose-hall": "Rose Hall", lucea: "Hanover", "hanover-villas": "Hanover", falmouth: "Trelawny", "runaway-bay": "Runaway Bay", "ocho-rios": "Ocho Rios", "south-coast": "South Coast", "treasure-beach": "Treasure Beach" };
const sameHotel = (a, b) => { const k = (x) => String(x).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9 ]/g, " ").replace(/\b(the|hotel|resort|resorts|and|spa|villas?|inn|jamaica|negril)\b/g, " ").replace(/\s+/g, " ").trim(); return k(a) === k(b); };
const RESORT_HOTELS = RESORTS.filter((r) => r.status !== "Permanently closed" && r.region && X.regions[r.region] && r.lat && r.lng)
  .map((r) => ({ name: r.name, slug: slugify(r.name), region: r.region, lat: r.lat, lng: r.lng, status: r.status, area: r.area }));
/* transfers-list names that are a resort already on the status list under its newer name */
const SAME_AS_RESORT = new Set(["Braco Village", "Bahia Principe Grand Jamaica", "Jewel Paradise Cove"]);
const SMALL_HOTELS = [];
for (const z of T_ZONES) for (const name of z.places || []) {
  const region = ZONE_REGION[z.key];
  if (!region || !X.regions[region] || !ZONE_POINT[z.key] || SAME_AS_RESORT.has(name)) continue;
  if (RESORTS.some((r) => sameHotel(r.name, name) || (r.formerly && sameHotel(r.formerly, name))) || SMALL_HOTELS.some((h) => sameHotel(h.name, name))) continue;
  SMALL_HOTELS.push({ name, slug: slugify(name), region, lat: ZONE_POINT[z.key][0], lng: ZONE_POINT[z.key][1], status: "Open", area: ZONE_AREA[z.key] || X.regions[region].label, small: true });
}
const HOTELS = RESORT_HOTELS.concat(SMALL_HOTELS)
  .concat((X.ports || []).map((p) => ({ name: p.name, slug: p.slug, region: p.region, lat: p.lat, lng: p.lng, status: "Open", area: "Cruise port", port: true, short: p.short, note: p.note })))
  .sort((a, b) => a.name.localeCompare(b.name));
const km = (a, b) => { const R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLng = (b.lng - a.lng) * Math.PI / 180; const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
function driveMin(hotel, venue) {
  const anchor = venue.drive && venue.drive[hotel.region];
  if (anchor == null) return null;
  const centre = X.regions[hotel.region];
  const nudge = Math.max(-20, Math.min(20, (km(hotel, venue) - km(centre, venue)) * 1.2));
  return Math.max(5, Math.round((anchor + nudge) / 5) * 5);
}
const driveLabel = (m) => m == null ? "" : m < 60 ? `about ${m} min` : `about ${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, "0")}` : ""}`;
/* what the browser needs per tour: where it is, its drive anchors, ship days, and its pickups (key, extra per adult and child,
   the edge and exceptions, resorts only, by request), so a card can say what pickup from the guest's own hotel costs */
const venueDriveData = X.venues.map((v) => ({ slug: v.slug, lat: v.lat, lng: v.lng, drive: v.drive || {}, sd: v.shipDay === false ? 0 : 1,
  pk: (v.pickups || []).filter((p) => p.key !== "own").map((p) => ({ k: p.key, a: p.add || 0, ...(p.addChild != null ? { c: p.addChild } : {}), ...(p.except ? { x: p.except } : {}), ...(p.lngMax != null ? { lx: p.lngMax } : {}), ...(p.lngMin != null ? { ln: p.lngMin } : {}), ...(p.resortsOnly ? { r: 1 } : {}), ...(p.request ? { q: 1 } : {}) })) }));

/* ---------- ship days ----------
   Cruise guests get every tour checked against their port: the drive there and back, and whether a start time
   gets them back to the pier in time. The clock and duration of each option are read from its "times" and "hours"
   text (a product can pin "mins" or "shipDay": false in the data when the text is not enough). */
const SHIP = X.site.shipDay || { arrive: "8:30am", backBy: "3:30pm", okDrive: 100, askDrive: 130 };
let SHIP_CFG = null; // filled once clockMins exists, below
const clockMins = (s) => {
  if (!s) return null;
  const m = String(s).trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|noon|midnight)?$/);
  if (!m) return /^12 noon$/i.test(String(s).trim()) ? 720 : null;
  let h = +m[1], mi = +(m[2] || 0);
  const ap = m[3] || "";
  if (ap === "noon") return 720; if (ap === "midnight") return 0;
  if (ap === "pm" && h < 12) h += 12; if (ap === "am" && h === 12) h = 0;
  return h * 60 + mi;
};
const durationMins = (hours) => {
  const t = String(hours || "").toLowerCase();
  let m = t.match(/(\d+(?:\.\d+)?)\s*(?:to\s*(\d+(?:\.\d+)?)\s*)?hours?/); if (m) return Math.round(+(m[2] || m[1]) * 60);
  m = t.match(/(\d+)\s*(?:to\s*(\d+)\s*)?min/); if (m) return +(m[2] || m[1]);
  if (/half day/.test(t)) return 240; if (/full day|all day/.test(t)) return 480;
  return null;
};
SHIP_CFG = { arrive: clockMins(SHIP.arrive), backBy: clockMins(SHIP.backBy), backByText: SHIP.backBy, okDrive: SHIP.okDrive, askDrive: SHIP.askDrive };
/* per product: starts (minutes since midnight, from "times" or an "h:mm to h:mm" range), mins, and whether it can never fit a ship day */
function shipDayOf(p, v) {
  const range = String(p.hours || "").match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*to\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i);
  const starts = (p.times || []).map(clockMins).filter((n) => n != null);
  let start = starts.length ? null : range ? clockMins(range[1]) : null;
  let end = range ? clockMins(range[2]) : null;
  if (end != null && start != null && end < start) end += 24 * 60;
  const mins = p.mins || (range && start != null && end != null ? end - start : durationMins(p.hours));
  const pass = v.panel === "pass";
  const no = p.shipDay === false || v.shipDay === false || (start != null && start >= 16 * 60) || (starts.length && Math.min(...starts) >= 16 * 60);
  return { starts: starts.length ? starts : (start != null ? [start] : []), mins: mins || (pass ? 120 : 180), flex: pass, no: !!no };
}
/* which tier a tour falls in for a ship day from a port: ok (books on the spot), ask (WhatsApp first), no (not offered) */
const shipTier = (v, minsOneWay) => v.shipDay === false ? "no" : minsOneWay == null ? "ok" : minsOneWay > SHIP.askDrive ? "no" : minsOneWay > SHIP.okDrive ? "ask" : "ok";
/* does an option get the guest back to the pier in time (default all-aboard rule) from a port that is `drive` minutes away? Same arithmetic as the page script and the checkout function */
const productFits = (p, v, drive) => {
  const s = shipDayOf(p, v); if (s.no || v.shipDay === false) return false;
  const stay = s.flex ? Math.min(s.mins, 120) : s.mins, d = drive || 0;
  if (s.starts.length) return s.starts.some((st) => st + stay + d <= SHIP_CFG.backBy);
  return SHIP_CFG.arrive + d + stay + d <= SHIP_CFG.backBy;
};
const venueShipOk = (v, drive) => v.shipDay !== false && v.products.filter(live).some((p) => productFits(p, v, drive));
const portsThatWork = (v) => (X.ports || []).map((pt) => ({ pt, min: driveMin(pt, v) })).filter((r) => r.min != null && shipTier(v, r.min) === "ok" && venueShipOk(v, r.min)).sort((a, b) => a.min - b.min);
if (args.includes("--ship-check")) {
  for (const v of X.venues) for (const p of v.products.filter(live)) { const s = shipDayOf(p, v); console.log(`${v.slug.padEnd(28)} ${p.name.padEnd(32)} starts=${s.starts.map((n) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`).join(",").padEnd(24)} mins=${String(s.mins).padEnd(4)} flex=${s.flex ? 1 : 0} no=${s.no ? 1 : 0}`); }
  process.exit(0);
}

/* hero photo tags: the picture names the tour it shows and its printed price, so the star of the page sells something */
function mosaicTag(slug, productId, label, resident = false) {
  const v = venueBySlug[slug]; if (!v) return label;
  const p = productId ? v.products.find((x) => x.id === productId) : null;
  if (resident) { const r = p && p.resident ? p.resident.jmd : null; return r == null ? label : `${label} · ${jmd(r)}`; } // the locals' ticket prints the resident rate
  const price = p && p.visitor ? p.visitor.usd : (fromPrice(v) && fromPrice(v).usd != null ? fromPrice(v).usd : null);
  return price == null ? label : `${label} · ${p ? "" : "from "}${usd(price)}`;
}
/* lowest visitor price of a venue's live products (adult), for the card */
function fromPrice(v) {
  const ps = v.products.filter(live);
  const usdPrices = ps.filter((p) => p.visitor).map((p) => p.visitor.usd);
  const jmdPrices = ps.filter((p) => !p.visitor && p.resident).map((p) => p.resident.jmd);
  if (usdPrices.length) return { usd: Math.min(...usdPrices), same: new Set(usdPrices).size === 1 };
  if (jmdPrices.length) return { jmd: Math.min(...jmdPrices), same: new Set(jmdPrices).size === 1 };
  return null;
}
const bookingWord = (v) => v.booking === "instant" ? "Book on the spot" : v.booking === "request" ? "We confirm first" : "We reply first";
const bookingTone = (v) => v.booking === "instant" ? "gold" : "white";

/* ---------- chrome ---------- */
function head({ title, description, pathname, image, jsonld = [], noindex = false, bodyClass = "", near = false }) {
  const url = `${S.origin}${pathname}`;
  const og = `${S.origin}${image ? img(image) : `${ASSETS}/img/${H.meta.ogImage}`}`;
  const ld = jsonld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n");
  /* Analytics loads after the page has painted, so it stops competing with the page the visitor is waiting on. */
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
<link rel="preload" href="/assets/fonts/archivo.woff2" as="font" type="font/woff2" crossorigin>
<style>@font-face{font-family:'Archivo';font-style:normal;font-display:swap;font-weight:100 900;font-stretch:62% 125%;src:url(/assets/fonts/archivo.woff2) format('woff2-variations')}</style>
<link rel="stylesheet" href="/getaways/assets/getaways.css">
<link rel="stylesheet" href="/assets/home.css">
<link rel="stylesheet" href="${ASSETS}/experiences.css?v=${STAMP}">${near ? `\n<link rel="stylesheet" href="${ASSETS}/near.css?v=${NEAR_STAMP}">` : ""}
${ld}
${ga}
<script>window.GV_CONFIG=${JSON.stringify({ base: BASE, whatsapp: S.whatsapp, jmdRate: S.jmdRate })};</script>
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ""}>`;
}

function nav() {
  const links = NAV.map(([l, h]) => `<a href="${h}"${h === `${BASE}/` ? ' aria-current="page"' : ""}>${esc(l)}</a>`).join("");
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
  const fix = (h) => (h === "whatsapp" ? waHome : h.startsWith("#") ? `/${h}` : h === "#experiences" ? `${BASE}/` : h);
  const book = F.book.map(([l, h]) => [l, h === "#experiences" ? `${BASE}/` : fix(h)]);
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

const scripts = (cfg) => `<script>window.GV_EXP=${JSON.stringify(cfg)};</script>
<script src="/getaways/assets/getaways.js" defer></script>
<script src="/assets/home.js" defer></script>
<script src="${ASSETS}/experiences.js?v=${STAMP}" defer></script>`;

/* ---------- pieces ---------- */
function priceLine(p) {
  if (p.visitor && p.resident) {
    return `<span class="op-price"><b>${dual(p.visitor.usd)}</b><small>visitor</small></span><span class="op-price res"><b>${jmd(p.resident.jmd)}</b><small>resident</small></span>`;
  }
  if (p.visitor) {
    const pp = p.perParty ? " for two" : "";
    return `<span class="op-price"><b>${dual(p.visitor.usd)}</b><small>${p.usdChild || p.visitor.usdChild ? `adult${pp} · child ${usd(p.visitor.usdChild)}` : `per person${pp}`}</small></span>`;
  }
  if (p.resident) {
    return `<span class="op-price res"><b>${jmd(p.resident.jmd)}</b><small>${p.resident.jmdChild ? `adult · child ${jmd(p.resident.jmdChild)}` : "per person"} · resident</small></span>`;
  }
  return `<span class="op-price"><b>Price on request</b></span>`;
}

const featured = (v) => (X.hub.featured || []).includes(v.slug);
/* The island in the hub band: the coastline from data/jamaica.json, projected the same way the transfers map
   projects it, with a dot where each tour is. It fills the right of the band, which was empty black, and it
   makes the claim the hub is actually making: these are spread across the whole island, not one resort strip. */
const ISLAND = (() => {
  const ring = JM.ring, lons = ring.map((p) => p[0]), lats = ring.map((p) => p[1]);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons), minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const kx = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const W = 1000, scale = W / ((maxLon - minLon) * kx), H = (maxLat - minLat) * scale;
  const proj = (lng, lat) => [+((lng - minLon) * kx * scale).toFixed(1), +((maxLat - lat) * scale).toFixed(1)];
  const d = ringPath(roundRing(ring.map(([lo, la]) => proj(lo, la))));
  /* several tours share a site (the three Rose Hall resorts, the two JamWest parks): one dot per place, sized
     by how many tours sit there, so twelve tours do not draw twelve dots on top of each other */
  const at = new Map();
  for (const v of X.venues) {
    if (v.lat == null || v.lng == null) continue;
    const k = `${v.lat},${v.lng}`;
    const e = at.get(k) || { p: proj(v.lng, v.lat), n: 0, feat: false };
    e.n += 1; e.feat = e.feat || featured(v);
    at.set(k, e);
  }
  return { W, H: +H.toFixed(1), d, dots: [...at.values()] };
})();

const islandSvgHub = () => `<div class="hub-map" aria-hidden="true">
  <svg class="hub-map-svg" viewBox="-14 -34 ${ISLAND.W + 28} ${(ISLAND.H + 68).toFixed(0)}">
    <path class="hub-map-land" d="${ISLAND.d}"/>
    ${ISLAND.dots.map((o) => `<g class="hub-map-dot${o.feat ? " on" : ""}" transform="translate(${o.p[0]} ${o.p[1]})"><circle class="halo" r="${o.n > 1 ? 30 : 22}"/><circle class="pip" r="${o.n > 1 ? 11 : 8}"/></g>`).join("\n    ")}
  </svg>
</div>`;

/* the grid leads with the featured tours (hub.featured, in that order), then the rest in catalogue order */
const gridOrder = () => [...X.venues.filter(featured).sort((a, b) => X.hub.featured.indexOf(a.slug) - X.hub.featured.indexOf(b.slug)), ...X.venues.filter((v) => !featured(v))];
/* A card a guest can compare at a glance: the name, one line of what it is, then a foot carrying the price
   and the single fact that decides it. The region moved into that foot, because "where" is one of the things
   being compared, and the other two facts moved to the tour's own page: five stacked levels of text in a
   200px card read as a spec sheet, and the price disappeared into them. */
function venueCard(v) {
  const fp = fromPrice(v);
  const price = fp ? (fp.usd != null ? `<b>${dual(fp.usd)}</b><small>${fp.same ? "each" : "from"}</small>` : `<b>${jmd(fp.jmd)}</b><small>${fp.same ? "each" : "from"}</small>`) : `<b>Price on request</b>`;
  const n = v.products.filter(live).length;
  const doors = (v.doors || []).join(" ");
  const where = `${esc(AREAS[v.area])}`;
  const fact = v.facts && v.facts.length ? esc(noDash(v.facts[0])) : `${n} ${n === 1 ? "option" : "options"}`;
  return `<a class="vcard${featured(v) ? " feat" : ""}" href="${BASE}/${v.slug}" data-slug="${v.slug}" data-cats="${esc(v.categories.join(" "))}" data-area="${v.area}" data-doors="${esc(doors)}" data-booking="${v.booking}">
    <span class="vcard-photo">${pic(small(v.photos[0].file), v.photos[0].alt)}${featured(v) ? `<span class="tag tag-gold top-tag">Most booked</span>` : ""}<span class="tag tag-white drive-tag" hidden></span></span>
    <span class="vcard-t">
      <span class="h hh">${esc(v.name)}</span>
      <small>${esc(v.card)}</small>
    </span>
    <span class="vcard-foot">
      <span class="vcard-p">${price}</span>
      <span class="vcard-facts"><span class="vf-where">${where}</span><span class="vf-fact">${fact}</span></span>
    </span>
  </a>`;
}

/* ---------- hub ----------
   One question first ("Where are you staying?"), then the days out by area, west to east. Pick a hotel or a cruise
   port and the same cards line up nearest first, each saying whether pickup from that hotel is included. Every card
   says how booking works, and its Tripadvisor rating loads when it scrolls into view (Tripadvisor's terms say the
   numbers are fetched live, never stored). The airport lounges have their own strip; the resort list folds by area. */
const TA_MAP = JSON.parse(fs.readFileSync(path.join(ROOT, "data/tripadvisor-map.json"), "utf8"));
const taKey = (v) => { const t = TA_MAP[v.slug]; return t && !t.skip ? String(t.locationId || v.slug) : ""; };
const HUB_GROUPS = [
  ["negril", "Negril", "JamWest's home park, its water park and the sunset catamaran.", "negril"],
  ["ocho", "Ocho Rios", "Mystic Mountain and Poko Loko, minutes from the cruise pier.", "ocho"],
  ["trelawny", "Falmouth and Trelawny", "The two Ocean resorts and JamWest's park at Braco.", "falmouth"],
  ["mobay", "Montego Bay and Rose Hall", "Day passes at the three Rose Hall resorts, fifteen minutes from Montego Bay.", "mobay"],
];
const HUB_TABS = [["all", "All", "grid"], ["passes", "Day passes", "ticket"], ["tours", "Tours and adventure", "bolt"], ["water", "On the water", "wave"], ["night", "Evenings", "moon"], ["family", "Family days", "users"]];
const BOOK_LINE = { instant: ["bolt", "Book now, confirmed straight away"], request: ["clock", "We confirm the date first"], enquiry: ["chat", "We reply first, then you book"] };
const isDayOut = (v) => v.panel !== "flight";
function pickDefault(v) {
  const pk = (v.pickups || []).filter((p) => p.key !== "own");
  if (!pk.length) return ["no", "No pickup, ask us for a ride"];
  return [pk.some((p) => !p.add && !p.request) ? "yes" : "add", v.pickupShort || "Pickup on request"];
}
function hubCard(v, more = false) {
  const fp = fromPrice(v), href = `${BASE}/${v.slug}`, [bi, bt] = BOOK_LINE[v.booking] || BOOK_LINE.request, [pk, pt] = pickDefault(v), ta = taKey(v);
  const price = fp ? `<span class="ecard-p"><small>${fp.same ? "Per person" : "From"}</small><b>${fp.usd != null ? dual(fp.usd) : jmd(fp.jmd)}</b></span>` : `<span class="ecard-p"><b>On request</b></span>`;
  return `<article class="ecard${more ? " eh-more" : ""}" data-slug="${v.slug}" data-cats="${esc(v.categories.join(" "))}" data-area="${v.area}" data-doors="${esc((v.doors || []).join(" "))}" data-booking="${v.booking}">
      <a class="ecard-ph" href="${href}" tabindex="-1" aria-hidden="true">${pic(small(v.photos[0].file), v.photos[0].alt)}${featured(v) ? `<span class="tag tag-gold ecard-top">Most booked</span>` : ""}<span class="tag drive-tag ecard-drive" hidden></span></a>
      <h3 class="hh"><a href="${href}">${esc(v.name)}</a></h3>
      <p class="ecard-b">${esc(noDash(v.card))}</p>
      <ul class="ecard-sell">
        ${ta ? `<li class="ecard-rate" data-ta="${ta}" hidden>${icon("star", 16, 2.2)}<span>Tripadvisor <b></b> <small></small></span></li>` : ""}
        <li class="ecard-pick ${pk}" data-def="${esc(pt)}" data-def-kind="${pk}"><span class="i-yes">${icon("check", 16, 2.6)}</span><span class="i-car">${icon("car", 16, 2.2)}</span><span class="t">${esc(pt)}</span></li>
        <li class="ecard-book">${icon(bi, 16, 2.2)}<span>${bt}</span></li>
      </ul>
      <div class="ecard-foot">${price}<span class="ecard-f">${v.facts && v.facts.length ? esc(noDash(v.facts[0])) : ""}</span>${btn(v.booking === "instant" ? "Book now" : "See the options", href, "gold", "sm", "arrow")}</div>
    </article>`;
}
function hubPage() {
  const hb = X.hub;
  const heroImg = "jamwest-zipline-rider.jpg";
  const days = gridOrder().filter(isDayOut), lounges = X.venues.filter((v) => !isDayOut(v));
  const vb = (s) => venueBySlug[s];
  const zip = (vb("jamwest") && vb("jamwest").products.find((p) => p.id === "zipline")) || null;
  /* each photo links to its tour; the zipline one opens the JamWest page with the zipline picked (?option=, read by experiences.js) */
  const fig = (file, alt, cap, extra, eager, href, label) => `<figure class="eh-fig${extra}">${pic(file, alt, `${eager ? ' loading="eager"' : ""} srcset="${img(small(file))} 800w, ${img(file)} 1280w" sizes="(min-width: 900px) 26vw, 46vw"`)}<figcaption>${cap}</figcaption>${href ? `<a class="eh-fig-a" href="${esc(href)}" aria-label="${esc(label)}"></a>` : ""}</figure>`;
  const priceOf = (s) => { const f = vb(s) && fromPrice(vb(s)); return f && f.usd != null ? dual(f.usd) : ""; };
  const mosaic = `<div class="eh-mosaic">
      ${fig("jamwest-zipline-rider.jpg", "A rider on the JamWest zipline", `JamWest zipline · from ${zip ? dual(zip.visitor.usd) : priceOf("jamwest")}`, " eh-fig-tall", true, `${BASE}/jamwest${zip ? `?option=${zip.id}` : ""}`, "See the JamWest zipline")}
      ${vb("poko-loko") ? fig(vb("poko-loko").photos[0].file, vb("poko-loko").photos[0].alt, `Poko Loko · ${priceOf("poko-loko")}`, "", false, `${BASE}/poko-loko`, "See Poko Loko") : ""}
      ${vb("jamwest-catamaran") ? fig(vb("jamwest-catamaran").photos[0].file, vb("jamwest-catamaran").photos[0].alt, `Sunset catamaran · ${priceOf("jamwest-catamaran")}`, "", false, `${BASE}/jamwest-catamaran`, "See the sunset catamaran") : ""}
    </div>`;
  const shortcuts = [...HUB_GROUPS.map(([k, name]) => `<button type="button" data-jump="${k}">${icon("pin", 16)}${esc(name === "Falmouth and Trelawny" ? "Falmouth" : name === "Montego Bay and Rose Hall" ? "Montego Bay" : name)}</button>`),
    `<button type="button" data-ports>${icon("ship", 16)}Off a cruise ship</button>`, `<button type="button" data-local aria-pressed="false">${icon("home", 16)}I live in Jamaica</button>`].join("");
  const trust = [["star", "Published prices, in US$ and J$"], ["car", "Pickup shown for your hotel"], ["chat", "Booked by people in Jamaica"], ["check", S.iata && /IATA/.test(S.iata) ? S.iata.replace(/\s*·\s*/, ", ") : "IATA-accredited, 85500310"]].map(([i, t]) => `<li>${icon(i, 18, 2.2)}${esc(t)}</li>`).join("");
  const tabs = HUB_TABS.map(([k, l, i], n) => `<button type="button" data-cat="${k}" aria-pressed="${n === 0}">${icon(i, 24, 2.2)}${esc(l)}</button>`).join("");
  /* the groups: a group gets the port card when it has room for it and a cruise port in its area */
  const groups = HUB_GROUPS.concat(days.filter((v) => !HUB_GROUPS.some(([k]) => k === v.area)).map((v) => [v.area, AREAS[v.area] || v.area, "", v.area]).filter((g, i, a) => a.findIndex((x) => x[0] === g[0]) === i)).map(([k, name, sub, region]) => {
    const vs = days.filter((v) => v.area === k);
    if (!vs.length) return "";
    const area = AREA_BY_REGION[region], port = (X.ports || []).find((p) => p.region === region);
    const portCard = vs.length === 2 && port ? `<a class="eh-port" href="${BASE}/near/${port.slug}"><span class="eh-port-i">${icon("ship", 26)}</span><span class="eh-port-t"><b class="hh">In port at ${esc(port.name.replace(/ cruise port$/, ""))} for the day?</b><span>Both fit a ship day. We plan to have you back at the pier by ${esc(SHIP.backBy)}, or an hour before your all-aboard.</span></span><span class="eh-port-a">Days out from the pier${icon("arrow", 16, 2.4)}</span></a>` : "";
    return `<section class="eh-group" data-group="${k}" aria-labelledby="g-${k}">
    <div class="eh-group-h"><h3 class="hh" id="g-${k}">${esc(name)}</h3>${sub ? `<span class="eh-group-s">${esc(sub)}</span>` : ""}${area ? `<a class="eh-group-a" href="${BASE}/area/${area.slug}">${esc(cap(area.name))}${icon("arrow", 16, 2.4)}</a>` : ""}${vs.length > 2 ? `<button type="button" class="eh-all" aria-expanded="false" data-n="${vs.length}">See all ${vs.length}</button>` : ""}</div>
    <div class="eh-grid">${vs.map((v, i) => hubCard(v, i >= 2)).join("\n")}${portCard}</div>
  </section>`;
  }).join("\n");
  const loungeCards = lounges.map((v) => { const fp = fromPrice(v); return `<a class="eh-lcard" href="${BASE}/${v.slug}">${pic(small(v.photos[0].file), v.photos[0].alt)}<span><b>${esc(v.name)}</b><small>${v.area === "kingston" ? "Kingston airport" : "Montego Bay airport"}${fp && fp.usd != null ? ` · from ${dual(fp.usd)}` : ""}</small></span>${icon("arrow", 18, 2.4)}</a>`; }).join("");
  const why = [["Published prices", "The rate the tour publishes, in US$ or J$, with nothing added at the gate."], ["Pickup you can see", "Every card says whether pickup from your hotel is included, costs extra or isn't offered."], ["People in Jamaica", `Real people on WhatsApp. ${S.hours}`]].map(([t, p]) => `<div class="eh-why-i"><b>${esc(t)}</b><p>${esc(p)}</p></div>`).join("");
  const faqs = hb.questions.map(([q, a]) => `<div class="faq-i"><b>${esc(q)}</b><p>${esc(a)}</p></div>`).join("");
  const jsonld = [
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Golden Vacation & Travel", item: S.origin }, { "@type": "ListItem", position: 2, name: "Golden Experiences", item: `${S.origin}${BASE}/` }] },
    { "@context": "https://schema.org", "@type": "ItemList", name: "Golden Experiences in Jamaica", itemListElement: gridOrder().map((v, i) => ({ "@type": "ListItem", position: i + 1, name: v.name, url: `${S.origin}${BASE}/${v.slug}` })) },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: hb.questions.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
  ];
  return `${head({ title: "Golden Experiences | Jamaica tours, day passes and airport lounges", description: "Day passes at Ocean and the Rose Hall resorts, JamWest and Mystic Mountain tours, the JamWest catamaran, Poko Loko floating bar and Club MoBay and Club Kingston lounges. Published prices in US$ and J$, resident rates where they exist, booked by people in Jamaica.", pathname: `${BASE}/`, image: heroImg, jsonld, bodyClass: "exp exp-hub", near: true })}
${nav()}
<main>
<section class="eh-hero" aria-labelledby="eh-h1">
  <div class="wrap eh-hero-in">
    <div class="eh-hero-t">
      ${kicker("Golden Experiences · Jamaica")}
      <h1 class="hh" id="eh-h1">See the island, not just the resort.</h1>
      <p class="eh-sub"><span class="eh-sub-1">Ziplines, ATV trails, resort day passes and Jamaica's floating bar. </span>Tell us where you're staying and we'll show you what's closest, what it costs and whether pickup is included.</p>
      <div class="eh-q">
        <label class="eh-q-l" for="hotel-in">Where are you staying?</label>
        <div class="eh-q-row">
          <span class="eh-q-in">${icon("pin", 20)}<input type="search" id="hotel-in" placeholder="Type your hotel or cruise port" autocomplete="off" aria-autocomplete="list" aria-controls="hotel-list"><button type="button" id="hotel-clear" class="eh-q-x" aria-label="Clear hotel" hidden>${icon("x", 16, 2.6)}</button><button type="button" class="eh-q-go" data-go aria-label="Show my days out">${icon("arrow", 20, 2.6)}</button></span>
          <button type="button" class="btn btn-gold eh-q-btn" data-go>Show my days out${icon("arrow", 18)}</button>
          <ul class="hotel-list" id="hotel-list" role="listbox" hidden></ul>
        </div>
        <div class="eh-short" role="group" aria-label="Or start with">${shortcuts}</div>
      </div>
    </div>
    ${mosaic}
    <ul class="eh-trust">${trust}</ul>
  </div>
</section>

<section class="eh-cat wrap" id="all" aria-labelledby="eh-cat-h">
  <div class="eh-cat-head">${kicker(`Jamaica · ${days.length} days out`)}<h2 class="hh" id="eh-cat-h">Choose your style.</h2></div>
  <div class="eh-tabs" role="group" aria-label="What kind of day">${tabs}</div>
  <div class="eh-mode" id="hotel-note" hidden><span class="eh-mode-t"></span><button type="button" class="eh-mode-x" id="hotel-change">Change hotel</button></div>
  <div id="eh-groups">
  ${groups}
  </div>
  <div id="eh-near" hidden>
    <section class="eh-band" data-band="30"><div class="eh-group-h"><h3 class="hh">30 min or less</h3><span class="eh-group-s">Easy for a morning or an afternoon.</span></div><div class="eh-grid eh-grid-2"></div></section>
    <section class="eh-band" data-band="60"><div class="eh-group-h"><h3 class="hh">Within the hour</h3><span class="eh-group-s">A short drive, then the whole day or evening there.</span></div><div class="eh-grid"></div></section>
    <section class="eh-band" data-band="far"><details class="eh-far"><summary><span class="eh-far-t"></span><span class="eh-far-s">Show${icon("chev", 18, 2.6)}</span></summary><div class="eh-grid"></div></details></section>
    <a class="eh-near-link" id="eh-near-link" href="${BASE}/"><span class="eh-near-i">${icon("pin", 22)}</span><span class="eh-near-t"><b></b><small>The map, airport pickup prices and the resorts next door</small></span>${icon("arrow", 20, 2.4)}</a>
  </div>
  <div class="empty" id="vempty" hidden>
    <b>Nothing here fits that yet.</b>
    <p>We book more of this island than what's listed. Clear the filters, or tell us what you're after and we'll price it.</p>
    <div class="btns"><button class="btn btn-outline btn-sm" type="button" id="clear-filters">Clear filters</button>${btn("Ask on WhatsApp", waHome, "black", "sm", "chat")}</div>
  </div>
</section>

${loungeCards ? `<section class="eh-lounge" aria-labelledby="eh-lounge-h"><div class="wrap eh-lounge-in"><div class="eh-lounge-t"><h2 class="hh" id="eh-lounge-h">Flying home?</h2><p>Fast track through the airport and a lounge before your flight.</p></div><div class="eh-lounge-c">${loungeCards}</div></div></section>` : ""}

${hubDirectory()}

<section class="eh-why wrap" aria-label="Why book with us">${why}</section>

<section class="faqs wrap" id="questions">
  <div class="faq-grid">
    <div class="faq-side">${kicker("Questions")}<h2 class="hh">Before you book</h2><p class="sec-sub">Straight answers. If yours isn't here, ask on WhatsApp.</p>${btn("Ask on WhatsApp", waHome, "black", "", "chat")}</div>
    <div class="faq">${faqs}</div>
  </div>
</section>

<section class="wrap pt-door" style="display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap;padding-top:4px;padding-bottom:56px">
  <div style="display:flex;flex-direction:column;gap:8px;max-width:620px">${kicker("For tour operators")}<h2 class="hh" style="font-size:clamp(24px,3vw,32px)">Run tours or excursions in Jamaica?</h2><p class="sec-sub">Get them in front of visitors, cruise passengers and locals, sold at your published prices.</p></div>
  ${btn("List your tours", `${BASE}/partners`, "outline", "", "arrow")}
</section>

<section class="eh-cta">
  <div class="wrap eh-cta-in">
    <div>${kicker("Not sure which one")}<h2 class="hh">Tell us the date, the group and the budget.</h2><p>We'll say which one is worth it and which one isn't. ${esc(S.hours)}</p></div>
    <div class="eh-cta-btns">${btn("WhatsApp us", waHome, "white", "lg", "chat")}<a class="cta-call" href="tel:+1${S.phone.replace(/\D/g, "")}">Or call ${esc(S.phone)}</a></div>
  </div>
</section>
</main>
${footer()}
${scripts({ page: "hub", whatsapp: S.whatsapp, hotels: HOTELS.map((h) => [h.name, h.slug, h.region, h.lat, h.lng, h.port ? 1 : 0, h.small ? 0 : 1]), venues: venueDriveData, regions: X.regions, base: BASE, shipDay: SHIP_CFG, areaPages: Object.fromEntries(AREA_PAGES.map((a) => [a.region, a.slug])) })}
</body></html>`;
}

/* ---------- venue page ---------- */
function optionRow(v, p, i, only = false) {
  const attrs = [`data-id="${p.id}"`, p.until ? ` data-until="${p.until}"` : "", p.group ? ` data-group="${p.group}"` : ""].join("");
  /* a badge like "best value" only means something next to another option */
  const badge = p.badge && !only ? `<span class="op-badge">${esc(p.badge)}</span>` : "";
  const notes = (p.notes || []).map((n) => `<li>${esc(noDash(n))}</li>`).join("");
  const choose = p.choose ? `<div class="op-choose" data-pick="${p.choose.pick}">${p.choose.fixed ? `<span class="fixed">${esc(p.choose.fixed)}<small>always in</small></span>` : ""}<span class="op-choose-l">${esc(p.choose.label)}${p.choose.pick > 1 ? ` (${p.choose.pick})` : ""}</span><span class="op-choose-c">${p.choose.from.map((c) => `<button type="button" class="chip" data-choice="${esc(c)}">${esc(c)}</button>`).join("")}</span></div>` : "";
  const times = p.times && p.times.length ? `<span class="op-times">${icon("clock", 14)}${esc(p.times.join(" · "))}</span>` : "";
  return `<label class="op${only ? " op-only" : ""}"${attrs}>
    <input type="radio" name="product" value="${p.id}"${i === 0 ? " checked" : ""}${only ? ' tabindex="-1"' : ""}>
    <span class="op-body">
      <span class="op-head"><span class="op-name">${esc(p.name)}</span>${badge}</span>
      <span class="op-hours">${esc(noDash(p.hours))}</span>
      <span class="op-desc">${esc(noDash(p.desc))}</span>
      ${times}
      <span class="op-prices">${priceLine(p)}</span>
      <span class="op-more">${choose}${notes ? `<ul class="op-notes">${notes}</ul>` : ""}</span>
    </span>
  </label>`;
}

function listBlock(title, items, iconName, cls) {
  if (!items || !items.length) return "";
  return `<div class="ib ${cls}"><b>${esc(title)}</b><ul>${items.map((t) => `<li>${icon(iconName, 16, 2.6)}<span>${esc(noDash(t))}</span></li>`).join("")}</ul></div>`;
}

function panel(v) {
  const isFlight = v.panel === "flight";
  const isTour = v.panel === "tour";
  const instant = v.booking === "instant", live = v.calendar === "rezdy";
  const cta = instant ? "Book and pay" : v.booking === "request" ? "Request this date" : "Send enquiry";
  const ctaSub = instant ? (live ? "Confirmed straight away, paid by card on a secure page. You'll get the confirmation by email." : "Paid by card on a secure page and confirmed straight away. We send your booking details shortly.") : v.booking === "request" ? "We confirm availability first. Nothing is charged now." : "We reply within working hours. Nothing is charged now.";
  const rate = v.rates ? `<div class="pf pf-rate" id="pf-rate"><span class="pf-l">Your rate</span><div class="rate-opts">
      <label class="rate-opt"><input type="radio" name="rate" value="visitor" checked><span><b>${esc(v.rates.visitor.label)}</b><small>${esc(v.rates.visitor.who)}</small></span></label>
      <label class="rate-opt"><input type="radio" name="rate" value="resident"><span><b>${esc(v.rates.resident.label)}</b><small>${esc(v.rates.resident.who)}</small></span></label>
    </div><p class="rate-note" id="rate-note">${esc(noDash(v.rates.visitor.note))}</p></div>` : "";
  /* cruise guests: the question only opens when the guest asks for it (or the site already knows their port); residents never see it */
  /* a tour that picks up from the cruise ports takes the port in its pickup box; any other tour keeps the cruise question */
  const portPickups = (v.pickups || []).some((p) => (X.ports || []).some((pt) => pt.slug === p.key));
  const cruiseLink = isFlight || portPickups || v.shipDay === false ? "" : `<button type="button" class="link-btn" id="cruise-link" hidden>Off a cruise ship?</button>`;
  const date = isFlight
    ? `<div class="pf two"><label class="pf-f"><span class="pf-l" id="pf-date-l">Arrival date</span><span class="pf-in">${icon("calendar", 18)}<input type="date" id="pf-date" required></span></label><label class="pf-f" id="pf-date2-wrap"><span class="pf-l" id="pf-date2-l">Departure date</span><span class="pf-in">${icon("calendar", 18)}<input type="date" id="pf-date2"></span></label></div>
       <div class="pf two"><label class="pf-f" id="pf-flight-in-wrap"><span class="pf-l">Flight in</span><span class="pf-in">${icon("plane", 18)}<input type="text" id="pf-flight-in" placeholder="e.g. BA2263" autocapitalize="characters"></span></label><label class="pf-f" id="pf-flight-out-wrap"><span class="pf-l">Flight out</span><span class="pf-in">${icon("plane", 18)}<input type="text" id="pf-flight-out" placeholder="e.g. BA2262" autocapitalize="characters"></span></label></div>
       <p class="pf-hint" id="date-note" hidden></p>
       <p class="pf-hint">We check your flight and send the lounge details to your email and WhatsApp.</p>`
    : `<div class="pf"><label class="pf-f"><span class="pf-l">Date</span><span class="pf-in">${icon("calendar", 18)}<input type="date" id="pf-date" required></span></label><p class="pf-hint" id="date-note" hidden></p>${cruiseLink}</div>`;
  const anyTimes = v.products.some((p) => p.times && p.times.length);
  const times = isTour || anyTimes ? `<div class="pf" id="pf-times-wrap"><span class="pf-l">${v.panel === "pass" ? "Entry time" : "Start time"}</span><div class="chip-row" id="pf-times"></div><p class="pf-hint" id="times-note" hidden></p></div>` : "";
  const guests = `<div class="pf pf-guests"><span class="pf-l">Guests</span>
      <div class="stepper"><span><b>Adults</b><small id="adult-unit"></small></span><span class="step-c"><button type="button" data-step="adults" data-d="-1" aria-label="Fewer adults">−</button><output id="adults">2</output><button type="button" data-step="adults" data-d="1" aria-label="More adults">+</button></span></div>
      <div class="stepper" id="child-step"><span><b>Children</b><small id="child-unit"></small></span><span class="step-c"><button type="button" data-step="children" data-d="-1" aria-label="Fewer children">−</button><output id="children">0</output><button type="button" data-step="children" data-d="1" aria-label="More children">+</button></span></div>
      <p class="pf-hint" id="child-note" hidden></p>
      <p class="pf-hint" id="guests-note" hidden>Up to 16 guests here. More than 16? <a href="mailto:${esc(S.email)}?subject=${encodeURIComponent(`Group booking: ${v.name}`)}">Email us</a> and we'll price it.</p>
    </div>`;
  /* tours without a bookable pickup say so where the pickup picker would sit, so nobody goes looking for it */
  const noPickup = isTour && !v.pickups ? `<p class="pf-hint" id="no-pickup-note">${v.pickupPriced ? `Hotel pickup from ${esc(v.pickupPriced.where)} is priced by hotel. Ask us on WhatsApp and we add it to your booking.` : "No hotel pickup on this one. Ask us on WhatsApp if you need a ride."}</p>` : "";
  /* pickup: the guest picks their hotel from the resort list (the area, and any transfer charge, follow from it);
     "somewhere else" opens a free-text line plus the area list; "my own way" skips pickup */
  const pickup = v.pickups ? `<div class="pf" id="pf-pickup-wrap">
      <div class="hotel-q pf-f"><span class="pf-l">Pickup from</span>
        <label class="pf-f hotel-f"><span class="pf-in">${icon("pin", 18)}<input type="search" id="pf-hotel-in" placeholder="Type your hotel, area or cruise port" autocomplete="off" autocapitalize="words" aria-label="Pickup hotel, area or cruise port"></span></label><ul class="hotel-list" id="pf-hotel-list" role="listbox" hidden></ul></div>
      <label class="pf-f" id="pf-pickup-other-wrap" hidden><span class="pf-in">${icon("pin", 18)}<input type="text" id="pf-pickup-hotel" placeholder="Villa or hotel name, for the driver" autocomplete="off"></span></label>
      <div class="chip-row pickup-alts"><button type="button" class="chip chip-sm" data-pick="own" aria-pressed="false">I'll make my own way</button></div>
      <p class="pf-hint" id="pickup-note">${v.pickupNote ? esc(v.pickupNote) : v.pickups.some((p) => p.add) ? "Pickup from Negril hotels is included. Lucea and Montego Bay pickups are priced per person." : "Hotel pickup from Negril and Montego Bay is included."}</p>
    </div>` : "";
  /* ship day: the port chips open from the "Off a cruise ship?" link under the date, or on their own when the site already knows the port
     (picked on the hub, or arrived from a port page). Tours with a pickup picker take the port through that picker instead. */
  const cruisePick = isFlight || portPickups ? "" : `<div class="pf" id="pf-cruise-wrap" hidden><span class="pf-l">Off a cruise ship?</span><div class="chip-row port-chips" id="pf-ports">${(X.ports || []).map((pt) => `<button type="button" class="chip chip-sm" data-port="${pt.slug}" aria-pressed="false">${esc(pt.name.replace(" cruise port", " port"))}</button>`).join("")}</div><p class="pf-hint">Tell us your port and we only show what gets you back to the pier in time.</p></div>`;
  const aboard = v.panel === "flight" ? "" : `${cruisePick}<div class="pf" id="pf-aboard-wrap" hidden><span class="pf-l">All-aboard time</span><div class="chip-row aboard-chips" id="pf-aboard">${[["", "Not sure"], ["960", "4:00pm"], ["1020", "5:00pm"], ["1080", "6:00pm"], ["1140", "7:00pm or later"]].map(([m, l]) => `<button type="button" class="chip chip-sm" data-aboard="${m}" aria-pressed="${m === "" ? "true" : "false"}">${l}</button>`).join("")}</div><p class="pf-hint" id="ship-note"></p><button type="button" class="link-btn" id="ship-clear">Not off a ship today? Clear this</button></div>`;
  const contact = `<div class="pf pf-contact" id="pf-contact"${instant ? "" : " hidden"}><span class="pf-l">Who's booking</span>
      <div class="pf two"><label class="pf-f"><span class="pf-in"><input type="text" id="pf-first" placeholder="First name" autocomplete="given-name"></span></label><label class="pf-f"><span class="pf-in"><input type="text" id="pf-last" placeholder="Last name" autocomplete="family-name"></span></label></div>
      <label class="pf-f"><span class="pf-in"><input type="email" id="pf-email" placeholder="Email for the confirmation" autocomplete="email"></span></label>
      <label class="pf-f"><span class="pf-in"><input type="tel" id="pf-phone" placeholder="WhatsApp or phone" autocomplete="tel"></span></label>
      <label class="pf-f" id="pf-ship-wrap"><span class="pf-in">${icon("ship", 18)}<input type="text" id="pf-ship" placeholder="On a cruise? Ship name"></span></label>
    </div>`;
  /* two steps: first the booking itself with its total (the guest settles on that), then their details and the payment */
  return `<aside class="panel" id="panel" data-panel="${v.panel}" data-booking="${v.booking}">
    <div class="panel-head">${kicker(instant ? "Book on the spot" : v.booking === "request" ? "Request a date" : "Send an enquiry")}<div class="panel-total"><b id="total-lead">${usd(0)}</b><small id="total-sub"></small></div><p class="panel-caption" id="total-caption"></p></div>
    <form id="book" novalidate>
      <div class="bstep" id="step-1">
      ${rate}
      ${date}
      ${times}
      ${guests}
      ${noPickup}
      ${pickup}
      ${aboard}
      <button class="btn btn-black btn-lg btn-full" type="button" id="next"><span id="next-label">Continue</span>${icon("arrow", 18)}</button>
      <p class="pf-sub" id="next-sub"></p>
      </div>
      <div class="bstep" id="step-2" hidden>
      <button type="button" class="link-btn step-back" id="step-back">${icon("arrow", 14, 2.6)}Change the booking</button>
      <div class="sum" id="sum"></div>
      ${contact}
      ${/^jamwest/.test(v.slug) ? `<div class="pf pay-when" id="pay-when" hidden><span class="pf-l">How you'd like to pay</span><div class="pw-opts" role="radiogroup" aria-label="How you'd like to pay"><label class="pw"><input type="radio" name="paywhen" value="card" checked><span><b>Card now</b><small>On the secure card page</small></span></label><label class="pw"><input type="radio" name="paywhen" value="arrival"><span><b>Pay on arrival</b><small>Nothing charged now</small></span></label></div></div>` : ""}
      <div class="pf pf-preview" id="pf-preview"${instant ? " hidden" : ""}><span class="pf-l">This is what we'll get</span><pre id="msg-preview"></pre></div>
      <button class="btn btn-black btn-lg btn-full" type="submit" id="cta">${instant ? icon("card", 18) : icon("chat", 18)}<span id="cta-label">${cta}</span></button>
      <p class="pf-sub" id="cta-sub">${ctaSub}</p>
      <p class="pf-alt" id="cta-alt"${instant ? "" : " hidden"}>Rather talk to a person first? <a href="#" id="cta-wa">Send this as a WhatsApp request instead</a>.</p>
      <p class="pf-fine">Nothing is charged until you see the total. Tax and service included. A person reads every request.</p>
      </div>
    </form>
  </aside>`;
}

function venuePage(v) {
  const hero = v.photos[0];
  const gallery = v.photos.slice(1, 5).map((p, i) => `<button type="button" class="gph lb-open" data-i="${i + 1}" aria-label="Open photo ${i + 2} of ${v.photos.length}">${pic(small(p.file), p.alt)}</button>`).join(""); // every photo opens the viewer at its own place; the hero is photo 1
  /* no count: "2 photos" tells a guest how few there are, which is worse than saying nothing */
  const photosBtn = v.photos.length > 1 ? `<button type="button" class="tag tag-white photos-btn lb-open" data-i="0">${icon("photo", 14, 2.2)}See photos</button>` : "";
  // the hero is a strip of every photo: a swipe on a phone, arrows on a laptop, dots for where you are; the first one loads first, the rest lazily
  const slides = v.photos.map((p, i) => `<div class="hero-slide">${pic(p.file, p.alt, i === 0 ? ' loading="eager" fetchpriority="high" class="lb-open" data-i="0"' : ` class="lb-open" data-i="${i}"`)}</div>`).join("");
  const dots = v.photos.length > 1 ? `<div class="hero-dots" role="tablist" aria-label="Which photo">${v.photos.map((p, i) => `<button type="button" role="tab" aria-selected="${i === 0 ? "true" : "false"}" aria-label="Photo ${i + 1} of ${v.photos.length}" data-i="${i}"></button>`).join("")}</div>` : "";
  const arrows = v.photos.length > 1 ? `<button type="button" class="hero-arrow hero-prev" aria-label="Previous photo">${icon("arrow", 18, 2.4)}</button><button type="button" class="hero-arrow hero-next" aria-label="Next photo">${icon("arrow", 18, 2.4)}</button>` : "";
  const groups = v.groups ? v.groups : [{ key: "all", label: "", sub: "" }];
  const onlyOne = v.products.filter(live).length === 1;
  const options = groups.map((g) => {
    const ps = v.products.filter((p) => (g.key === "all" || p.group === g.key));
    const rows = ps.map((p, i) => optionRow(v, p, i === 0 && g === groups[0], onlyOne)).join("\n");
    return `${g.label ? `<div class="op-group"><b>${esc(g.label)}</b><small>${esc(noDash(g.sub))}</small></div>` : ""}${rows}`;
  }).join("\n");
  const enquiries = v.enquiries ? `<div class="enq"><div class="enq-t">${kicker("Price on request")}<b class="hh">${esc(v.enquiries.title)}</b><p>${esc(v.enquiries.sub)}</p></div><ul class="enq-list">${v.enquiries.items.map(([t, d]) => `<li><b>${esc(t)}</b><span>${esc(noDash(d))}</span></li>`).join("")}</ul>${btn(v.enquiries.cta, wa(`Hi Golden Vacation! I'm interested in ${v.enquiries.title.toLowerCase()} at ${v.name}. Ref GV-EXP-ENQ`), "outline", "", "chat")}</div>` : "";
  const often = (v.often || []).map((o) => { const t = venueBySlug[o.slug]; const fp = fromPrice(t); return `<a class="pair" href="${BASE}/${t.slug}"><span class="pair-img">${pic(small(t.photos[0].file), t.photos[0].alt)}</span><span class="pair-t"><b>${esc(t.name)}</b><small>${esc(o.why)}</small></span><span class="pair-p">${fp && fp.usd != null ? dual(fp.usd) : fp && fp.jmd ? jmd(fp.jmd) : ""}</span>${icon("arrow", 18, 2.4)}</a>`; }).join("");
  const facts = [
    [ICONS.pin ? "pin" : "pin", `${AREAS[v.area]} · ${v.parish}`],
    ["bolt", v.booking === "instant" ? (v.rates ? "Visitor rate: booked and paid on the spot" : "Booked and paid on the spot") : v.booking === "request" ? "We confirm availability, then you pay" : "We reply, confirm, then send a card link"],
    v.adultsOnly ? ["id", "Adults only, 18+"] : null,
  ].filter(Boolean).map(([ic, t]) => `<span class="fact">${icon(ic, 16)}${esc(t)}</span>`).join("") + `<span class="fact fact-hotel" id="fact-hotel" hidden>${icon("car", 16)}<span id="fact-hotel-t"></span></span>`;
  const jsonld = [
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Golden Vacation & Travel", item: S.origin }, { "@type": "ListItem", position: 2, name: "Golden Experiences", item: `${S.origin}${BASE}/` }, { "@type": "ListItem", position: 3, name: v.name, item: `${S.origin}${BASE}/${v.slug}` }] },
    { "@context": "https://schema.org", "@type": "TouristAttraction", name: v.name, description: v.blurb, url: `${S.origin}${BASE}/${v.slug}`, image: `${S.origin}${img(hero.file)}`, address: { "@type": "PostalAddress", addressRegion: v.parish, addressCountry: "JM" } },
    ...v.products.filter(live).filter((p) => p.visitor).map((p) => ({ "@context": "https://schema.org", "@type": "Product", name: `${v.name}: ${p.name}`, description: p.desc, offers: { "@type": "Offer", price: p.visitor.usd, priceCurrency: "USD", availability: "https://schema.org/InStock", url: `${S.origin}${BASE}/${v.slug}`, seller: { "@type": "TravelAgency", name: "Golden Vacation & Travel" } } })),
  ];
  const cfg = {
    page: "venue", whatsapp: S.whatsapp, origin: S.origin, jmdRate: S.jmdRate, today: TODAY,
    hotels: HOTELS.map((h) => [h.name, h.slug, h.region, h.lat, h.lng, h.port ? 1 : 0, h.small ? 0 : 1]), regions: X.regions, shipDay: SHIP_CFG,
    venue: { slug: v.slug, name: v.name, panel: v.panel, booking: v.booking, calendar: v.calendar || null, area: AREAS[v.area], adultsOnly: !!v.adultsOnly, blackout: v.blackout || [], closedWeekdays: v.closedWeekdays || [], ...(v.childDays ? { childDays: v.childDays, childDaysText: v.childDaysText || "" } : {}), rates: v.rates || null, pickups: v.pickups || null, pickupNote: v.pickupNote || "", pickupAreas: v.pickupAreas || "", pickupNotListed: v.pickupNotListed || "", lat: v.lat, lng: v.lng, drive: v.drive || {}, sd: v.shipDay === false ? 0 : 1,
      photos: v.photos.map((p) => [img(p.file), p.alt]), // the photo viewer: full-size file and caption, hero first
      products: v.products.filter(live).map((p) => ({ id: p.id, name: p.name, hours: p.hours, times: p.times || [], audience: p.audience, visitor: p.visitor || null, resident: p.resident || null, perParty: p.perParty || 0, choose: p.choose || null, legs: p.legs || null, request: !!p.request, until: p.until || null, sd: shipDayOf(p, v) })) },
  };
  const title = `${v.name} | ${v.categories.map((c) => CATS[c]).join(", ")} in ${AREAS[v.area]}, Jamaica`;
  return `${head({ title, description: `${v.blurb} ${fromPrice(v) && fromPrice(v).usd != null ? `From ${usd(fromPrice(v).usd)} per person.` : ""} Published prices in US$ and J$, booked by Golden Vacation & Travel, St Ann, Jamaica.`, pathname: `${BASE}/${v.slug}`, image: hero.file, jsonld, bodyClass: "exp exp-venue", near: true })}
${nav()}
<main class="venue" data-venue="${v.slug}">
<nav class="crumbs wrap" aria-label="Breadcrumb"><a href="${BASE}/">Golden Experiences</a><span>/</span><span>${esc(v.short)}</span></nav>
<section class="vhero wrap">
  <div class="vhero-photo${v.photos.length > 1 ? " has-slides" : ""}"><div class="hero-track" id="hero-track">${slides}</div><div class="hero-tags">${v.tags.slice(0, 1).map((t) => tag(t, "white")).join("")}</div>${photosBtn}${dots}${arrows}</div>
  <div class="vhero-t">
    ${kicker(`${AREAS[v.area]} · ${v.parish}`)}
    <h1 class="hh">${esc(v.name)}</h1>
    <p class="lead">${esc(noDash(v.blurb))}</p>
    <div class="facts">${facts}</div>
    ${gallery ? `<div class="gallery">${gallery}</div>` : ""}
  </div>
</section>

<section class="vbody wrap">
  <div class="vmain">
    <div class="opts-sec" id="options">
      <div class="sec-head"><div><h2 class="hh">${onlyOne ? `What you get` : `Choose your ${esc(v.optionNoun)}`}</h2>${v.rates ? `<p class="sec-sub">Two rates, both printed. Visitor rate: ${esc(noDash(v.rates.visitor.note))} Resident rate: ${esc(noDash(v.rates.resident.note))}</p>` : ""}</div></div>
      <div class="ops" id="ops">
${options}
      </div>
    </div>
    ${enquiries}
    <div class="info-grid">
      ${listBlock("What's included", v.included, "check", "inc")}
      ${listBlock("Not included", v.notIncluded, "x", "exc")}
      ${listBlock("Getting there", v.gettingThere, "pin", "go")}
      ${listBlock("Before you book", v.before, "alert", "warn")}
    </div>
    ${often ? `<div class="often"><div class="sec-head"><b class="hh">Often booked with this</b><small>Only if it helps</small></div><div class="pairs">${often}</div></div>` : ""}
    ${stayingNearby(v)}
  </div>
  ${panel(v)}
</section>
<div id="ta-sentinel" class="ta-sentinel" aria-hidden="true"></div>
<section class="ta-sec" id="ta-sec" hidden aria-label="Reviews on Tripadvisor">
  <div class="wrap ta-in">
    <div class="ta-head"><div>${kicker("Traveller reviews")}<h2 class="hh">What people say about <a id="ta-name" href="#" target="_blank" rel="noopener nofollow">${esc(v.name)}</a></h2></div><a class="ta-brand" id="ta-link" href="#" target="_blank" rel="noopener nofollow" aria-label="Tripadvisor"><img id="ta-logo" src="https://static.tacdn.com/img2/brand_refresh/Tripadvisor_lockup_horizontal_secondary_registered.svg" alt="Tripadvisor" width="160" height="32" onerror="this.style.display='none';this.nextElementSibling.style.display='inline'"><span class="ta-brand-txt">Tripadvisor</span></a></div>
    <div class="ta-grid">
      <div class="ta-score">
        <span class="lbl">Tripadvisor rating</span>
        <b id="ta-rating"></b>
        <img id="ta-bubbles" src="" alt="" width="120" height="22">
        <a id="ta-count" href="#" target="_blank" rel="noopener nofollow"></a>
        <span id="ta-ranking"></span>
        <span class="ta-award" id="ta-award" hidden></span>
      </div>
      <div class="ta-reviews" id="ta-reviews"></div>
    </div>
    <div class="ta-foot"><div class="ta-btns"><a class="btn btn-black btn-sm" id="ta-more" href="#" target="_blank" rel="noopener nofollow">More on Tripadvisor${icon("arrow", 16)}</a><a class="btn btn-outline btn-sm" id="ta-write" href="#" target="_blank" rel="noopener nofollow" hidden>Write a review</a></div><p>Reviews are written by Tripadvisor travellers about the tour, not about us. <span id="ta-sample" hidden>Sample data shown until the Tripadvisor key is in.</span></p></div>
  </div>
</section>
<div class="sticky-bar" id="sticky-bar"><div><b id="sticky-total">${usd(0)}</b><small id="sticky-sub">per person</small></div><button type="button" class="btn btn-black btn-sm" id="sticky-cta">${v.booking === "instant" ? "Book" : "Request"}${icon("arrow", 16)}</button></div>
</main>
${footer()}
${scripts(cfg)}
</body></html>`;
}

/* ---------- near-hotel, port and area pages ----------
   One page per resort on the status list and per cruise port. It leads with what only that place has: the map around
   it, the days out grouped by how far they are, pickup from that hotel or not, the airport rides to it, the resorts
   next to it and questions about it. The smaller hotels, villas and guesthouses on the transfers list carry their
   area's middle point instead of their own pin, so their pages were the same page under different names: they fold
   into six area pages (301s in public/_redirects, written below). */
const T = JSON.parse(fs.readFileSync(path.join(ROOT, "data/transfers.json"), "utf8"));
const TR = JSON.parse(fs.readFileSync(path.join(ROOT, "data/transfer-rates.json"), "utf8"));
const RES_BY_NAME = Object.fromEntries(RESORTS.map((r) => [r.name, r]));
const NEAR_HOTELS = HOTELS.filter((h) => !h.small);
const AREA_PAGES = [
  { region: "ocho", slug: "ocho-rios", name: "Ocho Rios and Runaway Bay", prep: "in" },
  { region: "mobay", slug: "montego-bay", name: "Montego Bay and Rose Hall", prep: "in" },
  { region: "negril", slug: "negril", name: "Negril", prep: "in" },
  { region: "falmouth", slug: "falmouth", name: "Falmouth and Trelawny", prep: "in" },
  { region: "lucea", slug: "lucea", name: "Lucea and Green Island", prep: "in" },
  { region: "south", slug: "south-coast", name: "the South Coast", prep: "on" },
];
const AREA_BY_REGION = Object.fromEntries(AREA_PAGES.map((a) => [a.region, a]));
const cap = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);
const shortTime = (m) => driveLabel(m).replace(/^about /, "");
const placeOf = (v) => (/Rose Hall/.test(v.name) ? "Rose Hall" : String(AREAS[v.area] || "").replace(/\s*\(.*\)$/, ""));
/* sites several tours share: map = the pin's label (a newline breaks it over two lines), full = in a sentence, desc = in the meta description */
const GROUP_NAMES = {
  "iberostar-selection-rose-hall iberostar-waves-rose-hall joia-rose-hall": { map: "Iberostar and JOIA\nRose Hall", full: "Day passes at Iberostar and JOIA Rose Hall", desc: "Iberostar and JOIA Rose Hall day passes" },
  "ocean-coral-spring ocean-eden-bay": { map: "Ocean Eden Bay and\nOcean Coral Spring", full: "Day passes at Ocean Eden Bay and Ocean Coral Spring", desc: "Ocean Eden Bay and Ocean Coral Spring day passes" },
  "jamwest jamwest-water-park": { map: "JamWest and the Water Park", full: "JamWest and the Water Park", desc: "JamWest and the Water Park" },
};
const andList = (a) => (a.length <= 1 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`);
const normName = (s) => String(s).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
/* a day pass at the resort the guest is already staying at is not a day out */
const samePlace = (h, v) => { const a = normName(h.name), b = normName(v.name); return a.startsWith(b) || b.startsWith(a); };
const isLounge = (v) => v.panel === "flight";
const disp = (n) => String(n).replace(/\s*—\s*/g, ", ");
const cleanNote = (n) => noDash(String(n || "").split(" · ")[0]).replace(/\s*,\s*/g, ", ").trim();
function statusLine(r) {
  const s = (r && r.status) || "Open", w = String((r && r.when) || "").trim(), cat = String((r && r.category) || "All-inclusive").toLowerCase();
  if (s === "Open") return ["o", `Open now, ${cat}`];
  if (s === "New") return ["o", /\d/.test(w) ? `New, opening ${w}` : "New and open"];
  if (s === "Reopening") return ["s", /\d/.test(w) ? `Reopening ${w}` : "Reopening, date to be confirmed"];
  if (s === "Closing soon") return ["s", /\d/.test(w) ? `Open now, closing ${w}` : "Open now, closing soon"];
  if (s === "Coming soon") return ["s", /\d/.test(w) ? `Opening ${w}` : "Coming soon"];
  return ["c", "Closed for now"];
}
function pill(r) {
  const s = (r && r.status) || "Open", w = String((r && r.when) || "").trim();
  const cls = s === "Open" || s === "New" ? "" : /^(Reopening|Closing soon|Coming soon)$/.test(s) ? " s" : " c";
  return `<span class="nr-pill${cls}">${esc(s === "Reopening" && /\d/.test(w) ? `Reopens ${w}` : s)}</span>`;
}
const thumbOf = (h) => { const f = `near/${h.slug}.jpg`; return fs.existsSync(path.join(IMG_DIR, f)) ? f : null; };
function photoTag(ph, sizes, extra = "") {
  const f = ph.file, sf = small(f), hasS = fs.existsSync(path.join(IMG_DIR, sf));
  if (!hasS) return pic(f, ph.alt, extra);
  const [w] = jpegSize(path.join(IMG_DIR, f)), [ws] = jpegSize(path.join(IMG_DIR, sf));
  return pic(sf, ph.alt, `${extra} srcset="${img(sf)} ${ws}w, ${img(f)} ${w}w" sizes="${sizes}"`);
}
function priceBlock(v) {
  const fp = fromPrice(v);
  if (!fp) return `<span class="nr-price"><small>Price</small><b>On request</b></span>`;
  return `<span class="nr-price"><small>${fp.same ? "Per person" : "From"}</small><b>${fp.usd != null ? dual(fp.usd) : jmd(fp.jmd)}</b></span>`;
}
const ctaOf = (v) => (v.panel === "tour" ? "See times and book" : v.panel === "pass" ? "See the passes" : "See the options");
const cardFacts = (v, n) => (v.facts || []).filter((f) => !/pickup|\bmin from\b/i.test(f)).slice(0, n);
const factsHtml = (list) => (list.length ? `<div class="nr-facts">${list.map((f) => `<span>${esc(noDash(f))}</span>`).join("")}</div>` : "");
/* pickup from this hotel: a tour's pickups are keyed by the region they run from */
function pickupOf(v, h) {
  const p = (v.pickups || []).find((x) => x.key === (h.port ? h.slug : h.region));
  if (!p || p.key === "own" || p.request) return null;
  if ((p.except || []).includes(h.slug) || (p.resortsOnly && h.small)) return null;
  if ((p.lngMax != null && h.lng > p.lngMax) || (p.lngMin != null && h.lng < p.lngMin)) return null;
  return p;
}
const pricedPickup = (v, h) => !h.port && !!v.pickupPriced && v.pickupPriced.regions.includes(h.region);
const perWho = (v, p) => (v.adultsOnly || p.addChild == null ? "per person" : "per adult");
function pickupText(v, h, who) {
  const p = pickupOf(v, h), from = h.port ? "the pier" : p && p.resortsOnly && h.isArea ? who.replace(/ hotels$/, " resorts") : who;
  if (p) return [true, p.add ? `Pickup from ${from}, ${usd(p.add)} more ${perWho(v, p)}.` : `Pickup from ${from} included.`];
  if (pricedPickup(v, h)) return [false, `Pickup from ${who} available, priced by hotel.`, "priced"];
  return [false, h.port ? "No pickup from the pier." : h.isArea ? `No hotel pickup in ${h.areaName}.` : `No hotel pickup from ${who}.`];
}

/* the transfer zone a hotel prices in, the same way the transfers page decides it */
function zoneFor(h) {
  const ovr = (T.site.hotelZones || {})[h.name];
  if (ovr) return ovr;
  for (const z of T.zones) {
    const rule = z.rule;
    if (!rule || rule.region !== h.region) continue;
    if (rule.lngMax != null && !(h.lng < rule.lngMax)) continue;
    if (rule.lngMin != null && !(h.lng >= rule.lngMin)) continue;
    return z.key;
  }
  for (const z of T.zones) if (z.regions && z.regions.includes(h.region)) return z.key;
  return null;
}
const AIRPORT_NAMES = { MBJ: "Montego Bay", OCJ: "Ian Fleming, Ocho Rios", KIN: "Kingston" };
const minsOf = (s) => { const m = String(s).match(/(\d+)\s*h(?:\s*(\d+))?/); if (m) return +m[1] * 60 + (+m[2] || 0); const n = String(s).match(/(\d+)\s*min/); return n ? +n[1] : 999; };
function airportRows(h) {
  const z = zoneFor(h), rates = z && TR.zones && TR.zones[z];
  if (!rates) return [];
  const rows = ["MBJ", "OCJ", "KIN"].map((ap) => {
    const car = rates[ap] && rates[ap].in && rates[ap].in[0], drive = ((T.drive || {})[ap] || {})[z];
    return car && drive ? { ap, name: AIRPORT_NAMES[ap], seats: car[2], price: car[3], drive, mins: minsOf(drive) } : null;
  }).filter(Boolean).sort((a, b) => a.mins - b.mins);
  return rows.filter((r, i) => i === 0 || r.mins <= 150);
}
const onTransfers = (h) => !!zoneFor(h) && !(T.site.hide || []).includes(h.name);

/* the days out from a place, nearest first, lounges and the place itself left out */
const daysOut = (h) => X.venues.filter((v) => !isLounge(v) && !samePlace(h, v)).map((v) => ({ v, min: driveMin(h, v) })).filter((r) => r.min != null).sort((a, b) => a.min - b.min || a.v.name.localeCompare(b.v.name));
/* one pin per site: the three Rose Hall resorts, the two Ocean resorts and the two JamWest parks share one each */
function mapGroups(rows) {
  const at = new Map();
  for (const r of rows) { const k = `${r.v.lat},${r.v.lng}`; if (!at.has(k)) at.set(k, []); at.get(k).push(r); }
  return [...at.values()].map((rs) => {
    const key = rs.map((r) => r.v.slug).sort().join(" "), min = Math.min(...rs.map((r) => r.min));
    return { lat: rs[0].v.lat, lng: rs[0].v.lng, label: GROUP_NAMES[key] ? GROUP_NAMES[key].map : andList(rs.map((r) => r.v.short)), full: GROUP_NAMES[key] ? GROUP_NAMES[key].full : andList(rs.map((r) => r.v.name)), desc: GROUP_NAMES[key] ? GROUP_NAMES[key].desc : andList(rs.map((r) => r.v.name)), time: driveLabel(min), timeShort: shortTime(min), min, place: placeOf(rs[0].v) };
  }).sort((a, b) => a.min - b.min);
}
const groupIsMany = (g) => /^Day passes | and /.test(g.full);
const lowerThe = (s) => s.replace(/^(The|Day) /, (m, w) => `${w.toLowerCase()} `);
/* the lead's first sentence, from the map's sites: "Mystic Mountain is about 15 min away and Poko Loko about 25 min." */
function leadFrom(groups, fromText) {
  const [g1, g2] = groups;
  if (!g1) return "";
  if (g1.min > 60) return `The closest day out is ${lowerThe(g1.full)}, ${g1.time} ${fromText}.`;
  return `${g1.full} ${groupIsMany(g1) ? "are" : "is"} ${g1.time} ${fromText}${g2 && g2.min <= 90 ? `, and ${lowerThe(g2.full)} ${g2.time}` : ""}.`;
}
const descFrom = (groups, n = 3) => groups.slice(0, n).map((g) => `${g.desc} ${g.time}`);
const arrowIcon = (dir) => icon(dir === "l" ? "back" : "arrow", 15, 2.6);

/* the sections: under half an hour, within the hour, then one per place further out (a day trip under 2 hours, a long
   day from 2 hours). A cruise port groups by what fits a ship day instead. */
function bandsFor(h, rows, fromWhat) {
  if (h.port) {
    const tierOf = (v, min) => (shipTier(v, min) === "no" ? "no" : !venueShipOk(v, min) ? "no" : shipTier(v, min));
    const fits = rows.filter((r) => tierOf(r.v, r.min) === "ok"), longDay = rows.filter((r) => tierOf(r.v, r.min) === "ask"), no = rows.filter((r) => tierOf(r.v, r.min) === "no");
    const out = [];
    const f1 = fits.filter((r) => r.min <= 30), f2 = fits.filter((r) => r.min > 30 && r.min <= 60), f3 = fits.filter((r) => r.min > 60);
    if (f1.length) out.push({ id: "near-30", chip: "30 min or less", big: "30 min", sub: `or less from the pier. Plenty of time before all-aboard.`, kind: "big", rows: f1 });
    if (f2.length) out.push({ id: "near-60", chip: "Within the hour", big: "1 hour", sub: `or less from the pier. Still an easy ship day.`, kind: "mid", rows: f2 });
    if (f3.length) out.push({ id: "near-ship", chip: `Up to ${shortTime(Math.max(...f3.map((r) => r.min)))}`, big: shortTime(Math.max(...f3.map((r) => r.min))), sub: `or less each way. It fits, with less time there.`, kind: "small", rows: f3 });
    if (longDay.length) out.push({ id: "long-day", chip: "A long day", big: "Long day", sub: `${cap(driveLabel(SHIP.okDrive))} to ${shortTime(SHIP.askDrive)} each way. Send the request and we check it against your all-aboard time before anything is charged.`, kind: "rows", rows: longDay });
    if (no.length) out.push({
      id: "not-today", chip: "Not on a ship day", big: "Not today", sub: "Too far for the hours in port, or an evening thing. Each one says which port it works from.", kind: "rows", off: true, rows: no.map((r) => {
        const works = portsThatWork(r.v)[0];
        return { ...r, note: shipTier(r.v, r.min) !== "no" ? cap(noDash(r.v.shipDayNote || "runs in the evening")) : `${cap(driveLabel(r.min))} each way${works ? `, works from ${works.pt.name}` : ""}` };
      }),
    });
    return out;
  }
  const out = [], b1 = rows.filter((r) => r.min <= 30), b2 = rows.filter((r) => r.min > 30 && r.min <= 60), rest = rows.filter((r) => r.min > 60);
  if (b1.length) out.push({ id: "near-30", chip: "30 min or less", big: "30 min", sub: `or less from ${fromWhat}. Easy for a morning or an afternoon.`, kind: "big", rows: b1 });
  if (b2.length) out.push({ id: "near-60", chip: "Within the hour", big: "1 hour", sub: `or less from ${fromWhat}. A short drive, then the whole day or evening there.`, kind: "mid", rows: b2 });
  const byPlace = new Map();
  for (const r of rest) { const p = placeOf(r.v); if (!byPlace.has(p)) byPlace.set(p, []); byPlace.get(p).push(r); }
  for (const [place, rs] of byPlace) {
    const m = Math.min(...rs.map((r) => r.min)), far = m >= 120;
    out.push({ id: `near-${slugify(place)}`, chip: place, big: shortTime(m), sub: far ? `${place}, a long day each way from here. Easier with a night or two in ${place}.` : `${place}, a full day out from here.`, kind: far ? "rows" : "small", rows: rs, place });
  }
  return out;
}

function bandHtml(b, h, who, ask) {
  const href = (v) => `${BASE}/${v.slug}${h.port ? `?hotel=${h.slug}` : ""}`;
  const timeTag = (r) => `<span class="nr-time">${icon("clock", 15, 2.6)}${esc(cap(driveLabel(r.min)))}</span>`;
  const pick = (v, links) => {
    const [yes, text, priced] = pickupText(v, h, who);
    return `<p class="nr-pick${yes ? " yes" : ""}">${icon(yes ? "check" : "car", 18, yes ? 2.6 : 2.2)}<span>${esc(text)}</span>${!yes && links ? `<a href="${ask}">${priced ? "Ask for the price" : "Ask us for a ride"}</a>` : ""}</p>`;
  };
  let body = "";
  if (b.kind === "big" || b.kind === "mid") {
    body = `<div class="nr-cards${b.kind === "mid" ? " mid" : ""}">${b.rows.map((r) => { const v = r.v; return `<article class="nr-card">
      <a class="nr-ph" href="${href(v)}" tabindex="-1" aria-hidden="true">${photoTag(v.photos[0], "(min-width: 900px) 36vw, 92vw")}${timeTag(r)}</a>
      <h3 class="hh"><a href="${href(v)}">${esc(v.name)}</a></h3>
      <p class="nr-blurb">${esc(noDash(v.card))}</p>
      ${factsHtml(cardFacts(v, 2))}
      ${pick(v, true)}
      <div class="nr-foot">${priceBlock(v)}${btn(ctaOf(v), href(v), "black", "sm", "arrow")}</div>
    </article>`; }).join("\n")}</div>`;
  } else if (b.kind === "small") {
    body = `<div class="nr-smalls">${b.rows.map((r) => { const v = r.v; return `<a class="nr-small" href="${href(v)}">
      <span class="nr-ph">${photoTag(v.photos[0], "(min-width: 900px) 24vw, 92vw")}${timeTag(r)}</span>
      <b class="hh">${esc(v.name)}</b>
      <span class="nr-blurb">${esc(noDash(v.card))}</span>
      ${pick(v, false).replace(/^<p/, "<span").replace(/<\/p>$/, "</span>")}
      <span class="nr-small-f">${priceBlock(v)}<span class="nr-go">${esc(v.panel === "tour" ? "See times" : "See the passes")}${icon("arrow", 16, 2.4)}</span></span>
    </a>`; }).join("\n")}</div>`;
  } else {
    const pickNote = !h.port && b.rows.some((r) => (r.v.pickups || []).some((p) => X.regions[p.key])) && !b.rows.some((r) => pickupOf(r.v, h))
      ? `Pickup runs from ${andList([...new Set(b.rows.flatMap((r) => (r.v.pickups || []).filter((p) => X.regions[p.key]).map((p) => X.regions[p.key].label.replace(/\s*\(.*\)$/, ""))))])} hotels, not from ${esc(who)}.` : "";
    body = `<div class="nr-panel">${b.place || pickNote ? `<div class="nr-panel-h">${b.place ? `<h3>${esc(b.place)}</h3>` : ""}${pickNote ? `<p>${pickNote}</p>` : ""}</div>` : ""}${b.rows.map((r) => { const v = r.v, fp = fromPrice(v); return `<a class="nr-row${b.off ? " off" : ""}" href="${href(v)}">
      <span class="nr-row-t"><b>${esc(v.name)}</b><small>${esc(noDash(v.card))}</small></span>
      <span class="nr-row-d">${icon("clock", 15)}${esc(r.note || cap(driveLabel(r.min)))}</span>
      <span class="nr-row-p"><span><small>${fp && !fp.same ? "From" : "Per person"}</small><b>${fp ? (fp.usd != null ? dual(fp.usd) : jmd(fp.jmd)) : "On request"}</b></span>${icon("arrow", 18, 2.4)}</span>
    </a>`; }).join("\n")}</div>`;
  }
  return `<section class="nr-band" id="${b.id}" aria-labelledby="${b.id}-h">
  <div class="nr-rail"><span class="hh" aria-hidden="true">${esc(b.big)}</span><p>${esc(b.sub)}</p></div>
  <div class="nr-body"><h2 class="sr" id="${b.id}-h">${esc(b.chip)}</h2>${body}</div>
</section>`;
}

function jumpBar(bands, extra, change) {
  return `<div class="nr-jump"><div class="wrap nr-jump-in" role="navigation" aria-label="On this page"><span class="nr-jump-l">By drive time</span>${bands.map((b) => `<a class="nr-chip" href="#${b.id}">${esc(b.chip)}<small>${b.rows.length}</small></a>`).join("")}${extra}${change}</div></div>`;
}

function airportHtml(h, who, rows, transfersHref) {
  if (!rows.length) return "";
  const tr = rows.map((r) => `<tr><th scope="row"><span class="ap">${icon("plane", 18, 2)}${esc(r.name)}<span class="code">${r.ap}</span></span></th><td>${esc(r.drive)}</td><td class="p"><b>${dual(r.price)}</b></td></tr>`).join("");
  const nearestAp = rows[0].ap, lounge = nearestAp === "KIN" ? venueBySlug["club-kingston"] : rows.some((r) => r.ap === "MBJ") ? venueBySlug["club-mobay"] : null;
  const lfp = lounge ? fromPrice(lounge) : null;
  return `<section class="nr-air" id="getting-here" aria-labelledby="getting-here-h">
  <div class="wrap nr-air-in">
    <div class="nr-air-t">
      <h2 class="hh" id="getting-here-h">Getting to ${esc(who)}.</h2>
      <p>A private ride from the airport, one price per vehicle with taxes included. Your driver waits at arrivals with your name on a board.</p>
      ${btn("Price my ride", transfersHref, "black", "", "arrow")}
    </div>
    <div class="nr-air-r">
      <div class="nr-tab"><table>
        <caption>One way, private car for up to ${rows[0].seats} people. Minivans and return trips are priced on the transfers page.</caption>
        <thead><tr><th scope="col">Airport</th><th scope="col">Drive</th><th scope="col" class="p">Car, from</th></tr></thead>
        <tbody>${tr}</tbody>
      </table></div>
      ${lounge ? `<a class="nr-lounge" href="${BASE}/${lounge.slug}">${pic(small(lounge.photos[0].file), lounge.photos[0].alt)}<span><b>Flying home from ${lounge.slug === "club-kingston" ? "Kingston" : "Montego Bay"}?</b><small>${esc(lounge.name)}: ${esc(noDash(lounge.card))}${lfp && lfp.usd != null ? ` From ${usd(lfp.usd)}.` : ""}</small></span>${icon("arrow", 20, 2.4)}</a>` : ""}
    </div>
  </div>
</section>`;
}

function questionsHtml(title, qs) {
  return `<section class="nr-qs" aria-labelledby="nr-qs-h"><div class="wrap nr-qs-in">
  <h2 class="hh" id="nr-qs-h">${esc(title)}</h2>
  <div class="nr-q">${qs.map(([q, a], i) => `<details${i === 0 ? " open" : ""}><summary>${esc(q)}${icon("chev", 20, 2.6)}</summary><p>${esc(a)}</p></details>`).join("\n")}</div>
</div></section>`;
}
const faqLd = (qs) => ({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: qs.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) });
/* "JamWest Adventure Park includes pickup from Royalton Negril. JamWest Catamaran picks up for US$30 more per adult." */
function pickupSentence(withPick, h) {
  const incl = withPick.filter((x) => !pickupOf(x.v, h).add), extra = withPick.filter((x) => pickupOf(x.v, h).add);
  const where = h.isArea ? `${h.areaName} hotels` : h.name;
  return [incl.length ? `${andList(incl.map((x) => x.v.name))} ${incl.length === 1 ? "includes" : "include"} pickup from ${where}.` : "", ...extra.map((x) => `${x.v.name} picks up for ${usd(pickupOf(x.v, h).add)} more ${perWho(x.v, pickupOf(x.v, h))}.`)].filter(Boolean).join(" ");
}
/* "Mystic Mountain picks up from RIU Ocho Rios too, at a price that depends on the hotel, so ask us on WhatsApp for it." */
const pricedSentence = (rows, where) => (rows.length ? `${andList(rows.map((x) => x.v.name))} ${rows.length === 1 ? "picks" : "pick"} up from ${where} too, at a price that depends on the hotel, so ask us on WhatsApp for it.` : "");
function closestAnswer(A, fromText) {
  if (!A) return "";
  const fp = fromPrice(A.v), closed = (A.v.facts || []).map((f) => f.match(/^Closed (\w+)$/)).filter(Boolean)[0];
  const price = fp && fp.usd != null ? (fp.same ? ` It's ${usd(fp.usd)} per person.` : ` Prices start at ${usd(fp.usd)}.`) : "";
  return `${A.v.name}, ${driveLabel(A.min)} ${fromText}. ${noDash(A.v.card)}${price}${closed ? ` It's closed on ${closed[1]}.` : ""}`;
}
function airportAnswer(rows) {
  if (!rows.length) return "";
  const dist = rows.map((r) => `${r.drive} from ${r.name} (${r.ap})`);
  const cheap = rows.slice(0, 2).map((r) => `${usd(r.price)} one way from ${r.name.split(",")[0]}`);
  return `${cap(andList(dist))}. A private car for up to ${rows[0].seats} starts at ${andList(cheap)}.`;
}
const clip = (parts, tail, max = 155) => { const p = [...parts]; let s = `${p.join(", ")}. ${tail}`; while (s.length > max && p.length > 1) { p.pop(); s = `${p.join(", ")}. ${tail}`; } return s.length > max ? s.slice(0, max - 1).replace(/\s+\S*$/, "") + "." : s; };

function nearPage(h0) {
  const r = RES_BY_NAME[h0.name], h = { ...h0, name: disp(h0.name) };
  const rows = daysOut(h);
  const area = AREA_BY_REGION[h.region];
  const who = h.name;
  const ask = wa(h.port ? `Hi Golden Vacation! We're in port at ${h.name} for the day and we need a ride. Ref GV-EXP-PORT` : `Hi Golden Vacation! We're staying at ${h.name} and we need a ride to a day out. Ref GV-EXP-NEAR`);
  const waPlan = wa(h.port ? `Hi Golden Vacation! We're in port at ${h.name} for the day and we'd like a day out. Ref GV-EXP-PORT` : `Hi Golden Vacation! We're staying at ${h.name} and we'd like to add a day out. Ref GV-EXP-NEAR`);
  const bands = bandsFor(h, rows, h.name);
  const air = h.port ? [] : airportRows(h);
  const transfersHref = onTransfers(h) ? `/transfers/?hotel=${h.slug}` : "/transfers/";
  const hasPick = rows.some((x) => pickupOf(x.v, h));
  const [A, B] = rows;
  const fits = h.port ? (bands.filter((b) => !["long-day", "not-today"].includes(b.id)).flatMap((b) => b.rows)) : rows;
  const lead = h.port
    ? `${fits.length} ${fits.length === 1 ? "fits" : "fit"} a ship day. ${noDash(h.note || "")} We plan to have you back at the pier by ${SHIP.backBy}, or an hour before the all-aboard time you give us.`.replace(/\s+/g, " ")
    : `${leadFrom(mapGroups(rows), "away")} Every price here is the published rate, in US$ and J$, ${hasPick ? "and each one says whether pickup from the hotel is included." : "and we say straight when there's no pickup from the hotel."}`.trim();
  const groups = mapGroups(rows);
  const [stCls, stText] = h.port ? ["o", "Cruise port, ship days"] : statusLine(r);
  const thumb = h.port ? null : thumbOf(h);
  const chip = `${thumb ? pic(thumb, `${h.name}`, ' loading="eager" width="46" height="46"') : `<span class="nr-noimg">${icon(h.port ? "ship" : "pin", 20)}</span>`}<span><b>${esc(h.name)}</b><span class="nr-st ${stCls}"><i></i>${esc(stText)}</span></span>`;
  const map = nearMap({ ring: JM.ring, anchor: { lat: h.lat, lng: h.lng, name: h.name, sub: h.port ? "Your ship" : "You're here" }, groups, esc, arrow: arrowIcon, title: `Map of the coast around ${h.name} with the days out near it` });
  /* neighbours: the six closest resorts, each with its own page */
  const nb = RESORT_HOTELS.filter((o) => o.slug !== h.slug).map((o) => ({ o, d: km(h, o) })).sort((a, b) => a.d - b.d).slice(0, 6);
  const nbHtml = nb.map(({ o, d }) => { const ro = RES_BY_NAME[o.name], note = cleanNote(ro && ro.note); return `<a href="${BASE}/near/${o.slug}"><span class="nr-nb-t"><b>${esc(disp(o.name))}</b><small>${esc(d < 1 ? (note ? `Next door. ${note}` : "Next door") : note || o.area)}</small></span>${pill(ro)}${icon("arrow", 18, 2.4)}</a>`; }).join("\n");
  const port = h.port ? null : (X.ports || []).find((p) => p.region === h.region);
  const areaCount = area ? RESORT_HOTELS.filter((o) => o.region === h.region).length : 0;
  const wide = `${area ? `<a class="dark" href="${BASE}/area/${area.slug}"><span><b>All ${areaCount} resorts ${area.prep} ${esc(area.name)}</b><small>What's open, and what's near each one</small></span>${icon("arrow", 20, 2.4)}</a>` : ""}${port ? `<a href="${BASE}/near/${port.slug}"><span><b>In port at ${esc(port.name.replace(/ cruise port$/, ""))} for the day?</b><small>Days out that get you back before all-aboard</small></span>${icon("arrow", 20, 2.4)}</a>` : ""}`;
  /* questions about this place */
  const withPick = rows.filter((x) => pickupOf(x.v, h)), pricedRows = rows.filter((x) => pricedPickup(x.v, h));
  const qs = h.port ? [
    [`What fits a ship day from ${h.name}?`, fits.length ? `${fits.length === 1 ? "One does" : `${fits.length} do`}: ${andList(fits.map((x) => x.v.short))}. We plan to have you back at the pier by ${SHIP.backBy}, or an hour before the all-aboard time you give us.` : `Nothing here fits the hours in port. Ask us on WhatsApp and we'll suggest something closer.`],
    [`Is there pickup from the pier?`, withPick.length ? `Yes. ${pickupSentence(withPick, h)} For the others, ask us on WhatsApp if you need a ride.` : `Not on these. ${groups.length ? `${leadFrom(groups, "from the pier")} ` : ""}Ask us on WhatsApp if you need a ride.`],
    [`What's closest to ${h.name}?`, closestAnswer(A, "from the pier")],
  ] : [
    [`Is there hotel pickup from ${h.name}?`, withPick.length || pricedRows.length ? `Yes. ${[pickupSentence(withPick, h), pricedSentence(pricedRows, h.name)].filter(Boolean).join(" ")} For the others, ask us on WhatsApp if you need a ride.` : `Not on these. ${groups.length ? `${leadFrom(groups, "by road")} ` : ""}Ask us on WhatsApp if you need a ride.`],
    [`What's the closest thing to do near ${h.name}?`, closestAnswer(A, "away")],
    ...(air.length ? [[`How far is ${h.name} from the airport?`, airportAnswer(air)]] : []),
    [`Is ${h.name} open?`, !r || r.status === "Open" || r.status === "New" ? `Yes, it's open. Every resort on the island is on our resort status page, with reopening dates for the ones that are closed.` : r.status === "Reopening" ? `Not yet. ${h.name} is ${/\d/.test(r.when || "") ? `reopening ${r.when}` : "reopening, with the date still to be confirmed"}. Our resort status page shows what's open around it now.` : r.status === "Closing soon" ? `It's open now and closing for renovation${/\d/.test(r.when || "") ? ` (${r.when})` : ""}. Our resort status page has the dates.` : `It's closed for now. Our resort status page shows what's open around it.`],
  ].filter(([, a]) => a);
  const title = (() => { const w = h.port ? "from" : "near", t = `Things to do ${w} ${h.name}, Jamaica`; return t.length <= 60 ? t : `Things to do ${w} ${h.name}`.length <= 60 ? `Things to do ${w} ${h.name}` : `Things to do ${w} ${h.name.split(" / ")[0]}`; })();
  const desc = h.port
    ? clip(descFrom(mapGroups(fits)), `Days out that fit a ship day from ${h.name}, back before all-aboard.`)
    : clip(descFrom(groups), `Published prices in US$ and J$, and whether there's pickup from ${h.name}.`);
  const crumbsArea = area ? [{ "@type": "ListItem", position: 3, name: cap(area.name), item: `${S.origin}${BASE}/area/${area.slug}` }] : [];
  const jsonld = [
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Golden Vacation & Travel", item: S.origin }, { "@type": "ListItem", position: 2, name: "Golden Experiences", item: `${S.origin}${BASE}/` }, ...crumbsArea, { "@type": "ListItem", position: 3 + crumbsArea.length, name: `${h.port ? "From" : "Near"} ${h.name}`, item: `${S.origin}${BASE}/near/${h.slug}` }] },
    { "@context": "https://schema.org", "@type": "ItemList", name: `Things to do ${h.port ? "from" : "near"} ${h.name}`, itemListElement: (h.port ? fits : rows).map(({ v }, i) => ({ "@type": "ListItem", position: i + 1, name: v.name, url: `${S.origin}${BASE}/${v.slug}` })) },
    faqLd(qs),
  ];
  const hero = (A || rows[0] || { v: X.venues[0] }).v.photos[0];
  return `${head({ title, description: desc, pathname: `${BASE}/near/${h.slug}`, image: hero.file, jsonld, bodyClass: "exp exp-near", near: true })}
${nav()}
<main class="nr" data-hotel="${h.slug}">
<nav class="crumbs wrap" aria-label="Breadcrumb"><a href="${BASE}/">Golden Experiences</a><span>/</span>${area ? `<a href="${BASE}/area/${area.slug}">${esc(cap(area.name))}</a><span>/</span>` : ""}<span>${h.port ? "From" : "Near"} ${esc(h.name)}</span></nav>
<section class="nr-hero" aria-labelledby="nr-h1">
  <div class="wrap nr-hero-in">
    <div class="nr-hero-t">
      ${h.port ? `<span class="nr-hotel">${chip}</span>` : `<a class="nr-hotel" href="/hotel-status/">${chip}</a>`}
      <h1 class="hh" id="nr-h1">${h.port ? `In port for the day? Things to do from ${esc(h.name)}.` : `Things to do near ${esc(h.name)}.`}</h1>
      <p class="nr-lead">${esc(lead)}</p>
      <div class="nr-btns">${btn(h.port ? "Plan my ship day" : "Plan my day out", waPlan, "gold", "", "chat")}${h.port ? btn("Browse from this port", `${BASE}/?hotel=${h.slug}`, "line", "", "arrow") : `<a class="btn btn-line" href="#getting-here">Airport pickup${icon("car", 18)}</a>`}</div>
    </div>
    <div class="nr-map-w">${map}<p class="nr-map-note">${esc(X.driveNote.split(".")[0])}. Traffic and the road decide the rest.</p></div>
  </div>
</section>
${jumpBar(bands, air.length ? `<a class="nr-chip" href="#getting-here">Airport<small>${air.length}</small></a>` : "", `<a class="nr-change" href="${BASE}/?hotel=${h.slug}">${icon("pin", 17)}${h.port ? "Change port" : "Change hotel"}</a>`)}
<div class="wrap nr-list">
${bands.map((b) => bandHtml(b, h, who, ask)).join("\n")}
</div>
${airportHtml(h, who, air, transfersHref)}
<section class="wrap nr-also" aria-labelledby="nr-also-h">
  <div class="nr-sec-h"><h2 class="hh" id="nr-also-h">${h.port ? `Resorts near ${esc(h.name)}.` : `Also near ${esc(h.name)}.`}</h2><p>Every resort around here has its own page, with drive times from its own door.</p></div>
  <div class="nr-nb">${nbHtml}</div>
  ${wide ? `<div class="nr-wide">${wide}</div>` : ""}
</section>
${questionsHtml(`Questions about ${h.name}.`, qs)}
</main>
${footer()}
${scripts({ page: "near", whatsapp: S.whatsapp, hotel: h.slug })}
</body></html>`;
}

function areaPage(a) {
  const c = X.regions[a.region];
  const P = { name: `the middle of ${a.name}`, region: a.region, lat: c.lat, lng: c.lng, slug: `area-${a.slug}`, isArea: true, areaName: a.name };
  const rows = daysOut(P);
  const bands = bandsFor(P, rows, `the middle of ${a.name}`);
  const resorts = RESORT_HOTELS.filter((h) => h.region === a.region).sort((x, y) => (x.status === "Open" ? 0 : 1) - (y.status === "Open" ? 0 : 1) || x.name.localeCompare(y.name));
  const openN = resorts.filter((h) => h.status === "Open").length;
  const smallOnes = SMALL_HOTELS.filter((h) => h.region === a.region).sort((x, y) => x.name.localeCompare(y.name));
  const port = (X.ports || []).find((p) => p.region === a.region);
  const air = airportRows(P);
  const [A, B] = rows;
  const where = cap(a.name);
  const waPlan = wa(`Hi Golden Vacation! We're staying ${a.prep} ${a.name} and we'd like to add a day out. Ref GV-EXP-NEAR`);
  const ask = wa(`Hi Golden Vacation! We're staying ${a.prep} ${a.name} and we need a ride to a day out. Ref GV-EXP-NEAR`);
  const groups = mapGroups(rows);
  const lead = `${leadFrom(groups, `from the middle of ${a.name}`)} Pick your resort below for drive times from its own door. Every price is the published rate, in US$ and J$.`.trim();
  const map = nearMap({ ring: JM.ring, anchor: { lat: c.lat, lng: c.lng, name: null }, groups, dots: resorts, esc, arrow: arrowIcon, lngSpan: 0.56, title: `Map of ${a.name} with its resorts and the days out near it` });
  const nbHtml = resorts.map((o) => { const ro = RES_BY_NAME[o.name], note = cleanNote(ro && ro.note); return `<a href="${BASE}/near/${o.slug}"><span class="nr-nb-t"><b>${esc(disp(o.name))}</b><small>${esc(note || o.area)}</small></span>${pill(ro)}${icon("arrow", 18, 2.4)}</a>`; }).join("\n");
  const withPick = rows.filter((x) => pickupOf(x.v, P)), pricedRows = rows.filter((x) => pricedPickup(x.v, P));
  const qs = [
    [`What's closest to ${a.name}?`, closestAnswer(A, `from the middle of ${a.name}`)],
    [`Is there hotel pickup ${a.prep} ${a.name}?`, withPick.length || pricedRows.length ? `Yes. ${[pickupSentence(withPick, P), pricedSentence(pricedRows, `${a.name} hotels`)].filter(Boolean).join(" ")} For the others, ask us on WhatsApp if you need a ride.` : `Not on these. Ask us on WhatsApp if you need a ride.`],
    ...(air.length ? [[`How far is ${a.name} from the airport?`, airportAnswer(air)]] : []),
  ].filter(([, x]) => x);
  const title = `Things to do ${a.prep} ${a.name}, Jamaica`;
  const desc = clip(descFrom(groups), `Drive times from ${resorts.length === 1 ? "the resort" : `${resorts.length} resorts`} ${a.prep} ${a.name}, with published prices.`);
  const jsonld = [
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Golden Vacation & Travel", item: S.origin }, { "@type": "ListItem", position: 2, name: "Golden Experiences", item: `${S.origin}${BASE}/` }, { "@type": "ListItem", position: 3, name: where, item: `${S.origin}${BASE}/area/${a.slug}` }] },
    { "@context": "https://schema.org", "@type": "ItemList", name: `Resorts ${a.prep} ${a.name}`, itemListElement: resorts.map((o, i) => ({ "@type": "ListItem", position: i + 1, name: `Things to do near ${disp(o.name)}`, url: `${S.origin}${BASE}/near/${o.slug}` })) },
    faqLd(qs),
  ];
  const hero = (A || { v: X.venues[0] }).v.photos[0];
  return `${head({ title, description: desc, pathname: `${BASE}/area/${a.slug}`, image: hero.file, jsonld, bodyClass: "exp exp-near exp-area", near: true })}
${nav()}
<main class="nr" data-area="${a.slug}">
<nav class="crumbs wrap" aria-label="Breadcrumb"><a href="${BASE}/">Golden Experiences</a><span>/</span><span>${esc(where)}</span></nav>
<section class="nr-hero" aria-labelledby="nr-h1">
  <div class="wrap nr-hero-in">
    <div class="nr-hero-t">
      <a class="nr-hotel" href="#resorts"><span class="nr-noimg">${icon("pin", 20)}</span><span><b>${resorts.length} ${resorts.length === 1 ? "resort" : "resorts"}${smallOnes.length ? ` and ${smallOnes.length} smaller hotels` : ""}</b><span class="nr-st o"><i></i>${openN} open now</span></span></a>
      <h1 class="hh" id="nr-h1">Things to do ${a.prep} ${esc(a.name)}.</h1>
      <p class="nr-lead">${esc(lead)}</p>
      <div class="nr-btns">${btn("Plan my day out", waPlan, "gold", "", "chat")}<a class="btn btn-line" href="#resorts">Find my resort${icon("arrow", 18)}</a></div>
    </div>
    <div class="nr-map-w">${map}<p class="nr-map-note">${esc(X.driveNote.split(".")[0])}, from the middle of the area. Traffic and the road decide the rest.</p></div>
  </div>
</section>
${jumpBar(bands, `<a class="nr-chip" href="#resorts">Resorts<small>${resorts.length}</small></a>${air.length ? `<a class="nr-chip" href="#getting-here">Airport<small>${air.length}</small></a>` : ""}`, "")}
<div class="wrap nr-list">
${bands.map((b) => bandHtml(b, P, `${cap(a.name).replace(/^The /, "")} hotels`, ask)).join("\n")}
</div>
<section class="wrap nr-also" id="resorts" aria-labelledby="nr-also-h">
  <div class="nr-sec-h"><h2 class="hh" id="nr-also-h">Resorts ${a.prep} ${esc(a.name)}.</h2><p>Every one has its own page, with drive times from its own door.</p></div>
  <div class="nr-nb">${nbHtml}</div>
  ${smallOnes.length ? `<div class="nr-smallh"><h3>Villas, guesthouses and smaller hotels</h3><p>Staying at one of these? The drive times on this page are from the middle of ${esc(a.name)}.</p><ul>${smallOnes.map((o) => `<li>${esc(o.name)}</li>`).join("")}</ul></div>` : ""}
  ${port ? `<div class="nr-wide"><a href="${BASE}/near/${port.slug}"><span><b>In port at ${esc(port.name.replace(/ cruise port$/, ""))} for the day?</b><small>Days out that get you back before all-aboard</small></span>${icon("arrow", 20, 2.4)}</a></div>` : ""}
</section>
${airportHtml(P, a.name, air, "/transfers/")}
${questionsHtml(`Questions about ${a.name}.`, qs)}
</main>
${footer()}
${scripts({ page: "near", whatsapp: S.whatsapp })}
</body></html>`;
}

/* ---------- links in: the hub's list of every resort, and "Staying nearby?" on each tour ---------- */
function hubDirectory() {
  const fold = (title, count, links, foot = "") => `<details><summary><span><b>${esc(title)}</b>${count ? `<small>${count}</small>` : ""}</span>${icon("chev", 20, 2.6)}</summary><ul>${links}</ul>${foot}</details>`;
  const blocks = AREA_PAGES.map((a) => {
    const hs = RESORT_HOTELS.filter((h) => h.region === a.region).sort((x, y) => x.name.localeCompare(y.name));
    return hs.length ? fold(cap(a.name), `${hs.length} ${hs.length === 1 ? "resort" : "resorts"}`, hs.map((h) => `<li><a href="${BASE}/near/${h.slug}">${esc(disp(h.name))}</a></li>`).join(""), `<a class="eh-dir-area" href="${BASE}/area/${a.slug}">Everything ${a.prep} ${esc(a.name)}${icon("arrow", 16, 2.4)}</a>`) : "";
  }).join("");
  const ports = fold("Cruise ports", `${(X.ports || []).length} ports`, (X.ports || []).map((p) => `<li><a href="${BASE}/near/${p.slug}">${esc(p.name)}</a></li>`).join(""));
  const smalls = fold("Villas and smaller hotels", "by area", AREA_PAGES.filter((a) => SMALL_HOTELS.some((h) => h.region === a.region)).map((a) => `<li><a href="${BASE}/area/${a.slug}">${esc(cap(a.name))}</a></li>`).join(""));
  return `<section class="eh-dir wrap" id="by-hotel" aria-labelledby="eh-dir-h">
  <div class="eh-dir-head"><div>${kicker("By hotel")}<h2 class="hh" id="eh-dir-h">Things to do near your hotel.</h2></div><p>Every resort has its own page, with drive times from its door and pickup for that hotel.</p></div>
  <div class="eh-dir-list">${blocks}${ports}${smalls}</div>
</section>`;
}
function stayingNearby(v) {
  if (isLounge(v)) return "";
  const openish = (h) => /^(Open|New|Closing soon)$/.test(h.status);
  const all = RESORT_HOTELS.filter((h) => !samePlace(h, v)).map((h) => ({ h, min: driveMin(h, v) })).filter((r) => r.min != null).sort((a, b) => a.min - b.min || a.h.name.localeCompare(b.h.name));
  const pick = [...all.filter((r) => openish(r.h)), ...all.filter((r) => !openish(r.h))].slice(0, 6).sort((a, b) => a.min - b.min || a.h.name.localeCompare(b.h.name));
  if (!pick.length) return "";
  const region = { trelawny: "falmouth" }[v.area] || v.area, area = AREA_BY_REGION[region];
  return `<div class="nr-stay">
      <div class="nr-stay-h"><div><h2 class="hh">Staying nearby?</h2><p>Drive times to ${esc(v.short)} from the resorts closest to it.</p></div>${area ? `<a class="nr-go" href="${BASE}/area/${area.slug}">All of ${esc(cap(area.name))}${icon("arrow", 16, 2.4)}</a>` : ""}</div>
      <div class="nr-stay-g">${pick.map(({ h, min }) => `<a href="${BASE}/near/${h.slug}"><span><b>${esc(disp(h.name))}</b><small>${icon("clock", 14)}${esc(cap(driveLabel(min)))}</small></span>${icon("arrow", 17, 2.4)}</a>`).join("")}</div>
    </div>`;
}

/* ---------- booked page ---------- */
function bookedPage(previewState = "") {
  return `${head({ title: "Your booking | Golden Experiences", description: "Booking confirmation for your Golden Experiences day out in Jamaica.", pathname: `${BASE}/booked`, noindex: true, bodyClass: "exp exp-booked" })}
${nav()}
<main class="booked wrap" id="booked" data-state="loading">
  <div class="booked-card">
    <div class="state" data-for="loading">${kicker("One moment")}<h1 class="hh">Confirming your booking.</h1><p>Your card has been charged and we're confirming the booking now. This takes a few seconds.</p></div>
    <div class="state" data-for="confirmed" hidden>${kicker("Booked")}<h1 class="hh">You're in.</h1><p>Your booking is confirmed. The confirmation and your voucher are on their way to <b id="bk-email"></b>. Show it on your phone when you arrive.</p><dl class="bk-dl" id="bk-details"></dl><p class="bk-order">Booking reference <b id="bk-ref"></b><span id="bk-order-wrap"> · Park order <b id="bk-order"></b></span></p></div>
    <div class="state" data-for="team" hidden>${kicker("Booked")}<h1 class="hh">You're booked. Details on the way.</h1><p>Your card went through and your place is confirmed. One of our travel professionals is sending your booking details (tickets, meeting point, timings) to <b id="bk-email-t"></b> and your WhatsApp shortly, during working hours. Nothing more to do.</p><dl class="bk-dl" id="bk-details-t"></dl><p class="bk-order">Booking reference <b id="bk-ref-t"></b></p></div>
    <div class="state" data-for="pending" hidden>${kicker("Paid, being confirmed")}<h1 class="hh">Your card went through. We're confirming your places by hand.</h1><p>The park's system didn't answer straight away, so one of our travel professionals is confirming this booking now. You'll have the confirmation by WhatsApp or email within the hour, during working hours. Nothing more to do.</p><dl class="bk-dl" id="bk-details-p"></dl><p class="bk-order">Booking reference <b id="bk-ref-p"></b></p></div>
    <div class="state" data-for="unknown" hidden>${kicker("Hmm")}<h1 class="hh">We can't find that booking.</h1><p>If you've just paid, give it a minute and refresh. If you closed the payment page before paying, nothing was charged and you can start again.</p></div>
    <div class="bk-btns">${btn("Message us on WhatsApp", wa("Hi Golden Vacation! I've just booked an experience on your website and I have a question. Ref "), "outline", "", "chat", ' id="bk-wa"')}${btn("Back to experiences", `${BASE}/`, "black")}</div>
  </div>
  <form name="exp-bookings" data-netlify="true" netlify-honeypot="bot-field" hidden><input type="text" name="bot-field"><input type="text" name="ref"><input type="text" name="venue"><input type="text" name="product"><input type="text" name="when"><input type="text" name="guests"><input type="text" name="pickup"><input type="text" name="customer"><input type="email" name="email"><input type="text" name="phone"><input type="text" name="total"><input type="text" name="status"><input type="text" name="order"><input type="text" name="note"></form>
  <form name="exp-enquiries" data-netlify="true" netlify-honeypot="bot-field" hidden><input type="text" name="bot-field"><input type="text" name="ref"><input type="text" name="venue"><input type="text" name="product"><input type="text" name="rate"><input type="text" name="when"><input type="text" name="guests"><input type="text" name="pickup"><input type="text" name="total"><input type="text" name="hotel"><input type="text" name="page"><textarea name="message"></textarea></form>
  <form name="exp-alerts" data-netlify="true" hidden><input type="text" name="ref"><input type="text" name="venue"><input type="text" name="product"><input type="text" name="when"><input type="text" name="customer"><input type="text" name="total"><input type="text" name="error"></form>
</main>
${footer()}
${scripts({ page: "booked", whatsapp: S.whatsapp, ...(previewState ? { previewState } : {}) })}
</body></html>`;
}


/* ---------- tour partners: operators and people who run excursions send their details to be listed ---------- */
const PT_CSS = `<style>
.partners { padding: 0 var(--pad) 80px; }
.partners .crumbs { padding: 22px 0 0; }
.partners .lead { padding: 0; }
.pt-grid { display: grid; grid-template-columns: minmax(0, 780px) minmax(240px, 340px); gap: 40px; align-items: start; }
.pt-aside { position: sticky; top: 104px; display: flex; flex-direction: column; gap: 14px; padding: 24px; border: 2px solid var(--ink); border-radius: 22px; }
.pt-aside ol { margin: 0; padding: 0; list-style: none; counter-reset: s; display: flex; flex-direction: column; gap: 14px; }
.pt-aside li { counter-increment: s; display: grid; grid-template-columns: 30px 1fr; gap: 10px; font-size: 15px; line-height: 1.45; color: var(--ink-2); }
.pt-aside li::before { content: counter(s); width: 28px; height: 28px; border-radius: 50%; background: var(--gold); color: var(--ink); font-weight: 800; font-size: 14px; display: grid; place-items: center; }
.pt-aside b { color: var(--ink); }
@media (max-width: 980px) { .pt-grid { grid-template-columns: minmax(0, 1fr); } .pt-aside { position: static; } }
.pt-hero { max-width: 780px; margin: 22px 0 30px; display: flex; flex-direction: column; gap: 12px; }
.pt-form { max-width: 780px; display: flex; flex-direction: column; gap: 22px; }
.pt-form fieldset { border: 0; margin: 0; padding: 24px; background: var(--alt); border-radius: 22px; display: flex; flex-direction: column; gap: 16px; min-width: 0; }
.pt-form legend { float: left; width: 100%; padding: 0; font-weight: 800; font-size: 20px; letter-spacing: -.01em; }
.pt-f { display: flex; flex-direction: column; gap: 7px; font-weight: 700; font-size: 14px; }
.pt-f small { font-weight: 500; color: var(--ink-3); }
.pt-f input, .pt-f textarea { font: inherit; font-weight: 500; font-size: 16px; line-height: 1.45; padding: 12px 14px; border: 2px solid var(--line); border-radius: 14px; background: #fff; color: var(--ink); width: 100%; box-sizing: border-box; }
.pt-f input:focus, .pt-f textarea:focus { outline: none; border-color: var(--ink); }
.pt-two { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
.pt-q { display: flex; flex-direction: column; gap: 9px; }
.pt-l { font-weight: 700; font-size: 14px; }
.pt-chips { display: flex; flex-wrap: wrap; gap: 8px; }
.pt-chip { position: relative; display: inline-flex; }
.pt-chip input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; }
.pt-chip span { display: inline-flex; align-items: center; min-height: 38px; padding: 0 15px; border: 2px solid var(--ink); border-radius: 999px; font-weight: 700; font-size: 14px; background: #fff; }
.pt-chip input:checked + span { background: var(--ink); color: #fff; }
.pt-chip input:focus-visible + span { outline: 3px solid var(--gold); outline-offset: 2px; }
.pt-send { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
.pt-send .btn[disabled] { opacity: .6; }
.pt-done { max-width: 780px; margin: 22px 0 8px; display: flex; flex-direction: column; gap: 12px; align-items: flex-start; }
@media (max-width: 640px) { .pt-form fieldset { padding: 18px; border-radius: 18px; } }
</style>`;
function partnersPage() {
  const chipSet = (name, items, type = "checkbox") => `<div class="pt-chips">${items.map((t) => `<label class="pt-chip"><input type="${type}" name="${name}" value="${esc(t)}"><span>${esc(t)}</span></label>`).join("")}</div>`;
  const q = (label, name, items, type) => `<div class="pt-q" role="group" aria-label="${esc(label)}"><span class="pt-l">${esc(label)}</span>${chipSet(name, items, type)}</div>`;
  const field = (label, name, attrs = "", hint = "") => `<label class="pt-f"><span>${esc(label)}${hint ? ` <small>${esc(hint)}</small>` : ""}</span><input name="${name}" ${attrs}></label>`;
  return `${head({ title: "List your tours with Golden Experiences | for tour operators in Jamaica", description: "Run tours, excursions, boat trips or an attraction in Jamaica? Send us your details to be listed on Golden Experiences and sold at published prices to visitors, cruise passengers and locals.", pathname: `${BASE}/partners`, image: X.venues[0].photos[0].file, bodyClass: "exp exp-partners" })}
${PT_CSS}
${nav()}
<main class="partners wrap">
<nav class="crumbs" aria-label="Breadcrumb"><a href="${BASE}/">Golden Experiences</a><span>/</span><span>List your tours</span></nav>
<section class="pt-hero" id="pt-top">
  ${kicker("For tour operators")}
  <h1 class="hh">List your tours with Golden Experiences.</h1>
  <p class="lead">We sell days out across Jamaica to visitors, cruise passengers and locals, at published prices and with hotel pickup where it runs. Send us what you run and our team will get back to you on WhatsApp or by email.</p>
</section>
<div class="pt-grid">
<form class="pt-form" id="pt-form" name="tour-partners" method="POST" data-netlify="true" netlify-honeypot="bot-field" action="${BASE}/partners?sent=1">
  <input type="hidden" name="form-name" value="tour-partners"><input type="hidden" name="ref" id="pt-ref" value="">
  <p hidden><label>Leave this empty <input name="bot-field"></label></p>
  <fieldset><legend>Your business</legend>
    <div class="pt-two">${field("Business name", "business", 'required autocomplete="organization"')}${field("Your name", "name", 'required autocomplete="name"')}</div>
    <div class="pt-two">${field("WhatsApp or phone", "phone", 'type="tel" required autocomplete="tel" placeholder="876 555 0123"')}${field("Email", "email", 'type="email" required autocomplete="email" placeholder="you@yourbusiness.com"')}</div>
    ${field("Website or Instagram", "website", 'placeholder="instagram.com/yourtours"', "optional")}
  </fieldset>
  <fieldset><legend>What you run</legend>
    ${q("What you offer", "offers", ["Tours", "Excursions", "Attraction or park", "Boat trips", "Day passes", "Transport", "Something else"])}
    ${q("Where", "areas", ["Negril", "Hanover", "Montego Bay", "Trelawny", "Ocho Rios and Runaway Bay", "South Coast", "Kingston", "Portland", "Island-wide"])}
    <label class="pt-f"><span>Your tours</span><textarea name="tours" rows="6" required placeholder="Each tour's name, how long it runs, what's included, and your adult and child prices"></textarea></label>
    ${q("Hotel pickup", "pickup", ["Yes", "Some areas", "No"], "radio")}
  </fieldset>
  <fieldset><legend>Working together</legend>
    ${q("TPDCo licence", "tpdco", ["Yes", "In progress", "No"], "radio")}
    ${q("Public liability insurance", "insurance", ["Yes", "No"], "radio")}
    ${q("How you work with agents", "rates", ["Net rates", "Commission", "Not sure yet"], "radio")}
    ${q("Booking system", "system", ["Rezdy", "FareHarbor", "Bokun", "Another one", "None"], "radio")}
  </fieldset>
  <div class="pt-send"><button class="btn btn-black btn-lg" type="submit">Send my details${icon("arrow", 18, 2.4)}</button><p class="pf-hint" id="pt-msg">We only use these details to talk to you about listing your tours.</p></div>
</form>
<aside class="pt-aside" aria-label="What happens next">${kicker("What happens next")}<ol>
  <li><span><b>We read what you run</b> and check it fits what our guests ask us for.</span></li>
  <li><span><b>We call or WhatsApp you</b> to agree rates, pickup and how bookings reach you.</span></li>
  <li><span><b>Your tours go on Golden Experiences</b> with your photos and published prices.</span></li>
</ol></aside>
</div>
<section class="pt-done" id="pt-done" hidden>${kicker("Sent")}<h2 class="hh">Thanks. We have your details.</h2><p class="lead">Your reference is <b id="pt-ref-out">on its way to your email</b>. Our team will be in touch on WhatsApp or by email.</p>${btn("Back to Golden Experiences", `${BASE}/`, "outline", "", "arrow")}</section>
</main>
${footer()}
${scripts({ page: "partners", whatsapp: S.whatsapp })}
<script>(function () {
  var f = document.getElementById("pt-form"), done = document.getElementById("pt-done"), out = document.getElementById("pt-ref-out");
  if (!f) return;
  var ref = "GV-PTN-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  document.getElementById("pt-ref").value = ref;
  function shown(r) { f.hidden = true; var a = document.querySelector(".pt-aside"); if (a) a.hidden = true; done.hidden = false; if (r) out.textContent = r; }
  if (/[?&]sent=1/.test(location.search)) shown("");
  f.addEventListener("submit", function (e) {
    if (!f.checkValidity()) return;
    e.preventDefault();
    var body = new URLSearchParams(), multi = {};
    new FormData(f).forEach(function (v, k) { if (k === "offers" || k === "areas") (multi[k] = multi[k] || []).push(v); else body.append(k, v); });
    Object.keys(multi).forEach(function (k) { body.append(k, multi[k].join(", ")); });
    var b = f.querySelector("button[type=submit]"), m = document.getElementById("pt-msg");
    b.disabled = true;
    fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() })
      .then(function (r) { if (!r.ok) throw new Error(r.status); shown(ref); window.scrollTo({ top: 0, behavior: "smooth" }); })
      .catch(function () { b.disabled = false; m.textContent = "That didn't send. Check your connection and try again, or message us on WhatsApp."; m.classList.add("bad"); });
  });
})();</script>
</body></html>`;
}

/* ---------- write ---------- */
const pages = [
  ["public/experiences/index.html", hubPage(), "hub"],
  ...X.venues.map((v) => [`public/experiences/${v.slug}.html`, venuePage(v), v.slug]),
  ["public/experiences/booked.html", bookedPage(), "booked"],
  ["public/experiences/partners.html", partnersPage(), "partners"],
  ...(BUNDLE ? [["public/experiences/booked-team.html", bookedPage("team"), "booked-team"]] : []),
  ...NEAR_HOTELS.map((h) => [`public/experiences/near/${h.slug}.html`, nearPage(h), `near-${h.slug}`]),
  ...AREA_PAGES.map((a) => [`public/experiences/area/${a.slug}.html`, areaPage(a), `area-${a.slug}`]),
];

if (!BUNDLE) {
  for (const [rel, html] of pages) {
    const f = path.join(ROOT, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, html);
    console.log("wrote", rel, `${(html.length / 1024).toFixed(0)}K`);
  }
  /* the functions get the catalogue as a plain module: Netlify's bundler turns the .mjs functions into CommonJS, where
     import.meta.url is empty and JSON imports are not guaranteed, so a generated module is the one shape that works everywhere */
  const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
  const dataModule = `/* Generated by scripts/build-experiences.mjs from data/experiences.json, data/rezdy-map.json and data/tripadvisor-map.json.
   Do not edit by hand: change the JSON and rerun the build. */
export const DATA = ${JSON.stringify(X)};
export const REZDY_MAP = ${JSON.stringify(readJson("data/rezdy-map.json"))};
export const TA_MAP = ${JSON.stringify(readJson("data/tripadvisor-map.json"))};
/* ship days: the settings in minutes, each port's region, and the start/duration facts the build reads from every product's times and hours */
export const SHIP = ${JSON.stringify({ settings: SHIP_CFG, ports: Object.fromEntries((X.ports || []).map((pt) => [pt.slug, { name: pt.name, region: pt.region }])), products: Object.fromEntries(X.venues.flatMap((v) => v.products.filter(live).map((p) => [`${v.slug}:${p.id}`, shipDayOf(p, v)]))), venues: Object.fromEntries(X.venues.map((v) => [v.slug, v.shipDay === false ? 0 : 1])) })};
`;
  fs.writeFileSync(path.join(ROOT, "netlify/functions/_exp-data.mjs"), dataModule);
  console.log("wrote netlify/functions/_exp-data.mjs", `${(dataModule.length / 1024).toFixed(0)}K`);
  /* sitemap: the section's indexable pages. Every earlier experiences entry is found by its address and replaced in
     place, so a missing marker can never double the list. The smaller hotels' near pages are not listed: they redirect. */
  const smPath = path.join(ROOT, "public/sitemap.xml");
  if (fs.existsSync(smPath)) {
    const urls = [[`${BASE}/`, "0.8"], [`${BASE}/partners`, "0.4"], ...X.venues.map((v) => [`${BASE}/${v.slug}`, "0.7"]), ...AREA_PAGES.map((a) => [`${BASE}/area/${a.slug}`, "0.7"]), ...NEAR_HOTELS.map((h) => [`${BASE}/near/${h.slug}`, "0.6"])];
    const entries = urls.map(([u, pr]) => `<url>\n  <loc>${S.origin}${u}</loc>\n  <lastmod>${TODAY}T00:00:00+00:00</lastmod>\n  <priority>${pr}</priority>\n</url>`).join("\n\n");
    const block = `<!-- experiences -->\n${entries}\n<!-- /experiences -->\n`;
    const urlRe = new RegExp(`<url>\\s*<loc>${S.origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}${BASE}[/?][^<]*</loc>[\\s\\S]*?</url>\\s*`, "g");
    let placed = false;
    let sm = fs.readFileSync(smPath, "utf8").replace(/<!-- \/?experiences -->\s*/g, "").replace(urlRe, () => (placed ? "" : ((placed = true), "@@EXPERIENCES@@\n")));
    sm = placed ? sm.replace("@@EXPERIENCES@@\n", `${block}\n`) : sm.replace(/\s*<\/urlset>\s*$/, `\n\n${block}\n</urlset>\n`);
    fs.writeFileSync(smPath, sm);
    console.log("sitemap:", urls.length, "experiences urls");
  }
  const rdPath = path.join(ROOT, "public/_redirects");
  if (fs.existsSync(rdPath)) {
    const lines = SMALL_HOTELS.filter((h) => AREA_BY_REGION[h.region]).map((h) => `${BASE}/near/${h.slug}  ${BASE}/area/${AREA_BY_REGION[h.region].slug}  301!`);
    const block = `# Smaller hotels, villas and guesthouses: their near pages fold into their area page (written by scripts/build-experiences.mjs)\n${lines.join("\n")}\n# /smaller hotels\n`;
    const rd = fs.readFileSync(rdPath, "utf8").replace(/\n*# Smaller hotels, villas and guesthouses[\s\S]*?# \/smaller hotels\n?/, "\n").replace(/\s*$/, "\n");
    fs.writeFileSync(rdPath, `${rd}\n${block}`);
    console.log("redirects:", lines.length, "smaller hotels to their area pages");
  }
  const missing = [...usedImages].filter((f) => !fs.existsSync(path.join(IMG_DIR, f)));
  if (missing.length) console.warn("MISSING IMAGES:", missing.join(", "));
  const expired = X.venues.flatMap((v) => v.products.filter((p) => !live(p)).map((p) => `${v.slug}/${p.id}`));
  if (expired.length) console.log("expired, left out:", expired.join(", "));
} else {
  /* one file, every page inside, a hash router switches between them; images inline (card size where one exists) */
  const css = ["public/getaways/assets/getaways.css", "public/assets/home.css", "public/assets/experiences.css", "public/assets/near.css"].map((f) => fs.readFileSync(path.join(ROOT, f), "utf8")).join("\n");
  const js = ["public/getaways/assets/getaways.js", "public/assets/home.js", "public/assets/experiences.js"].map((f) => fs.readFileSync(path.join(ROOT, f), "utf8")).join("\n");
  const stripHead = (html) => html.replace(/^[\s\S]*?<body[^>]*>/, "").replace(/<\/body><\/html>\s*$/, "");
  const cfgOf = (html) => { const m = html.match(/<script>window\.GV_EXP=(\{[\s\S]*?\});<\/script>/); return m ? m[1] : "{}"; };
  const bodyClassOf = (html) => { const m = html.match(/<body class="([^"]*)"/); return m ? m[1] : ""; };
  pages.sort((a, b) => (/^(near|area)-/.test(b[2]) ? 1 : 0) - (/^(near|area)-/.test(a[2]) ? 1 : 0));
  /* the preview's page menu: every hotel A to Z, then the cruise ports, the areas, and the tours and other pages */
  const pvLabel = (key) => key === "hub" ? "Experiences hub" : key === "booked" ? "After paying (JamWest)" : key === "booked-team" ? "After paying (other tours)" : key === "partners" ? "Tour partners" : key.startsWith("near-") ? HOTELS.find((h) => h.slug === key.slice(5)).name : key.startsWith("area-") ? cap(AREA_PAGES.find((a) => a.slug === key.slice(5)).name) : venueBySlug[key] ? venueBySlug[key].name : key;
  const pvMenu = () => {
    const keys = pages.map((x) => x[2]);
    const group = (label, list) => (list.length ? `<optgroup label="${esc(label)}">${list.map((k) => `<option value="${k}">${esc(pvLabel(k))}</option>`).join("")}</optgroup>` : "");
    const near = keys.filter((k) => k.startsWith("near-") && !HOTELS.find((h) => h.slug === k.slice(5)).port).sort((a, b) => pvLabel(a).localeCompare(pvLabel(b)));
    const ports = keys.filter((k) => k.startsWith("near-") && HOTELS.find((h) => h.slug === k.slice(5)).port);
    return group("Things to do near a hotel (A to Z)", near) + group("From a cruise port", ports) + group("Areas", keys.filter((k) => k.startsWith("area-"))) + group("Tours and other pages", keys.filter((k) => !/^(near|area)-/.test(k)));
  };
  const lead = pages.findIndex((x) => x[2] === "hub"); // the preview opens on the Experiences page itself
  if (lead > 0) pages.unshift(...pages.splice(lead, 1));
  const firstKey = pages[0][2];
  const sections = pages.map(([rel, html, key]) => {
    let inner = stripHead(html).replace(/<script>window\.GV_EXP=[\s\S]*?<\/script>\s*/, "").replace(/<script src="[^"]*" defer><\/script>\s*/g, "");
    return `<section class="pv-page" id="pv-${key}" data-body="${bodyClassOf(html)}" data-cfg='${cfgOf(html).replace(/'/g, "&#39;")}' hidden>${inner}</section>`;
  }).join("\n");
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Golden Experiences preview</title>
<meta name="robots" content="noindex,nofollow">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100,400;100,500;100,600;100,700;110,800;110,900&display=swap">
<style>${css}
:root{box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
html{scroll-padding-top:env(safe-area-inset-top,0px)}
.nr-jump{top:env(safe-area-inset-top,0px)}
.pv-bar{position:relative;z-index:50;display:flex;gap:10px;align-items:center;padding:8px 14px;background:#F2B93B;color:#0E0F0E;font:800 13px/1.2 Archivo,system-ui,sans-serif}
.pv-bar select{font:inherit;padding:6px 8px;border-radius:8px;border:2px solid #0E0F0E;background:#fff;max-width:60vw}
.pv-bar span{opacity:.75;font-weight:600}</style>
<script>window.GV_CONFIG=${JSON.stringify({ base: BASE, whatsapp: S.whatsapp, jmdRate: S.jmdRate, preview: true })};</script>
</head>
<body class="exp">
<div class="pv-bar"><b>PREVIEW</b><select id="pv-pick" aria-label="Page">${pvMenu()}</select><span>Nothing here is live. Site links open goldenvacays.com in a new tab.</span></div>
<div id="pv-root">${sections}</div>
<script>${js}</script>
<script>
(function(){
  var pages=Array.prototype.slice.call(document.querySelectorAll('.pv-page'));
  var pick=document.getElementById('pv-pick');
  function show(key){
    var el=document.getElementById('pv-'+key)||document.getElementById('pv-hub'); key=el.id.slice(3);
    pages.forEach(function(p){p.hidden=(p!==el);});
    el.className='pv-page '+(el.getAttribute('data-body')||'exp');
    try{window.GV_EXP=JSON.parse(el.getAttribute('data-cfg')||'{}');}catch(e){window.GV_EXP={};}
    pick.value=key; window.scrollTo(0,0);
    if(window.GV_EXP_INIT) window.GV_EXP_INIT(el);
  }
  pick.addEventListener('change',function(){location.hash='#'+pick.value;});
  window.addEventListener('hashchange',function(){show((location.hash||'#hub').slice(1));});
  document.addEventListener('click',function(e){var a=e.target.closest('a');if(!a)return;var h=a.getAttribute('href')||'';
    var m=h.match(/^\\/experiences\\/(near\\/|area\\/)?([a-z0-9-]+)\\/?(\\?[^#]*)?(#.*)?$/); if(h.indexOf('/experiences/')===0&&!m){e.preventDefault();location.hash='#hub';return;}
    if(m){var key=(m[1]==='near/'?'near-':m[1]==='area/'?'area-':'')+m[2]; if(document.getElementById('pv-'+key)){e.preventDefault();location.hash='#'+key;return;} if(m[1]){a.setAttribute('target','_blank');a.href='${S.origin}'+h;return;} e.preventDefault();location.hash='#hub';return;}
    if(h.charAt(0)==='/'){a.setAttribute('target','_blank');a.href='${S.origin}'+h;}
  });
  show((location.hash||'#${firstKey}').slice(1));
})();
</script>
</body></html>`;
  html = html.replace(/ srcset="[^"]*"/g, "").replace(/ sizes="[^"]*"/g, "");
  /* images once each: a map of data URIs, wired to the img tags on load (the same photo appears on many pages) */
  const imgMap = {};
  for (const f of usedImages) {
    const p = path.join(IMG_DIR, f);
    const sp = path.join(IMG_DIR, small(f));
    const use = fs.existsSync(sp) ? sp : p;
    if (!fs.existsSync(use)) continue;
    const key = path.basename(use);
    imgMap[key] = `data:image/jpeg;base64,${fs.readFileSync(use).toString("base64")}`;
    html = html.split(`src="${IMG}/${f}"`).join(`data-gvimg="${key}"`);
  }
  html = html.replace("</body></html>", `<script>(function(){var M=${JSON.stringify(imgMap)};document.querySelectorAll('[data-gvimg]').forEach(function(i){i.src=M[i.getAttribute('data-gvimg')]||'';i.removeAttribute('loading');});})();</script></body></html>`);
  let out = html;
  if (ARTIFACT) out = html.replace(/^<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1(, viewport-fit=cover)?">\n/, "").replace(/<\/head>\n<body class="exp">/, '<div class="exp">').replace(/<\/body><\/html>$/, "</div>");
  fs.writeFileSync(BUNDLE, out);
  console.log("wrote", BUNDLE, `${(out.length / 1024).toFixed(0)}K`);
}

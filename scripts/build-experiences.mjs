#!/usr/bin/env node
/*
  Golden Experiences: the Jamaica tours, day passes, boat days and airport lounges section of goldenvacays.com.
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

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const X = JSON.parse(fs.readFileSync(path.join(ROOT, "data/experiences.json"), "utf8"));
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
const pic = (file, alt, extra = "") => `<img src="${img(file)}" alt="${esc(alt)}" loading="lazy" decoding="async"${extra}>`;
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

const NAV = [["Getaways", "/getaways/"], ["Staycations", "/#staycations"], ["Jamaica", "/#coming"], ["Experiences", `${BASE}/`], ["Groups", "/group-inquiry"], ["Resort status", "/hotel-status"]];
const CATS = Object.fromEntries(X.hub.categories);
const AREAS = Object.fromEntries(X.hub.areas);
const venueBySlug = Object.fromEntries(X.venues.map((v) => [v.slug, v]));

/* ---------- hotels (from the resort list the status page uses) and drive times ---------- */
const resortsJs = fs.readFileSync(path.join(ROOT, "public/map/resorts.js"), "utf8");
const RESORTS = JSON.parse(resortsJs.slice(resortsJs.indexOf("["), resortsJs.lastIndexOf("]") + 1));
const slugify = (s) => String(s).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const HOTELS = RESORTS.filter((r) => r.status !== "Permanently closed" && r.region && X.regions[r.region] && r.lat && r.lng)
  .map((r) => ({ name: r.name, slug: slugify(r.name), region: r.region, lat: r.lat, lng: r.lng, status: r.status, area: r.area }))
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
const venueDriveData = X.venues.map((v) => ({ slug: v.slug, lat: v.lat, lng: v.lng, drive: v.drive || {}, sd: v.shipDay === false ? 0 : 1 }));

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
function head({ title, description, pathname, image, jsonld = [], noindex = false, bodyClass = "" }) {
  const url = `${S.origin}${pathname}`;
  const og = `${S.origin}${image ? img(image) : `${ASSETS}/img/${H.meta.ogImage}`}`;
  const ld = jsonld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n");
  const ga = S.ga4 ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${S.ga4}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${S.ga4}');</script>` : "";
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
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100,400;100,500;100,600;100,700;110,800;110,900&display=swap">
<link rel="stylesheet" href="/getaways/assets/getaways.css">
<link rel="stylesheet" href="/assets/home.css">
<link rel="stylesheet" href="${ASSETS}/experiences.css?v=${STAMP}">
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

function venueCard(v) {
  const fp = fromPrice(v);
  const price = fp ? (fp.usd != null ? `<b>${dual(fp.usd)}</b><small>${fp.same ? "per person" : "from, per person"}</small>` : `<b>${jmd(fp.jmd)}</b><small>${fp.same ? "per person" : "from, per person"}</small>`) : `<b>Price on request</b>`;
  const n = v.products.filter(live).length;
  const doors = (v.doors || []).join(" ");
  return `<a class="vcard" href="${BASE}/${v.slug}" data-slug="${v.slug}" data-cats="${esc(v.categories.join(" "))}" data-area="${v.area}" data-doors="${esc(doors)}" data-booking="${v.booking}">
    <span class="vcard-photo">${pic(small(v.photos[0].file), v.photos[0].alt)}<span class="tag tag-white drive-tag" hidden></span></span>
    <span class="vcard-t">
      <span class="vcard-where">${esc(AREAS[v.area])} · ${esc(v.parish)}</span>
      <span class="h hh">${esc(v.name)}</span>
      <small>${esc(v.card)}</small>
      <span class="vcard-meta">${n} ${n === 1 ? "option" : "options"} · ${v.categories.map((c) => esc(CATS[c])).join(" · ")}</span>
    </span>
    <span class="vcard-p">${price}</span>
  </a>`;
}

/* ---------- hub ---------- */
function hubPage() {
  const hb = X.hub;
  const heroImg = "jamwest-zipline-rider.jpg";
  const doors = hb.doors.map((d) => `<button class="door edoor" type="button" data-door="${d.key}">
      <span class="door-img">${pic(small(d.img), d.alt)}</span>
      <span class="door-t"><b>${esc(d.title)}</b><small>${longShort(d.sub, d.subMobile)}</small></span>
      <span class="door-go">${icon("arrow", 20, 2.4)}</span>
    </button>`).join("");
  const chips = hb.categories.map(([k, l], i) => `<button class="chip" type="button" data-cat="${k}" aria-pressed="${i === 0 ? "true" : "false"}">${esc(l)}</button>`).join("");
  const areaOpts = hb.areas.map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join("");
  const cards = X.venues.map(venueCard).join("\n");
  const why = hb.why.points.map(([t, p], i) => `<div class="hstep"><span class="n">0${i + 1}</span><div><b>${esc(t)}</b><p>${esc(p)}</p></div></div>`).join("");
  const faqs = hb.questions.map(([q, a]) => `<div class="faq-i"><b>${esc(q)}</b><p>${esc(a)}</p></div>`).join("");
  const jsonld = [
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Golden Vacation & Travel", item: S.origin }, { "@type": "ListItem", position: 2, name: "Golden Experiences", item: `${S.origin}${BASE}/` }] },
    { "@context": "https://schema.org", "@type": "ItemList", name: "Golden Experiences in Jamaica", itemListElement: X.venues.map((v, i) => ({ "@type": "ListItem", position: i + 1, name: v.name, url: `${S.origin}${BASE}/${v.slug}` })) },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: hb.questions.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
  ];
  return `${head({ title: "Golden Experiences | Jamaica tours, day passes, boat days and airport lounges", description: "Day passes at Ocean and the Rose Hall resorts, JamWest and Mystic Mountain tours, the JamWest catamaran, Poko Loko floating bar and Club MoBay and Club Kingston lounges. Published prices in US$ and J$, resident rates where they exist, booked by people in Jamaica.", pathname: `${BASE}/`, image: heroImg, jsonld, bodyClass: "exp exp-hub" })}
${nav()}
<main>
<section class="hub-hero wrap">
  <div class="hub-hero-t">
    ${kicker(hb.kicker)}
    <h1 class="hh">${esc(hb.title)}</h1>
    <p>${longShort(hb.sub, hb.subMobile)}</p>
    <div class="chip-row hero-doors">${hb.doors.map((d) => `<button class="chip" type="button" data-door="${d.key}">${esc(d.title)}</button>`).join("")}</div>
  </div>
  <div class="mosaic" aria-hidden="false">
    <span class="mosaic-a">${pic(heroImg, "Riding the zipline at JamWest, Westmoreland", ' loading="eager" fetchpriority="high"')}</span>
    <span class="mosaic-b">${pic("jamcat-sunset-sail.jpg", "Sunset sail on the JamWest catamaran off Negril", ' loading="eager"')}</span>
    <span class="mosaic-c">${pic("ibwaves-beach-loungers.jpg", "The beach at Rose Hall, Montego Bay", ' loading="eager"')}</span>
  </div>
</section>
${ticker(hb.trust)}

<section class="doors-sec wrap" aria-label="Start here">
  ${kicker("Start here")}
  <div class="doors edoors">${doors}</div>
</section>

<section class="sec wrap cat-sec" id="all">
  <div class="sec-head cat-head">
    <div>${kicker("Jamaica · 12 tours")}<h2 class="hh">Pick a day out.</h2></div>
    <p class="sec-sub cat-note" id="cat-note">Every price is the published rate, in both currencies. Tap a tour for the options, what's included and what to know before you book.</p>
  </div>
  <div class="hotel-box" id="hotel-box">
    <div class="hotel-q">
      <label class="pf-f hotel-f"><span class="pf-l">Where are you staying?</span><span class="pf-in">${icon("pin", 18)}<input type="search" id="hotel-in" placeholder="Type your hotel or cruise port" autocomplete="off" aria-autocomplete="list" aria-controls="hotel-list"><button type="button" id="hotel-clear" aria-label="Clear hotel" hidden>${icon("x", 16, 2.6)}</button></span></label>
      <ul class="hotel-list" id="hotel-list" role="listbox" hidden></ul>
    </div>
    <div class="chip-row port-chips" id="port-chips" role="group" aria-label="Cruise ports"><span class="chips-l">Off a cruise ship?</span>${(X.ports || []).map((p) => `<button class="chip chip-sm" type="button" data-port="${p.slug}" aria-pressed="false">${esc(p.name.replace(" cruise port", " port"))}</button>`).join("")}</div>
    <div class="chip-row dist-chips" id="dist-chips" role="group" aria-label="How far" hidden>
      <button class="chip" type="button" data-max="30">Under 30 min</button>
      <button class="chip" type="button" data-max="60">Under 1 hour</button>
      <button class="chip" type="button" data-max="120">Under 2 hours</button>
      <button class="chip" type="button" data-max="0" aria-pressed="true">Anywhere</button>
    </div>
    <p class="pf-hint" id="hotel-note">Pick your hotel and every card shows the drive time from it, nearest first. Not staying yet? <a href="/hotel-status">See which resorts are open</a>.</p>
  </div>
  <div class="filters">
    <div class="chip-row cat-chips" role="group" aria-label="Category">${chips}</div>
    <label class="area-pick"><span>Where</span><select id="area-pick" aria-label="Area">${areaOpts}</select></label>
  </div>
  <div class="vgrid" id="vgrid">
${cards}
  </div>
  <div class="empty" id="vempty" hidden>
    <b>Nothing here fits that yet.</b>
    <p>We book more of this island than what's listed. Clear the filters, or tell us what you're after and we'll price it.</p>
    <div class="btns"><button class="btn btn-outline btn-sm" type="button" id="clear-filters">Clear filters</button>${btn("Ask on WhatsApp", waHome, "black", "sm", "chat")}</div>
  </div>
</section>

<section class="how-sec wrap" id="why">
  <div class="sec-head why-head"><div>${kicker(hb.why.kicker)}<h2 class="hh">${esc(hb.why.title)}</h2></div></div>
  <div class="hsteps four">${why}</div>
</section>

<section class="faqs wrap" id="questions">
  <div class="faq-grid">
    <div class="faq-side">${kicker("Questions")}<h2 class="hh">Before you book</h2><p class="sec-sub">Straight answers. If yours isn't here, ask on WhatsApp.</p>${btn("Ask on WhatsApp", waHome, "black", "", "chat")}</div>
    <div class="faq">${faqs}</div>
  </div>
</section>

<section class="cta-band">
  <div class="wrap cta-in">
    <div>${kicker("Not sure which one", true)}<h2 class="hh">Tell us the date, the group and the budget.</h2><p>We'll say which pass is worth it and which one isn't. ${esc(S.hours)}</p></div>
    <div class="cta-btns">${btn("WhatsApp us", waHome, "gold", "lg", "chat")}<a class="cta-call" href="tel:+1${S.phone.replace(/\D/g, "")}">Or call ${esc(S.phone)}</a></div>
  </div>
</section>
</main>
${footer()}
${scripts({ page: "hub", whatsapp: S.whatsapp, hotels: HOTELS.map((h) => [h.name, h.slug, h.region, h.lat, h.lng, h.port ? 1 : 0]), venues: venueDriveData, regions: X.regions, base: BASE, shipDay: SHIP_CFG })}
</body></html>`;
}

/* ---------- venue page ---------- */
function optionRow(v, p, i) {
  const attrs = [`data-id="${p.id}"`, p.until ? ` data-until="${p.until}"` : "", p.group ? ` data-group="${p.group}"` : ""].join("");
  const badge = p.badge ? `<span class="op-badge">${esc(p.badge)}</span>` : "";
  const notes = (p.notes || []).map((n) => `<li>${esc(noDash(n))}</li>`).join("");
  const choose = p.choose ? `<div class="op-choose" data-pick="${p.choose.pick}">${p.choose.fixed ? `<span class="fixed">${esc(p.choose.fixed)}<small>always in</small></span>` : ""}<span class="op-choose-l">${esc(p.choose.label)}${p.choose.pick > 1 ? ` (${p.choose.pick})` : ""}</span><span class="op-choose-c">${p.choose.from.map((c) => `<button type="button" class="chip" data-choice="${esc(c)}">${esc(c)}</button>`).join("")}</span></div>` : "";
  const times = p.times && p.times.length ? `<span class="op-times">${icon("clock", 14)}${esc(p.times.join(" · "))}</span>` : "";
  return `<label class="op"${attrs}>
    <input type="radio" name="product" value="${p.id}"${i === 0 ? " checked" : ""}>
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
  const date = isFlight
    ? `<div class="pf two"><label class="pf-f"><span class="pf-l" id="pf-date-l">Arrival date</span><span class="pf-in">${icon("calendar", 18)}<input type="date" id="pf-date" required></span></label><label class="pf-f" id="pf-date2-wrap"><span class="pf-l" id="pf-date2-l">Departure date</span><span class="pf-in">${icon("calendar", 18)}<input type="date" id="pf-date2"></span></label></div>
       <div class="pf two"><label class="pf-f" id="pf-flight-in-wrap"><span class="pf-l">Flight in</span><span class="pf-in">${icon("plane", 18)}<input type="text" id="pf-flight-in" placeholder="e.g. BA2263" autocapitalize="characters"></span></label><label class="pf-f" id="pf-flight-out-wrap"><span class="pf-l">Flight out</span><span class="pf-in">${icon("plane", 18)}<input type="text" id="pf-flight-out" placeholder="e.g. BA2262" autocapitalize="characters"></span></label></div>
       <p class="pf-hint" id="date-note" hidden></p>
       <p class="pf-hint">We check your flight and send the lounge details to your email and WhatsApp.</p>`
    : `<div class="pf"><label class="pf-f"><span class="pf-l">Date</span><span class="pf-in">${icon("calendar", 18)}<input type="date" id="pf-date" required></span></label><p class="pf-hint" id="date-note" hidden></p></div>`;
  const anyTimes = v.products.some((p) => p.times && p.times.length);
  const times = isTour || anyTimes ? `<div class="pf" id="pf-times-wrap"><span class="pf-l">${v.panel === "pass" ? "Entry time" : "Start time"}</span><div class="chip-row" id="pf-times"></div><p class="pf-hint" id="times-note" hidden></p></div>` : "";
  const guests = `<div class="pf pf-guests"><span class="pf-l">Guests</span>
      <div class="stepper"><span><b>Adults</b><small id="adult-unit"></small></span><span class="step-c"><button type="button" data-step="adults" data-d="-1" aria-label="Fewer adults">−</button><output id="adults">2</output><button type="button" data-step="adults" data-d="1" aria-label="More adults">+</button></span></div>
      <div class="stepper" id="child-step"><span><b>Children</b><small id="child-unit"></small></span><span class="step-c"><button type="button" data-step="children" data-d="-1" aria-label="Fewer children">−</button><output id="children">0</output><button type="button" data-step="children" data-d="1" aria-label="More children">+</button></span></div>
      <p class="pf-hint" id="child-note" hidden></p>
      <p class="pf-hint" id="guests-note" hidden>Up to 16 guests here. More than 16? <a href="mailto:${esc(S.email)}?subject=${encodeURIComponent(`Group booking: ${v.name}`)}">Email us</a> and we'll price it.</p>
    </div>`;
  /* pickup: the guest picks their hotel from the resort list (the area, and any transfer charge, follow from it);
     "somewhere else" opens a free-text line plus the area list; "my own way" skips pickup */
  const pickup = v.pickups ? `<div class="pf" id="pf-pickup-wrap">
      <div class="hotel-q pf-f"><span class="pf-l">Pickup from</span>
        <div class="chip-row pickup-alts"><button type="button" class="chip chip-sm" data-pick="ship" aria-pressed="false">Off a cruise ship</button><button type="button" class="chip chip-sm" data-pick="other" aria-pressed="false">Somewhere else</button><button type="button" class="chip chip-sm" data-pick="own" aria-pressed="false">I'll make my own way</button></div>
        <label class="pf-f hotel-f"><span class="pf-in">${icon("pin", 18)}<input type="search" id="pf-hotel-in" placeholder="Type your hotel or cruise port" autocomplete="off" autocapitalize="words" aria-label="Pickup hotel or cruise port"></span></label><ul class="hotel-list" id="pf-hotel-list" role="listbox" hidden></ul></div>
      <label class="pf-f" id="pf-pickup-other-wrap" hidden><span class="pf-in">${icon("pin", 18)}<input type="text" id="pf-pickup-hotel" placeholder="Villa, Airbnb or hotel name" autocomplete="off"></span></label>
      <label class="pf-f" id="pf-pickup-area-wrap" hidden><span class="pf-l">Pickup area</span><span class="pf-in">${icon("car", 18)}<select id="pf-pickup">${v.pickups.filter((p) => p.key !== "own").map((p) => `<option value="${p.key}" data-add="${p.add || 0}" data-add-child="${p.addChild != null ? p.addChild : p.add || 0}">${esc(p.label)}${p.request ? " (priced by hand)" : p.add ? ` (+${usd(p.add)} each)` : ""}</option>`).join("")}</select></span></label>
      <p class="pf-hint" id="pickup-note">${v.pickups.some((p) => p.add) ? "Pickup from Negril hotels is included. Lucea and Montego Bay pickups are priced per person." : "Hotel pickup from Negril and Montego Bay is included."}</p>
    </div>` : "";
  /* ship day: shown once we know the guest is off a ship (a port picked here or on the hub, or a ship name typed). Sits outside the contact block, which hides on the WhatsApp path */
  const cruisePick = v.panel === "flight" || v.pickups ? "" : `<div class="pf" id="pf-cruise-wrap"><span class="pf-l">Off a cruise ship?</span><div class="chip-row port-chips" id="pf-ports">${(X.ports || []).map((pt) => `<button type="button" class="chip chip-sm" data-port="${pt.slug}" aria-pressed="false">${esc(pt.name.replace(" cruise port", " port"))}</button>`).join("")}</div></div>`;
  const aboard = v.panel === "flight" ? "" : `${cruisePick}<div class="pf" id="pf-aboard-wrap" hidden><span class="pf-l">All-aboard time</span><div class="chip-row aboard-chips" id="pf-aboard">${[["", "Not sure"], ["960", "4:00pm"], ["1020", "5:00pm"], ["1080", "6:00pm"], ["1140", "7:00pm or later"]].map(([m, l]) => `<button type="button" class="chip chip-sm" data-aboard="${m}" aria-pressed="${m === "" ? "true" : "false"}">${l}</button>`).join("")}</div><p class="pf-hint" id="ship-note"></p><button type="button" class="link-btn" id="ship-clear">Not off a ship today? Clear this</button></div>`;
  const contact = `<div class="pf pf-contact" id="pf-contact"${instant ? "" : " hidden"}><span class="pf-l">Who's booking</span>
      <div class="pf two"><label class="pf-f"><span class="pf-in"><input type="text" id="pf-first" placeholder="First name" autocomplete="given-name"></span></label><label class="pf-f"><span class="pf-in"><input type="text" id="pf-last" placeholder="Last name" autocomplete="family-name"></span></label></div>
      <label class="pf-f"><span class="pf-in"><input type="email" id="pf-email" placeholder="Email for the confirmation" autocomplete="email"></span></label>
      <label class="pf-f"><span class="pf-in"><input type="tel" id="pf-phone" placeholder="WhatsApp or phone" autocomplete="tel"></span></label>
      <label class="pf-f" id="pf-ship-wrap"><span class="pf-in">${icon("ship", 18)}<input type="text" id="pf-ship" placeholder="On a cruise? Ship name"></span></label>
    </div>`;
  return `<aside class="panel" id="panel" data-panel="${v.panel}" data-booking="${v.booking}">
    <div class="panel-head">${kicker(instant ? "Book on the spot" : v.booking === "request" ? "Request a date" : "Send an enquiry")}<div class="panel-total"><b id="total-lead">${usd(0)}</b><small id="total-sub"></small></div><p class="panel-caption" id="total-caption"></p></div>
    <form id="book" novalidate>
      ${rate}
      ${date}
      ${times}
      ${guests}
      ${pickup}
      ${aboard}
      ${contact}
      <div class="pf pf-preview" id="pf-preview"${instant ? " hidden" : ""}><span class="pf-l">This is what we'll get</span><pre id="msg-preview"></pre></div>
      <button class="btn btn-black btn-lg btn-full" type="submit" id="cta">${instant ? icon("card", 18) : icon("chat", 18)}<span id="cta-label">${cta}</span></button>
      <p class="pf-sub" id="cta-sub">${ctaSub}</p>
      <p class="pf-alt" id="cta-alt"${instant ? "" : " hidden"}>Rather talk to a person first? <a href="#" id="cta-wa">Send this as a WhatsApp request instead</a>.</p>
      <p class="pf-fine">Nothing is charged until you see the total. Tax and service included. A person reads every request.</p>
    </form>
  </aside>`;
}

function venuePage(v) {
  const hero = v.photos[0];
  const gallery = v.photos.slice(1, 5).map((p) => `<span class="gph">${pic(small(p.file), p.alt)}</span>`).join("");
  const groups = v.groups ? v.groups : [{ key: "all", label: "", sub: "" }];
  const options = groups.map((g) => {
    const ps = v.products.filter((p) => (g.key === "all" || p.group === g.key));
    const rows = ps.map((p, i) => optionRow(v, p, i === 0 && g === groups[0])).join("\n");
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
    hotels: HOTELS.map((h) => [h.name, h.slug, h.region, h.lat, h.lng, h.port ? 1 : 0]), regions: X.regions, shipDay: SHIP_CFG,
    venue: { slug: v.slug, name: v.name, panel: v.panel, booking: v.booking, calendar: v.calendar || null, area: AREAS[v.area], adultsOnly: !!v.adultsOnly, blackout: v.blackout || [], closedWeekdays: v.closedWeekdays || [], rates: v.rates || null, pickups: v.pickups || null, lat: v.lat, lng: v.lng, drive: v.drive || {}, sd: v.shipDay === false ? 0 : 1,
      products: v.products.filter(live).map((p) => ({ id: p.id, name: p.name, hours: p.hours, times: p.times || [], audience: p.audience, visitor: p.visitor || null, resident: p.resident || null, perParty: p.perParty || 0, choose: p.choose || null, legs: p.legs || null, request: !!p.request, until: p.until || null, sd: shipDayOf(p, v) })) },
  };
  const title = `${v.name} | ${v.categories.map((c) => CATS[c]).join(", ")} in ${AREAS[v.area]}, Jamaica`;
  return `${head({ title, description: `${v.blurb} ${fromPrice(v) && fromPrice(v).usd != null ? `From ${usd(fromPrice(v).usd)} per person.` : ""} Published prices in US$ and J$, booked by Golden Vacation & Travel, St Ann, Jamaica.`, pathname: `${BASE}/${v.slug}`, image: hero.file, jsonld, bodyClass: "exp exp-venue" })}
${nav()}
<main class="venue" data-venue="${v.slug}">
<nav class="crumbs wrap" aria-label="Breadcrumb"><a href="${BASE}/">Golden Experiences</a><span>/</span><span>${esc(v.short)}</span></nav>
<section class="vhero wrap">
  <div class="vhero-photo">${pic(hero.file, hero.alt, ' loading="eager" fetchpriority="high"')}<div class="hero-tags">${v.tags.slice(0, 1).map((t) => tag(t, "white")).join("")}</div></div>
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
      <div class="sec-head"><div><h2 class="hh">Choose your ${esc(v.optionNoun)}</h2>${v.rates ? `<p class="sec-sub">Two rates, both printed. Visitor rate: ${esc(noDash(v.rates.visitor.note))} Resident rate: ${esc(noDash(v.rates.resident.note))}</p>` : ""}</div></div>
      <div class="ops" id="ops">
${options}
      </div>
    </div>
    ${enquiries}
    <div class="info-grid">
      ${listBlock("What's included", v.included, "check", "inc")}
      ${listBlock("Not included", v.notIncluded, "x", "exc")}
      ${listBlock("Before you book", v.before, "alert", "warn")}
      ${listBlock("Getting there", v.gettingThere, "pin", "go")}
    </div>
    ${often ? `<div class="often"><div class="sec-head"><b class="hh">Often booked with this</b><small>Only if it helps</small></div><div class="pairs">${often}</div></div>` : ""}
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

/* ---------- near-hotel pages ---------- */
function nearPage(h) {
  const rows = X.venues.map((v) => ({ v, min: driveMin(h, v) })).filter((r) => r.min != null && r.v.slug !== "club-kingston" && !(h.port && r.v.shipDay === false)).sort((a, b) => a.min - b.min);
  const nearest = rows[0];
  /* on a port page every tour is sorted into a ship-day tier: fits, a long day (we check it first), or not on a ship day */
  const tierOf = (v, min) => !h.port ? "ok" : (shipTier(v, min) === "no" ? "no" : !venueShipOk(v, min) ? "no" : shipTier(v, min));
  const hero = (h.port ? (rows.find((r) => tierOf(r.v, r.min) === "ok") || nearest) : nearest).v.photos[0];
  const region = X.regions[h.region];
  const row = ({ v, min }) => {
    const fp = fromPrice(v);
    const price = fp ? (fp.usd != null ? `<b>${dual(fp.usd)}</b><small>${fp.same ? "per person" : "from"}</small>` : `<b>${jmd(fp.jmd)}</b><small>${fp.same ? "per person" : "from"}</small>`) : "<b>Price on request</b>";
    const n = v.products.filter(live).length;
    const tier = tierOf(v, min);
    const works = tier === "no" && h.port ? portsThatWork(v)[0] : null;
    const driveLine = tier === "no" ? (shipTier(v, min) !== "no" ? `Not on a ship day: ${v.shipDayNote || "runs in the evening"}` : `Not on a ship day: ${driveLabel(min)} each way${works ? `. Works from ${works.pt.name}, ${driveLabel(works.min)}` : ""}`) : tier === "ask" ? `A long day from the pier, ${driveLabel(min)} each way. Ask us first` : `${driveLabel(min)} from ${h.name}`;
    return `<a class="nrow${tier === "no" ? " nrow-off" : ""}" href="${BASE}/${v.slug}${h.port ? `?hotel=${h.slug}` : ""}">
      <span class="nrow-img">${pic(small(v.photos[0].file), v.photos[0].alt)}</span>
      <span class="nrow-t"><span class="nrow-drive${tier === "no" ? " off" : tier === "ask" ? " ask" : ""}">${esc(driveLine)}</span><b>${esc(v.name)}</b><small>${esc(v.card)}</small><span class="vcard-meta">${n} ${n === 1 ? "option" : "options"} · ${v.categories.map((c) => esc(CATS[c])).join(" · ")}</span></span>
      <span class="nrow-p">${price}</span>${icon("arrow", 18, 2.4)}</a>`;
  };
  const fits = rows.filter((r) => tierOf(r.v, r.min) === "ok"), longDay = rows.filter((r) => tierOf(r.v, r.min) === "ask"), notShip = rows.filter((r) => tierOf(r.v, r.min) === "no");
  const list = h.port
    ? `${fits.map(row).join("\n")}${longDay.length ? `<div class="near-group"><b>A long day from the pier</b><small>${longDay.length === 1 ? "This one is" : "These are"} ${driveLabel(SHIP.okDrive)} to ${driveLabel(SHIP.askDrive)} each way. Send the request and we check it against your all-aboard time before anything is charged.</small></div>${longDay.map(row).join("\n")}` : ""}${notShip.length ? `<div class="near-group"><b>Not on a ship day from ${esc(h.name)}</b><small>Too far for the hours in port, or an evening thing. Each one says which port it works from.</small></div>${notShip.map(row).join("\n")}` : ""}`
    : rows.map(row).join("\n");
  const waText = h.port ? `Hi Golden Vacation! We're in port at ${h.name} for the day and we'd like a day out. Ref GV-EXP-PORT` : `Hi Golden Vacation! We're staying at ${h.name} and we'd like to add a day out. Ref GV-EXP-NEAR`;
  const under = (m) => rows.filter((r) => r.min <= m).length;
  const jsonld = [
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Golden Vacation & Travel", item: S.origin }, { "@type": "ListItem", position: 2, name: "Golden Experiences", item: `${S.origin}${BASE}/` }, { "@type": "ListItem", position: 3, name: `Near ${h.name}`, item: `${S.origin}${BASE}/near/${h.slug}` }] },
    { "@context": "https://schema.org", "@type": "ItemList", name: `Things to do ${h.port ? "from" : "near"} ${h.name}`, itemListElement: (h.port ? fits.concat(longDay) : rows).map(({ v }, i) => ({ "@type": "ListItem", position: i + 1, name: v.name, url: `${S.origin}${BASE}/${v.slug}` })) },
  ];
  const title = h.port ? `Things to do from ${h.name} | tours, day passes and boat days for your ship day, with drive times` : `Things to do near ${h.name} | day passes, tours and boat days with drive times`;
  const desc = h.port ? `${fits.length} days out that fit a ship day from ${h.name}: ${fits.slice(0, 3).map((r) => r.v.short).join(", ")} and more, timed to your all-aboard. Published prices in US$, port pickup where it runs, booked by Golden Vacation & Travel in Jamaica.` : `${under(60)} days out under an hour from ${h.name}, ${region.label}: ${rows.slice(0, 3).map((r) => r.v.short).join(", ")} and more. Published prices in US$ and J$, hotel pickup where it runs, booked by Golden Vacation & Travel in Jamaica.`;
  return `${head({ title, description: desc, pathname: `${BASE}/near/${h.slug}`, image: hero.file, jsonld, bodyClass: "exp exp-near" })}
${nav()}
<main class="near wrap" data-hotel="${h.slug}">
<nav class="crumbs" aria-label="Breadcrumb"><a href="${BASE}/">Golden Experiences</a><span>/</span><span>${h.port ? "From" : "Near"} ${esc(h.name)}</span></nav>
<section class="near-hero">
  <div class="near-t">
    ${kicker(h.area || region.label)}
    <h1 class="hh">${h.port ? `In port for the day? Things to do from ${esc(h.name)}.` : `Things to do near ${esc(h.name)}.`}</h1>
    <p class="lead">${h.port ? `${fits.length} fit a ship day${longDay.length ? `, ${longDay.length} ${longDay.length === 1 ? "is" : "are"} a long day we check first` : ""}${notShip.length ? `, ${notShip.length} ${notShip.length === 1 ? "doesn't" : "don't"} fit` : ""}. ${esc(h.note || "")} We plan to have you back at the pier by ${esc(SHIP.backBy)}, or an hour before the all-aboard time you give us. Every price is the published rate, and we say when pickup runs from the pier and when it doesn't.` : `${under(30) ? `${under(30)} within half an hour, ` : ""}${under(60)} under an hour, ${rows.length} worth the drive. Every price is the published rate, both currencies, and we say when hotel pickup runs from ${esc(h.name)} and when it doesn't.`}</p>
    <div class="near-btns">${btn(h.port ? "Plan my ship day" : "Add a day out to my stay", wa(waText), "black", "", "chat")}${btn(h.port ? "Browse from this port" : "Browse with my hotel set", `${BASE}/?hotel=${h.slug}`, "outline", "", "arrow")}</div>
    <p class="pf-hint">${esc(X.driveNote.split(".")[0])}. Traffic and the road decide the rest.</p>
  </div>
  <div class="near-photo">${pic(hero.file, hero.alt, ' loading="eager"')}<div class="hero-tags">${tag(`Nearest: ${(h.port && fits[0] ? fits[0] : nearest).v.short}, ${driveLabel((h.port && fits[0] ? fits[0] : nearest).min)}`, "gold")}</div></div>
</section>
<section class="near-list">${list}</section>
<section class="near-foot">
  <div class="sec-head"><div>${kicker("Also from here")}<h2 class="hh">Airport, transfers and the room itself.</h2></div></div>
  <div class="near-links">
    <a class="pair" href="${BASE}/club-mobay"><span class="pair-t"><b>Club MoBay</b><small>Fast track and lounge at Montego Bay airport, timed to your flight</small></span>${icon("arrow", 18, 2.4)}</a>
    ${h.port ? `<a class="pair" href="${BASE}/#port"><span class="pair-t"><b>In port for the day</b><small>Every day out that fits a ship day, nearest ports first</small></span>${icon("arrow", 18, 2.4)}</a>` : `<a class="pair" href="/hotel-status"><span class="pair-t"><b>Is ${esc(h.name)} open?</b><small>What's open, reopening and closed across the island, updated from the hotels</small></span>${icon("arrow", 18, 2.4)}</a>`}
    <a class="pair" href="${wa(`Hi Golden Vacation! I'd like a quote for a stay at ${h.name} with a day out added. Ref GV-EXP-STAY`)}"><span class="pair-t"><b>Bed and tours, one quote</b><small>Staying with us? We price the room and the day out together</small></span>${icon("chat", 18, 2.4)}</a>
  </div>
</section>
</main>
${footer()}
${scripts({ page: "near", whatsapp: S.whatsapp, hotel: h.slug })}
</body></html>`;
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

/* ---------- write ---------- */
const pages = [
  ["public/experiences/index.html", hubPage(), "hub"],
  ...X.venues.map((v) => [`public/experiences/${v.slug}.html`, venuePage(v), v.slug]),
  ["public/experiences/booked.html", bookedPage(), "booked"],
  ...(BUNDLE ? [["public/experiences/booked-team.html", bookedPage("team"), "booked-team"]] : []),
  ...(BUNDLE ? HOTELS.filter((h) => /RIU Ocho Rios|Iberostar Waves Rose Hall|Royalton Negril|Falmouth cruise port/.test(h.name)) : HOTELS).map((h) => [`public/experiences/near/${h.slug}.html`, nearPage(h), `near-${h.slug}`]),
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
  /* sitemap: the section's indexable pages, replacing any earlier experiences entries */
  const smPath = path.join(ROOT, "public/sitemap.xml");
  if (fs.existsSync(smPath)) {
    const urls = [[`${BASE}/`, "0.8"], ...X.venues.map((v) => [`${BASE}/${v.slug}`, "0.7"]), ...HOTELS.map((h) => [`${BASE}/near/${h.slug}`, "0.6"])];
    const entries = urls.map(([u, pr]) => `<url>\n  <loc>${S.origin}${u}</loc>\n  <lastmod>${TODAY}T00:00:00+00:00</lastmod>\n  <priority>${pr}</priority>\n</url>`).join("\n\n");
    let sm = fs.readFileSync(smPath, "utf8").replace(/\n*<!-- experiences -->[\s\S]*?<!-- \/experiences -->\n*/, "\n");
    sm = sm.replace(/\s*<\/urlset>\s*$/, `\n\n<!-- experiences -->\n${entries}\n<!-- /experiences -->\n\n</urlset>\n`);
    fs.writeFileSync(smPath, sm);
    console.log("sitemap:", urls.length, "experiences urls");
  }
  const missing = [...usedImages].filter((f) => !fs.existsSync(path.join(IMG_DIR, f)));
  if (missing.length) console.warn("MISSING IMAGES:", missing.join(", "));
  const expired = X.venues.flatMap((v) => v.products.filter((p) => !live(p)).map((p) => `${v.slug}/${p.id}`));
  if (expired.length) console.log("expired, left out:", expired.join(", "));
} else {
  /* one file, every page inside, a hash router switches between them; images inline (card size where one exists) */
  const css = ["public/getaways/assets/getaways.css", "public/assets/home.css", "public/assets/experiences.css"].map((f) => fs.readFileSync(path.join(ROOT, f), "utf8")).join("\n");
  const js = ["public/getaways/assets/getaways.js", "public/assets/home.js", "public/assets/experiences.js"].map((f) => fs.readFileSync(path.join(ROOT, f), "utf8")).join("\n");
  const stripHead = (html) => html.replace(/^[\s\S]*?<body[^>]*>/, "").replace(/<\/body><\/html>\s*$/, "");
  const cfgOf = (html) => { const m = html.match(/<script>window\.GV_EXP=(\{[\s\S]*?\});<\/script>/); return m ? m[1] : "{}"; };
  const bodyClassOf = (html) => { const m = html.match(/<body class="([^"]*)"/); return m ? m[1] : ""; };
  const sections = pages.map(([rel, html, key]) => {
    let inner = stripHead(html).replace(/<script>window\.GV_EXP=[\s\S]*?<\/script>\s*/, "").replace(/<script src="[^"]*" defer><\/script>\s*/g, "");
    return `<section class="pv-page" id="pv-${key}" data-body="${bodyClassOf(html)}" data-cfg='${cfgOf(html).replace(/'/g, "&#39;")}' hidden>${inner}</section>`;
  }).join("\n");
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Golden Experiences preview</title>
<meta name="robots" content="noindex,nofollow">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100,400;100,500;100,600;100,700;110,800;110,900&display=swap">
<style>${css}
.pv-bar{position:sticky;top:0;z-index:50;display:flex;gap:10px;align-items:center;padding:8px 14px;background:#F2B93B;color:#0E0F0E;font:800 13px/1.2 Archivo,system-ui,sans-serif}
.pv-bar select{font:inherit;padding:6px 8px;border-radius:8px;border:2px solid #0E0F0E;background:#fff;max-width:60vw}
.pv-bar span{opacity:.75;font-weight:600}</style>
<script>window.GV_CONFIG=${JSON.stringify({ base: BASE, whatsapp: S.whatsapp, jmdRate: S.jmdRate, preview: true })};</script>
</head>
<body class="exp">
<div class="pv-bar"><b>PREVIEW</b><select id="pv-pick" aria-label="Page">${pages.map(([, , key]) => `<option value="${key}">${key === "hub" ? "Experiences hub" : key === "booked" ? "After paying (JamWest)" : key === "booked-team" ? "After paying (other tours)" : key.startsWith("near-") ? (HOTELS.find((h) => h.slug === key.slice(5)).port ? "From " : "Near ") + HOTELS.find((h) => h.slug === key.slice(5)).name : venueBySlug[key].name}</option>`).join("")}</select><span>Nothing here is live. Site links open goldenvacays.com in a new tab.</span></div>
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
    var m=h.match(/^\\/experiences\\/(near\\/)?([a-z0-9-]+)\\/?(\\?[^#]*)?(#.*)?$/); if(h.indexOf('/experiences/')===0&&!m){e.preventDefault();location.hash='#hub';return;}
    if(m){var key=(m[1]?'near-':'')+m[2]; if(document.getElementById('pv-'+key)){e.preventDefault();location.hash='#'+key;return;} if(m[1]){a.setAttribute('target','_blank');a.href='${S.origin}'+h;return;} e.preventDefault();location.hash='#hub';return;}
    if(h.charAt(0)==='/'){a.setAttribute('target','_blank');a.href='${S.origin}'+h;}
  });
  show((location.hash||'#hub').slice(1));
})();
</script>
</body></html>`;
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
  if (ARTIFACT) out = html.replace(/^<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n/, "").replace(/<\/head>\n<body class="exp">/, '<div class="exp">').replace(/<\/body><\/html>$/, "</div>");
  fs.writeFileSync(BUNDLE, out);
  console.log("wrote", BUNDLE, `${(out.length / 1024).toFixed(0)}K`);
}

#!/usr/bin/env node
/*
  Airport transfers: private rides from Montego Bay (MBJ), Kingston (KIN) and Ocho Rios (OCJ) airport to every resort on the island,
  and hotel to hotel. Search first (hotel, airport, way, people, dates), then a table of vehicles with a price each, then Choose and pay.

  Reads data/transfers.json (copy, zones, drive times) and data/transfer-rates.json (prices, from Hana's rate sheet) and writes:
    public/transfers/index.html               the page, served at /transfers
    public/transfers/booked.html              the page a guest lands on after paying, served at /transfers/booked
    public/assets/transfers-rates.js          the prices as a script the page loads (window.GV_TR_RATES)
    netlify/functions/_tr-data.mjs            the same prices as a module for the checkout function (recomputed server-side)
  Same shape as the Experiences section: flat files, Bold design, getaways.css (tokens) + home.css + experiences.css (components)
  + /assets/transfers.css and transfers.js for the search bar, the results table and the checkout.
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
import { islandSvg, jpegSize } from "./lib-island.mjs";

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
const HOTELS = RESORTS.filter((r) => r.status !== "Permanently closed" && r.lat && r.lng)
  .map((r) => ({ name: r.name, slug: slugify(r.name), zone: RATE_KEY_BY_NAME[r.name] ? R.hotels[RATE_KEY_BY_NAME[r.name]].zone : zoneOf(r), rate: RATE_KEY_BY_NAME[r.name] || null }))
  .filter((h) => h.zone)
  .concat(T.zones.flatMap((z) => (z.places || []).filter((name) => !RESORTS.some((r) => r.name === name || slugify(r.name) === slugify(name))).map((name) => ({ name, slug: slugify(name), zone: z.key, rate: RATE_KEY_BY_NAME[name] || null }))))
  .sort((a, b) => a.name.localeCompare(b.name));
if (args.includes("--zones")) {
  for (const h of HOTELS) console.log(`${h.name.padEnd(46)} ${h.zone.padEnd(12)} ${h.rate ? "sheet: " + R.hotels[h.rate].name : "zone fallback"}`);
  const unmatched = Object.values(R.hotels).flatMap((h) => h.matches.filter((n) => !RESORTS.some((r) => r.name === n)));
  if (unmatched.length) console.log("\nsheet names that match no resort:", unmatched.join(", "));
  process.exit(0);
}
/* the cheapest one-way car price on the page, for the meta description */
const fromPrice = () => { const ps = Object.values(R.rates).flatMap((a) => Object.values(a)).flatMap((t) => t.in || []).filter((o) => o[0] === "car").map((o) => o[3]); return ps.length ? Math.min(...ps) : null; };
/* Club MoBay and Club Kingston prices from the tours data, so the cards never drift */
const loungePrice = (slug) => { const v = X.venues.find((v) => v.slug === slug); if (!v) return ""; const ps = v.products.filter((p) => p.visitor).map((p) => p.visitor.usd); return ps.length ? `from ${usd(Math.min(...ps))}` : ""; };

/* ---------- chrome (same as the Experiences section) ---------- */
function head({ title, description, pathname, image, jsonld = [], noindex = false, bodyClass = "" }) {
  const url = `${S.origin}${pathname}`;
  const og = `${S.origin}${image ? img(image) : `${IMG}/${H.meta.ogImage}`}`;
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

const scripts = (cfg, withRates) => `<script>window.GV_TR=${JSON.stringify(cfg)};</script>
<script src="/getaways/assets/getaways.js" defer></script>
<script src="/assets/home.js" defer></script>
${withRates ? `<script src="${ASSETS}/transfers-rates.js?v=${RATES_STAMP}" defer></script>\n` : ""}<script src="${ASSETS}/transfers.js?v=${STAMP}" defer></script>`;

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
    hotels: HOTELS.map((h) => [h.name, h.slug, h.zone, h.rate || ""]),
    zones: T.zones.map((z) => ({ key: z.key, name: z.name, airbnb: z.airbnbLabel, aliases: z.aliases || [] })),
    airports: T.airports, trips: T.trips, vehicles: T.vehicles, includes: T.includes, drive: T.drive, copy: { results: RS, checkout: CK, search: SR },
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

<section class="tr-checkout wrap" id="checkout" hidden>
  <div class="ck-card">
    <div class="ck-sum" id="ck-sum"></div>
    <form id="book" novalidate>
      <div class="ck-head">${kicker(CK.kicker)}<h2 class="hh">${esc(CK.title)}</h2></div>
      <div class="pf two"><label class="pf-f"><span class="pf-in"><input type="text" id="pf-first" placeholder="First name" autocomplete="given-name"></span></label><label class="pf-f"><span class="pf-in"><input type="text" id="pf-last" placeholder="Last name" autocomplete="family-name"></span></label></div>
      <div class="pf two"><label class="pf-f"><span class="pf-in"><input type="email" id="pf-email" placeholder="Email for the confirmation" autocomplete="email"></span></label><label class="pf-f"><span class="pf-in"><input type="tel" id="pf-phone" placeholder="WhatsApp or phone" autocomplete="tel"></span></label></div>
      <label class="pf-f"><span class="pf-in"><input type="text" id="pf-note" placeholder="Anything for the driver? Child seat, a stop, a lot of bags" autocomplete="off" maxlength="200"></span></label>
      <div class="pf pf-preview" id="pf-preview" hidden><span class="pf-l">This is what we'll get</span><pre id="msg-preview"></pre></div>
      <button class="btn btn-black btn-lg btn-full" type="submit" id="cta">${icon("card", 18)}<span id="cta-label">${esc(CK.cta)}</span></button>
      <p class="pf-sub" id="cta-sub">${esc(CK.ctaSub)}</p>
      <p class="pf-alt" id="cta-alt">${esc(CK.alt)} <a href="#" id="cta-wa">${esc(CK.altLink)}</a>.</p>
      <p class="pf-fine">${esc(CK.fine)}</p>
    </form>
  </div>
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
</main>
${footer()}
${scripts({ page: "booked", whatsapp: S.whatsapp, base: BASE, ...(previewState ? { previewState } : {}) }, false)}
</body></html>`;
}

/* ---------- write ---------- */
const pages = [
  ["public/transfers/index.html", transfersPage(), "transfers"],
  ["public/transfers/booked.html", bookedPage(), "booked"],
];
const ratesPublic = { hotels: Object.fromEntries(Object.entries(R.hotels).map(([k, h]) => [k, { name: h.name, zone: h.zone }])), rates: R.rates, zones: R.zones };
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
  const dataModule = `/* Generated by scripts/build-transfers.mjs from data/transfers.json and data/transfer-rates.json. Do not edit by hand. Customer prices only. */
export const TR = ${JSON.stringify({ airports: T.airports, trips: T.trips, vehicles: T.vehicles, maxGuests: T.site.maxGuests, zones: T.zones.map((z) => ({ key: z.key, name: z.name })), hotels: ratesPublic.hotels, rates: R.rates, zoneRates: R.zones, hotelKeys: Object.fromEntries(HOTELS.map((h) => [h.slug, { name: h.name, zone: h.zone, rate: h.rate || "" }])) })};
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
<div class="pv-bar"><b>PREVIEW</b><select id="pv-pick" aria-label="Page"><option value="transfers">Airport transfers</option><option value="booked-team">After paying</option></select><span>${esc(NOTE || "Nothing here is live. Site links open goldenvacays.com in a new tab.")}</span></div>
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

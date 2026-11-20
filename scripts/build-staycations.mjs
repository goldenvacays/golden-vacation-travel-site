/* Builds /resorts/ (hub) and /resorts/<slug>/ from data/staycations-resorts.json and data/staycations-photos.json.
   node scripts/build-staycations.mjs */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as F from "./lib-resort-facts.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const R = JSON.parse(fs.readFileSync(path.join(ROOT, "data/staycations-resorts.json"), "utf8"));
const P = JSON.parse(fs.readFileSync(path.join(ROOT, "data/staycations-photos.json"), "utf8"));
const S = JSON.parse(fs.readFileSync(path.join(ROOT, "data/getaways.json"), "utf8")).site;
const BASE = "/resorts";
const IMG = `${BASE}/img`;
const EMAIL = "goldentravellers@outlook.com";
const WHATSAPP = "18763601567";
const TURNAROUND = "10 minutes";
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const phoneDisplay = S.phone.replace(/-/g, " ");

const ICON = {
  arrow: '<path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path>',
  check: '<path d="M20 6 9 17l-5-5"></path>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"></path>',
  pin: '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"></path><circle cx="12" cy="10" r="2.5"></circle>',
  users: '<circle cx="9" cy="8" r="3.5"></circle><path d="M2.5 20a6.5 6.5 0 0 1 13 0"></path><circle cx="17" cy="9" r="2.5"></circle><path d="M16 15.5a5 5 0 0 1 5.5 4.5"></path>',
  bed: '<path d="M3 18V9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v9"></path><path d="M3 13h18"></path><path d="M7 7v6M3 18v2M21 18v2"></path>',
  car: '<path d="M5 17h14l1-6-2-5H6L4 11l1 6Z"></path><circle cx="8" cy="17" r="1.5"></circle><circle cx="16" cy="17" r="1.5"></circle>',
  plate: '<circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="4"></circle>',
  wa: '<path d="M20.5 3.5A11 11 0 0 0 3.2 16.8L2 22l5.3-1.4A11 11 0 1 0 20.5 3.5Z"></path><path d="M8.5 9.5c.3 2.6 2.4 4.7 5 5l1.6-1.2 2 .9-.2 1.6c-.6.6-1.6.9-2.5.6-3.4-1-6-3.6-7-7-.3-.9 0-1.9.6-2.5l1.6-.2.9 2-1 1.8Z"></path>',
};
const icon = (n, size = 16, sw = 2.4, color = "currentColor") => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;
const check = () => icon("check", 16, 3, "#1F8A4C");
const pic = (name, alt, widths, sizes, lazy = true, cls = "") => {
  const set = (ext) => widths.map((w) => `${IMG}/${name}-${w}.${ext} ${w}w`).join(", ");
  return `<picture${cls ? ` class="${cls}"` : ""}><source type="image/webp" srcset="${set("webp")}" sizes="${sizes}"><img src="${IMG}/${name}-${widths[0]}.jpg" srcset="${set("jpg")}" sizes="${sizes}" alt="${esc(alt)}"${lazy ? ' loading="lazy" decoding="async"' : ' fetchpriority="high"'}></picture>`;
};
const list = (s) => String(s || "").split(/,(?![^()]*\))|;/).map((x) => x.trim().replace(/\.$/, "")).filter(Boolean);
const noCount = (s) => String(s || "").replace(/\b\d+ rooms?\.\s*/g, "").replace(/^\s*[,.]\s*/, "").trim();
const noSqm = (s) => String(s || "").replace(/\s*\d+(\.\d+)?\s*sq m( plus [a-z ,]+)?/gi, "").replace(/\(\s*\)/g, "").replace(/(RIU )?[Cc]ode [A-Z0-9]{4}[.,]?\s*/g, "").replace(/\s{2,}/g, " ").replace(/^\s*[,.]\s*/, "").replace(/\s+\./g, ".").trim();
/* beds: the generic type only, never the dimensions. A width decides the type: 180 cm and up king, 140 to 179 double, under 140 twin. */
const bedText = (s) => { let t = String(s || "").replace(/\s*cm\b/gi, ""); t = t.replace(/(\d+)\s*beds?\s+(\d{2,3})\s*x\s*\d{2,3}/gi, (m, n, w) => { const k = +w >= 180 ? "king" : +w >= 140 ? "double" : "twin"; return `${n} ${k} bed${+n === 1 ? "" : "s"}`; }); return t.replace(/\s{2,}/g, " ").trim(); };
/* occupancy: the sheet's Occupancy words ("3 adults and 1 child", "3 adults, or 2 adults and 2 children") drawn as figures, one line per way to fill the room; without them, Sleeps. */
const occ = (r, x) => {
  const S = Number(x.sleeps) || 0;
  let alts = [];
  if (x.occupancy) alts = String(x.occupancy).split(/,?\s+or\s+/i).map((a) => { const ad = /(\d+)\s*adult/i.exec(a), ch = /(\d+)\s*child/i.exec(a); return { a: ad ? +ad[1] : 0, k: ch ? +ch[1] : 0, text: a.trim() }; });
  else if (S) alts = [{ a: S, k: 0, text: r.adultsOnly || S <= 2 ? `${S} adult${S === 1 ? "" : "s"}` : `Up to ${S}` }];
  if (!alts.length) return { html: `<span class="small">Ask us</span>`, data: "" };
  const fig = (a, k) => `<span class="pax" aria-hidden="true">${'<i class="pa"></i>'.repeat(Math.min(6, a))}${'<i class="pc"></i>'.repeat(Math.min(4, k))}</span>`;
  return { html: alts.map((o, i) => `<span class="occ-line">${fig(o.a, o.k)}<span class="small">${i ? "or " : ""}${esc(o.text)}</span></span>`).join("") + `<span class="av-fit" hidden></span>`, data: alts.map((o) => `${o.a}+${o.k}`).join("|") };
};
/* the from-price: the sheet's "From price" row, US$ per person per night, double occupancy */
const usd = (n) => `US$${Number(n).toLocaleString("en-US")}`;
const shortDrive = (s) => String(s || "").replace(/^About\s+/i, "").replace(/(\d+)\s*hours?\s+(\d+)\s*minutes?/i, "$1 h $2").replace(/(\d+)\s*hours?/i, "$1 h").replace(/(\d+)\s*minutes?/i, "$1 min");
/* meta description: the one-line intro when it fits, else a short fixed pattern, always under 160 characters */
const metaDesc = (r) => { const tail = `${r.fromUsd ? ` From ${usd(r.fromUsd)} per person per night.` : ""}${r.offer ? ` ${r.offer}.` : ""} Reply within ${TURNAROUND}.`; const long = `${sentence(r.oneLine)}${tail}`; return long.length <= 158 ? long : `${r.name}, ${r.area}. All inclusive, 24 hours.${tail}`; };
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
/* "about 2 h 30" (the Airtable style) -> "About 2 hours 30 minutes", the style the sheet uses for the airport */
const kin = (s) => { if (!s) return ""; let t = String(s).trim().replace(/^about\s+/i, ""); const m = /^(\d+)\s*h(?:\s*(\d+))?$/i.exec(t); if (m) t = `${m[1]} hour${m[1] === "1" ? "" : "s"}${m[2] ? ` ${m[2]} minutes` : ""}`; else { const mm = /^(\d+)\s*min$/i.exec(t); if (mm) t = `${mm[1]} minutes`; } return `About ${t}`; };
const sentence = (s) => { s = String(s || "").trim(); return s && !/[.!?]$/.test(s) ? s + "." : s; };

function head({ title, description, pathname, image, jsonld = [] }) {
  const url = `${S.origin}${pathname}`;
  const og = `${S.origin}${IMG}/${image}.jpg`;
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
<meta name="robots" content="index,follow">${jsonld.map((o) => `\n<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("")}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(S.brand)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${og}">
<meta property="og:locale" content="en_JM">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0E0F0E">
<link rel="icon" href="/favicon-32x32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preload" href="/assets/fonts/archivo.woff2" as="font" type="font/woff2" crossorigin>
<style>@font-face{font-family:'Archivo';font-style:normal;font-display:swap;font-weight:100 900;font-stretch:62% 125%;src:url(/assets/fonts/archivo.woff2) format('woff2-variations')}</style>
<link rel="stylesheet" href="/groups/assets/groups.css">
<link rel="stylesheet" href="${BASE}/assets/stay.css">
${ga}
</head>`;
}

function nav(back = false) {
  const site = [["Getaways", "/getaways/"], ["Experiences", "/experiences/"], ["Groups", "/groups/"], ["Resort status", "/hotel-status"]];
  const links = [...site, ["How it works", `${BASE}/#how`]];
  return `<header class="g-nav" role="banner"><div class="wrap">
  <a class="wordmark" href="/" aria-label="Golden Vacation, home">GOLDEN VACATION</a>
  <span class="nav-sep" aria-hidden="true"></span>
  <a class="nav-here" href="${BASE}/">Resorts</a>
  ${back ? `<nav class="g-nav-links" aria-label="Resorts">${site.map(([l, h]) => `<a href="${h}">${esc(l)}</a>`).join("")}</nav>` : `<nav class="g-nav-links" aria-label="Resorts">${links.map(([l, h]) => `<a href="${h}">${esc(l)}</a>`).join("")}</nav>`}
  <div class="nav-r">
    ${back ? `<a class="btn btn-outline btn-sm" href="${BASE}/"><span class="desk-only">All resorts</span><span class="mob-only">Back</span></a>` : `<a class="btn nav-cta" href="#pick">Pick a resort</a>
    <button class="menu-btn" type="button" aria-label="Menu" aria-expanded="false" aria-controls="menu">${icon("menu", 24, 2.4)}</button>`}
  </div>
</div></header>
${back ? "" : `<nav id="menu" class="g-menu" aria-label="Menu">
  ${links.map(([l, h]) => `<a href="${h}">${esc(l)}</a>`).join("")}
  <a class="dim" href="/">Home</a><a class="dim" href="/transfers/">Transfers</a>
</nav>`}`;
}

function footer() {
  return `<footer class="foot" role="contentinfo"><div class="wrap">
  <div class="foot-brand"><b>GOLDEN VACATION &amp; TRAVEL</b><span>Offices in Jamaica and Florida. IATA-accredited since 2021.</span></div>
  <div class="foot-links">
    <div><a href="/getaways/">Getaways</a><a href="/experiences/">Experiences</a><a href="/groups/">Groups</a><a href="/hotel-status">Resort status</a><a href="${BASE}/#how">How it works</a></div>
    <div><a href="/groups/">Groups</a><a href="/getaways/">Getaways</a><a href="/">Jamaica hotels &amp; tours</a></div>
    <div><a href="/terms/">Terms</a><a href="/privacy/">Privacy</a></div>
  </div>
  <div class="foot-contact"><a href="mailto:${EMAIL}">${EMAIL}</a><span>Call ${esc(phoneDisplay)}</span><span>St Ann, Jamaica</span></div>
</div></footer>`;
}

const tags = (r) => {
  const t = [];
  t.push(r.adultsOnly ? "Adults only" : "Family friendly");
  if (/water park|splash/i.test(r.pool + r.kids + r.goodToKnow)) t.push("Water park");
  if (/swim-up|swim out|swim-out/i.test(r.roomList.map((x) => x.name).join(" "))) t.push("Swim-up rooms");
  if (/overwater|over water/i.test(r.roomList.map((x) => x.name).join(" "))) t.push("Overwater villas");
  if (/24 hours|24h/i.test(r.roomService) && !/fee/i.test(r.roomService)) t.push("24h room service");
  return t.slice(0, 3);
};

/* ---------- shared: the search bar ---------- */
const AREAS = () => [...new Set(R.map((r) => r.area))];
const searchBar = (r = null) => `<form class="sbar" id="sbar" role="search" aria-label="Search dates">
  ${r ? `<input type="hidden" name="area" value="${esc(r.area)}">` : `<label class="sb-f sb-where"><span>Where</span><select name="area"><option value="">Anywhere in Jamaica</option>${AREAS().map((a) => `<option>${esc(a)}</option>`).join("")}</select></label>`}
  <label class="sb-f"><span>Check-in</span><input type="date" name="checkin"></label>
  <label class="sb-f"><span>Check-out</span><input type="date" name="checkout"></label>
  ${who("sb-who", !!(r && r.adultsOnly), "sb-f sb-who")}
  <button type="submit" class="btn">${r ? "Check rooms" : "Search"}</button>
</form>`;
const stars = `<span class="stars" aria-label="Five star resort">★★★★★</span>`;
const who = (id, adultsOnly, cls) => `<div class="${cls} who" data-who${adultsOnly ? ' data-adults-only="1"' : ""}><span class="who-label">Who's travelling</span><button type="button" class="who-btn" id="${id}" aria-expanded="false" aria-controls="${id}-pop">2 adults</button>
    <div class="who-pop" id="${id}-pop" hidden><div class="who-party"></div><button type="button" class="who-add" hidden>+ Add room</button><p class="who-hint">${adultsOnly ? "Adults only, 18 years and older." : "Ages at the time of travel."}</p><button type="button" class="btn btn-sm who-done">Done</button></div>
    <input type="hidden" name="adults" value="2"><input type="hidden" name="children" value="0"><input type="hidden" name="rooms" value="1"><input type="hidden" name="child_ages" value=""><input type="hidden" name="split" value=""></div>`;
const AMEN = [["wifi", "Free WiFi", /wifi/i], ["pool", "Pools", /pool/i], ["beach", "On the beach", /beach|bay/i], ["spa", "Spa", /spa|wellness/i], ["gym", "Gym", /gym|fitness/i], ["swim", "Swim-up bar", /swim-up|swim up/i], ["kids", "Kids' club", /kids' club|kids club|riu ?land/i], ["park", "Water park", /water park|splash/i], ["rs", "24h room service", /room service 24|24 hours? room service|24-hour room service/i], ["ai", "24h all inclusive", /./], ["parking", "Parking", /parking/i], ["access", "Accessible rooms", /adapted|accessible/i]];
const amenityGrid = (r) => { const hay = [r.amenities, r.included, r.pool, r.spa, r.gym, r.roomService, r.wifi, r.accessibility, r.bar, r.kids].join(" "); return `<div class="amen">${AMEN.filter(([, , re]) => re.test(hay)).map(([, label]) => `<span>${check()}${esc(label)}</span>`).join("")}</div>`; };

/* ---------- hub: search plus results ---------- */
function hub() {
  const row = (r) => `<a class="res-row" href="${BASE}/${r.slug}/" data-track="card-${r.slug}" data-kind="${r.adultsOnly ? "couples" : "families"}" data-area="${esc(r.area)}" data-park="${/water park|splash/i.test(r.pool + r.kids + r.goodToKnow) ? 1 : 0}" data-swim="${/swim-up|swim out|swim-out/i.test(r.roomList.map((x) => x.name).join(" ")) ? 1 : 0}" data-brand="${esc(r.brand)}">
      ${pic(`${r.folder}-card`, r.name, [480, 960], "(min-width: 900px) 300px, 100vw")}
      <div class="res-body">
        <div class="res-top"><div><b>${esc(r.name)}</b> ${stars}<span class="res-where">${icon("pin", 13, 2.2)} ${esc(r.area)}${r.district ? `, ${esc(r.district.split(",")[0])}` : ""}</span></div><span class="badge ${r.adultsOnly ? "badge-dark" : ""}">${r.adultsOnly ? "Adults only" : "Family friendly"}</span></div>
        <div class="chips-lite">${r.offer ? `<span class="chip-offer">${esc(r.offer)}</span>` : ""}${tags(r).map((t) => `<span>${esc(t)}</span>`).join("")}<span>All inclusive 24h</span>${r.driveKin ? `<span>${esc(shortDrive(kin(r.driveKin)))} from Kingston</span>` : ""}${r.drive ? `<span>${esc(shortDrive(r.drive.replace(/\(.*?\)/g, "").replace(/;.*$/, "").replace(/ from Montego Bay.*$/, "").trim()))} from MBJ</span>` : ""}</div>
        <p>${esc(sentence(r.oneLine))}</p>
        <div class="res-foot"><span class="res-rooms">${esc(r.roomList.length)} room types</span>${r.fromUsd ? `<span class="res-price"><small>From</small><b>${usd(r.fromUsd)}</b><small>per person per night</small></span>` : `<span class="res-price"><small>Price</small><b>On request</b></span>`}<span class="btn btn-sm">See rooms</span></div>
      </div></a>`;
  return `${head({ title: "Jamaica all-inclusive resorts from US$130 a night | Golden Vacation", jsonld: [{ "@context": "https://schema.org", "@type": "ItemList", name: "Jamaica all-inclusive resorts", numberOfItems: F.RESORTS.length, itemListElement: F.RESORTS.map((x, i) => ({ "@type": "ListItem", position: i + 1, name: `${x.name}: ${x.status}`, url: `${S.origin}${BASE}/${F.slugify(x.name)}/` })) }], description: "Pick the resort, tell us your dates and who's coming, and we reply within 10 minutes with your price.", pathname: `${BASE}/`, image: "aquarelle-hero-1600" })}
<body class="groups stay">
${nav()}
<main>
<h1 class="sr-only">Jamaica all-inclusive resorts: prices, rooms and what's open</h1>
<section class="sbar-wrap"><div class="wrap">${searchBar()}</div></section>
<section class="wrap res-head" id="pick">
  <div class="res-count"><b>${R.length} resorts</b> · all inclusive, 24 hours · reply within ${TURNAROUND}</div>
  <div class="filters" role="group" aria-label="Filter resorts">
    <div class="chips" data-filter="kind"><button type="button" class="chip" aria-pressed="true" data-value="">All</button><button type="button" class="chip" aria-pressed="false" data-value="couples">Adults only</button><button type="button" class="chip" aria-pressed="false" data-value="families">Family friendly</button></div>
    <div class="chips" data-filter="feature"><button type="button" class="chip" aria-pressed="false" data-value="park">Water park</button><button type="button" class="chip" aria-pressed="false" data-value="swim">Swim-up rooms</button></div>
    <div class="chips" data-filter="brand">${[...new Set(R.map((r) => r.brand))].map((b) => `<button type="button" class="chip" aria-pressed="false" data-value="${esc(b)}">${esc(b)}</button>`).join("")}</div>
  </div>
</section>
<section class="wrap res-list" id="couples"><span id="families"></span>${R.map(row).join("\n")}<p class="small res-empty" hidden>Nothing matches all of those. Take a filter off, or try Anywhere.</p></section>
${allResorts()}

<section class="wrap" id="how"><div class="card-alt how">
  <div class="how-head"><span class="kicker">How it works</span><h2 class="h3">Three steps, no card up front</h2></div>
  <div class="steps">
    <div class="step-card step-big"><span class="big-n" aria-hidden="true">1</span><span class="n">1</span><div><b>Pick the resort and the room</b><span>Dates, adults, children and ages. One minute.</span></div></div>
    <div class="step-card step-big"><span class="big-n" aria-hidden="true">2</span><span class="n">2</span><div><b>We reply within ${TURNAROUND}</b><span>Your price, the deposit and the balance date, by email or WhatsApp.</span></div></div>
    <div class="step-card step-big"><span class="big-n" aria-hidden="true">3</span><span class="n">3</span><div><b>Pay the deposit, pack the bag</b><span>The room is held from there. Transfers too, if you want them.</span></div></div>
  </div>
</div></section>
</main>
${footer()}
<script src="${BASE}/assets/stay.js" defer></script>
</body>
</html>
`;
}

/* ---------- resort page ---------- */
/* the status answer at the top, and getting there, close by and quick answers at the foot (scripts/lib-resort-facts.mjs) */
function statusBox(r) {
  const s = F.byName(r.name); if (!s) return "";
  const a = F.answer(s);
  return `<div class="box st-answer st-${a.tone}"><div class="box-head"><span class="small">Resort status · checked ${F.CHECKED}</span><b>Is ${esc(r.name)} open? <em>${esc(a.big)}</em></b></div><p class="box-p">${esc(a.line)}${s.happening && !F.isOpen(s) ? ` ${esc(s.happening)}` : ""} <a href="/hotel-status/">Every Jamaica resort's status</a></p></div>`;
}
function factsBoxes(r) {
  const s = F.byName(r.name); if (!s) return "";
  const tr = F.transfers(s), near = F.nearby(r.slug), q = F.faqs(s, { booking: true });
  const trBox = tr.length ? `<div class="box"><div class="box-head"><b>Getting there</b><span class="small">Golden Vacation &amp; Travel private transfer, one way, car for up to 3 people, taxes included</span></div><table class="rules">${tr.map((t) => `<tr><th>From ${esc(t.label)}</th><td>${esc(t.drive)} · <b>US$${t.usd}</b></td></tr>`).join("")}</table><a class="small" href="/transfers/" style="text-decoration:underline">Bigger groups and return trips</a></div>` : "";
  const nearBox = near ? `<div class="box"><div class="box-head"><b>Things to do nearby</b></div><p class="box-p">${esc(near.text)}</p><a class="small" href="${near.href}" style="text-decoration:underline">Tours and day passes near ${esc(r.name)}, with prices</a></div>` : "";
  const faqBox = `<div class="box" id="questions"><div class="box-head"><b>Quick answers</b></div><div class="qa">${q.map(([k, v]) => `<details><summary>${esc(k)}</summary><p class="box-p">${esc(v)}</p></details>`).join("")}</div></div>`;
  return trBox + nearBox + faqBox;
}

/* every resort we track, by coast, each linking to its own page (status pages for the ones not bookable here yet) */
function allResorts() {
  const order = ["Montego Bay", "Falmouth", "Lucea / Green Island", "Negril", "Ocho Rios & Runaway Bay", "South Coast"];
  const areas = [...new Set(F.RESORTS.map((r) => r.area))].sort((a, b) => (order.indexOf(a) + 1 || 9) - (order.indexOf(b) + 1 || 9));
  const pill = (r) => { const a = F.answer(r); return `<span class="ar-st ar-${a.tone}">${esc(r.status === "Reopening" && /\d/.test(r.when) ? `Reopening ${r.when}` : r.status)}</span>`; };
  return `<section class="wrap all-resorts" id="all"><div class="box"><div class="box-head"><b>Every Jamaica resort we track</b><span class="small">Open, reopening or closed, checked ${F.CHECKED}. Tap one for its status, open resorts like it and transfer prices.</span></div>
<div class="ar-grid">${areas.map((a) => `<div><h3 class="ar-h">${esc(a)}</h3><ul>${F.RESORTS.filter((r) => r.area === a).sort((x, y) => x.name.localeCompare(y.name)).map((r) => `<li><a href="${BASE}/${F.slugify(r.name)}/">${esc(r.name)}</a>${pill(r)}</li>`).join("")}</ul></div>`).join("")}</div></div></section>`;
}

function resort(r) {
  const ph = P[r.folder];
  const mosaic = `<div class="mosaic">${pic(`${r.folder}-hero`, r.name, [800, 1600], "(min-width: 900px) 60vw, 100vw", false, "m-main")}${ph.gallery.slice(0, 4).map((f, i) => pic(`${r.folder}-g${i + 1}`, `${r.name} photo ${i + 2}`, [600, 1200], "(min-width: 900px) 20vw, 45vw", true, "m-side")).join("")}<a class="btn btn-white btn-sm m-all" href="#photos">All photos</a></div>`;
  const strip = ph.gallery.slice(0, 8).map((f, i) => `<figure class="g-item">${pic(`${r.folder}-g${i + 1}`, `${r.name} photo ${i + 2}`, [600, 1200], "(min-width: 900px) 25vw, 85vw")}</figure>`).join("\n");
  const inc = list(r.included), extra = list(r.extra);
  const roomRows = r.roomList.map((x, i) => `<tr data-occ="${occ(r, x).data}">
      <td class="av-room"><b>${esc(x.name)}</b>${x.beds ? `<span>${icon("bed", 14, 2.2)} ${esc(bedText(x.beds))}</span>` : ""}${x.notes ? `<span class="av-note">${esc(noCount(noSqm(x.notes)))}</span>` : ""}</td>
      <td class="av-sleeps">${occ(r, x).html}</td>
      <td class="av-opts"><span>${check()}All inclusive, 24h</span><span>${check()}Taxes included in the quote</span>${r.adultsOnly ? `<span>${check()}Adults only</span>` : ""}</td>
      ${r.fromUsd && i === 0 ? `<td class="av-price"><span class="small">From</span><b>${usd(r.fromUsd)}</b><span class="small">per person per night, double occupancy</span></td>` : `<td class="av-price"><span class="small">Price</span><b>On request</b><span class="small">reply within ${TURNAROUND}</span></td>`}
      <td class="av-cta"><button type="button" class="btn btn-sm" data-room="${esc(x.name)}">Select</button></td>
    </tr>`).join("\n");
  const roomOptions = r.roomList.map((x) => `<option>${esc(x.name)}</option>`).join("");
  const drive = r.drive.replace(/\(.*?\)/g, "").replace(/;.*$/, "").trim();
  const wa = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Hi, I'd like a quote for ${r.name}.`)}`;
  const maps = `https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(r.name + " " + r.city + " Jamaica")}`;
  const rules = [["Board", "All inclusive, 24 hours"], ["Who", r.adultsOnly ? "Adults only, 18 years and older" : "Couples and families"], ["Kids", r.adultsOnly ? "Not admitted" : sentence(r.kids) || "Welcome"], ["Room service", sentence(r.roomService)], ["From Kingston", r.driveKin ? kin(r.driveKin) : ""], ["From the airport", drive], ["Accessibility", sentence(r.accessibility)]].filter(([, v]) => v);
  const form = `<form class="book" name="staycation" method="POST" action="${BASE}/sent/" data-netlify="true" netlify-honeypot="bot-field" novalidate id="sform">
      <input type="hidden" name="form-name" value="staycation">
      <input type="hidden" name="resort" value="${esc(r.name)}">
      <input type="hidden" name="subject" id="s-subject" value="Staycation quote · ${esc(r.name)}">
      <p class="hp" aria-hidden="true"><label>Leave this field empty <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>
      <div class="book-head"><b>Your stay</b><span class="small">${r.fromUsd ? `From ${usd(r.fromUsd)} per person per night · reply within ${TURNAROUND}` : `Reply within ${TURNAROUND} with your price`}</span></div>
      ${r.offer ? `<p class="offer-line">${esc(r.offer)}</p>` : ""}
      <div class="fields-2 tight">
        <div class="field"><label for="s-in">Check-in<span class="req" aria-hidden="true">*</span></label><input id="s-in" type="date" name="checkin" data-req="1"></div>
        <div class="field"><label for="s-out">Check-out<span class="req" aria-hidden="true">*</span></label><input id="s-out" type="date" name="checkout" data-req="1"></div>
      </div>
      ${who("s-who", r.adultsOnly, "field who-field")}
      <div class="field"><label for="s-room">Room type</label><select id="s-room" name="room"><option value="">Not sure, you pick</option>${roomOptions}</select></div>
      <p class="small" id="rooms-hint" hidden>More than one room? Pick one type and we mix to fit, or say which types in the notes.</p>
      <div class="field"><label for="s-notes">Notes</label><input id="s-notes" type="text" name="notes" placeholder="e.g. one family room and one double, connecting if possible"></div>
      <div class="book-sum" id="book-sum"><span>Pick your dates</span></div>
      <div class="field"><label for="s-name">Your name<span class="req" aria-hidden="true">*</span></label><input id="s-name" type="text" name="name" autocomplete="name" data-req="1"></div>
      <div class="fields-2 tight">
        <div class="field"><label for="s-phone">WhatsApp<span class="req" aria-hidden="true">*</span></label><input id="s-phone" type="tel" name="phone" autocomplete="tel" inputmode="tel" data-req="1"></div>
        <div class="field"><label for="s-email">Email<span class="req" aria-hidden="true">*</span></label><input id="s-email" type="email" name="email" autocomplete="email" inputmode="email" data-req="1"></div>
      </div>
      <p class="form-err" role="alert"></p>
      <button type="submit" class="btn btn-full">Request price</button>
      <a class="btn btn-outline btn-full" id="s-wa" href="${wa}" data-base="https://wa.me/${WHATSAPP}" target="_blank" rel="noopener">${icon("wa", 18, 2)} WhatsApp instead</a>
      <p class="small">No card now. A deposit holds the room once you have the price. <a href="/privacy/" style="text-decoration:underline">Privacy</a></p>
      <p class="small trust">IATA accredited since 2021 · Offices in Jamaica and Florida · Pay in J$ or US$</p>
    </form>`;
  return `${head({ title: (() => { const st = F.byName(r.name) && F.isOpen(F.byName(r.name)) ? "open now" : F.byName(r.name) ? F.byName(r.name).status.toLowerCase() : ""; return F.fit(70, `${r.name}: ${st}, prices and rooms | Golden Vacation`, `${r.name}: ${st}, prices and rooms`, `${r.name}: prices and rooms`); })(), description: metaDesc(r), pathname: `${BASE}/${r.slug}/`, image: `${r.folder}-hero-1600`, jsonld: F.byName(r.name) ? [F.resortLd(F.byName(r.name), { url: `${S.origin}${BASE}/${r.slug}/`, image: `${S.origin}${IMG}/${r.folder}-hero-1600.jpg`, fromUsd: r.fromUsd, rooms: parseInt(r.rooms) || null }), F.faqLd(F.faqs(F.byName(r.name), { booking: true }))] : [] })}
<body class="groups stay stay-resort">
${nav(true)}
<section class="stay-strip"><div class="wrap">
  <div class="strip-search"><span class="strip-k">Your stay</span><span id="strip-dates">Add your dates</span><span class="strip-sep" aria-hidden="true">·</span><span id="strip-who">2 adults</span><a class="strip-change" href="#quote">Change</a></div>
  <ul class="strip-facts">
    ${r.offer ? `<li class="strip-offer">${esc(r.offer)}</li>` : ""}<li>${icon("check", 14, 3, "#F2B93B")}All inclusive, 24 hours</li>
    <li>${icon("check", 14, 3, "#F2B93B")}${r.adultsOnly ? "Adults only, 18 years and older" : "Family friendly"}</li>
    <li>${icon("check", 14, 3, "#F2B93B")}${r.fromUsd ? `From ${usd(r.fromUsd)} per person per night, double occupancy` : "Prices per person per night, double occupancy"}, taxes included</li>
    <li>${icon("check", 14, 3, "#F2B93B")}Reply within ${TURNAROUND}</li>
  </ul>
</div></section>
<main class="wrap">
<div class="res-title">
  <div class="res-top"><div><h1 class="h2">${esc(r.name)} ${stars}</h1><span class="res-where">${icon("pin", 13, 2.2)} ${esc(r.city)}${r.district ? `, ${esc(r.district.split(",")[0])}` : ""} · <a href="${maps}" target="_blank" rel="noopener">Show on map</a>${drive ? ` · ${esc(drive.replace(/^About /, "about "))}` : r.driveKin ? ` · ${esc(kin(r.driveKin))} from Kingston` : ""}</span></div><span class="badge ${r.adultsOnly ? "badge-dark" : ""}">${r.adultsOnly ? "Adults only" : "Family friendly"}</span></div>
</div>
${mosaic}
<div class="book-grid">
  <div class="book-main">
    ${statusBox(r)}
    <div class="box"><div class="box-head"><b>Highlights</b><span class="small">${esc(r.rooms.replace(/,.*$/, ""))} rooms · ${esc(r.roomList.length)} room types</span></div><p class="box-p">${esc(sentence(r.oneLine))}</p>${amenityGrid(r)}</div>

    <div class="box" id="rooms"><div class="box-head"><b>Availability</b><span class="small">How many each room takes, adults and children. The resort confirms the final count before you pay.</span></div>
      <div class="av-wrap"><table class="av"><thead><tr><th>Room type</th><th>Sleeps</th><th>Your options</th><th>Price</th><th></th></tr></thead><tbody>${roomRows}</tbody></table></div>
    </div>

    <div class="box"><div class="box-head"><b>What's included</b></div><div class="inc-chips">${inc.map((x) => `<span>${check()}${esc(x)}</span>`).join("")}</div>${extra.length ? `<p class="small"><b>Costs extra:</b> ${esc(extra.join(", "))}.</p>` : ""}</div>

    <div class="box" id="photos"><div class="box-head"><b>Photos</b><span class="small">Supplied by the resort.</span></div><div class="gallery strip">${strip}</div></div>

    <div class="box"><div class="box-head"><b>Food and drink</b></div>
      <div class="kv"><span>Restaurants</span><p>${esc(sentence(r.restaurant))}</p></div>
      <div class="kv"><span>Bars</span><p>${esc(sentence(r.bar))}</p></div>
      <div class="kv"><span>Pools</span><p>${esc(sentence(r.pool))}</p></div>
      ${r.spa ? `<div class="kv"><span>Spa</span><p>${esc(sentence(r.spa))}</p></div>` : ""}
    </div>

    <div class="box map-box"><div class="box-head"><b>Where it is</b><span class="small">${esc(r.city)}${r.district ? `, ${esc(r.district.split(",")[0])}` : ""}${drive ? ` · ${esc(drive)} from the airport` : ""}</span></div>
      <div class="map"><iframe title="Map of ${esc(r.name)}" src="https://www.google.com/maps?q=${encodeURIComponent(r.name + " " + r.city + " Jamaica")}&amp;output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe></div>
      <a class="small" href="${maps}" target="_blank" rel="noopener" style="text-decoration:underline">Open in Google Maps</a>
    </div>

    <div class="box"><div class="box-head"><b>House rules and good to know</b></div>
      <table class="rules">${rules.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</table>
      <p class="small">${esc(sentence(r.goodToKnow))}</p>
    </div>
    ${factsBoxes(r)}
  </div>
  <aside class="book-side" id="quote">${form}</aside>
</div>
</main>
<div class="book-bar" id="book-bar"><span><b>${esc(r.name)}</b><span>Reply within ${TURNAROUND}</span></span><a class="btn" href="#quote">Request price</a></div>
${footer()}
<script src="${BASE}/assets/stay.js" defer></script>
</body>
</html>
`;
}

function sent() {
  return `${head({ title: "Got it | Resort quote | Golden Vacation & Travel", description: "Your request is in. We reply within 10 minutes with your price.", pathname: `${BASE}/sent/`, image: "aquarelle-hero-1600" })}
<body class="groups stay">
${nav(true)}
<main class="wrap sent-wrap">
  <span class="kicker">Got it</span>
  <h1 class="h1">Your quote is on its way</h1>
  <p class="lead">Within ${TURNAROUND} you'll have your price, the deposit and the balance date, by email or WhatsApp. Spotted a mistake? Email ${EMAIL} and we fix it before quoting.</p>
  <div class="wiz-nav"><a class="btn" href="${BASE}/">All resorts</a><a class="btn btn-outline" href="/">Home</a></div>
</main>
${footer()}
</body>
</html>
`;
}

const write = (rel, html) => { const f = path.join(ROOT, "public", rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, html); console.log("wrote", path.join("public", rel), (html.length / 1024).toFixed(1) + "KB"); };
write("resorts/index.html", hub());
for (const r of R) write(`resorts/${r.slug}/index.html`, resort(r));
write("resorts/sent/index.html", sent());

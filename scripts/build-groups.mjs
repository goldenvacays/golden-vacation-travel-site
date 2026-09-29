#!/usr/bin/env node
/**
 * Builds the Groups pages from data/groups.json.
 *
 *   node scripts/build-groups.mjs   → writes public/groups/index.html, public/groups/enquire/index.html, public/groups/sent/index.html
 *
 * Images live in public/groups/img (pre-generated JPEG + WebP at two widths; see the -480/-960 and -720/-1440 pairs).
 * CSS and JS are static: public/groups/assets/groups.css and groups.js. Shared settings (phone, J$ rate, GA4) come from data/getaways.json "site".
 * Rules: no WhatsApp anywhere in the groups flow (intake is by email), no supplier or airline names, guide prices only, no em dashes.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const G = JSON.parse(fs.readFileSync(path.join(ROOT, "data/groups.json"), "utf8"));
const S = JSON.parse(fs.readFileSync(path.join(ROOT, "data/getaways.json"), "utf8")).site;
const BASE = G.base;
const IMG = `${BASE}/img`;
const T = (s) => String(s ?? "").split("TURNAROUND").join(G.turnaround);
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const phoneDisplay = S.phone.replace(/-/g, " ");

/* ---------- pieces ---------- */
const ICON = {
  arrow: '<path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path>',
  clock: '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>',
  tag: '<path d="M20 13 13 20a2 2 0 0 1-3 0L3 13V4h9l8 8a2 2 0 0 1 0 1Z"></path><circle cx="7.5" cy="8.5" r="1.2"></circle>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M3 10h18M8 3v4M16 3v4"></path>',
  people: '<circle cx="9" cy="8" r="3.5"></circle><path d="M2.5 20a6.5 6.5 0 0 1 13 0"></path><circle cx="17" cy="9" r="2.5"></circle><path d="M16 15.5a5 5 0 0 1 5.5 4.5"></path>',
  check: '<path d="M20 6 9 17l-5-5"></path>',
  menu: '<path d="M3 12h18M3 6h18M3 18h18"></path>',
};
const icon = (n, size = 16, sw = 2.4, color = "currentColor", extra = "") => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${ICON[n]}</svg>`;
const check = () => icon("check", 16, 3, "#1F8A4C");

/* responsive picture: name-<w>.webp/jpg pairs */
const pic = (name, alt, widths, sizes, lazy = true) => {
  const set = (ext) => widths.map((w) => `${IMG}/${name}-${w}.${ext} ${w}w`).join(", ");
  return `<picture><source type="image/webp" srcset="${set("webp")}" sizes="${sizes}"><img src="${IMG}/${name}-${widths[0]}.jpg" srcset="${set("jpg")}" sizes="${sizes}" alt="${esc(alt)}" loading="${lazy ? "lazy" : "eager"}" decoding="async"></picture>`;
};
const thumb = (name, alt) => `<picture><source type="image/webp" srcset="${IMG}/${name}-160.webp"><img src="${IMG}/${name}-160.jpg" alt="${esc(alt)}" width="160" height="160" loading="lazy" decoding="async"></picture>`;

const money = (usd) => `<span class="price"><span class="usd-v">US$${fmt(usd)}</span><span class="jmd-v">≈ J$${fmt(usd * S.jmdRate)}</span></span>`;
const holdMoney = () => `<span class="usd-v">US$${fmt(G.hold.usd)}</span><span class="jmd-v">J$${fmt(G.hold.jmd)}</span>`;

const currency = () => `<div class="curr" role="group" aria-label="Currency"><button type="button" data-c="USD" class="on">US$</button><button type="button" data-c="JMD">J$</button></div>`;

function head({ title, description, pathname, image, noindex = false, jsonld = [] }) {
  const url = `${S.origin}${pathname}`;
  const og = `${S.origin}${IMG}/${image}-1440.jpg`;
  const ld = jsonld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n");
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
<meta name="robots" content="${noindex ? "noindex,follow" : "index,follow"}">
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
<link rel="icon" href="/favicon-32x32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preload" href="/assets/fonts/archivo.woff2" as="font" type="font/woff2" crossorigin>
<style>@font-face{font-family:'Archivo';font-style:normal;font-display:swap;font-weight:100 900;font-stretch:62% 125%;src:url(/assets/fonts/archivo.woff2) format('woff2-variations')}</style>
<link rel="stylesheet" href="${BASE}/assets/groups.css">
${ld}
${ga}
<script>window.GV_GROUPS=${JSON.stringify({ base: BASE, jmdRate: S.jmdRate, holdUsd: G.hold.usd, holdJmd: G.hold.jmd, submitLabel: G.form.submit })};</script>
</head>`;
}

function nav({ here = true, back = false } = {}) {
  const links = [[G.navShort.rooms, `${BASE}/#rooms`], [G.navShort.jamaica, `${BASE}/#jamaica`], [G.navShort.trips, `${BASE}/#trips`], ["Copa fares", `${BASE}/copa/`], ["The hold", `${BASE}/#hold`], ["How it works", `${BASE}/#how`]];
  return `<header class="g-nav" role="banner"><div class="wrap">
  <a class="wordmark" href="/" aria-label="Golden Vacation, home">GOLDEN VACATION</a>
  <span class="nav-sep" aria-hidden="true"></span>
  <a class="nav-here" href="${BASE}/">Groups</a>
  ${here ? `<nav class="g-nav-links" aria-label="Groups">${links.map(([l, h]) => `<a href="${h}">${esc(l)}</a>`).join("")}</nav>` : `<span class="g-nav-links" aria-hidden="true"></span>`}
  <div class="nav-r">
    ${currency()}
    ${back ? `<a class="btn btn-outline btn-sm" href="${BASE}/"><span class="desk-only">Back to groups</span><span class="mob-only">Back</span></a>` : `<a class="btn nav-cta" href="${BASE}/enquire/" data-track="nav">${esc(G.cta.button)}</a>
    <button class="menu-btn" type="button" aria-label="Menu" aria-expanded="false" aria-controls="menu">${icon("menu", 24, 2.4)}</button>`}
  </div>
</div></header>
${back ? "" : `<nav id="menu" class="g-menu" aria-label="Menu">
  ${links.map(([l, h]) => `<a href="${h}">${esc(l)}</a>`).join("")}
  <a href="${BASE}/enquire/">${esc(G.cta.button)}</a>
  <a class="dim" href="/">Home</a><a class="dim" href="/getaways/">Getaways</a><a class="dim" href="/experiences/">Experiences</a><a class="dim" href="/transfers/">Transfers</a>
  ${currency()}
</nav>`}`;
}

function footer(short = false) {
  return `<footer class="foot" role="contentinfo"><div class="wrap">
  <div class="foot-brand"><b>GOLDEN VACATION &amp; TRAVEL</b><span>${esc(G.officesLine)}. ${esc(G.iataLine)}.</span></div>
  ${short ? "" : `<div class="foot-links">
    <div><a href="${BASE}/#rooms">${esc(G.rooms.kicker)}</a><a href="${BASE}/#jamaica">${esc(G.overseas.kicker)}</a><a href="${BASE}/#trips">${esc(G.trips.kicker)}</a><a href="${BASE}/copa/">Copa group fares</a><a href="${BASE}/#hold">The hold</a></div>
    <div><a href="${BASE}/enquire/">${esc(G.cta.button)}</a><a href="${BASE}/#how">How it works</a><a href="/getaways/">Getaways</a><a href="/">Jamaica hotels &amp; tours</a></div>
    <div><a href="/terms/">Terms</a><a href="/privacy/">Privacy</a></div>
  </div>`}
  <div class="foot-contact"><a href="mailto:${G.email}">${G.email}</a><span>Call ${esc(phoneDisplay)}</span><span>St Ann, Jamaica</span></div>
</div></footer>`;
}

const scripts = () => `<script src="${BASE}/assets/groups.js" defer></script>`;

/* ---------- the hub ---------- */
function hub() {
  const h = G.hero;
  const tiles = G.tiles.map((t) => `<a class="tile" href="${t.branch === "trips" ? "#trips" : `${BASE}/enquire/?branch=${t.branch}`}" data-track="tile-${t.id}">
      ${pic(t.img, t.alt, [480, 960], "(min-width: 900px) 33vw, 100vw", false)}
      <div class="tile-body"><span class="kicker">${esc(t.kick)}</span><b>${esc(t.title)}</b><p>${esc(t.text)}</p><span class="btn btn-white">${esc(t.cta)}${icon("arrow")}</span></div>
    </a>`).join("\n");
  const r = G.rooms, o = G.overseas, tr = G.trips;
  const dests = tr.destinations.map((d, i) => `<div class="dest">
      ${pic(d.img, d.alt, [720, 1440], "(min-width: 900px) 46vw, 90vw")}
      <div class="dest-body">
        <div class="stack" style="gap:3px"><h3 class="h3">${esc(d.name)}</h3><span class="dest-meta">${esc(d.meta)}</span></div>
        <div class="inc">${d.includes.map((x) => `<span>${check()}<span>${esc(x)}</span></span>`).join("")}</div>
        <div class="hotels">${d.hotels.map((ht) => `<div class="hotel-row">${thumb(ht.img, ht.alt)}<div class="hn"><b>${esc(ht.name)}</b><span>Starting at ${money(ht.usd)} per person</span></div><a class="btn" href="${BASE}/enquire/?branch=trips&amp;dest=${encodeURIComponent(d.name)}&amp;hotel=${encodeURIComponent(ht.name)}" data-track="hold-${ht.name}">${esc(tr.holdCta || "Hold booking")}</a></div>`).join("")}</div>
      </div>
    </div>`).join("\n");
  const ld = [{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: `${S.origin}/` }, { "@type": "ListItem", position: 2, name: "Groups", item: `${S.origin}${BASE}/` }] }];
  return `${head({ title: "Group travel | Rooms for your organisation, overseas groups and group trips from Jamaica | Golden Vacation & Travel", description: `Ten or more? Rooms for churches, schools, companies and family outings at a group rate, groups coming to Jamaica from the USA, UK or Canada, and group trips from Kingston to Panama City and Punta Cana. Quotes by email within ${G.turnaround}.`, pathname: `${BASE}/`, image: "rooms-resort", jsonld: ld })}
<body class="groups">
${nav()}
<main>
<section class="hero wrap" id="top">
  <div class="hero-top">
    <div class="hero-head"><span class="kicker">${esc(h.kicker)}</span><h1 class="h1">${esc(h.title)}</h1><p class="lead">${esc(T(h.text))}</p></div>
    <div class="proof">${h.proof.map((p) => `<span><i></i>${esc(p)}</span>`).join("")}</div>
  </div>
  <div class="tiles">
${tiles}
  </div>
</section>

<section class="sec wrap" id="rooms">
  <div class="sec-head-row">
    <div class="sec-head"><span class="kicker">${esc(r.kicker)}</span><h2 class="h2">${esc(r.title)}</h2><span class="accent" aria-hidden="true"></span></div>
    <a class="btn desk-btn" href="${BASE}/enquire/?branch=groups" data-track="rooms-top">${esc(r.cta)}</a>
  </div>
  <div class="rooms-grid">
    <div class="sec-photo-wrap">${pic(r.img, r.alt, [720, 1440], "(min-width: 900px) 48vw, 100vw")}</div>
    <div class="rooms-text">
      <p class="lead">${esc(r.text)}</p>
      <div class="gets">${r.gets.map((g) => `<div class="get">${icon("check", 18, 3, "#1F8A4C")}<div><b>${esc(g.title)}</b><span>${esc(g.text)}</span></div></div>`).join("")}</div>
      <div class="chips-row">${r.chips.map((c) => `<span class="chip-static">${esc(c)}</span>`).join("")}</div>
      <div class="sec-cta"><a class="btn" href="${BASE}/enquire/?branch=groups" data-track="rooms">${esc(r.cta)}</a>${r.note ? `<p class="small">${esc(T(r.note))}</p>` : ""}</div>
    </div>
  </div>
</section>

<section class="band on-alt" id="jamaica">
  <div class="wrap band-grid">
    ${pic(o.img, o.alt, [720, 1440], "(min-width: 900px) 46vw, 100vw")}
    <div class="band-text">
      <span class="kicker">${esc(o.kicker)}</span>
      <h2 class="h2">${esc(o.title)}</h2><span class="accent" aria-hidden="true"></span>
      <p class="lead">${esc(o.text)}</p>
      <div class="chips-row">${o.chips.map((c) => `<span class="chip-static">${esc(c)}</span>`).join("")}</div>
      <div class="sec-cta"><a class="btn" href="${BASE}/enquire/?branch=overseas" data-track="overseas">${esc(o.cta)}</a><p class="small">${esc(T(o.note))}</p></div>
    </div>
  </div>
</section>

<section class="sec wrap" id="trips">
  <div class="sec-head"><span class="kicker">${esc(tr.kicker)}</span><h2 class="h2">${esc(tr.title)}</h2><span class="accent" aria-hidden="true"></span><p class="lead">${esc(tr.text)}</p></div>
  <div class="dests">
${dests}
  </div>
  <div class="dots" aria-hidden="true">${tr.destinations.map((d, i) => `<i${i === 0 ? ' class="on"' : ""}></i>`).join("")}</div>
  <p class="small trips-note">${esc(tr.more || "")} ${esc(tr.note)}</p>
  <div class="sec-cta" style="margin-top:18px"><a class="btn btn-outline" href="${BASE}/copa/" data-track="hub-copa">Flying Copa as a group? See group fares</a></div>
</section>

<section class="wrap"><div class="card-alt on-alt" id="hold">
  <div class="card-l"><span class="kicker">${esc(G.holdKicker || "For leaders")}</span><h3 class="h3">Fill your trip. Front nothing.</h3><p class="small">${esc(G.holdNote)}</p></div>
  <div class="steps">${G.holdSteps.map((s, i) => `<div class="step-card step-big"><span class="big-n" aria-hidden="true">${i + 1}</span><span class="n">${i + 1}</span><div><span class="n-lbl">${i + 1}</span><b>${esc(s.title)}</b><span>${esc(s.text)}</span></div></div>`).join("")}</div>
</div></section>

<section class="wrap why" id="why">
  <div class="sec-head"><h2 class="h2">Why book your group with us?</h2><span class="accent" aria-hidden="true"></span></div>
  <div class="why-grid">${G.why.map((w) => `<div class="why-card"><span class="why-icon">${icon(w.icon || "tag", 22, 2)}</span><b>${esc(w.title)}</b><span>${esc(T(w.text))}</span></div>`).join("")}</div>
</section>

<section class="wrap"><div class="card-alt on-alt" id="how">
  <div class="card-l"><span class="kicker">How it works</span><h3 class="h3">${esc(G.howTitle)}</h3><p class="small">${esc(T(G.howText))}</p></div>
  <div class="steps">${G.flow.map((f, i) => `<div class="step-card step-big"><span class="big-n" aria-hidden="true">${i + 1}</span><span class="n">${i + 1}</span><div><span class="n-lbl">${esc(f.n)}</span><b>${esc(f.title)}</b><span>${esc(T(f.text))}</span></div></div>`).join("")}</div>
</div></section>

<section class="wrap"><div class="cta-photo">
  ${pic("cta-beach", "Umbrellas on the beach at a north coast resort, from above", [720, 1440], "(min-width: 900px) 1312px, 100vw")}
  <div class="cta-photo-body">
    <div class="cta-text"><h3 class="h3">${esc(G.cta.title)}</h3><p>${esc(T(G.cta.text))}</p></div>
    <a class="btn btn-white" href="${BASE}/enquire/" data-track="cta">${esc(G.cta.button)}</a>
  </div>
</div></section>
</main>
<div class="sticky-cta" id="sticky-cta" hidden><a class="btn" href="${BASE}/enquire/" data-track="sticky">${esc(G.cta.button)}</a></div>
${footer()}
${scripts()}
</body>
</html>
`;
}

/* ---------- the form ---------- */
const REQ = '<span class="req" aria-hidden="true">*</span>';
const chips = (name, items, { on = null, multi = false, req = false } = {}) =>
  `<div class="chips" data-chips="${name}"${multi ? ' data-multi="true"' : ""}${req ? ' data-req="1"' : ""}>${items.map((it) => `<button type="button" class="chip" aria-pressed="${it === on ? "true" : "false"}" data-value="${esc(it)}">${esc(it)}</button>`).join("")}</div><input type="hidden" name="${name}" value="${esc(on || "")}">`;
const row = (label, body, { req = false, hint = "", attrs = "" } = {}) =>
  `<div class="q"${attrs}><span class="ql" data-label="${esc(label)}">${esc(label)}${req ? REQ : ""}${hint ? ` <span class="hint">${esc(hint)}</span>` : ""}</span>${body}</div>`;
const field = (name, label, { type = "text", req = false, hint = "", placeholder = "", id = "", extra = "" } = {}) =>
  `<div class="field"><label for="${id || "f-" + name}">${esc(label)}${req ? REQ : ""}${hint ? ` <span class="hint">${esc(hint)}</span>` : ""}</label><input id="${id || "f-" + name}" type="${type}" name="${name}"${placeholder ? ` placeholder="${esc(placeholder)}"` : ""}${req ? ' data-req="1"' : ""}${extra}></div>`;
const num = (name, label, value, min, max, req = false) =>
  `<label class="numbox"><span>${esc(label)}${req ? REQ : ""}</span><input type="number" name="${name}" value="${value}" min="${min}" max="${max}" inputmode="numeric"${req ? ' data-req="1"' : ""}></label>`;
const tick = (name, label) => `<label class="tick"><input type="checkbox" name="${name}" value="Yes"><span>${esc(label)}</span></label>`;
const datePair = (a, b, la, lb, req = true) => `<div class="fields-2">${field(a, la, { type: "date", req })}${field(b, lb, { type: "date", req })}</div>`;
const flexDates = (p, la, lb) => `${tick("dates_flex", "Dates are flexible")}
      <div data-show="dates_flex:Yes" hidden class="stack" style="gap:10px">
        <span class="hint">Other dates that would work, up to three more.</span>
        ${[1, 2, 3].map((i) => `<div class="fields-2" data-alt="${i}"${i > 1 ? " hidden" : ""}>${field("alt" + i + "_from", la + " " + i, { type: "date", id: "f-" + p + "-alt" + i + "a" })}${field("alt" + i + "_to", lb + " " + i, { type: "date", id: "f-" + p + "-alt" + i + "b" })}</div>`).join("")}
        <button type="button" class="btn btn-outline btn-sm" data-alt-add style="align-self:flex-start">Add another date range</button>
      </div>`;
const place = (id, label, hint) =>
  `<div class="field"><label for="${id}">${esc(label)}${REQ}</label><input id="${id}" type="text" name="place" list="places" autocomplete="off" placeholder="Start typing" data-req="1"><span class="hint">${esc(hint)}</span></div>`;
const hotels = (id) => `<div class="q" data-tags="hotels"><span class="ql" data-label="Hotels you'd like quoted">Hotels you'd like quoted <span class="hint">Start typing a name and pick it, or type your own. Press Add for the next one.</span></span>
        <div class="tag-add"><input id="${id}" type="text" list="hotels-list" autocomplete="off" placeholder="Hotel name" aria-label="Hotel name"><button type="button" class="btn btn-outline btn-sm" data-tag-add>Add</button></div>
        <div class="tags" aria-live="polite"></div><input type="hidden" name="hotels" value=""></div>`;
const style = (f, ph, withArea = false) => `<div class="q"><span class="ql" data-label="No hotel in mind? Tell us the style">No hotel in mind? Tell us the style</span>${chips("tier", f.tiers)}</div>
        ${withArea ? `<div class="field"><label for="f-area-g">Area or town <span class="hint">if you have one in mind</span></label><input id="f-area-g" type="text" name="area" list="places" autocomplete="off" placeholder="e.g. Ocho Rios"></div>` : ""}
        <div class="q"><span class="ql">What do you want or expect? <span class="hint">Mention specific tours, set-ups, and anything else that matters.</span></span><textarea name="expect" rows="2" placeholder="${esc(ph)}"></textarea></div>`;
const under10 = (f) => `<div class="nudge" data-show="adults:<10" hidden><span>${esc(f.under10)}</span><a class="btn btn-outline btn-sm" href="https://wa.me/${f.whatsapp}?text=${encodeURIComponent("Hi, I'd like a quote for a small group.")}" target="_blank" rel="noopener">${esc(f.under10cta)}</a></div>`;
const peopleRows = (f, minAdults = 1) => `<div class="numrow">${num("adults", "Adults", "", minAdults, 500, true)}${num("children", "Children", "0", 0, 200)}</div>
      ${under10(f)}
      <div class="q" data-show="children:>0" hidden><span class="ql">Children's ages${REQ}</span>${chips("child_ages", f.childAges, { multi: true, req: true })}</div>
      ${row("Rooms by type", `<div class="numrow">${f.roomTypes.map(([n, l]) => num(n, l, "0", 0, 300)).join("")}</div>`, { req: true, hint: "How many of each. Quad rooms are not offered by all hotels.", attrs: ' data-rooms-req="1"' })}`;
const screen = (n, title, body, sub = "") => `<section class="screen" data-screen="${n}"${n === 1 ? "" : " hidden"}><div class="screen-head"><h2 class="lg">${esc(title)}</h2>${sub ? `<p class="hint">${esc(sub)}</p>` : ""}</div>${body}</section>`;
const part = (branch, body) => `<fieldset class="fs" data-branch="${branch}"${branch === "groups" ? "" : " hidden disabled"}>${body}</fieldset>`;

function enquire() {
  const f = G.form;
  const who = f.who.map((w, i) => `<label class="radio-card who hidden-input"><input type="radio" name="branch" value="${w.value}" data-label="${esc(w.title)}"${i === 0 ? " checked" : ""}><span class="rc"><b>${esc(w.title)}</b><span>${esc(w.sub)}</span></span></label>`).join("");
  const tripHotels = G.trips.destinations.map((d) => `<div data-hotels-for="${esc(d.name)}" hidden>${row("Hotel", `<div class="stack">${d.hotels.map((ht) => `<label class="radio-card"><input type="radio" name="hotel" value="${esc(ht.name)}" data-label="${esc(ht.name)}">${thumb(ht.img, ht.alt)}<span class="rc"><b>${esc(ht.name)}</b><span>${d.nights} nights, ${d.board.toLowerCase()} · starting at ${money(ht.usd)} per person</span></span></label>`).join("")}<label class="radio-card"><input type="radio" name="hotel" value="Pick one for me" data-label="pick one for me"><span class="rc"><b>Pick one for me</b><span>Tell us what you want and we choose.</span></span></label></div>`, { req: true })}</div>`).join("");
  const wizNav = (n, last) => `<p class="form-err" role="alert"></p><div class="wiz-nav">${n > 1 ? `<button type="button" class="btn btn-outline" data-back>Back</button>` : `<span></span>`}${last ? `<button type="submit" class="btn">${esc(f.submit)}</button>` : `<button type="button" class="btn" data-next>Next</button>`}</div>`;
  return `${head({ title: "Get a group quote | Golden Vacation & Travel", description: `Tell us what you need in four short screens. Resort or hotel rooms, a group coming to Jamaica, or an international group trip. Your quote lands by email within ${G.turnaround}.`, pathname: `${BASE}/enquire/`, image: "rooms-resort" })}
<body class="groups groups-form">
${nav({ here: false, back: true })}
<main class="wrap">
<div class="form-head"><span class="kicker">${esc(f.kicker)}</span><h1 class="h1">${esc(f.title)}</h1><p class="lead">${esc(T(f.text))}</p></div>
<div class="form-grid">
<form id="gform" class="fcard" name="groups" method="POST" action="${BASE}/sent/" data-netlify="true" netlify-honeypot="bot-field" novalidate>
  <input type="hidden" name="form-name" value="groups">
  <input type="hidden" name="subject" id="f-subject" value="Group quote">
  <input type="hidden" name="ref" id="f-ref" value="">
  <input type="hidden" name="currency" id="f-currency" value="US$"><input type="hidden" name="airline" value="">
  <p class="hp" aria-hidden="true"><label>Leave this field empty <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>
  <datalist id="places">${f.places.map((p) => `<option value="${esc(p)}">`).join("")}</datalist>
  <datalist id="hotels-list">${f.hotelNames.map((p) => `<option value="${esc(p)}">`).join("")}</datalist>
  <div class="progress" aria-hidden="true">${[1, 2, 3, 4].map((i) => `<i data-dot="${i}"${i === 1 ? ' class="on"' : ""}></i>`).join("")}</div>

  ${screen(1, "Pick yours", `<div class="who-grid">${who}</div>${wizNav(1)}`)}

  ${screen(2, "The trip", `
    ${part("groups", `
      ${hotels("f-hotel-g")}
      ${style(f, "Beach, pool, walking distance to shops, a conference room, adults only, the things that matter to your group", true)}
      ${datePair("checkin", "checkout", "Check-in", "Check-out")}
      ${flexDates("g", "Check-in", "Check-out")}
`)}
    ${part("overseas", `
      ${row("What's the occasion?", chips("occasion", f.occasions, { req: true }), { req: true })}
      ${datePair("arrival", "departure", "Arrival", "Departure")}
      ${flexDates("o", "Arrival", "Departure")}
      ${tick("staggered", "Some people arrive or leave on other days")}
      <div class="field" data-show="staggered:Yes" hidden><label for="f-staggered_notes">Who arrives or leaves when?</label><textarea id="f-staggered_notes" name="staggered_notes" rows="2" placeholder="e.g. 6 arrive Friday, 4 on Saturday, 2 stay an extra week"></textarea></div>
      ${row("Flying into", chips("airport_in", f.airportsIn, { req: true }), { req: true })}
      ${place("f-place-o", "Where in Jamaica?", "A town or a resort area. Not decided yet is fine to type.")}
      ${hotels("f-hotel-o")}
      ${style(f, "Beach, all inclusive, adults only, near the wedding venue, a villa for the family, the things that matter")}`)}
    ${part("trips", `
      ${place("f-place-t", "Where to?", "Country or city.")}
      ${tripHotels}
      <div data-show="hotel:Pick one for me" hidden>
        ${row("What kind of hotel?", chips("tier", f.tiers, { req: true }), { req: true })}
        <div class="q"><span class="ql">What do you want or expect?${REQ} <span class="hint">Mention specific tours, set-ups, and anything else that matters.</span></span><textarea name="expect" rows="2" placeholder="Beach or city, all inclusive, nightlife nearby, a pool, the things that matter to your group" data-req="1"></textarea></div>
      </div>
      <div data-show="place:!Panama City|Punta Cana" hidden>${style(f, "Beach or city, all inclusive, nightlife nearby, a pool, the things that matter to your group")}</div>
      ${datePair("depart", "return", "Departure", "Return")}
      ${flexDates("t", "Departure", "Return")}
      ${row("Flying from", chips("airport", f.airportsOut, { on: "Kingston", req: true }), { req: true })}
      <div data-show="airport:Another airport" hidden>${field("airport_other", "Which airport?", { req: true, placeholder: "For example Miami, Nassau or Port of Spain", id: "f-airport-other" })}</div>`)}
    ${wizNav(2)}`, "Dates and numbers are what let us price it.")}

  ${screen(3, "The people", `
    ${part("groups", `
      ${peopleRows(f)}
      <div class="fields-2">
        ${row("Type of group", chips("org_type", f.orgTypes, { req: true }), { req: true })}
        ${field("org_name", "Group name", { req: true, placeholder: "e.g. Faith Tabernacle, Smith family reunion" })}
      </div>
      ${field("your_role", "Your role", { placeholder: "e.g. treasurer, HR manager, organiser" })}
      ${tick("meeting", "We need a meeting or event room")}
      <div data-show="meeting:Yes" hidden>
        <div class="numrow">${num("meeting_capacity", "People in the meeting room", "", 1, 2000)}${num("meeting_days", "Meeting days", "", 1, 30)}</div>
        ${row("Catering", chips("catering", f.catering, { multi: true }))}
      </div>`)}
    ${part("overseas", `
      ${peopleRows(f)}
      ${row("Where is the group coming from?", chips("coming_from", f.comingFrom, { req: true }), { req: true })}
      ${field("org_name", "Group name", { placeholder: "e.g. the Campbell reunion, St Mark's choir", id: "f-org_name-o" })}`)}
    ${part("trips", `
      ${peopleRows(f, 10)}
      <div class="q"><span class="ql">Ready to book now <span class="hint">How many people can hold their spot today, US$95 each.</span></span><div class="numrow"><label class="numbox hi"><span>People</span><input type="number" name="ready_now" value="0" min="0" max="500" inputmode="numeric"></label></div></div>
      <div class="fields-2">
        ${row("You are", chips("role", f.roles, { on: "Group leader", req: true }), { req: true })}
        ${field("org_name", "Group name", { placeholder: "e.g. Mount Zion youth group", id: "f-org_name-t" })}
      </div>`)}
    ${wizNav(3)}`)}

  ${screen(4, "You", `
    <div class="fields-2">
      ${field("name", "Your name", { req: true, id: "g-name", extra: ' autocomplete="name"' })}
      ${field("email", "Email", { type: "email", req: true, hint: "the quote comes here", id: "g-email", extra: ' class="key" autocomplete="email" inputmode="email"' })}
      ${field("phone", "Phone", { type: "tel", req: true, hint: "with the country code if outside Jamaica", id: "g-phone", extra: ' autocomplete="tel" inputmode="tel"' })}
      <div class="field" data-branches="groups"><label for="g-based">Where are you based?${REQ}</label><select id="g-based" name="based" data-req="1"><option value="">Choose</option>${f.based.map((b) => `<option>${esc(b)}</option>`).join("")}</select></div>
    </div>
    ${row("Do you decide, or are you booking for someone?", chips("decides", f.decides, { on: "I decide" }))}
    ${row("Do you need an invoice?", chips("invoice", f.invoice, { req: true }), { req: true })}
    <div class="fields-2">
      ${row("Where is the trip at?", chips("status", f.status, { req: true }), { req: true })}
      ${field("quote_by", "When do you need the quote by?", { type: "date" })}
    </div>
    <div class="field"><label for="g-notes">Anything else we should know?</label><textarea id="g-notes" name="notes" rows="3" placeholder="Grandma on the ground floor, a birthday on the trip, a wheelchair, an early flight, the tricky bits."></textarea></div>
    <div class="brief on-alt brief-final"><span class="kicker">Check your brief</span><div class="brief-box" id="brief-final"></div><span class="small">This is what we price from. Use Back to change anything.</span></div>
    <p class="small">${esc(f.privacy)} <a href="/privacy/" style="text-decoration: underline">Privacy</a></p>
    ${wizNav(4, true)}`, "So the quote reaches the right person, and so we can call if a date or a rate needs checking.")}
</form>

<aside class="side">
  <div class="brief on-alt"><span class="kicker">Your brief so far</span><div class="brief-box" id="brief-box"><span><b>You are</b> booking rooms</span><span><b>Quote to</b> [your email]</span></div><span class="small">This is exactly what our travel professionals read. Starred rows are what they price from.</span></div>
  <div class="next"><span class="kicker">What happens next</span>${f.next.map((n, i) => `<div class="step-card"><span class="n">${i + 1}</span><div><b>${esc(T(n.title))}</b><span>${esc(n.text)}</span></div></div>`).join("")}</div>
  <div class="people-pill"><span class="pill-dot" aria-hidden="true"></span><span><b>Real people, in Jamaica.</b> Our travel professionals read every one of these.</span></div>
</aside>
</div>
</main>
${footer(true)}
${scripts()}
</body>
</html>
`;
}

/* ---------- sent ---------- */
function sent() {
  const s = G.sent;
  return `${head({ title: "Your group quote is on its way | Golden Vacation & Travel", description: `Your brief is with our travel professionals. Your quote lands by email within ${G.turnaround}.`, pathname: `${BASE}/sent/`, image: "rooms-resort", noindex: true })}
<body class="groups groups-sent">
${nav({ here: false, back: true })}
<main class="wrap" id="sent">
<div class="sent-grid">
  <div class="sent-main">
    <div class="sent-ok"><i>${icon("check", 20, 3.2, "#FFFFFF")}</i>Sent</div>
    <h1 class="h1">${esc(s.title)}</h1>
    <p class="lead">${esc(T(s.text))}</p>
    <div class="ref-row"><span class="ref" id="sent-ref">Ref</span><span class="small">${esc(s.refNote)}</span></div>
    <div class="sent-btns"><a class="btn" href="${BASE}/">Back to groups</a><a class="btn btn-outline" href="${BASE}/#trips">See the trips</a></div>
  </div>
  <div class="brief on-alt"><span class="kicker">${esc(s.briefTitle)}</span><div class="brief-box" id="brief-box"></div><span class="small">${esc(s.fixNote)}</span></div>
</div>
<div class="people-pill" style="margin-top:32px"><span class="pill-dot" aria-hidden="true"></span><span><b>Real people, in Jamaica.</b> ${esc(s.peopleLine)}</span></div>
</main>
${footer(true)}
${scripts()}
</body>
</html>
`;
}

/* ---------- /groups/copa/: Copa Airlines group fares. One look from top to bottom (black bands at each end, one card style,
   gold for numbers and icons) and a hard sell: the price hook up top, what the group gets, the trip, where Copa goes, how, proof, ask. ---------- */
function copa() {
  /* Where to: the places Copa groups go, and the hotels we sell there (from data/hotels.json, Jamaica left out) */
  const HOTELS = (() => { const raw = JSON.parse(fs.readFileSync(path.join(ROOT, "data/hotels.json"), "utf8")); return (Array.isArray(raw) ? raw : raw.hotels || []).filter((h) => !/jamaica/i.test(h.country || "")); })();
  const tripHotels = G.trips.destinations.flatMap((d) => d.hotels.map((ht) => ht.name.toLowerCase()));
  /* hotels offered in the hotel step: [name, city, country, stars, from US$ (Panama City group trip only), group trip] */
  const panTrip = Object.fromEntries(G.trips.destinations.filter((d) => d.id === "panama").flatMap((d) => d.hotels.map((ht) => [ht.name.toLowerCase(), ht.usd])));
  const HOT = HOTELS.map((h) => { const k = Object.keys(panTrip).find((t) => h.name.toLowerCase().includes(t)); return [h.name, h.city, h.country, /^\d star/.test(h.star_rating || "") ? h.star_rating.slice(0, 6) : "", k ? panTrip[k] : 0, k ? 1 : 0]; });
  const TO = [["d", "Panama City", "Panama"], ["d", "Lima", "Peru"], ["d", "Medellín", "Colombia"], ["d", "Bogotá", "Colombia"], ["d", "San José", "Costa Rica"], ["d", "Punta Cana", "Dominican Republic"], ["d", "Kingston", "Jamaica"], ["d", "Montego Bay", "Jamaica"], ["d", "Panama + Lima", "Two countries"], ["d", "Panama + Medellín", "Two countries"], ["d", "Ocho Rios", "Jamaica"], ["d", "Negril", "Jamaica"], ["d", "Runaway Bay", "Jamaica"], ["d", "South Coast", "Jamaica"],
    ["d", "Cartagena", "Colombia"], ["d", "Cancún", "Mexico"], ["d", "Mexico City", "Mexico"], ["d", "Havana", "Cuba"], ["d", "Santo Domingo", "Dominican Republic"], ["d", "Aruba", "Aruba"], ["d", "Curaçao", "Curaçao"], ["d", "Nassau", "Bahamas"], ["d", "Barbados", "Barbados"], ["d", "Port of Spain", "Trinidad and Tobago"],
    ["d", "Orlando", "USA"], ["d", "Miami", "USA"], ["d", "New York", "USA"], ["d", "Atlanta", "USA"], ["d", "Washington DC", "USA"], ["d", "Las Vegas", "USA"], ["d", "Los Angeles", "USA"], ["d", "Toronto", "Canada"],
    ["d", "London", "United Kingdom"], ["d", "Paris", "France"], ["d", "Rome", "Italy"], ["d", "Madrid", "Spain"], ["d", "Amsterdam", "Netherlands"], ["d", "Israel (Holy Land)", "Israel"], ["d", "Dubai", "United Arab Emirates"],
    ["d", "Accra", "Ghana"], ["d", "Lagos", "Nigeria"], ["d", "Johannesburg", "South Africa"], ["d", "Cape Town", "South Africa"]]
    .concat(HOTELS.map((h) => ["h", h.name, h.city, h.country, tripHotels.some((t) => h.name.toLowerCase().includes(t)) ? 1 : 0]).sort((a, b) => b[4] - a[4]));
  const tr = G.trips, pan = tr.destinations.find((d) => d.id === "panama");
  const from = Math.min(...pan.hotels.map((h) => h.usd));
  const Q = `${BASE}/enquire/?branch=trips`;
  const svg = (inner) => `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  const perks = [
    [svg('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>'), "Pay over time", `US$${fmt(G.hold.usd)} holds each seat, non-refundable. The rest can be paid over time.`],
    [svg('<rect x="4" y="7" width="16" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M9 12v4M15 12v4"/>'), "Bags included", "A personal item, a carry-on and a checked bag for everyone in the group."],
    [svg('<path d="M7 11V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v5"/><path d="M5 11a2 2 0 0 1 2 2v1h10v-1a2 2 0 1 1 4 0v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z"/>'), "Seat selection", "Pick seats for the whole group, so you travel together."],
    [svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>'), "One quote, whole trip", "Flights, hotel and airport transfers on one quote. Organisations can pay by invoice."],
  ];
  const places = [["Panama City", "/assets/img/tile-panama.jpg", "Panama City skyline lit up at night"], ["Lima", "/assets/img/tile-lima.jpg", "Lima's Miraflores cliffs over the Pacific"], ["Medellín", "/assets/img/tile-medellin.jpg", "Medellín's city centre below the mountains"], ["Panama + Lima", "/assets/img/deal-panama.jpg", "Casco Viejo in Panama City from above"]];
  const steps = [["Tell us about the trip", "Dates, how many are going, where from and where to."], ["Get your quote", "Group fare, hotel and transfers, within TURNAROUND."], ["Hold the seats", `US$${fmt(G.hold.usd)} each holds your place. Pay the rest over time.`]];
  const faq = [
    ["Can we book a Copa group fare online?", "No. copa.com takes up to 8 people in one booking, and 10 or more count as a group, handled by Copa's call centre, its sales offices or a travel agency. We handle it for you, with the hotel and transfers."],
    ["How many people make a group?", "Ten or more, travelling together on the same flights."],
    ["Do we need everyone's names now?", "No. The seats are held first, and the names are due by the date in your quote."],
    ["What if Copa doesn't fly where we're going?", "We'll recommend the airline that works best for your group and quote it the same way: one price for flights, hotel and transfers, with a payment plan."],
    ["Where can we fly from?", "Most groups fly from Montego Bay (MBJ) or Kingston (KIN), and we also arrange flights from airports in the USA, across the Caribbean and beyond."],
    ["Are you Copa Airlines?", "No. We're Golden Vacation & Travel, an independent IATA-accredited travel agency with offices in Jamaica and Florida. We book Copa group fares for our clients."],
  ];
  const ld = [
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: `${S.origin}/` }, { "@type": "ListItem", position: 2, name: "Groups", item: `${S.origin}${BASE}/` }, { "@type": "ListItem", position: 3, name: "Copa group fares", item: `${S.origin}${BASE}/copa/` }] },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
  ];
  const css = `<style>
.cp{--cp-r:22px}
.cp-band{background:var(--ink,#0E0F0E);color:#fff}
.cpg{background:var(--gold,#F2B93B);color:#0E0F0E;overflow:hidden}
.cpg-in{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:40px;align-items:center;padding-top:64px;padding-bottom:150px}
.cpg .kicker{color:#0E0F0E;opacity:.72}
.cpg h1{font-size:clamp(44px,5.6vw,76px);line-height:.98;letter-spacing:-.02em;margin:12px 0 18px;color:#0E0F0E}
.cpg-sub{font-size:18px;line-height:1.6;color:rgba(14,15,14,.82);max-width:540px;margin:0 0 24px}
.cpg-trust{display:flex;gap:10px 18px;flex-wrap:wrap;font-size:13px;font-weight:800}
.cpg-trust span:before{content:"";display:inline-block;width:7px;height:7px;border-radius:50%;background:#0E0F0E;margin-right:8px;vertical-align:1px}
.cpg-art{position:relative;justify-self:center}
.cpg-art img{display:block;width:360px;height:440px;object-fit:cover;border-radius:22px;border:8px solid #fff;transform:rotate(3deg);box-shadow:0 24px 50px rgba(14,15,14,.25)}
.cpg-stk{position:absolute;left:-44px;bottom:30px;width:152px;height:152px;border-radius:50%;background:#0E0F0E;color:var(--gold,#F2B93B);display:flex;flex-direction:column;align-items:center;justify-content:center;transform:rotate(-8deg);text-decoration:none;box-shadow:0 14px 30px rgba(14,15,14,.3);transition:transform .2s}
.cpg-stk:hover{transform:rotate(-4deg) scale(1.04)}
.cpg-stk b{font-size:34px;font-weight:900;font-stretch:112%;line-height:1}
.cpg-stk small{font-size:11px;font-weight:700;color:#fff}
@media (max-width:900px){
  .cpg-in{grid-template-columns:1fr;gap:34px;padding-top:36px;padding-bottom:120px}
  .cpg-art img{width:min(74vw,300px);height:auto;aspect-ratio:9/11}
  .cpg-stk{left:-12px;bottom:16px;width:124px;height:124px}
  .cpg-stk b{font-size:27px}
}

.cp-offer{display:flex;align-items:center;justify-content:space-between;gap:20px;margin:28px 0 22px;padding:18px 20px;max-width:560px;border:1px solid rgba(255,255,255,.18);border-radius:20px;background:rgba(255,255,255,.05);color:#fff;text-decoration:none;transition:border-color .2s}
.cp-offer:hover{border-color:rgba(242,185,59,.75)}
.cp-offer-l b{display:block;font-size:16px;font-weight:800}
.cp-offer-l small{display:block;margin-top:4px;font-size:14px;line-height:1.5;color:rgba(255,255,255,.7)}
.cp-offer-r{flex:none;text-align:right}
.cp-offer-r small{display:block;font-size:12px;font-weight:700;color:rgba(255,255,255,.62)}
.cp-offer-r b{display:block;font-size:30px;line-height:1.05;font-weight:900;font-stretch:112%;letter-spacing:-.01em;color:var(--gold,#F2B93B)}
.cp-trust{font-size:13px!important;margin-top:0!important}

.cp-hero{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);gap:48px;align-items:center;padding-top:56px;padding-bottom:60px}
.cp-hero .kicker{color:var(--gold,#F2B93B)}
.cp-hero h1{color:#fff;font-size:clamp(42px,5.2vw,72px);line-height:.96;letter-spacing:-.02em;margin:12px 0 18px}
.cp-hero h1 em{font-style:normal;color:var(--gold,#F2B93B)}
.cp-sub{font-size:18px;line-height:1.6;color:rgba(255,255,255,.78);max-width:540px;margin:0}
.cp-price{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin:24px 0 6px}
.cp-price b{font-size:clamp(34px,4vw,48px);font-weight:900;font-stretch:112%;color:var(--gold,#F2B93B);letter-spacing:-.02em;line-height:1}
.cp-price span{font-size:15px;font-weight:700;color:#fff}
.cp-inc{font-size:14px;color:rgba(255,255,255,.72);margin-bottom:24px}
.cp-ctas{display:flex;gap:10px;flex-wrap:wrap}
.cp-btn{display:inline-flex;align-items:center;justify-content:center;height:54px;padding:0 26px;border-radius:999px;font-weight:800;font-size:16px;text-decoration:none;border:2px solid transparent}
.cp-gold{background:var(--gold,#F2B93B);color:#0E0F0E}
.cp-gold:hover{filter:brightness(1.05)}
.cp-ghost{border-color:rgba(255,255,255,.7);color:#fff}
.cp-ghost:hover{border-color:#fff}
.cp-dark{background:#0E0F0E;color:#fff}
.cp-trust{display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:22px;font-size:13px;font-weight:700;color:rgba(255,255,255,.75)}
.cp-trust span:before{content:"";display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--gold,#F2B93B);margin-right:8px;vertical-align:1px}
.cp-photo{position:relative;border-radius:var(--cp-r);overflow:hidden;aspect-ratio:4/5;max-height:600px;justify-self:end;width:100%;max-width:480px}
.cp-photo img{width:100%;height:100%;object-fit:cover;display:block}
.cp-badge{position:absolute;left:16px;right:16px;bottom:16px;background:#fff;color:#0E0F0E;border-radius:16px;padding:14px 16px;font-size:14px;line-height:1.35}
.cp-badge b{display:block;font-size:16px;font-weight:900}
.cp-sec{padding:72px 0}
.cp-sec.alt{background:var(--alt,#F3F3EF)}
.cp-h2{font-size:clamp(30px,3.6vw,46px);line-height:1;letter-spacing:-.02em;font-weight:900;font-stretch:112%;margin:8px 0 12px}
.cp-lead{font-size:17px;line-height:1.55;color:rgba(14,15,14,.72);max-width:720px}
.cp-perks{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-top:30px}
.cp-card{background:#fff;border:2px solid var(--line,#E4E4DF);border-radius:var(--cp-r);padding:22px}
.cp-perk .ic{width:52px;height:52px;border-radius:50%;background:#FBEFCF;color:#8A6D12;display:grid;place-items:center;margin-bottom:14px}
.cp-perk b{display:block;font-size:18px;font-weight:900;margin-bottom:6px}
.cp-perk span{font-size:15px;line-height:1.5;color:rgba(14,15,14,.72)}
.cp-trip{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:0;background:#fff;border:2px solid var(--ink,#0E0F0E);border-radius:var(--cp-r);overflow:hidden;margin-top:30px}
.cp-trip-img img{width:100%;height:100%;object-fit:cover;display:block;min-height:320px}
.cp-trip-body{padding:28px;display:flex;flex-direction:column;gap:14px}
.cp-dep{align-self:flex-start;display:inline-flex;align-items:center;gap:6px;background:#FBEFCF;color:#8A6D12;font-weight:800;font-size:13px;padding:6px 12px;border-radius:999px;margin-bottom:-4px}
.cp-trip-body h3{font-size:28px;font-weight:900;font-stretch:112%;letter-spacing:-.01em;line-height:1.05}
.cp-trip-price b{font-size:34px;font-weight:900;font-stretch:112%}
.cp-trip-price span{font-weight:700;color:rgba(14,15,14,.6);margin-left:6px}
.cp-chips{display:flex;flex-wrap:wrap;gap:6px}
.cp-chips span{font-size:13px;font-weight:700;padding:6px 12px;border-radius:999px;background:var(--alt,#F3F3EF)}
.cp-hotel{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-top:2px solid var(--line,#E4E4DF)}
.cp-hotel b{font-size:16px;font-weight:800}
.cp-hotel small{display:block;font-size:14px;color:rgba(14,15,14,.62)}
.cp-hotel .cp-btn{height:44px;padding:0 18px;font-size:14px}
.cp-fine{font-size:13px;color:rgba(14,15,14,.55)}
.cp-places{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-top:30px}
.cp-place{position:relative;display:block;border-radius:var(--cp-r);overflow:hidden;aspect-ratio:3/4;color:#fff;text-decoration:none}
.cp-place img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transition:transform .35s}
.cp-place:hover img{transform:scale(1.04)}
.cp-place:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(14,15,14,0) 40%,rgba(14,15,14,.82))}
.cp-place span{position:absolute;left:18px;right:18px;bottom:18px;z-index:1}
.cp-place b{display:block;font-size:22px;font-weight:900;font-stretch:112%}
.cp-place small{font-size:13px;font-weight:700;color:var(--gold,#F2B93B)}
.cp-more{margin-top:16px;font-size:15px;font-weight:700}
.cp-more span{display:inline-block;padding:6px 12px;border-radius:999px;border:2px solid var(--ink,#0E0F0E);margin:4px 6px 0 0;font-size:13px}
.cp-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:30px}
.cp-step .n{font-size:56px;font-weight:900;font-stretch:112%;color:var(--gold,#F2B93B);line-height:.9;display:block;margin-bottom:10px}
.cp-step b{display:block;font-size:19px;font-weight:900;margin-bottom:6px;color:#fff}
.cp-step span{font-size:15px;line-height:1.5;color:rgba(255,255,255,.75)}
.cp-steps .cp-card{background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.14)}
.cp-proof{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-top:40px;padding-top:28px;border-top:1px solid rgba(255,255,255,.16)}
.cp-proof b{display:block;color:#fff;font-size:16px;font-weight:900}
.cp-proof small{color:var(--gold,#F2B93B);font-weight:700;font-size:14px}
.cp-faq{margin-top:26px;border-top:2px solid var(--line,#E4E4DF)}
.cp-faq details{border-bottom:2px solid var(--line,#E4E4DF);padding:18px 0}
.cp-faq summary{cursor:pointer;list-style:none;font-weight:900;font-size:18px;display:flex;justify-content:space-between;gap:16px}
.cp-faq summary::-webkit-details-marker{display:none}
.cp-faq summary:after{content:"+";font-size:26px;line-height:1;color:#8A6D12}
.cp-faq details[open] summary:after{content:"\\2212"}
.cp-faq p{margin-top:10px;font-size:16px;line-height:1.6;color:rgba(14,15,14,.72);max-width:820px}
.cp-final{text-align:center;padding:76px 0}
.cp-final h2{color:#fff}

.cp-note{font-size:12px;color:rgba(14,15,14,.5);padding-top:18px;padding-bottom:18px}
.cp-other{margin:-14px 0 22px}
.cp-other a{color:var(--gold,#F2B93B);font-weight:800;font-size:15px;text-decoration:underline;text-underline-offset:3px}
.cp-quote{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,1.1fr);gap:44px;align-items:start;text-align:left}
.cp-quote-head p{color:rgba(255,255,255,.75);font-size:17px;line-height:1.55;margin:10px 0 18px}
.cp-ticks{list-style:none;display:flex;flex-direction:column;gap:10px;padding:0;margin:0}
.cp-ticks li{color:#fff;font-weight:700;font-size:15px}
.cp-ticks li:before{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--gold,#F2B93B);margin-right:10px;vertical-align:1px}
.cp-form{background:#fff;color:#0E0F0E;border-radius:22px;padding:26px;display:grid;grid-template-columns:1fr 1fr;gap:14px}
.cp-f{display:flex;flex-direction:column;gap:6px}
.cp-f.full{grid-column:1/-1}
.cp-f label{font-size:13px;font-weight:800}
.cp-opt{font-weight:600;color:rgba(14,15,14,.5)}
.cp-f input,.cp-f select,.cp-f textarea{font:inherit;font-size:16px;padding:12px 14px;border:2px solid var(--line,#E4E4DF);border-radius:12px;background:#fff;color:#0E0F0E;width:100%;box-sizing:border-box}
.cp-f input:focus,.cp-f select:focus,.cp-f textarea:focus{outline:none;border-color:#0E0F0E}
.cp-form .cp-btn{grid-column:1/-1;width:100%;border:0;cursor:pointer;font-family:inherit}
.cp-err{grid-column:1/-1;background:#FDECEA;color:#8A1C12;border-radius:12px;padding:10px 14px;font-weight:700;font-size:14px;margin:0}
.cp-form-note{grid-column:1/-1;font-size:13px;color:rgba(14,15,14,.55);text-align:center;margin:0}
.cp-hotel-note{grid-column:1/-1;justify-self:start;font-size:14px;font-weight:800;background:#FBEFCF;color:#8A6D12;border-radius:999px;padding:6px 12px;margin:0}
.cp-final{padding:76px 0}
.cp-airpref{display:flex;flex-direction:column;gap:8px;padding-bottom:18px;border-bottom:2px solid var(--line,#E4E4DF)}
.cp-inbound span{display:block;margin-top:6px;font-weight:600;color:rgba(14,15,14,.62);font-size:14px}
.cp-inbound{margin:16px 8px 0;font-size:15px}
.cp-inbound a{color:#0E0F0E;font-weight:800;text-decoration:underline;text-underline-offset:3px}
.cp-hhint{font-size:13px;color:rgba(14,15,14,.6);margin:0}
.cp-who-seg{position:relative}
.cp-who{font:inherit;font-size:17px;font-weight:700;border:0;padding:0;background:transparent;color:#0E0F0E;text-align:left;cursor:pointer;white-space:nowrap}
.cp-pop{position:absolute;top:calc(100% + 6px);right:0;width:320px;background:#fff;border:2px solid #0E0F0E;border-radius:18px;box-shadow:0 18px 44px rgba(14,15,14,.2);padding:16px;z-index:30;display:flex;flex-direction:column;gap:12px;cursor:default}
.cp-srow{display:flex;align-items:center;justify-content:space-between;gap:12px}
.cp-srow b{display:block;font-size:15px;font-weight:800}
.cp-srow small{font-size:12px;color:rgba(14,15,14,.55)}
.cp-stp{display:flex;align-items:center;gap:10px}
.cp-stp button{width:36px;height:36px;border-radius:50%;border:2px solid #0E0F0E;background:#fff;font:inherit;font-size:18px;font-weight:800;line-height:1;cursor:pointer;color:#0E0F0E}
.cp-stp span{min-width:26px;text-align:center;font-weight:800;font-size:16px}
.cp-ages{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:800}
.cp-pop .cp-ages input,.cp-hsearch input{font:inherit;font-size:16px;font-weight:600;padding:11px 14px;border:2px solid var(--line,#E4E4DF);border-radius:12px;width:100%;box-sizing:border-box}
.cp-pop .cp-ages input:focus,.cp-hsearch input:focus{outline:none;border-color:#0E0F0E}
.cp-pop-note{font-size:12px;color:rgba(14,15,14,.55);margin:0}
.cp-pop-done{height:44px;width:100%;border:0;cursor:pointer;font-family:inherit}
.cp-hsearch{display:flex;flex-direction:column;gap:6px;max-width:520px}
.cp-rooms{display:flex;flex-direction:column;gap:10px}
.cp-rgrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.cp-rgrid .cp-srow{border:2px solid var(--line,#E4E4DF);border-radius:14px;padding:10px 12px}
.cp-rsum{font-size:14px;font-weight:700;margin:0;color:#1F8A4C}
.cp-rsum.warn{color:#8A6D12}
.cp-hpick{display:flex;flex-direction:column;gap:12px;padding-bottom:18px;border-bottom:2px solid var(--line,#E4E4DF)}
.cp-hopts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.cp-hopt{display:flex;flex-direction:column;gap:3px;text-align:left;padding:14px 16px;border:2px solid var(--line,#E4E4DF);border-radius:16px;background:#fff;cursor:pointer;font:inherit;color:#0E0F0E}
.cp-hopt b{font-size:15px;font-weight:800}
.cp-hopt b span{font-size:11px;font-weight:800;background:#FBEFCF;color:#8A6D12;border-radius:999px;padding:2px 8px;margin-left:6px;vertical-align:2px}
.cp-hopt small{font-size:13px;color:rgba(14,15,14,.6)}
.cp-hopt:hover{border-color:rgba(14,15,14,.4)}
.cp-hopt.on{border-color:#0E0F0E;box-shadow:inset 0 0 0 1px #0E0F0E;background:#FFFBF0}
.cp-hopt:focus-visible,.cp-tier:focus-visible{outline:3px solid var(--gold,#F2B93B);outline-offset:2px}
.cp-tiers{display:flex;flex-direction:column;gap:8px}
.cp-tl{font-size:13px;font-weight:800}
.cp-tier-row{display:flex;flex-wrap:wrap;gap:8px}
.cp-tier{height:40px;padding:0 16px;border:2px solid #0E0F0E;border-radius:999px;background:#fff;font:inherit;font-weight:700;font-size:14px;cursor:pointer;color:#0E0F0E}
.cp-tier.on{background:#0E0F0E;color:#fff}
.cp-from-seg{position:relative}
.cp-sug{position:absolute;top:calc(100% + 6px);left:0;min-width:380px;max-height:340px;overflow:auto;background:#fff;border:2px solid #0E0F0E;border-radius:16px;box-shadow:0 18px 44px rgba(14,15,14,.2);padding:6px;z-index:30}
.cp-opt-row{display:flex;justify-content:space-between;align-items:baseline;gap:12px;padding:10px 12px;border-radius:10px;cursor:pointer}
.cp-opt-row b{font-weight:800;font-size:15px}
.cp-opt-row b span{font-weight:700;color:#8A6D12;margin-left:4px;font-size:13px}
.cp-opt-row small{font-size:12px;color:rgba(14,15,14,.55);white-space:nowrap}
.cp-opt-row:hover,.cp-opt-row.on{background:#F3F3EF}
.cp-opt-none{padding:10px 12px;font-size:13px;color:rgba(14,15,14,.6)}
.cp-hero{padding-bottom:128px!important}
.cp-barwrap{position:relative;z-index:3;margin-top:-84px}
.cp-bar{background:#fff;color:#0E0F0E;border-radius:30px;box-shadow:0 24px 60px rgba(14,15,14,.22);padding:10px}
.cp-row{display:grid;grid-template-columns:1.25fr 1.3fr 1fr 1fr .9fr auto;align-items:center}
.cp-seg{display:flex;flex-direction:column;gap:5px;padding:12px 20px;border-right:2px solid var(--line,#E4E4DF);min-width:0;cursor:pointer}
.cp-seg.cp-last{border-right:0}
.cp-l{font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:rgba(14,15,14,.55);white-space:nowrap}
.cp-seg select,.cp-seg input{font:inherit;font-size:17px;font-weight:700;border:0;padding:0;background:transparent;color:#0E0F0E;width:100%;min-width:0;outline:none;-webkit-appearance:none;appearance:none}
.cp-seg input::placeholder{color:rgba(14,15,14,.42);font-weight:600}
.cp-seg:focus-within .cp-l{color:#8A6D12}
.cp-go{height:64px;padding:0 26px;border:0;border-radius:999px;background:#0E0F0E;color:#fff;font:inherit;font-weight:800;font-size:16px;display:inline-flex;align-items:center;justify-content:center;gap:10px;cursor:pointer;white-space:nowrap;margin-left:6px}
.cp-go.done{background:var(--gold,#F2B93B);color:#0E0F0E}
.cp-extra{border-top:2px solid var(--line,#E4E4DF);margin:8px 10px 0}
.cp-extra .cp-seg{padding-left:10px}
.cp-bar .cp-hotel-note,.cp-bar .cp-err{margin:10px 10px 4px}
.cp-step2{border-top:2px solid var(--line,#E4E4DF);margin:10px 10px 0;padding:18px 0 8px;display:flex;flex-direction:column;gap:14px}
.cp-step2-t{font-weight:900;font-size:19px;margin:0}
.cp-contact{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
.cp-contact .cp-wide{grid-column:1/-1}
.cp-contact .cp-f span{font-size:13px;font-weight:800}
.cp-contact .cp-f em{font-style:normal;font-weight:600;color:rgba(14,15,14,.5)}
.cp-contact input{font:inherit;font-size:16px;padding:12px 14px;border:2px solid var(--line,#E4E4DF);border-radius:12px;width:100%;box-sizing:border-box;margin-top:6px}
.cp-contact input:focus{outline:none;border-color:#0E0F0E}
.cp-send{width:100%;border:0;cursor:pointer;font-family:inherit}
.cp-close{display:flex;flex-direction:column;align-items:center;text-align:center;gap:16px}
.cp-close h2{color:#fff}
.cp-close p{color:rgba(255,255,255,.75);font-size:17px;line-height:1.55;max-width:600px;margin:0}
.cp-close .cp-ticks{flex-direction:row;flex-wrap:wrap;justify-content:center;gap:10px 22px;margin:4px 0 8px}
@media (max-width:1100px){
  .cp-row{grid-template-columns:1fr 1fr}
  .cp-seg{border-right:0;border-bottom:2px solid var(--line,#E4E4DF)}
  .cp-go{grid-column:1/-1;margin:10px 0 0;width:100%}
  .cp-contact{grid-template-columns:1fr}
  .cp-hopts{grid-template-columns:1fr 1fr}
  .cp-rgrid{grid-template-columns:1fr 1fr}
  .cp-pop{left:0;right:auto;width:100%}
  .cp-barwrap{margin-top:-60px}
  .cp-hero{padding-bottom:92px!important}
}
@media (max-width:560px){ .cp-hopts{grid-template-columns:1fr} .cp-row{grid-template-columns:1fr} .cp-seg{padding:12px 14px} .cp-sug{min-width:0;left:0;right:0} }
@media (max-width:900px){
  .cp-quote{grid-template-columns:1fr;gap:24px}
  .cp-form{grid-template-columns:1fr;padding:20px}
  .cp-hero{grid-template-columns:1fr;gap:28px;padding-top:34px;padding-bottom:40px}
  .cp-photo{justify-self:stretch;max-width:none;aspect-ratio:4/3}
  .cp-perks,.cp-places,.cp-proof{grid-template-columns:repeat(2,minmax(0,1fr))}
  .cp-trip{grid-template-columns:1fr}
  .cp-trip-img img{min-height:220px;max-height:260px}
  .cp-steps{grid-template-columns:1fr}
  .cp-sec{padding:52px 0}
  .cp-btn{flex:1 1 auto}
}
@media (max-width:520px){ .cp-offer{flex-direction:column;align-items:flex-start;gap:10px} .cp-offer-r{text-align:left} .cp-perks{grid-template-columns:1fr} .cp-place{aspect-ratio:1/1} .cp-hotel{flex-wrap:wrap} .cp-hotel .cp-btn{flex:1 1 100%} }
</style>`;
  return `${head({ title: "Copa Airlines group fares for Caribbean groups | Golden Vacation & Travel", description: `Ten or more flying Copa from the Caribbean or the USA? Group fares with payment plans, included luggage and seat selection. Panama City group trips from US$${fmt(from)} per person.`, pathname: `${BASE}/copa/`, image: `${S.origin}/assets/img/deal-panama-peru.jpg`, jsonld: ld })}
<body class="groups">
${nav()}
<main class="cp">
${css}
<section class="cpg" id="top"><div class="wrap cpg-in">
  <div>
    <span class="kicker">For groups across the Caribbean</span>
    <h1 class="h1">Copa Airlines group fares</h1>
    <p class="cpg-sub">Access group benefits such as payment plans, included luggage and seat selection for your groups. We get your group fare and hotel and transfers in one rate.</p>
    <div class="cpg-trust"><span>IATA-accredited</span><span>${esc(T("Quote within TURNAROUND"))}</span><span>US$${fmt(G.hold.usd)} holds a seat</span></div>
  </div>
  <div class="cpg-art">
    <img src="/assets/img/deal-panama-peru.jpg" width="640" height="800" alt="A traveller with her arms up on a glass lookout over Panama City" fetchpriority="high">
    <a class="cpg-stk" href="#trip" data-track="copa-sticker"><small>Panama City from</small><b>US$${fmt(from)}</b><small>per person</small></a>
  </div>
</div></section>

<section class="cp-barwrap" id="quote"><div class="wrap">
<form class="cp-bar" id="cp-form" name="groups" method="POST" action="${BASE}/sent/" novalidate>
  <input type="hidden" name="form-name" value="groups"><input type="hidden" name="subject" value="Group quote · Copa page"><input type="hidden" name="branch" value="trips"><input type="hidden" name="ref" value=""><input type="hidden" name="currency" value="US$"><input type="hidden" name="hotel" value="">
  <p hidden><label>Leave this empty <input name="bot-field"></label></p>
  <div class="cp-row">
    <div class="cp-seg cp-from-seg"><label class="cp-l" for="cp-to">Where to</label><input id="cp-to" type="text" value="Panama City" autocomplete="off" spellcheck="false" placeholder="City or hotel" role="combobox" aria-expanded="false" aria-controls="cp-sug-to" aria-autocomplete="list"><div class="cp-sug" id="cp-sug-to" role="listbox" hidden></div><input type="hidden" name="place" value="Panama City"></div>
    <div class="cp-seg cp-from-seg"><label class="cp-l" for="cp-from">Flying from</label><input id="cp-from" type="text" value="Kingston (KIN)" autocomplete="off" spellcheck="false" placeholder="Type your city or airport" role="combobox" aria-expanded="false" aria-controls="cp-sug" aria-autocomplete="list"><div class="cp-sug" id="cp-sug" role="listbox" hidden></div><input type="hidden" name="airport" value="Kingston"><input type="hidden" name="airport_other" value=""></div>
    <label class="cp-seg"><span class="cp-l">Leaving</span><input name="depart" type="date"></label>
    <label class="cp-seg"><span class="cp-l">Coming back</span><input name="return" type="date"></label>
    <div class="cp-seg cp-last cp-who-seg"><span class="cp-l">Travellers</span><button type="button" class="cp-who" id="cp-who" aria-expanded="false" aria-controls="cp-pop">10 adults</button>
      <div class="cp-pop" id="cp-pop" hidden>
        <div class="cp-srow"><div><b>Adults</b><small>12 and over</small></div><div class="cp-stp"><button type="button" data-k="adults" data-d="-1" aria-label="One adult fewer">&minus;</button><span id="cp-n-adults">10</span><button type="button" data-k="adults" data-d="1" aria-label="One adult more">+</button></div></div>
        <div class="cp-srow"><div><b>Children</b><small>2 to 11</small></div><div class="cp-stp"><button type="button" data-k="children" data-d="-1" aria-label="One child fewer">&minus;</button><span id="cp-n-children">0</span><button type="button" data-k="children" data-d="1" aria-label="One child more">+</button></div></div>
        <label class="cp-ages" id="cp-ages" hidden><span>Children's ages</span><input type="text" id="cp-ages-in" inputmode="numeric" placeholder="For example 4, 7, 10"></label>
        <p class="cp-pop-note">Group fares start at 10 travellers.</p>
        <button type="button" class="cp-btn cp-dark cp-pop-done" id="cp-pop-done">Done</button>
      </div>
      <input type="hidden" name="adults" value="10"><input type="hidden" name="children" value="0"><input type="hidden" name="child_ages" value="">
    </div>
    <button class="cp-go" type="button" id="cp-next" data-track="copa-next">Get my group price <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
  </div>
  <p class="cp-hotel-note" id="cp-hotel-note" hidden></p>
  <p class="cp-err" id="cp-err" role="alert" hidden></p>
  <div class="cp-step2" id="cp-step2" hidden>
    <div class="cp-hpick" id="cp-hpick">
      <p class="cp-step2-t">Pick your hotel</p>
      <div class="cp-hopts" id="cp-hopts" role="radiogroup" aria-label="Hotel"></div>
      <div class="cp-hsearch cp-from-seg"><label class="cp-tl" for="cp-hs">Have a hotel in mind?</label><input id="cp-hs" type="text" autocomplete="off" spellcheck="false" placeholder="Search hotels and resorts" role="combobox" aria-expanded="false" aria-controls="cp-sug-h" aria-autocomplete="list"><div class="cp-sug" id="cp-sug-h" role="listbox" hidden></div></div>
      <div class="cp-tiers" id="cp-tiers" hidden><span class="cp-tl">What kind of hotel?</span><div class="cp-tier-row">${G.form.tiers.map((t) => `<button type="button" class="cp-tier" data-tier="${esc(t)}">${esc(t)}</button>`).join("")}</div></div>
      <input type="hidden" name="tier" value="">
      <div class="cp-rooms" id="cp-rooms"><span class="cp-tl">Rooms</span>
        <div class="cp-rgrid">${[["single", "Single", "1 person"], ["double", "Double", "2 people"], ["triple", "Triple", "3 people"], ["quad", "Quad", "4 people"]].map(([k, l, n]) => `<div class="cp-srow"><div><b>${l}</b><small>${n}</small></div><div class="cp-stp"><button type="button" data-r="${k}" data-d="-1" aria-label="One ${l.toLowerCase()} room fewer">&minus;</button><span id="cp-r-${k}">0</span><button type="button" data-r="${k}" data-d="1" aria-label="One ${l.toLowerCase()} room more">+</button></div><input type="hidden" name="r_${k}" value="0"></div>`).join("")}</div>
        <p class="cp-rsum" id="cp-rsum"></p>
      </div>
    </div>
    <p class="cp-step2-t">Where should we send your price?</p>
    <div class="cp-contact">
      <label class="cp-f cp-wide"><span>Group name</span><input name="org_name" type="text" placeholder="For example Faith Tabernacle Youth Choir, or the Brown family reunion"></label>
      <label class="cp-f"><span>Your name</span><input name="name" type="text" autocomplete="name"></label>
      <label class="cp-f"><span>Email</span><input name="email" type="email" autocomplete="email"></label>
      <label class="cp-f"><span>Phone</span><input name="phone" type="tel" autocomplete="tel"></label>
      <label class="cp-f cp-wide"><span>Anything else? <em>optional</em></span><input name="notes" type="text" placeholder="The occasion, hotel wishes, anything we should know"></label>
    </div>
    <button class="cp-btn cp-gold cp-send" type="submit" data-track="copa-send">Send my request</button>
    <p class="cp-form-note">We reply by email within ${esc(G.turnaround)}. Your details are only used for your quote.</p>
  </div>
</form>
</div></section>

<section class="cp-sec"><div class="wrap">
  <span class="kicker">What your group gets</span>
  <h2 class="cp-h2">Group perks you can't get anywhere else.</h2>
  <p class="cp-lead">Copa doesn't sell group fares online. We get yours, with everything below built in.</p>
  <div class="cp-perks">${perks.map(([ic, t, x]) => `<div class="cp-card cp-perk"><div class="ic">${ic}</div><b>${esc(t)}</b><span>${esc(x)}</span></div>`).join("")}</div>
</div></section>

<section class="cp-sec alt" id="trip"><div class="wrap">
  <span class="kicker">A group trip on Copa</span>
  <h2 class="cp-h2">Panama City, ready to book.</h2>
  <div class="cp-trip">
    <div class="cp-trip-img">${pic(pan.img, pan.alt, [720, 1440], "(min-width: 900px) 46vw, 90vw")}</div>
    <div class="cp-trip-body">
      <span class="cp-dep">Flights from Kingston (KIN)</span>
      <h3>${esc(pan.name)} group trip</h3>
      <div class="cp-trip-price"><b>From US$${fmt(from)}</b><span>per person · ${esc(pan.meta)}</span></div>
      <div class="cp-chips">${pan.includes.map((x) => `<span>${esc(x)}</span>`).join("")}</div>
      <div>${pan.hotels.map((ht) => `<div class="cp-hotel"><div><b>${esc(ht.name)}</b><small>From US$${fmt(ht.usd)} per person</small></div><a class="cp-btn cp-dark" href="#quote" data-place="${esc(pan.name)}" data-hotel="${esc(ht.name)}" data-track="copa-hotel">Hold seats</a></div>`).join("")}</div>
      <p class="cp-fine">Starting prices per person for ten adults flying from Kingston (KIN), based on double occupancy, taxes included. Your dates set the final price, and other airports are priced on request.</p>
    </div>
  </div>
</div></section>

<section class="cp-sec"><div class="wrap">
  <span class="kicker">Where Copa can take your group</span>
  <h2 class="cp-h2">Panama City and over 80 more.</h2>
  <p class="cp-lead">Copa flies from across the Caribbean to Panama City, and on to over 80 destinations across the Americas.</p>
  <div class="cp-places">${places.map(([n, src, alt]) => `<a class="cp-place" href="#quote" data-place="${esc(n)}" data-track="copa-place"><img src="${src}" alt="${esc(alt)}" loading="lazy"><span><b>${esc(n)}</b><small>Get a group fare</small></span></a>`).join("")}</div>
  <p class="cp-more">Also <span>Bogotá</span><span>San José</span><span>and more</span></p>
</div></section>

<section class="cp-band cp-sec"><div class="wrap">
  <span class="kicker" style="color:var(--gold,#F2B93B)">How it works</span>
  <h2 class="cp-h2" style="color:#fff">Three steps to seats held.</h2>
  <div class="cp-steps">${steps.map(([t, x], i) => `<div class="cp-card cp-step"><span class="n">${i + 1}</span><b>${esc(t)}</b><span>${esc(T(x))}</span></div>`).join("")}</div>
  <div class="cp-proof"><div><b>Thousands of travellers</b><small>since 2021</small></div><div><b>IATA-accredited</b><small>travel agency</small></div><div><b>Offices</b><small>in Jamaica and Florida</small></div><div><b>Quotes</b><small>${esc(T("within TURNAROUND"))}</small></div></div>
</div></section>

<section class="cp-sec" id="faq"><div class="wrap">
  <h2 class="cp-h2">Copa group fares, answered.</h2>
  <div class="cp-faq">${faq.map(([q, a], i) => `<details${i === 0 ? " open" : ""}><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}</div>
</div></section>

<section class="cp-band cp-final"><div class="wrap cp-close">
  <h2 class="cp-h2">Ready to fly your group on Copa?</h2>
  <p>Group seats are limited on every flight, so the sooner you hold, the more choice you have. Your quote comes by email within ${esc(G.turnaround)}.</p>
  <ul class="cp-ticks"><li>Nothing to pay to ask</li><li>US$${fmt(G.hold.usd)} holds each seat when you're ready</li><li>Flights, hotel and transfers in one price</li></ul>
  <a class="cp-btn cp-gold" href="#quote" data-track="copa-cta">Get my group price</a>
</div></section>
<script>
(function () {
  var f = document.getElementById("cp-form"); if (!f) return;
  var q = function (s) { return f.querySelector(s); }, step2 = document.getElementById("cp-step2"), err = document.getElementById("cp-err");
  var v = function (n) { return (q("[name=" + n + "]").value || "").trim(); };
  function norm(x) { return String(x || "").normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase(); }
  /* a type-ahead box: shows a starting list on focus, filters as they type, arrow keys and Enter or a tap to pick, and whatever they type stands if nothing fits */
  function combo(input, box, list, rowHtml, pick, typed, emptyNote) {
    var shown = [], act = -1;
    function close() { box.hidden = true; input.setAttribute("aria-expanded", "false"); act = -1; }
    function render() {
      var t = input.dataset.typed === "1" ? norm(input.value.trim()) : "";
      shown = list.map(function (x, i) { return { x: x, s: x.score(t), i: i }; }).filter(function (o) { return o.s > 0; }).sort(function (a, b) { return b.s - a.s || a.i - b.i; }).slice(0, t ? 8 : 10).map(function (o) { return o.x; });
      box.innerHTML = shown.map(function (x, i) { return '<div class="cp-opt-row" role="option" id="' + box.id + '-' + i + '" data-i="' + i + '">' + rowHtml(x) + "</div>"; }).join("") + (t && !shown.length ? '<div class="cp-opt-none">' + emptyNote + "</div>" : "");
      box.hidden = !box.innerHTML; input.setAttribute("aria-expanded", box.hidden ? "false" : "true"); act = -1;
    }
    function mark() { [].forEach.call(box.querySelectorAll(".cp-opt-row"), function (r, i) { r.classList.toggle("on", i === act); }); input.setAttribute("aria-activedescendant", act > -1 ? box.id + "-" + act : ""); }
    function choose(i) { var x = shown[i]; if (!x) return; pick(x); input.dataset.typed = "0"; close(); }
    input.addEventListener("focus", function () { input.dataset.typed = "0"; input.select(); render(); });
    input.addEventListener("input", function () { input.dataset.typed = "1"; typed(input.value); render(); });
    input.addEventListener("blur", function () { setTimeout(close, 150); });
    input.addEventListener("keydown", function (e) {
      if (box.hidden) return;
      if (e.key === "ArrowDown") { act = Math.min(act + 1, shown.length - 1); mark(); e.preventDefault(); }
      else if (e.key === "ArrowUp") { act = Math.max(act - 1, 0); mark(); e.preventDefault(); }
      else if (e.key === "Enter" && act > -1) { choose(act); e.preventDefault(); }
      else if (e.key === "Escape") { close(); }
    });
    box.addEventListener("mousedown", function (e) { var r = e.target.closest(".cp-opt-row"); if (r) { e.preventDefault(); choose(Number(r.dataset.i)); } });
    return { render: function () { if (!box.hidden) render(); } };
  }
  function scorer(fields, bonus) { return function (t) { if (!t) return 1 + (bonus || 0); var best = 0; fields.forEach(function (f, k) { var n = norm(f); if (!n) return; if (n === t) best = Math.max(best, 100 - k); else if (n.indexOf(t) === 0) best = Math.max(best, 90 - k * 10); else if ((" " + n).indexOf(" " + t) > -1) best = Math.max(best, 70 - k * 10); else if (n.indexOf(t) > -1) best = Math.max(best, 50 - k * 10); }); return best ? best + (bonus || 0) : 0; }; }

  /* Where to: a place or a hotel; a hotel fills the place with its city */
  var TO = ${JSON.stringify(TO)};
  var toIn = q("#cp-to"), hidPlace = q("[name=place]"), hidHotel = q("[name=hotel]");
  var toList = TO.map(function (x) { var o = { k: x[0], name: x[1], where: x[2], country: x[3], trip: x[4] }; o.score = o.k === "d" ? scorer([o.name, o.where], 5) : scorer([o.name, o.where, o.country], o.trip ? 3 : 0); if (o.k === "h") { var base = o.score; o.score = function (t) { return t ? base(t) : 0; }; } return o; });
  function setTo(place, hotel, label) { hidPlace.value = place; hidHotel.value = hotel || ""; toIn.value = label || (hotel ? hotel + ", " + place : place); if (typeof paintHotels === "function" && !step2.hidden) paintHotels(); }
  var toBox = combo(toIn, q("#cp-sug-to"), toList,
    function (o) { return o.k === "d" ? "<b>" + o.name + "</b><small>" + o.where + "</small>" : "<b>" + o.name + (o.trip ? ' <span>Group trip</span>' : "") + "</b><small>Hotel · " + o.where + "</small>"; },
    function (o) { if (o.k === "d") setTo(o.where === "Jamaica" ? o.name + ", Jamaica" : o.name, "", o.where === "Jamaica" ? o.name + ", Jamaica" : o.name); else setTo(o.where === "Panama City" || o.where === "Lima" ? o.where : o.where + ", " + o.country, o.name, o.name + ", " + o.where); },
    function (text) { hidPlace.value = text.trim(); hidHotel.value = ""; },
    "Not on the list? Keep typing, we'll price anywhere.");
  var jmLoaded = false;
  function loadJM() {
    if (jmLoaded) return; jmLoaded = true;
    fetch("/assets/jm-places.json").then(function (r) { return r.json(); }).then(function (d) {
      var zones = {}; (d.zones || []).forEach(function (z) { zones[z[0]] = z[1]; });
      (d.hotels || []).forEach(function (h) { var o = { k: "h", name: h[0], where: zones[h[2]] || "Jamaica", country: "Jamaica", trip: 0 }; var base = scorer([o.name, o.where, "Jamaica"], 0); o.score = function (t) { return t ? base(t) : 0; }; toList.push(o); });
      toBox.render();
    }).catch(function () {});
  }
  toIn.addEventListener("focus", loadJM);

  /* Flying from: Kingston and Montego Bay are sent as themselves, anything else as "Another airport" plus what they chose or typed */
  var AIR = [["Kingston","KIN","Jamaica"],["Montego Bay","MBJ","Jamaica"],["Nassau","NAS","Bahamas"],["Freeport","FPO","Bahamas"],["Grand Cayman","GCM","Cayman Islands"],["Providenciales","PLS","Turks and Caicos"],["Havana","HAV","Cuba"],["Port-au-Prince","PAP","Haiti"],["Santo Domingo","SDQ","Dominican Republic"],["Punta Cana","PUJ","Dominican Republic"],["Santiago","STI","Dominican Republic"],["San Juan","SJU","Puerto Rico"],["St Maarten","SXM","Sint Maarten"],["Antigua","ANU","Antigua and Barbuda"],["St Kitts","SKB","St Kitts and Nevis"],["Dominica","DOM","Dominica"],["Guadeloupe","PTP","Guadeloupe"],["Martinique","FDF","Martinique"],["St Lucia","UVF","St Lucia"],["Barbados","BGI","Barbados"],["St Vincent","SVD","St Vincent and the Grenadines"],["Grenada","GND","Grenada"],["Port of Spain","POS","Trinidad and Tobago"],["Tobago","TAB","Trinidad and Tobago"],["Aruba","AUA","Aruba"],["Curaçao","CUR","Curaçao"],["Bonaire","BON","Bonaire"],["Georgetown","GEO","Guyana"],["Paramaribo","PBM","Suriname"],["Belize City","BZE","Belize"],["Miami","MIA","USA"],["Fort Lauderdale","FLL","USA"],["Orlando","MCO","USA"],["Tampa","TPA","USA"],["New York","JFK","USA"],["Newark","EWR","USA"],["Atlanta","ATL","USA"],["Houston","IAH","USA"],["Washington","IAD","USA"],["Boston","BOS","USA"],["Chicago","ORD","USA"],["Los Angeles","LAX","USA"],["Toronto","YYZ","Canada"],["Montreal","YUL","Canada"],["London","LHR","United Kingdom"],["Manchester","MAN","United Kingdom"],["Birmingham","BHX","United Kingdom"],["Panama City","PTY","Panama"],["Lima","LIM","Peru"],["Bogotá","BOG","Colombia"],["Medellín","MDE","Colombia"],["Cali","CLO","Colombia"],["Cartagena","CTG","Colombia"],["Barranquilla","BAQ","Colombia"],["San José","SJO","Costa Rica"],["Guatemala City","GUA","Guatemala"],["San Salvador","SAL","El Salvador"],["San Pedro Sula","SAP","Honduras"],["Managua","MGA","Nicaragua"],["Mexico City","MEX","Mexico"],["Cancún","CUN","Mexico"],["Quito","UIO","Ecuador"],["Guayaquil","GYE","Ecuador"],["Caracas","CCS","Venezuela"],["Santiago de Chile","SCL","Chile"],["Buenos Aires","EZE","Argentina"],["Montevideo","MVD","Uruguay"],["São Paulo","GRU","Brazil"],["Rio de Janeiro","GIG","Brazil"],["Asunción","ASU","Paraguay"],["Santa Cruz","VVI","Bolivia"]];
  var from = q("#cp-from"), hidA = q("[name=airport]"), hidO = q("[name=airport_other]");
  function setFrom(text) {
    var t = norm(text), k = /kingston|\\bkin\\b/.test(t) ? "Kingston" : /montego|\\bmbj\\b/.test(t) ? "Montego Bay" : "";
    if (k) { hidA.value = k; hidO.value = ""; } else { hidA.value = text.trim() ? "Another airport" : ""; hidO.value = text.trim(); }
  }
  /* before they type: Jamaica's airports first for trips out; for a group coming into Jamaica, Copa's Central and South American cities first */
  var LATAM = "PTY LIM BOG MDE SJO GUA SAL MEX CLO CTG UIO".split(" ");
  var airList = AIR.map(function (a) { var base = scorer([a[1], a[0], a[2]]); return { city: a[0], code: a[1], country: a[2], score: function (t) {
    if (t) return base(t);
    var inbound = norm(hidPlace.value).indexOf("jamaica") > -1;
    if (inbound) return a[2] === "Jamaica" ? 0 : (LATAM.indexOf(a[1]) > -1 ? 3 + (LATAM.length - LATAM.indexOf(a[1])) / 100 : 1);
    return a[2] === "Jamaica" ? 3 : 1;
  } }; });
  combo(from, document.getElementById("cp-sug"), airList,
    function (a) { return "<b>" + a.city + " <span>" + a.code + "</span></b><small>" + a.country + "</small>"; },
    function (a) { from.value = a.city + " (" + a.code + ")" + (a.country === "Jamaica" ? "" : ", " + a.country); setFrom(from.value); },
    setFrom,
    "Not on the list? Keep typing, we fly groups from anywhere.");

  /* the hotel step: hotels we sell in that place (group trip first), then Pick one for me (with a style) or Flights only */
  var HOT = ${JSON.stringify(HOT)}, hopts = document.getElementById("cp-hopts"), tiers = document.getElementById("cp-tiers"), hidTier = q("[name=tier]");
  function hotelsFor(place) {
    var pl = norm(place); if (!pl || place.indexOf("+") > -1) return [];
    return HOT.filter(function (h) { var c = norm(h[1]); return pl.indexOf(c) > -1 || c.indexOf(pl.split(",")[0].trim()) > -1; }).sort(function (a, b) { return b[5] - a[5]; }).slice(0, 6);
  }
  function hopt(name, sub, tag) { return '<button type="button" role="radio" class="cp-hopt' + (hidHotel.value === name ? " on" : "") + '" aria-checked="' + (hidHotel.value === name) + '" data-h="' + name.replace(/"/g, "&quot;") + '"><b>' + name + (tag ? " <span>" + tag + "</span>" : "") + "</b><small>" + sub + "</small></button>"; }
  function paintHotels() {
    var list = hotelsFor(hidPlace.value), hv = norm(hidHotel.value);
    if (hv && ["Pick one for me", "Flights only"].indexOf(hidHotel.value) < 0) {
      var same = list.filter(function (h) { var n = norm(h[0]); return n === hv || n.indexOf(hv) > -1 || hv.indexOf(n) > -1; })[0];
      if (same) hidHotel.value = same[0]; else list.unshift([hidHotel.value, hidPlace.value, "", "", 0, 0]);
    }
    hopts.innerHTML = list.map(function (h) { return hopt(h[0], h[4] ? "From US$" + h[4] + " per person" : (h[3] || "Priced with your dates"), h[5] ? "Group trip" : ""); }).join("")
      + hopt("Pick one for me", list.length ? "Tell us the style, we suggest the best fit" : "Tell us the style, we suggest hotels for you", "")
      + hopt("Flights only", "No hotel needed", "");
    tiers.hidden = hidHotel.value !== "Pick one for me";
    document.getElementById("cp-rooms").hidden = hidHotel.value === "Flights only";
  }
  hopts.addEventListener("click", function (e) {
    var b = e.target.closest(".cp-hopt"); if (!b) return;
    var h = b.dataset.h; hidHotel.value = h;
    if (h !== "Pick one for me") { hidTier.value = ""; [].forEach.call(tiers.querySelectorAll(".cp-tier"), function (t) { t.classList.remove("on"); }); }
    if (["Pick one for me", "Flights only"].indexOf(h) < 0) toIn.value = h + ", " + hidPlace.value;
    paintHotels();
  });
  tiers.addEventListener("click", function (e) { var t = e.target.closest(".cp-tier"); if (!t) return; hidTier.value = t.dataset.tier; [].forEach.call(tiers.querySelectorAll(".cp-tier"), function (x) { x.classList.toggle("on", x === t); }); });
  toIn.addEventListener("change", function () { if (!step2.hidden) paintHotels(); });

  /* a hotel search inside the hotel step: every hotel we list, here and in Jamaica */
  var hs = document.getElementById("cp-hs");
  combo(hs, document.getElementById("cp-sug-h"), toList.filter(function (o) { return o.k === "h"; }).concat([]),
    function (o) { return "<b>" + o.name + (o.trip ? ' <span>Group trip</span>' : "") + "</b><small>" + o.where + "</small>"; },
    function (o) { setTo(o.where === "Panama City" || o.where === "Lima" ? o.where : o.where + ", " + o.country, o.name, o.name + ", " + o.where); hs.value = ""; paintHotels(); },
    function () {}, "Not on our list? Tell us under Anything else and we'll price it.");
  hs.addEventListener("focus", function () { loadJM(); });

  /* who's travelling: adults, children and their ages */
  var who = document.getElementById("cp-who"), pop = document.getElementById("cp-pop"), ages = document.getElementById("cp-ages"), agesIn = document.getElementById("cp-ages-in");
  var N = { adults: 10, children: 0 };
  function paintWho() {
    document.getElementById("cp-n-adults").textContent = N.adults; document.getElementById("cp-n-children").textContent = N.children;
    q("[name=adults]").value = N.adults; q("[name=children]").value = N.children;
    ages.hidden = !N.children; q("[name=child_ages]").value = N.children ? agesIn.value.trim() : "";
    who.textContent = N.adults + " adult" + (N.adults === 1 ? "" : "s") + (N.children ? ", " + N.children + " child" + (N.children === 1 ? "" : "ren") : "");
    paintRooms();
  }
  function openPop(on) { pop.hidden = !on; who.setAttribute("aria-expanded", on ? "true" : "false"); }
  who.addEventListener("click", function () { openPop(pop.hidden); });
  document.getElementById("cp-pop-done").addEventListener("click", function () { openPop(false); });
  pop.addEventListener("click", function (e) { var b = e.target.closest("[data-k]"); if (!b) return; var k = b.dataset.k; N[k] = Math.max(k === "adults" ? 1 : 0, Math.min(200, N[k] + Number(b.dataset.d))); paintWho(); });
  agesIn.addEventListener("input", paintWho);
  document.addEventListener("click", function (e) { if (!pop.hidden && !e.target.closest(".cp-who-seg")) openPop(false); });

  /* rooms by type, with a count of how many people they sleep */
  var R = { single: 0, double: 0, triple: 0, quad: 0 }, SLEEPS = { single: 1, double: 2, triple: 3, quad: 4 }, roomsTouched = false;
  function paintRooms() {
    var total = N.adults + N.children, beds = 0;
    Object.keys(R).forEach(function (k) { document.getElementById("cp-r-" + k).textContent = R[k]; q("[name=r_" + k + "]").value = R[k]; beds += R[k] * SLEEPS[k]; });
    var sum = document.getElementById("cp-rsum");
    sum.textContent = beds ? "These rooms sleep " + beds + " of your " + total + " travellers." : "Add the rooms you need.";
    sum.classList.toggle("warn", beds > 0 && beds < total);
  }
  function suggestRooms() { if (roomsTouched) return; var total = N.adults + N.children; R = { single: total % 2, double: Math.floor(total / 2), triple: 0, quad: 0 }; paintRooms(); }
  document.getElementById("cp-rooms").addEventListener("click", function (e) { var b = e.target.closest("[data-r]"); if (!b) return; roomsTouched = true; var k = b.dataset.r; R[k] = Math.max(0, Math.min(200, R[k] + Number(b.dataset.d))); paintRooms(); });
  paintWho();
  document.querySelectorAll('a[href="#quote"]').forEach(function (a) {
    a.addEventListener("click", function () {
      if (a.dataset.place || a.dataset.hotel) setTo(a.dataset.place || "", a.dataset.hotel || "");
      if (a.dataset.airport) { setTimeout(function () { from.value = ""; setFrom(""); from.focus(); }, 450); }
      if (a.dataset.inbound) { setTo("Jamaica", "", "Jamaica"); loadJM(); setTimeout(function () { from.value = ""; setFrom(""); from.focus(); }, 450); }
    });
  });
  var today = new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);
  q("[name=depart]").min = today; q("[name=return]").min = today;
  q("[name=depart]").addEventListener("change", function () { q("[name=return]").min = v("depart") || today; });
  function tripMissing() {
    var m = [];
    if (!hidPlace.value.trim()) m.push("where you are going");
    if (!from.value.trim()) m.push("where you are flying from");
    if (!v("depart")) m.push("the date you leave");
    if (!v("return") || v("return") <= v("depart")) m.push("a return date after you leave");
    if (N.adults + N.children < 10) m.push("a group of 10 or more");
    if (N.children && !agesIn.value.trim()) m.push("the children's ages");
    return m;
  }
  function say(m) { if (m.length) { err.textContent = "Please add " + m.join(", ") + "."; err.hidden = false; return false; } err.hidden = true; return true; }
  function next() {
    if (!say(tripMissing())) return false;
    openPop(false); suggestRooms(); paintHotels(); step2.hidden = false; q("#cp-next").classList.add("done");
    setTimeout(function () { step2.scrollIntoView({ behavior: "smooth", block: "start" }); }, 60);
    return true;
  }
  q("#cp-next").addEventListener("click", next);
  f.addEventListener("submit", function (e) {
    e.preventDefault();
    if (step2.hidden) { next(); return; }
    var m = tripMissing();
    if (!v("hotel")) m.push("a hotel, or Pick one for me");
    else if (v("hotel") === "Pick one for me" && !v("tier")) m.push("the kind of hotel");
    if (v("hotel") && v("hotel") !== "Flights only" && !(R.single + R.double + R.triple + R.quad)) m.push("the rooms you need");
    if (!v("org_name")) m.push("your group's name");
    if (!v("name")) m.push("your name");
    if (!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(v("email"))) m.push("your email");
    if (v("phone").replace(/[^0-9]/g, "").length < 7) m.push("your phone number");
    if (!say(m)) return;
    var cs = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", r = ""; for (var i = 0; i < 4; i++) r += cs[Math.floor(Math.random() * cs.length)];
    var ref = "GV-GRP-" + r; q("[name=ref]").value = ref;
    q("[name=subject]").value = norm(hidPlace.value).indexOf("jamaica") > -1 ? "Group quote into Jamaica · Copa page" : "Group quote · Copa page";
    var btn = q(".cp-send"); btn.disabled = true; btn.textContent = "Sending...";
    fetch(location.pathname, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(new FormData(f)).toString() })
      .then(function (res) { if (!res.ok) throw new Error(res.status); location.href = "${BASE}/sent/?ref=" + encodeURIComponent(ref); })
      .catch(function () { f.submit(); });
  });
})();
</script>
<p class="cp-note wrap">Golden Vacation &amp; Travel is an independent IATA-accredited travel agency, not Copa Airlines. Copa Airlines is a trademark of its owner.</p>
</main>
<div class="sticky-cta" id="sticky-cta" hidden><a class="btn" href="#quote" data-track="copa-sticky">Get my group quote</a></div>
${footer()}
${scripts()}
</body>
</html>
`;
}

/* ---------- write ---------- */
const pages = [[`public${BASE}/index.html`, hub()], [`public${BASE}/copa/index.html`, copa()], [`public${BASE}/enquire/index.html`, enquire()], [`public${BASE}/sent/index.html`, sent()]];
for (const [f, html] of pages) {
  const p = path.join(ROOT, f);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (/—|–/.test(html)) throw new Error(`em dash in ${f}`);
  if (/wa\.me|whatsapp/i.test(html.replace(/https:\/\/wa\.me\/\d+\?text=[^"]*"[^>]*>Message us on WhatsApp/g, "").replace(/quicker on WhatsApp|message us on WhatsApp/g, ""))) throw new Error(`WhatsApp reference in ${f}`);
  fs.writeFileSync(p, html);
  console.log("wrote", f, (html.length / 1024).toFixed(1) + "KB");
}

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
  const links = [[G.navShort.rooms, `${BASE}/#rooms`], [G.navShort.jamaica, `${BASE}/#jamaica`], [G.navShort.trips, `${BASE}/#trips`], ["The hold", `${BASE}/#hold`], ["How it works", `${BASE}/#how`]];
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
    <div><a href="${BASE}/#rooms">${esc(G.rooms.kicker)}</a><a href="${BASE}/#jamaica">${esc(G.overseas.kicker)}</a><a href="${BASE}/#trips">${esc(G.trips.kicker)}</a><a href="${BASE}/#hold">The hold</a></div>
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
  <input type="hidden" name="currency" id="f-currency" value="US$">
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
      ${row("Flying from", chips("airport", f.airportsOut, { on: "Kingston", req: true }), { req: true })}`)}
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

/* ---------- write ---------- */
const pages = [[`public${BASE}/index.html`, hub()], [`public${BASE}/enquire/index.html`, enquire()], [`public${BASE}/sent/index.html`, sent()]];
for (const [f, html] of pages) {
  const p = path.join(ROOT, f);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (/—|–/.test(html)) throw new Error(`em dash in ${f}`);
  if (/wa\.me|whatsapp/i.test(html.replace(/https:\/\/wa\.me\/\d+\?text=[^"]*"[^>]*>Message us on WhatsApp/g, "").replace(/quicker on WhatsApp|message us on WhatsApp/g, ""))) throw new Error(`WhatsApp reference in ${f}`);
  fs.writeFileSync(p, html);
  console.log("wrote", f, (html.length / 1024).toFixed(1) + "KB");
}

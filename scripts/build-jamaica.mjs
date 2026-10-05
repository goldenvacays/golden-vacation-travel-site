/* Builds the Coming to Jamaica pages: /jamaica/ (the four doors), /jamaica/usa/, /jamaica/coming-home/,
   /jamaica/es/ (Spanish), /jamaica/uk-canada/, and the two thank-you pages (/jamaica/sent/, /jamaica/es/enviado/).
   Copy lives in data/jamaica-pages.json. Resort prices come from data/staycations-resorts.json (the same from-prices
   the staycation pages show; visitors pay the same), tours and airport lounges from data/experiences.json, airport
   pickups from data/transfer-rates.json. node scripts/build-jamaica.mjs */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
const J = read("data/jamaica-pages.json");
const R = Object.fromEntries(read("data/staycations-resorts.json").map((r) => [r.slug, r]));
const S = read("data/getaways.json").site;
const E = read("data/experiences.json");
const TR = read("data/transfer-rates.json");
const TD = read("data/transfers.json");
const DL = read("data/deals.json").deals || [];
const V = Object.fromEntries(E.venues.map((v) => [v.slug, v]));
const X = Object.fromEntries(J.extraResorts.map((r) => [r.slug, r]));
const BASE = "/jamaica";
const WHATSAPP = "18763601567";
const EMAIL = "goldentravellers@outlook.com";
const TODAY = new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10) /* today in Jamaica (UTC-5 all year), never the UTC date, which runs ahead in the evening */;
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const phoneDisplay = S.phone.replace(/-/g, " ");
const MONTHS = { en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], es: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"] };
const dayMonth = (iso, lang) => { const [, m, d] = iso.split("-").map(Number); return `${d} ${MONTHS[lang][m - 1]}`; };

const ICON = {
  arrow: '<path d="M5 12h14"></path><path d="m13 6 6 6-6 6"></path>',
  check: '<path d="M20 6 9 17l-5-5"></path>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"></path>',
  plus: '<path d="M12 5v14M5 12h14"></path>',
  wa: '<path d="M20.5 3.5A11 11 0 0 0 3.2 16.8L2 22l5.3-1.4A11 11 0 1 0 20.5 3.5Z"></path><path d="M8.5 9.5c.3 2.6 2.4 4.7 5 5l1.6-1.2 2 .9-.2 1.6c-.6.6-1.6.9-2.5.6-3.4-1-6-3.6-7-7-.3-.9 0-1.9.6-2.5l1.6-.2.9 2-1 1.8Z"></path>',
};
const icon = (n, size = 16, sw = 2.4) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;
const usd = (n) => `US$${Number(n).toLocaleString("en-US")}`;
const wa = (text) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;
/* "About 1 hour 30 minutes from Montego Bay, about 2 hours from Kingston" or "about 1 h 30" -> "1 h 30" */
const shortDrive = (s) => String(s || "").replace(/\(.*?\)/g, "").replace(/;.*$/, "").replace(/,.*$/, "").replace(/ from Montego Bay.*$/i, "").replace(/^about\s+/i, "").trim()
  .replace(/(\d+)\s*hours?\s+(\d+)\s*minutes?/i, "$1 h $2").replace(/(\d+)\s*hours?/i, "$1 h").replace(/(\d+)\s*minutes?/i, "$1 min");
const fromMbj = (drv, lang) => (drv ? (lang === "es" ? `a ${drv.replace(/^(\d+ h \d+)$/, "$1 min")} de MBJ` : `${drv} from MBJ`) : "");

/* ---------- head, nav, footer ---------- */
function head({ title, description, pathname, image, lang = "en", alts = {}, noindex = false }) {
  const url = `${S.origin}${pathname}`;
  const og = `${S.origin}${image}`;
  const hl = Object.keys(alts).length ? [`<link rel="alternate" hreflang="${lang}" href="${url}">`, ...Object.entries(alts).map(([l, p]) => `<link rel="alternate" hreflang="${l}" href="${S.origin}${p}">`)].join("\n") : "";
  const ga = S.ga4 ? `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${S.ga4}');
addEventListener('load',function(){setTimeout(function(){var s=document.createElement('script');s.async=1;s.src='https://www.googletagmanager.com/gtag/js?id=${S.ga4}';document.head.appendChild(s);},1200);});</script>` : "";
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
${hl}
<meta name="robots" content="${noindex ? "noindex,follow" : "index,follow"}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(S.brand)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${og}">
<meta property="og:locale" content="${lang === "es" ? "es_US" : "en_US"}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0E0F0E">
<link rel="icon" href="/favicon-32x32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preload" href="/assets/fonts/archivo.woff2" as="font" type="font/woff2" crossorigin>
<style>@font-face{font-family:'Archivo';font-style:normal;font-display:swap;font-weight:100 900;font-stretch:62% 125%;src:url(/assets/fonts/archivo.woff2) format('woff2-variations')}</style>
<link rel="stylesheet" href="/groups/assets/groups.css">
<link rel="stylesheet" href="/jamaica/assets/stay.css">
<link rel="stylesheet" href="${BASE}/assets/jamaica.css">
${ga}
</head>`;
}

function nav(lang, here, cta = true) {
  const T = J.i18n[lang];
  const links = T.audiences.map(([l, h]) => `<a href="${h}"${h === here ? ' aria-current="page"' : ""}>${esc(l)}</a>`).join("");
  return `<header class="g-nav" role="banner"><div class="wrap">
  <a class="wordmark" href="/" aria-label="${lang === "es" ? "Golden Vacation, inicio" : "Golden Vacation, home"}">GOLDEN VACATION</a>
  <span class="nav-sep" aria-hidden="true"></span>
  <a class="nav-here" href="${BASE}/">${esc(T.here)}</a>
  <nav class="g-nav-links" aria-label="${esc(T.here)}">${links}</nav>
  <div class="nav-r">
    ${cta ? `<a class="btn nav-cta" href="#plan">${esc(T.cta)}</a>` : ""}
    <button class="menu-btn" type="button" aria-label="${lang === "es" ? "Menú" : "Menu"}" aria-expanded="false" aria-controls="menu">${icon("menu", 24, 2.4)}</button>
  </div>
</div></header>
<nav id="menu" class="g-menu" aria-label="${lang === "es" ? "Menú" : "Menu"}">
  ${links}
  ${T.menuMore.map(([l, h]) => `<a class="dim" href="${h}">${esc(l)}</a>`).join("")}
</nav>`;
}

function footer(lang) {
  const T = J.i18n[lang], F = T.foot;
  return `<footer class="foot" role="contentinfo"><div class="wrap">
  <div class="foot-brand"><b>GOLDEN VACATION &amp; TRAVEL</b><span>${esc(F.line)}</span></div>
  <div class="foot-links">
    <div>${T.audiences.map(([l, h]) => `<a href="${h}">${esc(l)}</a>`).join("")}</div>
    <div>${T.menuMore.map(([l, h]) => `<a href="${h}">${esc(l)}</a>`).join("")}</div>
    <div><a href="/terms/">${esc(F.terms)}</a><a href="/privacy/">${esc(F.privacy)}</a></div>
  </div>
  <div class="foot-contact"><a href="mailto:${EMAIL}">${EMAIL}</a><span>${esc(F.call)} ${esc(phoneDisplay)}</span><span>${esc(F.where)}</span></div>
</div></footer>`;
}

/* ---------- cards: photo fills the tile, the name on a gold tag, the price on a black one ---------- */
function card({ href, img, name, price, priceUsd = null, per, prefix, sub, text, chips = [], flags = [], foot, footHtml = "", go, lang, kind = "", track = "", ext = false }) {
  const T = J.i18n[lang];
  const priceTag = price === false ? "" : price ? `<span class="dc-price">${prefix ? `<small>${esc(prefix)}</small>` : ""}<b${priceUsd != null ? ` class="money" data-usd="${priceUsd}"` : ""}>${esc(price)}</b>${per ? `<small>${esc(per)}</small>` : ""}</span>` : `<span class="dc-price dc-price-ask"><b>${esc(T.priced)}</b></span>`;
  return `<a class="dc${kind ? ` dc-${kind}` : ""}" href="${href}"${ext ? ' target="_blank" rel="noopener"' : ""}${track ? ` data-track="${esc(track)}"` : ""}>
      <img class="dc-img" src="${img}" alt="" loading="lazy" decoding="async" width="640" height="800">${priceTag}
      <span class="dc-body"><span class="dc-kick">${flags.map(([t, c]) => `<span class="dc-flag${c ? ` ${c}` : ""}">${esc(t)}</span>`).join("")}</span><span class="dc-name hh">${esc(name)}</span>${sub ? `<span class="dc-sub">${esc(sub)}</span>` : ""}${text ? `<span class="dc-text">${esc(text)}</span>` : ""}${chips.length ? `<span class="dc-chips">${chips.map((c) => `<span>${esc(c)}</span>`).join("")}</span>` : ""}
      <span class="dc-foot"><b>${footHtml || esc(foot || "")}</b><span class="dc-go">${esc(go)}${icon("arrow", 16, 2.4)}</span></span></span>
    </a>`;
}

/* the 640 x 800 card photos made for the deals strip; the Grand's is named deal-princess-grand.jpg */
const dealImg = (slug) => { for (const n of [`deal-${slug}.jpg`, `deal-${slug.replace(/-jamaica$/, "")}.jpg`]) if (fs.existsSync(path.join(ROOT, "public/assets/img", n))) return `/assets/img/${n}`; throw new Error(`no card photo for ${slug}`); };
function resortCard(slug, pg) {
  const lang = pg.lang, T = J.i18n[lang];
  const r = R[slug];
  if (r) {
    const chips = [r.adultsOnly ? T.adults : T.family];
    if (/water park|splash/i.test(r.pool + r.kids + r.goodToKnow)) chips.push(T.park);
    if (/swim-?up|swim out/i.test(r.roomList.map((x) => x.name).join(" "))) chips.push(T.swim);
    const flags = [];
    /* the one live offer (Princess Grand, 2 kids free until 21 Dec 2026) shows until its date passes */
    if (r.offer && /2 kids free until (\d{1,2}) (\w{3}) (\d{4})/.test(r.offer)) {
      const until = "2026-12-21";
      if (TODAY <= until) flags.push([T.offerKids, "dc-offer"], [`${T.ends} ${dayMonth(until, lang)}`, ""]);
    }
    /* the staycation pages are not live yet, so each resort card asks for a price on WhatsApp */
    const ask = lang === "es" ? `${pg.form.waIntro} Quiero el precio de ${r.name}. Ref ${pg.ref}` : `${pg.form.waIntro} I'd like a price for ${r.name}. Ref ${pg.ref}`;
    return card({ href: wa(ask), ext: true, img: dealImg(slug), name: r.name, price: usd(r.fromUsd), priceUsd: r.fromUsd, prefix: T.from, per: T.ppNight, sub: [r.area, fromMbj(shortDrive(r.drive), lang)].filter(Boolean).join(" · "), chips, flags, foot: T.aiFoot, go: T.ask, lang, kind: "stay", track: `jam-resort-${slug}` });
  }
  const x = X[slug];
  if (!x) throw new Error(`no resort ${slug}`);
  const msg = lang === "es" ? `${pg.form.waIntro} Quiero el precio de ${x.name}. Ref ${pg.ref}` : `${pg.form.waIntro} I'd like a price for ${x.name}. Ref ${pg.ref}`;
  return card({ href: wa(msg), img: x.img, name: x.name, sub: [x.area, fromMbj(shortDrive(x.driveMbj), lang)].filter(Boolean).join(" · "), text: x.note[lang] || "", chips: [T.family], flags: x.flag ? [[x.flag[lang], "dc-offer"]] : [], foot: T.aiFoot, go: T.ask, lang, kind: "stay", track: `jam-ask-${slug}`, ext: true });
}

const venueFrom = (v) => Math.min(...(v.products || []).map((p) => (p.visitor || {}).usd).filter((n) => typeof n === "number"));
function tourCard(slug, lang) {
  const T = J.i18n[lang], v = V[slug];
  if (!v) throw new Error(`no venue ${slug}`);
  const text = lang === "es" ? J.tours.es[slug] || "" : (J.tours.en || {})[slug] || v.card;
  const area = J.tours.areas[v.area] || "";
  return card({ href: `/experiences/${slug}.html`, img: `/jamaica/img/card-${slug}.jpg`, name: v.name, price: usd(venueFrom(v)), priceUsd: venueFrom(v), prefix: T.from, per: T.pp, sub: area, text, foot: "", go: T.see, lang, kind: "tour", track: `jam-tour-${slug}` });
}

/* airport pickups: the cheapest one-way car in a zone, straight from the live rates */
const zoneName = (z) => (TD.zones.find((x) => x.key === z) || {}).name || z;
const pickupFrom = (air, z) => { const rows = ((TR.zones[z] || {})[air] || {}).in || []; return rows.length ? Math.min(...rows.map((r) => r[3])) : null; };
const AIRPORT = { MBJ: { en: "Montego Bay", es: "Montego Bay" }, KIN: { en: "Kingston", es: "Kingston" } };

/* this month's deals: the shared list in data/deals.json, the ones tagged for this page, live ones only, four at most */
const PAGE_TAG = { usa: "usa", "coming-home": "home", es: "es", "uk-canada": "ukca" };
const dealProduct = (d) => (d.venue ? (V[d.venue].products || []).find((p) => p.id === d.product) || {} : {});
const dealUsd = (d) => (d.resort ? R[d.resort].fromUsd : d.venue ? (dealProduct(d).visitor || {}).usd : null);
const dealPrice = (d) => (d.resort ? usd(R[d.resort].fromUsd) : d.venue ? usd((dealProduct(d).visitor || {}).usd) : d.price || "");
function dealsSection(pg) {
  const lang = pg.lang, T = J.i18n[lang];
  const list = DL.filter((d) => (d.for || []).includes(PAGE_TAG[pg.key]) && (!d.until || TODAY <= d.until)).slice(0, 4);
  if (!list.length) return "";
  const cards = list.map((d) => {
    const c = d[lang] || d.en, child = (dealProduct(d).visitor || {}).usdChild;
    const flags = [...(c.badge ? [[c.badge, "dc-offer"]] : []), ...(d.until ? [[`${T.ends} ${dayMonth(d.until, lang)}`, ""]] : [])];
    const [f0, f1 = ""] = (c.foot || "").split("{child}");
    const footHtml = esc(f0) + (child && (c.foot || "").includes("{child}") ? `<span class="money" data-usd="${child}">${usd(child)}</span>` : "") + esc(f1);
    return card({ href: d.href, img: d.img, name: c.name, price: dealPrice(d), priceUsd: dealUsd(d), prefix: c.prefix, per: c.per, sub: c.sub, text: c.text, flags, footHtml, go: T.see, lang, kind: "deal", track: `jam-deal-${d.id}` });
  }).join("");
  return `<section class="jsec jdeals" id="deals" aria-labelledby="deals-h"><div class="wrap">
  <div class="jsec-head"><span class="kicker">${esc(T.dealsKicker)}</span><h2 class="h2" id="deals-h">${esc(T.dealsTitle)}</h2></div>
  <div class="dgrid dgrid-deals n${list.length}">${cards}</div>
</div></section>`;
}

function landSection(pg) {
  const lang = pg.lang, T = J.i18n[lang], L = pg.land;
  const firstAir = L.pickups[0][0];
  const cheapest = Math.min(...L.pickups[0][1].map((z) => pickupFrom(firstAir, z)).filter((n) => n != null));
  const lounge = (slug) => {
    const v = V[slug];
    const sub = slug === "club-mobay" ? (lang === "es" ? "Aeropuerto de Montego Bay (MBJ)" : "Montego Bay airport (MBJ)") : (lang === "es" ? "Aeropuerto de Kingston (KIN)" : "Kingston airport (KIN)");
    return card({ href: `/experiences/${slug}.html`, img: `/jamaica/img/card-${slug}.jpg`, name: v.name, price: usd(venueFrom(v)), priceUsd: venueFrom(v), prefix: T.from, per: T.pp, sub, text: lang === "es" ? J.tours.es[slug] : v.card, foot: "", go: T.see, lang, kind: "land", track: `jam-${slug}` });
  };
  const pickup = card({ href: "/transfers/", img: "/jamaica/img/card-pickup.jpg", name: lang === "es" ? "Traslado desde el aeropuerto" : "Airport pickup", price: usd(cheapest), priceUsd: cheapest, prefix: T.from, per: T.perCar, sub: lang === "es" ? "MBJ, KIN y OCJ" : "MBJ, KIN and OCJ", text: lang === "es" ? "Tu chofer te espera en la salida de llegadas con un cartel con tu nombre. Seguimos tu vuelo y la primera hora de espera va incluida." : "Your driver waits at arrivals with your name. Flight tracking and an hour of waiting included.", foot: lang === "es" ? "Reserva con tarjeta" : "Book by card", go: T.see, lang, kind: "land", track: "jam-pickup" });
  const cards = L.order.map((k) => (k === "pickup" ? pickup : lounge(k))).join("");
  const lines = L.pickups.map(([air, zones]) => `<p class="pick-line"><span>${esc(T.pickupLine.replace("{airport}", AIRPORT[air][lang]))}</span> ${zones.map((z) => { const n = pickupFrom(air, z); return n == null ? "" : `<b>${esc(zoneName(z))} <span class="money" data-usd="${n}">${usd(n)}</span></b>`; }).filter(Boolean).join(" · ")}</p>`).join("");
  return `<section class="jsec" id="land" aria-labelledby="land-h"><div class="wrap">
  <div class="jsec-head"><span class="kicker">${esc(L.kicker)}</span><h2 class="h2" id="land-h">${esc(L.title)}</h2><p class="lead">${esc(L.sub)}</p></div>
  <div class="dgrid dgrid-3">${cards}</div>
  <div class="pick-lines">${lines}<a class="pick-all" href="/transfers/">${esc(T.pickupAll)}${icon("arrow", 16, 2.4)}</a></div>
</div></section>`;
}

const linkify = (s, lang) => esc(s)
  .replace(lang === "es" ? "página de estado de los resorts" : "resort status page", (m) => `<a href="/hotel-status">${m}</a>`)
  .replace(lang === "es" ? "página de Grupos" : "Groups page", (m) => `<a href="/groups/">${m}</a>`);

function whoPicker(lang, id) {
  const P = J.i18n[lang].picker;
  return `<div class="field who-field who" data-who><span class="who-label">${esc(P.label)}</span><button type="button" class="who-btn" id="${id}" aria-expanded="false" aria-controls="${id}-pop">2 ${esc(P.adults)}</button>
    <div class="who-pop" id="${id}-pop" hidden><div class="who-party"></div><button type="button" class="who-add" hidden>${esc(P.add)}</button><p class="who-hint">${esc(P.hint)}</p><button type="button" class="btn btn-sm who-done">${esc(P.done)}</button></div>
    <input type="hidden" name="adults" value="2"><input type="hidden" name="children" value="0"><input type="hidden" name="rooms" value="1"><input type="hidden" name="child_ages" value=""><input type="hidden" name="split" value=""></div>`;
}

function planSection(pg) {
  const lang = pg.lang, T = J.i18n[lang], F = pg.form, L = T.form;
  const action = lang === "es" ? `${BASE}/es/enviado/` : `${BASE}/sent/`;
  const opt = (arr) => arr.map((a) => `<option>${esc(a)}</option>`).join("");
  const needs = F.needs.map((n, i) => `<label class="need"><input type="checkbox" name="need" value="${esc(n)}"${i === 0 ? " checked" : ""}><span>${esc(n)}</span></label>`).join("");
  const intro = `${F.waIntro} Ref ${pg.ref}`;
  return `<section class="jsec plan" id="plan" aria-labelledby="plan-h"><div class="wrap plan-grid">
  <div class="plan-copy"><span class="kicker">${esc(pg.label)}</span><h2 class="h2" id="plan-h">${esc(F.title)}</h2><p class="lead">${esc(F.sub)}</p>
    <ul class="plan-ticks">${T.why.map(([a, b]) => `<li>${icon("check", 16, 3)}<span><b>${esc(a)}</b> ${esc(b)}</span></li>`).join("")}</ul></div>
  <form class="book jform" name="jamaica" method="POST" action="${action}" data-netlify="true" netlify-honeypot="bot-field" novalidate id="jform" data-intro="${esc(F.waIntro)}" data-ref="${pg.ref}" data-audience="${esc(pg.label)}">
    <input type="hidden" name="form-name" value="jamaica">
    <input type="hidden" name="audience" value="${esc(pg.key)}">
    <input type="hidden" name="lang" value="${lang}">
    <input type="hidden" name="ref" value="${pg.ref}">
    <input type="hidden" name="subject" id="j-subject" value="Jamaica trip · ${esc(pg.label)}">
    <input type="hidden" name="needs" id="j-needs" value="">
    <p class="hp" aria-hidden="true"><label>${lang === "es" ? "Deja este campo vacío" : "Leave this field empty"} <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>
    <div class="fields-2 tight">
      <div class="field"><label for="j-in">${esc(L.arrive)}<span class="req" aria-hidden="true">*</span></label><input id="j-in" type="date" name="checkin" data-req="1"></div>
      <div class="field"><label for="j-out">${esc(L.leave)}<span class="req" aria-hidden="true">*</span></label><input id="j-out" type="date" name="checkout" data-req="1"></div>
    </div>
    ${whoPicker(lang, "j-who")}
    <fieldset class="field needs"><legend>${esc(L.needs)}</legend><div class="need-grid">${needs}</div></fieldset>
    <div class="${F.occasion || F.currency ? "fields-2 tight" : "fields-1"}">
      <div class="field"><label for="j-area">${esc(L.area)}</label><select id="j-area" name="area"><option value="">${esc(L.anyArea)}</option>${opt(F.areas)}</select></div>
      ${F.occasion ? `<div class="field"><label for="j-occ">${esc(L.occasion)}</label><select id="j-occ" name="occasion"><option value=""></option>${opt(F.occasion)}</select></div>` : F.currency ? `<div class="field"><label for="j-cur">${esc(L.currency)}</label><select id="j-cur" name="currency">${opt(F.currency)}</select></div>` : ""}
    </div>
    ${F.occasion ? "" : '<input type="hidden" name="occasion" value="">'}${F.currency ? "" : '<input type="hidden" name="currency" value="">'}
    <div class="field"><label for="j-notes">${esc(L.notes)}</label><input id="j-notes" type="text" name="notes" placeholder="${esc(L.notesPh)}"></div>
    <div class="book-sum" id="j-sum"><span>${esc(L.sum0)}</span></div>
    <div class="field"><label for="j-name">${esc(L.name)}<span class="req" aria-hidden="true">*</span></label><input id="j-name" type="text" name="name" autocomplete="name" data-req="1"></div>
    <div class="fields-2 tight">
      <div class="field"><label for="j-phone">${esc(L.phone)}<span class="req" aria-hidden="true">*</span></label><input id="j-phone" type="tel" name="phone" autocomplete="tel" inputmode="tel" data-req="1"></div>
      <div class="field"><label for="j-email">${esc(L.email)}<span class="req" aria-hidden="true">*</span></label><input id="j-email" type="email" name="email" autocomplete="email" inputmode="email" data-req="1"></div>
    </div>
    <p class="form-err" role="alert"></p>
    <button type="submit" class="btn btn-full">${esc(L.send)}</button>
    <a class="btn btn-outline btn-full" id="j-wa" href="${wa(intro)}" data-base="https://wa.me/${WHATSAPP}" target="_blank" rel="noopener">${icon("wa", 18, 2)} ${esc(L.waBtn)}</a>
    <p class="small">${esc(L.small)} <a href="/privacy/" style="text-decoration:underline">${esc(L.privacy)}</a></p>
  </form>
</div></section>`;
}

function page(pg) {
  const lang = pg.lang, T = J.i18n[lang], H = pg.hero;
  const CURS = pg.currencies || null;
  const curSwitch = CURS ? `<div class="cur-switch" role="group" aria-label="Prices in"><span>Prices in</span>${CURS.map((c, i) => `<button type="button" data-cur="${c}" aria-pressed="${i === 0}">${J.currency.symbols[c]}</button>`).join("")}</div>` : "";
  const cfg = { cur: CURS ? { def: CURS[0], rates: J.currency.rates, symbols: J.currency.symbols, labels: J.currency.labels } : null, lang, picker: T.picker, form: T.form, months: MONTHS[lang], labels: lang === "es" ? { dates: "Fechas", who: "Quién viaja", needs: "Necesito", area: "Zona", occasion: "Ocasión", currency: "Moneda", notes: "Notas" } : { dates: "Dates", who: "Who", needs: "I need", area: "Area", occasion: "Occasion", currency: "Quote in", notes: "Notes" } };
  const special = pg.special;
  return `${head({ title: pg.meta.title, description: pg.meta.description, pathname: pg.path, image: H.img, lang, alts: pg.alt || {} })}
<body class="groups stay jam">
${nav(lang, pg.path)}
<main>
<section class="jhero" aria-labelledby="hero-h">
  <img class="jhero-img" src="${H.img}" alt="${esc(H.alt)}" fetchpriority="high" decoding="async">
  <div class="wrap jhero-in">
    <span class="kicker">${esc(H.kicker)}</span>
    <h1 class="jhero-h" id="hero-h">${esc(H.title)}</h1>
    <p class="jhero-sub">${esc(H.sub)}</p>
    <ul class="jhero-chips">${H.chips.map((c) => `<li>${icon("check", 14, 3)}${esc(c)}</li>`).join("")}</ul>
    <div class="jhero-cta"><a class="btn btn-gold" href="#plan">${esc(T.cta)}</a><a class="btn btn-white" href="${wa(`${pg.form.waIntro} Ref ${pg.ref}`)}" target="_blank" rel="noopener" data-track="jam-hero-wa">${icon("wa", 18, 2)} ${esc(T.wa)}</a></div>
    ${curSwitch}
  </div>
</section>
<section class="jwhy" aria-label="${lang === "es" ? "Por qué con nosotros" : "Why us"}"><div class="wrap"><ul>${T.why.map(([a, b]) => `<li><b>${esc(a)}</b><span>${esc(b)}</span></li>`).join("")}</ul></div></section>
${dealsSection(pg)}
${landSection(pg)}
<section class="jsec jsec-gold" id="stay" aria-labelledby="stay-h"><div class="wrap">
  <div class="jsec-head"><span class="kicker">${esc(pg.stay.kicker)}</span><h2 class="h2" id="stay-h">${esc(pg.stay.title)}</h2><p class="lead">${esc(pg.stay.sub)} <a class="inline-link" href="/hotel-status">${esc(T.status)}</a></p>${curSwitch}</div>
  <div class="dgrid dgrid-4">${pg.stay.order.map((s) => resortCard(s, pg)).join("")}</div>
</div></section>
<section class="jsec" id="special" aria-labelledby="special-h"><div class="wrap">
  <div class="jsec-head"><span class="kicker">${esc(special.kicker)}</span><h2 class="h2" id="special-h">${esc(special.title)}</h2></div>
  <ol class="points">${special.items.map(([a, b], i) => `<li><span class="pt-n">${i + 1}</span><b>${esc(a)}</b><span>${esc(b)}</span></li>`).join("")}</ol>
  ${special.link ? `<a class="btn btn-outline" href="${special.link[1]}">${esc(special.link[0])}${icon("arrow", 16, 2.4)}</a>` : ""}
</div></section>
<section class="jsec" id="do" aria-labelledby="do-h"><div class="wrap">
  <div class="jsec-head"><span class="kicker">${esc(pg.do.kicker)}</span><h2 class="h2" id="do-h">${esc(pg.do.title)}</h2><p class="lead">${esc(pg.do.sub)}</p></div>
  <div class="dgrid dgrid-4">${pg.do.venues.map((s) => tourCard(s, lang)).join("")}</div>
</div></section>
<section class="jsec" id="how" aria-labelledby="how-h"><div class="wrap">
  <div class="jsec-head"><span class="kicker">${esc(T.howKicker)}</span><h2 class="h2" id="how-h">${esc(T.howTitle)}</h2></div>
  <ol class="jsteps">${T.how.map(([a, b], i) => `<li><span class="pt-n">${i + 1}</span><b>${esc(a)}</b><span>${esc(b)}</span></li>`).join("")}</ol>
</div></section>
${planSection(pg)}
<section class="jsec" id="faq" aria-labelledby="faq-h"><div class="wrap faq-wrap">
  <div class="jsec-head"><span class="kicker">${esc(T.faqKicker)}</span><h2 class="h2" id="faq-h">${esc(T.faqTitle)}</h2></div>
  <div class="faq">${pg.faq.map(([q, a]) => `<details><summary>${esc(q)}${icon("plus", 18, 2.6)}</summary><p>${linkify(a, lang)}</p></details>`).join("")}</div>
</div></section>
</main>
${footer(lang)}
<script>window.GV_JAM=${JSON.stringify(cfg)};</script>
<script src="${BASE}/assets/jamaica.js" defer></script>
</body>
</html>
`;
}

function chooser() {
  const C = J.chooser, H = C.hero, T = J.i18n.en;
  const doors = C.doors.map((d) => card({ href: `${BASE}/${d.key}/`, img: d.img, name: d.title, price: false, sub: "", text: d.text, foot: "", go: d.key === "es" ? "Ver" : T.see, lang: "en", kind: "door", track: `jam-door-${d.key}` }));
  return `${head({ title: C.meta.title, description: C.meta.description, pathname: C.path, image: H.img })}
<body class="groups stay jam">
${nav("en", C.path, false)}
<main>
<section class="jhero jhero-short" aria-labelledby="hero-h">
  <img class="jhero-img" src="${H.img}" alt="${esc(H.alt)}" fetchpriority="high" decoding="async">
  <div class="wrap jhero-in"><span class="kicker">${esc(H.kicker)}</span><h1 class="jhero-h" id="hero-h">${esc(H.title)}</h1><p class="jhero-sub">${esc(H.sub)}</p></div>
</section>
<section class="jsec" aria-label="Pick your way"><div class="wrap"><div class="dgrid dgrid-4">${doors.join("")}</div></div></section>
<section class="jwhy jwhy-light" aria-label="Why us"><div class="wrap"><ul>${T.why.map(([a, b]) => `<li><b>${esc(a)}</b><span>${esc(b)}</span></li>`).join("")}</ul></div></section>
</main>
${footer("en")}
<script src="${BASE}/assets/jamaica.js" defer></script>
</body>
</html>
`;
}

function sent(lang) {
  const T = J.i18n[lang], X2 = T.sent;
  const back = lang === "es" ? `${BASE}/es/` : `${BASE}/`;
  return `${head({ title: `${X2.kicker} | Golden Vacation & Travel`, description: X2.lead, pathname: lang === "es" ? `${BASE}/es/enviado/` : `${BASE}/sent/`, image: "/assets/img/hero-arrivals.jpg", lang, noindex: true })}
<body class="groups stay jam">
${nav(lang, "", false)}
<main class="wrap sent-wrap">
  <span class="kicker">${esc(X2.kicker)}</span>
  <h1 class="h1">${esc(X2.title)}</h1>
  <p class="lead">${esc(X2.lead)}</p>
  <div class="wiz-nav"><a class="btn" href="${back}">${esc(X2.back)}</a><a class="btn btn-outline" href="/">${esc(X2.home)}</a></div>
</main>
${footer(lang)}
<script src="${BASE}/assets/jamaica.js" defer></script>
</body>
</html>
`;
}

const write = (rel, html) => {
  const f = path.join(ROOT, "public", rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, html.replace(/\n{2,}/g, "\n"));
  console.log("wrote", path.join("public", rel), (html.length / 1024).toFixed(1) + "KB");
};
write("jamaica/index.html", chooser());
for (const pg of J.pages) write(`${pg.path.replace(/^\//, "")}index.html`, page(pg));
write("jamaica/sent/index.html", sent("en"));
write("jamaica/es/enviado/index.html", sent("es"));

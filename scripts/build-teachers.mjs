/* Builds the Teachers' Day page, /teachers-day/, and its thank-you page, /teachers-day/sent/.
   Copy and the Teachers' Day deals (Hana's flyer prices) live in data/teachers-day.json; each deal names its resort on
   the status map (public/map/resorts.js), which gives the thumbnail (scripts/make-teacher-thumbs.py) and any reopening
   date. The shared words (why us, the guest picker, form labels, footer) come from data/jamaica-pages.json, and the
   page wears the Jamaica pages' styles and script, so it looks and works the same.
   The request form is the shared "jamaica" Netlify form with audience "teachers-day": the team email and the guest
   confirmation (netlify/functions) label it as a Teachers' Day request. It also lists the page in the sitemap.
   node scripts/build-teachers.mjs */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
const P = read("data/teachers-day.json");
const J = read("data/jamaica-pages.json");
const T = J.i18n.en;
const MAPSRC = fs.readFileSync(path.join(ROOT, "public/map/resorts.js"), "utf8");
const MAP = Object.fromEntries(JSON.parse(MAPSRC.slice(MAPSRC.indexOf("["), MAPSRC.lastIndexOf("]") + 1)).map((r) => [r.name, r]));
const slugify = (s) => String(s).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const S = read("data/getaways.json").site;
const WHATSAPP = "18763601567";
const EMAIL = "goldentravellers@outlook.com";
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const phoneDisplay = S.phone.replace(/-/g, " ");
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const TODAY = new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10) /* today in Jamaica */;

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

/* the site's links: the bar carries the four a teacher is most likely to want, the menu and footer the rest */
const NAV = [["Staycations", "/#staycations"], ["Getaways", "/getaways/"], ["Groups", "/groups/"], ["Resort status", "/hotel-status/"]];
const MORE = [["Home", "/"], ["Experiences", "/experiences/"], ["Airport transfers", "/transfers/"], ["Coming to Jamaica", "/jamaica/"]];

/* ---------- structured data: breadcrumb, the page itself, and its questions ---------- */
const crumbName = (title) => String(title).replace(/\s*\|\s*Golden Vacation & Travel\s*$/, "");
function pageLd({ title, description, pathname, faq = [], deals = null, image = "", published = "" }) {
  const url = `${S.origin}${pathname}`, name = crumbName(title);
  const ld = [
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [["Home", `${S.origin}/`], ["Teachers' Day", url]].map(([n, u], i) => ({ "@type": "ListItem", position: i + 1, name: n, item: u })) },
    { "@context": "https://schema.org", "@type": "WebPage", "@id": `${url}#webpage`, url, name, description, inLanguage: "en", isPartOf: { "@id": `${S.origin}/#website` }, publisher: { "@id": `${S.origin}/#organization` },
      ...(published ? { datePublished: published, dateModified: TODAY } : {}), ...(image ? { primaryImageOfPage: { "@type": "ImageObject", url: `${S.origin}${image}` } } : {}) },
  ];
  /* the deals as offers: what each resort costs, for which nights, sold by us (no rich result, but search and AI answers read it) */
  if (deals) ld.push({ "@context": "https://schema.org", "@type": "ItemList", "@id": `${url}#deals`, name: deals.listName, numberOfItems: deals.items.length, itemListOrder: "https://schema.org/ItemListOrderAscending",
    itemListElement: deals.items.map((d, i) => ({ "@type": "ListItem", position: i + 1, item: { "@type": "Offer", name: `Teachers' Day deal at ${d.name}`, url: `${url}#deals`,
      price: d.usd, priceCurrency: "USD", priceSpecification: { "@type": "UnitPriceSpecification", price: d.usd, priceCurrency: "USD", unitText: "per person per night, double occupancy" },
      availabilityStarts: deals.window, availabilityEnds: deals.windowEnd, seller: { "@id": `${S.origin}/#organization` },
      itemOffered: { "@type": "Hotel", name: d.name, address: { "@type": "PostalAddress", addressLocality: d.where, addressCountry: "JM" } } } })) });
  if (faq.length) ld.push({ "@context": "https://schema.org", "@type": "FAQPage", inLanguage: "en", mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) });
  return ld;
}

/* two answers written from the deals themselves, so they never quote a stale price */
const andList = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
const priceGroups = (items) => items.reduce((g, d) => { const last = g[g.length - 1]; if (last && last.usd === d.usd) last.names.push(d.name); else g.push({ usd: d.usd, names: [d.name], where: d.where }); return g; }, []);
function autoFaq() {
  const D = P.deals, sorted = [...D.items].sort((a, b) => a.usd - b.usd);
  const g = priceGroups(sorted.slice(0, 3));
  const cheapest = `${g.map((x, i) => `${i ? "Then " : ""}${andList(x.names)} in ${x.where}, from ${usd(x.usd)} a night.`).join(" ")} Prices are per person a night, double occupancy, for 21 to 25 May 2027.`;
  const near = priceGroups(sorted.filter((d) => d.area === D.nearKingston));
  const areaLabel = (D.areas.find(([k]) => k === D.nearKingston) || [])[1] || "";
  const kingston = `The resorts in ${areaLabel.replace(" & ", " and ")}: ${andList(near.map((x) => `${andList(x.names)} from ${usd(x.usd)}`))}.`;
  return [[D.faqCheapest, cheapest], [D.faqKingston, kingston]];
}

/* ---------- head, nav, footer ---------- */
function head({ title, description, pathname, image, imageSmall = "", noindex = false, jsonld = [] }) {
  const url = `${S.origin}${pathname}`;
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
<meta name="robots" content="${noindex ? "noindex,follow" : "index,follow,max-image-preview:large"}">
${imageSmall ? `<link rel="preload" as="image" href="${image}" imagesrcset="${imageSmall} 900w, ${image} 1600w" imagesizes="100vw" fetchpriority="high">` : ""}
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(S.brand)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${S.origin}${image}">
<meta property="og:locale" content="en_US">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0E0F0E">
<link rel="icon" href="/favicon-32x32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preload" href="/assets/fonts/archivo.woff2" as="font" type="font/woff2" crossorigin>
<style>@font-face{font-family:'Archivo';font-style:normal;font-display:swap;font-weight:100 900;font-stretch:62% 125%;src:url(/assets/fonts/archivo.woff2) format('woff2-variations')}</style>
<link rel="stylesheet" href="/groups/assets/groups.css">
<link rel="stylesheet" href="/jamaica/assets/stay.css">
<link rel="stylesheet" href="/jamaica/assets/jamaica.css">
<style>
/* Teachers' Day only: the dates sit in a gold pill where the numbered points have a number */
.pt-date { width: auto; height: auto; padding: 5px 12px 6px; font-size: 14px; letter-spacing: -0.01em; white-space: nowrap; align-self: flex-start; }
.tschools .rooms-grid { margin-top: 0; }
.tjh { display: flex; flex-direction: column; gap: 12px; margin: 0; }
.tjh .jhero-h { display: block; }
.tpop { display: flex; flex-direction: column; gap: 6px; }
.tpop-l { font-size: 12px; font-weight: 800; }
.tpop-row { display: flex; flex-wrap: wrap; gap: 8px; }
.tpop .chip { height: 40px; font-size: 13px; }
/* the deals list: white rows on the gold band, photo left, price on a black tag right */
.tfilter { display: flex; gap: 8px; overflow-x: auto; margin: 0 calc(var(--pad) * -1) 14px; padding: 2px var(--pad) 6px; scrollbar-width: none; }
.tfilter::-webkit-scrollbar { display: none; }
.tfilter .chip { flex: none; height: 38px; font-size: 13px; border-color: rgba(14,15,14,.18); }
.tdeals { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: 8px; }
.tdeal a { display: grid; grid-template-columns: 96px minmax(0, 1fr) auto; align-items: center; gap: 12px; padding: 8px 10px 8px 8px; border-radius: 16px; background: var(--white); color: var(--ink); }
.tdeal a:hover { color: var(--ink); outline: 2px solid var(--ink); outline-offset: -2px; }
.tdeal a:focus-visible { outline: 3px solid var(--ink); outline-offset: 2px; }
.tdeal img { width: 96px; height: 72px; object-fit: cover; border-radius: 10px; background: var(--alt); }
.tdeal-n { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.tdeal-n b { font-size: 15px; font-weight: 800; letter-spacing: -0.015em; line-height: 1.2; }
.tdeal-n small { font-size: 13px; font-weight: 600; color: var(--muted); }
.tdeal-n em { font-style: normal; font-size: 12px; font-weight: 800; color: var(--ink); background: var(--gold); border-radius: 999px; padding: 1px 8px; margin-left: 2px; white-space: nowrap; }
.tdeal-p { display: flex; flex-direction: column; align-items: flex-end; padding: 6px 10px; border-radius: 12px; background: var(--ink); color: var(--white); line-height: 1.1; }
.tdeal-p small { font-size: 11px; opacity: .8; }
.tdeal-p b { font-size: 17px; font-weight: 900; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.tdeals-small { margin-top: 14px; font-size: 13px; line-height: 1.5; color: rgba(14,15,14,.8); max-width: 760px; }
@media (min-width: 900px) {
  .tfilter { flex-wrap: wrap; overflow: visible; margin: 0 0 18px; padding: 0; }
  .tdeals { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 14px; }
  .tdeal a { grid-template-columns: 120px minmax(0, 1fr) auto; gap: 16px; padding: 8px 14px 8px 8px; }
  .tdeal img { width: 120px; height: 90px; }
  .tdeal-n b { font-size: 17px; }
}
.tschools .sec-cta .small { margin: 0; }
</style>
${ld}
${ga}
</head>`;
}

function nav(here, cta = true) {
  const links = NAV.map(([l, h]) => `<a href="${h}">${esc(l)}</a>`).join("");
  return `<header class="g-nav" role="banner"><div class="wrap">
  <a class="wordmark" href="/" aria-label="Golden Vacation, home">GOLDEN VACATION</a>
  <span class="nav-sep" aria-hidden="true"></span>
  <a class="nav-here" href="${P.path}"${here ? ' aria-current="page"' : ""}>${esc(P.label)}</a>
  <nav class="g-nav-links" aria-label="Golden Vacation">${links}</nav>
  <div class="nav-r">
    ${cta ? `<a class="btn nav-cta" href="#plan">${esc(P.form.title)}</a>` : ""}
    <button class="menu-btn" type="button" aria-label="Menu" aria-expanded="false" aria-controls="menu">${icon("menu", 24, 2.4)}</button>
  </div>
</div></header>
<nav id="menu" class="g-menu" aria-label="Menu">
  ${links}
  ${MORE.map(([l, h]) => `<a class="dim" href="${h}">${esc(l)}</a>`).join("")}
</nav>`;
}

function footer() {
  const F = T.foot;
  return `<footer class="foot" role="contentinfo"><div class="wrap">
  <div class="foot-brand"><b>GOLDEN VACATION &amp; TRAVEL</b><span>${esc(F.line)}</span></div>
  <div class="foot-links">
    <div>${NAV.map(([l, h]) => `<a href="${h}">${esc(l)}</a>`).join("")}</div>
    <div>${[...MORE.slice(1), F.visa].map(([l, h]) => `<a href="${h}">${esc(l)}</a>`).join("")}</div>
    <div><a href="${F.about[1]}">${esc(F.about[0])}</a><a href="/terms/">${esc(F.terms)}</a><a href="/privacy/">${esc(F.privacy)}</a></div>
  </div>
  <div class="foot-contact"><a href="mailto:${EMAIL}">${EMAIL}</a><span>${esc(F.call)} ${esc(phoneDisplay)}</span><span>${esc(F.where)}</span></div>
</div></footer>`;
}

/* ---------- the deals: every resort on the flyer, cheapest first, a photo, the price on a black tag, one tap to WhatsApp ---------- */
function dealsSection() {
  const D = P.deals, win = Date.parse(`${D.window}T00:00:00-05:00`), year = D.window.slice(0, 4);
  const rows = D.items.map((d) => {
    const r = MAP[d.status];
    if (!r) throw new Error(`deal ${d.name}: no resort "${d.status}" on the status map (public/map/resorts.js)`);
    const img = `${P.path}img/${slugify(d.name)}.jpg`;
    if (!fs.existsSync(path.join(ROOT, "public", img))) throw new Error(`no thumbnail ${img}: run python3 scripts/make-teacher-thumbs.py`);
    /* a resort still closed a month before the deal dates says when it reopens: the traveller's dates decide the message */
    const reopens = r.status === "Reopening" && r.whenSort && r.whenSort > win - 30 * 864e5 ? `Reopens ${String(r.when).replace(new RegExp(` ${year}$`), "")}` : "";
    const ask = `${P.form.waIntro} I'd like the Teachers' Day deal at ${d.name}, ${P.form.cardAsk}. Ref ${P.ref}`;
    return `<li class="tdeal" data-area="${d.area}"><a href="${wa(ask)}" target="_blank" rel="noopener" data-track="teach-deal-${slugify(d.name)}">
      <img src="${img}" alt="" width="120" height="90" loading="lazy" decoding="async">
      <span class="tdeal-n"><b>${esc(d.name)}</b><small>${esc(d.where)}${reopens ? ` <em>${esc(reopens)}</em>` : ""}</small></span>
      <span class="tdeal-p"><small>${esc(T.from)}</small><b>${esc(usd(d.usd))}</b><small>${esc(T.ppNight)}</small></span>
    </a></li>`;
  }).join("");
  const chips = [["", D.all], ...D.areas].map(([k, l]) => `<button type="button" class="chip" data-area="${k}" aria-pressed="${k ? "false" : "true"}">${esc(l)}</button>`).join("");
  return `<section class="jsec jsec-gold" id="deals" aria-labelledby="deals-h"><div class="wrap">
  <div class="jsec-head"><span class="kicker">${esc(D.kicker)}</span><h2 class="h2" id="deals-h">${esc(D.title)}</h2><p class="lead">${esc(D.sub)}</p></div>
  <div class="tfilter" role="group" aria-label="Area">${chips}</div>
  <ul class="tdeals">${rows}</ul>
  <p class="tdeals-small">${esc(D.small)} <a class="inline-link" href="/hotel-status/">${esc(T.status)}</a></p>
</div></section>`;
}

/* ---------- the request form: the Jamaica pages' form, same field names, so jamaica.js runs it unchanged ---------- */
function whoPicker(id) {
  const W = T.picker;
  return `<div class="field who-field who" data-who><span class="who-label">${esc(W.label)}</span><button type="button" class="who-btn" id="${id}" aria-expanded="false" aria-controls="${id}-pop">2 ${esc(W.adults)}</button>
    <div class="who-pop" id="${id}-pop" hidden><div class="who-party"></div><button type="button" class="who-add" hidden>${esc(W.add)}</button><p class="who-hint">${esc(W.hint)}</p><button type="button" class="btn btn-sm who-done">${esc(W.done)}</button></div>
    <input type="hidden" name="adults" value="2"><input type="hidden" name="children" value="0"><input type="hidden" name="rooms" value="1"><input type="hidden" name="child_ages" value=""><input type="hidden" name="split" value=""></div>`;
}

function planSection() {
  const F = P.form, L = T.form;
  const opt = (arr) => arr.map((a) => `<option>${esc(a)}</option>`).join("");
  const needs = F.needs.map((n) => `<label class="need"><input type="checkbox" name="need" value="${esc(n)}"><span>${esc(n)}</span></label>`).join("");
  return `<section class="jsec plan" id="plan" aria-labelledby="plan-h"><div class="wrap plan-grid">
  <div class="plan-copy"><span class="kicker">${esc(F.kicker)}</span><h2 class="h2" id="plan-h">${esc(F.title)}</h2><p class="lead">${esc(F.sub)}</p>
    <ul class="plan-ticks">${T.why.map(([a, b]) => `<li>${icon("check", 16, 3)}<span><b>${esc(a)}</b> ${esc(b)}</span></li>`).join("")}</ul></div>
  <form class="book jform" name="jamaica" method="POST" action="${P.path}sent/" data-netlify="true" netlify-honeypot="bot-field" novalidate id="jform" data-intro="${esc(F.waIntro)}" data-ref="${P.ref}" data-audience="${esc(P.label)}">
    <input type="hidden" name="form-name" value="jamaica">
    <input type="hidden" name="audience" value="teachers-day">
    <input type="hidden" name="lang" value="en">
    <input type="hidden" name="ref" value="${P.ref}">
    <input type="hidden" name="subject" id="j-subject" value="Jamaica trip · ${esc(P.label)}">
    <input type="hidden" name="needs" id="j-needs" value="">
    <p class="hp" aria-hidden="true"><label>Leave this field empty <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>
    ${(F.popular || []).length ? `<div class="field tpop"><span class="tpop-l" id="j-pop-l">${esc(F.popularLabel)}</span><div class="tpop-row" role="group" aria-labelledby="j-pop-l">${F.popular.map(([l, a, b], i) => `<button type="button" class="chip" id="j-pop-${i}" data-in="${a}" data-out="${b}" aria-pressed="false">${esc(l)}</button>`).join("")}</div></div>` : ""}
    <div class="fields-2 tight">
      <div class="field"><label for="j-in">${esc(L.arrive)}<span class="req" aria-hidden="true">*</span></label><input id="j-in" type="date" name="checkin" data-req="1"></div>
      <div class="field"><label for="j-out">${esc(L.leave)}<span class="req" aria-hidden="true">*</span></label><input id="j-out" type="date" name="checkout" data-req="1"></div>
    </div>
    ${whoPicker("j-who")}
    <fieldset class="field needs"><legend>${esc(F.needsLabel)}</legend><div class="need-grid">${needs}</div></fieldset>
    <div class="fields-2 tight">
      <div class="field"><label for="j-area">${esc(L.area)}</label><select id="j-area" name="area"><option value="">${esc(L.anyArea)}</option>${opt(F.areas)}</select></div>
      <div class="field"><label for="j-occ">${esc(L.occasion)}</label><select id="j-occ" name="occasion"><option value=""></option>${opt(F.occasion)}</select></div>
    </div>
    <div class="fields-2 tight">
      <div class="field"><label for="j-cur">${esc(L.currency)}</label><select id="j-cur" name="currency">${opt(F.currency)}</select></div>
      <div class="field"><label for="j-notes">${esc(L.notes)}</label><input id="j-notes" type="text" name="notes" placeholder="${esc(F.notesPh)}"></div>
    </div>
    <div class="book-sum" id="j-sum"><span>${esc(L.sum0)}</span></div>
    <div class="field"><label for="j-name">${esc(L.name)}<span class="req" aria-hidden="true">*</span></label><input id="j-name" type="text" name="name" autocomplete="name" data-req="1"></div>
    <div class="fields-2 tight">
      <div class="field"><label for="j-phone">${esc(L.phone)}<span class="req" aria-hidden="true">*</span></label><input id="j-phone" type="tel" name="phone" autocomplete="tel" inputmode="tel" data-req="1"></div>
      <div class="field"><label for="j-email">${esc(L.email)}<span class="req" aria-hidden="true">*</span></label><input id="j-email" type="email" name="email" autocomplete="email" inputmode="email" data-req="1"></div>
    </div>
    <p class="form-err" role="alert"></p>
    <button type="submit" class="btn btn-full">${esc(L.send)}</button>
    <a class="btn btn-outline btn-full" id="j-wa" href="${wa(`${F.waIntro} Ref ${P.ref}`)}" data-base="https://wa.me/${WHATSAPP}" target="_blank" rel="noopener">${icon("wa", 18, 2)} ${esc(L.waBtn)}</a>
    <p class="small">${esc(L.small)} <a href="/privacy/" style="text-decoration:underline">${esc(L.privacy)}</a></p>
  </form>
</div></section>`;
}

const linkify = (s) => esc(s)
  .replace("resort status page", (m) => `<a href="/hotel-status/">${m}</a>`)
  .replace("Groups page", (m) => `<a href="/groups/">${m}</a>`);

function schoolsSection() {
  const X = P.schools, img = (w, ext) => `/groups/img/${X.img}-${w}.${ext}`;
  const tick = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1F8A4C" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg>';
  return `<section class="jsec tschools" id="schools" aria-labelledby="schools-h"><div class="wrap">
  <div class="jsec-head"><span class="kicker">${esc(X.kicker)}</span><h2 class="h2" id="schools-h">${esc(X.title)}</h2></div>
  <div class="rooms-grid">
    <div class="sec-photo-wrap"><picture><source type="image/webp" srcset="${img(720, "webp")} 720w, ${img(1440, "webp")} 1440w" sizes="(min-width: 900px) 48vw, 100vw"><img src="${img(720, "jpg")}" srcset="${img(720, "jpg")} 720w, ${img(1440, "jpg")} 1440w" sizes="(min-width: 900px) 48vw, 100vw" alt="${esc(X.alt)}" loading="lazy" decoding="async"></picture></div>
    <div class="rooms-text">
      <p class="lead">${esc(X.sub)}</p>
      <div class="gets">${X.gets.map(([a, b]) => `<div class="get">${tick}<div><b>${esc(a)}</b><span>${esc(b)}</span></div></div>`).join("")}</div>
      <div class="chips-row">${X.chips.map((c) => `<span class="chip-static">${esc(c)}</span>`).join("")}</div>
      <div class="sec-cta"><a class="btn" href="${X.cta[1]}" data-track="teach-schools">${esc(X.cta[0])}</a><p class="small">${esc(X.small)}</p></div>
    </div>
  </div>
</div></section>`;
}

function page() {
  const H = P.hero;
  const cfg = { cur: null, lang: "en", picker: T.picker, form: T.form, months: MONTHS, labels: { dates: "Dates", who: "Who", needs: "Looking for", area: "Area", occasion: "Occasion", currency: "Quote in", notes: "Notes" } };
  /* the two written-from-the-deals answers sit after the dates questions */
  const faq = [...P.faq.slice(0, 2), ...autoFaq(), ...P.faq.slice(2)];
  const srcset = H.imgSmall ? ` srcset="${H.imgSmall} 900w, ${H.img} 1600w" sizes="100vw"` : "";
  return `${head({ title: P.meta.title, description: P.meta.description, pathname: P.path, image: H.img, imageSmall: H.imgSmall, jsonld: pageLd({ title: P.meta.title, description: P.meta.description, pathname: P.path, faq, deals: P.deals, image: H.img, published: P.meta.published }) })}
<body class="groups stay jam">
${nav(true)}
<main>
<section class="jhero" aria-labelledby="hero-h">
  <img class="jhero-img" src="${H.img}"${srcset} alt="${esc(H.alt)}" fetchpriority="high" decoding="async">
  <div class="wrap jhero-in">
    <h1 class="tjh" id="hero-h"><span class="kicker">${esc(H.kicker)}</span><span class="jhero-h">${esc(H.title)}</span></h1>
    <p class="jhero-sub">${esc(H.sub)}</p>
    <ul class="jhero-chips">${H.chips.map((c) => `<li>${icon("check", 14, 3)}${esc(c)}</li>`).join("")}</ul>
    <div class="jhero-cta"><a class="btn btn-gold" href="#plan">${esc(P.form.title)}</a><a class="btn btn-white" href="${wa(`${P.form.waIntro} Ref ${P.ref}`)}" target="_blank" rel="noopener" data-track="teach-hero-wa">${icon("wa", 18, 2)} ${esc(T.wa)}</a></div>
  </div>
</section>
<section class="jwhy" aria-label="Why us"><div class="wrap"><ul>${T.why.map(([a, b]) => `<li><b>${esc(a)}</b><span>${esc(b)}</span></li>`).join("")}</ul></div></section>
${dealsSection()}
<section class="jsec" id="dates" aria-labelledby="dates-h"><div class="wrap">
  <div class="jsec-head"><span class="kicker">${esc(P.dates.kicker)}</span><h2 class="h2" id="dates-h">${esc(P.dates.title)}</h2></div>
  <ol class="points">${P.dates.items.map(([d, a, b]) => `<li><span class="pt-n pt-date">${esc(d)}</span><b>${esc(a)}</b><span>${esc(b)}</span></li>`).join("")}</ol>
</div></section>
${schoolsSection()}
<section class="jsec" id="how" aria-labelledby="how-h"><div class="wrap">
  <div class="jsec-head"><span class="kicker">${esc(P.how.kicker)}</span><h2 class="h2" id="how-h">${esc(P.how.title)}</h2></div>
  <ol class="jsteps">${P.how.steps.map(([a, b], i) => `<li><span class="pt-n">${i + 1}</span><b>${esc(a)}</b><span>${esc(b)}</span></li>`).join("")}</ol>
</div></section>
${planSection()}
<section class="jsec" id="faq" aria-labelledby="faq-h"><div class="wrap faq-wrap">
  <div class="jsec-head"><span class="kicker">${esc(T.faqKicker)}</span><h2 class="h2" id="faq-h">${esc(T.faqTitle)}</h2></div>
  <div class="faq">${faq.map(([q, a]) => `<details><summary>${esc(q)}${icon("plus", 18, 2.6)}</summary><p>${linkify(a)}</p></details>`).join("")}</div>
</div></section>
</main>
${footer()}
<script>window.GV_JAM=${JSON.stringify(cfg)};
/* popular dates: one tap fills Arriving and Leaving; the chip stays pressed while the dates match */
(function(){var f=document.getElementById("jform");if(!f)return;var bs=[].slice.call(f.querySelectorAll("[data-in]"));if(!bs.length)return;
function mark(){var a=f.elements.checkin.value,b=f.elements.checkout.value;bs.forEach(function(x){x.setAttribute("aria-pressed",String(x.getAttribute("data-in")===a&&x.getAttribute("data-out")===b));});}
bs.forEach(function(x){x.addEventListener("click",function(){f.elements.checkin.value=x.getAttribute("data-in");f.elements.checkout.value=x.getAttribute("data-out");f.dispatchEvent(new Event("change",{bubbles:true}));mark();try{gtag("event","jamaica_click",{item:"teach-dates-"+x.getAttribute("data-in")});}catch(e){}});});
f.addEventListener("change",mark);f.addEventListener("input",mark);mark();})();
/* the deals list: one area at a time, or all */
(function(){var bs=[].slice.call(document.querySelectorAll(".tfilter .chip")),rows=[].slice.call(document.querySelectorAll(".tdeal"));
bs.forEach(function(b){b.addEventListener("click",function(){var k=b.getAttribute("data-area");bs.forEach(function(x){x.setAttribute("aria-pressed",String(x===b));});rows.forEach(function(r){r.hidden=!!k&&r.getAttribute("data-area")!==k;});try{gtag("event","jamaica_click",{item:"teach-area-"+(k||"all")});}catch(e){}});});})();</script>
<script src="/jamaica/assets/jamaica.js" defer></script>
</body>
</html>
`;
}

function sent() {
  const X = P.sent;
  return `${head({ title: `${X.kicker} | Golden Vacation & Travel`, description: X.lead, pathname: `${P.path}sent/`, image: P.hero.img, noindex: true })}
<body class="groups stay jam">
${nav(false, false)}
<main class="wrap sent-wrap">
  <span class="kicker">${esc(X.kicker)}</span>
  <h1 class="h1">${esc(X.title)}</h1>
  <p class="lead">${esc(X.lead)}</p>
  <div class="wiz-nav"><a class="btn" href="${P.path}">${esc(X.back)}</a><a class="btn btn-outline" href="/">${esc(X.home)}</a></div>
</main>
${footer()}
<script src="/jamaica/assets/jamaica.js" defer></script>
</body>
</html>
`;
}

/* copy rules the site keeps: no long dashes and no semicolons in what a guest reads */
const guestText = JSON.stringify([P.meta, P.hero, P.deals, P.dates, P.schools, P.how, P.form, P.faq, P.sent]);
if (/[–—]/.test(guestText)) throw new Error("data/teachers-day.json has a long dash in the copy");
if (/;/.test(guestText)) throw new Error("data/teachers-day.json has a semicolon in the copy");

const write = (rel, html) => {
  const f = path.join(ROOT, "public", rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, html.replace(/\n{2,}/g, "\n"));
  console.log("wrote", path.join("public", rel), (html.length / 1024).toFixed(1) + "KB");
};
const base = P.path.replace(/^\//, "");
write(`${base}index.html`, page());
write(`${base}sent/index.html`, sent());

/* sitemap: the page in its own marked block, which stays where it is on later runs */
const smPath = path.join(ROOT, "public/sitemap.xml");
if (fs.existsSync(smPath)) {
  const URL_ = `${S.origin}${P.path}`;
  const today = new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);
  let sm = fs.readFileSync(smPath, "utf8");
  const blockRe = /<!-- teachers-day -->[\s\S]*?<!-- \/teachers-day -->\n?/;
  const old = sm.match(blockRe);
  const lastmod = (old && (old[0].match(/<lastmod>([^<]+)<\/lastmod>/) || [])[1]) || `${today}T00:00:00+00:00`;
  const entry = `<!-- teachers-day -->\n<url>\n  <loc>${URL_}</loc>\n  <lastmod>${lastmod}</lastmod>\n  <priority>0.7</priority>\n</url>\n<!-- /teachers-day -->\n`;
  sm = old ? sm.replace(blockRe, entry) : sm.replace(/\s*<\/urlset>\s*$/, `\n\n${entry}\n</urlset>\n`);
  fs.writeFileSync(smPath, sm);
  console.log("sitemap: teachers-day listed");
}

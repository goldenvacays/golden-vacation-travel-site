#!/usr/bin/env node
/**
 * Builds the goldenvacays.com front page (and the privacy / terms pages) from data/home.json.
 *
 *   node scripts/build-home.mjs                 → writes index.html, public/privacy/, public/terms/, public/assets/img/**
 *   node scripts/build-home.mjs --bundle out.html [--artifact]
 *                                               → one self-contained preview file (inline assets, images as data URIs)
 *
 * Copy lives in data/home.json. Prices come from data/getaways.json. Resort counts and rows come from
 * public/map/resorts.js (the Airtable sync), so re-run this after a resort status sync.
 * Shared site settings (WhatsApp number, phone, J$ rate, GA4) are read from data/getaways.json "site".
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const H = JSON.parse(fs.readFileSync(path.join(ROOT, "data/home.json"), "utf8"));
const G = JSON.parse(fs.readFileSync(path.join(ROOT, "data/getaways.json"), "utf8"));
const S = G.site;
const ASSETS = "/assets";
const IMG_OUT = path.join(ROOT, "public/assets/img");
const IMG_SRC = process.env.GV_HOME_IMG_SRC || IMG_OUT;
const args = process.argv.slice(2);
const BUNDLE = args.includes("--bundle") ? args[args.indexOf("--bundle") + 1] : null;
const ARTIFACT = args.includes("--artifact");
const NOINDEX = args.includes("--noindex");

/* ---------- resort data (Airtable sync → public/map/resorts.js) ---------- */
const resortsJs = fs.readFileSync(path.join(ROOT, "public/map/resorts.js"), "utf8");
const RESORTS = JSON.parse(resortsJs.slice(resortsJs.indexOf("["), resortsJs.lastIndexOf("]") + 1));
let resortsUpdated = "";
try { resortsUpdated = execSync("git log -1 --format=%cs -- public/map/resorts.js", { cwd: ROOT }).toString().trim(); } catch (e) { resortsUpdated = ""; }
const counts = {
  tracked: RESORTS.length,
  open: RESORTS.filter((r) => r.status === "Open").length,
  reopening: RESORTS.filter((r) => ["Reopening", "Coming soon", "New"].includes(r.status)).length,
};
const findResort = (name) => RESORTS.find((r) => r.name === name) || RESORTS.find((r) => r.name.toLowerCase().startsWith(name.toLowerCase()));

/* ---------- helpers ---------- */
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const usd = (n) => `US$${fmt(n)}`;
const jmdOf = (n) => `J$${fmt(n * S.jmdRate)}`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const longDate = (iso) => { if (!iso) return ""; const [y, m, d] = iso.split("-").map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
const fill = (t) => String(t).replace("{tracked}", counts.tracked).replace("{open}", counts.open).replace("{reopening}", counts.reopening);
const usedImages = new Set();
const img = (file) => { usedImages.add(file); return `${ASSETS}/img/${file}`; };
const pic = (file, alt, extra = "") => `<img src="${img(file)}" alt="${esc(alt)}" loading="lazy" decoding="async"${extra}>`;
const wa = (text) => `https://wa.me/${S.whatsapp}?text=${encodeURIComponent(text)}`;
const waHome = wa("Hi Golden Vacation! I'm on your website and I'd like a quote. Ref GV-WEB");
const noDash = (s) => String(s).replace(/—/g, ",").replace(/–/g, "to");

const ICONS = {
  arrow: '<path d="M5 12h14"></path><path d="M13 6l6 6-6 6"></path>',
  pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle>',
  chat: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>',
  menu: '<path d="M3 12h18M3 6h18M3 18h18"></path>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M16 2v4M8 2v4M3 10h18"></path>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"></path>',
  map: '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon><path d="M8 2v16M16 6v16"></path>',
};
const icon = (name, size = 20, sw = 2.2) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;display:block">${ICONS[name]}</svg>`;
const tag = (text, tone = "black") => `<span class="tag tag-${tone}">${esc(text)}</span>`;
const kicker = (text, light = false) => `<span class="kicker${light ? " kicker-light" : ""}">${esc(text)}</span>`;
const biglink = (label, href, extra = "") => `<a class="biglink" href="${href}"${extra}>${esc(label)}${icon("arrow", 20, 2.4)}</a>`;
const btn = (label, href, kind = "black", size = "", iconName = "arrow", extra = "") => `<a class="btn btn-${kind}${size ? ` btn-${size}` : ""}" href="${href}"${extra}>${esc(label)}${iconName ? icon(iconName, 18) : ""}</a>`;
const currency = () => `<div class="curr" role="group" aria-label="Currency"><button type="button" data-c="USD" class="on">US$</button><button type="button" data-c="JMD">J$</button></div>`;
const ticker = (items) => { const one = items.map((it) => `<span class="t hh">${esc(it)}</span><span class="dot"></span>`).join(""); return `<div class="ticker" aria-hidden="true"><div class="ticker-in">${one}${one}</div></div>`; };
const longShort = (long, short) => `<span class="long">${esc(long)}</span><span class="short">${esc(short || long)}</span>`;

/* ---------- chrome ---------- */
function head({ title, description, pathname, image, jsonld = [], noindex = false, bodyClass = "" }) {
  const url = `${S.origin}${pathname}`;
  const og = `${S.origin}${img(image || H.meta.ogImage)}`;
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
<link rel="manifest" href="/site.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100,400;100,500;100,600;100,700;110,800;110,900&display=swap">
<link rel="stylesheet" href="/getaways/assets/getaways.css">
<link rel="stylesheet" href="${ASSETS}/home.css">
${ld}
${ga}
<script>window.GV_CONFIG=${JSON.stringify({ base: "/getaways", whatsapp: S.whatsapp, jmdRate: S.jmdRate })};</script>
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ""}>`;
}

function nav() {
  const links = H.nav.map(([l, h]) => `<a href="${h}">${esc(l)}</a>`).join("");
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
  const help = F.help.map(([l, h]) => [l, h === "whatsapp" ? waHome : h]);
  const coming = F.coming.map(([l, k]) => [l, comingHref(k)]);
  return `<footer class="foot" role="contentinfo"><div class="wrap" style="display:flex;flex-direction:column;gap:32px">
  <div class="foot-grid">
    <div class="foot-brand"><a class="wordmark hh" href="/">GOLDEN VACATION</a><p>${esc(S.footerAddress)}<br>WhatsApp ${esc(S.whatsappDisplay)} · Call ${esc(S.phone)}<br>${esc(S.iata)}</p></div>
    ${col("Book", F.book)}
    ${col("Coming to Jamaica", coming)}
    ${col("Help", help)}
  </div>
  <div class="foot-links mob">${H.nav.map(([l, h]) => `<a href="${h}">${esc(l)}</a>`).join("")}<a href="${waHome}">Contact</a></div>
  <div class="foot-bot"><span>© 2026 Golden Vacation &amp; Travel Limited · St Ann, Jamaica · <a href="/terms/">Terms</a> · <a href="/privacy/">Privacy</a></span><span><a href="${S.instagram}" rel="noopener">Instagram</a> · <a href="${S.facebook}" rel="noopener">Facebook</a></span></div>
</div></footer>`;
}

const scripts = () => `<script>window.GV_HOME=${JSON.stringify({ whatsapp: S.whatsapp, modes: H.quote.modes })};</script>
<script src="/getaways/assets/getaways.js" defer></script>
<script src="${ASSETS}/home.js" defer></script>`;

/* ---------- front page ---------- */
function homePage() {
  const today = new Date().toISOString().slice(0, 10);

  // hero + quick quote
  const modeChips = (cls) => `<div class="${cls}" role="group" aria-label="What are you planning">${H.quote.modes.map((m, i) => `<button type="button" class="chip" data-mode="${m.key}" aria-pressed="${i === 0}">${esc(m.label)}</button>`).join("")}</div>`;
  const hero = `<section class="hero" id="home">
  <picture><source media="(max-width: 899px)" srcset="${img(H.hero.imgMobile)}"><img src="${img(H.hero.img)}" alt="${esc(H.hero.alt)}" fetchpriority="high" decoding="async"></picture>
  <div class="hero-in wrap">
    <div>${kicker(H.hero.kicker, true).replace('class="kicker', 'class="desk kicker')}${kicker(H.hero.kickerMobile, true).replace('class="kicker', 'class="mob kicker')}</div>
    <h1 class="hh">${esc(H.hero.headline)}</h1>
    <p class="desk">${esc(H.hero.sub)}</p><p class="mob">${esc(H.hero.subMobile)}</p>
    ${modeChips("chip-row desk")}
  </div>
</section>
${modeChips("qmodes mob")}
<div class="wrap">
  <form id="home-quote" class="qcard" action="/getaways/quote/" method="get">
    <div class="qf">${icon("pin", 20)}<label><span id="hq-where-label">Where to</span><select id="hq-where" name="d"></select></label></div>
    <div class="qf">${icon("calendar", 20)}<label><span>When</span><input type="date" id="hq-when" name="from" placeholder="Pick a date"></label></div>
    <div class="qf">${icon("users", 20)}<label><span>Who</span><select id="hq-who" name="who">${H.quote.who.map((w) => `<option>${esc(w)}</option>`).join("")}</select></label></div>
    <div class="qsubmit"><button class="btn btn-black btn-lg btn-full" type="submit">Get a quote${icon("arrow", 18)}</button></div>
  </form>
  <span class="qnote">${esc(H.hero.note)}</span>
</div>`;

  // start here
  const doors = `<section class="doors-sec wrap" aria-label="Start here">
  ${kicker(H.doors.kicker)}
  <div class="doors">${H.doors.items.map((d) => `<a class="door" href="${d.href}"><span class="door-img">${pic(d.img, d.alt)}</span><span class="door-t"><b>${esc(d.title)}</b><small>${longShort(d.text, d.textMobile)}</small></span><span class="door-go">${icon("arrow", 20, 2.4)}</span></a>`).join("")}</div>
</section>`;

  // getaways strip
  const destBySlug = Object.fromEntries(G.destinations.map((d) => [d.slug, d]));
  const gcards = H.getaways.tiles.map((t) => {
    const d = destBySlug[t.slug];
    const price = d.card.price;
    return `<a class="gcard" href="/getaways/${d.slug}/">
      <span class="gcard-photo">${pic(t.img, t.alt)}${tag("Visa-free", "gold")}</span>
      <span class="gcard-t"><span class="h">${esc(d.name)}</span><small>${longShort(t.sub, t.subMobile)}</small></span>
      <span class="gcard-p">${t.nights} nights from <b><span class="usd-v">${usd(price)}</span><span class="jmd-v">${jmdOf(price)}</span></b><small>≈ ${jmdOf(price)} per person</small></span>
    </a>`;
  }).join("");
  const getaways = `<section class="sec wrap" id="getaways" aria-labelledby="getaways-h">
  <div class="sec-head"><div>${kicker(H.getaways.kicker)}<h2 id="getaways-h" class="hh">${esc(H.getaways.title)}</h2><p class="sec-sub desk">${esc(H.getaways.sub)}</p></div>${biglink(H.getaways.all, "/getaways/")}</div>
  <div class="strip">${gcards}</div>
</section>`;

  // staycations
  const F = H.staycations.feature;
  const showFeature = !F.until || today <= F.until;
  const feature = showFeature ? `<a class="feature" href="${wa(F.message)}" data-until="${F.until || ""}" data-where="heroes-weekend">
    <div>${kicker(F.kicker, true)}<span class="hh">${esc(F.title)}</span><p>${longShort(F.text, F.textMobile)}</p></div>${biglink(F.cta, wa(F.message)).replace("<a ", "<span ").replace("</a>", "</span>")}${icon("arrow", 24, 2.4)}
  </a>` : "";
  const scards = H.staycations.hotels.map((h) => {
    const r = findResort(h.match) || {};
    const status = r.status === "Open" ? "Open" : r.status === "Reopening" ? `Reopening ${r.when || ""}`.trim() : r.status || "";
    const msg = `Hi Golden Vacation! I'd like a staycation quote for ${h.name}, priced in J$. Ref GV-STAY-${h.name.replace(/[^A-Za-z]/g, "").slice(0, 6).toUpperCase()}`;
    return `<a class="scard" href="${wa(msg)}" data-where="staycation-card">
      <span class="scard-photo">${pic(h.img, h.alt)}${status ? tag(status, "black") : ""}</span>
      <span class="scard-t"><span class="h">${esc(h.name)}</span><small>${longShort(h.sub, h.subMobile)}</small></span>
      <span class="scard-p">Per night <b>${esc(H.staycations.priceLine)}</b></span>
    </a>`;
  }).join("");
  const staycations = `<section class="stay-sec" id="staycations" aria-labelledby="stay-h"><div class="wrap" style="display:flex;flex-direction:column;gap:inherit">
  <div class="sec-head"><div>${kicker(H.staycations.kicker)}<h2 id="stay-h" class="hh">${esc(H.staycations.title)}</h2><p class="sec-sub desk">${esc(H.staycations.sub)}</p></div>${biglink(H.staycations.all, H.staycations.allHref)}</div>
  ${feature ? `<div class="mob">${feature}</div>` : ""}
  <div class="stay-grid desk">${feature}${scards}</div>
  <div class="strip mob">${scards}</div>
</div></section>`;

  // coming to jamaica
  const pdoors = H.coming.doors.map((d) => `<a class="pdoor" href="${wa(d.message)}" data-where="coming-${d.key}">${pic(d.img, d.alt)}<span class="pdoor-in"><span class="hh">${esc(d.title)}</span><small>${longShort(d.text, d.textMobile)}</small>${biglink("Open", wa(d.message)).replace("<a ", "<span ").replace("</a>", "</span>")}</span></a>`).join("");
  const coming = `<section class="coming-sec" id="coming" aria-labelledby="coming-h"><div class="wrap" style="display:flex;flex-direction:column;gap:inherit">
  <div class="sec-head"><div>${kicker(H.coming.kicker, true)}<h2 id="coming-h" class="hh">${esc(H.coming.title)}</h2><p class="sec-sub desk">${esc(H.coming.sub)}</p></div>${biglink(H.coming.planMobile, waHome).replace('class="biglink', 'class="mob biglink')}</div>
  <div class="pdoors">${pdoors}</div>
</div></section>`;

  // experiences
  const ecards = H.experiences.cards.map((c) => `<a class="ecard" href="${c.href || wa(c.message)}" data-where="experiences-card">
      <span class="ecard-photo">${pic(c.img, c.alt)}${c.tag ? tag(c.tag, "gold") : ""}</span>
      <span class="ecard-t"><span class="h">${esc(c.title)}</span><small>${longShort(c.sub, c.subMobile)}</small></span>
      <span class="ecard-p">From <b>${esc(c.from)}</b></span>
    </a>`).join("");
  const experiences = `<section class="sec wrap" id="experiences" aria-labelledby="exp-h">
  <div class="sec-head"><div>${kicker(H.experiences.kicker)}<h2 id="exp-h" class="hh">${esc(H.experiences.title)}</h2><p class="sec-sub desk">${esc(H.experiences.sub)}</p></div>${biglink(H.experiences.all, H.experiences.allHref || wa(H.experiences.message)).replace('class="biglink', 'class="desk biglink')}${biglink(H.experiences.allMobile, H.experiences.allHref || wa(H.experiences.message)).replace('class="biglink', 'class="mob biglink')}</div>
  <div class="strip three">${ecards}</div>
</section>`;

  // resort status
  const statusOf = (r) => {
    if (!r) return { cls: "closed", label: "", short: "", act: "Get a quote" };
    const when = (r.when || "").replace(/\s*2026$/, "");
    const dated = /^\d{1,2} [A-Za-z]{3}/.test(when);
    if (r.status === "Open") return { cls: "ok", label: "Open", short: "Open", act: "Get a quote" };
    if (r.status === "New" || r.status === "Coming soon") return { cls: "new", label: `Opens ${when}`, short: when, act: "Waitlist" };
    if (r.status === "Reopening") return dated ? { cls: "re", label: `Reopening ${when}`, short: when, act: "Get a quote" } : { cls: "re", label: when || "Reopening", short: when || "Reopening", act: "Notify me" };
    if (r.status === "Closed") return { cls: "closed", label: "Closed", short: "Closed", act: "Notify me" };
    return { cls: "closed", label: r.status, short: r.status, act: "Get a quote" };
  };
  const rowHtml = (name, deskOnly) => {
    const r = findResort(name); if (!r) return "";
    const s = statusOf(r);
    const area = r.area.replace(" & Runaway Bay", "");
    const extra = /adults/i.test(r.note) && !/all-inclusive/i.test(r.note) ? ` · ${r.note.split(" · ")[0].toLowerCase()}` : "";
    const msg = s.act === "Get a quote" ? `Hi Golden Vacation! I'd like a quote for ${r.name}. Ref GV-STAY-${r.name.replace(/[^A-Za-z]/g, "").slice(0, 6).toUpperCase()}`
      : s.act === "Waitlist" ? `Hi Golden Vacation! Please add me to the waitlist for ${r.name} and send me a quote when reservations open. Ref GV-WAIT-${r.name.replace(/[^A-Za-z]/g, "").slice(0, 6).toUpperCase()}`
      : `Hi Golden Vacation! Please WhatsApp me the day ${r.name} confirms a reopening date, with a quote for my dates. Ref GV-NOTIFY-${r.name.replace(/[^A-Za-z]/g, "").slice(0, 6).toUpperCase()}`;
    return `<a class="srow${deskOnly ? " desk-only" : ""}" href="${wa(msg)}" data-where="status-row">
      <span class="t"><b>${esc(r.name)}</b><span class="st ${s.cls}"><span class="dot"></span>${esc(s.short)}<span class="area">${esc(area)}</span></span></span>
      <span class="area-col">${esc(area + extra)}</span>
      <span class="st-col st ${s.cls}"><span class="dot"></span>${esc(s.label)}</span>
      <span class="act">${esc(s.act)}${icon("arrow", 18, 2.4)}</span>
    </a>`;
  };
  const rows = H.status.rows.map((n) => rowHtml(n, !H.status.rowsMobile.includes(n))).join("");
  const status = `<section class="status-sec" id="status" aria-labelledby="status-h">
  <div>
    ${kicker(`${H.status.kicker}${resortsUpdated ? ` · updated ${longDate(resortsUpdated)}` : ""}`)}
    <h2 id="status-h" class="hh">${esc(H.status.title)}</h2>
    <div class="stats"><div class="stat ok"><b>${counts.open}</b><span>Open</span></div><div class="stat re"><b>${counts.reopening}</b><span>Reopening</span></div><div class="stat all"><b>${counts.tracked}</b><span>Tracked</span></div></div>
    <p class="status-text">${esc(fill(H.status.text))}</p>
    <div class="status-btns desk">${btn(fill(H.status.seeAll), "/hotel-status")}${btn(H.status.map, "/hotel-status-map", "outline", "", "map")}</div>
  </div>
  <div>
    <div class="status-card">${rows}</div>
    <div class="status-btns mob" style="margin-top:16px">${btn(fill(H.status.seeAllMobile), "/hotel-status")}</div>
  </div>
</section>`;

  // how booking works
  const how = `<section class="how-sec wrap" id="how" aria-labelledby="how-h">
  <div class="sec-head"><div>${kicker(H.how.kicker)}<h2 id="how-h" class="hh">${esc(H.how.title)}</h2></div></div>
  <div class="hsteps">${H.how.steps.map(([t, x, xs], i) => `<div class="hstep"><span class="n">0${i + 1}</span><div><b>${esc(t)}</b><p>${longShort(x, xs)}</p></div></div>`).join("")}</div>
</section>`;

  const jsonld = [
    {
      "@context": "https://schema.org", "@type": "TravelAgency", "@id": `${S.origin}/#organization`,
      name: "Golden Vacation and Travel", legalName: "Golden Vacation and Travel Limited", url: S.origin, telephone: S.phoneTel,
      description: H.meta.description,
      address: { "@type": "PostalAddress", streetAddress: "Shop 3, Enfield Plaza", addressLocality: "Brown's Town", addressRegion: "St Ann", addressCountry: "JM" },
      areaServed: [{ "@type": "Country", name: "Jamaica" }, { "@type": "Country", name: "United States" }, { "@type": "Country", name: "United Kingdom" }, { "@type": "Country", name: "Canada" }],
      sameAs: [S.instagram, S.facebook, "https://x.com/goldenvacays"],
      contactPoint: { "@type": "ContactPoint", telephone: S.phoneTel, contactType: "reservations", areaServed: ["JM", "US", "GB", "CA"], availableLanguage: ["en", "es"] },
    },
    { "@context": "https://schema.org", "@type": "WebSite", "@id": `${S.origin}/#website`, url: S.origin, name: "Golden Vacation & Travel", publisher: { "@id": `${S.origin}/#organization` } },
  ];

  return head({ title: H.meta.title, description: H.meta.description, pathname: "/", image: H.meta.ogImage, jsonld, bodyClass: "home" }) + `
${nav()}
${hero}
${doors}
${getaways}
${staycations}
${coming}
${experiences}
${status}
${how}
${ticker(H.ticker)}
${footer()}
${scripts()}
</body></html>`;
}

/* ---------- legal pages ---------- */
function legalPage(kind) {
  const eff = H.legal.effective;
  const email = H.footer.email;
  const privacy = `<h1 class="hh">Privacy policy</h1><p class="muted">Effective ${esc(eff)}</p>
<p>We respect your privacy. This policy explains what we collect, why we collect it, and how we protect it.</p>
<h2 class="h">Information we collect</h2>
<ul><li><strong>Contact details</strong> you share with us (name, email, phone).</li><li><strong>Trip details</strong> relevant to bookings (dates, destination, preferences).</li><li><strong>Messages</strong> sent via WhatsApp, email, or our forms.</li><li><strong>Usage data</strong> (analytics like page views) to improve the site.</li></ul>
<h2 class="h">How we use information</h2>
<ul><li>To provide quotes, make reservations, and deliver customer support.</li><li>To send confirmations and important trip updates.</li><li>To improve our services and prevent fraud or abuse.</li></ul>
<h2 class="h">Sharing</h2><p>We share necessary details with the hotels, airlines and tour operators that fulfil your booking. We do not sell your data.</p>
<h2 class="h">WhatsApp</h2><p>Clicking our WhatsApp buttons opens WhatsApp (or WhatsApp Web). Your messages are governed by WhatsApp's own terms and privacy policy.</p>
<h2 class="h">Card payments on the site</h2><p>When you book a Golden Experience on this site, your card is handled by Stripe on Stripe's own secure payment page. We never see or store your card number. Stripe's privacy policy applies to the payment itself.</p>
<h2 class="h">Reviews from Tripadvisor</h2><p>Experience pages show a tour's Tripadvisor rating and its most recent Tripadvisor reviews, including the reviewer's Tripadvisor username. That content is fetched from Tripadvisor each time the page is opened and is not stored by us. It is written by Tripadvisor travellers about the venue and is governed by Tripadvisor's terms.</p>
<h2 class="h">Data security and retention</h2><p>We use reasonable technical and organisational measures to safeguard data. We keep records only as long as needed for bookings and legal requirements.</p>
<h2 class="h">Your rights</h2><p>You may request access, correction, or deletion of your personal data. Contact us at <a href="mailto:${email}">${email}</a>.</p>
<h2 class="h">Contact</h2><p>Golden Vacation and Travel Limited, ${esc(S.footerAddress)}. Email <a href="mailto:${email}">${email}</a>.</p>`;
  const terms = `<h1 class="hh">Terms and conditions</h1><p class="muted">Effective ${esc(eff)}</p>
<h2 class="h">Bookings and payments</h2>
<ul><li>Quotes are not guaranteed until a deposit or full payment is received.</li><li>Final prices and availability are confirmed at the time of booking.</li><li>Payment schedules and methods will be communicated in writing.</li></ul>
<h2 class="h">Cancellations and changes</h2>
<ul><li>The rules of the hotel, airline or tour operator govern cancellations, changes and refunds. Flights are usually non-refundable once ticketed.</li><li>Agency service fees may apply to changes or cancellations.</li></ul>
<h2 class="h">Travel documents</h2>
<ul><li>You are responsible for valid passports, visas and entry requirements.</li><li>We recommend travel insurance for medical emergencies and trip interruptions.</li></ul>
<h2 class="h">Liability</h2><p>We act as an agent for independent suppliers and are not liable for their acts, omissions, or service quality. Remedies are limited to amounts paid to us for services not provided.</p>
<h2 class="h">Contact</h2><p>Questions? Email <a href="mailto:${email}">${email}</a>, or WhatsApp ${esc(S.whatsappDisplay)}.</p>`;
  const body = `
${nav()}
<main class="legal wrap">${kind === "privacy" ? privacy : terms}</main>
${footer()}
${scripts()}
</body></html>`;
  const title = kind === "privacy" ? "Privacy policy | Golden Vacation & Travel" : "Terms and conditions | Golden Vacation & Travel";
  const description = kind === "privacy" ? "What Golden Vacation and Travel collects, why, and how we protect it." : "Booking terms, payments, cancellations and responsibilities for Golden Vacation and Travel.";
  return head({ title, description, pathname: `/${kind}/`, image: H.meta.ogImage, bodyClass: "legal-page" }) + body;
}

/* ---------- write ---------- */
const pages = [["index.html", homePage()], ["public/privacy/index.html", legalPage("privacy")], ["public/terms/index.html", legalPage("terms")]];

if (!BUNDLE) {
  for (const [rel, html] of pages) {
    const f = path.join(ROOT, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, html);
    console.log("wrote", rel, `${(html.length / 1024).toFixed(0)}K`);
  }
  fs.mkdirSync(IMG_OUT, { recursive: true });
  const missing = [];
  for (const f of usedImages) {
    const src = path.join(IMG_SRC, f), dst = path.join(IMG_OUT, f);
    if (fs.existsSync(src)) { if (path.resolve(src) !== path.resolve(dst)) fs.copyFileSync(src, dst); }
    else if (!fs.existsSync(dst)) missing.push(f);
  }
  if (missing.length) console.warn("MISSING IMAGES:", missing.join(", "));
  console.log(`resorts: ${counts.open} open, ${counts.reopening} reopening, ${counts.tracked} tracked (data from ${resortsUpdated || "unknown"})`);
} else {
  const css = fs.readFileSync(path.join(ROOT, "public/getaways/assets/getaways.css"), "utf8") + "\n" + fs.readFileSync(path.join(ROOT, "public/assets/home.css"), "utf8");
  const js = fs.readFileSync(path.join(ROOT, "public/getaways/assets/getaways.js"), "utf8") + "\n" + fs.readFileSync(path.join(ROOT, "public/assets/home.js"), "utf8");
  let html = pages[0][1];
  for (const f of usedImages) {
    const p = fs.existsSync(path.join(IMG_SRC, f)) ? path.join(IMG_SRC, f) : path.join(IMG_OUT, f);
    if (fs.existsSync(p)) html = html.split(`${ASSETS}/img/${f}`).join(`data:image/jpeg;base64,${fs.readFileSync(p).toString("base64")}`);
  }
  html = html.replace(/<link rel="stylesheet" href="\/getaways\/assets\/getaways\.css">\n<link rel="stylesheet" href="\/assets\/home\.css">/, `<style>${css}</style>`);
  const previewJs = js.replace("window.location.href = u;", `window.open("${S.origin}" + u, "_blank", "noopener");`);
  html = html.replace(/<script src="\/getaways\/assets\/getaways\.js" defer><\/script>\n<script src="\/assets\/home\.js" defer><\/script>/, `<script>${previewJs}</script>`);
  // in the preview, site links open the live site in a new tab; anchors stay on the page
  html = html.replace(/<\/body><\/html>$/, `<script>document.addEventListener('click',function(e){var a=e.target.closest('a');if(!a)return;var h=a.getAttribute('href')||'';if(h.charAt(0)==='/'){a.setAttribute('target','_blank');a.href='${S.origin}'+h;}});</script></body></html>`);
  html = html.replace(/<meta name="robots" content="[^"]*">/, '<meta name="robots" content="noindex,nofollow">').replace(/<title>[^<]*<\/title>/, "<title>Golden Vacays front page</title>");
  let out = html;
  if (ARTIFACT) out = html.replace(/^<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n/, "").replace(/<\/head>\n<body([^>]*)>/, '<div class="home">').replace(/<\/body><\/html>$/, "</div>");
  fs.writeFileSync(BUNDLE, out);
  console.log("wrote", BUNDLE, `${(out.length / 1024).toFixed(0)}K`);
}

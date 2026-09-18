/**
 * Shared chrome for the Getaways section: data, helpers, head, nav, footer, bottom bar.
 * Used by scripts/build-getaways.mjs and scripts/build-hotels.mjs so every page under /getaways
 * carries the same nav and footer. Change it here, then rebuild both.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, "data/getaways.json"), "utf8"));
export const OUT = path.join(ROOT, "public/getaways");
export const IMG_SRC = process.env.GV_IMG_SRC || path.join(ROOT, "public/getaways/img");
export const S = DATA.site;
export const BASE = S.base;
export const args = process.argv.slice(2);
export const BUNDLE = args.includes("--bundle") ? args[args.indexOf("--bundle") + 1] : null;
export const NOINDEX = args.includes("--noindex");
export const ARTIFACT = args.includes("--artifact"); // bundle without the document wrapper, for a hosted preview page

/* ---------- helpers ---------- */
export const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
export const usd = (n) => `US$${fmt(n)}`;
export const jmd = (n) => `≈ J$${fmt(n * S.jmdRate)}`;
export const price = (n, cls = "") => `<span class="price ${cls}"><span class="usd-v">${usd(n)}</span><span class="jmd-v">${jmd(n)}</span></span>`;
export const replyLine = (t) => (t === "REPLY_LINE" ? S.replyLine : t);
export const img = (file) => `${BASE}/img/${file}`;
export const usedImages = new Set();
export const pic = (file, alt, cls = "", extra = "") => { usedImages.add(file); return `<img src="${img(file)}" alt="${esc(alt)}"${cls ? ` class="${cls}"` : ""} loading="lazy" decoding="async"${extra}>`; };
export const heroPic = (file, alt) => { usedImages.add(file); return `<img src="${img(file)}" alt="${esc(alt)}" fetchpriority="high" decoding="async">`; };

export const ICONS = {
  arrow: '<path d="M5 12h14"></path><path d="M13 6l6 6-6 6"></path>',
  back: '<path d="M15 18l-6-6 6-6"></path>',
  send: '<path d="M22 2L11 13"></path><path d="M22 2l-7 20-4-9-9-4 20-7z"></path>',
  pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle>',
  chat: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>',
  check: '<path d="M20 6L9 17l-5-5"></path>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>',
  menu: '<path d="M3 12h18M3 6h18M3 18h18"></path>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M16 2v4M8 2v4M3 10h18"></path>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"></path>',
  globe: '<circle cx="12" cy="12" r="10"></circle><path d="M2 12h20"></path><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>',
  tag: '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><path d="M7 7h.01"></path>',
  map: '<polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon><path d="M8 2v16M16 6v16"></path>',
  card: '<rect x="1" y="4" width="22" height="16" rx="2"></rect><path d="M1 10h22"></path>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z"></path>',
};
export const icon = (name, size = 20, sw = 2.2) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;display:block">${ICONS[name]}</svg>`;

export const wa = (text) => `https://wa.me/${S.whatsapp}?text=${encodeURIComponent(text)}`;
export const waGeneric = (what) => wa(`Hi Golden Vacation! I'm looking at ${what} on your website and I'd like a quote. Ref GV-WEB`);
export const btn = (label, href, kind = "black", size = "", iconName = "arrow", extra = "") =>
  `<a class="btn btn-${kind}${size ? ` btn-${size}` : ""}" href="${href}"${extra}>${esc(label)}${iconName ? icon(iconName, 18) : ""}</a>`;
export const tag = (text, tone = "black") => `<span class="tag tag-${tone}">${esc(text)}</span>`;
export const kicker = (text, light = false) => `<span class="kicker${light ? " kicker-light" : ""}">${esc(text)}</span>`;
export const biglink = (label, href) => `<a class="biglink" href="${href}">${esc(label)}${icon("arrow", 20, 2.4)}</a>`;
export const check = (t) => `<div class="check-row">${icon("check", 20, 2.6)}<span>${t}</span></div>`;
export const faqItem = (q, a) => `<div class="faq-i"><b class="h">${esc(q)}</b><p>${esc(replyLine(a))}</p></div>`;
export const currency = (light = false) => `<div class="curr${light ? " curr-light" : ""}" role="group" aria-label="Currency"><button type="button" data-c="USD" class="on">US$</button><button type="button" data-c="JMD">J$</button></div>`;
export const ticker = (items, dark = false) => {
  const one = items.map((it) => `<span class="t hh">${esc(it)}</span><span class="dot"></span>`).join("");
  return `<div class="ticker${dark ? " ticker-dark" : ""}" aria-hidden="true"><div class="ticker-in">${one}${one}</div></div>`;
};
export const stars = (n = 5) => `<span class="stars" aria-hidden="true">${icon("star", 14).repeat(n)}</span>`;

/* ---------- chrome ---------- */
export function head({ title, description, pathname, image, jsonld = [], extraHead = "", noindex = false }) {
  const url = `${S.origin}${pathname}`;
  const og = `${S.origin}${img(image || S.ogImage)}`;
  usedImages.add(image || S.ogImage);
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
<link rel="icon" href="/favicon-32x32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preload" href="/assets/fonts/archivo.woff2" as="font" type="font/woff2" crossorigin>
<style>@font-face{font-family:'Archivo';font-style:normal;font-display:swap;font-weight:100 900;font-stretch:62% 125%;src:url(/assets/fonts/archivo.woff2) format('woff2-variations')}</style>
<link rel="stylesheet" href="${BASE}/assets/getaways.css">
${ld}
${ga}
<script>window.GV_CONFIG=${JSON.stringify({ base: BASE, whatsapp: S.whatsapp, jmdRate: S.jmdRate })};</script>
${extraHead}
</head>`;
}

export function nav({ back = null, title = null } = {}) {
  const links = [["Destinations", `${BASE}/#destinations`], ["How it works", `${BASE}/#how`], ["Questions", `${BASE}/#questions`], ["What's open in Jamaica", "/hotel-status"]];
  return `<header class="nav wrap" role="banner">
  <div class="nav-l">
    ${back ? `<a class="icon-btn mob" href="${back}" aria-label="Back">${icon("back", 24, 2.4)}</a>` : ""}
    <a class="wordmark hh" href="/" aria-label="Golden Vacation, home">GOLDEN VACATION</a>
    <a class="tag tag-gold" href="${BASE}/" aria-label="Getaways home" style="color:var(--ink)">Getaways</a>
  </div>
  <nav class="nav-links" aria-label="Getaways">${links.map(([l, h]) => `<a href="${h}">${esc(l)}</a>`).join("")}</nav>
  <div class="nav-r">
    ${currency()}
    <a class="icon-btn icon-btn-black mob" href="${waGeneric(title || "the Getaways page")}" aria-label="WhatsApp us" data-where="nav">${icon("chat", 20)}</a>
    ${btn("WhatsApp", waGeneric(title || "the Getaways page"), "black", "sm", "chat", ' data-where="nav"').replace('class="btn', 'class="desk btn')}
  </div>
</header>`;
}

export function footer() {
  const col = (t, items) => `<div class="foot-col"><span>${esc(t)}</span>${items.map(([l, h]) => `<a href="${h}">${esc(l)}</a>`).join("")}</div>`;
  return `<footer class="foot" role="contentinfo"><div class="wrap" style="display:flex;flex-direction:column;gap:32px">
  <div class="foot-grid">
    <div class="foot-brand"><a class="wordmark hh" href="/">GOLDEN VACATION</a><p>${esc(S.footerAddress)}<br>WhatsApp ${esc(S.whatsappDisplay)} · Call ${esc(S.phone)}<br>${esc(S.iata)}</p></div>
    ${col("Destinations", [...DATA.destinations.map((d) => [d.name, `${BASE}/${d.slug}/`]), ["Cancún · Brazil, on request", `${BASE}/quote/`]])}
    ${col("Two countries", DATA.combos.map((c) => [c.name, `${BASE}/${c.slug}/`]))}
    ${col("Also from Golden", [["Jamaica hotels & staycations", "/"], ["What's open in Jamaica", "/hotel-status"], ["Resort map", "/hotel-status-map"]])}
  </div>
  <div class="foot-bot"><span>© 2026 Golden Vacation &amp; Travel Limited · St Ann, Jamaica</span><span><a href="${S.instagram}" rel="noopener">Instagram</a> · <a href="${S.facebook}" rel="noopener">Facebook</a></span></div>
</div></footer>`;
}

export const bottomBar = (label, href, note) => `<div class="bar mob" role="region" aria-label="Get a quote"><a class="btn btn-black btn-lg btn-full" href="${href}">${esc(label)}${icon("chat", 18)}</a><small>${esc(note)}</small></div>`;

export const scripts = (dates) => `<script src="${BASE}/assets/getaways.js" defer></script>${dates ? `\n<script src="/assets/daterange.js" defer></script>` : ""}`;

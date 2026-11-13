/* Builds the Black Friday page, /black-friday/, from data/black-friday.json: a live countdown to the opening
   (Thu Nov 19, 8am Jamaica time) and then to the close (Mon Nov 30, 11:59pm), what's in it, where the deals land,
   how it works, and the early-list WhatsApp button. The page changes state by itself (public/black-friday/bf.js),
   so it needs no rebuild at the opening; deals go in the json's deals list as the hotels release them.
   Also writes the calendar file (black-friday.ics) and lists the page in the sitemap.
   The countdown bar for every other page is a Netlify snippet, kept in snippets/bf-countdown-bar.html.
   node scripts/build-black-friday.mjs */
import fs from "node:fs";
import path from "node:path";
import { ROOT, S, ICONS, esc } from "./_getaways-chrome.mjs";

const P = JSON.parse(fs.readFileSync(path.join(ROOT, "data/black-friday.json"), "utf8"));
const OUT = path.join(ROOT, "public", P.path);
const URL_ = `${S.origin}${P.path}`;
const OPEN = Date.parse(P.opensAt);
const END = Date.parse(P.endsAt);
const NOW = Date.now();
const STATE = NOW < OPEN ? "soon" : NOW <= END ? "live" : "over"; /* the state the html starts in; bf.js takes over */
const TODAY = new Date(NOW - 5 * 3600e3).toISOString().slice(0, 10); /* today in Jamaica */

const wa = (text) => `https://wa.me/${S.whatsapp}?text=${encodeURIComponent(text)}`;
const fmt = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const ICON = {
  ...ICONS,
  car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"></path><circle cx="7" cy="17" r="2"></circle><path d="M9 17h6"></path><circle cx="17" cy="17" r="2"></circle>',
  compass: '<circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"></path><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"></path>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"></rect><path d="M12 8v13"></path><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"></path><path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"></path>',
};
const ic = (name, size = 20, sw = 2.2) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;display:block">${ICON[name]}</svg>`;
/* an element shown only in some states; it starts hidden unless the build is in one of them */
const show = (states) => ` data-show="${states}"${states.split(" ").includes(STATE) ? "" : " hidden"}`;

/* times for people: Thursday, Nov 19, 8am (Jamaica is UTC-5 all year) */
const ics = (ms) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const calTitle = "Golden Vacation Black Friday opens";
const calText = `The deals open at 8am Jamaica time and run to Monday, Nov 30. ${URL_}`;
const gcal = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(calTitle)}&dates=${ics(OPEN)}/${ics(OPEN + 3600e3)}&details=${encodeURIComponent(calText)}&location=${encodeURIComponent(URL_)}`;

/* ---------- chrome: the main site nav and footer, as the transfers and front pages wear them ---------- */
const NAV = [["Getaways", "/getaways/"], ["Staycations", "/#staycations"], ["Jamaica", "/#coming"], ["Experiences", "/experiences/"], ["Transfers", "/transfers/"], ["Groups", "/groups/"], ["Resort status", "/hotel-status/"]];
const WA_NAV = wa("Hi Golden Vacation! I'm on your Black Friday page. Ref GV-BF");
const curr = `<div class="curr" role="group" aria-label="Currency"><button type="button" data-c="USD" class="on">US$</button><button type="button" data-c="JMD">J$</button></div>`;
const links = NAV.map(([l, h]) => `<a href="${h}">${esc(l)}</a>`).join("");
const nav = `<header class="nav wrap" role="banner">
  <div class="nav-l"><a class="wordmark hh" href="/" aria-label="Golden Vacation, home">GOLDEN VACATION</a></div>
  <nav class="nav-links" aria-label="Main">${links}</nav>
  <div class="nav-r">
    ${curr}
    <a class="icon-btn icon-btn-black mob" href="${WA_NAV}" aria-label="WhatsApp us" data-where="nav">${ic("chat")}</a>
    <button class="icon-btn menu-btn mob" type="button" aria-label="Menu" aria-expanded="false" aria-controls="menu">${ic("menu", 24, 2.4)}</button>
    <a class="desk btn btn-black btn-sm" href="${WA_NAV}" data-where="nav">WhatsApp${ic("chat", 18)}</a>
  </div>
</header>
<nav id="menu" class="menu mob" aria-label="Menu">${links}${curr}</nav>`;

const footer = `<footer class="foot" role="contentinfo"><div class="wrap" style="display:flex;flex-direction:column;gap:32px">
  <div class="foot-grid">
    <div class="foot-brand"><a class="wordmark hh" href="/">GOLDEN VACATION</a><p>${esc(S.footerAddress)}<br>WhatsApp ${esc(S.whatsappDisplay)} · Call ${esc(S.phone)}<br>${esc(S.iata)}</p></div>
    <div class="foot-col"><span>Book</span><a href="/getaways/">Getaways from Jamaica</a><a href="/#staycations">Staycations</a><a href="/hotel-status/">Jamaica resorts, what's open</a><a href="/experiences/">Golden Experiences</a><a href="/transfers/">Airport transfers</a><a href="/groups/">Group travel</a></div>
    <div class="foot-col"><span>Black Friday</span><a href="${P.path}">Nov 19 to Nov 30</a><a href="#first-pick">Tell us your dates</a><a href="${P.path}black-friday.ics" data-bf-cal="ics">Add to calendar</a></div>
    <div class="foot-col"><span>Help</span><a href="/about/">About us</a><a href="/getaways/visa-free-countries/">Visa-free countries</a><a href="/hotel-status/">Resort status</a><a href="/getaways/#questions">Deposits &amp; payments</a><a href="${WA_NAV}">Contact us</a></div>
  </div>
  <div class="foot-links mob">${links}<a href="/about/">About us</a><a href="${WA_NAV}">Contact</a></div>
  <div class="foot-bot"><span>© 2026 Golden Vacation &amp; Travel Limited · St Ann, Jamaica · <a href="/terms/">Terms</a> · <a href="/privacy/">Privacy</a></span><span><a href="${S.instagram}" rel="noopener">Instagram</a> · <a href="${S.facebook}" rel="noopener">Facebook</a></span></div>
</div></footer>`;

/* ---------- the page ---------- */
const jsonld = {
  "@context": "https://schema.org",
  "@type": "SaleEvent",
  name: "Black Friday at Golden Vacation & Travel",
  description: P.description,
  url: URL_,
  image: `${S.origin}${P.ogImage}`,
  startDate: "2026-11-19T08:00:00-05:00",
  endDate: "2026-11-30T23:59:59-05:00",
  eventStatus: "https://schema.org/EventScheduled",
  eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
  location: { "@type": "VirtualLocation", url: URL_ },
  organizer: { "@id": `${S.origin}/#organization`, "@type": "TravelAgency", name: "Golden Vacation and Travel", url: S.origin },
};

const head = `<!DOCTYPE html>
<html lang="en" data-bf="${STATE}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(P.title)}</title>
<meta name="description" content="${esc(P.description)}">
<link rel="canonical" href="${URL_}">
<meta name="robots" content="index,follow">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(S.brand)}">
<meta property="og:title" content="${esc(P.title)}">
<meta property="og:description" content="${esc(P.description)}">
<meta property="og:url" content="${URL_}">
<meta property="og:image" content="${S.origin}${P.ogImage}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="en_JM">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(P.title)}">
<meta name="twitter:description" content="${esc(P.description)}">
<meta name="twitter:image" content="${S.origin}${P.ogImage}">
<meta name="theme-color" content="#0E0F0E">
<link rel="icon" href="/favicon-32x32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preload" href="/assets/fonts/archivo.woff2" as="font" type="font/woff2" crossorigin>
<style>@font-face{font-family:'Archivo';font-style:normal;font-display:swap;font-weight:100 900;font-stretch:62% 125%;src:url(/assets/fonts/archivo.woff2) format('woff2-variations')}</style>
<link rel="stylesheet" href="/getaways/assets/getaways.css">
<link rel="stylesheet" href="/assets/home.css">
<link rel="stylesheet" href="${P.path}bf.css">
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${S.ga4}');
addEventListener('load',function(){setTimeout(function(){var s=document.createElement('script');s.async=1;s.src='https://www.googletagmanager.com/gtag/js?id=${S.ga4}';document.head.appendChild(s);},1200);});</script>
<script>window.GV_CONFIG=${JSON.stringify({ base: S.base, whatsapp: S.whatsapp, jmdRate: S.jmdRate })};</script>
</head>`;

const H = P.hero;
const cell = (k, label) => `<div class="bf-cell"><b data-u="${k}">${k === "d" ? "0" : "00"}</b><span>${label}</span></div>`;
const hero = `<section class="bf-hero" aria-labelledby="bf-h">
  <div class="bf-hero-in">
    <span class="bf-kicker">${esc(H.kicker)}</span>
    <h1 id="bf-h" class="bf-h1 hh"><span>Black</span><span class="g">Friday</span></h1>
    <div class="bf-clock" data-bf-clock data-opens="${P.opensAt}" data-ends="${P.endsAt}"${show("soon live")}>
      <span class="bf-clock-l"><span${show("soon")}>Opens in</span><span${show("live")}>Ends in</span></span>
      <div class="bf-cells" aria-hidden="true">${cell("d", "Days")}${cell("h", "Hours")}${cell("m", "Mins")}${cell("s", "Secs")}</div>
    </div>
    <p class="bf-sub"><span${show("soon")}>${esc(H.soon)}</span><span${show("live")}>${esc(H.live)}</span><span${show("over")}>${esc(H.over)}</span></p>
    <div class="bf-ctas">
      <a class="btn btn-gold btn-lg" href="${P.deals.length ? "#deals" : "#first-pick"}"${show("soon live")}>See the rates${ic("arrow", 18)}</a>
      <a class="btn btn-ghost-l btn-lg" href="#first-pick"${show("soon")}>Get first pick${ic("arrow", 18)}</a>
      <a class="btn btn-ghost-l btn-lg" href="#first-pick"${show("live")}>Get my price${ic("arrow", 18)}</a>
      <a class="btn btn-gold btn-lg" href="/getaways/"${show("over")}>See the getaways${ic("arrow", 18)}</a>
      <p class="bf-cal"${show("soon")}>${ic("calendar", 16)}<a href="${P.path}black-friday.ics" download data-bf-cal="ics">Add to calendar</a><span aria-hidden="true">·</span><a href="${esc(gcal)}" target="_blank" rel="noopener" data-bf-cal="google">Google Calendar</a></p>
    </div>
  </div>
</section>`;

const perks = `<section class="bf-sec" aria-labelledby="bf-perks-h">
  <div class="bf-sec-in">
    <h2 id="bf-perks-h" class="bf-h2 h">${esc(P.deals.length ? P.perksTitle : "What's in it for you")}</h2>
    <div class="bf-perks">${P.perks.map((p) => `<div class="bf-perk"><span class="bf-perk-i">${ic(p.icon, 22)}</span><b>${esc(p.title)}</b><p>${esc(p.text)}</p></div>`).join("")}</div>
  </div>
</section>`;

/* the dates form: saves to the Netlify form bf-early and opens WhatsApp with what was typed (bf.js);
   the who's-travelling picker is the site's usual one, a room at a time */
const F = P.form;
const req = `<span class="req" aria-hidden="true">*</span>`;
const formSec = `<section class="bf-sec" id="first-pick" aria-labelledby="bf-form-h"${show("soon live")}>
  <div class="bf-sec-in bf-form-grid">
    <div class="bf-form-copy">
      <span class="bf-eyebrow">${esc(F.kicker)}</span>
      <h2 id="bf-form-h" class="bf-h2 h">${esc(F.title)}</h2>
      <p class="bf-lead"><span${show("soon")}>${esc(F.soon)}</span><span${show("live")}>${esc(F.live)}</span></p>
      <ul class="bf-ticks">${F.ticks.map((t) => `<li>${ic("check", 18, 3)}<span>${esc(t)}</span></li>`).join("")}</ul>
    </div>
    <form class="bf-form" id="bf-form" name="bf-early" method="POST" action="${P.path}" data-netlify="true" netlify-honeypot="bot-field" novalidate data-ref="GV-BF" data-err="${esc(F.errPre)}" data-err-contact="${esc(F.errContact)}" data-saved-wa="${esc(F.saved)}" data-saved-site-soon="${esc(F.savedSiteSoon)}" data-saved-site-live="${esc(F.savedSiteLive)}" data-sent="${esc(F.sent)}" data-wa-soon="${esc(F.waSoon.replace(/'/g, "’"))}" data-wa-live="${esc(F.waLive.replace(/'/g, "’"))}">
      <input type="hidden" name="form-name" value="bf-early">
      <p class="hp" aria-hidden="true"><label>Leave this field empty <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>
      <input type="hidden" name="state" value="${STATE}"><input type="hidden" name="nights" value=""><input type="hidden" name="ref" value="GV-BF"><input type="hidden" name="via" value="">
      <fieldset class="bf-field bf-trips"><legend>${esc(F.tripLabel)}${req}</legend>
        <div class="bf-trip-row">${F.trips.map((t, i) => `<label class="bf-trip"><input type="radio" name="trip" value="${esc(t)}" id="bf-trip-${i}"><span>${esc(t)}</span></label>`).join("")}</div>
      </fieldset>
      <div class="bf-field"><label for="bf-where">${esc(F.whereLabel)}</label><input id="bf-where" type="text" name="where" list="bf-places" placeholder="${esc(F.wherePh)}" autocomplete="off"><datalist id="bf-places">${F.places.map((p) => `<option value="${esc(p)}"></option>`).join("")}</datalist></div>
      <div class="bf-2">
        <div class="bf-field"><label for="bf-in">${esc(F.arrive)}${req}</label><input id="bf-in" type="date" name="checkin" data-req="1"></div>
        <div class="bf-field"><label for="bf-out">${esc(F.leave)}${req}</label><input id="bf-out" type="date" name="checkout" data-req="1"></div>
      </div>
      <label class="bf-check"><input type="checkbox" name="flexible" value="yes" id="bf-flex"><span>${esc(F.flex)}</span></label>
      <div class="bf-field who-field who" data-who><span class="who-label" id="bf-who-l">Who's travelling</span><button type="button" class="who-btn" id="bf-who" aria-labelledby="bf-who-l bf-who" aria-expanded="false" aria-controls="bf-who-pop">2 adults</button>
        <div class="who-pop" id="bf-who-pop" hidden><div class="who-party"></div><button type="button" class="who-add" hidden>+ Add room</button><p class="who-hint">Ages at the time of travel.</p><button type="button" class="btn btn-black btn-sm who-done">Done</button></div>
        <input type="hidden" name="adults" value="2"><input type="hidden" name="children" value="0"><input type="hidden" name="rooms" value="1"><input type="hidden" name="child_ages" value=""></div>
      <div class="bf-field"><label for="bf-name">${esc(F.name)}${req}</label><input id="bf-name" type="text" name="name" autocomplete="name" data-req="1"></div>
      <div class="bf-2">
        <div class="bf-field"><label for="bf-phone">${esc(F.phone)}</label><input id="bf-phone" type="tel" name="phone" autocomplete="tel" inputmode="tel" placeholder="${esc(F.phonePh)}" aria-describedby="bf-contact-h"></div>
        <div class="bf-field"><label for="bf-email">${esc(F.email)}</label><input id="bf-email" type="email" name="email" autocomplete="email" inputmode="email" aria-describedby="bf-contact-h"></div>
      </div>
      <p class="bf-hint bf-contact-h" id="bf-contact-h">${esc(F.contactHint)}</p>
      <p class="bf-err" id="bf-err" role="alert" hidden></p>
      <a class="btn btn-black btn-lg btn-full" id="bf-go" href="${esc(wa(`${F.waSoon} Ref GV-BF`))}" data-base="https://wa.me/${S.whatsapp}" target="_blank" rel="noopener" data-where="bf-form" data-wa="1"><span${show("soon")}>${esc(F.btnSoon)}</span><span${show("live")}>${esc(F.btnLive)}</span>${ic("chat", 18)}</a>
      <button type="button" class="btn btn-outline btn-lg btn-full" id="bf-send">${esc(F.btnSite)}</button>
      <p class="bf-saved" id="bf-saved" role="status" hidden>${ic("check", 18, 3)}<span>${esc(F.saved)}</span></p>
      <p class="bf-small">${esc(F.small)} <a href="/privacy/">Privacy</a></p>
    </form>
  </div>
</section>`;

/* the rates lead the page: one tile per deal, right under the hero. A tile with its Black Friday price (from)
   shows it with the usual price struck through and the saving, and books on WhatsApp; a tile without one yet
   shows the usual price and "Black Friday rate Nov 19", and a tap fills the dates form with that trip.
   A tile drops off the day after its until date. */
const deals = P.deals.filter((d) => !d.until || d.until >= TODAY);
const LANE = { staycations: "Jamaica resort", visitors: "Coming to Jamaica", getaways: "Getaway" };
const LANES = [["staycations", "Jamaica resorts"], ["visitors", "Coming to Jamaica"], ["getaways", "Getaways"]];
const priced = (d) => typeof d.from === "number" && d.from > 0;
const anyPriced = deals.some(priced);
const dealTile = (d, i) => {
  const on = priced(d);
  const load = i < 4 ? 'loading="eager"' : 'loading="lazy"'; /* the first row is in view as the page opens */
  const save = on && d.was > d.from ? Math.round((1 - d.from / d.was) * 100) : 0;
  const msg = d.wa || `Hi Golden Vacation! I'd like the Black Friday rate for ${d.name} (from US$${fmt(d.from || d.was)} ${d.basis}). Ref GV-BF`;
  const attrs = on
    ? `href="${esc(d.href || wa(msg))}"${d.href ? "" : ' target="_blank" rel="noopener" data-where="bf-deal"'}`
    : `href="#first-pick" data-pick-trip="${esc(d.trip)}" data-pick-where="${esc(d.where)}"`;
  const price = on
    ? `<span class="bf-deal-p">from US$${fmt(d.from)}${d.was > d.from ? ` <s>US$${fmt(d.was)}</s>` : ""}</span>`
    : `<span class="bf-deal-p"><small>Usually from</small> US$${fmt(d.was)}</span>`;
  const flag = on
    ? (save >= 5 ? `<span class="bf-deal-flag">Save ${save}%</span>` : "")
    : `<span class="bf-deal-flag bf-deal-soon"><span${show("soon")}>Sale price Nov 19</span><span${show("live")}>Ask for the sale price</span></span>`;
  return `<a class="bf-deal" ${attrs} data-lane="${d.lane}" data-name="${esc(d.name)}"><img src="${esc(d.img)}" alt="${esc(d.alt)}" ${load} decoding="async">${flag}<span class="bf-deal-tags"><span class="bf-deal-lane">${LANE[d.lane] || ""}</span><span class="bf-deal-n">${esc(d.name)}</span>${price}<span class="bf-deal-l">${esc(d.basis)}${d.line ? `. ${esc(d.line)}` : ""}</span></span></a>`;
};
const lanesHere = LANES.filter(([k]) => deals.some((d) => d.lane === k));
const chips = lanesHere.length > 1 ? `<div class="bf-chips" role="group" aria-label="Show"><button type="button" class="chip" data-lane="" aria-pressed="true">All</button>${lanesHere.map(([k, l]) => `<button type="button" class="chip" data-lane="${k}" aria-pressed="false">${esc(l)}</button>`).join("")}</div>` : "";
const dealsSec = deals.length ? `<section class="bf-sec" id="deals" aria-labelledby="bf-deals-h"${show("soon live")}>
  <div class="bf-sec-in">
    <h2 id="bf-deals-h" class="bf-h2 h">${esc(P.ratesTitle)}</h2>
    <p class="bf-lead">${anyPriced ? esc(P.ratesLeadPriced) : `<span${show("soon")}>${esc(P.ratesLeadSoon)}</span><span${show("live")}>${esc(P.ratesLeadLive)}</span>`}</p>
    ${chips}
    <div class="bf-deals">${deals.map(dealTile).join("")}</div>
  </div>
</section>` : "";

const lanes = `<section class="bf-sec" aria-labelledby="bf-lanes-h">
  <div class="bf-sec-in">
    <h2 id="bf-lanes-h" class="bf-h2 h">${deals.length ? "More to explore" : "Where the deals land"}</h2>
    <div class="bf-lanes">${P.lanes.map((l) => `<a class="bf-lane" href="${esc(l.href)}"><img src="${esc(l.img)}" alt="${esc(l.alt)}" loading="lazy" decoding="async">${deals.length ? "" : `<span class="tag tag-gold"${show("soon")}>Deals land Nov 19</span><span class="tag tag-gold"${show("live")}>On now</span>`}<span class="bf-lane-t"><b>${esc(l.title)}</b><small>${esc(l.text)}</small></span></a>`).join("")}</div>
  </div>
</section>`;

const steps = `<section class="bf-sec" aria-labelledby="bf-how-h">
  <div class="bf-sec-in">
    <h2 id="bf-how-h" class="bf-h2 h">How it works</h2>
    <ol class="bf-steps">${P.steps.map((s) => `<li class="bf-step"><b>${esc(s.title)}</b><p>${esc(s.text)}</p></li>`).join("")}</ol>
    <p class="bf-fine">${esc(P.fine)}</p>
  </div>
</section>`;

const end = `<section class="bf-end" aria-label="Get first pick">
  <div class="bf-end-in">
    <div style="display:flex;flex-direction:column;gap:10px">
      <h2 class="h"><span${show("soon")}>Don't miss the opening.</span><span${show("live")}>Questions about a deal?</span><span${show("over")}>See you next Black Friday.</span></h2>
      <p><span${show("soon")}>Get on the early list and we message you on WhatsApp when the deals open.</span><span${show("live")}>On WhatsApp, within working hours, one of our travel professionals is ready to help.</span><span${show("over")}>Our getaways, resorts and tours are on all year.</span></p>
    </div>
    <a class="btn btn-black btn-lg" href="#first-pick"${show("soon")}>Tell us your dates${ic("arrow", 18)}</a>
    <a class="btn btn-black btn-lg" href="${esc(wa("Hi Golden Vacation! I have a question about a Black Friday deal. Ref GV-BF"))}" data-where="bf-end"${show("live")}>Ask us on WhatsApp${ic("chat", 18)}</a>
    <a class="btn btn-black btn-lg" href="/"${show("over")}>Go to the home page${ic("arrow", 18)}</a>
  </div>
</section>`;

const page = `${head}
<body class="bf">
${nav}
<main>
${hero}
${dealsSec}
${perks}
${formSec}
${lanes}
${steps}
${end}
</main>
${footer}
<script src="/assets/chrome.js" defer></script>
<script src="${P.path}bf.js" defer></script>
</body>
</html>
`;

/* the calendar file: one event at the opening, with a reminder 15 minutes before */
const icsFile = [
  "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Golden Vacation and Travel//Black Friday//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
  "BEGIN:VEVENT", `UID:black-friday-2026@goldenvacays.com`, `DTSTAMP:${ics(OPEN - 7 * 86400e3)}`, `DTSTART:${ics(OPEN)}`, `DTEND:${ics(OPEN + 3600e3)}`,
  `SUMMARY:${calTitle}`, `DESCRIPTION:${calText.replace(/,/g, "\\,")}`, `URL:${URL_}`, `LOCATION:${URL_}`,
  "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${calTitle}`, "TRIGGER:-PT15M", "END:VALARM",
  "END:VEVENT", "END:VCALENDAR", "",
].join("\r\n");

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "index.html"), page);
fs.writeFileSync(path.join(OUT, "black-friday.ics"), icsFile);
console.log(`wrote ${P.path}index.html (${STATE}, ${deals.length} deals) and black-friday.ics`);

/* sitemap: the page in its own marked block, which stays where it is on later runs */
const smPath = path.join(ROOT, "public/sitemap.xml");
if (fs.existsSync(smPath)) {
  let sm = fs.readFileSync(smPath, "utf8");
  const blockRe = /<!-- black-friday -->[\s\S]*?<!-- \/black-friday -->\n?/;
  const old = sm.match(blockRe);
  const lastmod = (old && (old[0].match(/<lastmod>([^<]+)<\/lastmod>/) || [])[1]) || `${TODAY}T00:00:00+00:00`;
  const entry = `<!-- black-friday -->\n<url>\n  <loc>${URL_}</loc>\n  <lastmod>${lastmod}</lastmod>\n  <priority>0.8</priority>\n</url>\n<!-- /black-friday -->\n`;
  sm = old ? sm.replace(blockRe, entry) : sm.replace(/\s*<\/urlset>\s*$/, `\n\n${entry}\n</urlset>\n`);
  fs.writeFileSync(smPath, sm);
  console.log("sitemap: black-friday listed");
}

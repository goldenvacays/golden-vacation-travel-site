#!/usr/bin/env node
/**
 * Builds the Getaways pages (goldenvacays.com/getaways) from data/getaways.json.
 *
 *   node scripts/build-getaways.mjs            → writes public/getaways/** (committed, Vite copies it as-is)
 *   node scripts/build-getaways.mjs --bundle out.html
 *                                              → one self-contained preview file (all pages, inline assets)
 *
 * Prices and copy live in data/getaways.json. Edit there, run the build, commit.
 */
import fs from "node:fs";
import path from "node:path";
import { ROOT, DATA, OUT, IMG_SRC, S, BASE, args, BUNDLE, NOINDEX, ARTIFACT, esc, fmt, usd, jmd, price, replyLine, img, usedImages, pic, heroPic, ICONS, icon, wa, waGeneric, btn, tag, kicker, biglink, check, faqItem, currency, ticker, stars, head, nav, footer, bottomBar, scripts } from "./_getaways-chrome.mjs";

/* hotel pages built by scripts/build-hotels.mjs (run it first); a package hotel row links to its page when one exists */
const HOTEL_PAGES_FILE = path.join(ROOT, "data/hotel-pages.json");
const HOTEL_PAGES = fs.existsSync(HOTEL_PAGES_FILE) ? JSON.parse(fs.readFileSync(HOTEL_PAGES_FILE, "utf8")) : [];

/* ---------- hub ---------- */
function hubPage() {
  const H = DATA.hub;
  const dests = DATA.destinations;
  const quoteForm = `<form id="hub-quote" class="qcard" action="${BASE}/quote/" method="get">
    <div class="qf">${icon("pin", 20)}<label><span>Where to</span><select name="d">${dests.map((d) => `<option value="${d.slug}">${esc(d.name)}</option>`).join("")}${DATA.combos.map((c) => `<option value="${c.slug}">${esc(c.name)}</option>`).join("")}<option value="">Somewhere else</option></select></label></div>
    <div class="qf">${icon("send", 20)}<label><span>Leaving from</span><select name="a"><option value="KIN">Kingston</option><option value="MBJ">Montego Bay</option></select></label></div>
    <div class="qf qf-dates"><div class="hq-dates"><label><span>Check in</span><input type="date" id="hub-in" name="from" data-dr="start" data-dr-pair="#hub-out" data-dr-optional></label><label><span>Check out</span><input type="date" id="hub-out" name="to" data-dr="end"></label></div></div>
    <div class="qf qf-who">${icon("users", 20)}<label><span>Who's travelling</span><button type="button" class="hq-who" id="hub-who" aria-expanded="false" aria-controls="hub-pop">2 adults</button></label>
      <div class="hq-pop" id="hub-pop" hidden>
        <div class="hq-line"><b>Adults</b><span class="hq-step"><button type="button" data-hub="a" data-d="-1" aria-label="One fewer adult">&minus;</button><output id="hub-a" aria-live="polite">2</output><button type="button" data-hub="a" data-d="1" aria-label="One more adult">+</button></span></div>
        <div class="hq-line"><b>Children</b><span class="hq-step"><button type="button" data-hub="k" data-d="-1" aria-label="One fewer child">&minus;</button><output id="hub-k" aria-live="polite">0</output><button type="button" data-hub="k" data-d="1" aria-label="One more child">+</button></span></div>
        <div class="hq-ages" id="hub-ages" hidden></div>
        <p class="hq-hint">Ages at the time of travel.</p>
        <button type="button" class="btn btn-black btn-sm" id="hub-done">Done</button>
      </div>
      <input type="hidden" name="adults" id="hub-adults" value="2"><input type="hidden" name="kids" id="hub-kids" value="0"><input type="hidden" name="ages" id="hub-ages-v" value="">
    </div>
    <div class="qsubmit"><button class="btn btn-black btn-lg btn-full" type="submit">Get a quote${icon("arrow", 18)}</button></div>
  </form>
  <span class="qnote">No account, no payment. On WhatsApp, within working hours, one of our travel professionals is ready to help.</span>`;

  const hero = `<section class="hero"><picture>${heroPic(H.hero.img, H.hero.alt)}</picture>
    <div class="hero-in wrap"><div>${tag(H.kicker, "white").replace('class="tag', 'class="desk tag')}${tag("Getaways from Jamaica", "white").replace('class="tag', 'class="mob tag')}</div><h1 class="hh">${esc(H.headline)}</h1><p>${esc(H.sub)}</p></div></section>
  <div class="wrap">${quoteForm}</div>`;

  const how = `<section id="how" class="how wrap">
    <div class="how-t">${kicker("How it works")}<span class="hh">Three steps.<br>All on WhatsApp.</span></div>
    <div class="steps">${H.steps.map(([t, x], i) => `<div class="step"><span class="step-n">${i + 1}</span><div><b>${esc(t)}</b><p>${esc(x)}</p></div></div>`).join("")}</div>
  </section>`;
  const howMobile = `<section class="sec mob" style="padding-top:20px"><div class="sec-head"><div>${kicker("How it works")}</div></div>
    <div class="steps">${H.steps.map(([t, x], i) => `<div class="step"><span class="step-n">${i + 1}</span><div><b>${esc(t)}</b><p>${esc(x)}</p></div></div>`).join("")}</div></section>`;

  const proof = `<div class="proof">${stars()}<span>${esc(H.proof)}</span></div>`;

  const tiles = dests.map((d, i) => `<a class="tile${i === 0 ? " span2" : ""}" href="${BASE}/${d.slug}/">${pic(d.tileImg, d.tileAlt)}${tag(d.tileTag, "gold")}
      <div class="tile-in"><div><span class="hh">${esc(d.name)}</span><small class="tile-note">${esc(d.tileNote)}</small><small class="mob">from <strong>${usd(d.from)}</strong></small></div><div class="from desk"><span>from</span><b class="hh">${usd(d.from)}</b></div></div></a>`).join("");
  const onreq = `<a class="onreq" href="${BASE}/quote/">${tag("On request", "black").replace('class="tag', 'class="desk tag')}<div><b>${esc(H.onRequest.title)}</b><small>${esc(H.onRequest.text)}</small></div>${icon("arrow", 20, 2.4)}<span class="biglink desk">Ask for a quote${icon("arrow", 20, 2.4)}</span></a>`;
  const destinations = `<section id="destinations" class="sec wrap">
    <div class="sec-head"><div>${kicker("Destinations")}<h2 class="hh">${esc(H.destinationsTitle)}</h2><p class="sec-sub desk">${esc(H.destinationsSub)}</p></div>${biglink("All packages", "#packages").replace('class="biglink', 'class="desk biglink')}</div>
    <div class="tiles">${tiles}${onreq}</div>
  </section>`;

  const [c1, c2] = DATA.combos;
  const combos = `<section class="sec wrap sec-tight" id="combos">
    <div class="sec-head"><div>${kicker("Two countries, one trip")}<h2 class="hh">${esc(H.combosTitle)}</h2><p class="sec-sub">${esc(H.combosSub)}</p></div></div>
    <div class="combos-grid">
      <a class="combo-big" href="${BASE}/${c1.slug}/">${pic(c1.tile.img, c1.tile.alt)}<div class="tags">${c1.tile.tags.map((t, i) => tag(t, i ? "white" : "gold")).join("")}</div>
        <div class="in"><div><span class="hh">${esc(c1.name)}</span><br><small class="combo-sub"><span class="long">${esc(c1.tile.sub)}</span><span class="short">${esc(c1.tile.subShort)}</span></small></div><div class="from"><span>from</span><b class="hh">${usd(c1.price)}</b></div></div></a>
      <a class="combo-row" href="${BASE}/${c2.slug}/">${pic(c2.tile.img, c2.tile.alt)}<div class="t"><div><b class="hh">${esc(c2.name)}</b><small class="combo-sub"><span class="long">${esc(c2.tile.sub)}</span><span class="short">${esc(c2.tile.subShort)}</span></small></div><span class="biglink">See the trip${icon("arrow", 20, 2.4)}</span></div>${icon("arrow", 22, 2.4)}</a>
    </div>
  </section>`;

  const pkgCard = (d) => `<article class="pkg">
    <a class="pkg-photo" href="${BASE}/${d.slug}/">${pic(d.card.img, d.card.alt)}<div class="tags">${d.card.tags.map((t, i) => tag(t, i ? "white" : "gold")).join("")}</div></a>
    <div class="pkg-t"><a class="h" href="${BASE}/${d.slug}/">${esc(d.name)}</a><b>${esc(d.card.sub)}</b><p>${esc(d.card.meta)}</p></div>
    <div class="pkg-b"><div class="price-blk"><span class="lbl">from, per person</span><b class="hh">${price(d.card.price)}</b><small>${esc(d.card.priceNote)}</small></div>${btn("Get a quote", `${BASE}/quote/?d=${d.slug}`)}</div>
    <span class="pkg-foot">Your dates · quoted on WhatsApp · deposit holds it</span>
  </article>`;
  const packages = `<section id="packages" class="sec wrap sec-tight">
    <div class="sec-head"><div>${kicker("Packages")}<h2 class="hh">${esc(H.packagesTitle)}</h2></div></div>
    <div class="pkg-meta-row"><span>Prices per person sharing · J$ at ${S.jmdRate}</span>${currency()}</div>
  </section>
  <div class="pkgs wrap">${dests.map(pkgCard).join("")}</div>`;

  const why = `<section class="sec wrap sec-tight">
    <div class="sec-head"><div>${kicker("Why book with Golden")}<h2 class="hh">${esc(H.whyTitle)}</h2><p class="sec-sub">${esc(H.whySub)}</p></div></div>
    <div class="why-grid">${H.why.map(([ic, t, x]) => `<div class="why">${icon(ic, 22)}<div><b class="h">${esc(t)}</b><p>${esc(x)}</p></div></div>`).join("")}</div>
  </section>`;

  const need = `<section class="sec wrap sec-tight">
    <div class="sec-head"><div>${kicker("Before you go")}<h2 class="hh">${esc(H.needTitle)}</h2></div></div>
    <div class="need-grid">${H.need.map(([ic, t, x]) => `<div class="why">${icon(ic, 22)}<div><b class="h">${esc(t)}</b><p>${esc(x)}</p></div></div>`).join("")}</div>
  </section>`;

  const faqs = `<section id="questions" class="faqs"><div class="wrap faqs-grid">
    <div class="faq-side">${kicker("Questions people ask us on WhatsApp")}<h2 class="hh h2 desk">${esc(H.faqTitle)}</h2>${btn("Ask on WhatsApp", waGeneric("the Getaways page"), "black", "", "chat", ' data-where="faq"')}</div>
    <div class="faq">${H.faq.map(([q, a]) => faqItem(q, a)).join("")}</div>
  </div></section>`;

  const people = `<section class="sec wrap sec-tight"><div class="people-grid">
    <div class="people">${kicker("Who you're talking to")}<span class="h">${esc(H.people.title)}</span><p>${esc(H.people.text)}</p></div>
    <div class="custom"><span class="h">${esc(H.custom.title)}</span><p>${esc(H.custom.text)}</p>${btn("Ask for a custom quote", `${BASE}/quote/`, "outline", "", "chat", ' class="btn btn-outline btn-full"').replace('class="btn btn-outline" ', "")}</div>
  </div></section>`;

  const stay = `<div class="wrap"><section class="stay"><div><span class="hh">${esc(H.stay.title)}</span><p>${esc(H.stay.text)}</p></div>${btn(H.stay.cta, H.stay.href)}</section></div>`;

  const jsonld = [
    { "@context": "https://schema.org", "@type": "WebPage", name: H.title, url: `${S.origin}${BASE}/`, description: H.description, isPartOf: { "@id": `${S.origin}/#organization` } },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: `${S.origin}/` }, { "@type": "ListItem", position: 2, name: "Getaways", item: `${S.origin}${BASE}/` }] },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: H.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
    { "@context": "https://schema.org", "@type": "ItemList", name: "Getaways from Jamaica", itemListElement: dests.map((d, i) => ({ "@type": "ListItem", position: i + 1, name: d.name, url: `${S.origin}${BASE}/${d.slug}/` })) },
  ];
  const body = `<body class="ga-page has-bar">
${nav()}
${hero}
${howMobile}
${proof}
<div class="desk">${ticker(H.ticker)}</div>
<div class="desk">${how}</div>
${destinations}
${combos}
${packages}
${why}
${need}
${faqs}
${people}
${stay}
${footer()}
${bottomBar("Get a quote on WhatsApp", `${BASE}/quote/`, "Replies within working hours · no payment yet")}
${scripts(true)}
</body></html>`;
  return head({ title: H.title, description: H.description, pathname: `${BASE}/`, image: H.hero.img, jsonld }) + body;
}

/* ---------- destination page ---------- */
function destPage(d) {
  const quoteUrl = (h) => `${BASE}/quote/?d=${d.slug}${h ? `&h=${h}` : ""}&n=${d.defaultNights}&a=${d.airports[0].code}`;
  const lead = d.groups.flatMap((g) => g.hotels).find((h) => h.slug === d.leadHotel);
  const leadPrice = lead.prices[d.defaultNights];
  const hotelRow = (h, g) => {
    const p = h.prices[d.defaultNights];
    const other = Object.keys(h.prices).filter((k) => String(k) !== String(d.defaultNights)).map((k) => `${k} nights ${usd(h.prices[k])}`).join(" · ");
    const pagePath = `${BASE}/${d.slug}/${h.slug}`, hasPage = HOTEL_PAGES.includes(pagePath); // a hotel with its own page opens there (photos, rooms, map); the quote button is on it
    return `<a class="hotel" href="${hasPage ? pagePath : quoteUrl(h.slug)}"${hasPage ? ' data-page="1"' : ""} data-slug="${h.slug}" data-prices='${JSON.stringify(h.prices)}'>${h.img ? pic(h.img, h.name) : `<span class="hotel-ph" aria-hidden="true">${esc(h.name.slice(0, 1))}</span>`}
      <div class="hotel-t">${h.top ? `<span class="pill-star">Most popular</span>` : ""}<b>${esc(h.name)}</b><small>${esc(h.note)}</small></div>
      <div class="hotel-p"><span class="lbl">${d.defaultNights} nights</span>${p != null ? price(p, "hh") : ""}<small class="ask" ${p != null ? "hidden" : ""}>quoted with your dates</small><small>${g.board ? esc(g.board) : "bed &amp; breakfast"}</small><small class="more">${esc(other)}</small></div>
      <span class="go btn btn-outline btn-sm">${hasPage ? "Details" : "Quote"}${icon("arrow", 16)}</span></a>`;
  };
  const groups = d.groups.map((g) => `<section class="sec"><div class="sec-head"><div>${kicker(g.title)}<p class="sec-sub">${esc(g.note)}</p></div></div><div class="hotels">${g.hotels.map((h) => hotelRow(h, g)).join("")}</div></section>`).join("");
  const opts = `<div class="opts">
    ${d.airports.length > 1 ? `<div class="opt"><span class="lbl">Leaving from</span><div class="chip-row">${d.airports.map((a, i) => `<button type="button" class="chip" data-airport="${a.code}" data-name="${esc(a.name)}" data-surcharge="${a.surcharge}" aria-pressed="${i === 0}">${esc(a.name)}</button>`).join("")}</div></div>` : `<span class="sr" data-airport="${d.airports[0].code}" data-name="${esc(d.airports[0].name)}" data-surcharge="0"></span>`}
    <div class="opt"><span class="lbl">Nights</span><div class="chip-row">${d.nights.map((n, i) => `<button type="button" class="chip" data-nights="${n}" aria-pressed="${n === d.defaultNights}">${n} nights</button>`).join("")}${d.nightsAsk ? `<a class="chip" href="${quoteUrl("")}">${esc(d.nightsAsk)}</a>` : ""}</div></div>
    ${d.airportNote ? `<span class="opt-note">${esc(d.airportNote)}</span>` : ""}
  </div>`;
  const leadBlock = `<div class="lead">
    <div class="lead-photo">${pic(d.leadImg, d.leadAlt)}<div class="tags">${d.leadTags.map((t, i) => tag(t, i === 0 && t === "Most popular" ? "gold" : "white")).join("")}</div></div>
    <div class="lead-row"><div><span class="h">${esc(lead.name)}</span><br><span class="meta">${d.defaultNights} nights · ${esc(d.leadMeta)}</span></div>
      <div class="lead-price"><span class="lbl">${esc(d.airports[0].name)} · ${d.defaultNights} nights</span>${price(leadPrice, "hh")}<small>per person sharing</small></div></div>
    ${btn(`Get a quote for ${lead.name}`, quoteUrl(lead.slug), "black", "", "arrow", ' class="btn btn-black btn-full"').replace('class="btn btn-black" ', "")}
  </div>`;
  const tours = `<section class="list"><div>${kicker(d.toursTitle)}</div><p class="sec-sub">${esc(d.toursNote)}</p>
    ${d.tours.map((t) => `<div class="tour">${pic(t.img, t.alt)}<div class="tour-t"><b>${esc(t.name)}</b><small>${esc(t.text)}</small></div><span class="hh">${usd(t.price)}</span></div>`).join("")}</section>`;
  const comboCta = d.combo ? `<a class="combo-cta" href="${d.combo.href}"><div><span class="k">${esc(d.combo.kicker)}</span><br><span class="h">${esc(d.combo.title)}</span><br><small>${esc(d.combo.text)}</small></div>${icon("arrow", 24, 2.4)}</a>` : "";
  const included = `<section class="list"><div>${kicker("What's included")}</div>${d.included.map((t) => check(esc(t))).join("")}</section>`;
  const deposit = `<div class="deposit"><span class="h">Hold it with a deposit from ${usd(d.deposit)}.</span><p>${esc(d.depositText)}</p></div>`;
  const gtk = `<section class="gtk"><div>${kicker("Good to know")}</div><div class="faq">${d.faq.map(([q, a]) => faqItem(q, a)).join("")}</div></section>`;

  const jsonld = [
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: `${S.origin}/` }, { "@type": "ListItem", position: 2, name: "Getaways", item: `${S.origin}${BASE}/` }, { "@type": "ListItem", position: 3, name: d.name, item: `${S.origin}${BASE}/${d.slug}/` }] },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: d.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: replyLine(a) } })) },
    { "@context": "https://schema.org", "@type": "TouristTrip", name: `${d.name} package from Jamaica`, description: d.description, touristType: "Jamaican passport holders", url: `${S.origin}${BASE}/${d.slug}/`, provider: { "@id": `${S.origin}/#organization` }, offers: { "@type": "AggregateOffer", priceCurrency: "USD", lowPrice: d.from, offerCount: d.groups.reduce((n, g) => n + g.hotels.length, 0), availability: "https://schema.org/InStock" } },
  ];
  const body = `<body class="ga-page has-bar" data-dest="${d.slug}" data-default-airport="${d.airports[0].code}" data-default-nights="${d.defaultNights}" data-lead="${lead.slug}">
${nav({ back: `${BASE}/`, title: `the ${d.name} page` })}
<section class="hero-photo">${heroPic(d.hero.img, d.hero.alt)}<div class="hero-tags">${d.heroTags.map((t, i) => tag(t, i ? "white" : "gold")).join("")}</div></section>
<div class="wrap">
<div class="dest-head">${kicker(d.kicker)}<h1 class="hh">${esc(d.name)}</h1><p>${esc(d.intro)}</p></div>
${opts}
<div class="dest-grid">
  <div class="dest-side">${leadBlock}</div>
  <div class="dest-main">
    ${groups}
    <div class="note-box">${icon("calendar", 20)}<span>${d.priceNote}</span></div>
    ${included}
    ${tours}
    ${comboCta}
    ${deposit}
    ${gtk}
  </div>
</div>
</div>
${ticker(d.ticker)}
${footer()}
${bottomBar("Get a quote for these dates", quoteUrl(lead.slug), d.bottomNote)}
${scripts(true)}
</body></html>`;
  return head({ title: d.title, description: d.description, pathname: `${BASE}/${d.slug}/`, image: d.hero.img, jsonld }) + body;
}

/* ---------- combo page ---------- */
function comboPage(c) {
  const quoteUrl = `${BASE}/quote/?d=${c.slug}`;
  const legs = c.legs.map(([city, nights, hotel, what, im], i) => `<div class="leg"><div class="leg-line"></div><div class="leg-n">${i + 1}</div><div class="leg-b"><span class="h">${esc(city)} <span>· ${esc(nights)}</span></span><b>${esc(hotel)}</b><p>${esc(what)}</p>${im ? pic(im, hotel) : ""}</div></div>`).join("");
  const priceBox = `<div class="combo-price"><div class="price-blk"><span class="lbl">${esc(c.nightsLabel)}</span>${price(c.price, "hh")}<small>deposit from ${usd(c.deposit)}</small></div>${btn("Get a quote", quoteUrl)}</div>`;
  const included = `<section class="list"><div>${kicker("What's included")}</div>${c.included.map((t) => check(esc(t))).join("")}</section>`;
  const tours = `<section class="list"><div>${kicker("Days out")}</div><p class="sec-sub">${esc(c.toursNote)}</p>${c.tours.map((t) => `<div class="tour">${pic(t.img, t.alt)}<div class="tour-t"><b>${esc(t.name)}</b><small>${esc(t.text)}</small></div><span class="hh">${usd(t.price)}</span></div>`).join("")}</section>`;
  const dates = `<form class="dates" action="${BASE}/quote/" method="get"><input type="hidden" name="d" value="${c.slug}"><div>${kicker("Your dates")}</div>
    <div class="dates-grid"><label class="field"><span>Leaving</span><span class="field-in"><input type="date" name="from" id="d-leaving" data-dr="start" data-dr-pair="#d-returning" data-dr-optional></span></label><label class="field"><span>Returning</span><span class="field-in"><input type="date" name="to" id="d-returning" data-dr="end"></span></label></div>
    <span class="note">${esc(c.datesNote)}</span>
    <button class="btn btn-black btn-full" type="submit">Get a quote for these dates${icon("arrow", 18)}</button></form>`;
  const deposit = `<div class="deposit"><span class="h">Hold it with a deposit from ${usd(c.deposit)}.</span><p>Balance due 30 days before departure, in J$ or US$, by card link or bank transfer.</p></div>`;
  const gtk = `<section class="gtk"><div>${kicker("Good to know")}</div><div class="faq">${c.faq.map(([q, a]) => faqItem(q, a)).join("")}</div></section>`;
  const jsonld = [
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: `${S.origin}/` }, { "@type": "ListItem", position: 2, name: "Getaways", item: `${S.origin}${BASE}/` }, { "@type": "ListItem", position: 3, name: c.name, item: `${S.origin}${BASE}/${c.slug}/` }] },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: c.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
    { "@context": "https://schema.org", "@type": "TouristTrip", name: `${c.name} from Jamaica`, description: c.description, url: `${S.origin}${BASE}/${c.slug}/`, provider: { "@id": `${S.origin}/#organization` }, offers: { "@type": "Offer", priceCurrency: "USD", price: c.price, availability: "https://schema.org/InStock" } },
  ];
  const body = `<body class="ga-page has-bar">
${nav({ back: `${BASE}/`, title: `the ${c.name} page` })}
<section class="hero-photo">${heroPic(c.hero.img, c.hero.alt)}<div class="hero-tags">${c.heroTags.map((t, i) => tag(t, i < 2 ? "gold" : "white")).join("")}</div></section>
<div class="wrap">
<div class="dest-head">${kicker(c.kicker)}<h1 class="hh">${esc(c.name)}</h1><p>${esc(c.intro)}</p></div>
<div class="combo-grid">
  <div class="combo-main">
    <div class="legs">${legs}</div>
    <div class="mob">${priceBox}</div>
    ${included}
    ${tours}
    <div class="mob">${dates}</div>
    <div class="mob">${deposit}</div>
    ${gtk}
  </div>
  <div class="combo-side desk">${priceBox}${dates}${deposit}</div>
</div>
</div>
${ticker(c.ticker)}
${footer()}
${bottomBar("Get a quote for these dates", quoteUrl, c.bottomNote)}
${scripts(true)}
</body></html>`;
  return head({ title: c.title, description: c.description, pathname: `${BASE}/${c.slug}/`, image: c.hero.img, jsonld }) + body;
}

/* ---------- quote page ---------- */
function quotePage() {
  const quoteData = {
    destinations: DATA.destinations.map((d) => ({ slug: d.slug, code: d.code, name: d.name, short: d.short, img: d.hero.img, airports: d.airports, nights: d.nights, nightsAsk: d.nightsAsk || null, hotels: d.groups.flatMap((g) => g.hotels.map((h) => ({ slug: h.slug, name: h.name, img: h.img || null }))) })),
    combos: DATA.combos.map((c) => ({ slug: c.slug, code: c.code, name: c.name, short: c.name, img: c.hero.img, combo: true, airport: c.airport, airportName: c.airportName, hotelLabel: c.hotelLabel })),
  };
  [...DATA.destinations.map((d) => d.hero.img), ...DATA.combos.map((c) => c.hero.img), ...DATA.destinations.flatMap((d) => d.groups.flatMap((g) => g.hotels.map((h) => h.img)))].filter(Boolean).forEach((f) => usedImages.add(f));
  const meals = ["Bed and breakfast", "All inclusive", "No meals", "Not sure"];
  const body = `<body class="ga-page">
${nav({ back: `${BASE}/`, title: "the quote page" })}
<div class="quote-wrap">
<form id="quote-form" class="quote-form" onsubmit="return false">
<div class="quote">${kicker("Step 1 of 2")}<h1 class="hh">Let's get you a number.</h1><p>Six quick answers. They go straight to one of our travel professionals on WhatsApp, no account, no payment yet.</p>
  <div class="qsel"><img id="q-thumb" src="" alt="" hidden><label class="qsel-t"><span class="lbl">Where to</span><select id="q-dest" name="d"><option value="">Somewhere else (tell us in the message)</option>${DATA.destinations.map((d) => `<option value="${d.slug}">${esc(d.name)}</option>`).join("")}${DATA.combos.map((c) => `<option value="${c.slug}">${esc(c.name)}</option>`).join("")}</select></label></div>
  <div class="qsel"><label class="qsel-t"><span class="lbl">Hotel</span><select id="q-hotel" name="h"></select></label></div>
  <label class="field" hidden><span>Where would you like to go?</span><span class="field-in">${icon("pin", 20)}<input type="text" id="q-other" name="other" placeholder="Cancún, Brazil, Cartagena, anywhere"></span></label>
</div>
<div class="qform">
  <div class="opt"><span class="lbl">Leaving from</span><div class="chip-row" id="q-airports"></div></div>
  <div class="opt"><span class="lbl">Nights</span><div class="chip-row" id="q-nights"></div></div>
  <div class="grid2"><label class="field"><span>Leaving</span><span class="field-in"><input type="date" id="q-leaving" name="from" data-dr="start" data-dr-pair="#q-returning" data-dr-optional></span></label><label class="field"><span>Returning</span><span class="field-in"><input type="date" id="q-returning" name="to" data-dr="end"></span></label></div>
  <div id="q-party"></div>
  <button type="button" class="hq-addroom" id="q-addroom">+ Add room</button>
  <div class="opt"><span class="lbl">Meals</span><div class="chip-row">${meals.map((b) => `<button type="button" class="chip" data-meals="${esc(b)}" aria-pressed="${b === "Not sure"}">${esc(b)}</button>`).join("")}</div></div>
  <label class="field"><span>Your name</span><span class="field-in">${icon("users", 20)}<input type="text" id="q-name" name="name" placeholder="So we know who we're talking to" autocomplete="given-name"></span></label>
  <div class="opt"><span class="lbl">Quote me in</span><div class="curr" role="group" aria-label="Quote currency"><button type="button" data-cur="US$" class="on">US$</button><button type="button" data-cur="J$">J$</button></div></div>
</div>
<div class="qform"><div>${kicker("Step 2 · what we'll send")}</div>
  <div class="wa-preview"><div class="wa-head">${icon("chat", 18)}<span>WhatsApp · Golden Vacation &amp; Travel</span></div><div class="wa-bubble" id="wa-text"></div><small>You can edit the message before it sends. It lands tagged <strong id="q-tag">Quote</strong> with reference <strong id="q-ref"></strong>, so the right person picks it up.</small></div>
</div>
<div class="qsend">
  <span class="err" id="q-err" role="alert"></span>
  <a id="q-send" class="btn btn-black btn-lg btn-full" href="https://wa.me/${S.whatsapp}" target="_blank" rel="noopener">Open WhatsApp and send${icon("chat", 18)}</a>
  <a class="alt" href="tel:${S.phoneTel}">No WhatsApp? Call ${esc(S.phone)}</a>
  <p>${esc(S.replyLine)}</p>
</div>
</form>
</div>
${footer()}
<script>window.GV_QUOTE=${JSON.stringify(quoteData)};</script>
${scripts(true)}
</body></html>`;
  return head({ title: "Get a quote for your getaway | Golden Vacation & Travel", description: "Tell us where, when and who's going. Your quote comes back on WhatsApp from one of our travel professionals, within working hours. No account, no payment yet.", pathname: `${BASE}/quote/`, image: S.ogImage, noindex: true }) + body;
}

/* ---------- write ---------- */
const pages = [
  ["index.html", hubPage()],
  ...DATA.destinations.map((d) => [`${d.slug}/index.html`, destPage(d)]),
  ...DATA.combos.map((c) => [`${c.slug}/index.html`, comboPage(c)]),
  ["quote/index.html", quotePage()],
];

if (!BUNDLE) {
  for (const [rel, html] of pages) {
    const f = path.join(OUT, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, html);
    console.log("wrote", path.relative(ROOT, f), `${(html.length / 1024).toFixed(0)}K`);
  }
  // copy the images the pages use
  fs.mkdirSync(path.join(OUT, "img"), { recursive: true });
  let missing = [];
  for (const f of usedImages) {
    const src = path.join(IMG_SRC, f), dst = path.join(OUT, "img", f);
    if (fs.existsSync(src)) { if (path.resolve(src) !== path.resolve(dst)) fs.copyFileSync(src, dst); }
    else if (!fs.existsSync(dst)) missing.push(f);
  }
  if (missing.length) console.warn("MISSING IMAGES:", missing.join(", "));
} else {
  // Single-file preview: every page inside a <template>, assets inline, images as data URIs, hash router.
  const css = fs.readFileSync(path.join(OUT, "assets/getaways.css"), "utf8");
  const js = fs.readFileSync(path.join(OUT, "assets/getaways.js"), "utf8");
  const dataUri = {};
  for (const f of usedImages) {
    const p = fs.existsSync(path.join(IMG_SRC, f)) ? path.join(IMG_SRC, f) : path.join(OUT, "img", f);
    if (fs.existsSync(p)) dataUri[`${BASE}/img/${f}`] = `data:image/jpeg;base64,${fs.readFileSync(p).toString("base64")}`;
  }
  const bodies = pages.map(([rel, html]) => {
    const route = `${BASE}/${rel.replace(/index\.html$/, "")}`;
    let body = html.slice(html.indexOf("<body"), html.lastIndexOf("</body>"));
    const cls = (body.match(/<body([^>]*)>/) || ["", ""])[1];
    body = body.replace(/<body[^>]*>/, "").replace(/<script src="[^"]*getaways\.js"[^>]*><\/script>/, "");
    for (const [k, v] of Object.entries(dataUri)) body = body.split(`src="${k}"`).join(`src="${v}"`);
    const title = (html.match(/<title>([^<]*)<\/title>/) || ["", ""])[1];
    const inline = [...html.matchAll(/<script>(window\.GV_QUOTE=.*?)<\/script>/gs)].map((m) => m[1]).join("\n");
    return { route, body, cls, title, inline };
  });
  const bundle = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Golden Vacays Getaways</title><meta name="robots" content="noindex,nofollow">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@100,400;100,500;100,600;100,700;110,800;110,900&display=swap">
<style>${css}
.pv-bar{position:sticky;top:0;z-index:50;display:flex;align-items:center;gap:10px;padding:8px 14px;background:#0E0F0E;color:#F2B93B;font:700 12px/1.3 Archivo,Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase;overflow-x:auto}
.pv-bar a{color:#fff;white-space:nowrap;padding:4px 8px;border-radius:999px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.35)}
.pv-bar a.on{background:#F2B93B;color:#0E0F0E;box-shadow:none}</style>
<script>window.GV_CONFIG=${JSON.stringify({ base: BASE, whatsapp: S.whatsapp, jmdRate: S.jmdRate })};</script>
</head><body>
<div class="pv-bar"><span>Preview</span>${bodies.map((b) => `<a href="#${b.route}" data-route="${b.route}">${esc(b.route.replace(BASE, "").replace(/\//g, " ").trim() || "hub")}</a>`).join("")}</div>
<div id="pv-root"></div>
${bodies.map((b) => `<template data-route="${b.route}" data-cls="${esc(b.cls)}" data-title="${b.title}">${b.body}</template>`).join("\n")}
<script>
(function(){
  var root=document.getElementById('pv-root');var GVJS=${JSON.stringify(js)};
  function routeOf(h){h=(h||'').replace(/^#/,'');if(!h)return '${BASE}/';h=h.split('?')[0].split('#')[0];if(!/\\/$/.test(h))h+='/';return h;}
  function anchorOf(h){h=(h||'').replace(/^#/,'');var i=h.indexOf('#');return i>=0?h.slice(i+1).split('?')[0]:'';}
  function render(){var h=location.hash;var r=routeOf(h);var t=document.querySelector('template[data-route="'+r+'"]')||document.querySelector('template[data-route="${BASE}/"]');
    document.body.className=t.getAttribute('data-cls').replace(/.*class="([^"]*)".*/,'$1');
    Array.prototype.forEach.call(t.content.querySelectorAll('[data-dest]'),function(){});
    root.innerHTML='';root.appendChild(t.content.cloneNode(true));
    var attrs=t.getAttribute('data-cls');var m;var re=/([a-z-]+)="([^"]*)"/g;while((m=re.exec(attrs))){if(m[1]==='class')document.body.className=m[2];else document.body.setAttribute(m[1],m[2]);}
    document.title=t.getAttribute('data-title')+' · preview';
    var q=h.indexOf('?')>=0?h.slice(h.indexOf('?')):'';history.replaceState(null,'',location.pathname+location.hash);
    window.__gvSearch=q;
    Array.prototype.forEach.call(root.querySelectorAll('script'),function(s){var n=document.createElement('script');n.textContent=s.textContent;s.parentNode.replaceChild(n,s);});
    var s=document.createElement('script');s.textContent=GVJS.replace('new URLSearchParams(location.search)','new URLSearchParams(window.__gvSearch||"")');root.appendChild(s);
    document.querySelectorAll('.pv-bar a').forEach(function(a){a.classList.toggle('on',a.getAttribute('data-route')===r);});
    var anc=anchorOf(h);var el=anc&&root.querySelector('#'+anc);if(el){el.scrollIntoView();}else{window.scrollTo({top:0,behavior:'instant'});}
  }
  document.addEventListener('click',function(e){var a=e.target.closest('a');if(!a)return;var href=a.getAttribute('href')||'';
    if(href.indexOf('${BASE}')===0){e.preventDefault();if(('#'+href)===location.hash){render();}else{location.hash='#'+href;}}
    else if(href.charAt(0)==='#' && href.indexOf('#${BASE}')!==0){var el=root.querySelector(href);if(el){e.preventDefault();el.scrollIntoView({behavior:'smooth'});}}
    else if(href==='/'||href.indexOf('/hotel-status')===0||href.indexOf('/groups/')===0){a.setAttribute('target','_blank');a.href='https://goldenvacays.com'+href;}
  });
  document.addEventListener('submit',function(e){var f=e.target;if(f.getAttribute('action')&&f.getAttribute('action').indexOf('${BASE}')===0){e.preventDefault();var qs=new URLSearchParams(new FormData(f)).toString();location.hash='#'+f.getAttribute('action')+'?'+qs;}});
  window.addEventListener('hashchange',render);render();
})();
</script></body></html>`;
  let out = bundle;
  if (ARTIFACT) {
    out = bundle.replace(/^<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">/, "")
      .replace("</head><body>", "").replace(/<\/body><\/html>$/, "");
  }
  fs.writeFileSync(BUNDLE, out);
  console.log("wrote", BUNDLE, `${(bundle.length / 1024).toFixed(0)}K`);
}

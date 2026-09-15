#!/usr/bin/env node
/**
 * Builds one page per hotel under the Getaways section from data/hotels.json (generated from
 * Hana's spreadsheet by scripts/import-hotels.py) plus the guest-facing words in data/hotels-copy.json.
 *
 *   python3 scripts/import-hotels.py        -> data/hotels.json
 *   node scripts/build-hotels.mjs           -> public/getaways/<destination>/<hotel>.html (served at /getaways/<destination>/<hotel>)
 *   node scripts/build-getaways.mjs         -> rebuild the package pages so their hotel rows link here
 *
 * Prices, tours, deposit and questions come from data/getaways.json (the package the hotel sits in);
 * the nav, footer and head come from scripts/_getaways-chrome.mjs, shared with the package pages.
 */
import fs from "node:fs";
import path from "node:path";
import { ROOT, DATA, OUT, S, BASE, esc, usd, price, img, pic, heroPic, icon, btn, tag, kicker, check, faqItem, ticker, head, nav, footer, bottomBar, scripts } from "./_getaways-chrome.mjs";


const HOTELS = JSON.parse(fs.readFileSync(path.join(ROOT, "data/hotels.json"), "utf8")).hotels;
const COPY = JSON.parse(fs.readFileSync(path.join(ROOT, "data/hotels-copy.json"), "utf8"));
const CSS_HOTELS = `${BASE}/assets/hotels.css`;

/* trade notes never reach a page: any sentence with one of these is dropped from a sheet field */
const TRADE = /\b(confirm|tbc|trade record|not published|not shown|make no|quot(e|ed|ing)\b|the lineup|on file|the whole file|brochure|booking engine|per (the hotel|openstreetmap|a trade)|contract|commission|the other all inclusives|compete)/i;
const guest = (s) => {
  if (!s) return "";
  const parts = String(s).split(/(?<=[.!?])\s+/).filter((p) => p.trim() && !TRADE.test(p));
  return parts.join(" ").trim();
};
const short = (s) => { const g = guest(s); return g && !TRADE.test(g) ? g : ""; };
/* hotel room codes (DLK, SUK) mean nothing to a guest: drop "Code XXX." sentences and "in the XXX category" asides; write bed sizes out */
const decode = (s) => String(s || "").replace(/\s*Codes?\s+[A-Z0-9]{2,6}(\s*,\s*[A-Z0-9]{2,6})*\.?/g, "").replace(/\s*\(?\bin the [A-Z0-9]{2,6} category\b\)?/g, "").replace(/(\d{2,3})x(\d{2,3})/g, "$1 x $2 cm").replace(/\s{2,}/g, " ").trim();
const starOf = (s) => { const m = /(\d)\s*star/i.exec(s || ""); return m ? `${m[1]} star` : ""; };
const splitList = (s) => {
  const out = [];
  String(s || "").split(/,\s*/).forEach((f) => { f = f.trim(); if (!f) return; if (out.length && /^[a-z]/.test(f)) out[out.length - 1] += `, ${f}`; else out.push(f); });
  return out.filter((f) => !TRADE.test(f));
};
const slugOf = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const kv = (rows) => `<dl class="hp-kv">${rows.filter(([, v]) => v).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>`;

function hotelPage(hotel) {
  const d = DATA.destinations.find((x) => x.slug === hotel.dest);
  if (!d) return null;
  let group = null, row = null;
  d.groups.forEach((g) => g.hotels.forEach((h) => { if (h.slug === hotel.slug) { group = g; row = h; } }));
  const copy = COPY[hotel.slug] || {};
  const prices = (row && row.prices) || {};
  const name = copy.name || hotel.name;
  const shortName = copy.shortName || (row ? row.name : name);
  const board = group && group.board ? group.board : (/all inclusive/i.test(hotel.property_type || "") ? "all-inclusive" : "bed & breakfast");
  const isAI = /all.inclusive/i.test(board);
  const district = copy.district || short(hotel.district);
  const star = starOf(hotel.star_rating);
  const pathname = `${BASE}/${d.slug}/${hotel.slug}`; // a flat file, served at the bare path like the Experiences pages (no trailing slash)
  const quoteUrl = `${BASE}/quote/?d=${d.slug}&h=${hotel.slug}&n=${d.defaultNights}&a=${d.airports[0].code}`;
  const defaultPrice = prices[d.defaultNights];
  const photo = copy.photo || (row && row.img) || null;
  const photos = (copy.photos || []).filter(Boolean);
  const airportTime = short(hotel.drive_time_to_airport) || short(hotel.distance_to_airport_km);

  /* facts row: the five or six things a guest compares on */
  const facts = [
    star,
    short(hotel.property_type),
    hotel.total_rooms && /^\d+$/.test(hotel.total_rooms) ? `${hotel.total_rooms} rooms` : "",
    hotel.pool && !/^no\b/i.test(hotel.pool) ? (/rooftop/i.test(hotel.pool) ? "Rooftop pool" : /infinity/i.test(hotel.pool) ? "Infinity pool" : /\b(four|six|4|6)\b/i.test(hotel.pool) ? "Several pools" : /indoor/i.test(hotel.pool) ? "Indoor pool" : "Pool") : (hotel.pool ? "No pool" : ""),
    airportTime ? `Airport ${airportTime.replace(/^about /i, "about ").replace(/\.$/, "")}` : "",
    board.replace(/^\w/, (c) => c.toUpperCase()),
  ].filter(Boolean);

  const heroTags = (copy.tags || []).slice(0, 2);
  const hero = photo
    ? `<section class="hero-photo hp-hero">${heroPic(photo, `${name}`)}<div class="hero-tags">${heroTags.map((t, i) => tag(t, i ? "white" : "gold")).join("")}</div></section>`
    : `<section class="hp-hero-empty"><div class="wrap"><span class="kicker kicker-light">${esc(d.name)}${district ? ` · ${esc(district)}` : ""} · photos coming</span><div class="hero-tags-inline">${heroTags.map((t, i) => tag(t, i ? "white" : "gold")).join("")}</div></div></section>`;

  /* price card, driven by getaways.js exactly like the destination page (chips + data-lead) */
  const priceCard = `<div class="lead hp-lead">
    <span class="hotel sr" data-slug="${hotel.slug}" data-prices='${JSON.stringify(prices)}' hidden></span>
    <div class="lead-row"><div><span class="h">${esc(shortName)}</span><br><span class="meta">${d.defaultNights} nights · ${esc(board)}</span></div>
      <div class="lead-price"><span class="lbl">${esc(d.airports[0].name)} · ${d.defaultNights} nights</span>${defaultPrice != null ? price(defaultPrice, "hh") : `<span class="price hh" hidden></span>`}<small class="ask"${defaultPrice != null ? " hidden" : ""}>quoted with your dates</small><small>per person sharing, flights, hotel and transfers</small></div></div>
    ${btn(`Get a quote for ${shortName}`, quoteUrl, "black", "", "arrow", ' class="btn btn-black btn-full"').replace('class="btn btn-black" ', "")}
    <small class="hp-lead-note">Starting price. The exact rate depends on your dates, and it comes back on WhatsApp within working hours. Deposit from ${usd(d.deposit)}.</small>
  </div>`;

  const gtk = (copy.goodToKnow || []).length ? `<section class="list hp-sec"><div>${kicker("Good to know")}</div>${copy.goodToKnow.map((t) => check(esc(t))).join("")}</section>` : "";

  const rooms = hotel.rooms.length ? `<section class="hp-sec"><div>${kicker("Rooms")}<p class="sec-sub">${hotel.rooms.length} categor${hotel.rooms.length === 1 ? "y" : "ies"} as the hotel publishes them. Sleeps counts the beds, including sofa beds; we confirm the maximum for your party when we quote.</p></div>
    <div class="hp-rooms">${hotel.rooms.map((r) => {
      const meta = [r.size, r.sleeps ? `sleeps ${r.sleeps}` : "", decode(r.beds)].filter(Boolean).map((x) => esc(x)).join(" · ");
      const note = decode(guest(r.notes));
      return `<div class="hp-room"><b>${esc(r.name)}</b>${meta ? `<small>${meta}</small>` : ""}${note ? `<p>${esc(note)}</p>` : ""}</div>`;
    }).join("")}</div></section>` : "";

  const amenities = splitList(hotel.full_amenity_list);
  const amen = amenities.length ? `<section class="hp-sec"><div>${kicker("At the hotel")}</div><div class="hp-amen">${amenities.map((a) => `<span>${esc(a)}</span>`).join("")}</div></section>` : "";

  const dining = kv([["Restaurants", short(hotel.restaurant)], ["Bars", short(hotel.bar)], ["Breakfast", short(hotel.breakfast)], ["Room service", short(hotel.room_service)]]);
  const diningSec = /<dt>/.test(dining) ? `<section class="hp-sec"><div>${kicker("Eating and drinking")}</div>${dining}</section>` : "";

  const resortIncluded = isAI && hotel.included ? `<section class="list hp-sec"><div>${kicker("Included at the resort")}</div>${String(hotel.included).split(/,\s*(?=[A-Z0-9])/).map((t) => guest(t)).filter(Boolean).map((t) => check(esc(t.replace(/\.$/, "")))).join("")}${hotel.costs_extra ? `<p class="hp-extra"><b>Costs extra:</b> ${esc(guest(hotel.costs_extra))}</p>` : ""}</section>` : "";
  const kids = hotel.kids && guest(hotel.kids) ? `<section class="hp-sec"><div>${kicker("For children")}</div><p class="hp-p">${esc(guest(hotel.kids))}</p></section>` : "";

  const practical = kv([
    ["Check-in", short(hotel.check_in)], ["Check-out", short(hotel.check_out)],
    ["Airport", [short(hotel.airport_code), airportTime.replace(/^About/, "about")].filter(Boolean).join(", ")],
    ["Airport transfer", short(hotel.airport_transfer)], ["Parking", short(hotel.parking)], ["Wi-Fi", short(hotel.wi_fi)],
    ["Reception", short(hotel.reception_hours)], ["Languages", short(hotel.languages_spoken)], ["Pets", short(hotel.pet_policy)],
    ["Accessibility", decode(short(hotel.accessibility))], ["Built", short(hotel.year_built)], ["Renovated", short(hotel.year_renovated)],
  ]);
  const practicalSec = /<dt>/.test(practical) ? `<section class="hp-sec"><div>${kicker("The practical bits")}</div>${practical}</section>` : "";

  const lat = hotel.latitude, lng = hotel.longitude;
  const mapUrl = lat != null && lng != null ? `https://www.google.com/maps?q=${lat},${lng}&z=15&output=embed` : "";
  const mapLink = lat != null && lng != null ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` : "";
  const where = `<section class="hp-sec"><div>${kicker("Where it is")}<p class="sec-sub">${esc([short(hotel.address), district, d.name].filter(Boolean).join(", "))}</p></div>
    ${mapUrl ? `<div class="hp-map"><iframe src="${mapUrl}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Map of ${esc(name)}" allowfullscreen></iframe></div><a class="biglink" href="${mapLink}" target="_blank" rel="noopener">Open in Google Maps${icon("arrow", 20, 2.4)}</a>` : ""}
    ${hotel.nearby_landmarks ? `<p class="hp-p"><b>Nearby:</b> ${esc(guest(hotel.nearby_landmarks))}</p>` : ""}</section>`;

  const tours = d.tours && d.tours.length ? `<section class="list hp-sec"><div>${kicker(d.toursTitle || "Days out")}</div><p class="sec-sub">${esc(d.toursNote || "")}</p>
    ${d.tours.map((t) => `<div class="tour">${pic(t.img, t.alt)}<div class="tour-t"><b>${esc(t.name)}</b><small>${esc(t.text)}</small></div><span class="hh">${usd(t.price)}</span></div>`).join("")}</section>` : "";
  const included = `<section class="list hp-sec"><div>${kicker("What the package includes")}</div>${d.included.map((t) => check(esc(t))).join("")}</section>`;
  const deposit = `<div class="deposit"><span class="h">Hold it with a deposit from ${usd(d.deposit)}.</span><p>${esc(d.depositText)}</p></div>`;
  const faq = `<section class="gtk"><div>${kicker("Questions")}</div><div class="faq">${d.faq.map(([q, a]) => faqItem(q, a)).join("")}</div></section>`;

  const opts = `<div class="opts">
    ${d.airports.length > 1 ? `<div class="opt"><span class="lbl">Leaving from</span><div class="chip-row">${d.airports.map((a, i) => `<button type="button" class="chip" data-airport="${a.code}" data-name="${esc(a.name)}" data-surcharge="${a.surcharge}" aria-pressed="${i === 0}">${esc(a.name)}</button>`).join("")}</div></div>` : `<span class="sr" data-airport="${d.airports[0].code}" data-name="${esc(d.airports[0].name)}" data-surcharge="0"></span>`}
    <div class="opt"><span class="lbl">Nights</span><div class="chip-row">${d.nights.map((n) => `<button type="button" class="chip" data-nights="${n}" aria-pressed="${n === d.defaultNights}">${n} nights</button>`).join("")}${d.nightsAsk ? `<a class="chip" href="${quoteUrl}">${esc(d.nightsAsk)}</a>` : ""}</div></div>
    ${d.airportNote ? `<span class="opt-note">${esc(d.airportNote)}</span>` : ""}
  </div>`;

  const description = copy.intro ? copy.intro : guest(hotel.one_line_description);
  const metaDescription = `${shortName} in ${d.name}${district ? ` (${district})` : ""}: ${guest(hotel.one_line_description) || description.split(". ")[0]}. From Jamaica with flights and transfers, ${defaultPrice != null ? `from ${usd(defaultPrice)} per person` : "quoted with your dates"}.`.replace(/\.\./g, ".").slice(0, 300);
  const title = `${shortName}, ${d.name}: ${d.defaultNights} nights from Jamaica with flights${defaultPrice != null ? ` from ${usd(defaultPrice)}` : ""} | Golden Vacation & Travel`;

  const jsonld = [
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: `${S.origin}/` }, { "@type": "ListItem", position: 2, name: "Getaways", item: `${S.origin}${BASE}/` }, { "@type": "ListItem", position: 3, name: d.name, item: `${S.origin}${BASE}/${d.slug}/` }, { "@type": "ListItem", position: 4, name: shortName, item: `${S.origin}${pathname}` }] },
    { "@context": "https://schema.org", "@type": "Hotel", name, ...(photo ? { image: `${S.origin}${img(photo)}` } : {}), address: { "@type": "PostalAddress", streetAddress: short(hotel.address) || undefined, addressLocality: d.name, addressCountry: hotel.country || d.country }, ...(lat != null ? { geo: { "@type": "GeoCoordinates", latitude: lat, longitude: lng } } : {}), ...(star ? { starRating: { "@type": "Rating", ratingValue: star[0] } } : {}), url: `${S.origin}${pathname}` },
  ];

  const body = `<body class="has-bar hp" data-dest="${d.slug}" data-default-airport="${d.airports[0].code}" data-default-nights="${d.defaultNights}" data-lead="${hotel.slug}">
${nav({ back: `${BASE}/${d.slug}/`, title: `the ${shortName} page` })}
${hero}
<div class="wrap">
<div class="dest-head hp-head"><a class="hp-crumb" href="${BASE}/${d.slug}/">${icon("back", 16, 2.6)}All ${esc(d.name)} hotels</a>${kicker(`Getaways from Jamaica · ${d.name}${district ? ` · ${district}` : ""}`)}<h1 class="hh">${esc(name)}</h1><p>${esc(description)}</p></div>
<div class="hp-facts">${facts.map((f) => `<span>${esc(f)}</span>`).join("")}</div>
${opts}
<div class="dest-grid">
  <div class="dest-side">${priceCard}</div>
  <div class="dest-main">
    ${gtk}
    ${rooms}
    ${resortIncluded}
    ${kids}
    ${amen}
    ${diningSec}
    ${practicalSec}
    ${where}
    ${tours}
    ${included}
    ${deposit}
    ${faq}
  </div>
</div>
</div>
${ticker(d.ticker)}
${footer()}
${bottomBar(`Get a quote for ${shortName}`, quoteUrl, d.bottomNote)}
${scripts()}
</body></html>`;
  return { pathname, html: head({ title, description: metaDescription, pathname, image: photo || d.hero.img, jsonld, extraHead: `<link rel="stylesheet" href="${CSS_HOTELS}">` }) + body };
}

/* ---------- write ---------- */
const built = [];
for (const hotel of HOTELS) {
  if (!hotel.dest) continue;
  const page = hotelPage(hotel);
  if (!page) continue;
  const f = path.join(OUT, hotel.dest, `${hotel.slug}.html`);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, page.html);
  built.push(page.pathname);
  console.log("wrote", path.relative(ROOT, f), `${(page.html.length / 1024).toFixed(0)}K`);
}
fs.writeFileSync(path.join(ROOT, "data/hotel-pages.json"), JSON.stringify(built, null, 1) + "\n"); // the Getaways build reads this to link hotel rows to their pages
console.log(`${built.length} hotel pages`);

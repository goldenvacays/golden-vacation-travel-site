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
/* square metres stay off the pages (Hana: nobody reads them): "rooms from 44 sq m, a spa" -> "rooms, a spa"; "both 44 sq m sleeping three" -> "both sleeping three" */
const nosize = (s) => String(s).replace(/\s+(from|of|at)\s+\d+(\.\d+)?\s*(sq\s*m|m2|m²)\b/gi, "").replace(/,\s*\d+(\.\d+)?\s*(sq\s*m|m2|m²)(?=[.,;])/gi, "").replace(/\b(a|an)\s+\d+(\.\d+)?\s*(sq\s*m|m2|m²)\s+/gi, "$1 ").replace(/\b\d+(\.\d+)?\s*(sq\s*m|m2|m²)\s*/gi, "").replace(/\s{2,}/g, " ");
const guest = (s) => {
  if (!s) return "";
  const parts = nosize(s).split(/(?<=[.!?])\s+/).filter((p) => p.trim() && !TRADE.test(p));
  return parts.join(" ").trim();
};
const short = (s) => { const g = guest(s); return g && !TRADE.test(g) ? g : ""; };
/* hotel room codes (DLK, SUK) mean nothing to a guest: drop "Code XXX." sentences and "in the XXX category" asides */
const decode = (s) => String(s || "").replace(/\s*Codes?\s+[A-Z0-9]{2,6}(\s*,\s*[A-Z0-9]{2,6})*\.?/g, "").replace(/\s*\(?\bin the [A-Z0-9]{2,6} category\b\)?/g, "").replace(/\s{2,}/g, " ").trim();
/* beds: the generic type only (king, queen, double, twin), never the dimensions. A width in the sheet decides the type
   when the sheet only gives sizes: 180 cm and up is a king, 140 to 179 a double, under 140 a twin. */
const bedText = (s) => {
  if (!s) return "";
  let t = String(s);
  t = t.replace(/(\d+)\s*beds?\s+(\d{2,3})\s*x\s*\d{2,3}(\s*cm)?/gi, (m, n, w) => { const k = +w >= 180 ? "king" : +w >= 140 ? "double" : "twin"; return `${n} ${k} bed${+n === 1 ? "" : "s"}`; });
  t = t.replace(/,?\s*\b\d+(\.\d+)?\s*x\s*\d+(\.\d+)?\s*(m|cm)?\b/gi, "");
  t = t.replace(/\s+or\s+mixed\b/i, ""); // "2 beds or mixed" is trade shorthand; the two-bed line stands on its own
  return t.replace(/\s{2,}/g, " ").replace(/\s+,/g, ",").trim();
};
const starOf = (s) => { const m = /(\d)\s*star/i.exec(s || ""); return m ? `${m[1]} star` : ""; };
const splitList = (s) => {
  const out = [];
  String(s || "").replace(/(\d),(\d{3})\b/g, "$1$2").split(/,\s*/).forEach((f) => {
    f = f.replace(/\b\d+\s*sq ?(ft|m)\b/gi, "").replace(/^\d+(\.\d+)?\s*km$/i, "").trim(); if (!f) return;
    /* a fragment that starts lowercase, or that only qualifies the item before it ("24 hour access"), belongs to that item */
    if (out.length && (/^[a-z]/.test(f) || /^\d+\s*(hour access|hours)$/i.test(f))) out[out.length - 1] += `, ${f}`; else out.push(f);
  });
  return out.filter((f) => !TRADE.test(f));
};
/* "Calle Atahualpa 155, Miraflores" + district "Miraflores" + "Lima" -> one Miraflores, not two */
const whereLine = (parts) => {
  const out = [];
  parts.filter(Boolean).join(", ").split(/,\s*/).forEach((t) => { t = t.trim(); if (t && !out.some((o) => o.toLowerCase().includes(t.toLowerCase()))) out.push(t); });
  return out.join(", ");
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
  /* a beach resort two hours down the coast is not "in Panama City": the page names the country and the beach instead (copy.place, e.g. "Panama" with district "Playa Blanca, Cocle") */
  const place = copy.place || d.name;
  const star = starOf(hotel.star_rating);
  const pathname = `${BASE}/${d.slug}/${hotel.slug}`; // a flat file, served at the bare path like the Experiences pages (no trailing slash)
  const quoteUrl = `${BASE}/quote/?d=${d.slug}&h=${hotel.slug}&n=${d.defaultNights}&a=${d.airports[0].code}`;
  const defaultPrice = prices[d.defaultNights];
  const photos = (copy.photos || []).filter((p) => p && p.file);
  const photo = photos.length ? photos[0].file : (copy.photo || (row && row.img) || null);
  const roomService = short(hotel.room_service);

  /* facts row: the five or six things a guest compares on (no airport distance: the transfer is in the package, and Hana says nobody reads the km) */
  const facts = [
    star,
    short(hotel.property_type),
    hotel.total_rooms && /^\d+$/.test(hotel.total_rooms) ? `${hotel.total_rooms} rooms` : "",
    hotel.pool && !/^no\b/i.test(hotel.pool) ? (/rooftop/i.test(hotel.pool) ? "Rooftop pool" : /infinity/i.test(hotel.pool) ? "Infinity pool" : /\b(four|six|4|6)\b/i.test(hotel.pool) ? "Several pools" : /indoor/i.test(hotel.pool) ? "Indoor pool" : "Pool") : (hotel.pool ? "No pool" : ""),
    roomService && !/^no\b/i.test(roomService) ? (/24/.test(roomService) ? "24 hour room service" : "Room service") : "",
    board.replace(/^\w/, (c) => c.toUpperCase()),
  ].filter(Boolean);

  const heroTags = (copy.tags || []).slice(0, 3);
  const tagsHtml = `<div class="hero-tags">${heroTags.map((t, i) => tag(t, i ? "white" : "gold")).join("")}</div>`;
  const PHOTO_ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;display:block"><rect x="3" y="5" width="18" height="14" rx="2"></rect><circle cx="12" cy="12" r="3.5"></circle><path d="M8 5l1.5-2h5L16 5"></path></svg>';
  let hero;
  if (photos.length > 1) {
    /* the swipe strip from the tour pages: every photo side by side, dots, arrows on hover, a "N photos" pill, tap opens the viewer */
    /* responsive sources: -s (800px) for tiles, the 1600px file, -l (2400px) for the hero on sharp wide screens and the viewer */
    const heroSet = (p) => p.large ? ` srcset="${img(p.file)} 1600w, ${img(p.large)} 2400w" sizes="100vw"` : "";
    const slides = photos.map((p, i) => `<div class="hero-slide">${i === 0 ? heroPic(p.file, p.alt).replace("<img ", `<img class="lb-open" data-i="0"${heroSet(p)} `) : pic(p.file, p.alt, "lb-open", ` data-i="${i}"${heroSet(p)}`)}</div>`).join("");
    const dots = `<div class="hero-dots" role="tablist" aria-label="Which photo">${photos.map((p, i) => `<button type="button" role="tab" aria-selected="${i === 0 ? "true" : "false"}" aria-label="Photo ${i + 1} of ${photos.length}" data-i="${i}"></button>`).join("")}</div>`;
    const arrows = `<button type="button" class="hero-arrow hero-prev" aria-label="Previous photo">${icon("arrow", 18, 2.4)}</button><button type="button" class="hero-arrow hero-next" aria-label="Next photo">${icon("arrow", 18, 2.4)}</button>`;
    const pill = `<button type="button" class="tag tag-white photos-btn lb-open" data-i="0">${PHOTO_ICON}${photos.length} photos</button>`;
    hero = `<section class="hero-photo hp-hero has-slides"><div class="hero-track" id="hero-track">${slides}</div>${tagsHtml}${pill}${dots}${arrows}</section>`;
  } else if (photo) {
    hero = `<section class="hero-photo hp-hero">${heroPic(photo, `${name}`)}${tagsHtml}</section>`;
  } else {
    hero = `<section class="hp-hero-empty"><div class="wrap"><span class="kicker kicker-light">${esc(place)}${district ? ` · ${esc(district)}` : ""} · photos coming</span><div class="hero-tags-inline">${heroTags.map((t, i) => tag(t, i ? "white" : "gold")).join("")}</div></div></section>`;
  }
  const photoData = photos.length > 1 ? `<script>window.GV_HOTEL=${JSON.stringify({ slug: hotel.slug, name: shortName, photos: photos.map((p) => [img(p.file), p.alt, p.large ? img(p.large) : null]) })};</script><script src="${BASE}/assets/hotels.js" defer></script>` : "";

  /* price card, driven by getaways.js like the destination page (airport chips + data-lead), but every stay length is listed
     instead of nights chips: one row per length, each a link to the quote page with that length filled in. A hotel with no
     starting price at all gets one "quoted with your dates" row. */
  const quoteFor = (n) => `${BASE}/quote/?d=${d.slug}&h=${hotel.slug}&n=${n}&a=${d.airports[0].code}`;
  const nightsRows = Object.keys(prices).length ? d.nights : [d.defaultNights];
  const airportOpt = d.airports.length > 1
    ? `<div class="opt"><span class="lbl">Leaving from</span><div class="chip-row">${d.airports.map((a, i) => `<button type="button" class="chip" data-airport="${a.code}" data-name="${esc(a.name)}" data-surcharge="${a.surcharge}" aria-pressed="${i === 0}">${esc(a.name)}</button>`).join("")}</div></div>`
    : `<span class="sr" data-airport="${d.airports[0].code}" data-name="${esc(d.airports[0].name)}" data-surcharge="0"></span>`;
  const priceCard = `<div class="lead hp-lead">
    <span class="hotel sr" data-slug="${hotel.slug}" data-prices='${JSON.stringify(prices)}' hidden></span>
    <div class="hp-lead-head"><span class="h">${esc(shortName)}</span><span class="meta">${esc(board.replace(/^\w/, (c) => c.toUpperCase()))} · flights, hotel and transfers${d.airports.length === 1 ? ` · from ${esc(d.airports[0].name)}` : ""}</span></div>
    ${airportOpt}
    <div class="hp-nights">${nightsRows.map((n) => {
      const p = prices[n];
      return `<a class="hp-nrow" data-n="${n}" href="${quoteFor(n)}"><span class="hp-nrow-l">${n} nights</span>${p != null ? price(p, "hh") : `<span class="price hh" hidden></span>`}<small class="ask"${p != null ? " hidden" : ""}>quoted with your dates</small>${icon("arrow", 18, 2.4)}</a>`;
    }).join("")}${d.nightsAsk ? `<a class="hp-nrow hp-nrow-ask" href="${quoteUrl}"><span class="hp-nrow-l">${esc(d.nightsAsk)}</span>${icon("arrow", 18, 2.4)}</a>` : ""}</div>
    <small class="hp-lead-per">${Object.keys(prices).length ? "Per person sharing. Starting prices; the exact rate depends on your dates." : "Per person sharing. Send your dates and we quote it within working hours."}</small>
    <div class="hp-card-inc"><span class="lbl">The price includes</span>${d.included.map((t) => /^Your (hotel|resort)\b/i.test(t) ? `Your ${/^Your resort/i.test(t) ? "resort" : "hotel"}, ${board}` : t).map((t) => `<span class="hp-inc">${icon("check", 16, 2.8)}<span>${esc(t)}</span></span>`).join("")}</div>
    ${btn(`Get a quote for ${shortName}`, quoteUrl, "black", "", "arrow", ' class="btn btn-black btn-full"').replace('class="btn btn-black" ', "")}
    <small class="hp-lead-note">The quote comes back on WhatsApp within working hours. Nothing to pay yet: a deposit from ${usd(d.deposit)} holds it${/^Balance due 30 days before departure/.test(d.depositText || "") ? `, the balance is due 30 days before departure in J$ or US$, and a payment plan is available.` : `. ${esc(d.depositText || "")}`}</small>
  </div>`;


  /* rooms: one card per category, with the room's photo when hotels-copy.json maps one (roomPhotos: name -> file).
     Sizes in square metres are left out on purpose. A room photo that is also in the strip opens the viewer at that photo. */
  const roomPhotos = copy.roomPhotos || {};
  Object.keys(roomPhotos).forEach((n) => { if (!hotel.rooms.some((r) => r.name === n)) console.warn(`  ${hotel.slug}: roomPhotos "${n}" matches no room in the sheet`); });
  const roomCard = (r) => {
      const meta = [r.sleeps ? `sleeps ${r.sleeps}` : "", bedText(decode(r.beds))].filter(Boolean).map((x) => esc(x)).join(" · ");
      const note = decode(guest(r.notes));
      const rp = roomPhotos[r.name];
      const idx = rp ? photos.findIndex((p) => p.file === rp) : -1;
      const small = idx >= 0 ? (photos[idx].small || photos[idx].file) : rp;
      const roomSet = idx >= 0 && photos[idx].small ? ` srcset="${img(photos[idx].small)} 800w, ${img(photos[idx].file)} 1600w" sizes="(min-width: 900px) 30vw, 100vw"` : "";
      const shot = !rp ? "" : idx >= 0
        ? `<button type="button" class="hp-room-img lb-open" data-i="${idx}" aria-label="Open the ${esc(r.name)} photo">${pic(small, photos[idx].alt, "", roomSet)}</button>`
        : `<div class="hp-room-img">${pic(small, r.name)}</div>`;
      return `<div class="hp-room${shot ? " has-img" : ""}">${shot}<div class="hp-room-t"><b>${esc(r.name)}</b>${meta ? `<small>${meta}</small>` : ""}${note ? `<p>${esc(note)}</p>` : ""}</div></div>`;
  };
  /* the categories people book go up front; the rest sit behind See more (roomsUpFront in hotels-copy.json, else the first 5 when there are more than 6) */
  if (copy.roomsUpFront) copy.roomsUpFront.forEach((n) => { if (!hotel.rooms.some((r) => r.name === n)) console.warn(`  ${hotel.slug}: roomsUpFront "${n}" matches no room in the sheet`); });
  const upFront = copy.roomsUpFront ? hotel.rooms.filter((r) => copy.roomsUpFront.includes(r.name)) : (hotel.rooms.length > 6 ? hotel.rooms.slice(0, 5) : hotel.rooms);
  const moreRooms = hotel.rooms.filter((r) => !upFront.includes(r));
  const rooms = hotel.rooms.length ? `<section class="hp-sec"><div>${kicker("Rooms")}</div>
    <div class="hp-rooms">${upFront.map(roomCard).join("")}</div>
    ${moreRooms.length ? `<details class="hp-more"><summary><span class="chip">See ${moreRooms.length} more categor${moreRooms.length === 1 ? "y" : "ies"}${icon("arrow", 16, 2.6)}</span></summary><div class="hp-rooms">${moreRooms.map(roomCard).join("")}</div></details>` : ""}</section>` : "";

  /* the chips are facilities a guest scans for (pools, restaurants, gym, spa, kids club, lounge); the things the paragraph above
     already says (Wi-Fi, parking, reception, room service, pets, in-room basics, board, policies) stay out of the chips */
  const CHIP_DROP = /\b(wi-?fi|parking|reception|front desk|room service|pets?\b|pet friendly|dogs?\b|air conditioning|safe\b|coffee|kettle|nespresso|iron\b|ironing|fridge|refrigerator|minibar|liquor dispenser|television|tv\b|hdtv|hairdryer|desk\b|workspace|wardrobe|digital key|check ?in|check ?out|laundry|dry cleaning|smok(e|ing)|adapted|accessib|wheelchair|breakfast|bed and breakfast|all inclusive|unlimited luxury|taxes|gratuities|wristband|reservations|languages|concierge|luggage|cots?\b|cribs?\b|amenities kit|bathrobe|prices quoted|cancellation|room only|refundable|towels|first aid|nurse|pharmacy|ev charging|airport|shuttle|transfer|kosher rooms|non motorised|telephone|mattress|printing|business (centre|facilities)|car rental|tour desk|ticket desk|in the group|stay free|sq ?(ft|m)\b|private bathroom|ramps|fire alarm|balcony|terrace|bathtub|shower|sofa bed|family rooms?\b|family suites?\b|fun4all|family resort|in the suite|kids? (menu|programme))/i;
  const amenities = splitList(hotel.full_amenity_list).filter((a) => !CHIP_DROP.test(a));
  /* About the hotel: the written block from hotels-copy.json (about: strings or [lead, text]), the amenity chips under it.
     Without an about block, the sheet fields are joined into plain paragraphs. */
  const aboutParas = (copy.about && copy.about.length) ? copy.about.map((p) => Array.isArray(p) ? `<p class="hp-p"><b>${esc(p[0])}.</b> ${esc(p[1])}</p>` : `<p class="hp-p">${esc(p)}</p>`) : [
    (copy.goodToKnow || []).length ? `<p class="hp-p">${esc(copy.goodToKnow.join(" "))}</p>` : "",
    (() => { const t = [["Restaurants", short(hotel.restaurant)], ["Bars", short(hotel.bar)], ["Breakfast", short(hotel.breakfast)], ["Room service", short(hotel.room_service)]].filter(([, v]) => v).map(([k, v]) => `${k}: ${v.replace(/\.$/, "")}`).join(". "); return t ? `<p class="hp-p"><b>Eating and drinking.</b> ${esc(t)}.</p>` : ""; })(),
    (() => { const t = [["Check-in", short(hotel.check_in)], ["Check-out", short(hotel.check_out)], ["Parking", short(hotel.parking)], ["Wi-Fi", short(hotel.wi_fi)], ["Reception", short(hotel.reception_hours)], ["Languages", short(hotel.languages_spoken)], ["Pets", short(hotel.pet_policy)], ["Accessibility", decode(short(hotel.accessibility))]].filter(([, v]) => v).map(([k, v]) => `${k}: ${v.replace(/\.$/, "")}`).join(". "); return t ? `<p class="hp-p"><b>The practical bits.</b> ${esc(t)}.</p>` : ""; })(),
  ].filter(Boolean);
  const about = aboutParas.length || amenities.length ? `<section class="hp-sec hp-about"><div>${kicker("About the hotel")}</div>${aboutParas.join("")}${amenities.length ? `<div class="hp-amen">${amenities.map((a) => `<span>${esc(a)}</span>`).join("")}</div>` : ""}</section>` : "";

  const lat = hotel.latitude, lng = hotel.longitude;
  const mapUrl = lat != null && lng != null ? `https://www.google.com/maps?q=${lat},${lng}&z=15&output=embed` : "";
  const mapLink = lat != null && lng != null ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` : "";
  const where = `<section class="hp-sec"><div>${kicker("Where it is")}<p class="sec-sub">${esc(whereLine([short(hotel.address), district, place]))}</p></div>
    ${mapUrl ? `<div class="hp-map"><iframe src="${mapUrl}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Map of ${esc(name)}" allowfullscreen></iframe></div><a class="biglink" href="${mapLink}" target="_blank" rel="noopener">Open in Google Maps${icon("arrow", 20, 2.4)}</a>` : ""}
    ${hotel.nearby_landmarks ? `<p class="hp-p"><b>Nearby:</b> ${esc(guest(hotel.nearby_landmarks).replace(/\s+\d+(\.\d+)?\s*km\b/gi, ""))}</p>` : ""}</section>`;

  const faq = `<section class="gtk"><div>${kicker("Questions")}</div><div class="faq">${d.faq.map(([q, a]) => faqItem(q, a)).join("")}</div></section>`;

  const description = copy.intro ? copy.intro : guest(hotel.one_line_description);
  const metaDescription = `${shortName} in ${place}${district ? ` (${district})` : ""}: ${guest(hotel.one_line_description) || description.split(". ")[0]}. From Jamaica with flights and transfers, ${defaultPrice != null ? `from ${usd(defaultPrice)} per person` : "quoted with your dates"}.`.replace(/\.\./g, ".").slice(0, 300);
  const title = `${shortName}, ${place}: ${d.defaultNights} nights from Jamaica with flights${defaultPrice != null ? ` from ${usd(defaultPrice)}` : ""} | Golden Vacation & Travel`;

  const jsonld = [
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: `${S.origin}/` }, { "@type": "ListItem", position: 2, name: "Getaways", item: `${S.origin}${BASE}/` }, { "@type": "ListItem", position: 3, name: d.name, item: `${S.origin}${BASE}/${d.slug}/` }, { "@type": "ListItem", position: 4, name: shortName, item: `${S.origin}${pathname}` }] },
    { "@context": "https://schema.org", "@type": "Hotel", name, ...(photo ? { image: `${S.origin}${img(photo)}` } : {}), address: { "@type": "PostalAddress", streetAddress: short(hotel.address) || undefined, addressLocality: short(hotel.city) || d.name, addressCountry: hotel.country || d.country }, ...(lat != null ? { geo: { "@type": "GeoCoordinates", latitude: lat, longitude: lng } } : {}), ...(star ? { starRating: { "@type": "Rating", ratingValue: star[0] } } : {}), url: `${S.origin}${pathname}` },
  ];

  const body = `<body class="has-bar hp" data-dest="${d.slug}" data-default-airport="${d.airports[0].code}" data-default-nights="${d.defaultNights}" data-lead="${hotel.slug}">
${nav({ back: `${BASE}/${d.slug}/`, title: `the ${shortName} page` })}
${hero}
<div class="wrap">
<div class="dest-head hp-head"><a class="hp-crumb" href="${BASE}/${d.slug}/">${icon("back", 16, 2.6)}All ${esc(d.name)} hotels</a>${kicker(`Getaways from Jamaica · ${place}${district ? ` · ${district}` : ""}`)}<h1 class="hh">${esc(name)}</h1><p>${esc(description)}</p></div>
<div class="hp-facts">${facts.map((f) => `<span>${esc(f)}</span>`).join("")}</div>
<div class="dest-grid">
  <div class="dest-side">${priceCard}</div>
  <div class="dest-main">
    ${rooms}
    ${about}
    ${where}
    ${faq}
  </div>
</div>
</div>
${ticker(d.ticker)}
${footer()}
${bottomBar(`Get a quote for ${shortName}`, quoteUrl, d.bottomNote)}
${scripts()}
${photoData}
</body></html>`;
  return { pathname, html: (head({ title, description: metaDescription, pathname, image: photo || d.hero.img, jsonld, extraHead: `<link rel="stylesheet" href="${CSS_HOTELS}">` }) + body).replace(/^[ \t]*\n/gm, "") };
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

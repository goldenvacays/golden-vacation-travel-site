/* The Desde México page (/jamaica/mexico/), called from scripts/build-jamaica.mjs with that file's helpers.
   Copy and settings: data/jamaica-mexico.json. Package guide prices per person in a double room:
   flight + resort from-price x nights + the MBJ round-trip car split between two, in US$ rounded up to $5,
   pesos = US$ x house rate rounded up to $100.
   Layout (Hana's pick, Nov 2026): the flight first (boarding pass in the hero), nights chips over the resort
   cards, then when to go as a month-by-month flight calendar with the season cards under it. */

const ICON_MX = {
  plane: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"></path>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M16 2v4M8 2v4M3 10h18"></path>',
};
const WD = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MONTH_LONG = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export function mexicoPage(H) {
  const { J, R, V, TR, M, esc, icon, wa, card, whoPicker, formAttr, head, nav, footer, pageLd, crumbName, dealImg, venueFrom, tourHref, shortDrive, fromMbj, S, BASE, WHATSAPP, MONTHS } = H;
  const lang = "es", T = J.i18n.es, P = M.pricing, F = M.flight;
  const ic = (n, size = 16, sw = 2.2) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_MX[n]}</svg>`;

  /* ---------- prices ---------- */
  const up = (n, step) => Math.ceil(n / step - 1e-9) * step;
  const fmt = (n) => Number(n).toLocaleString("en-US");
  const pesos = (n) => `$${fmt(n)}`;
  const carBoth = (slug) => {
    const z = P.zones[slug];
    const car = ((((TR.zones[z] || {}).MBJ) || {}).both || []).find((r) => r[0] === "car");
    if (!car) throw new Error(`no MBJ round-trip car for ${slug} (zone ${z})`);
    return car[3];
  };
  const NIGHTS = P.nights;
  /* the rate sheet holds the booking systems' prices, so Golden's guest markups go on top (hotel, flight);
     transfers are already website sell prices. A season with no flight or no rate for a resort has no price. */
  const plus = (usd, pct) => usd * (1 + (pct || 0) / 100);
  const transferPp = (slug) => (P.transferPp || {})[slug] || carBoth(slug) / 2;
  const flightFor = (season) => (typeof P.flightUsd === "object" ? P.flightUsd[season] : season === "standard" ? P.flightUsd : null);
  const rateFor = (season, slug) => { const r = ((P.rates || {})[season] || {})[slug]; return r != null ? r : season === "standard" ? R[slug].fromUsd : null; };
  const price = (slug, n, season = "standard") => {
    const fl = flightFor(season), rate = rateFor(season, slug);
    if (fl == null || rate == null) return null;
    const usd = up(plus(fl, P.flightMarkupPct) + plus(rate, P.hotelMarkupPct) * n + transferPp(slug), 5);
    return { usd, mxn: up(usd * P.mxnPerUsd, 100) };
  };
  const PRICES = Object.fromEntries(M.resorts.map((s) => [s, Object.fromEntries(NIGHTS.map((n) => [n, price(s, n)]))]));
  const lowestIn = (season, n) => { const v = M.resorts.map((s) => price(s, n, season)).filter(Boolean).map((p) => p.mxn); return v.length ? Math.min(...v) : null; };
  const lowest = (n) => lowestIn("standard", n);
  const tourMxn = (usd) => up(usd * P.mxnPerUsd, 10);
  const DEF_N = P.defaultNights;
  /* the cards run cheapest first for the default nights; mexico.js re-sorts them when the nights change */
  const byPrice = (n) => M.resorts.map((s, i) => [s, i])
    .sort((a, b) => PRICES[a[0]][n].mxn - PRICES[b[0]][n].mxn || PRICES[a[0]][n].usd - PRICES[b[0]][n].usd || a[1] - b[1])
    .map(([s]) => s);

  /* ---------- small pieces ---------- */
  const intro = M.form.waIntro;
  const waText = (lines) => wa([intro, ...lines.filter(Boolean), `Ref ${M.ref}`].join("\n"));
  const resortChips = (slug) => {
    const r = R[slug], c = [r.adultsOnly ? T.adults : T.family];
    if (/water park|splash/i.test(r.pool + r.kids + r.goodToKnow)) c.push(T.park);
    if (/swim-?up|swim out/i.test(r.roomList.map((x) => x.name).join(" "))) c.push(T.swim);
    return c;
  };
  const where = (slug) => [R[slug].area, fromMbj(shortDrive(R[slug].drive), lang)].filter(Boolean).join(" · ");
  const head2 = (kicker, title, sub, id) => `<div class="jsec-head"><span class="kicker">${esc(kicker)}</span><h2 class="h2" id="${id}">${esc(title)}</h2>${sub ? `<p class="lead">${esc(sub)}</p>` : ""}</div>`;
  const nightsHint = (n) => M.nightsLabels[String(n)] || "";

  /* the boarding pass: the flight in one look; the full one in the hero carries the starting price */
  const pass = (compact = false) => `<div class="bp${compact ? " bp-compact" : ""}" role="group" aria-label="Vuelo directo ${esc(F.fromCity)} a ${esc(F.toCity)}">
    <div class="bp-main">
      <div class="bp-top"><span class="bp-tag">Vuelo directo</span><span class="bp-days">${esc(F.days)}</span></div>
      <div class="bp-route"><div class="bp-end"><b>${F.fromCode}</b><span>${esc(F.fromCity)}</span></div><span class="bp-line" aria-hidden="true">${ic("plane", 22, 2)}</span><div class="bp-end bp-end-r"><b>${F.toCode}</b><span>${esc(F.toCity)}</span></div></div>
      <dl class="bp-rows"><div><dt>Desde</dt><dd>${esc(F.startText)}</dd></div><div><dt>Duración</dt><dd>${esc(F.duration)}</dd></div><div><dt>Llegas</dt><dd>${esc(F.arrive)}</dd></div></dl>
    </div>
    ${compact ? "" : `<div class="bp-stub"><small>Paquetes desde</small><b>${pesos(lowest(3))}</b><small>MXN por persona</small><a class="bp-go" href="#paquetes">Ver paquetes ${icon("arrow", 14, 2.6)}</a><span class="bp-trust">${esc(M.trustLine)}</span></div>`}
  </div>`;

  /* resort card with its package price: the same sticker card as the rest of /jamaica/, in pesos */
  const pkgCard = (slug, n) => {
    const r = R[slug], p = PRICES[slug][n];
    const data = NIGHTS.map((k) => ` data-p${k}="${PRICES[slug][k].mxn}" data-u${k}="${PRICES[slug][k].usd}"`).join("");
    return `<a class="dc dc-stay dc-mx" href="${waText([`Resort: ${r.name}`, `Noches: ${n} (${nightsHint(n)})`, "Con vuelo desde la CDMX"])}" target="_blank" rel="noopener" data-slug="${slug}" data-name="${esc(r.name)}"${data} data-track="mx-resort-${slug}">
      <img class="dc-img" src="${dealImg(slug)}" alt="" loading="lazy" decoding="async" width="640" height="800"><span class="dc-price"><small>desde</small><b class="mx-p">${pesos(p.mxn)}</b><small>MXN</small></span>
      <span class="dc-body"><span class="dc-name hh">${esc(r.name)}</span><span class="dc-sub">${esc(where(slug))}</span><span class="dc-chips">${resortChips(slug).map((c) => `<span>${esc(c)}</span>`).join("")}</span>
      <span class="dc-usd">Por persona, <span class="mx-n">${n}</span> noches con vuelo. Aprox. <span class="mx-u">US$${fmt(p.usd)}</span></span>
      <span class="dc-foot"><b>${esc(T.aiFoot)}</b><span class="dc-go">Cotizar${icon("arrow", 16, 2.4)}</span></span></span>
    </a>`;
  };

  const nightsSwitch = () => `<div class="mx-nights" role="group" aria-label="Noches" id="mx-nights">${NIGHTS.map((n) => `<button type="button" data-n="${n}" aria-pressed="${n === DEF_N}"><b>${n} noches</b><small>${esc(nightsHint(n))}</small></button>`).join("")}</div>`;

  const seasonCards = () => `<div class="mx-seasons">${M.seasons.items.map((s) => {
    const from = lowestIn(s.season, s.nights);
    const p = from ? `<p class="mx-s-price"><small>desde</small> <b>${pesos(from)}</b> <small>MXN por persona, ${s.nights} noches</small></p>` : `<p class="mx-s-price mx-s-ask"><b>Temporada alta</b> <small>precio según tus fechas</small></p>`;
    return `<article class="mx-season mx-season-${s.key}"><span class="mx-s-dates">${ic("cal", 14, 2.4)}${esc(s.dates)}</span><h3>${esc(s.name)}</h3><p>${esc(s.text)}</p>${p}<a class="mx-s-go" href="${waText([`Fechas: ${s.name} (${s.dates})`])}" target="_blank" rel="noopener" data-track="mx-season-${s.key}">Cotizar estas fechas ${icon("arrow", 14, 2.6)}</a></article>`;
  }).join("")}</div>`;

  /* one month of the flight calendar: flight days in gold, school breaks and long weekends tinted */
  function monthGrid(y, m) {
    const first = new Date(Date.UTC(y, m, 1)), days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const lead = (first.getUTCDay() + 6) % 7;
    const seasons = M.seasons.items.filter((s) => s.from);
    let cells = "";
    for (let i = 0; i < lead; i++) cells += `<span class="mc-d mc-x" aria-hidden="true"></span>`;
    for (let d = 1; d <= days; d++) {
      const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const wd = new Date(`${iso}T00:00:00Z`).getUTCDay();
      const fly = F.flightDays.includes(wd) && iso >= F.start && iso <= F.lastLoaded;
      const s = seasons.find((x) => iso >= x.from && iso <= x.to);
      const cls = ["mc-d", fly ? "mc-fly" : "", s ? `mc-s mc-s-${s.key}` : ""].filter(Boolean).join(" ");
      cells += `<span class="${cls}"${fly ? ` title="Vuelo directo, ${WD[wd]} ${d}"` : ""}>${d}</span>`;
    }
    const name = MONTH_LONG[m][0].toUpperCase() + MONTH_LONG[m].slice(1);
    return `<div class="mc"><h3>${name} <small>${y}</small></h3><div class="mc-g" role="presentation"><span class="mc-w">L</span><span class="mc-w">M</span><span class="mc-w">M</span><span class="mc-w">J</span><span class="mc-w">V</span><span class="mc-w">S</span><span class="mc-w">D</span>${cells}</div></div>`;
  }
  const calendar = () => {
    const [y0, m0] = F.start.split("-").map(Number), [y1, m1] = F.lastLoaded.split("-").map(Number);
    const months = [];
    for (let y = y0, m = m0 - 1; y < y1 || (y === y1 && m <= m1 - 1); m === 11 ? (y++, m = 0) : m++) months.push(monthGrid(y, m));
    return `<div class="mx-legend"><span><i class="lg-fly"></i>Día con vuelo directo</span><span><i class="lg-s lg-semana-santa"></i>Semana Santa y Pascua</span><span><i class="lg-s lg-verano"></i>Vacaciones de verano</span><span><i class="lg-s lg-septiembre"></i>Puente patrio</span></div>
  <div class="mx-cal">${months.join("")}</div>`;
  };

  const tourCards = () => M.do.venues.map((slug) => {
    const v = V[slug];
    if (!v) throw new Error(`no venue ${slug}`);
    return card({ href: tourHref(`/experiences/${slug}.html`, lang), img: `/jamaica/img/card-${slug}.jpg`, name: v.name, price: pesos(tourMxn(venueFrom(v))), prefix: T.from, per: "MXN pp", sub: J.tours.areas[v.area] || "", text: J.tours.es[slug] || "", foot: "", go: T.see, lang, kind: "tour", track: `mx-tour-${slug}` });
  }).join("");

  const why = M.why;
  const ticks = () => `<ul class="plan-ticks">${why.map(([a, b]) => `<li>${icon("check", 16, 3)}<span><b>${esc(a)}</b> ${esc(b)}</span></li>`).join("")}</ul>`;

  /* the quote form: the same Netlify form and script as the other /jamaica/ pages, with flight dates */
  function planSec() {
    const L = T.form, MF = M.form;
    const opt = (arr) => arr.map((a) => `<option>${esc(a)}</option>`).join("");
    const needs = MF.needs.map((n, i) => `<label class="need"><input type="checkbox" name="need" value="${esc(n)}"${i < 2 ? " checked" : ""}><span>${esc(n)}</span></label>`).join("");
    return `<section class="jsec plan" id="plan" aria-labelledby="plan-h"><div class="wrap plan-grid">
  <div class="plan-copy"><span class="kicker">${esc(M.label)}</span><h2 class="h2" id="plan-h">${esc(MF.title)}</h2><p class="lead">${esc(MF.sub)}</p>
    ${ticks()}
    ${pass(true)}</div>
  <form class="book jform" name="jamaica" method="POST" action="${BASE}/es/enviado/" data-netlify="true" netlify-honeypot="bot-field" novalidate id="jform" data-intro="${formAttr(intro)}" data-ref="${M.ref}" data-audience="${formAttr(M.label)}">
    <input type="hidden" name="form-name" value="jamaica">
    <input type="hidden" name="audience" value="mexico">
    <input type="hidden" name="lang" value="es">
    <input type="hidden" name="ref" value="${M.ref}">
    <input type="hidden" name="subject" id="j-subject" value="Jamaica trip · ${esc(M.label)}">
    <input type="hidden" name="needs" id="j-needs" value="">
    <p class="hp" aria-hidden="true"><label>Deja este campo vacío <input name="bot-field" tabindex="-1" autocomplete="off"></label></p>
    <div class="fields-2 tight">
      <div class="field"><label for="j-in">${esc(MF.arrive)}<span class="req" aria-hidden="true">*</span></label><input id="j-in" type="date" name="checkin" data-req="1"></div>
      <div class="field"><label for="j-out">${esc(MF.leave)}<span class="req" aria-hidden="true">*</span></label><input id="j-out" type="date" name="checkout" data-req="1"></div>
    </div>
    <p class="mx-dayhint" id="mx-dayhint" data-ok="${esc(MF.dayHint)}" data-warn="${esc(MF.dayWarn)}">${esc(MF.dayHint)}</p>
    ${whoPicker(lang, "j-who")}
    <fieldset class="field needs"><legend>${esc(L.needs)}</legend><div class="need-grid">${needs}</div></fieldset>
    <div class="fields-1">
      <div class="field"><label for="j-area">${esc(L.area)}</label><select id="j-area" name="area"><option value="">${esc(L.anyArea)}</option>${opt(MF.areas)}</select></div>
    </div>
    <input type="hidden" name="occasion" value=""><input type="hidden" name="currency" value="MXN (pesos)">
    <div class="field"><label for="j-notes">${esc(L.notes)}</label><input id="j-notes" type="text" name="notes" placeholder="${esc(MF.notesPh)}"></div>
    <div class="book-sum" id="j-sum"><span>${esc(L.sum0)}</span></div>
    <div class="field"><label for="j-name">${esc(L.name)}<span class="req" aria-hidden="true">*</span></label><input id="j-name" type="text" name="name" autocomplete="name" data-req="1"></div>
    <div class="fields-2 tight">
      <div class="field"><label for="j-phone">${esc(L.phone)}<span class="req" aria-hidden="true">*</span></label><input id="j-phone" type="tel" name="phone" autocomplete="tel" inputmode="tel" data-req="1" placeholder="+52"></div>
      <div class="field"><label for="j-email">${esc(L.email)}<span class="req" aria-hidden="true">*</span></label><input id="j-email" type="email" name="email" autocomplete="email" inputmode="email" data-req="1"></div>
    </div>
    <p class="form-err" role="alert"></p>
    <button type="submit" class="btn btn-full">${esc(L.send)}</button>
    <a class="btn btn-outline btn-full" id="j-wa" href="${wa(`${intro} Ref ${M.ref}`)}" data-base="https://wa.me/${WHATSAPP}" target="_blank" rel="noopener">${icon("wa", 18, 2)} ${esc(L.waBtn)}</a>
    <p class="small">${esc(L.small)} <a href="/privacy/" style="text-decoration:underline">${esc(L.privacy)}</a></p>
  </form>
</div></section>`;
  }

  const Hh = M.hero;
  const main = `<section class="jhero mx-hero" aria-labelledby="hero-h">
  <img class="jhero-img" src="${Hh.img}" alt="${esc(Hh.alt)}" fetchpriority="high" decoding="async">
  <div class="wrap jhero-in mx-hero-grid">
    <div class="mx-hero-copy">
      <span class="kicker">${esc(Hh.kicker)}</span>
      <h1 class="jhero-h" id="hero-h">${esc(Hh.title)}</h1>
      <p class="jhero-sub">${esc(Hh.sub)}</p>
      <ul class="jhero-chips">${Hh.chips.map((c) => `<li>${icon("check", 14, 3)}${esc(c)}</li>`).join("")}</ul>
      <div class="jhero-cta"><a class="btn btn-gold" href="#paquetes">Ver paquetes</a><a class="btn btn-white" href="${waText([])}" target="_blank" rel="noopener" data-track="mx-hero-wa">${icon("wa", 18, 2)} ${esc(T.wa)}</a></div>
    </div>
    ${pass()}
  </div>
</section>
<section class="jwhy" aria-label="Por qué con nosotros"><div class="wrap"><ul>${why.map(([a, b]) => `<li><b>${esc(a)}</b><span>${esc(b)}</span></li>`).join("")}</ul></div></section>
<section class="jsec jsec-gold" id="paquetes" aria-labelledby="pk-h"><div class="wrap">
  ${head2(M.packages.kicker, M.packages.title, M.packages.sub, "pk-h")}
  ${nightsSwitch()}
  <div class="dgrid dgrid-4 mx-cards">${byPrice(DEF_N).map((s) => pkgCard(s, DEF_N)).join("")}</div>
  <p class="mx-fine">${esc(M.packages.fine)} <a class="inline-link" href="/hotel-status/">${esc(T.status)}</a></p>
</div></section>
<section class="jsec mx-inc-sec" id="incluye" aria-labelledby="inc-h"><div class="wrap">
  ${head2(M.includes.kicker, M.includes.title, "", "inc-h")}
  <div class="mx-inc">
    <ul class="mx-ticks">${M.includes.items.map(([a, b]) => `<li>${icon("check", 18, 3)}<span><b>${esc(a)}</b>${esc(b)}</span></li>`).join("")}</ul>
    <div class="mx-pay"><h3>${esc(M.includes.payTitle)}</h3><ul>${M.includes.pay.map(([a, b]) => `<li><b>${esc(a)}</b><span>${esc(b)}</span></li>`).join("")}</ul></div>
  </div>
</div></section>
<section class="jsec mx-cal-sec" id="cuando" aria-labelledby="when-h"><div class="wrap">
  ${head2(M.seasons.kicker, M.seasons.title, M.seasons.sub, "when-h")}
  ${calendar()}
  ${seasonCards()}
</div></section>
<section class="jsec" id="do" aria-labelledby="do-h"><div class="wrap">
  ${head2(M.do.kicker, M.do.title, M.do.sub, "do-h")}
  <div class="dgrid dgrid-4">${tourCards()}</div>
</div></section>
<section class="jsec" id="how" aria-labelledby="how-h"><div class="wrap">
  ${head2(T.howKicker, T.howTitle, "", "how-h")}
  <ol class="jsteps">${M.how.map(([a, b], i) => `<li><span class="pt-n">${i + 1}</span><b>${esc(a)}</b><span>${esc(b)}</span></li>`).join("")}</ol>
</div></section>
${planSec()}
<section class="jsec" id="faq" aria-labelledby="faq-h"><div class="wrap faq-wrap">
  ${head2(T.faqKicker, T.faqTitle, "", "faq-h")}
  <div class="faq">${M.faq.map(([q, a]) => `<details><summary>${esc(q)}${icon("plus", 18, 2.6)}</summary><p>${esc(a)}</p></details>`).join("")}</div>
</div></section>`;

  const cfg = { cur: null, lang, picker: T.picker, form: { ...T.form, errOrder: "que el regreso sea después de la ida" }, months: MONTHS.es, labels: { dates: "Fechas", who: "Quién viaja", needs: "Necesito", area: "Zona", occasion: "Ocasión", currency: "Moneda", notes: "Notas" } };
  const mx = { nightsHint: M.nightsLabels, flightDays: F.flightDays, start: F.start, intro, ref: M.ref, wa: `https://wa.me/${WHATSAPP}` };
  /* callers in Mexico dial the country code, so the footer phone gets its +1 on this page */
  const foot = footer(lang).replace(/(Llama al )(\d{3} \d{3} \d{4})/, "$1+1 $2");
  return `${head({ title: M.meta.title, description: M.meta.description, pathname: M.path, image: Hh.img, lang, alts: {}, jsonld: pageLd({ title: M.meta.title, description: M.meta.description, pathname: M.path, lang, faq: M.faq, parent: [crumbName(J.chooser.meta.title), `${S.origin}${J.chooser.path}`] }) }).replace("</head>", `<link rel="stylesheet" href="${BASE}/assets/mexico.css">\n</head>`).replace('content="es_US"', 'content="es_MX"')}
<body class="groups stay jam mx">
${nav(lang, M.path)}
<main>
${main}
</main>
${foot}
<script>window.GV_JAM=${JSON.stringify(cfg)};window.GV_MX=${JSON.stringify(mx)};</script>
<script src="${BASE}/assets/jamaica.js" defer></script>
<script src="${BASE}/assets/mexico.js" defer></script>
</body>
</html>
`;
}

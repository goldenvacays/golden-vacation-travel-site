#!/usr/bin/env node
/* Visa-free countries for Jamaican passport holders: /getaways/visa-free-countries/.
   Everything on the page comes from data/visa-free.json (rules, stays, notes, a source per row, the date they were
   checked); the four package cards take their "from" price and photo from data/getaways.json. Uses the Getaways
   chrome (head, nav, footer), so the page looks and behaves like the rest of Getaways (US$ / J$ switch included).
   It also puts the page in the sitemap, in its own marked block.
   Usage: node scripts/build-visa.mjs */
import fs from "node:fs";
import path from "node:path";
import { ROOT, DATA, S, BASE, esc, icon, kicker, btn, wa, price, pic, head, nav, footer, scripts, bottomBar, faqItem } from "./_getaways-chrome.mjs";

const V = JSON.parse(fs.readFileSync(path.join(ROOT, "data/visa-free.json"), "utf8"));
const PATH = `${BASE}/visa-free-countries/`;
const URL_ = `${S.origin}${PATH}`;
const MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const [yy, mm, dd] = V.asOf.split("-").map(Number);
const asOfLong = `${dd} ${MON[mm - 1]} ${yy}`, asOfShort = `${dd} ${MON[mm - 1].slice(0, 3)} ${yy}`;

const free = V.free.filter((r) => r.entry === "Visa-free"), arrival = V.free.filter((r) => r.entry === "Visa on arrival"), online = V.free.filter((r) => r.entry === "eVisa online" || r.entry === "Online travel pass");
const lead = `As of ${asOfLong}, a Jamaican passport gets you into ${free.length} countries and territories with no visa, and ${arrival.length} more with a visa on arrival. In ${online.length} others you apply online before you fly.`;
const description = `Where Jamaicans can travel without a visa: ${free.length} countries visa-free, ${arrival.length} with a visa on arrival, ${online.length} online. Checked ${asOfShort}, with sources.`;

const WA = wa("Hi Golden Vacation! I'm looking at the visa-free countries page and I'd like a quote for a trip. Ref GV-VISA");
const srcLink = (r) => (r.src ? `<a class="vz-src" href="${esc(r.src)}" rel="noopener nofollow" target="_blank">${r.official ? "Official source" : "Source"}</a>` : "");
const REGIONS = ["Caribbean", "Mexico and Central America", "South America", "Europe", "Africa", "Asia", "Middle East", "Oceania"];
const OPEN = new Set(["Caribbean", "Mexico and Central America", "South America"]);
const CHEVRON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;display:block"><path d="M6 9l6 6 6-6"/></svg>`;
/* one anchor per country row, so the search box (and anyone citing the page) can point straight at it */
const cid = (c) => `c-${c.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\([^)]*\)/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;
const tone = (e) => (e === "Visa-free" ? "ok" : e === "Visa on arrival" ? "arr" : "web");

/* ---------- sections ---------- */
const dest = Object.fromEntries(DATA.destinations.map((d) => [d.slug, d]));
const cards = V.sell.map((s) => {
  const d = dest[s.slug];
  return `<a class="vz-card" href="${BASE}/${d.slug}/">
    <div class="vz-card-img">${pic(d.tileImg, d.tileAlt)}<span class="tag tag-gold">Visa-free</span></div>
    <div class="vz-card-b">
      <span class="vz-card-k">${esc(s.country)}</span>
      <b class="h">${esc(d.name)}</b>
      <span class="vz-stay">${icon("check", 16, 2.8)}${esc(s.stay)}</span>
      <p>${esc(s.needs)}</p>
      <span class="vz-card-p">Trips from ${price(d.from)} <small>per person</small></span>
    </div>
  </a>`;
}).join("");

const getaways = `<section id="getaways" class="sec wrap">
  <div class="sec-head">${kicker("Visa-free trips we book")}<h2 class="hh">Four places, no visa, no US transit</h2><p class="sec-sub">Flights, hotel and transfers in one price, from Kingston or Montego Bay. Each card shows what the border asks for.</p></div>
  <div class="vz-cards">${cards}</div>
  <p class="vz-also">${esc(V.alsoFree)} <a href="${BASE}/quote/">Ask for a quote</a></p>
</section>`;

const changed = `<section id="changed" class="sec wrap sec-tight">
  <div class="sec-head">${kicker("What changed lately")}<h2 class="hh">New rules for Jamaican passports</h2></div>
  <ul class="vz-changed">${V.changed.map(([when, what, src]) => `<li><b>${esc(when)}</b><span>${esc(what)} <a class="vz-src" href="${esc(src)}" rel="noopener nofollow" target="_blank">Official source</a></span></li>`).join("")}</ul>
</section>`;

const unless = `<section id="unless" class="sec wrap">
  <div class="sec-head">${kicker("Already have a US visa?")}<h2 class="hh">Got a US visa? These let you in</h2><p class="sec-sub">These places ask Jamaicans for a visa, but let you in without one if you hold a valid US visa, and some also accept UK, Canadian or Schengen visas or residence. The conditions differ, so read the row.</p></div>
  <div class="vz-tw"><table class="vz-t">
    <thead><tr><th scope="col">Country</th><th scope="col">No visa needed if you hold</th><th scope="col">Stay</th><th scope="col">Good to know</th></tr></thead>
    <tbody>${V.unless.map((r) => `<tr id="${cid(r.country)}"><th scope="row">${esc(r.country)}</th><td data-l="No visa needed if you hold">${esc(r.with)}</td><td data-l="Stay">${esc(r.stay)}</td><td data-l="Good to know">${r.note ? `${esc(r.note)} ` : ""}${srcLink(r)}</td></tr>`).join("")}</tbody>
  </table></div>
</section>`;

const regionTable = (reg) => {
  const rows = V.free.filter((r) => r.region === reg).sort((a, b) => a.country.localeCompare(b.country));
  if (!rows.length) return "";
  const n = rows.filter((r) => r.entry === "Visa-free").length;
  return `<details class="vz-reg"${OPEN.has(reg) ? " open" : ""}><summary><span><b class="h">${esc(reg)}</b><small>${rows.length} places · ${n} visa-free</small></span>${CHEVRON}</summary>
    <div class="vz-tw"><table class="vz-t">
      <thead><tr><th scope="col">Country</th><th scope="col">Entry</th><th scope="col">Stay</th><th scope="col">Good to know</th></tr></thead>
      <tbody>${rows.map((r) => `<tr id="${cid(r.country)}"><th scope="row">${esc(r.country)}</th><td data-l="Entry"><span class="vz-e vz-e-${tone(r.entry)}">${esc(r.entry)}</span></td><td data-l="Stay">${esc(r.stay || "Set on arrival")}</td><td data-l="Good to know">${r.note ? `${esc(r.note)} ` : ""}${srcLink(r)}</td></tr>`).join("")}</tbody>
    </table></div>
  </details>`;
};
const list = `<section id="list" class="sec wrap">
  <div class="sec-head">${kicker(`The full list: ${V.free.length} places, by region`)}<h2 class="hh">Where can Jamaicans travel without a visa?</h2><p class="sec-sub"><b>Visa-free</b>: just your passport. <b>Visa on arrival</b>: you get it at the airport or border. <b>eVisa online</b> or <b>online travel pass</b>: you apply on the country's website before you fly, no embassy visit. Places under do-not-travel advisories are left out.</p></div>
  ${REGIONS.map(regionTable).join("")}
</section>`;

const need = `<section id="need" class="sec wrap sec-tight">
  <div class="sec-head">${kicker("Apply before you go")}<h2 class="hh">Where Jamaicans need a visa</h2><p class="sec-sub">The places people ask us about most.</p></div>
  <div class="vz-tw"><table class="vz-t vz-t2">
    <thead><tr><th scope="col">Country</th><th scope="col">Good to know</th></tr></thead>
    <tbody>${V.need.map((r) => `<tr id="${cid(r.country)}"><th scope="row">${esc(r.country)}</th><td data-l="Good to know">${esc(r.note)} ${srcLink(r)}</td></tr>`).join("")}</tbody>
  </table></div>
</section>`;

const faqs = `<section id="questions" class="faqs"><div class="wrap faqs-grid">
  <div class="faq-side">${kicker("Questions people ask us on WhatsApp")}<h2 class="hh h2 desk">Visa questions, answered</h2>${btn("Ask on WhatsApp", WA, "black", "", "chat", ' data-where="faq"')}</div>
  <div class="faq">${V.faq.map(([q, a]) => faqItem(q, a)).join("")}</div>
</div></section>`;

const sources = `<section id="sources" class="sec wrap sec-tight">
  <div class="sec-head">${kicker("Sources")}<h2 class="hh">How we checked</h2></div>
  <p class="vz-note">Last checked ${esc(asOfLong)}. For the places Jamaicans travel to most we read each government's own rules; those rows say <b>Official source</b>. The rest come from these lists. Rules change, so confirm with the embassy before you travel, or ask us.</p>
  <ul class="vz-srcs">${V.sources.map(([t, u]) => `<li><a href="${esc(u)}" rel="noopener nofollow" target="_blank">${esc(t)}</a></li>`).join("")}</ul>
</section>`;

const cta = `<section class="sec wrap"><div class="vz-cta">
  <div><b class="h">Want a visa-free trip quoted?</b><p>${esc(S.replyLine)}</p></div>
  ${btn("Get a quote on WhatsApp", WA, "black", "", "chat", ' data-where="visa-cta"')}
</div></section>`;

/* ---------- country search ----------
   Everything on the page in one small list the box searches: name, other names people type (Dubai, Cancún,
   Europe), the entry rule, the stay and the row it jumps to. Accents and "Saint"/"St" don't matter. */
const AL = V.aliases || {};
const findIndex = [
  ...V.free.map((r) => [r.country, AL[r.country] || "", r.entry, r.stay || "Set on arrival", cid(r.country), tone(r.entry)]),
  ...V.unless.map((r) => [r.country, AL[r.country] || "", "Visa needed, with exceptions", r.stay, cid(r.country), "need"]),
  ...V.need.map((r) => [r.country, AL[r.country] || "", "Visa needed", "", cid(r.country), "need"]),
];
const SEARCH_ICON = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;display:block"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`;
const find = `<div class="vz-find" role="search">
    <label class="vz-find-l" for="vz-q">Check a country</label>
    <div class="vz-find-box">${SEARCH_ICON}<input id="vz-q" type="search" placeholder="Type a country, like Mexico or Dubai" autocomplete="off" spellcheck="false" enterkeyhint="search"></div>
    <ul id="vz-res" class="vz-res" aria-live="polite"></ul>
  </div>`;
const findScript = `<script>(function(){var D=${JSON.stringify(findIndex).replace(/</g, "\\u003c")},W=${JSON.stringify(WA)},H="hr"+"ef";var q=document.getElementById('vz-q'),res=document.getElementById('vz-res');if(!q)return;
function n(s){return String(s).normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().replace(/\\bsaint\\b/g,'st').replace(/[^a-z0-9 ]+/g,' ').replace(/\\s+/g,' ').trim();}
function e(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
D.forEach(function(d){d.k=' '+n(d[0]+' '+d[1]);d.n=n(d[0]);});
function render(){var v=n(q.value);if(v.length<2){res.innerHTML='';return;}
var hits=D.filter(function(d){return d.k.indexOf(' '+v)>=0;});
hits.sort(function(a,b){return (a.n.indexOf(v)===0?0:1)-(b.n.indexOf(v)===0?0:1)||a[0].localeCompare(b[0]);});
if(!hits.length){res.innerHTML='<li class="vz-none">Not on our list yet. <a '+H+'="'+e(W)+'" target="_blank" rel="noopener">Ask us on WhatsApp</a> and we\\'ll check it for you.</li>';return;}
res.innerHTML=hits.slice(0,6).map(function(d){return '<li><a href="#'+d[4]+'" data-go="'+d[4]+'"><b>'+e(d[0])+'</b><span class="vz-e vz-e-'+d[5]+'">'+e(d[2])+'</span>'+(d[3]?'<small>'+e(d[3])+'</small>':'')+'</a></li>';}).join('');}
q.addEventListener('input',render);
res.addEventListener('click',function(ev){var a=ev.target.closest('a[data-go]');if(!a)return;var row=document.getElementById(a.getAttribute('data-go'));if(!row)return;ev.preventDefault();var det=row.closest('details');if(det)det.open=true;row.classList.add('vz-hit');row.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(function(){row.classList.remove('vz-hit');},2600);});
})();</script>`;

/* ---------- head ---------- */
const STYLE = `<style>
.vz-hero{padding:28px var(--pad) 8px;display:flex;flex-direction:column;gap:12px}
.vz-hero h1{font-size:34px;line-height:1.08;margin:0}
.vz-lead{font-size:18px;line-height:1.45;font-weight:600;margin:0;max-width:760px}
.vz-meta{font-size:13px;color:var(--muted);margin:0}
.vz-jump{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
.vz-jump a{height:34px;font-size:12px}
.vz-find{display:flex;flex-direction:column;gap:8px;max-width:640px;margin:6px 0 2px}
.vz-find-l{font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
.vz-find-box{display:flex;align-items:center;gap:10px;height:56px;padding:0 18px;border-radius:999px;box-shadow:inset 0 0 0 2px var(--ink);background:#fff}
.vz-find-box input{flex:1;border:0;outline:0;background:transparent;font:inherit;font-size:17px;font-weight:700;color:var(--ink);min-width:0}
.vz-find-box:focus-within{box-shadow:inset 0 0 0 3px var(--ink)}
.vz-res{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.vz-res a{display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px;padding:12px 16px;border-radius:14px;background:var(--alt);color:var(--ink);text-decoration:none}
.vz-res a b{font-size:16px}
.vz-res a small{font-size:13px;color:var(--muted)}
.vz-none{padding:12px 16px;border-radius:14px;background:var(--alt);font-size:14px}
.vz-none a{font-weight:800;text-decoration:underline}
.vz-e-need{background:#E6E6E1;color:var(--ink)}
.vz-t tr.vz-hit th,.vz-t tr.vz-hit td{background:#FFF1CC}
.vz-t tr{scroll-margin-top:90px}
.vz-cards{display:grid;grid-template-columns:1fr;gap:14px}
.vz-card{display:flex;flex-direction:column;border-radius:var(--radius);overflow:hidden;box-shadow:inset 0 0 0 2px var(--ink);color:var(--ink);text-decoration:none;background:#fff}
.vz-card-img{position:relative;aspect-ratio:16/9;overflow:hidden;background:var(--ph)}
.vz-card-img img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
.vz-card-img .tag{position:absolute;left:12px;top:12px}
.vz-card-b{display:flex;flex-direction:column;gap:6px;padding:14px 16px 16px;flex:1}
.vz-card-k{font-size:12px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--gold-txt)}
.vz-card-b b.h{font-size:22px}
.vz-stay{display:inline-flex;align-items:center;gap:6px;font-weight:800;font-size:14px}
.vz-card-b p{margin:0;font-size:14px;line-height:1.45;color:var(--muted)}
.vz-card-p{margin-top:auto;padding-top:4px;font-weight:800;font-size:15px}
.vz-card-p small{font-weight:600;color:var(--muted)}
.vz-also{font-size:14px;margin:4px 0 0}
.vz-also a{font-weight:800;text-decoration:underline}
.vz-changed{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}
.vz-changed li{display:flex;flex-direction:column;gap:2px;padding:12px 0;border-bottom:2px solid var(--line);font-size:14px;line-height:1.45}
.vz-changed li:last-child{border-bottom:0}
.vz-tw{width:100%}
.vz-t{width:100%;border-collapse:collapse;font-size:14px;line-height:1.45}
.vz-t thead{display:none}
.vz-t tr{display:block;padding:12px 0;border-bottom:2px solid var(--line)}
.vz-t th[scope=row]{display:block;text-align:left;font-size:16px;font-weight:800;padding:0 0 4px}
.vz-t td{display:block;padding:2px 0}
.vz-t td[data-l]:before{content:attr(data-l) ": ";font-weight:700;color:var(--muted)}
.vz-t td[data-l="Entry"]:before,.vz-t td[data-l="Good to know"]:before{content:none}
.vz-e{display:inline-flex;align-items:center;height:24px;padding:0 10px;border-radius:999px;font-size:12px;font-weight:800;white-space:nowrap}
.vz-e-ok{background:var(--gold);color:var(--ink)}
.vz-e-arr{background:var(--ink);color:#fff}
.vz-e-web{box-shadow:inset 0 0 0 2px var(--ink);color:var(--ink)}
.vz-src{font-size:12px;font-weight:700;color:var(--gold-txt);white-space:nowrap}
.vz-reg{border-radius:16px;box-shadow:inset 0 0 0 2px var(--ink);padding:0 16px;margin-bottom:12px}
.vz-reg summary{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 0;cursor:pointer;list-style:none}
.vz-reg summary::-webkit-details-marker{display:none}
.vz-reg summary span{display:flex;flex-direction:column}
.vz-reg summary b.h{font-size:18px}
.vz-reg summary small{font-size:13px;color:var(--muted)}
.vz-reg[open] summary svg{transform:rotate(180deg)}
.vz-reg .vz-tw{padding-bottom:6px}
.vz-note{font-size:14px;line-height:1.5;margin:0;max-width:760px}
.vz-srcs{margin:0;padding-left:18px;font-size:14px;line-height:1.6}
.vz-cta{display:flex;flex-direction:column;gap:14px;padding:20px;border-radius:var(--radius);background:var(--gold)}
.vz-cta b.h{font-size:22px}
.vz-cta p{margin:4px 0 0;font-size:14px}
@media (min-width:900px){
 .vz-hero{padding:56px var(--pad) 12px}
 .vz-hero h1{font-size:54px}
 .vz-lead{font-size:21px}
 .vz-cards{grid-template-columns:repeat(4,1fr)}
 .vz-changed li{flex-direction:row;gap:18px}
 .vz-changed li b{flex:0 0 220px}
 .vz-t thead{display:table-header-group}
 .vz-t thead th{text-align:left;font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);padding:10px 12px 10px 0;border-bottom:2px solid var(--ink)}
 .vz-t tr{display:table-row;padding:0}
 .vz-t th[scope=row],.vz-t td{display:table-cell;padding:12px 12px 12px 0;border-bottom:2px solid var(--line);vertical-align:top}
 .vz-t th[scope=row]{font-size:15px;width:24%}
 .vz-t td[data-l]:before{content:none}
 .vz-t td[data-l="Stay"]{white-space:nowrap}
 .vz-t2 th[scope=row]{width:30%}
 .vz-cta{flex-direction:row;align-items:center;justify-content:space-between;padding:28px 32px}
}
</style>`;

const jsonld = [
  { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Home", item: `${S.origin}/` }, { "@type": "ListItem", position: 2, name: "Getaways", item: `${S.origin}${BASE}/` }, { "@type": "ListItem", position: 3, name: "Visa-free countries", item: URL_ }] },
  { "@context": "https://schema.org", "@type": "WebPage", "@id": `${URL_}#webpage`, url: URL_, name: V.h1, description, inLanguage: "en", datePublished: V.asOf, dateModified: V.asOf, isPartOf: { "@id": `${S.origin}/#website` }, publisher: { "@id": `${S.origin}/#organization` }, about: { "@type": "Thing", name: "Visa requirements for Jamaican citizens" } },
  { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: V.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
];

const html = `${head({ title: V.title, description, pathname: PATH, image: dest.panama.tileImg, jsonld, extraHead: STYLE })}
<body class="visa">
${nav({ back: `${BASE}/`, title: "the visa-free countries page" })}
<main>
<section class="vz-hero wrap">
  ${kicker(V.kicker)}
  <h1 class="hh">${esc(V.h1)}</h1>
  <p class="vz-lead">${esc(lead)}</p>
  <p class="vz-meta">Checked ${esc(asOfShort)} against each government's own rules for the places Jamaicans travel to most. Rules change, so confirm before you book.</p>
  ${find}
  <nav class="vz-jump" aria-label="On this page"><a class="chip" href="#getaways">Trips we book</a><a class="chip" href="#unless">With a US visa</a><a class="chip" href="#list">Every country</a><a class="chip" href="#need">Visa needed</a><a class="chip" href="#questions">Questions</a></nav>
</section>
${getaways}
${changed}
${unless}
${list}
${need}
${faqs}
${sources}
${cta}
</main>
${footer()}
${bottomBar("Get a quote on WhatsApp", WA, "Opens WhatsApp · no payment yet")}
${findScript}
${scripts(false)}
</body>
</html>
`;

const out = path.join(ROOT, `public${PATH}index.html`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html.replace(/\n{2,}/g, "\n"));
console.log("wrote", path.relative(ROOT, out), `${(html.length / 1024).toFixed(0)}K`, "|", description.length, "char description |", V.title.length, "char title");

/* sitemap: the page in its own marked block */
const smPath = path.join(ROOT, "public/sitemap.xml");
if (fs.existsSync(smPath)) {
  const entry = `<!-- visa -->\n<url>\n  <loc>${URL_}</loc>\n  <lastmod>${V.asOf}T00:00:00+00:00</lastmod>\n  <priority>0.7</priority>\n</url>\n<!-- /visa -->\n`;
  const pageRe = new RegExp(`<url>\\s*<loc>${URL_.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</loc>[\\s\\S]*?</url>\\s*`, "g");
  /* the block stays where it is, so running the builders in a different order never reshuffles the sitemap */
  let sm = fs.readFileSync(smPath, "utf8");
  const blockRe = /<!-- visa -->[\s\S]*?<!-- \/visa -->\n?/;
  const m = sm.match(blockRe);
  if (m) sm = sm.slice(0, m.index).replace(pageRe, "") + entry + sm.slice(m.index + m[0].length).replace(pageRe, "");
  else sm = sm.replace(pageRe, "").replace(/\s*<\/urlset>\s*$/, `\n\n${entry}\n</urlset>\n`);
  fs.writeFileSync(smPath, sm);
  console.log("sitemap: visa page listed");
}

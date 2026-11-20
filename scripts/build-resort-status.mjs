#!/usr/bin/env node
/* One page per Jamaica resort at /resorts/<slug>/, for every resort in public/map/resorts.js that has no full booking
   page yet (the booking pages come from build-staycations.mjs). Each page answers "Is <resort> open?" first, then
   offers open resorts like it close by, airport transfers, the tours nearby and quick answers (FAQPage).
   The nav and footer are the status page's, so run this after build-status.mjs (npm run status does).
   node scripts/build-resort-status.mjs */
import fs from "node:fs";
import path from "node:path";
import * as F from "./lib-resort-facts.mjs";

const { ROOT, RESORTS, BOOKING, esc, slugify } = F;
const ORIGIN = "https://goldenvacays.com", WA = "18763601567";
const wa = (t) => `https://wa.me/${WA}?text=${encodeURIComponent(t)}`;
const ARR = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>';
const TONE = { ok: "#1F8A4C", warn: "#B87A12", no: "#B3261E", new: "#2F5BEA" };

/* the site's nav and footer, from the status page */
const src = fs.readFileSync(path.join(ROOT, "public/hotel-status/index.html"), "utf8");
const navStart = src.indexOf("<body"), mainStart = src.indexOf("<main");
const bodyOpen = src.slice(navStart, mainStart).replace(/ aria-current="page"/g, "");
const afterMain = src.slice(src.indexOf("</main>") + 7);
const footer = afterMain.slice(0, afterMain.indexOf("<script")) + (src.match(/<script src="\/assets\/chrome\.js[^>]*><\/script>/) || [""])[0];
const headLinks = (src.match(/<link rel="(?:preload|stylesheet)"[^>]*>/g) || []).join("\n");
const ga = (src.match(/<script>window\.dataLayer[\s\S]*?<\/script>/) || [""])[0];

const CSS = `
.rp{padding:0 var(--pad) 72px}.rp *{box-sizing:border-box}
.rp .k{display:inline-block;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--gold-txt)}
.rp h2{font-size:clamp(26px,3.2vw,40px);line-height:1.04;margin:0 0 14px;font-weight:900;letter-spacing:-.02em}
.rp .rsec{margin-top:56px}
.rp .btn{display:inline-flex;align-items:center;gap:10px;padding:14px 22px;border-radius:999px;font-weight:800;text-decoration:none;font-size:15.5px;border:2px solid var(--ink)}
.rp .btn.blk{background:var(--ink);color:#fff}.rp .btn.out{background:transparent;color:var(--ink)}
.rp .crumb{display:inline-flex;gap:6px;font-size:13.5px;font-weight:700;color:var(--muted);text-decoration:none;margin:18px 0 0}
.rp .top{display:grid;grid-template-columns:1fr;gap:28px;margin-top:22px;align-items:center}@media(min-width:900px){.rp .top{grid-template-columns:1.25fr 1fr;gap:48px}}
.rp .q{font-size:clamp(22px,2.6vw,30px);font-weight:800;line-height:1.15;margin:12px 0 10px}
.rp .bar{height:8px;border-radius:99px;margin:0 0 6px;width:72px}
.rp .big{font-size:clamp(56px,9vw,120px);line-height:.9;font-weight:900;letter-spacing:-.04em;margin:0}
.rp .sub{font-size:18px;line-height:1.55;color:var(--muted);margin:16px 0 22px;max-width:620px}
.rp .btns{display:flex;flex-wrap:wrap;gap:10px}
.rp .photo{border-radius:24px;overflow:hidden;aspect-ratio:4/3;background:var(--ph);position:relative;margin:0}.rp .photo img{width:100%;height:100%;object-fit:cover;display:block}
.rp .photo figcaption{position:absolute;left:14px;bottom:14px;right:14px;width:fit-content;background:#fff;border-radius:999px;padding:7px 12px;font-weight:800;font-size:13px}
.rp .alead{color:var(--muted);margin:-6px 0 18px}
.rp .alts{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:18px}
.rp .alt{border-radius:20px;overflow:hidden;background:var(--alt);display:flex;flex-direction:column;text-decoration:none;color:inherit}
.rp .alt img{width:100%;aspect-ratio:3/2;object-fit:cover;display:block}
.rp .alt div{padding:16px 18px 18px;display:flex;flex-direction:column;gap:6px;flex:1}
.rp .alt b{font-size:18px;font-weight:900}.rp .alt small{color:var(--muted);font-weight:700;font-size:13px}.rp .alt p{margin:0;color:var(--muted);line-height:1.45;font-size:14.5px}
.rp .alt .go{margin-top:auto;padding-top:10px;font-weight:800;display:flex;align-items:center;gap:8px}
.rp .ok-tag{align-self:flex-start;font-size:12px;font-weight:800;color:#1F8A4C;background:#E5F3EA;padding:4px 10px;border-radius:999px}
.rp table.tt{width:100%;border-collapse:collapse;font-size:15px}.rp table.tt td,.rp table.tt th{padding:12px 12px 12px 0;border-top:1px solid var(--line);text-align:left}
.rp table.tt td:last-child{font-weight:900;text-align:right;padding-right:0}.rp table.tt th{font-weight:700}
.rp .note{font-size:13.5px;color:var(--muted);margin-top:10px}.rp .note a,.rp .np a{color:inherit;font-weight:700}
.rp .np{line-height:1.6;color:var(--muted);margin:0 0 10px;font-size:16px}
.rp .two{display:grid;grid-template-columns:1fr;gap:40px}@media(min-width:900px){.rp .two{grid-template-columns:1fr 1fr;gap:56px}}
.rp .faq details{border-top:1px solid var(--line);padding:16px 0}.rp .faq summary{font-weight:800;cursor:pointer;font-size:16.5px}.rp .faq p{margin:10px 0 0;color:var(--muted);line-height:1.6;max-width:760px}
`;

function page(r) {
  const slug = slugify(r.name), a = F.answer(r), col = TONE[a.tone], open = F.isOpen(r);
  const alts = F.alternatives(r), tr = F.transfers(r), near = F.nearby(slug), q = F.faqs(r);
  const ref = `GV-RESORT-${slug.slice(0, 10).toUpperCase()}`;
  const dated = /\d/.test(r.when || "") && !open && r.status !== "Closed" && r.status !== "Permanently closed";
  const btns = open
    ? `<a class="btn blk" href="${wa(`Hi Golden Vacation! I'd like a quote for ${r.name}. Ref ${ref}`)}">Get a quote for ${esc(r.name)}${ARR}</a>`
    : `<a class="btn blk" href="${wa(`Hi Golden Vacation! I'm looking at ${r.name} on your website. Can you suggest an open resort for my dates? Ref ${ref}`)}">Find me an open resort for my dates${ARR}</a>${dated ? `<a class="btn out" href="${wa(`Hi Golden Vacation! I'd like to book ${r.name} for when it opens (${r.when}). Ref ${ref}`)}">Book it for ${r.status === "Reopening" ? "after" : "from"} ${esc(r.when)}${ARR}</a>` : ""}`;
  const extra = !open && r.happening ? ` ${r.happening}` : open && r.happening ? ` ${r.happening}` : "";
  const altHead = open ? `Also open close by` : r.status === "Permanently closed" ? `Open resorts close by` : `Travelling before ${dated ? esc(r.when) : "it opens"}?`;
  const altTitle = open ? `More open resorts near ${esc(r.name)}` : `${alts.length} open resorts like ${esc(r.name)}`;
  const altCards = alts.map((x) => `<a class="alt" href="/resorts/${x.slug}/"><img src="${F.photoOf(x.r)}" alt="${esc(x.r.name)}" loading="lazy"><div><span class="ok-tag">Open now</span><b>${esc(x.r.name)}</b><small>${esc(F.areaName(x.r))} · ${esc(x.away)}</small><p>${esc(x.r.note)}</p><span class="go">${BOOKING.has(x.slug) ? "See prices and rooms" : "See the resort"}${ARR}</span></div></a>`).join("");
  const trRows = tr.map((t) => `<tr><th>From ${esc(t.label)}</th><td style="color:var(--muted);font-weight:600">${esc(t.drive)}</td><td>US$${t.usd}</td></tr>`).join("");
  const title = open ? `Is ${r.name} open? Yes, open now | Golden Vacation` : `Is ${r.name} open? ${r.status === "Reopening" && /\d/.test(r.when) ? `Reopening ${r.when}` : r.status} | Golden Vacation`;
  const desc = `${a.big} ${a.line} Checked ${F.CHECKED}.${!open && alts.length ? ` Open resorts like it nearby: ${alts.map((x) => x.r.name).join(", ")}.` : ""}`.slice(0, 300);
  const ld = [F.faqLd(q), { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Resort status", item: `${ORIGIN}/hotel-status/` }, { "@type": "ListItem", position: 2, name: r.name, item: `${ORIGIN}/resorts/${slug}/` }] }];
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${ORIGIN}/resorts/${slug}/">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${ORIGIN}/resorts/${slug}/">${r.photo ? `<meta property="og:image" content="${ORIGIN}${F.photoOf(r)}">` : ""}
<link rel="icon" href="/favicon.ico">
${headLinks}
${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join("\n")}
${ga}
<style>${CSS}</style>
</head>
${bodyOpen}<main class="rp wrap">
<a class="crumb" href="/hotel-status/">‹ Jamaica resort status</a>
<div class="top"><div><span class="k">Resort status · checked ${F.CHECKED}</span><h1 class="q">Is ${esc(r.name)} open?</h1><div class="bar" style="background:${col}"></div><p class="big" style="color:${col}">${esc(a.big)}</p><p class="sub">${esc(a.line + extra)}${r.formerly ? ` Formerly ${esc(r.formerly)}.` : ""}</p><div class="btns">${btns}</div></div>
${r.photo ? `<figure class="photo"><img src="${F.photoOf(r)}" alt="${esc(r.name)}" fetchpriority="high"><figcaption>${esc(r.name)} · ${esc(F.areaName(r))}</figcaption></figure>` : ""}</div>
${alts.length ? `<div class="rsec"><span class="k">${altHead}</span><h2>${altTitle}</h2>${open ? "" : `<p class="alead">The same coast and the same kind of stay, open and taking bookings now.</p>`}<div class="alts">${altCards}</div></div>` : ""}
<div class="two rsec">
${trRows ? `<div><span class="k">Getting there</span><h2>Airport transfers</h2><table class="tt">${trRows}</table><p class="note">Golden Vacation &amp; Travel private car for up to 3 people, one way, taxes included. <a href="/transfers/">Bigger groups and return trips</a></p></div>` : ""}
${near ? `<div><span class="k">Close by</span><h2>Things to do nearby</h2><p class="np">${esc(near.text)}</p><p class="note"><a href="${near.href}">Tours and day passes near ${esc(r.name)}, with prices</a></p></div>` : ""}
</div>
<div class="rsec faq"><span class="k">Questions</span><h2>${esc(r.name)}: quick answers</h2>${q.map(([k, v]) => `<details><summary>${esc(k)}</summary><p>${esc(v)}</p></details>`).join("")}</div>
</main>${footer}
</body>
</html>
`;
}

let n = 0;
for (const r of RESORTS) {
  const slug = slugify(r.name);
  if (BOOKING.has(slug)) continue;
  const f = path.join(ROOT, "public/resorts", slug, "index.html");
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, page(r)); n++;
}
console.log(`resort status pages: ${n} written, ${BOOKING.size} resorts have booking pages`);

/* sitemap: the resort hub and every /resorts/<slug>/ page in one marked block (sitemap-dates.mjs sets the real dates) */
const smPath = path.join(ROOT, "public/sitemap.xml");
if (fs.existsSync(smPath)) {
  const today = new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);
  const urls = ["/resorts/", ...RESORTS.map((r) => `/resorts/${slugify(r.name)}/`)];
  const entries = urls.map((u) => `<url>\n  <loc>${ORIGIN}${u}</loc>\n  <lastmod>${today}T00:00:00+00:00</lastmod>\n  <priority>${u === "/resorts/" ? "0.8" : "0.7"}</priority>\n</url>`).join("\n");
  const block = `<!-- resorts -->\n${entries}\n<!-- /resorts -->\n`, re = /<!-- resorts -->[\s\S]*?<!-- \/resorts -->\n?/;
  let sm = fs.readFileSync(smPath, "utf8");
  sm = re.test(sm) ? sm.replace(re, block) : sm.replace(/\s*<\/urlset>\s*$/, `\n\n${block}\n</urlset>\n`);
  fs.writeFileSync(smPath, sm);
  console.log(`sitemap: ${urls.length} resort urls`);
}

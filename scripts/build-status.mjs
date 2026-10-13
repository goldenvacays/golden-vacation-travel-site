#!/usr/bin/env node
/* Resort status in one step.
   public/map/resorts.js is the one list (it mirrors the Airtable "Resort Status" base). This script rebuilds everything
   on the status page that comes from it: the resort list the page script shows, the A to Z answers Google reads, the
   ItemList schema, the open / reopening counts in the FAQ (page and schema) and the "Updated" date.
   Written answers that say more than the standard sentence live in data/status-page.json under "az", each with the
   status it was written for; when a resort's status changes, its old answer is dropped and the standard one is used.
   Usage: node scripts/build-status.mjs [--date 2026-09-28]   (date defaults to today in Jamaica)
   Then rebuild the pages that read resorts.js: node scripts/build-experiences.mjs && node scripts/build-transfers.mjs
   && RESORTS_UPDATED=<date> node scripts/build-home.mjs   (npm run status does all of it) */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : ""; };
const today = new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);
const DAY = /^\d{4}-\d{2}-\d{2}$/.test(arg("--date")) ? arg("--date") : today;
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const [yy, mm, dd] = DAY.split("-").map(Number);
const shortDate = `${dd} ${MON[mm - 1]} ${yy}`, longDate = `${dd} ${MONTH[mm - 1]} ${yy}`;

const src = fs.readFileSync(path.join(ROOT, "public/map/resorts.js"), "utf8");
const R = JSON.parse(src.slice(src.indexOf("["), src.lastIndexOf("]") + 1));
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, "data/status-page.json"), "utf8"));
const areaOf = (r) => (CFG.areaOverride || {})[r.name] || (CFG.areaByRegion || {})[r.region] || r.area;
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/* the standard answer for each status; anything richer is kept in data/status-page.json */
function standardAnswer(r) {
  const n = esc(r.name), a = esc(areaOf(r)), f = r.formerly ? `(formerly ${esc(r.formerly)}) ` : "";
  const q = `<strong>Is ${n} open?</strong> `;
  switch (r.status) {
    case "Open": return `${q}${f}Yes, ${n} is <b>open</b> and welcoming guests in ${a}, Jamaica.`;
    case "Reopening": return /\d/.test(r.when || "") ? `${q}${f}${n} is currently <b>closed and reopening ${esc(r.when)}</b> in ${a}, Jamaica.` : `${q}${f}${n} is currently <b>closed and reopening</b> in ${a}, Jamaica. The date is not confirmed yet.`;
    case "Closing soon": return `${q}${f}${n} is <b>open now and closing for renovation</b> (${esc(r.when)}) in ${a}, Jamaica.`;
    case "Closed": return `${q}${f}${n} is currently <b>closed</b> in ${a}, Jamaica.`;
    case "Permanently closed": return `${q}${f}${n} is <b>permanently closed</b>.`;
    case "Coming soon": return `${q}${f}${n} is <b>coming soon</b> to ${a}, Jamaica (${/^\d/.test(r.when || "") ? `opening ${esc(r.when)}` : "date to be announced"}).`;
    case "New": return `${q}${f}${n} is a <b>new resort opening ${esc(r.when)}</b> in ${a}, Jamaica.`;
    default: return `${q}${f}${n}: <b>${esc(r.status)}</b>, ${a}, Jamaica.`;
  }
}
export function answerFor(r) {
  const c = (CFG.az || {})[r.name];
  return c && c.status === r.status ? c.text : standardAnswer(r);
}

const listed = [...R].sort((x, y) => x.name.localeCompare(y.name, "en", { sensitivity: "base" })); // A to Z, like the page
const byAZ = [...listed].sort((x, y) => x.name.localeCompare(y.name, "en", { sensitivity: "base" }));
const open = listed.filter((r) => r.status === "Open").length, reopening = listed.filter((r) => r.status === "Reopening").length;

const p = path.join(ROOT, "public/hotel-status/index.html");
let h = fs.readFileSync(p, "utf8");
const swap = (re, fn, what) => { const before = h; h = h.replace(re, fn); if (h === before && !re.test(before)) throw new Error(`build-status: could not find ${what}`); };

/* 1. the list the page script shows */
const hotels = listed.map((r) => ({ n: r.name, f: r.formerly || "", a: areaOf(r), cat: r.category || "All-inclusive", s: r.status, w: r.when || "", note: r.note || "", wh: r.happening || "", bi: r.bookInstead || "", v: r.verifiedOn || "" }));
swap(/const HOTELS\s*=\s*\[[\s\S]*?\];/, () => `const HOTELS = ${JSON.stringify(hotels)};`, "the HOTELS list");
/* 2. the A to Z */
swap(/<div class="az-list">[\s\S]*?<\/div>\n<\/section>/, () => `<div class="az-list">\n${byAZ.map((r) => `<p class="azrow">${answerFor(r)}</p>`).join("\n")}\n</div>\n</section>`, "the A to Z list");
/* 3. ItemList schema */
swap(/<script type="application\/ld\+json">\{"@context":"https:\/\/schema\.org","@type":"ItemList"[\s\S]*?<\/script>/, () => `<script type="application/ld+json">${JSON.stringify({ "@context": "https://schema.org", "@type": "ItemList", name: "Jamaica all-inclusive resort status", numberOfItems: byAZ.length, itemListElement: byAZ.map((r, i) => ({ "@type": "ListItem", position: i + 1, name: `${r.name}: ${r.status}` })) })}</script>`, "the ItemList schema");
/* 4. counts and dates */
swap(/As of \d{1,2} [A-Z][a-z]+ \d{4}, \d+ of the \d+ resorts we track are open now and \d+ are reopening/g, () => `As of ${longDate}, ${open} of the ${listed.length} resorts we track are open now and ${reopening} are reopening`, "the FAQ counts");
swap(/\b\d+ Jamaica all-inclusives are open and booking now/g, () => `${open} Jamaica all-inclusives are open and booking now`, "the open count");
swap(/<span>Updated \d{1,2} [A-Z][a-z]{2} \d{4} · <span id="trk">\d+<\/span> resorts tracked<\/span>/, () => `<span>Updated ${shortDate} · <span id="trk">${listed.length}</span> resorts tracked</span>`, "the Updated pill");
/* 5. reopening dates at a glance: every resort that isn't open now, soonest first, as a plain table that search
   engines and AI answers can read (the list at the top of the page is drawn by the page script) */
const NOT_OPEN = { Reopening: "Reopening", "Closing soon": "Closing for renovation", "Coming soon": "Coming soon", New: "New resort", Closed: "Closed" };
const undated = (w) => !w || w === "—" || /^(tbd|tbc|no date set|indefinite)$/i.test(String(w).trim());
const rt = listed.filter((r) => NOT_OPEN[r.status]).sort((a, b) => (a.whenSort || Infinity) - (b.whenSort || Infinity) || a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
const rtRows = rt.map((r) => `<tr><th scope="row">${esc(r.name)}${r.formerly ? `<small>formerly ${esc(r.formerly)}</small>` : ""}</th><td data-l="Area">${esc(areaOf(r))}</td><td data-l="Status">${NOT_OPEN[r.status]}</td><td data-l="Opens">${undated(r.when) ? "No date yet" : esc(r.when)}</td></tr>`).join("");
const rtBlock = `<!-- reopen-table -->
<section class="rtseo" aria-label="Jamaica resort reopening dates">
<h2 class="hh">Jamaica resort reopening dates</h2>
<p class="azlead">Every resort we track that isn't open right now, soonest first. Updated ${longDate}.</p>
<style>.rtseo{display:flex;flex-direction:column}.rtseo h2{font-size:clamp(28px,3.4vw,42px);line-height:1.02;margin-bottom:14px}.rt{width:100%;border-collapse:collapse;font-size:14.5px;line-height:1.45}.rt th,.rt td{text-align:left;padding:11px 12px 11px 0;border-top:1px solid var(--line);vertical-align:top}.rt thead th{border-top:0;border-bottom:2px solid var(--ink);font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-3)}.rt tbody th{font-weight:800;color:var(--ink)}.rt small{display:block;font-weight:500;color:var(--ink-3)}@media (max-width:700px){.rt thead{display:none}.rt tr{display:block;padding:10px 0;border-top:1px solid var(--line)}.rt th,.rt td{display:block;border:0;padding:2px 0}.rt td:before{content:attr(data-l) ": ";font-weight:700;color:var(--ink-3)}}</style>
<table class="rt"><thead><tr><th scope="col">Resort</th><th scope="col">Area</th><th scope="col">Status</th><th scope="col">Opens</th></tr></thead><tbody>${rtRows}</tbody></table>
</section>
<!-- /reopen-table -->
`;
if (/<!-- reopen-table -->[\s\S]*?<!-- \/reopen-table -->\n?/.test(h)) h = h.replace(/<!-- reopen-table -->[\s\S]*?<!-- \/reopen-table -->\n?/, () => rtBlock);
else swap(/<section class="azseo"/, (m) => `${rtBlock}${m}`, "the A to Z section (to place the reopening table)");
/* the reopening FAQ answer counts from the same list */
const yrs = rt.filter((r) => r.status === "Reopening" && r.whenSort).map((r) => new Date(r.whenSort).getUTCFullYear());
const span = yrs.length ? (Math.min(...yrs) === Math.max(...yrs) ? `in ${Math.min(...yrs)}` : `between ${Math.min(...yrs)} and ${Math.max(...yrs)}`) : "on dates still to be set";
const reAreas = [...new Set(rt.filter((r) => r.status === "Reopening").flatMap((r) => areaOf(r).split(/\s*(?:&|\/)\s*/)))].sort().map((x) => (x === "South Coast" ? "the South Coast" : x));
const areaList = reAreas.length > 1 ? `${reAreas.slice(0, -1).join(", ")} and ${reAreas[reAreas.length - 1]}` : reAreas[0] || "Jamaica";
swap(/\b\d+ resorts are reopening (?:across|between|in|on) [^.<"]*\./g, () => `${reopening} resorts are reopening ${span}, in ${areaList}.`, "the reopening FAQ answer");
h = h.replace(/Each resort(&#x27;|')s confirmed reopening date is listed above and in the A–Z below\./g, (m, q) => `Each resort${q}s reopening date is in the reopening table and the A–Z below.`);
h = h.replace(/"dateModified":"\d{4}-\d{2}-\d{2}"/g, `"dateModified":"${DAY}"`);
fs.writeFileSync(p, h);
console.log(`status page: ${listed.length} resorts, ${open} open, ${reopening} reopening, updated ${shortDate}; ${byAZ.filter((r) => { const c = (CFG.az || {})[r.name]; return c && c.status === r.status; }).length} written answers kept`);

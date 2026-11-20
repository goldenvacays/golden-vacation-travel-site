/* "Things to do near your resort" on the hotel status page: a plain list of links (one per open resort that has a
   /experiences/near/<slug> page), grouped by area, so search engines and AI answers that cite the status page can follow
   it to the tours near each resort. The resort list at the top of the page is drawn by the page script; this block is
   static HTML. build-status.mjs calls nearBlock() and swaps it in between the <!-- near-links --> markers. */
import fs from "node:fs";
import path from "node:path";

export const slugify = (s) => String(s).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const SHOW = new Set(["Open", "Closing soon"]);

/* rows: [{ name, area, status }] */
export function nearBlock(rows, root) {
  const has = (slug) => fs.existsSync(path.join(root, "public/experiences/near", `${slug}.html`));
  const open = rows.filter((r) => SHOW.has(r.status) && has(slugify(r.name)));
  const areas = [...new Set(open.map((r) => r.area))].sort();
  const groups = areas.map((a) => {
    const links = open.filter((r) => r.area === a).sort((x, y) => x.name.localeCompare(y.name, "en", { sensitivity: "base" }))
      .map((r) => `<li><a href="/experiences/near/${slugify(r.name)}">Things to do near ${esc(r.name)}</a></li>`).join("");
    return `<div class="nrgrp"><h3>${esc(a)}</h3><ul>${links}</ul></div>`;
  }).join("\n");
  return `<!-- near-links -->
<section class="nrseo" id="near" aria-label="Things to do near your Jamaica resort">
<h2 class="hh">Things to do near your resort</h2>
<p class="azlead">Staying at one of the open resorts? Each page lists the tours, day trips and day passes closest to it, with the drive time from your hotel and whether hotel pickup is included. Or see <a href="/experiences/">every Jamaica tour</a>.</p>
<style>.nrseo{display:flex;flex-direction:column}.nrseo h2{font-size:clamp(28px,3.4vw,42px);line-height:1.02;margin-bottom:14px}.nrseo .azlead a{font-weight:700}.nrgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:22px 44px}.nrgrp h3{font-size:15px;font-weight:800;margin:0 0 8px}.nrgrp ul{list-style:none;margin:0;padding:0}.nrgrp li{padding:7px 0;border-top:1px solid var(--line);font-size:14.5px;line-height:1.4}.nrgrp a{color:inherit;text-decoration:underline;text-underline-offset:3px}.nrgrp a:hover{color:var(--ink-2)}</style>
<div class="nrgrid">
${groups}
</div>
</section>
<!-- /near-links -->
`;
}

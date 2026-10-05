#!/usr/bin/env node
/* Sitemap dates: every <lastmod> in public/sitemap.xml becomes the day that page last really changed.
   The section builders stamp their own block with the build day, which tells Google every page changed on every
   build; Google then stops trusting the dates. This runs after them (npm run status does) and sets each entry to
   the date of the last commit that touched the page's file, or today (in Jamaica) when the file has changes that
   are not committed yet. Needs the repo's history: in a shallow clone, run git fetch --unshallow first, or the
   oldest pages take the clone's cut-off date.
   Usage: node scripts/sitemap-dates.mjs */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SM = path.join(ROOT, "public/sitemap.xml");
const ORIGIN = "https://goldenvacays.com";
const today = new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10); // Jamaica, UTC-5 all year
const git = (args) => { try { return execFileSync("git", args, { cwd: ROOT, stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch (e) { return ""; } };

/* the file a sitemap address is served from (Netlify serves public/x.html at /x and public/x/index.html at /x/) */
function fileFor(loc) {
  const p = loc.replace(ORIGIN, "") || "/";
  if (p === "/") return "index.html";
  if (p === "/hotel-status-map" || p === "/hotel-status-map/") return "public/map/index.html";
  const candidates = p.endsWith("/") ? [`public${p}index.html`] : [`public${p}.html`, `public${p}/index.html`];
  return candidates.find((f) => fs.existsSync(path.join(ROOT, f))) || null;
}

let sm = fs.readFileSync(SM, "utf8");
let changed = 0, missing = [];
sm = sm.replace(/<url>\s*<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g, (all, loc, old) => {
  const f = fileFor(loc);
  if (!f) { missing.push(loc); return all; }
  const dirty = git(["status", "--porcelain", "--", f]);
  const day = dirty ? today : git(["log", "-1", "--format=%cs", "--", f]);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return all;
  const stamp = `${day}T00:00:00+00:00`;
  if (stamp !== old) changed++;
  return all.replace(`<lastmod>${old}</lastmod>`, `<lastmod>${stamp}</lastmod>`);
});
fs.writeFileSync(SM, sm);
console.log(`sitemap dates: ${changed} changed${missing.length ? `; no file found for ${missing.join(", ")}` : ""}`);

/* IndexNow: after every live deploy, tell Bing (and the other IndexNow search engines) which pages changed,
   so Bing and Copilot pick up new prices and copy within minutes instead of waiting for their next crawl.

   It runs in onSuccess, when the deploy is already live. The pages are the files that changed between the last
   commit Netlify built (CACHED_COMMIT_REF) and this one (COMMIT_REF), so commits marked [skip netlify] are counted
   in the deploy that finally goes out. Only pages listed in the sitemap are sent, plus pages that were deleted.
   The key is the one in public/c27782bd44db7b92096c8921281b6afd.txt. This can never fail or block a deploy: any
   problem is written to the deploy log and skipped. Netlify treats every export as a build event, so onSuccess is
   the only one. */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const HOST = "goldenvacays.com";
const ORIGIN = `https://${HOST}`;
const KEY = "c27782bd44db7b92096c8921281b6afd";

/* a file in the repo -> the address of its page: index.html at the root is the front page, public/x/index.html is
   /x/, public/x/y.html is /x/y, and the resort map lives at /hotel-status-map (see public/_redirects) */
const urlFor = (file) => {
  if (file === "index.html") return `${ORIGIN}/`;
  if (file === "public/map/index.html") return `${ORIGIN}/hotel-status-map`;
  if (!file.startsWith("public/") || !file.endsWith(".html") || file === "public/404.html") return null;
  const p = file.slice("public".length);
  return ORIGIN + (p.endsWith("/index.html") ? p.slice(0, -"index.html".length) : p.slice(0, -".html".length));
};

/* "M\tpublic/x.html" lines -> the URLs worth sending */
const changedUrls = (nameStatus, sitemapXml) => {
  const listed = new Set([...sitemapXml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]));
  const urls = new Set();
  for (const line of nameStatus.split("\n").filter(Boolean)) {
    const [status, ...files] = line.split("\t");
    for (const f of status.startsWith("R") ? files : files.slice(0, 1)) {
      const u = urlFor(f);
      if (u && (listed.has(u) || status.startsWith("D"))) urls.add(u);
    }
  }
  return [...urls];
};

/* the files changed between two commits; a shallow clone gets more history fetched once before giving up */
const git = (args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const diffBetween = (base, head) => {
  try { return git(["diff", "--name-status", "-M", base, head]); }
  catch { git(["fetch", "--quiet", "--deepen=200", "origin"]); return git(["diff", "--name-status", "-M", base, head]); }
};

export const onSuccess = async ({ constants, utils }) => {
  try {
    if (process.env.CONTEXT !== "production") return console.log(`IndexNow: ${process.env.CONTEXT || "local"} deploy, skipped`);
    const base = process.env.CACHED_COMMIT_REF, head = process.env.COMMIT_REF;
    if (!base || !head || base === head) return console.log("IndexNow: no earlier build to compare with, skipped");
    const diff = diffBetween(base, head);
    const sitemap = fs.readFileSync(path.resolve(constants.PUBLISH_DIR, "sitemap.xml"), "utf8");
    const urls = changedUrls(diff, sitemap).slice(0, 10000);
    if (!urls.length) return console.log("IndexNow: no pages changed in this deploy, nothing sent");
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `${ORIGIN}/${KEY}.txt`, urlList: urls }),
    });
    const ok = res.status === 200 || res.status === 202;
    console.log(`IndexNow: sent ${urls.length} page(s), answer ${res.status}${ok ? "" : " (not accepted)"}\n${urls.join("\n")}`);
    utils.status.show({ title: "IndexNow", summary: `${ok ? "Sent" : "Tried to send"} ${urls.length} changed page(s) to Bing (answer ${res.status})`, text: urls.join("\n") });
  } catch (e) {
    console.log(`IndexNow: skipped (${String(e.message).split("\n")[0]})`);
  }
};

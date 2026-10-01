/* The map at the top of the near-hotel and area pages: the real coastline (data/jamaica.json) around one place, the
   days out pinned with their drive times, and the ones off the edge signposted with an arrow. Everything is placed at
   build time, so the page carries no map script: the land is one SVG path, the pins and labels are positioned spans
   (percent of the map box, so they stay on their places at any width). Labels are laid out twice, once for a laptop
   (720 x 420) and once for a phone (350 x 204), because type does not shrink with the map; CSS shows one set.
   Text is measured with Archivo's own advance widths (measured in Chromium from /assets/fonts/archivo.woff2),
   so a label is only placed where it fits without covering another label, pin or leader line. */
import { roundRing, ringPath } from "./lib-island.mjs";

const CH = "0123456789 !\"#$%&'()*+,-./:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~\u00e9\u00f1\u00e1\u00ed\u00f3\u00fa\u2019\u2018\u201c\u201d\u2013\u2014\u00b7\u2248";
const WID = {"700": [60, 60, 60, 60, 60, 60, 60, 60, 60, 60, 20, 30, 46, 60, 56, 97, 76, 25, 36, 36, 41, 64, 31, 33, 31, 30, 34, 34, 64, 64, 64, 61, 100, 72, 72, 73, 74, 68, 62, 80, 75, 30, 60, 73, 59, 87, 75, 79, 68, 79, 73, 68, 64, 75, 69, 96, 71, 70, 65, 35, 30, 35, 64, 52, 23, 58, 61, 57, 61, 58, 33, 61, 60, 27, 26, 57, 27, 89, 60, 61, 61, 61, 38, 56, 34, 60, 55, 80, 57, 55, 52, 39, 25, 39, 64, 58, 60, 58, 27, 61, 60, 28, 28, 49, 49, 50, 100, 33, 60], "800": [63, 63, 63, 63, 63, 63, 63, 63, 63, 63, 19, 31, 47, 63, 58, 98, 82, 26, 37, 37, 41, 65, 32, 33, 32, 30, 33, 33, 65, 65, 65, 61, 101, 75, 75, 75, 76, 70, 64, 82, 79, 33, 63, 77, 62, 91, 79, 81, 70, 81, 75, 70, 68, 78, 73, 98, 74, 73, 68, 37, 30, 37, 65, 53, 26, 62, 63, 61, 63, 62, 35, 63, 63, 29, 29, 61, 29, 94, 63, 64, 63, 63, 41, 58, 39, 63, 57, 86, 61, 57, 54, 39, 27, 39, 65, 62, 63, 62, 29, 64, 63, 28, 28, 50, 50, 50, 100, 33, 60], "900": [67, 67, 67, 67, 67, 67, 67, 67, 67, 67, 18, 33, 50, 66, 61, 100, 89, 28, 39, 39, 41, 66, 33, 33, 33, 31, 33, 33, 66, 66, 66, 61, 101, 78, 78, 78, 78, 72, 67, 83, 83, 37, 67, 83, 67, 97, 83, 83, 72, 83, 78, 72, 72, 83, 78, 100, 78, 78, 72, 39, 31, 39, 66, 56, 30, 67, 67, 67, 67, 67, 39, 67, 67, 32, 32, 67, 32, 100, 67, 67, 67, 67, 44, 61, 44, 67, 61, 94, 67, 61, 56, 39, 28, 39, 66, 67, 67, 67, 32, 67, 67, 28, 28, 51, 51, 50, 100, 33, 60]};
/* width of a string in px at a weight (700, 800 or 900) and size, with a little slack for the renderer */
export function textW(s, weight, size) {
  const t = WID[String(weight)] || WID["800"];
  let w = 0;
  for (const c of String(s)) { const i = CH.indexOf(c); w += i < 0 ? 62 : t[i]; }
  return (w * size) / 100 * 1.04;
}

/* towns for orientation, shown on a laptop where there is room */
const TOWNS = [["Negril", 18.268, -78.348], ["Green Island", 18.389, -78.271], ["Lucea", 18.451, -78.174], ["Montego Bay", 18.471, -77.918], ["Falmouth", 18.492, -77.656],
  ["Discovery Bay", 18.463, -77.405], ["Runaway Bay", 18.456, -77.33], ["St Ann's Bay", 18.436, -77.201], ["Ocho Rios", 18.405, -77.103], ["Oracabessa", 18.402, -76.946],
  ["Port Maria", 18.37, -76.89], ["Savanna-la-Mar", 18.219, -78.133], ["Black River", 18.026, -77.849], ["Treasure Beach", 17.888, -77.76], ["Mandeville", 18.041, -77.507], ["Kingston", 17.997, -76.793]];

const W = 720, H = 420;
const V = {
  d: { k: 1, name: 14, time: 13, me: 15, meSub: 12.5, badge: 12.5, gapsUp: [22, 40, 58, 76, 94, 112, 130, 148, 166, 184], gapsDown: [16, 34, 52], max: 8, towns: true },
  m: { k: 350 / 720, name: 12, time: 11.5, me: 13, meSub: 11, badge: 11, gapsUp: [14, 26, 38, 50, 62, 74, 86], gapsDown: [10, 22], max: 4, towns: false },
};
const pct = (n, of) => `${+((n / of) * 100).toFixed(2)}%`;
const hit = (a, b, pad = 4) => a.x0 < b.x1 + pad && a.x1 > b.x0 - pad && a.y0 < b.y1 + pad && a.y1 > b.y0 - pad;

/* the coastline, clamped to a margin around the box: points far outside collapse onto the margin (a clamp never moves
   a point further than it was from its neighbour, so no edge inside the box changes) and runs along one side of the
   margin drop their middle points, which keeps a zoomed map's path a fraction of the whole island's */
function landPath(ring, proj) {
  const M = 60, x0 = -M, y0 = -M, x1 = W + M, y1 = H + M;
  const pts = roundRing(ring.map(([lo, la]) => proj(lo, la))).map(([x, y]) => [Math.min(x1, Math.max(x0, x)), Math.min(y1, Math.max(y0, y))]);
  const side = ([x, y]) => (x === x0 ? "l" : x === x1 ? "r" : y === y0 ? "t" : y === y1 ? "b" : "");
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], a = pts[(i - 1 + pts.length) % pts.length], b = pts[(i + 1) % pts.length], s = side(p);
    if (s && side(a) === s && side(b) === s) continue;
    out.push(p);
  }
  return ringPath(out);
}

/* anchor: { lat, lng, name, sub } (a hotel or port; name null for an area page, which pins no single place)
   groups: [{ lat, lng, label, time, short, min, place }] the days out, one per site, nearest first
   dots: [{ lat, lng }] resorts shown as small dots (area pages)
   arrow(dir): the arrow icon markup for the edge signs */
export function nearMap({ ring, anchor, groups, dots = [], esc, arrow, title, lngSpan = 0.74 }) {
  const kx = Math.cos((anchor.lat * Math.PI) / 180);
  const latSpan = (lngSpan * kx) / (W / H);
  /* slide the window so the most days out within 100 min are on it, keeping the place itself between 28% and 72% across */
  let best = null;
  for (let f = 0.28; f <= 0.7201; f += 0.02) {
    const lo0 = anchor.lng - lngSpan * f, m = lngSpan * 0.07;
    const n = groups.filter((g) => g.min <= 100 && g.lng > lo0 + m && g.lng < lo0 + lngSpan - m).length;
    const score = n * 10 - Math.abs(f - 0.5) * 6;
    if (!best || score > best.score + 1e-9) best = { score, lo0 };
  }
  const lo0 = best.lo0, la1 = anchor.lat + latSpan * 0.44, s = W / (lngSpan * kx);
  const proj = (lng, lat) => [(lng - lo0) * kx * s, (la1 - lat) * s];
  const d = landPath(ring, proj);
  const [ax, ay] = proj(anchor.lng, anchor.lat);
  const pins = [], off = { west: [], east: [] };
  for (const g of groups) {
    const [x, y] = proj(g.lng, g.lat);
    if (anchor.name && Math.hypot(x - ax, y - ay) < 16) continue; // right at the place itself: its marker already covers it, and the list leads with it
    if (x > 10 && x < W - 10 && y > 10 && y < H - 10) pins.push({ ...g, x, y });
    else (x < W / 2 ? off.west : off.east).push(g);
  }
  /* one sign per place off the edge, nearest first, two a side at most */
  const signs = (list) => { const seen = new Map(); for (const g of list) if (!seen.has(g.place) || seen.get(g.place).min > g.min) seen.set(g.place, g); return [...seen.values()].sort((a, b) => a.min - b.min).slice(0, 2); };
  const edge = { west: signs(off.west), east: signs(off.east) };

  const layout = (vk) => {
    const c = V[vk], k = c.k, bw = W * k, bh = H * k;
    const P = pins.map((p) => ({ ...p, px: p.x * k, py: p.y * k }));
    const pinBox = P.map((p) => ({ x0: p.px - 8, y0: p.py - 8, x1: p.px + 8, y1: p.py + 8 }));
    const home = anchor.name ? { x0: ax * k - 13, y0: ay * k - 13, x1: ax * k + 13, y1: ay * k + 13 } : null;
    const pos = (x0, y0, x1, align) => (align === "r" ? `right:${pct(bw - x1, bw)};top:${pct(y0, bh)}` : `left:${pct(x0, bw)};top:${pct(y0, bh)}`);
    const blockedIn = (st, r, own = -1) => r.x0 < 4 || r.y0 < 4 || r.x1 > bw - 4 || r.y1 > bh - 4 || st.rects.some((o) => hit(r, o)) || pinBox.some((o, i) => i !== own && hit(r, o, 2)) || (home && hit(r, home, 2)) || st.leads.some((o) => hit(r, o, 3));
    /* 1. the place itself. On a phone the map sits right under the hotel's name, so its label is just "You're here" */
    let me = null;
    if (anchor.name) {
      const hx = ax * k, hy = ay * k;
      const main = vk === "m" ? anchor.sub || anchor.name : anchor.name, sub = vk === "m" ? "" : anchor.sub || "";
      const lw = Math.max(textW(main, 900, c.me), sub ? textW(sub, 700, c.meSub) : 0), lh = c.me * 1.15 + (sub ? c.meSub * 1.15 + 1 : 0);
      const tries = [];
      for (const dy of [9, 22, 36]) for (const [al, x0] of [["r", hx - 16 - lw], ["l", hx + 16], ["c", hx - lw / 2]]) { tries.push([al, x0, hy + (al === "c" ? dy + 6 : dy)]); tries.push([al, x0, hy - (al === "c" ? dy + 6 : dy) - lh]); }
      me = { main, sub, lw, tries: tries.map(([al, x0, y0]) => ({ al, r: { x0, y0, x1: x0 + lw, y1: y0 + lh } })).filter((t) => !blockedIn({ rects: [], leads: [] }, t.r)) };
    }
    /* 2. the days out, nearest first; a label goes above its pin (the sea side on the north coast), beside it or below
       it, anywhere along its leader line, and a pin keeps no label rather than a crowded one */
    const placeDays = (st) => {
      let n = 0;
      P.forEach((p, i) => {
        if (n >= c.max) return;
        const time = vk === "d" ? p.time : p.timeShort;
        const lines = String(p.label).split("\n");
        const lw = Math.max(...lines.map((l) => textW(l, 800, c.name)), textW(time, 800, c.time)), lh = c.name * 1.15 * lines.length + c.time * 1.15 + 2;
        const sides = p.px >= ax * k ? ["l", "r"] : ["r", "l"];
        const along = [...sides, "c", sides[0] === "l" ? "l4" : "r4", sides[0] === "l" ? "r4" : "l4"];
        const shift = { l: 0, l4: 0.25, c: 0.5, r4: 0.75, r: 1 };
        const tries = [];
        for (const g of c.gapsUp) for (const al of along) tries.push([al, g, "up"]);
        for (const al of sides) tries.push([al, 0, "side"]);
        for (const g of c.gapsDown) for (const al of along) tries.push([al, g, "down"]);
        for (const [al0, gap, dir] of tries) {
          const x0 = dir === "side" ? (al0 === "l" ? p.px + 13 : p.px - 13 - lw) : p.px - 10 - shift[al0] * (lw - 20);
          const al = al0 === "c" ? "c" : shift[al0] > 0.5 ? "r" : "l";
          const y0 = dir === "up" ? p.py - gap - lh : dir === "side" ? p.py - lh / 2 : p.py + gap;
          const r = { x0, y0, x1: x0 + lw, y1: y0 + lh };
          const lead = dir === "side" ? null : dir === "up" ? { x0: p.px - 1, x1: p.px + 1, y0: r.y1 + 2, y1: p.py - 7 } : { x0: p.px - 1, x1: p.px + 1, y0: p.py + 7, y1: r.y0 - 2 };
          if (blockedIn(st, r, i)) continue;
          if (lead && (st.rects.some((o) => hit(lead, o, 1)) || pinBox.some((o, j) => j !== i && hit(lead, o, 1)) || (home && hit(lead, home, 1)))) continue;
          st.rects.push(r); n++;
          if (lead) { st.leads.push(lead); st.html.push(`<span class="nm-lead nm-${vk}" style="left:${pct(p.px, bw)};top:${pct(lead.y0, bh)};height:${pct(lead.y1 - lead.y0, bh)}"></span>`); }
          st.html.push(`<span class="nm-l nm-${vk}${al === "r" ? " r" : al === "c" ? " c" : ""}" style="${pos(r.x0, r.y0, r.x1, al === "c" ? "l" : al)}${al === "c" ? `;width:${pct(lw, bw)}` : ""}"><b>${lines.map(esc).join("<br>")}</b><span>${esc(time)}</span></span>`);
          return;
        }
      });
      return n;
    };
    /* the place's own label goes wherever leaves the most days out labelled (first choice wins a tie) */
    let st = null;
    for (const t of me && me.tries.length ? me.tries : [null]) {
      const cand = { rects: [], leads: [], html: [] };
      if (t) {
        cand.rects.push(t.r);
        cand.html.push(`<span class="nm-l nm-me nm-${vk}${t.al === "r" ? " r" : t.al === "c" ? " c" : ""}" style="${pos(t.r.x0, t.r.y0, t.r.x1, t.al === "c" ? "l" : t.al)}${t.al === "c" ? `;width:${pct(me.lw, bw)}` : ""}"><b>${esc(me.main)}</b>${me.sub ? `<span>${esc(me.sub)}</span>` : ""}</span>`);
      }
      cand.n = placeDays(cand);
      if (!st || cand.n > st.n) st = cand;
      if (st.n >= Math.min(c.max, P.length)) break;
    }
    const { rects, leads, html } = st;
    const blocked = (r) => blockedIn(st, r);
    /* 3. the signs for what is off the edge, stacked up from the bottom corners */
    for (const sideKey of ["west", "east"]) {
      let y1 = bh - 12 * k - 4;
      for (const g of edge[sideKey]) {
        const text = vk === "d" ? `${g.place}, ${g.time}` : `${g.place} ${g.timeShort}`;
        const sw = textW(text, 800, c.badge) + (vk === "d" ? 42 : 34), sh = c.badge * 1.2 + (vk === "d" ? 13 : 11);
        let placed = null;
        for (let y = y1; y - sh > bh * 0.45; y -= 6) {
          const x0 = sideKey === "west" ? 12 * k + 2 : bw - 12 * k - 2 - sw;
          const r = { x0, y0: y - sh, x1: x0 + sw, y1: y };
          if (!blocked(r)) { placed = r; break; }
        }
        if (!placed) continue;
        rects.push(placed);
        html.push(`<span class="nm-edge nm-${vk}${sideKey === "east" ? " r" : ""}" style="${sideKey === "east" ? `right:${pct(bw - placed.x1, bw)}` : `left:${pct(placed.x0, bw)}`};top:${pct(placed.y0, bh)}">${sideKey === "west" ? arrow("l") : ""}${esc(text)}${sideKey === "east" ? arrow("r") : ""}</span>`);
        y1 = placed.y0 - 8;
      }
    }
    /* 4. towns, only where nothing else is */
    if (c.towns) for (const [name, lat, lng] of TOWNS) {
      const [x, y] = proj(lng, lat);
      const tw = textW(name, 700, 11), r = { x0: x - tw / 2, y0: y + 5, x1: x + tw / 2, y1: y + 18 };
      if (blocked(r) || pinBox.some((o) => hit(r, o, 10)) || (home && hit(r, home, 10))) continue;
      rects.push(r);
      html.push(`<span class="nm-town nm-d" style="left:${pct(x, W)};top:${pct(y + 5, H)}">${esc(name)}</span>`);
    }
    return html.join("");
  };

  const pinHtml = pins.map((p) => `<span class="nm-pin" style="left:${pct(p.x, W)};top:${pct(p.y, H)}"></span>`).join("");
  const dotHtml = dots.map((o) => proj(o.lng, o.lat)).filter(([x, y]) => x > 4 && x < W - 4 && y > 4 && y < H - 4).map(([x, y]) => `<span class="nm-dot" style="left:${pct(x, W)};top:${pct(y, H)}"></span>`).join("");
  const homeHtml = anchor.name ? `<span class="nm-home" style="left:${pct(ax, W)};top:${pct(ay, H)}"></span>` : "";
  return `<figure class="nr-map">
  <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><path class="nr-land" d="${d}"/></svg>
  ${dotHtml}${pinHtml}${homeHtml}${layout("d")}${layout("m")}
  <figcaption class="sr">${esc(title)}</figcaption>
</figure>`;
}

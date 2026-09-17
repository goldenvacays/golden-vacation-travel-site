/* The island: a photo clipped to the coastline of Jamaica (data/jamaica.json), the airports pinned where they are.
   Shared by the transfers page (its hero) and the home page (the transfers block in the Coming to Jamaica band).
   The styles live with each page (.tr-island-svg, .tr-island-glow, .tr-island-edge, .tr-pin). */
import fs from "node:fs";

/* width and height of a JPEG, read from its SOF marker; a sensible 3:2 when the file is missing */
export function jpegSize(file) {
  if (!fs.existsSync(file)) return [3, 2];
  const b = fs.readFileSync(file);
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const m = b[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    if (m === 0xff) { i++; continue; }
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
    i += 2 + b.readUInt16BE(i + 2);
  }
  return [3, 2];
}

/* Rounds the corners off a closed ring of points (Chaikin: each segment gives up its two quarter points).
   Every new point sits between two old ones, so unlike a spline through the points this can never bulge past
   the real coastline or tie the thin Palisadoes spit into a loop. Two rounds is smooth at the lens's 9x. */
export function roundRing(pts, rounds = 2) {
  let p = pts;
  for (let r = 0; r < rounds; r++) {
    const out = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    p = out;
  }
  return p;
}

/* a closed path through the points, whole numbers in the 1000-wide space (a tenth of a unit is a tenth of a
   pixel on the widest phone, so it only pads the HTML) and with repeated points dropped */
export function ringPath(pts) {
  const q = pts.map(([x, y]) => [Math.round(x), Math.round(y)]).filter((p, i, a) => i === 0 || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1]);
  return `M${q.map((p) => p.join(" ")).join("L")}Z`;
}

/* ring: [[lng, lat], ...] coastline; airports: [{code, lat, lng}]; photoUrl: the src; size: [w, h] of the photo;
   focus: [x, y] in 0..1, which part of the photo stays in view when the shape crops it; alt: for screen readers */
export function islandSvg({ ring, airports, photoUrl, size, focus, alt, esc, id = "tr-island" }) {
  const lons = ring.map((p) => p[0]), lats = ring.map((p) => p[1]);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons), minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const kx = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const W = 1000, scale = W / ((maxLon - minLon) * kx), Hh = (maxLat - minLat) * scale;
  const proj = (lng, lat) => [(lng - minLon) * kx * scale, (maxLat - lat) * scale];
  const d = ringPath(roundRing(ring.map(([lo, la]) => proj(lo, la))));
  const [iw, ih] = size;
  const s = Math.max(W / iw, Hh / ih), dw = iw * s, dh = ih * s;
  const [fx, fy] = focus || [0.5, 0.5];
  const x = -(dw - W) * fx, y = -(dh - Hh) * fy;
  const pins = (airports || []).filter((a) => a.lat && a.lng).map((a) => {
    const [px, py] = proj(a.lng, a.lat);
    /* the label goes beside a pin on the north coast, under one on the south coast, above the rest */
    const side = py < 40 ? "left" : py > Hh * 0.6 ? "below" : "above";
    const tx = side === "left" ? px - 20 : px, ty = side === "left" ? py + 9 : side === "below" ? py + 42 : py - 22;
    return `<g class="tr-pin"><circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="9"/><text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="${side === "left" ? "end" : "middle"}">${esc(a.code)}</text></g>`;
  }).join("\n");
  const PAD = 30, TOP = 30, BOT = 44;
  return `<svg class="tr-island-svg" viewBox="${-PAD} ${-TOP} ${W + 2 * PAD} ${(Hh + TOP + BOT).toFixed(1)}" role="img" aria-labelledby="${id}-title">
<title id="${id}-title">${esc(alt)}</title>
<defs><clipPath id="${id}-clip"><path d="${d}"/></clipPath></defs>
<path class="tr-island-glow" d="${d}"/>
<image href="${photoUrl}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${dw.toFixed(1)}" height="${dh.toFixed(1)}" preserveAspectRatio="none" clip-path="url(#${id}-clip)"/>
<path class="tr-island-edge" d="${d}"/>
${pins}
</svg>`;
}

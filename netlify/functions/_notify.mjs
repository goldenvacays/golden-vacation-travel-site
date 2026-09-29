/* Readable team emails for the website's forms. submission-created.mjs calls teamEmail() for every
   Netlify form submission and sends the result through Resend, so the team gets one clear card per lead
   instead of Netlify's raw field dump: what it is and when, a headline, the details as rows, reply buttons
   when the guest left a number or an email, and where on the site it came from. */

const GOLD = "#F2B93B", INK = "#0E0F0E", ALT = "#F3F3EF", MUTED = "#5A5F57", LINE = "#E4E4DF", GOLD_TXT = "#A87A12";

/* where team emails go: FORMS_NOTIFY (comma separated), else GROUPS_NOTIFY, else the team inbox already public on the site */
export const DEFAULT_NOTIFY = "goldentravellers@outlook.com";
export const notifyList = () => (process.env.FORMS_NOTIFY || process.env.GROUPS_NOTIFY || DEFAULT_NOTIFY).split(",").map((s) => s.trim()).filter(Boolean);

export const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const nice = (d) => { if (!d) return ""; const t = new Date(d + "T00:00:00"); return isNaN(t) ? d : t.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); };

/* the brief, in the order a quote is built, only the rows that were filled */
export function briefLines(f) {
  const b = f.branch || "groups", L = [];
  const rooms = [["r_double", "double"], ["r_single", "single"], ["r_triple", "triple"], ["r_quad", "quad"]].map(([k, l]) => (Number(f[k]) ? `${f[k]} ${l}${Number(f[k]) === 1 ? "" : "s"}` : "")).filter(Boolean).join(", ");
  const people = [f.adults ? `${f.adults} adult${f.adults == 1 ? "" : "s"}` : "", Number(f.children) ? `${f.children} child${f.children == 1 ? "" : "ren"}${f.child_ages ? ` (${f.child_ages})` : ""}` : ""].filter(Boolean).join(", ");
  const dates = (a, z) => (f[a] || f[z] ? `${nice(f[a])} to ${nice(f[z])}${f.dates_flex ? " (dates are flexible)" : ""}` : "");
  const alts = [1, 2, 3].map((i) => (f[`alt${i}_from`] || f[`alt${i}_to`] ? `${nice(f[`alt${i}_from`])} to ${nice(f[`alt${i}_to`])}` : "")).filter(Boolean).join("; ");
  if (b === "groups") {
    L.push(["Enquiry", `Resort or hotel rooms${f.org_name ? ` for ${f.org_name}` : ""}${f.org_type ? ` (${f.org_type})` : ""}`]);
    if (f.hotels) L.push(["Hotels", f.hotels]);
    if (f.area) L.push(["Area", f.area]);
    if (f.tier) L.push(["Style", f.tier]);
    L.push(["Dates", dates("checkin", "checkout")]);
  } else if (b === "jamaica") {
    const es = f.lang === "es";
    const who = { usa: "from the USA", "coming-home": "coming home", es: "from the USA, in Spanish", "uk-canada": "from the UK or Canada, land only" }[f.audience] || "";
    L.push([es ? "Solicitud" : "Enquiry", es ? "Viaje a Jamaica" : `Coming to Jamaica${who ? `, ${who}` : ""}`]);
    const niceEs = (d) => { if (!d) return ""; const t = new Date(d + "T00:00:00"); return isNaN(t) ? d : t.toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" }); };
    L.push([es ? "Fechas" : "Dates", es ? (f.checkin || f.checkout ? `${niceEs(f.checkin)} a ${niceEs(f.checkout)}` : "") : dates("checkin", "checkout")]);
    if (f.rooms && Number(f.rooms) > 1) L.push([es ? "Habitaciones" : "Rooms", `${f.rooms}${f.split ? ` (${f.split})` : ""}`]);
    if (f.needs) L.push([es ? "Necesitas" : "Needs", f.needs]);
    if (f.area) L.push([es ? "Zona" : "Area", f.area]);
    if (f.occasion) L.push(["Occasion", f.occasion]);
    if (f.currency) L.push(["Quote in", f.currency]);
  } else if (b === "overseas") {
    L.push(["Enquiry", `Coming to Jamaica${f.occasion ? ` for a ${f.occasion.toLowerCase()}` : ""}${f.org_name ? ` (${f.org_name})` : ""}`]);
    L.push(["Dates", dates("arrival", "departure")]);
    if (f.staggered) L.push(["Other arrivals", f.staggered_notes || "some on other days"]);
    if (f.airport_in) L.push(["Flying into", f.airport_in]);
    if (f.place) L.push(["Where", f.place]);
    if (f.hotels) L.push(["Hotels", f.hotels]);
    if (f.tier) L.push(["Style", f.tier]);
    if (f.coming_from) L.push(["Coming from", f.coming_from]);
  } else {
    L.push(["Enquiry", `International group trip${f.org_name ? ` for ${f.org_name}` : ""}${f.role ? ` (${f.role.toLowerCase()})` : ""}`]);
    L.push(["Where", [f.place, f.hotel].filter(Boolean).join(", ")]);
    if (f.tier) L.push(["Style", f.tier]);
    L.push(["Dates", dates("depart", "return")]);
    if (f.airport) L.push(["Flying from", f.airport === "Another airport" && f.airport_other ? f.airport_other : f.airport]);
    if (Number(f.ready_now)) L.push(["Ready to book now", `${f.ready_now} people`]);
  }
  if (alts) L.push(["Other dates", alts]);
  if (people) L.push(["People", people]);
  if (rooms) L.push(["Rooms", rooms]);
  if (f.expect) L.push(["Wants", f.expect]);
  if (f.meeting === "Yes") L.push(["Meeting room", `${f.meeting_capacity || "?"} people, ${f.meeting_days || "?"} day(s)${f.catering ? `, ${f.catering.toLowerCase()}` : ""}`]);
  if (f.invoice) L.push(["Invoice", f.invoice]);
  if (f.status) L.push(["Status", f.status]);
  if (f.quote_by) L.push(["Quote needed by", nice(f.quote_by)]);
  if (f.decides) L.push(["Booking", f.decides]);
  if (f.notes) L.push(["Notes", f.notes]);
  return L.filter(([, v]) => v);
}

/* Jamaica is UTC-5 all year */
export function jmTime(iso) {
  const d = new Date(new Date(iso || Date.now()).getTime() - 5 * 3600e3);
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()];
  const mo = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()];
  let h = d.getUTCHours(); const ap = h < 12 ? "am" : "pm"; h = h % 12 || 12;
  return `${wd} ${d.getUTCDate()} ${mo}, ${h}:${String(d.getUTCMinutes()).padStart(2, "0")} ${ap}`;
}

/* n working days after the submission, in Jamaica, as "Tue 29 Sep" */
export function workingDaysAfter(iso, n) {
  const d = new Date(new Date(iso || Date.now()).getTime() - 5 * 3600e3);
  let left = n;
  while (left > 0) { d.setUTCDate(d.getUTCDate() + 1); if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) left--; }
  return { date: d, label: `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()]} ${d.getUTCDate()} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getUTCMonth()]}` };
}

const WHERE = {
  "getaways-quote": "the getaways quote page", "staycation-card": "a staycation card on the home page",
  "heroes-weekend": "the Heroes Weekend offer", "coming-usa": "the coming-from-the-USA button",
  "coming-ukca": "the coming-from-the-UK-or-Canada button", "coming-es": "the Spanish button",
  "exp-panel": "a tour page", hub: "the tours page", nav: "the WhatsApp button in the menu",
  "quote-page": "the quote page", "tr-checkout": "the transfer checkout", "tr-picker": "the transfers page",
  booked: "the booking confirmation page", "groups-form": "the groups form",
};
const PRETTY_SOURCE = { chatgpt: "ChatGPT", google: "Google", facebook: "Facebook", instagram: "Instagram", perplexity: "Perplexity", bing: "Bing", tiktok: "TikTok" };

export function sourceLine(d = {}) {
  const ua = d.user_agent || "", ref = d.referrer || "";
  const app = /Instagram/i.test(ua) ? "Instagram" : /FBAN|FBAV|FB_IAB|FBIOS/i.test(ua) ? "Facebook" : /TikTok|musical_ly|Bytedance/i.test(ua) ? "TikTok" : /GSA\//.test(ua) ? "the Google app" : "";
  const utm = ((ref.match(/[?&]utm_source=([^&#]+)/) || [])[1] || "").toLowerCase().replace(/\.(com|ai|org)$/, "");
  const via = app || PRETTY_SOURCE[utm] || (utm ? utm : "");
  const device = /iPhone/.test(ua) ? "an iPhone" : /iPad/.test(ua) ? "an iPad" : /Android/.test(ua) ? "an Android phone" : /Windows/.test(ua) ? "a Windows computer" : /Macintosh/.test(ua) ? "a Mac" : "";
  const where = WHERE[d.where] || (d.page ? `goldenvacays.com${d.page}` : "");
  const parts = [];
  if (where) parts.push(`${d.form === "wa-exits" ? "Tapped on" : "Sent from"} ${where}`);
  const how = [via ? `via ${via}` : "", device ? `on ${device}` : ""].filter(Boolean).join(" ");
  return [parts.join(""), how].filter(Boolean).join(", ");
}

/* the WhatsApp message the site pre-fills: a greeting line, "Key: value" lines, a Ref */
export function parseMessage(text) {
  const lines = String(text || "").split(/\n+/).map((s) => s.trim()).filter(Boolean);
  let ref = "", name = ""; const head = [], rows = [];
  for (let l of lines) {
    const r = l.match(/\bRef\s+(GV-[A-Z0-9-]+)/i);
    if (r) { ref = r[1]; l = l.replace(/\s*\bRef\s+GV-[A-Z0-9-]+\.?/i, "").trim(); if (!l) continue; }
    const rq = l.match(/request\s+(GV-[A-Z0-9-]+)/i);
    if (rq) { ref = ref || rq[1]; continue; }
    if (/^Sent from /i.test(l)) continue;
    const kv = l.match(/^([A-Za-zÀ-ÿ' ]{2,24}):\s*(.+)$/);
    if (kv) { if (/^name$/i.test(kv[1])) name = kv[2]; else rows.push([kv[1].replace(/^Quote me in$/i, "Quote in"), kv[2]]); }
    else head.push(l);
  }
  const raw = head.shift() || "";
  const greeted = /^(¡?hola|hi|hello)\b[^!]*!/i.test(raw);
  let first = raw.replace(/^(¡?hola|hi|hello)\b[^!]*!\s*/i, "");
  first = first.replace(/^I'd like (an? )?/i, "").replace(/^I'm /i, "").replace(/\s·\s/g, ", ");
  const sentences = first.split(/(?<=\.)\s+/);
  let headline = (sentences.shift() || "").replace(/\.$/, "");
  if (/^(on your website|looking at the quote page on your website) and I'd like a quote$/i.test(headline)) headline = "Quote request, no details yet";
  headline = headline.replace(/^looking at (.+?) on your website$/i, "$1").replace(/ and I'd like (an? )?/i, ", wants $1");
  if (!greeted && head.length && head[0].length < 70) headline = `${headline}, ${head.shift()}`;
  headline = headline.charAt(0).toUpperCase() + headline.slice(1);
  const rest = [...sentences, ...head].join(" ").replace(/\s·\s/g, ", ").trim();
  if (!headline && rest) return { headline: rest, rows, ref, name, extra: "" };
  return { headline, rows, ref, name, extra: rest };
}

const phoneLinks = (raw) => {
  let d = String(raw || "").replace(/\D/g, "");
  if (!d) return null;
  if (d.length === 7) d = "1876" + d; else if (d.length === 10) d = "1" + d;
  return { wa: `https://wa.me/${d}`, tel: `tel:+${d}` };
};

/* one card per form */
function build(form, d) {
  const status = String(d.status || "");
  const paid = /PAID/i.test(status);
  const first = (s) => String(s || "").split(" ")[0];
  switch (form) {
    case "wa-exits": {
      const m = parseMessage(d.context);
      const rows = [...m.rows];
      if (m.extra) rows.push(["Message", m.extra]);
      if (d.total) rows.push(["Total shown", d.total]);
      return { kind: "WhatsApp lead", headline: m.headline || "Opened WhatsApp from the website", who: m.name, ref: m.ref || d.ref, rows,
        note: "They were sent to WhatsApp with this message. If it isn't in your WhatsApp chats, they didn't press send." };
    }
    case "exp-enquiries":
      return { kind: "Tour request on WhatsApp", headline: [d.venue, d.product].filter(Boolean).join(", "), ref: d.ref,
        rows: [["When", String(d.when || "").replace(/^(Date|Arrives|Departs):\s*/, "")], ["Guests", d.guests], ["Rate", d.rate], ["Pickup", d.pickup], ["Hotel", d.hotel], ["Total shown", d.total], ["Message", d.message]],
        note: "They were sent to WhatsApp to confirm. Nothing was charged." };
    case "exp-bookings":
    case "tr-bookings": {
      const tour = form === "exp-bookings";
      const arrival = /PAY ON ARRIVAL/i.test(status);
      const [, next] = status.split(/\s·\s(.+)/);
      const headline = tour ? [d.venue, d.product].filter(Boolean).join(", ") : [d.route, d.vehicle].filter(Boolean).join(", ");
      return { kind: arrival ? `PAY ON ARRIVAL ${tour ? "tour booking" : "transfer"} ${d.total || ""}`.trim() : paid ? `PAID ${tour ? "tour booking" : "transfer"} ${d.total || ""}`.trim() : tour ? "Tour booking" : "Transfer booking", loud: paid || arrival,
        subject: arrival ? `PAY ON ARRIVAL ${d.total || ""} · ${tour ? "Tour" : "Transfer"}: ${headline}${d.when ? ` · ${d.when}` : ""}` : paid ? `PAID ${d.total || ""} · ${tour ? "Tour" : "Transfer"}: ${headline}${d.when ? ` · ${d.when}` : ""}`.replace("PAID  ·", "PAID ·") : "",
        headline: tour ? [d.venue, d.product].filter(Boolean).join(", ") : [d.route, d.vehicle].filter(Boolean).join(", "), who: d.customer, ref: d.ref,
        rows: [["When", d.when], ["Guests", d.guests], [tour ? "Pickup" : "Pickup and drop-off", tour ? d.pickup : d.place], ["To collect on arrival", arrival ? d.total : ""], ["Total paid", paid ? d.total : ""], ["Total", paid || arrival ? "" : d.total], ["Phone", d.phone], ["Email", d.email], ["Park order", d.order], ["Notes", d.note]],
        todo: next ? next.replace(/^(confirmed to the guest|nothing charged online)\s·\s/i, "").replace(/^./, (c) => c.toUpperCase()) : paid ? "" : status,
        phone: d.phone, email: d.email, firstName: first(d.customer) };
    }
    case "tr-enquiries":
      return { kind: "Transfer request on WhatsApp", headline: [d.route, d.vehicle].filter(Boolean).join(", "), ref: d.ref,
        rows: [["When", d.when], ["Guests", d.guests], ["Pickup and drop-off", d.place], ["Total shown", d.total], ["Message", d.message]],
        note: "They were sent to WhatsApp to confirm. Nothing was charged." };
    case "groups": {
      const lines = briefLines(d);
      const rows = lines.filter(([k]) => k !== "Enquiry");
      const rooms = ["r_double", "r_single", "r_triple", "r_quad"].reduce((t, k) => t + (Number(d[k]) || 0), 0);
      const due = workingDaysAfter(d._created, rooms > 20 ? 5 : 1);
      const asked = d.quote_by ? new Date(d.quote_by + "T12:00:00Z") : null;
      const todo = asked && !isNaN(asked) && asked < due.date ? `Send the quote by ${nice(d.quote_by)}, the date they asked for` : `Send the quote by ${due.label}${rooms > 20 ? " (over 20 rooms, five working days)" : ""}`;
      return { kind: "Group quote request", headline: (lines.find(([k]) => k === "Enquiry") || [, "Group enquiry"])[1], who: d.name, ref: d.ref,
        rows: [...rows, ["Phone", d.phone], ["Email", d.email], ["Based in", d.based]], todo,
        phone: d.phone, email: d.email, firstName: first(d.name),
        note: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email || "") ? "They've been emailed a copy of this brief with their reference." : "" };
    }
    case "jamaica": {
      const lines = briefLines({ ...d, branch: "jamaica", lang: "en" });
      const rows = lines.filter(([k]) => k !== "Enquiry");
      if (d.notes && !rows.some(([k]) => k === "Notes")) rows.push(["Notes", d.notes]);
      return { kind: "Jamaica trip request", headline: (lines.find(([k]) => k === "Enquiry") || [, "Coming to Jamaica"])[1], who: d.name, ref: d.ref,
        rows: [...rows, ["Phone", d.phone], ["Email", d.email]], todo: "Reply with their price, on WhatsApp or by email",
        phone: d.phone, email: d.email, firstName: first(d.name),
        note: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email || "") ? `They've been emailed a copy with their reference${d.lang === "es" ? ", in Spanish" : ""}.` : "" };
    }
    case "tour-partners":
      return { kind: "New tour partner", headline: d.business || "A tour operator sent their details", who: d.name, ref: d.ref,
        rows: [["Runs", d.offers], ["Where", d.areas], ["Their tours", d.tours], ["Hotel pickup", d.pickup], ["TPDCo licence", d.tpdco], ["Insurance", d.insurance], ["Works with agents", d.rates], ["Booking system", d.system], ["Website", d.website], ["Phone", d.phone], ["Email", d.email]],
        todo: "Reply to set up their listing", phone: d.phone, email: d.email, firstName: first(d.name), mailSubject: `Listing ${d.business || "your tours"} on Golden Experiences` };
    case "exp-alerts":
      return { kind: "Needs attention", loud: true, headline: d.error || "A booking needs a look", ref: d.ref,
        rows: [["Tour", [d.venue, d.product].filter(Boolean).join(", ")], ["When", d.when], ["Guest", d.customer], ["Total", d.total]] };
    default: {
      const skip = new Set(["bot-field", "form-name", "ip", "user_agent", "referrer", "subject", "ref", "form", "_created", "where"]);
      const rows = Object.entries(d).filter(([k, v]) => !skip.has(k) && String(v ?? "").trim() !== "").map(([k, v]) => [k.replace(/[_-]+/g, " ").replace(/^./, (c) => c.toUpperCase()), v]);
      return { kind: `Form: ${form}`, headline: d.subject || `New ${form} submission`, who: d.name, ref: d.ref, rows, phone: d.phone, email: d.email, firstName: first(d.name) };
    }
  }
}

/* a WhatsApp request on a tour or transfer page is logged twice (the request form and the tap log); email it once */
export const isDuplicateTap = (payload) => payload.form_name === "wa-exits" && ["exp-panel", "tr-picker", "tr-checkout"].includes((payload.data || {}).where);

export function teamEmail(payload, opts = {}) {
  const form = payload.form_name, d = { ...(payload.data || {}), form, _created: payload.created_at };
  if (form === "groups" && !d.where) d.where = "groups-form";
  const c = opts.card || build(form, d);
  if (!c) return null;
  const when = jmTime(payload.created_at);
  const rows = (c.rows || []).filter(([, v]) => String(v ?? "").trim() !== "");
  const src = form === "wa-exits" || d.page || d.where ? sourceLine(d) : "";
  const pl = c.phone ? phoneLinks(c.phone) : null;
  const buttons = [
    pl ? [`WhatsApp ${c.firstName || ""}`.trim(), pl.wa, true] : null,
    pl ? ["Call", pl.tel, false] : null,
    c.email ? ["Email", `mailto:${c.email}?subject=${encodeURIComponent(c.mailSubject || `${form === "groups" ? "Your group quote" : "Your booking"} ${c.ref || ""}`.trim())}`, false] : null,
  ].filter(Boolean);
  const netlify = payload.site_name && payload.form_id ? `https://app.netlify.com/sites/${payload.site_name}/forms/${payload.form_id}` : "";
  const band = c.loud ? `background:${GOLD};color:${INK}` : `background:${INK};color:${GOLD}`;
  const html = `<!doctype html><html><body style="margin:0;padding:0;background:${ALT}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${ALT};padding:24px 10px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;font-family:Archivo,'Helvetica Neue',Helvetica,Arial,sans-serif;color:${INK}">
<tr><td style="${band};padding:13px 22px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="font-size:14px;font-weight:800;${c.loud ? `color:${INK}` : `color:${GOLD}`}">${esc(c.kind)}</td>
<td align="right" style="font-size:13px;${c.loud ? `color:${INK}` : "color:#BDBFB8"}">${esc(when)}</td></tr></table></td></tr>
<tr><td style="padding:22px 22px 4px">
<div style="font-size:22px;line-height:1.25;font-weight:800">${esc(c.headline)}</div>
${c.who || c.ref ? `<div style="margin-top:10px;font-size:15px;color:${MUTED}">${c.who ? `<span style="color:${INK};font-weight:700">${esc(c.who)}</span>&nbsp;&nbsp;` : ""}${c.ref ? `<span style="display:inline-block;background:${GOLD};color:${INK};font-weight:700;font-size:13px;padding:3px 10px;border-radius:999px">${esc(c.ref)}</span>` : ""}</div>` : ""}
</td></tr>
${c.todo ? `<tr><td style="padding:14px 22px 0"><div style="background:${ALT};border-left:4px solid ${GOLD};padding:10px 14px;font-size:15px;font-weight:700">Next: ${esc(c.todo)}</div></td></tr>` : ""}
${rows.length ? `<tr><td style="padding:12px 22px 4px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:15px;line-height:1.4">
${rows.map(([k, v]) => `<tr><td style="padding:9px 12px 9px 0;border-top:1px solid ${LINE};color:${MUTED};width:32%;vertical-align:top">${esc(k)}</td><td style="padding:9px 0;border-top:1px solid ${LINE};vertical-align:top">${esc(v).replace(/\n/g, "<br>")}</td></tr>`).join("\n")}
</table></td></tr>` : ""}
${buttons.length ? `<tr><td style="padding:14px 22px 4px">${buttons.map(([t, href, main]) => `<a href="${esc(href)}" style="display:inline-block;${main ? `background:${INK};color:#ffffff` : `background:${ALT};color:${INK}`};text-decoration:none;font-weight:700;font-size:14px;padding:10px 16px;border-radius:999px;margin:0 6px 6px 0">${esc(t)}</a>`).join("")}</td></tr>` : ""}
${c.note ? `<tr><td style="padding:10px 22px 0;font-size:14px;color:${MUTED}">${esc(c.note)}</td></tr>` : ""}
<tr><td style="padding:16px 22px 20px"><div style="border-top:1px solid ${LINE};padding-top:12px;font-size:13px;color:${MUTED}">${src ? `${esc(src)}.` : ""}${netlify ? ` <a href="${esc(netlify)}" style="color:${GOLD_TXT}">See it in Netlify</a>` : ""}</div></td></tr>
</table></td></tr></table></body></html>`;
  const text = [`${c.kind} · ${when}`, "", c.headline, [c.who, c.ref].filter(Boolean).join("  "), c.todo ? `Next: ${c.todo}` : "", "",
    ...rows.map(([k, v]) => `${k}: ${v}`), "", c.note || "", src ? `${src}.` : "", netlify].filter((l, i, a) => l !== "" || (a[i - 1] !== "" && i > 0)).join("\n").trim();
  const subjectCore = c.headline.length > 70 ? c.headline.slice(0, 67).trim() + "..." : c.headline;
  const subject = `${c.subject || `${c.kind}: ${subjectCore}`}${c.who ? ` · ${c.who}` : ""}${c.ref ? ` · ${c.ref}` : ""}`;
  return { subject, html, text, replyTo: c.email || "" };
}

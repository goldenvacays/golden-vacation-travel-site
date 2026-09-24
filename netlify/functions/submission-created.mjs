/* Netlify runs a function named submission-created after every form submission.
   For the "groups" form this sends the guest a confirmation with their reference and the brief we received,
   and sends the team a copy laid out for quoting. Netlify's own notification still goes out as configured.

   Needs, in Netlify env:
     RESEND_API_KEY   an API key from resend.com (the sending domain goldenvacays.com must be verified there)
     GROUPS_FROM      the sender, e.g. "Golden Vacation & Travel <groups@goldenvacays.com>"  (default below)
     GROUPS_REPLY_TO  where guest replies go, e.g. goldentravellers@outlook.com                (default below)
     GROUPS_NOTIFY    optional: an address that gets the team copy (leave unset to rely on Netlify's notification)
   Without RESEND_API_KEY the function logs and does nothing, so the form keeps working. */

const FROM = process.env.GROUPS_FROM || "Golden Vacation & Travel <groups@goldenvacays.com>";
const REPLY_TO = process.env.GROUPS_REPLY_TO || "goldentravellers@outlook.com";
const NOTIFY = process.env.GROUPS_NOTIFY || "";
const TURNAROUND = process.env.GROUPS_TURNAROUND || "one working day";
const SITE = process.env.URL || "https://goldenvacays.com";

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const nice = (d) => { if (!d) return ""; const t = new Date(d + "T00:00:00"); return isNaN(t) ? d : t.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); };

/* the brief, in the order a quote is built, only the rows that were filled */
function briefLines(f) {
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
    if (f.airport) L.push(["Flying from", f.airport]);
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

function guestEmail(f) {
  const ref = f.ref || "";
  const lines = briefLines(f);
  const text = [
    `Hi ${f.name || "there"},`,
    ``,
    `We have your group enquiry. Your reference is ${ref}.`,
    `Your quote lands by email within ${TURNAROUND}, with the price, the deposit and the payment plan, written so you can forward it to your group.`,
    ``,
    `What you told us:`,
    ...lines.map(([k, v]) => `  ${k}: ${v}`),
    ``,
    `Spotted a mistake? Reply to this email with your reference and we fix it before quoting.`,
    ``,
    `Golden Vacation & Travel`,
    `Offices in Jamaica and Florida. IATA-accredited.`,
    `Call 876 817 3467`,
  ].join("\n");
  const html = `<div style="font-family:Archivo,Helvetica,Arial,sans-serif;color:#0E0F0E;max-width:560px;line-height:1.5">
  <p style="font-size:16px">Hi ${esc(f.name || "there")},</p>
  <p style="font-size:16px">We have your group enquiry. Your reference is <b style="background:#F2B93B;padding:2px 8px;border-radius:999px">${esc(ref)}</b>.</p>
  <p style="font-size:16px">Your quote lands by email within ${esc(TURNAROUND)}, with the price, the deposit and the payment plan, written so you can forward it to your group.</p>
  <p style="font-size:13px;font-weight:700;color:#A87A12;margin:24px 0 6px">WHAT YOU TOLD US</p>
  <table style="border-collapse:collapse;font-size:15px">${lines.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;font-weight:700;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:4px 0;color:#3C403A">${esc(v)}</td></tr>`).join("")}</table>
  <p style="font-size:14px;color:#5A5F57;margin-top:24px">Spotted a mistake? Reply to this email with your reference and we fix it before quoting.</p>
  <p style="font-size:14px;margin-top:24px"><b>Golden Vacation &amp; Travel</b><br>Offices in Jamaica and Florida. IATA-accredited.<br>Call 876 817 3467 · <a href="${SITE}/groups/" style="color:#A87A12">${SITE.replace(/^https?:\/\//, "")}/groups</a></p>
</div>`;
  return { subject: `Your group enquiry ${ref}: quote within ${TURNAROUND}`, text, html };
}

function teamEmail(f) {
  const lines = briefLines(f);
  const text = [
    `${f.subject || "Group quote"}`,
    ``,
    ...lines.map(([k, v]) => `${k}: ${v}`),
    ``,
    `Name: ${f.name || ""}`,
    `Email: ${f.email || ""}`,
    `Phone: ${f.phone || ""}`,
    f.based ? `Based: ${f.based}` : "",
    `Currency shown: ${f.currency || "US$"}`,
  ].filter((l) => l !== "").join("\n");
  return { subject: f.subject || `Group quote · ${f.ref || ""}`, text, html: `<pre style="font-family:Archivo,Helvetica,Arial,sans-serif;font-size:15px;white-space:pre-wrap">${esc(text)}</pre>` };
}

async function send(key, msg) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(msg),
  });
  if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
  return res.json();
}

export const handler = async (event) => {
  let payload;
  try { payload = JSON.parse(event.body || "{}").payload || {}; } catch (e) { return { statusCode: 400, body: "bad payload" }; }
  if (payload.form_name !== "groups") return { statusCode: 200, body: "ignored" };
  const f = payload.data || {};
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.log("groups submission", f.ref, "no RESEND_API_KEY, no confirmation sent"); return { statusCode: 200, body: "no sender configured" }; }
  const jobs = [];
  if (f.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) {
    const g = guestEmail(f);
    jobs.push(send(key, { from: FROM, to: [f.email], reply_to: REPLY_TO, subject: g.subject, text: g.text, html: g.html }));
  }
  if (NOTIFY) {
    const t = teamEmail(f);
    jobs.push(send(key, { from: FROM, to: [NOTIFY], reply_to: f.email || REPLY_TO, subject: t.subject, text: t.text, html: t.html }));
  }
  const results = await Promise.allSettled(jobs);
  results.forEach((r) => { if (r.status === "rejected") console.error("groups email", r.reason && r.reason.message); });
  return { statusCode: 200, body: "ok" };
};

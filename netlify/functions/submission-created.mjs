/* Netlify runs a function named submission-created after every verified form submission.
   Every form: the team gets one readable email (layout in _notify.mjs) at FORMS_NOTIFY.
   The "groups" form also: the guest gets a confirmation with their reference and the brief we received.
   The "jamaica" form (Coming to Jamaica pages): the guest gets a confirmation in English or Spanish, with a GV-JAM reference.
   Netlify's own notification still goes out as configured until it is switched off in the Netlify UI.

   Needs, in Netlify env:
     RESEND_API_KEY   an API key from resend.com (the sending domain goldenvacays.com is verified there)
     FORMS_NOTIFY     where team emails go; several addresses allowed, comma separated (falls back to GROUPS_NOTIFY, then goldentravellers@outlook.com)
     FORMS_FROM       optional sender for team emails (default below)
     GROUPS_FROM      optional sender for the group confirmation (default below)
     GROUPS_REPLY_TO  where guest replies go (default below)
   Without RESEND_API_KEY the function logs and does nothing, so the forms keep working. */

import { teamEmail, isDuplicateTap, briefLines, nice, esc, notifyList } from "./_notify.mjs";

const FROM = process.env.GROUPS_FROM || "Golden Vacation & Travel <groups@goldenvacays.com>";
const TEAM_FROM = process.env.FORMS_FROM || "Golden Vacation website <website@goldenvacays.com>";
const REPLY_TO = process.env.GROUPS_REPLY_TO || "goldentravellers@outlook.com";
const NOTIFY = notifyList();
const TURNAROUND = process.env.GROUPS_TURNAROUND || "one working day";
const SITE = process.env.URL || "https://goldenvacays.com";

function jamaicaEmail(f) {
  const ref = f.ref || "", es = f.lang === "es";
  const lines = briefLines(f);
  const T = es
    ? { hi: `Hola ${f.name || ""},`, got: `Recibimos tu solicitud de viaje a Jamaica. Tu número de referencia es ${ref}.`, reply: "Te respondemos en horario de oficina con tu precio, por WhatsApp o por correo.", told: "Lo que nos contaste:", fix: "¿Ves un error? Responde a este correo con tu referencia y lo corregimos antes de cotizar.", sign: "Oficinas en Jamaica y Florida. Acreditados por IATA.", subject: `Tu solicitud de viaje a Jamaica ${ref}` }
    : { hi: `Hi ${f.name || "there"},`, got: `We have your Jamaica trip request. Your reference is ${ref}.`, reply: "We reply within working hours with your price, on WhatsApp or by email.", told: "What you told us:", fix: "Spotted a mistake? Reply to this email with your reference and we fix it before quoting.", sign: "Offices in Jamaica and Florida. IATA-accredited.", subject: `Your Jamaica trip request ${ref}` };
  const people = [f.adults ? `${f.adults} ${es ? (f.adults == 1 ? "adulto" : "adultos") : f.adults == 1 ? "adult" : "adults"}` : "", Number(f.children) ? `${f.children} ${es ? (f.children == 1 ? "niño" : "niños") : f.children == 1 ? "child" : "children"}${f.child_ages ? ` (${f.child_ages})` : ""}` : ""].filter(Boolean).join(", ");
  const rows = lines.map(([k, v]) => (k === "People" ? [es ? "Quién viaja" : "People", people] : [k, v]));
  const text = [T.hi, "", T.got, T.reply, "", T.told, ...rows.map(([k, v]) => `  ${k}: ${v}`), "", T.fix, "", "Golden Vacation & Travel", T.sign, `${es ? "Llama al" : "Call"} 876 817 3467`].join("\n");
  const html = `<div style="font-family:Archivo,Helvetica,Arial,sans-serif;color:#0E0F0E;max-width:560px;line-height:1.5">
  <p style="font-size:16px">${esc(T.hi)}</p>
  <p style="font-size:16px">${esc(T.got).replace(esc(ref), `<b style="background:#F2B93B;padding:2px 8px;border-radius:999px">${esc(ref)}</b>`)}</p>
  <p style="font-size:16px">${esc(T.reply)}</p>
  <p style="font-size:13px;font-weight:700;color:#A87A12;margin:24px 0 6px">${esc(T.told.replace(/:$/, "").toUpperCase())}</p>
  <table style="border-collapse:collapse;font-size:15px">${rows.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;font-weight:700;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:4px 0;color:#3C403A">${esc(v)}</td></tr>`).join("")}</table>
  <p style="font-size:14px;color:#5A5F57;margin-top:24px">${esc(T.fix)}</p>
  <p style="font-size:14px;margin-top:24px"><b>Golden Vacation &amp; Travel</b><br>${esc(T.sign)}<br>${es ? "Llama al" : "Call"} 876 817 3467 · <a href="${SITE}${es ? "/jamaica/es/" : "/jamaica/"}" style="color:#A87A12">${SITE.replace(/^https?:\/\//, "")}${es ? "/jamaica/es" : "/jamaica"}</a></p>
</div>`;
  return { subject: T.subject, text, html };
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
  const form = payload.form_name, f = payload.data || {};
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.log(form, f.ref, "no RESEND_API_KEY, no emails sent"); return { statusCode: 200, body: "no sender configured" }; }
  /* the Jamaica pages send GV-JAM-USA, GV-JAM-HOME, GV-JAM-ES or GV-JAM-UKCA; each request gets its own number on the end */
  if (form === "jamaica") { f.branch = "jamaica"; f.ref = `${f.ref || "GV-JAM"}-${String(payload.number || Date.now()).slice(-4)}`; }
  const jobs = [];
  if (form === "jamaica" && f.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) {
    const g = jamaicaEmail(f);
    jobs.push(send(key, { from: FROM, to: [f.email], reply_to: REPLY_TO, subject: g.subject, text: g.text, html: g.html }));
  }
  if (form === "groups" && f.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) {
    const g = guestEmail(f);
    jobs.push(send(key, { from: FROM, to: [f.email], reply_to: REPLY_TO, subject: g.subject, text: g.text, html: g.html }));
  }
  if (form === "tour-partners" && f.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) {
    const who = f.name ? f.name.split(" ")[0] : "there", biz = f.business || "your business";
    const text = [`Hi ${who},`, "", `Thanks for sending the details of ${biz}. Your reference is ${f.ref || ""}.`,
      "Our team will be in touch on WhatsApp or by email about listing your tours on Golden Experiences.", "",
      "Golden Vacation & Travel", "IATA-accredited, offices in Jamaica and Florida.", "Call 876 817 3467"].join("\n");
    const html = `<div style="font-family:Archivo,Helvetica,Arial,sans-serif;color:#0E0F0E;max-width:560px;line-height:1.5;font-size:16px"><p>Hi ${esc(who)},</p><p>Thanks for sending the details of ${esc(biz)}. Your reference is <b style="background:#F2B93B;padding:2px 8px;border-radius:999px">${esc(f.ref || "")}</b>.</p><p>Our team will be in touch on WhatsApp or by email about listing your tours on Golden Experiences.</p><p style="font-size:14px;margin-top:24px"><b>Golden Vacation &amp; Travel</b><br>IATA-accredited, offices in Jamaica and Florida.<br>Call 876 817 3467</p></div>`;
    jobs.push(send(key, { from: process.env.PARTNERS_FROM || "Golden Experiences <experiences@goldenvacays.com>", to: [f.email], reply_to: REPLY_TO, subject: `We have your details: ${biz} (${f.ref || ""})`, text, html }));
  }
  if (NOTIFY.length && !isDuplicateTap(payload)) {
    const t = teamEmail(payload);
    if (t) jobs.push(send(key, { from: TEAM_FROM, to: NOTIFY, reply_to: t.replyTo || REPLY_TO, subject: t.subject, text: t.text, html: t.html }));
  }
  const results = await Promise.allSettled(jobs);
  results.forEach((r) => { if (r.status === "rejected") console.error(form, "email", r.reason && r.reason.message); });
  console.log(form, f.ref || "", `emails sent ${results.filter((r) => r.status === "fulfilled").length} of ${jobs.length}`);
  return { statusCode: 200, body: "ok" };
};

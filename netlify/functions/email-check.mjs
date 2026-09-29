/* GET /.netlify/functions/email-check
   Reports which email settings the functions can see (names only, never values) and where team emails go.
   With ?send=1&t=<EMAIL_CHECK_TOKEN> it also sends one sample lead through the same layout and sender and
   returns Resend's answer, so the setup can be checked end to end without reading any keys. */
import { teamEmail, notifyList } from "./_notify.mjs";

const json = (status, body) => ({ statusCode: status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(body) });
const NAMES = ["RESEND_API_KEY", "FORMS_NOTIFY", "GROUPS_NOTIFY", "FORMS_FROM", "EMAIL_CHECK_TOKEN", "STRIPE_SECRET_KEY"];

export const handler = async (event) => {
  const q = event.queryStringParameters || {};
  const to = notifyList();
  const report = { settingsVisible: Object.fromEntries(NAMES.map((n) => [n, Boolean(process.env[n])])), recipients: to.length, context: process.env.CONTEXT || "" };
  const want = process.env.EMAIL_CHECK_TOKEN;
  if (!(q.send && want && q.t === want)) return json(200, report);
  const key = process.env.RESEND_API_KEY;
  if (!key) return json(200, { ...report, sent: false });
  const from = process.env.FORMS_FROM || "Golden Vacation website <website@goldenvacays.com>";
  const t = teamEmail({ form_name: "wa-exits", created_at: new Date().toISOString(), data: { visit: "TEST", ref: "GV-TEST-0002", page: "/", where: "nav",
    context: "Hi Golden Vacation! This is a test of the new lead emails. You can ignore it.\nDates: flexible\nTravellers: 2 adults\nRef GV-TEST-0002" } });
  try {
    const res = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject: t.subject, html: t.html, text: t.text }) });
    return json(200, { ...report, sent: res.ok, resendStatus: res.status, resend: (await res.text()).slice(0, 300) });
  } catch (e) {
    return json(200, { ...report, sent: false, error: String(e && e.message).slice(0, 200) });
  }
};

/* GET /.netlify/functions/email-check?t=<EMAIL_CHECK_TOKEN>
   Sends one sample lead email to FORMS_NOTIFY through the same layout and sender as submission-created,
   and reports what happened (whether the Resend key is present, how many recipients, Resend's answer),
   so the email setup can be checked without reading any keys. Answers 404 without the right token. */
import { teamEmail } from "./_notify.mjs";

const json = (status, body) => ({ statusCode: status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }, body: JSON.stringify(body) });

export const handler = async (event) => {
  const want = process.env.EMAIL_CHECK_TOKEN;
  if (!want || (event.queryStringParameters || {}).t !== want) return { statusCode: 404, body: "Not found" };
  const key = process.env.RESEND_API_KEY;
  const to = (process.env.FORMS_NOTIFY || process.env.GROUPS_NOTIFY || "").split(",").map((s) => s.trim()).filter(Boolean);
  const from = process.env.FORMS_FROM || "Golden Vacation website <website@goldenvacays.com>";
  const out = { resendKeyPresent: Boolean(key), recipients: to.length, from };
  if (!key || !to.length) return json(200, { ...out, sent: false });
  const t = teamEmail({ form_name: "wa-exits", created_at: new Date().toISOString(), data: { visit: "TEST", ref: "GV-TEST-0002", page: "/", where: "nav",
    context: "Hi Golden Vacation! This is a test of the new lead emails. You can ignore it.\nDates: flexible\nTravellers: 2 adults\nRef GV-TEST-0002" } });
  try {
    const res = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject: t.subject, html: t.html, text: t.text }) });
    const body = await res.text();
    return json(200, { ...out, sent: res.ok, resendStatus: res.status, resend: body.slice(0, 300) });
  } catch (e) {
    return json(200, { ...out, sent: false, error: String(e && e.message).slice(0, 200) });
  }
};

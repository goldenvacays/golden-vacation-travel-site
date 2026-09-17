/* Golden Vacation & Travel — the bits of chrome every page needs: the US$/J$ switch, the mobile menu, and
   WhatsApp click tracking. The same behaviour as getaways.js and home.js, without the page-specific code
   those two carry. Pages that load either of those already have all of this; the transfers pages load only
   this, so they aren't pulling the Getaways quote form and the front page's feature card to show a checkout. */
(function () {
  "use strict";
  var CFG = window.GV_CONFIG || {};
  var RATE = CFG.jmdRate || 160;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function track(name, params) {
    try { if (typeof window.gtag === "function") window.gtag("event", name, params || {}); } catch (e) {}
    try { if (typeof window.plausible === "function") window.plausible(name, { props: params || {} }); } catch (e) {}
  }
  function store(k, v) {
    try { if (v === undefined) return window.localStorage.getItem(k); window.localStorage.setItem(k, v); } catch (e) {}
    return null;
  }

  /* ---- currency ---- */
  function setCurrency(c, save) {
    document.body.classList.toggle("jmd", c === "JMD");
    $$(".curr button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-c") === c); });
    if (save) store("gv_currency", c);
  }
  $$(".curr button").forEach(function (b) {
    b.addEventListener("click", function () { setCurrency(b.getAttribute("data-c"), true); track("currency_toggle", { currency: b.getAttribute("data-c") }); });
  });
  var savedC = store("gv_currency");
  if (savedC === "JMD" || savedC === "USD") setCurrency(savedC, false);
  window.GV_RATE = RATE;

  /* ---- mobile menu ---- */
  var menuBtn = $(".menu-btn"), menu = $(".menu");
  if (menuBtn && menu) {
    menuBtn.addEventListener("click", function () {
      var open = !menu.classList.contains("open");
      menu.classList.toggle("open", open);
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    $$("a", menu).forEach(function (a) { a.addEventListener("click", function () { menu.classList.remove("open"); menuBtn.setAttribute("aria-expanded", "false"); }); });
  }

  /* ---- WhatsApp exits: one code per visit, one row per exit --------------------------------
     Kept identical in chrome.js and getaways.js; between them they cover every page that has a
     WhatsApp link. The visit code is made once per visit and appended to the static Ref labels
     the builders bake in, so a message that lands reads "Ref GV-WEB-A7K2" and there is a row in
     the wa-exits form to match it against. Links whose code is built in the browser (the quote
     form, the checkout, the booked page) keep their own and are skipped here; their own handlers
     log the visit alongside it. */
  var WA_OWN = { "q-send": 1, "ck-wa": 1, "bk-wa": 1 };
  var VISIT = (function () {
    var k = "gv_visit", v = null;
    try { v = sessionStorage.getItem(k); } catch (e) {}
    if (!/^[A-Z0-9]{4}$/.test(v || "")) {
      var s = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; /* no I, O, 0 or 1: these get read out over the phone */
      v = "";
      for (var i = 0; i < 4; i++) v += s.charAt(Math.floor(Math.random() * s.length));
      try { sessionStorage.setItem(k, v); } catch (e) {}
    }
    return v;
  })();
  window.GV_VISIT = VISIT;

  function waRef(text) { var m = /Ref (GV-[A-Z0-9-]+)/.exec(text || ""); return m ? m[1] : ""; }

  /* one row per exit. sendBeacon survives the tab going away; fetch with keepalive is the fallback.
     No name, no email, no phone: a code, a page and a time, so this needs nothing from the privacy page. */
  function waExit(d) {
    d = d || {};
    var body = new URLSearchParams({ "form-name": "wa-exits", visit: VISIT, ref: d.ref || "", page: location.pathname,
      where: d.where || "", total: d.total || "", context: String(d.context || "").slice(0, 400) }).toString();
    try {
      if (navigator.sendBeacon && navigator.sendBeacon("/", new Blob([body], { type: "application/x-www-form-urlencoded" }))) return;
    } catch (e) {}
    try { fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body, keepalive: true }).catch(function () {}); } catch (e) {}
  }
  window.GV_WA_EXIT = waExit;

  function waBind() {
    $$('a[href^="https://wa.me/"]').forEach(function (a) {
      if (a.getAttribute("data-wa") || WA_OWN[a.id]) return;
      a.setAttribute("data-wa", "1");
      try {
        var u = new URL(a.getAttribute("href") || "", location.href), t = u.searchParams.get("text") || "", r = waRef(t);
        if (r && r.slice(-5) !== "-" + VISIT) { u.searchParams.set("text", t.replace("Ref " + r, "Ref " + r + "-" + VISIT)); a.setAttribute("href", u.toString()); }
      } catch (e) {}
      a.addEventListener("click", function () {
        var t = "", where = a.getAttribute("data-where") || "";
        try { t = new URL(a.getAttribute("href"), location.href).searchParams.get("text") || ""; } catch (e) {}
        track("whatsapp_click", { where: where || location.pathname, visit: VISIT });
        waExit({ ref: waRef(t), where: where, context: t });
      });
    });
  }
  waBind();
  /* links the page writes after load: the hotel pickers, the booking panel, the checkout aside.
     Coalesced to one pass per frame, because the checkout re-renders on every keystroke. */
  if (window.MutationObserver && !window.GV_WA_OBS) {
    var queued = false;
    window.GV_WA_OBS = new MutationObserver(function () {
      if (queued) return;
      queued = true;
      setTimeout(function () { queued = false; waBind(); }, 0);
    });
    window.GV_WA_OBS.observe(document.documentElement, { childList: true, subtree: true });
  }
})();

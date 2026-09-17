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

  /* ---- outbound WhatsApp clicks anywhere ---- */
  $$('a[href^="https://wa.me/"]').forEach(function (a) {
    a.addEventListener("click", function () { track("whatsapp_click", { where: a.getAttribute("data-where") || location.pathname }); });
  });
})();

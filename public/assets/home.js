/* Golden Vacation & Travel — front page. Runs after /getaways/assets/getaways.js (currency toggle, WhatsApp click tracking). */
(function () {
  "use strict";
  var CFG = window.GV_HOME || {};
  var WA = CFG.whatsapp || "18763601567";
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function track(name, params) {
    try { if (typeof window.gtag === "function") window.gtag("event", name, params || {}); } catch (e) {}
    try { if (typeof window.plausible === "function") window.plausible(name, { props: params || {} }); } catch (e) {}
  }

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

  /* ---- quick quote: four modes, one form ---- */
  var form = $("#home-quote");
  if (form && CFG.modes) {
    var modes = CFG.modes, mode = modes[0];
    var whereSel = $("#hq-where"), whereLbl = $("#hq-where-label"), whenIn = $("#hq-when"), whoSel = $("#hq-who");
    function setMode(key) {
      mode = modes.filter(function (m) { return m.key === key; })[0] || modes[0];
      $$("[data-mode]").forEach(function (c) { c.setAttribute("aria-pressed", c.getAttribute("data-mode") === mode.key ? "true" : "false"); });
      whereLbl.textContent = mode.whereLabel;
      whereSel.innerHTML = "";
      mode.options.forEach(function (o) { var op = document.createElement("option"); op.value = o[0]; op.textContent = o[1]; whereSel.appendChild(op); });
      track("quote_mode", { mode: mode.key });
    }
    $$("[data-mode]").forEach(function (c) { c.addEventListener("click", function () { setMode(c.getAttribute("data-mode")); }); });
    setMode(modes[0].key);
    function fmtDate(s) {
      if (!s) return "";
      var p = s.split("-"); if (p.length !== 3) return s;
      var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
      return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
    }
    form.addEventListener("submit", function (e) {
      var where = whereSel.value, whereText = whereSel.options[whereSel.selectedIndex] ? whereSel.options[whereSel.selectedIndex].textContent : "";
      var when = whenIn.value, who = whoSel.value;
      if (mode.key === "getaways") {
        // hand over to the Getaways quote page with the choices filled in
        e.preventDefault();
        var u = "/getaways/quote/?d=" + encodeURIComponent(where) + "&who=" + encodeURIComponent(who) + (when ? "&from=" + encodeURIComponent(when) : "");
        track("quote_start", { where: "home", mode: "getaways", dest: where || "other" });
        window.location.href = u;
        return;
      }
      e.preventDefault();
      var ref = "GV-" + mode.code + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
      var lines = [];
      if (mode.key === "coming") lines.push("Hi Golden Vacation! I'm coming to Jamaica from " + (where === "home" ? "abroad, coming home for a visit" : where === "other" ? "overseas" : whereText.replace(/^The /, "the ")) + " and I'd like a quote.");
      if (mode.key === "staycation") lines.push("Hi Golden Vacation! I'd like a staycation quote, " + (where === "Anywhere" ? "anywhere in Jamaica, best value" : where) + ", priced in J$.");
      if (mode.key === "tours") lines.push("Hi Golden Vacation! I'd like to plan a day out in Jamaica: " + whereText.toLowerCase() + ".");
      lines.push("Dates: " + (when ? fmtDate(when) : "flexible"));
      lines.push("Travellers: " + who);
      lines.push("Ref " + ref);
      track("quote_send", { where: "home", mode: mode.key, pick: where, code: ref });
      window.open("https://wa.me/" + WA + "?text=" + encodeURIComponent(lines.join("\n")), "_blank", "noopener");
    });
    var today = new Date().toISOString().slice(0, 10);
    if (whenIn) whenIn.min = today;
  }

  /* ---- time-limited feature card (Heroes Weekend) ---- */
  $$("[data-until]").forEach(function (el) {
    var until = el.getAttribute("data-until");
    if (until && new Date().toISOString().slice(0, 10) > until) {
      el.hidden = true;
      var grid = el.parentElement; if (grid) grid.classList.add("no-feature");
    }
  });
})();

/* Golden Vacation & Travel — Getaways. Small, dependency-free. */
(function () {
  "use strict";
  var CFG = window.GV_CONFIG || {};
  var RATE = CFG.jmdRate || 160;
  var WA = CFG.whatsapp || "18763601567";

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function usd(n) { return "US$" + fmt(n); }
  function jmd(n) { return "≈ J$" + fmt(n * RATE); }
  function track(name, params) {
    try { if (typeof window.gtag === "function") window.gtag("event", name, params || {}); } catch (e) {}
    try { if (typeof window.plausible === "function") window.plausible(name, { props: params || {} }); } catch (e) {}
  }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

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

  /* ---- price element: writes both currencies ---- */
  function setPrice(el, n) {
    if (!el) return;
    var u = $(".usd-v", el), j = $(".jmd-v", el);
    if (u) u.textContent = usd(n);
    if (j) j.textContent = jmd(n);
  }

  /* ---- destination page: airport + nights switch ---- */
  var page = $("[data-dest]");
  if (page) {
    var state = { airport: page.getAttribute("data-default-airport"), nights: page.getAttribute("data-default-nights") };
    var surcharge = {};
    $$("[data-airport]", page).forEach(function (c) { surcharge[c.getAttribute("data-airport")] = Number(c.getAttribute("data-surcharge") || 0); });

    function priceFor(h, nights) {
      var prices = JSON.parse(h.getAttribute("data-prices") || "{}");
      var base = prices[nights];
      if (base == null) return null;
      return base + (surcharge[state.airport] || 0);
    }
    function repaint() {
      $$(".hotel[data-prices]", page).forEach(function (h) {
        var p = priceFor(h, state.nights);
        var lbl = $(".hotel-p .lbl", h);
        var main = $(".hotel-p .price", h);
        var note = $(".hotel-p .ask", h);
        if (p == null) {
          if (lbl) lbl.textContent = state.nights + " nights";
          if (main) { main.hidden = true; }
          if (note) { note.hidden = false; }
        } else {
          if (lbl) lbl.textContent = state.nights + " nights";
          if (main) { main.hidden = false; setPrice(main, p); }
          if (note) { note.hidden = true; }
        }
        var more = $(".hotel-p .more", h);
        if (more) {
          var prices = JSON.parse(h.getAttribute("data-prices") || "{}");
          var parts = [];
          Object.keys(prices).forEach(function (k) {
            if (k !== state.nights) parts.push(k + " nights " + usd(prices[k] + (surcharge[state.airport] || 0)));
          });
          more.textContent = parts.join(" · ");
        }
        var link = $("a.go", h) || (h.tagName === "A" ? h : null);
        if (link) link.href = quoteUrl(h.getAttribute("data-slug"));
      });
      var leadSlug = page.getAttribute("data-lead");
      var leadRow = $('.hotel[data-slug="' + leadSlug + '"]', page);
      var leadPrice = $(".lead-price .price", page);
      if (leadRow && leadPrice) {
        var lp = priceFor(leadRow, state.nights);
        var ll = $(".lead-price .lbl", page);
        if (lp != null) { setPrice(leadPrice, lp); leadPrice.hidden = false; if (ll) ll.textContent = airportName(state.airport) + " · " + state.nights + " nights"; }
      }
      $$(".lead .btn", page).forEach(function (b) { b.href = quoteUrl(leadSlug); });
      $$(".bar .btn, .dest-cta", page).forEach(function (b) { b.href = quoteUrl(leadSlug); });
    }
    function airportName(code) {
      var c = $('[data-airport="' + code + '"]', page);
      return c ? c.getAttribute("data-name") : code;
    }
    function quoteUrl(hotel) {
      var u = CFG.base + "/quote/?d=" + encodeURIComponent(page.getAttribute("data-dest")) + "&n=" + encodeURIComponent(state.nights) + "&a=" + encodeURIComponent(state.airport);
      if (hotel) u += "&h=" + encodeURIComponent(hotel);
      return u;
    }
    $$("[data-airport]", page).forEach(function (c) {
      c.addEventListener("click", function () {
        state.airport = c.getAttribute("data-airport");
        $$("[data-airport]", page).forEach(function (x) { x.setAttribute("aria-pressed", x === c ? "true" : "false"); });
        repaint(); track("airport_select", { airport: state.airport, dest: page.getAttribute("data-dest") });
      });
    });
    $$("[data-nights]", page).forEach(function (c) {
      c.addEventListener("click", function () {
        state.nights = c.getAttribute("data-nights");
        $$("[data-nights]", page).forEach(function (x) { x.setAttribute("aria-pressed", x === c ? "true" : "false"); });
        repaint(); track("nights_select", { nights: state.nights, dest: page.getAttribute("data-dest") });
      });
    });
    repaint();
  }

  /* ---- hub quote form: carry the choices to the quote page ---- */
  var hubForm = $("#hub-quote");
  if (hubForm) {
    hubForm.addEventListener("submit", function () { track("quote_start", { where: "hub" }); });
  }

  /* ---- quote page ---- */
  var q = $("#quote-form");
  if (q) {
    var DATA = window.GV_QUOTE || { destinations: [], combos: [] };
    var params = new URLSearchParams(location.search);
    var st = {
      d: params.get("d") || "", h: params.get("h") || "", n: params.get("n") || "", a: params.get("a") || "",
      adults: 2, kids: 0, budget: "Not sure", name: "", leaving: params.get("from") || "", returning: params.get("to") || "", currency: "US$"
    };
    var ref = "GV-" + Math.random().toString(36).slice(2, 6).toUpperCase();
    var who = params.get("who") || "";
    if (/^1 adult/.test(who)) st.adults = 1;
    if (/^3/.test(who)) st.adults = 3;
    if (/kids/.test(who)) st.kids = 1;
    st.other = params.get("other") || "";

    function findDest() {
      var d = null;
      DATA.destinations.forEach(function (x) { if (x.slug === st.d) d = x; });
      if (!d) DATA.combos.forEach(function (x) { if (x.slug === st.d) d = x; });
      return d;
    }
    function findHotel(d) {
      var h = null;
      if (!d || !d.hotels) return null;
      d.hotels.forEach(function (x) { if (x.slug === st.h) h = x; });
      return h;
    }
    var selDest = $("#q-dest");
    var otherIn = $("#q-other");
    function syncOther() { if (otherIn) { otherIn.closest("label").hidden = !!st.d; } }
    var selHotel = $("#q-hotel");
    var airportRow = $("#q-airports");
    var nightsRow = $("#q-nights");
    var preview = $("#wa-text");
    var refEl = $("#q-ref");
    var thumb = $("#q-thumb");
    var send = $("#q-send");
    var err = $("#q-err");

    function fillHotels() {
      var d = findDest();
      selHotel.innerHTML = "";
      if (!d || !d.hotels || !d.hotels.length) { selHotel.parentElement.hidden = true; return; }
      selHotel.parentElement.hidden = false;
      var opt0 = document.createElement("option"); opt0.value = ""; opt0.textContent = "Any hotel, you pick"; selHotel.appendChild(opt0);
      d.hotels.forEach(function (h) {
        var o = document.createElement("option"); o.value = h.slug; o.textContent = h.name; if (h.slug === st.h) o.selected = true; selHotel.appendChild(o);
      });
    }
    function fillChips() {
      var d = findDest();
      airportRow.innerHTML = ""; nightsRow.innerHTML = "";
      if (!d) { airportRow.parentElement.hidden = true; nightsRow.parentElement.hidden = true; return; }
      var aps = d.airports || [];
      airportRow.parentElement.hidden = aps.length === 0;
      if (aps.length && !aps.some(function (x) { return x.code === st.a; })) st.a = aps[0].code;
      aps.forEach(function (ap) {
        var b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.textContent = ap.name + (ap.surcharge ? " · +US$" + ap.surcharge : "");
        b.setAttribute("aria-pressed", ap.code === st.a ? "true" : "false");
        b.addEventListener("click", function () { st.a = ap.code; fillChips(); render(); });
        airportRow.appendChild(b);
      });
      var ns = d.nights || [];
      nightsRow.parentElement.hidden = ns.length === 0;
      if (ns.length && ns.indexOf(Number(st.n)) < 0) st.n = String(ns[0]);
      ns.forEach(function (n) {
        var b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.textContent = n + " nights";
        b.setAttribute("aria-pressed", String(n) === String(st.n) ? "true" : "false");
        b.addEventListener("click", function () { st.n = String(n); fillChips(); render(); });
        nightsRow.appendChild(b);
      });
      if (d.nightsAsk) {
        var ask = document.createElement("button"); ask.type = "button"; ask.className = "chip"; ask.textContent = d.nightsAsk;
        ask.setAttribute("aria-pressed", st.n === "ask" ? "true" : "false");
        ask.addEventListener("click", function () { st.n = "ask"; fillChips(); render(); });
        nightsRow.appendChild(ask);
      }
    }
    function fmtDate(s) {
      if (!s) return "";
      var p = s.split("-"); if (p.length !== 3) return s;
      var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
      return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
    }
    function message() {
      var d = findDest(), h = findHotel(d);
      var what = d ? d.name : (st.other ? st.other : "a getaway");
      if (h) what += " · " + h.name;
      if (d && d.nights && d.nights.length) what += " · " + (st.n === "ask" ? "more nights" : st.n + " nights");
      if (d && d.combo) what += " · " + d.hotelLabel;
      var lines = ["Hi Golden Vacation! I'd like a quote for " + what + "."];
      lines.push("Dates: " + (st.leaving ? fmtDate(st.leaving) : "flexible") + (st.returning ? " to " + fmtDate(st.returning) : ""));
      lines.push("Travellers: " + st.adults + " adult" + (st.adults === 1 ? "" : "s") + ", " + st.kids + " kid" + (st.kids === 1 ? "" : "s"));
      var apName = "";
      if (d && d.airports) d.airports.forEach(function (x) { if (x.code === st.a) apName = x.name + " (" + x.code + ")"; });
      if (d && d.combo) apName = d.airportName + " (" + d.airport + ")";
      if (apName) lines.push("From: " + apName);
      lines.push("Budget: " + st.budget);
      lines.push("Quote me in: " + st.currency);
      if (st.name) lines.push("Name: " + st.name);
      var code = "GV-" + (d ? d.code : "OTHER") + (h ? "-" + h.slug.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5) : "") + (st.n && st.n !== "ask" ? "-" + st.n + "N" : "") + "-" + ref.slice(3);
      lines.push("Ref " + code);
      return { text: lines.join("\n"), code: code };
    }
    function render() {
      var d = findDest(), h = findHotel(d);
      var m = message();
      preview.textContent = m.text;
      refEl.textContent = m.code;
      var url = "https://wa.me/" + WA + "?text=" + encodeURIComponent(m.text);
      send.href = url;
      send.setAttribute("data-code", m.code);
      if (thumb) {
        var img = (h && h.img) || (d && d.img) || "";
        thumb.hidden = !img;
        if (img) thumb.src = CFG.base + "/img/" + img;
      }
      var tagLine = $("#q-tag");
      if (tagLine) tagLine.textContent = (d ? d.short || d.name : "Getaway") + " · Quote";
    }
    if (selDest) {
      selDest.value = st.d;
      selDest.addEventListener("change", function () { st.d = selDest.value; st.h = ""; fillHotels(); fillChips(); syncOther(); render(); });
    }
    if (selHotel) selHotel.addEventListener("change", function () { st.h = selHotel.value; render(); });
    if (otherIn) { otherIn.value = st.other; otherIn.addEventListener("input", function () { st.other = otherIn.value.trim(); render(); }); }
    $$("[data-step]", q).forEach(function (b) {
      b.addEventListener("click", function () {
        var k = b.getAttribute("data-step"), dir = Number(b.getAttribute("data-dir"));
        st[k] = Math.max(k === "adults" ? 1 : 0, Math.min(12, st[k] + dir));
        $("#out-" + k).textContent = st[k];
        render();
      });
    });
    $$("[data-budget]", q).forEach(function (b) {
      b.addEventListener("click", function () {
        st.budget = b.getAttribute("data-budget");
        $$("[data-budget]", q).forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        render();
      });
    });
    $$("[data-cur]", q).forEach(function (b) {
      b.addEventListener("click", function () {
        st.currency = b.getAttribute("data-cur");
        $$("[data-cur]", q).forEach(function (x) { x.classList.toggle("on", x === b); });
        render();
      });
    });
    var nameIn = $("#q-name"), leaveIn = $("#q-leaving"), retIn = $("#q-returning");
    if (nameIn) nameIn.addEventListener("input", function () { st.name = nameIn.value.trim(); render(); });
    if (leaveIn) { leaveIn.value = st.leaving; leaveIn.addEventListener("change", function () { st.leaving = leaveIn.value; if (retIn && retIn.value && retIn.value < st.leaving) { retIn.value = ""; st.returning = ""; } if (retIn) retIn.min = st.leaving; render(); }); }
    if (retIn) { retIn.value = st.returning; retIn.addEventListener("change", function () { st.returning = retIn.value; render(); }); }
    var today = new Date(); var iso = today.toISOString().slice(0, 10);
    if (leaveIn) leaveIn.min = iso;
    if (retIn) retIn.min = st.leaving || iso;
    send.addEventListener("click", function (e) {
      if (!st.d && !st.other) { e.preventDefault(); err.textContent = "Tell us where you want to go first."; err.classList.add("show"); (otherIn || selDest).focus(); return; }
      err.classList.remove("show");
      track("quote_send", { dest: st.d, hotel: st.h || "any", nights: st.n, airport: st.a, code: send.getAttribute("data-code") });
    });
    $("#out-adults").textContent = st.adults; $("#out-kids").textContent = st.kids;
    fillHotels(); fillChips(); syncOther(); render();
  }

  /* ---- outbound WhatsApp clicks anywhere ---- */
  $$('a[href^="https://wa.me/"]').forEach(function (a) {
    if (a.id === "q-send") return;
    a.addEventListener("click", function () { track("whatsapp_click", { where: a.getAttribute("data-where") || location.pathname }); });
  });
})();

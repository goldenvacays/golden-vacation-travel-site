/* Airport transfers. Runs after getaways.js (currency toggle), home.js (mobile menu) and transfers-rates.js (the prices). Dependency-free.
   Search (hotel, airport, way, people, dates and flight times) -> a table of vehicles with a price each -> Choose -> the checkout page
   (/transfers/checkout: who's travelling, then Stripe's card form embedded on the page) -> the booked page.
   Prices come from window.GV_TR_RATES: one price per zone from each airport, hotel to hotel by zone pair. tr-checkout recomputes the
   price from the same data before the card form opens; anything the site can't price goes to WhatsApp instead.
   The ride travels from the search to the checkout page as a token in the URL (?b=...): the search fields, the vehicle and the
   words the guest already saw. The checkout page never re-prices from it and the function never trusts it. */
(function () {
  "use strict";
  var CFG = window.GV_CONFIG || {};
  var RATE = CFG.jmdRate || 160;
  var WA = CFG.whatsapp || "18763601567";
  var PREVIEW = !!CFG.preview;
  var FN = "/.netlify/functions/";
  var BASE = CFG.base || "/transfers";

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function usd(n) { return "US$" + fmt(n); }
  function jmdOf(n) { return "≈ J$" + fmt(Math.round((n * RATE) / 100) * 100); }
  function track(name, params) {
    try { if (typeof window.gtag === "function") window.gtag("event", name, params || {}); } catch (e) {}
    try { if (typeof window.plausible === "function") window.plausible(name, { props: params || {} }); } catch (e) {}
  }
  function newRef() { return "GV-TR-" + Math.random().toString(36).slice(2, 6).toUpperCase(); }
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function parseDate(s) { if (!s) return null; var p = s.split("-"); if (p.length !== 3) return null; return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }
  function longDate(s) { var d = parseDate(s); if (!d) return ""; return DAYS[d.getUTCDay()] + " " + d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear(); }
  function todayISO() { return (window.GV_TR && window.GV_TR.today) || new Date().toISOString().slice(0, 10); }
  function waUrl(text) { return "https://wa.me/" + WA + "?text=" + encodeURIComponent(text); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
  function session(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) { return null; } }
  var FLIGHT = /^[A-Z0-9]{2,3}\s?\d{1,4}[A-Z]?$/;
  var TIME = /^(1[0-2]|0?[1-9])(:[0-5]\d)?\s*(am|pm)$/i;
  var EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  var TOWN_ALIASES = { "montego bay": " mobay ", "ocho rios": " ochi " };
  function focusEl(f) { if (!f) return; try { f.focus({ preventScroll: true }); } catch (e) { try { f.focus(); } catch (e2) {} } }
  function scrollTo(elm) { if (elm && elm.scrollIntoView) elm.scrollIntoView({ behavior: "smooth", block: "start" }); }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  var SVG = { check: '<path d="M20 6L9 17l-5-5"></path>', users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"></path>', bag: '<path d="M6 7h12l1 14H5L6 7z"></path><path d="M9 7V5a3 3 0 0 1 6 0v2"></path>', arrow: '<path d="M5 12h14"></path><path d="M13 6l6 6-6 6"></path>', chat: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>', car: '<path d="M5 17h14M6 17l1.5-6h9L18 17M4 12h16M7 17v2M17 17v2"></path>', plane: '<path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 11l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 2.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"></path>', pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle>', person: '<circle cx="12" cy="8" r="4"></circle><path d="M4 20c0-4 3.6-6 8-6s8 2 8 6"></path>' };
  function icon(name, size) { var s = size || 16; return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;display:block">' + SVG[name] + "</svg>"; }
  /* the time boxes are native pickers: the value comes back as 24-hour "14:35"; the driver, the checkout and the function get "2:35pm" */
  function timeText(v) {
    v = String(v == null ? "" : v).trim().toLowerCase().replace(/\s+/g, "");
    var m = v.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (!m) return v; /* already "2:35pm" (a browser without a time picker falls back to a text box) */
    var h = Number(m[1]), ap = h >= 12 ? "pm" : "am";
    return (h % 12 || 12) + ":" + m[2] + ap;
  }
  /* the booking token: plain JSON, base64url, in the URL between the search and the checkout page */
  function encodeToken(o) { try { return btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); } catch (e) { return ""; } }
  function decodeToken(s) { if (!s) return null; try { var b = String(s).replace(/-/g, "+").replace(/_/g, "/"); while (b.length % 4) b += "="; var o = JSON.parse(decodeURIComponent(escape(atob(b)))); return o && typeof o === "object" ? o : null; } catch (e) { return null; } }
  function checkoutUrl(tok) { return BASE + "/checkout?b=" + tok; }
  function searchUrl(tok) { return BASE + "/?b=" + tok; }
  /* a yellow line above the thing it is about (the search button, Continue, the card form) */
  function alertBox(root, text, anchor, waFn) {
    var box = $(".tr-alert", root);
    if (box && box.nextSibling !== anchor) { box.remove(); box = null; }
    if (!box) { box = el("div", "tr-alert"); box.setAttribute("role", "alert"); anchor.parentNode.insertBefore(box, anchor); }
    box.innerHTML = ""; box.appendChild(document.createTextNode(text + " "));
    if (waFn) { var a = el("a", "", "Send by WhatsApp"); a.href = "#"; a.style.cssText = "text-decoration:underline;color:inherit;font-weight:800"; a.addEventListener("click", function (ev) { ev.preventDefault(); waFn(); }); box.appendChild(a); }
    return box;
  }
  function clearAlertIn(root) { var box = $(".tr-alert", root); if (box) box.remove(); }

  /* ---- the calendar on the date boxes (the same one the tour pages use): greys past days, keeps the departure after the arrival ---- */
  function makeCal(input, opts, cals) {
    if (!input || !("closest" in input)) return null;
    var wrap = input.closest(".pf-in"), field = input.closest(".tr-f") || wrap; if (!wrap || !field) return null;
    var host = field;
    var today = opts.today;
    input.type = "hidden";
    var btn = document.createElement("button"); btn.type = "button"; btn.className = "date-btn"; btn.setAttribute("aria-haspopup", "dialog"); btn.setAttribute("aria-expanded", "false");
    wrap.appendChild(btn); wrap.classList.add("has-cal");
    var pop = document.createElement("div"); pop.className = "cal"; pop.setAttribute("role", "dialog"); pop.setAttribute("aria-label", opts.label || "Pick a date"); pop.hidden = true;
    host.classList.add("cal-host"); host.appendChild(pop);
    var view = null;
    function iso(d) { return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0"); }
    function label() { btn.textContent = input.value ? longDate(input.value) : (opts.placeholder || "Pick a date"); btn.classList.toggle("empty", !input.value); }
    function paint() {
      var t = parseDate(today), sel = input.value ? parseDate(input.value) : null;
      if (!view) view = sel ? new Date(Date.UTC(sel.getUTCFullYear(), sel.getUTCMonth(), 1)) : new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1));
      var y = view.getUTCFullYear(), m = view.getUTCMonth(), first = new Date(Date.UTC(y, m, 1)), daysIn = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      var canBack = new Date(Date.UTC(y, m, 1)) > new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1));
      var h = '<div class="cal-head"><button type="button" class="cal-nav" data-nav="-1" aria-label="Previous month"' + (canBack ? "" : " disabled") + '>&#8249;</button><b>' + ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][m] + " " + y + '</b><button type="button" class="cal-nav" data-nav="1" aria-label="Next month">&#8250;</button></div>';
      h += '<div class="cal-grid cal-dow">' + ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(function (d) { return "<span>" + d + "</span>"; }).join("") + "</div><div class=\"cal-grid\">";
      for (var i = 0; i < first.getUTCDay(); i++) h += "<span></span>";
      for (var d = 1; d <= daysIn; d++) {
        var ds = iso(new Date(Date.UTC(y, m, d))), why = opts.problem(ds), off = !!why, isSel = sel && ds === input.value, isToday = ds === today;
        h += '<button type="button" class="cal-d' + (isSel ? " sel" : "") + (isToday ? " today" : "") + '" data-d="' + ds + '"' + (off ? ' disabled aria-disabled="true" title="' + why.replace(/"/g, "&quot;") + '"' : "") + ">" + d + "</button>";
      }
      h += "</div>";
      pop.innerHTML = h;
      $$(".cal-nav", pop).forEach(function (b) { b.addEventListener("click", function () { var nav = b.getAttribute("data-nav"); view = new Date(Date.UTC(view.getUTCFullYear(), view.getUTCMonth() + (+nav), 1)); paint(); var again = $('.cal-nav[data-nav="' + nav + '"]:not([disabled])', pop) || $(".cal-d:not([disabled])", pop); if (again) again.focus({ preventScroll: true }); }); });
      $$(".cal-d:not([disabled])", pop).forEach(function (b) { b.addEventListener("click", function () { input.value = b.getAttribute("data-d"); label(); close(); input.dispatchEvent(new Event("change", { bubbles: true })); }); });
    }
    var openedAt = 0;
    function open() { cals.forEach(function (c) { if (c !== api) c.close(); }); view = null; paint(); pop.hidden = false; openedAt = Date.now(); btn.setAttribute("aria-expanded", "true"); setTimeout(function () { var f = $(".cal-d.sel", pop) || $(".cal-d:not([disabled])", pop); if (f) f.focus({ preventScroll: true }); }, 0); }
    function close() { if (pop.hidden) return; pop.hidden = true; btn.setAttribute("aria-expanded", "false"); }
    btn.addEventListener("click", function () { if (pop.hidden) open(); else close(); });
    pop.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { e.preventDefault(); close(); btn.focus(); return; }
      var days = $$(".cal-d:not([disabled])", pop), i = days.indexOf(document.activeElement); if (i < 0) return;
      var step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 }[e.key]; if (!step) return;
      e.preventDefault(); var cur = +document.activeElement.getAttribute("data-d").slice(8), want = cur + step, next = null;
      days.forEach(function (d) { var n = +d.getAttribute("data-d").slice(8); if (step > 0 ? (n >= want && !next) : (n <= want)) next = d; });
      if (next) next.focus({ preventScroll: true });
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !pop.hidden) { close(); btn.focus(); } });
    document.addEventListener("click", function (e) { if (Date.now() - openedAt < 150) return; if (e.target && e.target.isConnected && !host.contains(e.target)) close(); });
    var api = { refresh: function () { label(); if (!pop.hidden) paint(); }, close: close, open: open };
    label(); cals.push(api); return api;
  }

  /* ================= the transfers page ================= */
  function initTransfers(root) {
    var X = window.GV_TR || {}, RATES = window.GV_TR_RATES || { hotels: {}, rates: {}, zones: {} };
    if (!X.hotels) return;
    var HOTELS = X.hotels.map(function (h) { return { name: h[0], slug: h[1], zone: h[2], rate: h[3] || "", alias: h[4] || "" }; });
    var ZONES = X.zones || [], ZONE = {}; ZONES.forEach(function (z) { ZONE[z.key] = z; });
    var AIR = {}; (X.airports || []).forEach(function (a) { AIR[a.code] = a; });
    var TRIP = {}; (X.trips || []).forEach(function (t) { TRIP[t.key] = t; });
    var VEH = X.vehicles || {}, INC = X.includes || {}, DRIVE = X.drive || {}, C = X.copy || { results: {}, checkout: {}, search: {} };
    var MAXG = X.maxGuests || 16;
    var today = X.today || todayISO();
    var e = {
      form: $("#search", root), hotelIn: $("#s-hotel", root), hotelList: $("#s-hotel-list", root), hotelClear: $("#s-hotel-clear", root), nameWrap: $("#s-name-wrap", root), name: $("#s-name", root),
      airport: $("#s-airport", root), trip: $("#s-trip", root), people: $("#s-people", root),
      toWrap: $("#s-to-wrap", root), toIn: $("#s-to", root), toList: $("#s-to-list", root), toClear: $("#s-to-clear", root), toNameWrap: $("#s-to-name-wrap", root), toName: $("#s-to-name", root),
      inWrap: $("#s-in-wrap", root), dateL: $("#s-date-l", root), date: $("#s-date", root), flightInWrap: $("#s-flight-in-wrap", root), flightIn: $("#s-flight-in", root), timeL: $("#s-time-l", root), time: $("#s-time", root),
      outWrap: $("#s-out-wrap", root), date2: $("#s-date2", root), flightOut: $("#s-flight-out", root), time2: $("#s-time2", root),
      go: $("#s-go", root), hint: $("#s-hint", root),
      results: $("#results", root), rTitle: $("#r-title", root), rSub: $("#r-sub", root), rNote: $("#r-note", root), rTable: $("#r-table", root), rSharedWa: $("#r-shared-wa", root),
    };
    var st = { placeMode: "", place: null, zone: "", placeName: "", place2Mode: "", place2: null, zone2: "", place2Name: "", searched: null, pick: null, ref: newRef() };

    function trip() { return e.trip.value; }
    function isHotel() { return trip() === "hotel"; }
    function needIn() { return trip() === "in" || trip() === "both"; }
    function needOut() { return trip() === "out" || trip() === "both"; }
    function people() { return Number(e.people.value) || 2; }
    function placeTextOf(mode, place, zone, name) { return mode === "hotel" && place ? place.name : mode === "zone" && zone && ZONE[zone] ? (name ? name + " (" + ZONE[zone].name + ")" : ZONE[zone].airbnb) : ""; }
    function placeText() { return placeTextOf(st.placeMode, st.place, st.zone, st.placeName); }
    function place2Text() { return placeTextOf(st.place2Mode, st.place2, st.zone2, st.place2Name); }
    function tt(input) { return input ? timeText(input.value) : ""; }

    /* ---- prices for the search: the hotel's own row, or its zone ---- */
    var LINKS = RATES.links || {}, EXC = RATES.exceptions || [];
    var lastExcluded = 0;
    function linkOffers(a, b) { if (!a || !b || a === b) return null; return LINKS[a + ">" + b] || LINKS[[a, b].sort().join("|")] || null; }
    function offersFor() {
      lastExcluded = 0;
      if (!st.zone) return null;
      var list = null;
      if (isHotel()) {
        list = linkOffers(st.zone, st.zone2);
      } else {
        var airport = e.airport.value, t = trip();
        list = RATES.zones[st.zone] && RATES.zones[st.zone][airport] && RATES.zones[st.zone][airport][t] || null;
        if (list && st.placeMode === "hotel" && st.place) {
          var slug = st.place.slug, before = list.length;
          list = list.filter(function (o) { return !EXC.some(function (x) { return x.airport === airport && x.zone === st.zone && x.seats === o[1] && x.hotels.indexOf(slug) >= 0; }); });
          lastExcluded = before - list.length;
        }
      }
      return list ? list.map(function (o) { return { v: o[0], seats: o[1], bags: o[2], price: o[3], multi: !!o[4] }; }) : null;
    }
    /* one row per vehicle kind: the cheapest offer that seats the party */
    function rowsFor(list, n) {
      var best = {};
      list.forEach(function (o) { if (o.seats >= n && (!best[o.v] || o.price < best[o.v].price)) best[o.v] = o; });
      return Object.keys(best).map(function (k) { return best[k]; }).sort(function (a, b) { return a.price - b.price || a.seats - b.seats; });
    }
    function rideLabel() {
      var a = AIR[e.airport.value];
      if (isHotel()) return (st.zone ? ZONE[st.zone].name : "") + " to " + (st.zone2 ? ZONE[st.zone2].name : "another hotel");
      var z = st.zone ? ZONE[st.zone].name : "";
      return trip() === "out" ? z + " to " + a.name + " airport" : trip() === "both" ? a.name + " airport to " + z + ", round trip" : a.name + " airport to " + z;
    }
    function driveText() { if (isHotel() || !st.zone) return ""; var d = DRIVE[e.airport.value]; return d && d[st.zone] ? d[st.zone] : ""; }
    function whenText() {
      if (isHotel()) return (e.date.value ? longDate(e.date.value) : "") + (tt(e.time) ? " at " + tt(e.time) : "");
      var parts = [];
      if (needIn()) parts.push("Arrives " + longDate(e.date.value) + (e.flightIn.value ? " on " + e.flightIn.value.trim().toUpperCase() : "") + (tt(e.time) ? " at " + tt(e.time) : ""));
      if (needOut()) { var fo = needIn() ? e.flightOut : e.flightIn, to = needIn() ? e.time2 : e.time; parts.push("Departs " + longDate(needIn() ? e.date2.value : e.date.value) + (fo.value ? " on " + fo.value.trim().toUpperCase() : "") + (tt(to) ? " at " + tt(to) : "")); }
      return parts.join(". ");
    }
    function peopleText() { var n = people(); return n > MAXG ? "more than " + MAXG + " people" : n + (n === 1 ? " person" : " people"); }

    /* ---- what is missing, in the order the guest meets it ---- */
    function searchProblem() {
      if (!st.zone) return { f: e.hotelIn, t: "Where are you staying? Type your hotel, or the area for a villa or Airbnb." };
      if (st.placeMode === "zone" && !st.placeName) return { f: e.name, t: "Give us the villa or Airbnb name, for the driver." };
      if (isHotel()) {
        if (!st.zone2) return { f: e.toIn, t: "Which hotel are you going to?" };
        if (st.place2Mode === "zone" && !st.place2Name) return { f: e.toName, t: "Give us the name of the villa or Airbnb you're going to." };
      }
      if (!e.date.value) return { f: e.date, t: isHotel() ? "Pick the date." : needIn() ? "Pick your arrival date." : "Pick your departure date.", cal: 0 };
      if (e.date.value < today) return { f: e.date, t: "That date has passed.", cal: 0 };
      if (isHotel()) { if (!TIME.test(tt(e.time))) return { f: e.time, t: "What time should the driver come?" }; return null; }
      if (needIn()) {
        if (!FLIGHT.test(e.flightIn.value.trim().toUpperCase())) return { f: e.flightIn, t: "We need the arriving flight number, e.g. AA1497." };
        if (!TIME.test(tt(e.time))) return { f: e.time, t: "What time does it land?" };
      }
      if (trip() === "out") { /* one way out uses the first row's boxes, relabelled */
        if (!FLIGHT.test(e.flightIn.value.trim().toUpperCase())) return { f: e.flightIn, t: "We need the departing flight number, e.g. AA1496." };
        if (!TIME.test(tt(e.time))) return { f: e.time, t: "What time does it take off?" };
      }
      if (trip() === "both") {
        if (!e.date2.value) return { f: e.date2, t: "Pick your departure date.", cal: 1 };
        if (e.date2.value < e.date.value) return { f: e.date2, t: "The departure is before the arrival.", cal: 1 };
        if (!FLIGHT.test(e.flightOut.value.trim().toUpperCase())) return { f: e.flightOut, t: "We need the departing flight number, e.g. AA1496." };
        if (!TIME.test(tt(e.time2))) return { f: e.time2, t: "What time does it take off?" };
      }
      return null;
    }
    function warn(text, anchor, offerWa) { alertBox(root, text, anchor, offerWa ? sendWhatsApp : null); }
    function clearAlert() { clearAlertIn(root); }

    /* ---- the search form: what shows depends on the way ---- */
    function renderForm() {
      var t = trip();
      pickers.forEach(function (pk) { var v = pk.which === "to" ? placeTextOf(st.place2Mode, st.place2, st.zone2, "") : placeTextOf(st.placeMode, st.place, st.zone, ""); if (document.activeElement !== pk.input) pk.input.value = v; if (pk.clear) pk.clear.hidden = !v && !pk.input.value; });
      e.nameWrap.hidden = st.placeMode !== "zone";
      e.toWrap.hidden = t !== "hotel";
      e.toNameWrap.hidden = st.place2Mode !== "zone";
      e.airport.disabled = t === "hotel";
      e.dateL.textContent = t === "hotel" ? C.search.date : t === "out" ? C.search.dateOut : C.search.dateIn;
      e.flightInWrap.hidden = t === "hotel";
      $("label", e.flightInWrap).textContent = t === "out" ? C.search.flightOut : C.search.flightIn;
      e.flightIn.placeholder = t === "out" ? "e.g. AA1496" : "e.g. AA1497";
      e.timeL.textContent = t === "hotel" ? C.search.time : t === "out" ? C.search.timeOut : C.search.timeIn;
      e.outWrap.hidden = t !== "both";
      cals.forEach(function (c) { c.refresh(); });
    }

    /* ---- the results table ---- */
    function renderResults() {
      var s = st.searched; if (!s) { e.results.hidden = true; return; }
      var n = people(), list = offersFor(), rows = list ? rowsFor(list, n) : [];
      e.results.hidden = false;
      e.rTitle.textContent = (isHotel() ? placeText() + " to " + place2Text() : placeText()) + ".";
      e.rSub.textContent = rideLabel() + (driveText() ? ", " + driveText() : "") + ". " + whenText() + ". " + peopleText().charAt(0).toUpperCase() + peopleText().slice(1) + ".";
      e.rNote.textContent = list ? (isHotel() ? "Prices between the " + ZONE[st.zone].name + " and " + ZONE[st.zone2].name + " areas, per vehicle, taxes included" : "Prices for the " + ZONE[st.zone].name + " area, per vehicle, taxes included") : "";
      e.rTable.innerHTML = "";
      var quoteWhy = !list ? (isHotel() ? "quote" : "noroute") : n > MAXG ? "big" : !rows.length ? (lastExcluded ? "quote" : "none") : "";
      if (quoteWhy) {
        var q = el("div", "rt-row quote");
        var qt = el("div", "rt-veh"); qt.appendChild(el("b", "", quoteWhy === "big" || quoteWhy === "none" ? "Two vehicles or a bus" : "Priced in the chat"));
        qt.appendChild(el("small", "", quoteWhy === "big" || quoteWhy === "none" ? C.results.none : C.results.quote)); q.appendChild(qt);
        var qg = el("div", "rt-go"); var qb = el("button", "btn btn-black btn-sm"); qb.type = "button"; qb.innerHTML = "Ask on WhatsApp" + icon("chat", 16); qb.addEventListener("click", function () { st.pick = null; sendWhatsApp(); }); qg.appendChild(qb); q.appendChild(qg);
        e.rTable.appendChild(q);
      } else {
        rows.forEach(function (o) {
          var row = el("div", "rt-row" + (st.pick && st.pick.v === o.v && st.pick.seats === o.seats ? " pick" : ""));
          var veh = el("div", "rt-veh"); veh.appendChild(el("b", "", (VEH[o.v] ? VEH[o.v].label : o.v) + (o.multi ? ", two or more" : ""))); veh.appendChild(el("small", "", o.multi ? "Two or more vehicles for your party" : VEH[o.v] ? VEH[o.v].sub : "")); row.appendChild(veh);
          var cap = el("div", "rt-cap"); var c1 = el("span"); c1.innerHTML = icon("users", 15) + "up to " + o.seats + " people"; var c2 = el("span"); c2.innerHTML = icon("bag", 15) + o.bags + " bags"; cap.appendChild(c1); cap.appendChild(c2); row.appendChild(cap);
          var inc = el("div", "rt-inc" + (trip() === "both" ? "" : " one"));
          var cols = trip() === "both" ? [["Arrival", (INC.in || []).concat(INC.all || [])], ["Departure", INC.out || []]] : [[isHotel() ? "Pickup" : trip() === "out" ? "Departure" : "Arrival", (INC[trip()] || []).concat(INC.all || [])]];
          cols.forEach(function (col) { var cc = el("div", "rt-inc-col"); cc.appendChild(el("b", "", col[0])); col[1].forEach(function (line) { var sp = el("span"); sp.innerHTML = icon("check", 13) + "<i></i>"; sp.lastChild.replaceWith(document.createTextNode(line)); cc.appendChild(sp); }); inc.appendChild(cc); });
          row.appendChild(inc);
          var pr = el("div", "rt-price"); var pb = el("b"); var pu = el("span", "usd-v", usd(o.price)); var pj = el("span", "jmd-v", jmdOf(o.price)); pb.appendChild(pu); pb.appendChild(pj); pr.appendChild(pb); pr.appendChild(el("small", "", trip() === "both" ? "round trip, per vehicle" : "one way, per vehicle")); row.appendChild(pr);
          var go = el("div", "rt-go"); var b = el("button", "btn btn-black btn-sm"); b.type = "button"; b.innerHTML = C.results.choose + icon("arrow", 16); b.addEventListener("click", function () { choose(o); }); go.appendChild(b); row.appendChild(go);
          e.rTable.appendChild(row);
        });
      }
      if (e.rSharedWa) e.rSharedWa.href = waUrl("Hi Golden Vacation! Is there a shared shuttle for " + rideLabel() + " on " + longDate(e.date.value) + ", " + peopleText() + "? Ref " + st.ref);
    }

    /* ---- Choose -> the checkout page, with the ride in the URL ---- */
    function bookingToken(o) {
      var t = trip();
      return encodeToken({
        v: 1, ref: st.ref,
        hotel: st.placeMode === "hotel" && st.place ? st.place.slug : "", zone: st.zone, placeKind: st.placeMode, placeName: st.placeName, place: placeText(),
        hotel2: isHotel() && st.place2Mode === "hotel" && st.place2 ? st.place2.slug : "", zone2: isHotel() ? st.zone2 : "", place2Kind: isHotel() ? st.place2Mode : "", place2Name: isHotel() ? st.place2Name : "", place2: isHotel() ? place2Text() : "",
        airport: e.airport.value, trip: t, people: people(), vehicle: o.v, seats: o.seats, bags: o.bags, price: o.price, multi: o.multi ? 1 : 0,
        date: e.date.value, date2: t === "both" ? e.date2.value : "",
        flightIn: needIn() ? e.flightIn.value.trim().toUpperCase() : "", flightOut: t === "out" ? e.flightIn.value.trim().toUpperCase() : t === "both" ? e.flightOut.value.trim().toUpperCase() : "",
        timeIn: needIn() ? e.time.value : "", timeOut: t === "out" ? e.time.value : t === "both" ? e.time2.value : "", time: isHotel() ? e.time.value : "",
        veh: (VEH[o.v] ? VEH[o.v].label : o.v) + (o.multi ? ", two or more" : ""), ride: rideLabel(), drive: driveText(), when: whenText(), guests: peopleText(),
      });
    }
    function choose(o) {
      st.pick = o; renderResults(); clearAlert();
      var tok = bookingToken(o);
      track("tr_choose", { ride: rideLabel(), vehicle: o.v, seats: o.seats, price: o.price, code: st.ref });
      if (PREVIEW) { window.GV_TR_PREVIEW_TOKEN = tok; if (window.GV_TR_PREVIEW_GO) window.GV_TR_PREVIEW_GO("checkout"); return; }
      window.location.href = checkoutUrl(tok);
    }

    /* ---- WhatsApp, for anything the site can't price or the guest prefers ---- */
    function message() {
      var o = st.pick, lines = ["Hi Golden Vacation! Airport transfer request."];
      lines.push("Ride: " + rideLabel() + (driveText() ? ", " + driveText() : ""));
      lines.push(isHotel() ? "From: " + placeText() + "\nTo: " + place2Text() : "Staying at: " + placeText());
      lines.push("When: " + whenText());
      lines.push("People: " + peopleText() + (o ? ", " + (VEH[o.v] ? VEH[o.v].label.toLowerCase() : o.v) + " (up to " + o.seats + ")" : ""));
      if (o) lines.push("Price on the site: " + usd(o.price) + (trip() === "both" ? " round trip" : " one way")); else lines.push("Please price it for us.");
      lines.push("Ref " + st.ref);
      return lines.join("\n");
    }
    function logEnquiry(text) {
      if (PREVIEW) return;
      try {
        var body = new URLSearchParams({ "form-name": "tr-enquiries", ref: st.ref, route: rideLabel(), vehicle: st.pick ? (VEH[st.pick.v] ? VEH[st.pick.v].label : st.pick.v) + " up to " + st.pick.seats : "", when: whenText(), guests: peopleText(), place: isHotel() ? placeText() + " to " + place2Text() : placeText(), total: st.pick ? usd(st.pick.price) : "", page: location.pathname, message: text });
        fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString(), keepalive: true }).catch(function () {});
      } catch (err) {}
    }
    function sendWhatsApp() { var text = message(); track("tr_request", { ride: rideLabel(), code: st.ref }); logEnquiry(text); window.open(waUrl(text), "_blank", "noopener"); }

    /* ---- the hotel pickers: where they stay, and where a hotel-to-hotel ride goes ---- */
    function searchText(h) { var s = " " + h.name.toLowerCase() + " " + (h.alias ? h.alias.toLowerCase() + " " : ""); Object.keys(TOWN_ALIASES).forEach(function (k) { if (s.indexOf(k) >= 0) s += TOWN_ALIASES[k]; }); return s; }
    function zoneRows(q) { var qq = (q || "").toLowerCase().trim(); return ZONES.filter(function (z) { if (z.hidden) return false; if (!qq) return true; var t = " " + z.name.toLowerCase() + " " + z.airbnb.toLowerCase() + " " + (z.aliases || []).join(" ") + " airbnb villa apartment guesthouse area "; return t.indexOf(qq) >= 0; }); }
    var pickers = [];
    function closeLists() { pickers.forEach(function (pk) { pk.close(); }); }
    function makePicker(which, input, list, clearBtn) {
      if (!input || !list) return null;
      var cursor = -1, blurTimer = null;
      function close() { list.hidden = true; list.innerHTML = ""; cursor = -1; }
      function open(q) {
        var qq = (q || "").toLowerCase().trim();
        if (qq.length < 2) { close(); return; } /* suggestions, not a drop-down: nothing shows until two letters are typed */
        var hits = HOTELS.filter(function (h) { return searchText(h).indexOf(qq) >= 0; });
        var zones = zoneRows(q).slice(0, qq ? 4 : 12);
        list.innerHTML = ""; cursor = -1;
        if (!hits.length && !zones.length) { list.appendChild(el("li", "none", "Not on our list. Type the area (Negril, Ocho Rios, Kingston) for a villa or Airbnb, or ask us on WhatsApp.")); }
        hits.forEach(function (h) { var li = el("li"); li.setAttribute("role", "option"); li.appendChild(el("span", "", h.name)); li.appendChild(el("small", "", ZONE[h.zone] ? ZONE[h.zone].name : h.zone)); li.addEventListener("mousedown", function (ev) { ev.preventDefault(); pickHotel(which, h, input); }); list.appendChild(li); });
        zones.forEach(function (z) { var li = el("li", "zone"); li.setAttribute("role", "option"); li.appendChild(el("span", "", z.airbnb)); li.appendChild(el("small", "", "area")); li.addEventListener("mousedown", function (ev) { ev.preventDefault(); pickZone(which, z.key, input); }); list.appendChild(li); });
        list.hidden = false;
      }
      input.addEventListener("input", function () { var cur = which === "to" ? st.zone2 : st.zone; if (cur && input.value !== (which === "to" ? placeTextOf(st.place2Mode, st.place2, st.zone2, "") : placeTextOf(st.placeMode, st.place, st.zone, ""))) clearPlace(which, true); open(input.value); });
      input.addEventListener("focus", function () { clearTimeout(blurTimer); open(input.value); });
      input.addEventListener("blur", function () { blurTimer = setTimeout(close, 150); });
      input.addEventListener("keydown", function (ev) {
        var items = $$("li[role=option]", list);
        if (ev.key === "Escape") { close(); return; }
        if (ev.key === "ArrowDown" || ev.key === "ArrowUp") { if (list.hidden) open(input.value); items = $$("li[role=option]", list); if (!items.length) return; ev.preventDefault(); cursor = ev.key === "ArrowDown" ? Math.min(items.length - 1, cursor + 1) : Math.max(0, cursor - 1); items.forEach(function (li, i) { li.setAttribute("aria-selected", i === cursor ? "true" : "false"); }); items[cursor].scrollIntoView({ block: "nearest" }); return; }
        if (ev.key === "Enter") { ev.preventDefault(); var pick = cursor >= 0 ? items[cursor] : items[0]; if (pick) pick.dispatchEvent(new MouseEvent("mousedown")); }
      });
      if (clearBtn) clearBtn.addEventListener("click", function () { clearPlace(which); input.focus(); });
      var api = { which: which, input: input, clear: clearBtn, close: close, open: open };
      pickers.push(api); return api;
    }
    function pickHotel(which, h, from) {
      if (which === "to") { st.place2Mode = "hotel"; st.place2 = h; st.zone2 = h.zone; st.place2Name = ""; }
      else { st.placeMode = "hotel"; st.place = h; st.zone = h.zone; st.placeName = ""; store("gv_hotel", h.slug); }
      if (from) from.blur(); closeLists(); clearAlert(); renderForm(); afterChange();
      track("tr_hotel", { which: which, hotel: h.slug });
    }
    function pickZone(which, key, from) {
      if (which === "to") { st.place2Mode = "zone"; st.place2 = null; st.zone2 = key; st.place2Name = e.toName.value.trim(); }
      else { st.placeMode = "zone"; st.place = null; st.zone = key; st.placeName = e.name.value.trim(); }
      if (from) from.blur(); closeLists(); clearAlert(); renderForm(); afterChange();
      var box = which === "to" ? e.toName : e.name, has = which === "to" ? st.place2Name : st.placeName;
      if (!has) setTimeout(function () { focusEl(box); }, 60);
      track("tr_zone", { which: which, zone: key });
    }
    function clearPlace(which, quiet) {
      if (which === "to") { st.place2Mode = ""; st.place2 = null; st.zone2 = ""; st.place2Name = ""; e.toName.value = ""; }
      else { st.placeMode = ""; st.place = null; st.zone = ""; st.placeName = ""; e.name.value = ""; }
      if (!quiet) closeLists();
      renderForm(); afterChange();
    }
    /* any change to the search after a result is on screen hides the result: the guest searches again */
    function afterChange() { if (st.searched) { st.searched = null; st.pick = null; e.results.hidden = true; } }
    makePicker("from", e.hotelIn, e.hotelList, e.hotelClear);
    makePicker("to", e.toIn, e.toList, e.toClear);
    e.name.addEventListener("input", function () { st.placeName = e.name.value.trim(); afterChange(); });
    e.toName.addEventListener("input", function () { st.place2Name = e.toName.value.trim(); afterChange(); });
    [e.airport, e.trip, e.people].forEach(function (s) { s.addEventListener("change", function () { clearAlert(); renderForm(); afterChange(); if (s === e.trip && isHotel() && !st.zone2) setTimeout(function () { focusEl(e.toIn); }, 60); }); });
    [e.flightIn, e.flightOut, e.time, e.time2].forEach(function (i) { i.addEventListener("input", function () { clearAlert(); afterChange(); }); });
    /* the clock icon opens the time picker where the browser allows it (phones open it on any tap in the box anyway) */
    [e.time, e.time2].forEach(function (i) { var box = i.parentNode; box.addEventListener("click", function (ev) { if (ev.target === i) return; i.focus(); try { if (i.showPicker) i.showPicker(); } catch (err) {} }); });
    var cals = [];
    e.date.addEventListener("change", function () { clearAlert(); afterChange(); });
    e.date2.addEventListener("change", function () { clearAlert(); afterChange(); });
    makeCal(e.date, { today: today, label: "Date", placeholder: "Pick a date", problem: function (ds) { return ds < today ? "That date has passed." : ""; } }, cals);
    makeCal(e.date2, { today: today, label: "Departure date", placeholder: "Pick a date", problem: function (ds) { return ds < today ? "That date has passed." : (e.date.value && ds < e.date.value ? "Before your arrival." : ""); } }, cals);

    /* ---- Search ---- */
    e.form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var p = searchProblem();
      if (p) { warn(p.t, e.go.parentNode); if (p.cal != null && cals[p.cal]) cals[p.cal].open(); else focusEl(p.f); return; }
      clearAlert(); st.searched = { at: Date.now() }; st.pick = null;
      renderResults(); scrollTo(e.results);
      track("tr_search", { ride: rideLabel(), trip: trip(), people: people(), exact: !!(st.place && st.place.rate) });
    });

    /* ---- what the URL and the last visit already know ---- */
    var q = new URLSearchParams(location.search);
    /* back from the checkout page ("Change", "Back to the options"): the whole search comes back and the table is shown again */
    var tok = decodeToken(q.get("b") || (PREVIEW ? window.GV_TR_PREVIEW_TOKEN : "")), restored = false;
    if (tok && tok.v === 1 && tok.zone) {
      var hb = tok.hotel ? HOTELS.filter(function (h) { return h.slug === tok.hotel; })[0] : null;
      if (hb) { st.placeMode = "hotel"; st.place = hb; st.zone = hb.zone; }
      else if (ZONE[tok.zone]) { st.placeMode = "zone"; st.place = null; st.zone = tok.zone; st.placeName = String(tok.placeName || ""); e.name.value = st.placeName; }
      if (TRIP[tok.trip]) e.trip.value = tok.trip;
      if (tok.trip === "hotel") {
        var hb2 = tok.hotel2 ? HOTELS.filter(function (h) { return h.slug === tok.hotel2; })[0] : null;
        if (hb2) { st.place2Mode = "hotel"; st.place2 = hb2; st.zone2 = hb2.zone; }
        else if (ZONE[tok.zone2]) { st.place2Mode = "zone"; st.place2 = null; st.zone2 = tok.zone2; st.place2Name = String(tok.place2Name || ""); e.toName.value = st.place2Name; }
      }
      if (AIR[tok.airport]) e.airport.value = tok.airport;
      var pt = parseInt(tok.people, 10); if (pt >= 1 && pt <= MAXG + 1) e.people.value = String(pt);
      if (/^\d{4}-\d{2}-\d{2}$/.test(tok.date || "")) e.date.value = tok.date;
      if (/^\d{4}-\d{2}-\d{2}$/.test(tok.date2 || "")) e.date2.value = tok.date2;
      if (tok.trip === "hotel") e.time.value = String(tok.time || "");
      else if (tok.trip === "out") { e.flightIn.value = String(tok.flightOut || ""); e.time.value = String(tok.timeOut || ""); }
      else { e.flightIn.value = String(tok.flightIn || ""); e.time.value = String(tok.timeIn || ""); if (tok.trip === "both") { e.flightOut.value = String(tok.flightOut || ""); e.time2.value = String(tok.timeOut || ""); } }
      st.ref = /^GV-TR-[A-Z0-9]{4}$/.test(tok.ref || "") ? tok.ref : st.ref;
      restored = true;
    }
    var want = restored ? "" : q.get("hotel") || store("gv_hotel"), h0 = want ? HOTELS.filter(function (h) { return h.slug === want; })[0] : null;
    if (h0) { st.placeMode = "hotel"; st.place = h0; st.zone = h0.zone; }
    if (!restored && q.get("airport") && AIR[q.get("airport")]) e.airport.value = q.get("airport");
    /* the home page search hands over here with the hotel typed as text, the people and the arrival date */
    var qText = restored ? "" : (q.get("q") || "").trim(), handed = false, pendingText = "";
    if (qText && !h0) {
      var lc = qText.toLowerCase();
      var exact = HOTELS.filter(function (h) { return h.name.toLowerCase() === lc; })[0];
      var hits = exact ? [exact] : HOTELS.filter(function (h) { return searchText(h).indexOf(lc) >= 0; });
      var zr = zoneRows(qText);
      if (hits.length === 1) { st.placeMode = "hotel"; st.place = hits[0]; st.zone = hits[0].zone; }
      else if (!hits.length && zr.length === 1) { st.placeMode = "zone"; st.zone = zr[0].key; st.place = null; }
      else pendingText = qText;
      handed = true;
    }
    var pq = restored ? NaN : parseInt(q.get("people") || "", 10);
    if (pq >= 1 && pq <= MAXG + 1) { e.people.value = String(pq); handed = true; }
    var dq = restored ? "" : q.get("date") || "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(dq) && dq >= today) { e.date.value = dq; if (cals[0]) cals[0].refresh(); handed = true; }
    renderForm();
    if (pendingText) e.hotelIn.value = pendingText; /* after renderForm, which paints the box from the state; the list opens on focus, filtered to the text */
    if (restored) {
      var rp = searchProblem();
      if (!rp) { st.searched = { at: Date.now() }; st.pick = { v: tok.vehicle, seats: Number(tok.seats) }; renderResults(); setTimeout(function () { scrollTo(e.results); }, 80); }
      else setTimeout(function () { scrollTo(e.form); warn(rp.t, e.go.parentNode); if (rp.cal != null && cals[rp.cal]) cals[rp.cal].open(); else focusEl(rp.f); }, 80);
    } else if (handed) setTimeout(function () {
      scrollTo(e.form);
      if (!st.zone) focusEl(e.hotelIn);
      else if (st.placeMode === "zone" && !st.placeName && e.name) focusEl(e.name);
      else focusEl(e.flightIn);
    }, 80);
    if (q.get("cancelled")) warn("The payment page was closed. Nothing was charged. Search again and the prices are still here.", e.go.parentNode);
  }

  /* ================= checkout, over two pages =================
     /transfers/checkout is the ride and who's travelling; /transfers/pay is the card form. Both read the same ride from the URL
     (?b=token) and draw the same route map, so this one function runs both and branches only where they differ. The guest's
     details travel between them in sessionStorage, never in the URL. Stripe's script is on the pay page alone.
     tr-checkout builds the Checkout Session from the raw fields (never the words or the price in the token) and returns the client
     secret plus the publishable key; if Stripe's script is blocked the same call returns a hosted card page to redirect to. */
  function initCheckout(root, isPay) {
    var X = window.GV_TR || {}, C = (X.copy && X.copy.checkout) || {}, INC = X.includes || {}, today = X.today || todayISO();
    var q = new URLSearchParams(location.search);
    var tok = decodeToken(q.get("b") || "") || (PREVIEW ? (window.GV_TR_PREVIEW_TOKEN ? decodeToken(window.GV_TR_PREVIEW_TOKEN) : X.previewBooking) : null);
    var AIRN = {}; (X.airports || []).forEach(function (a) { AIRN[a.code] = a.name; });
    var ZN = X.zones || {};
    var g = {
      grid: $("#ck-grid", root), empty: $("#ck-empty", root), sub: $("#ck-sub", root), back: $("#ck-back", root), steps: $("#ck-steps", root), hero: $(".ck-hero", root),
      ride: $("#ck-ride", root), rideChange: $("#ck-ride-change", root), rideTitle: $("#ck-ride-title", root), rideWhen: $("#ck-ride-when", root),
      map: $("#ck-map", root), mapRoute: $("#ck-map-route", root), mapA: $("#ck-map-a", root), mapB: $("#ck-map-b", root), mapAl: $("#ck-map-al", root), mapBl: $("#ck-map-bl", root),
      zoom: $("#ck-map-zoom", root), zoomIn: $("#ck-map-zoom-in", root), zRoute: $("#ck-map-zroute", root), zA: $("#ck-map-za", root), zB: $("#ck-map-zb", root), zAl: $("#ck-map-zal", root), zBl: $("#ck-map-zbl", root), lens: $("#ck-map-lens", root), lensBg: $("#ck-map-lens-bg", root), clipC: $("#ck-map-clipc", root), tie: $("#ck-map-tie", root), spot: $("#ck-map-spot", root), mapSvg: $(".ck-map-svg", root),
      routeA: $("#ck-route-a", root), routeAs: $("#ck-route-as", root), routeB: $("#ck-route-b", root), routeBs: $("#ck-route-bs", root), routeMid: $("#ck-route-mid", root), routeIa: $("#ck-route-ia", root), routeIb: $("#ck-route-ib", root), route: $("#ck-route", root),
      guest: $("#ck-guest", root), form: $("#ck-form", root), name: $("#ck-name", root), email: $("#ck-email", root), phone: $("#ck-phone", root), note: $("#ck-note", root), hint: $("#ck-hint", root), go: $("#ck-go", root),
      rows: $("#ck-rows", root), rowRideT: $("#ck-row-ride-t", root), rowRideD: $("#ck-row-ride-d", root), rowRideChange: $("#ck-row-ride-change", root), rowGuestT: $("#ck-row-guest-t", root), rowGuestD: $("#ck-row-guest-d", root), rowEdit: $("#ck-row-edit", root), rowsNote: $("#ck-rows-note", root),
      pay: $("#ck-pay", root), payHead: $("#ck-pay-head", root), payTitle: $("#ck-pay-title", root), total: $("#ck-total", root), totalJ: $("#ck-total-j", root), jmd: $("#ck-jmd", root), usdSmall: $("#ck-usd", root), totSub: $("#ck-tot-sub", root), inc: $("#ck-inc", root), stripe: $("#ck-stripe", root), ph: $("#ck-ph", root), wa: $("#ck-wa", root),
    };
    if (!g.grid) return;
    /* the three steps: the ones behind the guest get a tick, the current one is lit, the rest wait */
    function markSteps(now) {
      if (!g.steps) return;
      g.steps.setAttribute("data-step", String(now));
      $$("li", g.steps).forEach(function (li) {
        var i = Number(li.getAttribute("data-i")), sm = $("small", li), n = $(".n", li);
        li.className = i < now ? "done" : i === now ? "now" : "";
        if (sm) sm.textContent = i < now ? (C.stepDone || "Done") : sm.getAttribute("data-sub");
        if (n) n.innerHTML = i < now ? icon("check", 24) : "0" + i;
      });
    }
    function bail(title, text, cta, href) {
      g.grid.hidden = true;
      if (g.empty) {
        g.empty.hidden = false;
        var h = $("h2", g.empty), p = $("p", g.empty), a = $("a", g.empty);
        if (h) h.textContent = title; if (p) p.textContent = text;
        if (a) { a.textContent = cta; a.href = href; }
      }
      if (g.steps) g.steps.hidden = true;
      if (g.map) g.map.hidden = true;
    }
    var ok = tok && tok.v === 1 && tok.zone && tok.vehicle && tok.seats && tok.trip && tok.date;
    if (!ok) { bail(C.emptyTitle || "", C.emptyText || "", C.emptyCta || "", BASE + "/"); return; }
    var t = String(tok.trip), isHotel = t === "hotel", needIn = t === "in" || t === "both", needOut = t === "out" || t === "both";
    var price = Number(tok.price) || 0, seats = Number(tok.seats) || 0, ref = /^GV-TR-[A-Z0-9]{4}$/.test(tok.ref || "") ? tok.ref : newRef();
    var placeLine = isHotel ? String(tok.place || "") + " to " + String(tok.place2 || "") : String(tok.place || "");
    var back = searchUrl(encodeToken(tok));
    var stripeObj = null, mounted = null, opening = false;

    /* ---- the ride, everywhere it shows ---- */
    var detailsUrl = BASE + "/checkout?b=" + encodeToken(tok);
    if (g.back) g.back.href = isPay ? detailsUrl : back;
    if (g.rideChange) g.rideChange.href = back;
    if (g.rowRideChange) g.rowRideChange.href = back;
    if (g.rowEdit) g.rowEdit.href = detailsUrl;
    /* the vehicle for the party that was searched for, never the seat count: nobody reads "up to 5" as room for one more */
    var rideTitle = String(tok.veh || tok.vehicle) + " " + (C.rideFor || "for") + " " + String(tok.guests || "");
    var airportName = (AIRN[tok.airport] || String(tok.airport || "")) + " airport", zoneName = ZN[tok.zone] || "", zone2Name = ZN[tok.zone2] || "";
    if (g.ride) { /* page one: the full ride card with the route ribbon, the drive time on the line between */
      g.rideTitle.textContent = rideTitle;
      var ends = isHotel ? [[String(tok.place || ""), zoneName, "pin"], [String(tok.place2 || ""), zone2Name, "pin"]]
        : t === "out" ? [[String(tok.place || ""), zoneName, "pin"], [airportName, String(tok.airport || ""), "plane"]]
        : [[airportName, String(tok.airport || ""), "plane"], [String(tok.place || ""), zoneName, "pin"]];
      g.routeA.textContent = ends[0][0]; g.routeAs.textContent = ends[0][1]; g.routeB.textContent = ends[1][0]; g.routeBs.textContent = ends[1][1];
      g.routeIa.innerHTML = icon(ends[0][2], 18); g.routeIb.innerHTML = icon(ends[1][2], 18);
      g.routeMid.textContent = [tok.drive ? String(tok.drive) : "", t === "both" ? (C.roundTrip || "and back") : ""].filter(Boolean).join(" · ");
      g.route.classList.toggle("both", t === "both");
      g.rideWhen.textContent = String(tok.when || "");
    }
    if (g.rowRideT) { /* the pay page: the same ride folded to one line */
      g.rowRideT.textContent = rideTitle + " · " + String(tok.ride || "");
      g.rowRideD.textContent = [placeLine, String(tok.when || "").replace(/^Arrives/, "arrives").replace(/\. Departs/, " · departs")].filter(Boolean).join(" · ");
    }
    /* the route on the island in the band: airport to area (or the hotel's own spot), a dashed line that moves */
    if (g.map && X.map) {
      var M = X.map, pt = function (slug, zone) { return (slug && M.hotels[slug]) || M.zones[zone] || null; };
      var A = isHotel ? pt(tok.hotel, tok.zone) : t === "out" ? pt(tok.hotel, tok.zone) : M.airports[tok.airport];
      var B = isHotel ? pt(tok.hotel2, tok.zone2) : t === "out" ? M.airports[tok.airport] : pt(tok.hotel, tok.zone);
      var MN = M.names || ZN;
      var la = isHotel || t === "out" ? (MN[tok.zone] || ZN[tok.zone] || "") : String(tok.airport || ""), lb = isHotel ? (MN[tok.zone2] || ZN[tok.zone2] || "") : t === "out" ? String(tok.airport || "") : (MN[tok.zone] || ZN[tok.zone] || "");
      if (A && B) {
        var mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, dx = B[0] - A[0], dy = B[1] - A[1], len = Math.sqrt(dx * dx + dy * dy) || 1;
        /* the road: the shortest way through the town graph, coastal legs walking the coastline, then a straight last leg to the pin */
        var RD = M.roads || null;
        function walk(i, j) { /* the coastline between two points on it, the shorter way round */
          var C = RD.coast, n = C.length, total = RD.cum[n], fwd = ((RD.cum[j] - RD.cum[i]) % total + total) % total, out = [], k;
          if (fwd <= total - fwd) { for (k = i; k !== j; k = (k + 1) % n) out.push(C[k]); }
          else { for (k = i; k !== j; k = (k - 1 + n) % n) out.push(C[k]); }
          out.push(C[j]); return out;
        }
        function legLen(a, b, coastal) { if (!coastal) return Math.hypot(RD.nodes[b][0] - RD.nodes[a][0], RD.nodes[b][1] - RD.nodes[a][1]); var pts = walk(RD.idx[a], RD.idx[b]), l = 0; for (var k = 1; k < pts.length; k++) l += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); return l * 0.9; /* the coast road is the highway */ }
        function shortest(from, to) { /* Dijkstra over thirty towns */
          var adj = {}; RD.edges.forEach(function (e) { (adj[e[0]] = adj[e[0]] || []).push([e[1], e[2]]); (adj[e[1]] = adj[e[1]] || []).push([e[0], e[2]]); });
          var dist = {}, prev = {}, done = {}, q = Object.keys(RD.nodes); q.forEach(function (k) { dist[k] = Infinity; }); dist[from] = 0;
          while (q.length) { q.sort(function (a, b) { return dist[a] - dist[b]; }); var u = q.shift(); if (u === to || dist[u] === Infinity) break; done[u] = 1;
            (adj[u] || []).forEach(function (e) { if (done[e[0]]) return; var d = dist[u] + legLen(u, e[0], e[1]); if (d < dist[e[0]]) { dist[e[0]] = d; prev[e[0]] = [u, e[1]]; } }); }
          if (dist[to] === Infinity) return null;
          var hops = [], cur = to; while (prev[cur]) { hops.unshift([prev[cur][0], cur, prev[cur][1]]); cur = prev[cur][0]; }
          return hops;
        }
        function nearestIdx(P) { var best = 0, bd = Infinity; RD.coast.forEach(function (c, i) { var d = Math.hypot(c[0] - P[0], c[1] - P[1]); if (d < bd) { bd = d; best = i; } }); return [best, bd]; }
        function nearestAnchor(P, names) { var best = null, bd = Infinity; (names || []).forEach(function (n) { if (!RD.nodes[n]) return; var d = Math.hypot(RD.nodes[n][0] - P[0], RD.nodes[n][1] - P[1]); if (d < bd) { bd = d; best = n; } }); return best; }
        function tidy(pts) { /* no doubling back, no spikes from the coastline nudge, then the small wiggles smoothed out */
          var out = [pts[0]], k;
          for (k = 1; k < pts.length; k++) { var last = out[out.length - 1]; if (Math.hypot(pts[k][0] - last[0], pts[k][1] - last[1]) > 2) out.push(pts[k]); }
          for (var pass = 0; pass < 3; pass++) { var kept = [out[0]]; for (k = 1; k < out.length - 1; k++) { var a = kept[kept.length - 1], b = out[k], c = out[k + 1]; var v1x = b[0] - a[0], v1y = b[1] - a[1], v2x = c[0] - b[0], v2y = c[1] - b[1]; var cos = (v1x * v2x + v1y * v2y) / ((Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y)) || 1); if (cos > -0.5) kept.push(b); } kept.push(out[out.length - 1]); out = kept; }
          function dp(list, eps) { if (list.length < 3) return list; var a = list[0], b = list[list.length - 1], maxd = 0, idx = 0; for (var i = 1; i < list.length - 1; i++) { var p = list[i], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, d = Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / l; if (d > maxd) { maxd = d; idx = i; } } if (maxd <= eps) return [a, b]; var left = dp(list.slice(0, idx + 1), eps), right = dp(list.slice(idx), eps); return left.slice(0, -1).concat(right); }
          return dp(out, 2.5);
        }
        function road(P, Q, anchorP, anchorQ, straight) {
          var pts = [P];
          if (RD && !straight) {
            if (anchorP && anchorQ && anchorP !== anchorQ && RD.nodes[anchorP] && RD.nodes[anchorQ]) {
              var hops = shortest(anchorP, anchorQ);
              if (hops) hops.forEach(function (h, i) { if (h[2]) { walk(RD.idx[h[0]], RD.idx[h[1]]).forEach(function (c) { pts.push(c); }); } else { if (i === 0) pts.push(RD.nodes[h[0]]); pts.push(RD.nodes[h[1]]); } });
            } else { /* same town at both ends, or no town: follow the coast when both ends sit on it */
              var ni = nearestIdx(P), nj = nearestIdx(Q);
              if (ni[1] < 14 && nj[1] < 14 && ni[0] !== nj[0]) walk(ni[0], nj[0]).forEach(function (c) { pts.push(c); });
            }
          }
          pts.push(Q);
          var list = tidy(pts);
          if (list.length < 3) return "M" + list.map(function (p) { return p[0].toFixed(1) + " " + p[1].toFixed(1); }).join("L");
          /* a smooth curve through the points, the same drawing as the coastline, so the road and the coast bend together */
          var out = "M" + list[0][0].toFixed(1) + " " + list[0][1].toFixed(1);
          for (var i = 0; i < list.length - 1; i++) { var p0 = list[Math.max(0, i - 1)], p1 = list[i], p2 = list[i + 1], p3 = list[Math.min(list.length - 1, i + 2)]; var c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]; out += "C" + c1[0].toFixed(1) + " " + c1[1].toFixed(1) + " " + c2[0].toFixed(1) + " " + c2[1].toFixed(1) + " " + p2[0].toFixed(1) + " " + p2[1].toFixed(1); }
          return out;
        }
        /* which town the road starts and ends at: the airport's own, or the nearest of the area's towns to the pin, so the road heads the right way */
        var NEAR = { negril: ["negril", "savanna-la-mar", "lucea"], lucea: ["lucea", "hopewell", "negril"], "hanover-villas": ["hopewell", "lucea", "montego-bay"], mobay: ["montego-bay", "MBJ", "rose-hall"], "mobay-nonai": ["montego-bay", "MBJ", "rose-hall"], "rose-hall": ["MBJ", "rose-hall", "falmouth"], falmouth: ["rose-hall", "falmouth", "runaway-bay"], "runaway-bay": ["falmouth", "runaway-bay", "ocho-rios"], "ocho-rios": ["runaway-bay", "ocho-rios", "OCJ"], kingston: ["kingston", "KIN"], "blue-mountains": ["strawberry-hill"], "port-antonio": ["port-antonio", "OCJ", "morant-bay"], "treasure-beach": ["treasure-beach", "black-river"], "south-coast": ["whitehouse", "bluefields", "black-river"] };
        var anchorA = !RD ? null : isHotel || t === "out" ? nearestAnchor(A, NEAR[tok.zone] || [RD.anchors[tok.zone]]) : RD.anchors[tok.airport];
        var anchorB = !RD ? null : isHotel ? nearestAnchor(B, NEAR[tok.zone2] || [RD.anchors[tok.zone2]]) : t === "out" ? RD.anchors[tok.airport] : nearestAnchor(B, NEAR[tok.zone] || [RD.anchors[tok.zone]]);
        function draw(pathEl, d) { pathEl.setAttribute("d", d); try { var L = pathEl.getTotalLength(); pathEl.style.strokeDasharray = L + " " + L; pathEl.style.strokeDashoffset = L; pathEl.getBoundingClientRect(); pathEl.style.transition = "stroke-dashoffset 1.4s ease-out"; pathEl.style.strokeDashoffset = "0"; } catch (err) {} } /* the road draws itself once */
        /* the label goes on the side away from the road: above when the road leaves downwards, below when it leaves upwards, and never off the edge */
        function label(tx, P, txt, away) { tx.textContent = txt; var below = P[1] < 60 || (away && away[1] < P[1] - 4); if (away && away[1] > P[1] + 4 && P[1] >= 60) below = false; tx.setAttribute("y", below ? 52 : -30); tx.setAttribute("text-anchor", P[0] < 110 ? "start" : P[0] > 890 ? "end" : "middle"); tx.setAttribute("x", P[0] < 110 ? -12 : P[0] > 890 ? 12 : 0); }
        function pathPoint(d, fromEnd) { var m = d.match(/-?\d+(?:\.\d+)?/g); if (!m || m.length < 4) return null; return fromEnd ? [Number(m[m.length - 4]), Number(m[m.length - 3])] : [Number(m[2]), Number(m[3])]; }
        var H = Number(g.mapSvg.getAttribute("data-h")) || 430;
        if (len >= 70) {
          var dRoad = road(A, B, anchorA, anchorB);
          draw(g.mapRoute, dRoad);
          g.mapA.setAttribute("transform", "translate(" + A[0] + " " + A[1] + ")"); g.mapB.setAttribute("transform", "translate(" + B[0] + " " + B[1] + ")");
          label(g.mapAl, A, la, pathPoint(dRoad, false)); label(g.mapBl, B, lb, pathPoint(dRoad, true));
          /* two labels on the same side of two nearby pins would sit on top of each other: hang them outwards instead, beside the pins */
          var wA = la.length * 16, wB = lb.length * 16, sameSide = g.mapAl.getAttribute("y") === g.mapBl.getAttribute("y");
          if (sameSide && Math.abs(A[0] - B[0]) < (wA + wB) / 2 + 24 && Math.abs(A[1] - B[1]) < 44) {
            var left = A[0] <= B[0] ? [g.mapAl, A, wA] : [g.mapBl, B, wB], right = A[0] <= B[0] ? [g.mapBl, B, wB] : [g.mapAl, A, wA];
            if (left[1][0] - left[2] > -20) { left[0].setAttribute("text-anchor", "end"); left[0].setAttribute("x", -18); left[0].setAttribute("y", 10); right[0].setAttribute("text-anchor", "start"); right[0].setAttribute("x", 18); right[0].setAttribute("y", 10); }
            else { left[0].setAttribute("y", left[1][1] < 60 ? 52 : -30); right[0].setAttribute("y", left[1][1] < 60 ? 86 : -64); } /* no room to the left: stack them */
          }
          g.zoom.setAttribute("hidden", ""); /* an SVG group: the attribute, not the HTML property */
        } else {
          /* a short hop: the two pins would sit on top of each other, so the island shows one spot and a lens shows the hop zoomed in */
          g.mapRoute.setAttribute("d", ""); g.mapA.setAttribute("transform", "translate(-999 -999)"); g.mapB.setAttribute("transform", "translate(-999 -999)"); g.mapAl.textContent = ""; g.mapBl.textContent = "";
          /* the lens sits right on the hop, like a magnifying glass laid on the map, nudged inwards only where it would fall off the edge */
          var R = 140, z = Math.max(3, Math.min(9, 130 / len));
          var L = [Math.min(1010 - R, Math.max(-10 + R, mx)), Math.min(H + 84 - R, Math.max(-54 + R, my))];
          g.zoom.removeAttribute("hidden");
          var tdx = L[0] - mx, tdy = L[1] - my, tl = Math.sqrt(tdx * tdx + tdy * tdy) || 1, covered = tl < R * 0.6;
          /* when the nudge leaves the hop outside the glass, a spot marks it and a dotted tie runs to the glass */
          g.spot.setAttribute("display", covered ? "none" : ""); g.tie.setAttribute("display", covered ? "none" : "");
          g.spot.setAttribute("cx", mx.toFixed(1)); g.spot.setAttribute("cy", my.toFixed(1));
          g.tie.setAttribute("x1", mx.toFixed(1)); g.tie.setAttribute("y1", my.toFixed(1)); g.tie.setAttribute("x2", (L[0] - (tdx / tl) * R).toFixed(1)); g.tie.setAttribute("y2", (L[1] - (tdy / tl) * R).toFixed(1));
          [g.lens, g.lensBg, g.clipC].forEach(function (c) { c.setAttribute("cx", L[0]); c.setAttribute("cy", L[1]); c.setAttribute("r", R); });
          g.zoomIn.setAttribute("transform", "translate(" + L[0] + " " + L[1] + ") scale(" + z.toFixed(2) + ") translate(" + (-mx).toFixed(1) + " " + (-my).toFixed(1) + ")");
          g.zRoute.setAttribute("d", road(A, B, anchorA, anchorB, true)); /* a few minutes' drive: one clean line */
          var zA = [L[0] + (A[0] - mx) * z, L[1] + (A[1] - my) * z], zB = [L[0] + (B[0] - mx) * z, L[1] + (B[1] - my) * z];
          g.zA.setAttribute("transform", "translate(" + zA[0].toFixed(1) + " " + zA[1].toFixed(1) + ")"); g.zB.setAttribute("transform", "translate(" + zB[0].toFixed(1) + " " + zB[1].toFixed(1) + ")");
          /* labels: the higher pin gets its label above, the lower one below, so the two never collide */
          var aUp = zA[1] <= zB[1];
          /* inside the lens there is room for the hotel's own name when it is short */
          var hn = String(tok.place || ""), hn2 = String(tok.place2 || "");
          var zla = isHotel ? (hn.length <= 18 ? hn : la) : t === "out" ? (hn.length <= 18 ? hn : la) : la, zlb = isHotel ? (hn2.length <= 18 ? hn2 : lb) : t === "out" ? lb : (hn.length <= 18 ? hn : lb);
          g.zAl.textContent = zla; g.zBl.textContent = zlb; g.zAl.setAttribute("y", aUp ? -30 : 52); g.zBl.setAttribute("y", aUp ? 52 : -30);
          g.zAl.setAttribute("text-anchor", "middle"); g.zBl.setAttribute("text-anchor", "middle"); g.zAl.setAttribute("x", 0); g.zBl.setAttribute("x", 0);
        }
      } else g.map.hidden = true;
    }
    /* the total follows the US$/J$ switch in the header: the chosen one big, the other small; the card is charged in US$ */
    var jm = "J$" + fmt(Math.round((price * RATE) / 100) * 100);
    g.total.textContent = usd(price); g.totalJ.textContent = "≈ " + jm; g.jmd.textContent = "about " + jm; g.usdSmall.textContent = usd(price) + " on the card";
    g.totSub.textContent = (t === "both" ? "Round trip" : "One way") + ", per vehicle, taxes included";
    if (g.hint) g.hint.textContent = needIn ? C.nameHintArrival : C.nameHintPickup;
    if (g.rowsNote) g.rowsNote.textContent = needIn ? C.foldedNoteArrival : C.foldedNotePickup;
    g.inc.innerHTML = "";
    var groups = t === "both" ? [["Arrival", INC.in || []], ["Departure", INC.out || []], ["", INC.all || []]] : [["", (INC[t] || []).concat(INC.all || [])]];
    groups.forEach(function (grp) {
      var box = el("div", "ck-inc-g"); if (grp[0]) box.appendChild(el("b", "", grp[0]));
      grp[1].forEach(function (line) { var sp = el("span"); sp.innerHTML = icon("check", 18); sp.appendChild(document.createTextNode(line)); box.appendChild(sp); });
      g.inc.appendChild(box);
    });
    if (tok.date < today) alertBox(root, "That date has passed. Search again with a new date.", g.go || g.pay, null);

    /* ---- the guest ----
       One name field, not two: the last word is the surname, everything before it the first name, which is what a
       middle name or a double-barrelled first name needs. Kept for the session so Edit and the back button don't
       lose the typing, and it is how the details reach the pay page. */
    var fields = [g.name, g.email, g.phone, g.note].filter(Boolean);
    function readSaved() { try { return JSON.parse(session("gv_tr_guest") || "null") || null; } catch (err) { return null; } }
    function splitName(s) {
      var parts = String(s || "").trim().split(/\s+/).filter(Boolean);
      if (!parts.length) return { first: "", last: "" };
      if (parts.length === 1) return { first: parts[0], last: "" };
      return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
    }
    function val(f) { return f ? (f.value || "").trim() : ""; }
    /* what the booking is made under, from the form on page one and from the session on the pay page */
    var held = readSaved() || {};
    function guest() {
      if (fields.length) return { name: val(g.name), email: val(g.email), phone: val(g.phone), note: val(g.note) };
      return { name: String(held["ck-name"] || "").trim(), email: String(held["ck-email"] || "").trim(), phone: String(held["ck-phone"] || "").trim(), note: String(held["ck-note"] || "").trim() };
    }
    if (fields.length) {
      fields.forEach(function (f) { if (held[f.id] != null && !f.value) f.value = held[f.id]; });
      fields.forEach(function (f) { f.addEventListener("input", function () { clearAlertIn(g.guest); var o = {}; fields.forEach(function (x) { o[x.id] = x.value; }); session("gv_tr_guest", JSON.stringify(o)); }); });
    }
    function contactProblem() {
      var who = splitName(val(g.name));
      if (!who.first) return { f: g.name, t: "We need the name the booking is in." };
      if (!who.last) return { f: g.name, t: C.oneName || "We need a first and last name." };
      if (!EMAIL.test(val(g.email))) return { f: g.email, t: "That email doesn't look right." };
      if (!val(g.phone)) return { f: g.phone, t: "We need a phone or WhatsApp number, for the driver." };
      return null;
    }
    function message() {
      var lines = ["Hi Golden Vacation! Airport transfer request."];
      lines.push("Ride: " + String(tok.ride || "") + (tok.drive ? ", " + tok.drive : ""));
      lines.push(isHotel ? "From: " + String(tok.place || "") + "\nTo: " + String(tok.place2 || "") : "Staying at: " + String(tok.place || ""));
      lines.push("When: " + String(tok.when || ""));
      lines.push("People: " + String(tok.guests || "") + ", " + String(tok.veh || tok.vehicle).toLowerCase() + " (up to " + seats + ")");
      lines.push("Price on the site: " + usd(price) + (t === "both" ? " round trip" : " one way"));
      var gu = guest();
      if (gu.note) lines.push("Note: " + gu.note);
      if (gu.name) lines.push("Name: " + gu.name);
      lines.push("Ref " + ref);
      return lines.join("\n");
    }
    function logEnquiry(text) {
      if (PREVIEW) return;
      try {
        var body = new URLSearchParams({ "form-name": "tr-enquiries", ref: ref, route: String(tok.ride || ""), vehicle: String(tok.veh || tok.vehicle) + " up to " + seats, when: String(tok.when || ""), guests: String(tok.guests || ""), place: placeLine, total: usd(price), page: location.pathname, message: text });
        fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString(), keepalive: true }).catch(function () {});
      } catch (err) {}
    }
    function sendWhatsApp() { var text = message(); track("tr_request", { ride: String(tok.ride || ""), code: ref }); logEnquiry(text); window.open(waUrl(text), "_blank", "noopener"); }
    if (g.wa) g.wa.addEventListener("click", function (ev) { ev.preventDefault(); sendWhatsApp(); });

    function placeholder(text) { if (!g.stripe) return; g.stripe.innerHTML = ""; g.ph = null; if (text) { g.ph = el("p", "ck-ph", text); g.ph.id = "ck-ph"; g.stripe.appendChild(g.ph); } }
    function unmountStripe() { if (mounted) { try { mounted.destroy(); } catch (err) {} mounted = null; } }
    function body(ui) {
      var gu = guest(), who = splitName(gu.name);
      return { ui: ui, hotel: String(tok.hotel || ""), zone: String(tok.zone), place: String(tok.place || ""), placeKind: tok.placeKind === "zone" ? "zone" : "hotel", airport: String(tok.airport || ""), trip: t, people: Number(tok.people) || 1, vehicle: String(tok.vehicle), seats: seats,
        hotel2: String(tok.hotel2 || ""), zone2: String(tok.zone2 || ""), place2: String(tok.place2 || ""), place2Kind: tok.place2Kind === "zone" ? "zone" : "hotel",
        date: String(tok.date || ""), date2: String(tok.date2 || ""), flightIn: String(tok.flightIn || ""), flightOut: String(tok.flightOut || ""),
        timeIn: needIn ? timeText(tok.timeIn) : "", timeOut: needOut ? timeText(tok.timeOut) : "", time: isHotel ? timeText(tok.time) : "",
        note: gu.note, ref: ref, customer: { first: who.first, last: who.last, email: gu.email, phone: gu.phone } };
    }
    function fail(msg) {
      opening = false; unmountStripe(); g.stripe.innerHTML = "";
      var retry = el("button", "btn btn-outline btn-sm", "Try again"); retry.type = "button"; retry.addEventListener("click", openPayment); g.stripe.appendChild(retry);
      alertBox(root, msg + " Try again, or send the same booking by WhatsApp and we'll confirm it by hand.", retry, sendWhatsApp);
    }
    function openPayment() {
      if (opening) return; opening = true;
      unmountStripe(); clearAlertIn(g.pay);
      placeholder(C.payOpening || "Opening the card form");
      if (PREVIEW) { opening = false; placeholder("Preview only: on the live site Stripe's card form (Apple Pay, Google Pay, card) opens here."); return; }
      var canEmbed = typeof window.Stripe === "function";
      var b = body(canEmbed ? "embedded" : "hosted");
      track("tr_checkout", { ride: String(tok.ride || ""), vehicle: b.vehicle, total: price, code: ref });
      fetch(FN + "tr-checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) })
        .then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j || {} }; }); })
        .then(function (x) {
          if (x.j.clientSecret && x.j.publishableKey && canEmbed) {
            stripeObj = stripeObj || window.Stripe(x.j.publishableKey);
            var create = stripeObj.createEmbeddedCheckoutPage || stripeObj.initEmbeddedCheckout;
            if (!create) throw new Error("The card form didn't open.");
            return create.call(stripeObj, { fetchClientSecret: function () { return Promise.resolve(x.j.clientSecret); } }).then(function (co) {
              mounted = co; g.stripe.innerHTML = ""; co.mount("#ck-stripe"); opening = false;
            });
          }
          if (x.j.url) { window.location.href = x.j.url; return; }
          throw new Error(x.j.error || "The card form didn't open.");
        })
        .catch(function (err) { fail(err && err.message ? err.message : "Something went wrong."); });
    }
    if (!isPay) {
      /* page one: check the details, keep them for the session, then walk to the pay page with the same ride in the URL */
      markSteps(2);
      g.form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var cp = contactProblem(); if (cp) { alertBox(root, cp.t, g.go, null); focusEl(cp.f); return; }
        if (tok.date < today) { alertBox(root, "That date has passed. Search again with a new date.", g.go, null); return; }
        clearAlertIn(g.guest);
        var o = {}; fields.forEach(function (x) { o[x.id] = x.value; }); session("gv_tr_guest", JSON.stringify(o));
        track("tr_details", { ride: String(tok.ride || ""), code: ref });
        if (PREVIEW) { if (window.GV_TR_PREVIEW_GO) window.GV_TR_PREVIEW_GO("pay"); return; }
        window.location.href = BASE + "/pay?b=" + encodeToken(tok);
      });
      return;
    }
    /* the pay page: the guest's details came from page one. Without them there is nothing to put on the booking,
       so send them back rather than opening a card form the function would refuse. */
    markSteps(3);
    var gu0 = guest();
    if (!gu0.name || !EMAIL.test(gu0.email) || !gu0.phone) { bail(C.noGuest || "", C.noGuestText || "", C.noGuestCta || "", detailsUrl); return; }
    g.rowGuestT.textContent = gu0.name;
    g.rowGuestD.textContent = [gu0.email, gu0.phone, gu0.note ? "note: " + gu0.note : "no note for the driver"].join(" · ");
    /* no scrolling on arrival: the guest needs to see the step indicator and the title first, and on desktop the
       card form is already beside them */
    openPayment();
  }

  /* ================= booked page ================= */
  function initBooked(root) {
    var main = $("#booked", root); if (!main) return;
    var q = new URLSearchParams(location.search), sid = q.get("session_id");
    function show(state, data) {
      main.setAttribute("data-state", state);
      $$(".state", main).forEach(function (s) { s.hidden = s.getAttribute("data-for") !== state; });
      if (data) {
        var sfx = state === "pending" ? "-p" : "-t";
        var dl = $("#bk-details" + sfx, main);
        if (dl) { dl.innerHTML = ""; [["Ride", data.product], ["When", data.when], ["People", data.guests], ["Where", data.pickup], ["Paid", data.total]].forEach(function (kv) { if (!kv[1]) return; var dt = document.createElement("dt"); dt.textContent = kv[0]; var dd = document.createElement("dd"); dd.textContent = kv[1]; dl.appendChild(dt); dl.appendChild(dd); }); }
        var r = $("#bk-ref" + sfx, main); if (r) r.textContent = data.ref || "";
        var emt = $("#bk-email-t", main); if (emt) emt.textContent = data.email || "your email";
        var w = $("#bk-wa", main); if (w && data.ref) w.href = waUrl("Hi Golden Vacation! I've just booked an airport transfer on your website and I have a question. Ref " + data.ref);
      }
    }
    if (PREVIEW) { show("team", { product: "Montego Bay airport to Negril, private car up to 3, airport to hotel", when: "Arrives Sat 19 Dec 2026 on AA1497 at 2:35pm", guests: "2 people", pickup: "Royalton Negril", total: "US$95", ref: "GV-TR-K7Q2", email: "guest@example.com" }); return; }
    if (!sid) { show("unknown"); return; }
    var tries = 0;
    (function poll() {
      fetch(FN + "exp-status?session_id=" + encodeURIComponent(sid)).then(function (r) { return r.json(); }).then(function (j) {
        if (!j || !j.ok) { show("unknown"); return; }
        if (j.status === "CONFIRMED") { show("team", j); return; }
        if (j.status === "NEEDS_ATTENTION" || j.status === "PENDING_SUPPLIER" || j.status === "UNPAID" || tries > 12) { show(j.status === "UNPAID" ? "unknown" : "pending", j); return; }
        tries++; setTimeout(poll, 2500);
      }).catch(function () { if (++tries > 12) show("unknown"); else setTimeout(poll, 3000); });
    })();
  }

  function init(root) {
    root = root || document;
    if (root !== document) { if (root.getAttribute("data-inited")) return; root.setAttribute("data-inited", "1"); }
    var X = window.GV_TR || {};
    if (X.page === "transfers") initTransfers(root);
    else if (X.page === "checkout") initCheckout(root, false);
    else if (X.page === "pay") initCheckout(root, true);
    else if (X.page === "booked") initBooked(root);
  }
  window.GV_TR_INIT = init;
  if (!PREVIEW) init(document);
})();

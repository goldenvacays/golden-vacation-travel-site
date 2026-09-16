/* Airport transfers. Runs after getaways.js (currency toggle), home.js (mobile menu) and transfers-rates.js (the prices). Dependency-free.
   Search (hotel, airport, way, people, dates and flight times) -> a table of vehicles with a price each -> Choose -> name and card.
   Prices come from window.GV_TR_RATES: a hotel's own row where it has one, otherwise its zone. tr-checkout recomputes the price
   from the same data before the card page opens; anything the site can't price goes to WhatsApp instead. */
(function () {
  "use strict";
  var CFG = window.GV_CONFIG || {};
  var RATE = CFG.jmdRate || 160;
  var WA = CFG.whatsapp || "18763601567";
  var PREVIEW = !!CFG.preview;
  var FN = "/.netlify/functions/";

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
  var FLIGHT = /^[A-Z0-9]{2,3}\s?\d{1,4}[A-Z]?$/;
  var TIME = /^(1[0-2]|0?[1-9])(:[0-5]\d)?\s*(am|pm)$/i;
  var TOWN_ALIASES = { "montego bay": " mobay ", "ocho rios": " ochi " };
  function focusEl(f) { if (!f) return; try { f.focus({ preventScroll: true }); } catch (e) { try { f.focus(); } catch (e2) {} } }
  function scrollTo(elm) { if (elm && elm.scrollIntoView) elm.scrollIntoView({ behavior: "smooth", block: "start" }); }
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  var SVG = { check: '<path d="M20 6L9 17l-5-5"></path>', users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"></path>', bag: '<path d="M6 7h12l1 14H5L6 7z"></path><path d="M9 7V5a3 3 0 0 1 6 0v2"></path>', arrow: '<path d="M5 12h14"></path><path d="M13 6l6 6-6 6"></path>', chat: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>' };
  function icon(name, size) { var s = size || 16; return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;display:block">' + SVG[name] + "</svg>"; }

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
      checkout: $("#checkout", root), ckSum: $("#ck-sum", root), book: $("#book", root), first: $("#pf-first", root), last: $("#pf-last", root), email: $("#pf-email", root), phone: $("#pf-phone", root), note: $("#pf-note", root),
      preview: $("#pf-preview", root), msg: $("#msg-preview", root), cta: $("#cta", root), ctaLabel: $("#cta-label", root), ctaSub: $("#cta-sub", root), ctaAlt: $("#cta-alt", root), ctaWa: $("#cta-wa", root),
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
    /* the time boxes are native pickers: the value comes back as 24-hour "14:35", the driver and the checkout get "2:35pm" */
    function timeText(input) {
      if (!input) return "";
      var v = input.value.trim().toLowerCase().replace(/\s+/g, "");
      var m = v.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
      if (!m) return v; /* already "2:35pm" (a browser without a time picker falls back to a text box) */
      var h = Number(m[1]), ap = h >= 12 ? "pm" : "am";
      return (h % 12 || 12) + ":" + m[2] + ap;
    }

    /* ---- prices for the search: the hotel's own row, or its zone ---- */
    function offersFor() {
      if (!st.zone || isHotel()) return null;
      var airport = e.airport.value, t = trip();
      var byHotel = st.placeMode === "hotel" && st.place.rate && RATES.rates[st.place.rate] && RATES.rates[st.place.rate][airport] && RATES.rates[st.place.rate][airport][t];
      var byZone = RATES.zones[st.zone] && RATES.zones[st.zone][airport] && RATES.zones[st.zone][airport][t];
      var list = byHotel || byZone || null;
      return list ? list.map(function (o) { return { v: o[0], seats: o[1], bags: o[2], price: o[3], exact: !!byHotel }; }) : null;
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
      if (isHotel()) return (e.date.value ? longDate(e.date.value) : "") + (timeText(e.time) ? " at " + timeText(e.time) : "");
      var parts = [];
      if (needIn()) parts.push("Arrives " + longDate(e.date.value) + (e.flightIn.value ? " on " + e.flightIn.value.trim().toUpperCase() : "") + (timeText(e.time) ? " at " + timeText(e.time) : ""));
      if (needOut()) { var fo = needIn() ? e.flightOut : e.flightIn, to = needIn() ? e.time2 : e.time; parts.push("Departs " + longDate(needIn() ? e.date2.value : e.date.value) + (fo.value ? " on " + fo.value.trim().toUpperCase() : "") + (timeText(to) ? " at " + timeText(to) : "")); }
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
      if (isHotel()) { if (!TIME.test(timeText(e.time))) return { f: e.time, t: "What time should the driver come?" }; return null; }
      if (needIn()) {
        if (!FLIGHT.test(e.flightIn.value.trim().toUpperCase())) return { f: e.flightIn, t: "We need the arriving flight number, e.g. AA1497." };
        if (!TIME.test(timeText(e.time))) return { f: e.time, t: "What time does it land?" };
      }
      if (trip() === "out") { /* one way out uses the first row's boxes, relabelled */
        if (!FLIGHT.test(e.flightIn.value.trim().toUpperCase())) return { f: e.flightIn, t: "We need the departing flight number, e.g. AA1496." };
        if (!TIME.test(timeText(e.time))) return { f: e.time, t: "What time does it take off?" };
      }
      if (trip() === "both") {
        if (!e.date2.value) return { f: e.date2, t: "Pick your departure date.", cal: 1 };
        if (e.date2.value < e.date.value) return { f: e.date2, t: "The departure is before the arrival.", cal: 1 };
        if (!FLIGHT.test(e.flightOut.value.trim().toUpperCase())) return { f: e.flightOut, t: "We need the departing flight number, e.g. AA1496." };
        if (!TIME.test(timeText(e.time2))) return { f: e.time2, t: "What time does it take off?" };
      }
      return null;
    }
    function contactProblem() {
      if (!(e.first.value || "").trim() || !(e.last.value || "").trim()) return { f: e.first, t: "We need a first and last name for the booking." };
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((e.email.value || "").trim())) return { f: e.email, t: "That email doesn't look right." };
      if (!(e.phone.value || "").trim()) return { f: e.phone, t: "We need a phone or WhatsApp number, for the driver." };
      return null;
    }
    function alertBox(text, anchor, offerWa) {
      var box = $("#tr-alert", root);
      if (box && box.nextSibling !== anchor) { box.remove(); box = null; }
      if (!box) { box = el("div", ""); box.id = "tr-alert"; box.setAttribute("role", "alert"); anchor.parentNode.insertBefore(box, anchor); }
      box.innerHTML = ""; box.appendChild(document.createTextNode(text + " "));
      if (offerWa) { var a = el("a", "", "Send by WhatsApp"); a.href = "#"; a.style.cssText = "text-decoration:underline;color:inherit;font-weight:800"; a.addEventListener("click", function (ev) { ev.preventDefault(); sendWhatsApp(); }); box.appendChild(a); }
    }
    function clearAlert() { var box = $("#tr-alert", root); if (box) box.remove(); }

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
      e.rNote.textContent = list ? (list[0] && list[0].exact ? "Prices for this hotel, per vehicle, taxes included" : "Prices for the " + ZONE[st.zone].name + " area, per vehicle, taxes included") : "";
      e.rTable.innerHTML = "";
      var quoteWhy = isHotel() ? "quote" : !list ? "noroute" : n > MAXG ? "big" : !rows.length ? "none" : "";
      if (quoteWhy) {
        var q = el("div", "rt-row quote");
        var qt = el("div", "rt-veh"); qt.appendChild(el("b", "", quoteWhy === "big" || quoteWhy === "none" ? "Two vehicles or a bus" : "Priced in the chat"));
        qt.appendChild(el("small", "", quoteWhy === "big" || quoteWhy === "none" ? C.results.none : C.results.quote)); q.appendChild(qt);
        var qg = el("div", "rt-go"); var qb = el("button", "btn btn-black btn-sm"); qb.type = "button"; qb.innerHTML = "Ask on WhatsApp" + icon("chat", 16); qb.addEventListener("click", function () { st.pick = null; sendWhatsApp(); }); qg.appendChild(qb); q.appendChild(qg);
        e.rTable.appendChild(q);
      } else {
        rows.forEach(function (o) {
          var row = el("div", "rt-row" + (st.pick && st.pick.v === o.v && st.pick.seats === o.seats ? " pick" : ""));
          var veh = el("div", "rt-veh"); veh.appendChild(el("b", "", VEH[o.v] ? VEH[o.v].label : o.v)); veh.appendChild(el("small", "", VEH[o.v] ? VEH[o.v].sub : "")); row.appendChild(veh);
          var cap = el("div", "rt-cap"); var c1 = el("span"); c1.innerHTML = icon("users", 15) + "up to " + o.seats + " people"; var c2 = el("span"); c2.innerHTML = icon("bag", 15) + o.bags + " bags"; cap.appendChild(c1); cap.appendChild(c2); row.appendChild(cap);
          var inc = el("div", "rt-inc" + (trip() === "both" ? "" : " one"));
          var cols = trip() === "both" ? [["Arrival", (INC.in || []).concat(INC.all || [])], ["Departure", INC.out || []]] : [[trip() === "out" ? "Departure" : "Arrival", (INC[trip()] || []).concat(INC.all || [])]];
          cols.forEach(function (col) { var cc = el("div", "rt-inc-col"); cc.appendChild(el("b", "", col[0])); col[1].forEach(function (line) { var sp = el("span"); sp.innerHTML = icon("check", 13) + "<i></i>"; sp.lastChild.replaceWith(document.createTextNode(line)); cc.appendChild(sp); }); inc.appendChild(cc); });
          row.appendChild(inc);
          var pr = el("div", "rt-price"); var pb = el("b"); var pu = el("span", "usd-v", usd(o.price)); var pj = el("span", "jmd-v", jmdOf(o.price)); pb.appendChild(pu); pb.appendChild(pj); pr.appendChild(pb); pr.appendChild(el("small", "", trip() === "both" ? "round trip, per vehicle" : "one way, per vehicle")); row.appendChild(pr);
          var go = el("div", "rt-go"); var b = el("button", "btn btn-black btn-sm"); b.type = "button"; b.innerHTML = C.results.choose + icon("arrow", 16); b.addEventListener("click", function () { choose(o); }); go.appendChild(b); row.appendChild(go);
          e.rTable.appendChild(row);
        });
      }
      if (e.rSharedWa) e.rSharedWa.href = waUrl("Hi Golden Vacation! Is there a shared shuttle for " + rideLabel() + " on " + longDate(e.date.value) + ", " + peopleText() + "? Ref " + st.ref);
    }

    /* ---- Choose -> the checkout card ---- */
    function choose(o) {
      st.pick = o; renderResults(); renderCheckout(); clearAlert();
      e.checkout.hidden = false; scrollTo(e.checkout); setTimeout(function () { focusEl(e.first); }, 500);
      track("tr_choose", { ride: rideLabel(), vehicle: o.v, seats: o.seats, price: o.price, code: st.ref });
    }
    function renderCheckout() {
      var o = st.pick; if (!o) { e.checkout.hidden = true; return; }
      e.ckSum.innerHTML = "";
      e.ckSum.appendChild(el("b", "hh", (VEH[o.v] ? VEH[o.v].label : o.v) + ", up to " + o.seats));
      e.ckSum.appendChild(el("div", "", rideLabel() + (driveText() ? ", " + driveText() : "")));
      e.ckSum.appendChild(el("div", "", isHotel() ? placeText() + " to " + place2Text() : placeText()));
      e.ckSum.appendChild(el("div", "", whenText()));
      e.ckSum.appendChild(el("div", "", peopleText() + ", " + o.bags + " bags"));
      var tot = el("div", "ck-total"); tot.appendChild(document.createTextNode("Total ")); var tb = el("b", "", usd(o.price)); tot.appendChild(tb); tot.appendChild(document.createTextNode(trip() === "both" ? ", round trip, taxes included" : ", taxes included")); e.ckSum.appendChild(tot);
      var ch = el("button", "link-btn", "Change the ride"); ch.type = "button"; ch.addEventListener("click", function () { scrollTo(e.results); }); e.ckSum.appendChild(ch);
      e.preview.hidden = true; e.ctaLabel.textContent = C.checkout.cta; e.ctaSub.textContent = C.checkout.ctaSub; e.ctaAlt.hidden = false;
    }

    /* ---- WhatsApp, for anything the site can't price or the guest prefers ---- */
    function message() {
      var o = st.pick, lines = ["Hi Golden Vacation! Airport transfer request."];
      lines.push("Ride: " + rideLabel() + (driveText() ? ", " + driveText() : ""));
      lines.push(isHotel() ? "From: " + placeText() + "\nTo: " + place2Text() : "Staying at: " + placeText());
      lines.push("When: " + whenText());
      lines.push("People: " + peopleText() + (o ? ", " + (VEH[o.v] ? VEH[o.v].label.toLowerCase() : o.v) + " (up to " + o.seats + ")" : ""));
      if (o) lines.push("Price on the site: " + usd(o.price) + (trip() === "both" ? " round trip" : " one way")); else lines.push("Please price it for us.");
      if ((e.note.value || "").trim()) lines.push("Note: " + e.note.value.trim());
      var who = [(e.first.value || "").trim(), (e.last.value || "").trim()].filter(Boolean).join(" "); if (who) lines.push("Name: " + who);
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

    /* ---- card checkout: the function recomputes the price from the same data ---- */
    function checkout() {
      var cp = contactProblem(); if (cp) { alertBox(cp.t, e.cta); focusEl(cp.f); return; }
      if (!st.pick) { alertBox("Pick a vehicle first.", e.cta); scrollTo(e.results); return; }
      if (PREVIEW) { alertBox("Preview only: on the live site this opens the card page.", e.cta); return; }
      e.cta.disabled = true; e.ctaLabel.textContent = "Opening the payment page";
      var body = { hotel: st.placeMode === "hotel" ? st.place.slug : "", zone: st.zone, place: placeText(), placeKind: st.placeMode, airport: e.airport.value, trip: trip(), people: people(), vehicle: st.pick.v, seats: st.pick.seats,
        date: e.date.value, date2: trip() === "both" ? e.date2.value : "", flightIn: needIn() ? e.flightIn.value.trim().toUpperCase() : "", flightOut: trip() === "out" ? e.flightIn.value.trim().toUpperCase() : trip() === "both" ? e.flightOut.value.trim().toUpperCase() : "",
        timeIn: needIn() ? timeText(e.time) : "", timeOut: trip() === "out" ? timeText(e.time) : trip() === "both" ? timeText(e.time2) : "", time: isHotel() ? timeText(e.time) : "",
        note: (e.note.value || "").trim(), ref: st.ref, customer: { first: e.first.value.trim(), last: e.last.value.trim(), email: e.email.value.trim(), phone: e.phone.value.trim() } };
      track("tr_checkout", { ride: rideLabel(), vehicle: body.vehicle, total: st.pick.price, code: st.ref });
      fetch(FN + "tr-checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j }; }); })
        .then(function (x) { if (x.j && x.j.url) { window.location.href = x.j.url; return; } throw new Error((x.j && x.j.error) || "The payment page didn't open."); })
        .catch(function (err) { e.cta.disabled = false; e.ctaLabel.textContent = C.checkout.cta; alertBox((err && err.message ? err.message : "Something went wrong.") + " You can send the same booking by WhatsApp and we'll confirm it by hand.", e.cta, true); });
    }

    /* ---- the hotel pickers: where they stay, and where a hotel-to-hotel ride goes ---- */
    function searchText(h) { var s = " " + h.name.toLowerCase() + " " + (h.alias ? h.alias.toLowerCase() + " " : ""); Object.keys(TOWN_ALIASES).forEach(function (k) { if (s.indexOf(k) >= 0) s += TOWN_ALIASES[k]; }); return s; }
    function zoneRows(q) { var qq = (q || "").toLowerCase().trim(); return ZONES.filter(function (z) { if (!qq) return true; var t = " " + z.name.toLowerCase() + " " + z.airbnb.toLowerCase() + " " + (z.aliases || []).join(" ") + " airbnb villa apartment guesthouse area "; return t.indexOf(qq) >= 0; }); }
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
    function afterChange() { if (st.searched) { st.searched = null; st.pick = null; e.results.hidden = true; e.checkout.hidden = true; } }
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
      if (p) { alertBox(p.t, e.go.parentNode); if (p.cal != null && cals[p.cal]) cals[p.cal].open(); else focusEl(p.f); return; }
      clearAlert(); st.searched = { at: Date.now() }; st.pick = null; e.checkout.hidden = true;
      renderResults(); scrollTo(e.results);
      track("tr_search", { ride: rideLabel(), trip: trip(), people: people(), exact: !!(st.place && st.place.rate) });
    });
    e.book.addEventListener("submit", function (ev) { ev.preventDefault(); checkout(); });
    e.ctaWa.addEventListener("click", function (ev) { ev.preventDefault(); sendWhatsApp(); });

    /* ---- what the URL and the last visit already know ---- */
    var q = new URLSearchParams(location.search);
    var want = q.get("hotel") || store("gv_hotel"), h0 = want ? HOTELS.filter(function (h) { return h.slug === want; })[0] : null;
    if (h0) { st.placeMode = "hotel"; st.place = h0; st.zone = h0.zone; }
    if (q.get("airport") && AIR[q.get("airport")]) e.airport.value = q.get("airport");
    /* the home page search hands over here with the hotel typed as text, the people and the arrival date */
    var qText = (q.get("q") || "").trim(), handed = false, pendingText = "";
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
    var pq = parseInt(q.get("people") || "", 10);
    if (pq >= 1 && pq <= MAXG + 1) { e.people.value = String(pq); handed = true; }
    var dq = q.get("date") || "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(dq) && dq >= today) { e.date.value = dq; if (cals[0]) cals[0].refresh(); handed = true; }
    renderForm();
    if (pendingText) e.hotelIn.value = pendingText; /* after renderForm, which paints the box from the state; the list opens on focus, filtered to the text */
    if (handed) setTimeout(function () {
      scrollTo(e.form);
      if (!st.zone) focusEl(e.hotelIn);
      else if (st.placeMode === "zone" && !st.placeName && e.name) focusEl(e.name);
      else focusEl(e.flightIn);
    }, 80);
    if (q.get("cancelled")) alertBox("The payment page was closed. Nothing was charged. Search again and the prices are still here.", e.go.parentNode);
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
    else if (X.page === "booked") initBooked(root);
  }
  window.GV_TR_INIT = init;
  if (!PREVIEW) init(document);
})();

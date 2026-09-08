/* Golden Experiences. Runs after getaways.js (currency toggle) and home.js (mobile menu). Dependency-free. */
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
  function jmd(n) { return "J$" + fmt(n); }
  function jmdOf(n) { return "≈ J$" + fmt(Math.round((n * RATE) / 100) * 100); }
  function track(name, params) {
    try { if (typeof window.gtag === "function") window.gtag("event", name, params || {}); } catch (e) {}
    try { if (typeof window.plausible === "function") window.plausible(name, { props: params || {} }); } catch (e) {}
  }
  function ref() { return "GV-EXP-" + Math.random().toString(36).slice(2, 6).toUpperCase(); }
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  function parseDate(s) { if (!s) return null; var p = s.split("-"); if (p.length !== 3) return null; return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }
  function longDate(s) { var d = parseDate(s); if (!d) return ""; return DAYS[d.getUTCDay()] + " " + d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear(); }
  function todayISO() { return (window.GV_EXP && window.GV_EXP.today) || new Date().toISOString().slice(0, 10); }
  function waUrl(text) { return "https://wa.me/" + WA + "?text=" + encodeURIComponent(text); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }

  /* ---- hotels and drive times (same rule as the build: area anchor, nudged by the hotel's position) ---- */
  function kmBetween(a, b) { var R = 6371, dLat = (b.lat - a.lat) * Math.PI / 180, dLng = (b.lng - a.lng) * Math.PI / 180; var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2); return 2 * R * Math.asin(Math.sqrt(x)); }
  function driveMin(hotel, venue, regions) {
    var anchor = venue.drive && venue.drive[hotel.region]; if (anchor == null) return null;
    var centre = regions[hotel.region]; if (!centre) return anchor;
    var nudge = Math.max(-20, Math.min(20, (kmBetween(hotel, venue) - kmBetween(centre, venue)) * 1.2));
    return Math.max(5, Math.round((anchor + nudge) / 5) * 5);
  }
  function driveLabel(m) { if (m == null) return ""; if (m < 60) return "about " + m + " min"; var h = Math.floor(m / 60), r = m % 60; return "about " + h + " h" + (r ? " " + (r < 10 ? "0" + r : r) : ""); }
  function hotelsOf(X) { return (X.hotels || []).map(function (h) { return { name: h[0], slug: h[1], region: h[2], lat: h[3], lng: h[4] }; }); }
  function savedHotel(X) { var slug = store("gv_hotel"); if (!slug) return null; return hotelsOf(X).filter(function (h) { return h.slug === slug; })[0] || null; }

  /* ================= hub: doors, categories, area ================= */
  function initHub(root) {
    var grid = $("#vgrid", root); if (!grid) return;
    var cards = $$(".vcard", grid), empty = $("#vempty", root), note = $("#cat-note", root);
    var state = { cat: "all", area: "all", door: "" };
    var doorText = { stay: "Everything below can be added to a stay. Hotel pickup where the tour includes it; ask us to bundle it with the room.", port: "Near the ports: Falmouth for the Ocean resorts, Ocho Rios for Mystic Mountain and Poko Loko, Montego Bay for the Rose Hall day passes. Tell us your all-aboard time.", locals: "Resident rates in J$ where they exist, with a Jamaican ID at the gate. Everything else is the same published price for everyone." };
    var baseNote = note ? note.textContent : "";
    function apply() {
      var shown = 0;
      cards.forEach(function (c) {
        var ok = (state.cat === "all" || (c.getAttribute("data-cats") || "").split(" ").indexOf(state.cat) >= 0)
          && (state.area === "all" || c.getAttribute("data-area") === state.area)
          && (!state.door || (c.getAttribute("data-doors") || "").split(" ").indexOf(state.door) >= 0);
        c.hidden = !ok; if (ok) shown++;
      });
      if (empty) empty.hidden = shown > 0;
      if (note) note.textContent = state.door && doorText[state.door] ? doorText[state.door] : baseNote;
      $$(".cat-chips .chip", root).forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-cat") === state.cat ? "true" : "false"); });
      $$("[data-door]", root).forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-door") === state.door ? "true" : "false"); });
      var sel = $("#area-pick", root); if (sel && sel.value !== state.area) sel.value = state.area;
    }
    $$(".cat-chips .chip", root).forEach(function (b) { b.addEventListener("click", function () { state.cat = b.getAttribute("data-cat"); state.door = ""; apply(); track("exp_filter", { cat: state.cat }); }); });
    var sel = $("#area-pick", root); if (sel) sel.addEventListener("change", function () { state.area = sel.value; apply(); track("exp_filter", { area: state.area }); });
    $$("[data-door]", root).forEach(function (b) {
      b.addEventListener("click", function () {
        var d = b.getAttribute("data-door");
        state.door = state.door === d && b.classList.contains("edoor") ? "" : d;
        state.cat = "all";
        apply();
        var target = $("#all", root); if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
        track("exp_door", { door: d });
      });
    });
    var clear = $("#clear-filters", root); if (clear) clear.addEventListener("click", function () { state = { cat: "all", area: "all", door: "" }; apply(); });
    var h = (location.hash || "").slice(1);
    if (h === "stay" || h === "port" || h === "locals") { state.door = h; }

    /* hotel picker: drive times on every card, nearest first */
    var X = window.GV_EXP || {}, HOTELS = hotelsOf(X), VEN = {}; (X.venues || []).forEach(function (v) { VEN[v.slug] = v; });
    var hIn = $("#hotel-in", root), hList = $("#hotel-list", root), hClear = $("#hotel-clear", root), dist = $("#dist-chips", root), hNote = $("#hotel-note", root), heading = $(".cat-head h2", root);
    var hotel = null, maxMin = 0, cursor = -1, baseHeading = heading ? heading.textContent : "";
    function labelFor(v) { return hotel ? driveMin(hotel, VEN[v.getAttribute("data-slug")] || {}, X.regions || {}) : null; }
    function applyHotel() {
      cards.forEach(function (c) {
        var t = $(".drive-tag", c), m = labelFor(c);
        if (t) { t.hidden = !hotel || m == null; t.textContent = m == null ? "" : driveLabel(m); }
        c.setAttribute("data-min", m == null ? 9999 : m);
        c.classList.toggle("too-far", !!(hotel && maxMin && (m == null || m > maxMin)));
      });
      if (hotel) { var sorted = cards.slice().sort(function (a, b) { return (+a.getAttribute("data-min")) - (+b.getAttribute("data-min")); }); sorted.forEach(function (c) { grid.appendChild(c); }); }
      if (heading) heading.textContent = hotel ? "Days out near " + hotel.name + "." : baseHeading;
      if (dist) dist.hidden = !hotel;
      if (hClear) hClear.hidden = !hotel;
      root.classList ? root.classList.toggle("hotel-on", !!hotel) : null;
      if (hNote) hNote.innerHTML = hotel ? "Drive times from " + hotel.name + " are rounded and say about. Traffic and the road decide the rest. <a href=\"" + (X.base || "/experiences") + "/near/" + hotel.slug + "\">Open the page for " + hotel.name + "</a>." : "Pick your hotel and every card shows the drive time from it, nearest first. Not staying yet? <a href=\"/hotel-status\">See which resorts are open</a>.";
      apply();
    }
    var applyBase = apply;
    apply = function () { applyBase(); if (hotel && maxMin) { var shown = 0; cards.forEach(function (c) { if (!c.hidden && c.classList.contains("too-far")) c.hidden = true; if (!c.hidden) shown++; }); if (empty) empty.hidden = shown > 0; } };
    function setHotel(hh, save) { hotel = hh; if (hIn) hIn.value = hh ? hh.name : ""; if (save) store("gv_hotel", hh ? hh.slug : null); closeList(); applyHotel(); if (hh) track("exp_hotel", { hotel: hh.slug }); }
    function closeList() { if (hList) { hList.hidden = true; hList.innerHTML = ""; } cursor = -1; }
    function openList(q) {
      if (!hList) return; var qq = q.toLowerCase().trim();
      var hits = HOTELS.filter(function (hh) { return !qq || hh.name.toLowerCase().indexOf(qq) >= 0; }).slice(0, 8);
      hList.innerHTML = ""; cursor = -1;
      if (!hits.length) { var li = document.createElement("li"); li.className = "none"; li.textContent = "Not on our list yet. Tell us on WhatsApp and we'll price from there."; hList.appendChild(li); }
      hits.forEach(function (hh) { var li = document.createElement("li"); li.setAttribute("role", "option"); li.innerHTML = "<span></span><small></small>"; li.firstChild.textContent = hh.name; li.lastChild.textContent = (X.regions && X.regions[hh.region] ? X.regions[hh.region].label : hh.region); li.addEventListener("mousedown", function (e) { e.preventDefault(); setHotel(hh, true); }); hList.appendChild(li); });
      hList.hidden = false;
    }
    if (hIn) {
      hIn.addEventListener("input", function () { openList(hIn.value); });
      hIn.addEventListener("focus", function () { openList(hIn.value); });
      hIn.addEventListener("blur", function () { setTimeout(closeList, 150); });
      hIn.addEventListener("keydown", function (e) {
        var items = $$("li[role=option]", hList);
        if (e.key === "ArrowDown") { e.preventDefault(); cursor = Math.min(items.length - 1, cursor + 1); }
        else if (e.key === "ArrowUp") { e.preventDefault(); cursor = Math.max(0, cursor - 1); }
        else if (e.key === "Enter") { e.preventDefault(); var pick = items[cursor >= 0 ? cursor : 0]; if (pick) pick.dispatchEvent(new MouseEvent("mousedown")); return; }
        else if (e.key === "Escape") { closeList(); return; }
        items.forEach(function (li, i) { li.setAttribute("aria-selected", i === cursor ? "true" : "false"); });
      });
    }
    if (hClear) hClear.addEventListener("click", function () { maxMin = 0; $$("#dist-chips .chip", root).forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-max") === "0" ? "true" : "false"); }); setHotel(null, true); });
    $$("#dist-chips .chip", root).forEach(function (b) { b.addEventListener("click", function () { maxMin = +b.getAttribute("data-max"); $$("#dist-chips .chip", root).forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); }); applyHotel(); track("exp_distance", { max: maxMin }); }); });
    var qs = new URLSearchParams(location.search).get("hotel");
    var pre = qs ? HOTELS.filter(function (hh) { return hh.slug === qs; })[0] : savedHotel(X);
    if (pre) setHotel(pre, !!qs); else apply();
  }

  /* ================= venue: options, panel, booking ================= */
  function initVenue(root) {
    var X = window.GV_EXP || {}; var V = X.venue; if (!V) return;
    var panel = $("#panel", root), form = $("#book", root); if (!panel || !form) return;
    var isFlight = V.panel === "flight", isTour = V.panel === "tour", live = V.calendar === "rezdy";
    var MAX_GUESTS = 16; // bigger parties go by email, the note under the steppers says so // live: JamWest's Rezdy calendar; otherwise paid = confirmed, the team sends the details
    var today = todayISO();
    var products = {}; V.products.forEach(function (p) { products[p.id] = p; });
    var el = {
      total: $("#total-lead", root), totalSub: $("#total-sub", root), caption: $("#total-caption", root),
      date: $("#pf-date", root), date2: $("#pf-date2", root), dateNote: $("#date-note", root),
      timesWrap: $("#pf-times-wrap", root), times: $("#pf-times", root), timesNote: $("#times-note", root),
      adults: $("#adults", root), children: $("#children", root), childStep: $("#child-step", root), childNote: $("#child-note", root), adultUnit: $("#adult-unit", root), childUnit: $("#child-unit", root),
      pickupWrap: $("#pf-pickup-wrap", root), pickup: $("#pf-pickup", root), pickupAreaWrap: $("#pf-pickup-area-wrap", root), pickupOtherWrap: $("#pf-pickup-other-wrap", root), pickupHotel: $("#pf-pickup-hotel", root), hotelIn: $("#pf-hotel-in", root), hotelList: $("#pf-hotel-list", root), pickupNote: $("#pickup-note", root), previewWrap: $("#pf-preview", root),
      contact: $("#pf-contact", root), first: $("#pf-first", root), last: $("#pf-last", root), email: $("#pf-email", root), phone: $("#pf-phone", root), ship: $("#pf-ship", root),
      preview: $("#msg-preview", root), cta: $("#cta", root), ctaLabel: $("#cta-label", root), ctaSub: $("#cta-sub", root), ctaAlt: $("#cta-alt", root), ctaWa: $("#cta-wa", root),
      rateNote: $("#rate-note", root), flightIn: $("#pf-flight-in", root), flightOut: $("#pf-flight-out", root),
      stickyTotal: $("#sticky-total", root), stickySub: $("#sticky-sub", root), stickyCta: $("#sticky-cta", root),
    };
    var state = { product: null, rate: V.rates ? "visitor" : (V.products[0] && V.products[0].audience === "resident" ? "resident" : "visitor"), date: "", time: "", adults: 2, children: 0, pickup: V.pickups ? V.pickups[0].key : null, pickupMode: "hotel", pickupHotel: "", choices: {}, sessions: null, availOk: null, ref: ref() };
    var HOTELS = hotelsOf(X), REGIONS = X.regions || {};

    /* expired seasonal products (belt and braces: the build already drops them) */
    $$("[data-until]", root).forEach(function (o) { if (o.getAttribute("data-until") < today) { o.setAttribute("data-expired", ""); var r = $("input", o); if (r) r.checked = false; } });
    var first = $$(".op:not([data-expired]) input[name=product]", root)[0];
    if (first && !$$(".op:not([data-expired]) input[name=product]:checked", root).length) first.checked = true;

    function product() { return products[state.product] || null; }
    function rateOf(p) { if (!p) return "visitor"; if (p.audience === "resident") return "resident"; if (p.audience === "visitor") return "visitor"; return state.rate; }
    function instant() { var p = product(); return V.booking === "instant" && rateOf(p) === "visitor" && p && p.visitor && !p.request; }
    function isRequest() { var p = product(); return V.booking === "request" || (p && p.request); }
    function pickupOf() { if (!V.pickups) return null; for (var i = 0; i < V.pickups.length; i++) if (V.pickups[i].key === state.pickup) return V.pickups[i]; return V.pickups[0]; }
    function chosen() { var p = product(); if (!p || !p.choose) return []; return state.choices[p.id] || []; }

    function price() {
      var p = product(); if (!p) return { lead: usd(0), sub: "", total: 0, cur: "USD", note: "" };
      var r = rateOf(p), a = state.adults, c = state.children;
      if (p.perParty) { return { lead: usd(p.visitor.usd), sub: "for two", total: p.visitor.usd, cur: "USD", note: "Priced for two people, not per person." }; }
      if (r === "resident" && p.resident) {
        var childKnown = p.resident.jmdChild != null;
        var tot = a * p.resident.jmd + (childKnown ? c * p.resident.jmdChild : 0);
        return { lead: jmd(tot), sub: a + " adult" + (a === 1 ? "" : "s") + (c ? " + " + c + " child" + (c === 1 ? "" : "ren") : ""), total: tot, cur: "JMD", note: !childKnown && c ? "Children on the resident rate are priced when we confirm." : "Resident rate, Jamaican ID at the gate." };
      }
      if (p.visitor) {
        var pk = pickupOf(), add = pk ? (pk.add || 0) : 0, addC = pk ? (pk.addChild != null ? pk.addChild : add) : 0;
        var childKnownV = p.visitor.usdChild != null;
        var totV = a * (p.visitor.usd + add) + (childKnownV ? c * (p.visitor.usdChild + addC) : 0);
        return { lead: usd(totV), sub: a + " adult" + (a === 1 ? "" : "s") + (c ? " + " + c + " child" + (c === 1 ? "" : "ren") : ""), total: totV, cur: "USD", note: !childKnownV && c ? "Children are priced when we confirm." : (add ? "Includes " + usd(add) + " per person for pickup." : "") };
      }
      return { lead: "Price on request", sub: "", total: 0, cur: "USD", note: "" };
    }

    function dateProblem(iso) {
      if (!iso) return "";
      var d = parseDate(iso); if (!d) return "";
      if (iso < today) return "That date has passed.";
      if (V.closedWeekdays && V.closedWeekdays.indexOf(d.getUTCDay()) >= 0) return V.name + " is closed on " + DAYS[d.getUTCDay()] + "days. Pick another day and we'll price the same thing.";
      var md = iso.slice(5);
      if (V.blackout && V.blackout.indexOf(md) >= 0) return "Closed on that date. Pick another day.";
      var p = product(); if (p && p.until && iso > p.until) return "This offer ends on " + longDate(p.until) + ".";
      return "";
    }

    function message() {
      var p = product(); if (!p) return "";
      var pr = price(), lines = [];
      lines.push("Golden Experiences " + (instant() && (!live || state.availOk !== false) ? "booking" : "request") + " " + state.ref);
      lines.push(V.name);
      lines.push(p.name + (p.hours ? " (" + p.hours + ")" : ""));
      if (V.rates) lines.push("Rate: " + (rateOf(p) === "resident" ? "Resident, Jamaican ID at the gate" : "Visitor" + (V.pickups ? ", hotel pickup" : "")));
      if (isFlight) {
        var legs = p.legs || "both", d1 = state.date ? longDate(state.date) : "", d2 = el.date2 && el.date2.value ? longDate(el.date2.value) : "";
        var fi = el.flightIn ? el.flightIn.value.trim().toUpperCase() : "", fo = el.flightOut ? el.flightOut.value.trim().toUpperCase() : "";
        if (legs !== "out") lines.push("Arrives: " + (d1 || "date to confirm") + " on " + (fi || "flight to confirm"));
        if (legs !== "in") lines.push("Departs: " + ((legs === "both" ? d2 : d1) || "date to confirm") + " on " + (fo || "flight to confirm"));
      } else {
        lines.push("Date: " + (state.date ? longDate(state.date) : "flexible") + (state.time ? " at " + state.time : ""));
      }
      var g = state.adults + " adult" + (state.adults === 1 ? "" : "s") + (state.children ? ", " + state.children + " child" + (state.children === 1 ? "" : "ren") : "");
      if (p.perParty) g = "2 people";
      lines.push("Guests: " + g + (isFlight ? " (infants under 2 free)" : ""));
      if (V.pickups && rateOf(p) === "visitor") { var pk = pickupOf(); if (pk) lines.push("Pickup: " + (pk.key === "own" ? "making my own way" : (state.pickupHotel ? state.pickupHotel + " (" + pk.label + ")" : pk.label))); }
      var ch = chosen(); if (ch.length) lines.push("Choice: " + (p.choose.fixed ? p.choose.fixed + " + " : "") + ch.join(" + "));
      if (pr.total) lines.push("Total: " + pr.lead + (pr.alt ? " (" + pr.alt + ")" : "") + (pr.note ? ". " + pr.note : ""));
      else lines.push("Total: to be priced");
      var nm = [el.first && el.first.value.trim(), el.last && el.last.value.trim()].filter(Boolean).join(" ");
      if (nm) lines.push("Name: " + nm);
      if (el.ship && el.ship.value.trim()) lines.push("Cruise: " + el.ship.value.trim());
      lines.push("Sent from goldenvacays.com/experiences/" + V.slug);
      return lines.join("\n");
    }

    function renderTimes() {
      if (!el.times) return;
      var p = product(); el.times.innerHTML = "";
      var times = p ? (p.times || []) : [];
      if (el.timesWrap) el.timesWrap.hidden = !times.length && !(state.sessions && state.sessions.length);
      var list = state.sessions && state.sessions.length ? state.sessions : times.map(function (t) { return { time: t, seats: null }; });
      if (!list.length) return;
      if (!state.time || !list.some(function (s) { return s.time === state.time && s.seats !== 0; })) { var firstOk = list.filter(function (s) { return s.seats !== 0; })[0]; state.time = firstOk ? firstOk.time : ""; }
      list.forEach(function (s) {
        var b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.setAttribute("data-time", s.time);
        b.innerHTML = s.time + (s.seats != null && s.seats > 0 && s.seats < 6 ? "<small>" + s.seats + " left</small>" : "");
        if (s.seats === 0) { b.disabled = true; b.setAttribute("aria-disabled", "true"); }
        b.setAttribute("aria-pressed", s.time === state.time ? "true" : "false");
        b.addEventListener("click", function () { state.time = s.time; renderTimes(); render(); });
        el.times.appendChild(b);
      });
      if (el.timesNote) {
        if (state.availOk === false) { el.timesNote.hidden = false; el.timesNote.className = "pf-hint"; el.timesNote.textContent = "Live availability is offline right now, so we'll confirm the time by WhatsApp."; }
        else if (state.sessions && !state.sessions.length) { el.timesNote.hidden = false; el.timesNote.className = "pf-hint bad"; el.timesNote.textContent = "Nothing left on that date. Try another day, or ask us and we'll check with the park."; }
        else if (state.sessions) { el.timesNote.hidden = false; el.timesNote.className = "pf-hint ok"; el.timesNote.textContent = "Live availability from the park for " + longDate(state.date) + "."; }
        else { el.timesNote.hidden = true; }
      }
    }

    var availTimer = null;
    function loadAvailability() {
      state.sessions = null; state.availOk = null;
      if (!instant() || !state.date || dateProblem(state.date)) { renderTimes(); return; }
      if (!live) { state.availOk = true; renderTimes(); render(); return; }
      var p = product();
      if (PREVIEW) { state.sessions = (p.times || []).map(function (t, i) { return { time: t, seats: i === 1 ? 3 : 12 }; }); state.availOk = true; renderTimes(); render(); return; }
      clearTimeout(availTimer);
      availTimer = setTimeout(function () {
        var url = FN + "exp-availability?slug=" + encodeURIComponent(V.slug) + "&product=" + encodeURIComponent(p.id) + "&date=" + encodeURIComponent(state.date) + "&choice=" + encodeURIComponent(chosen().join("|"));
        if (el.timesNote) { el.timesNote.hidden = false; el.timesNote.className = "pf-hint"; el.timesNote.textContent = "Checking availability with the park…"; }
        fetch(url).then(function (r) { return r.json(); }).then(function (j) {
          if (!j || !j.ok) { state.availOk = false; state.sessions = null; }
          else { state.availOk = true; state.sessions = j.sessions || []; }
          renderTimes(); render();
        }).catch(function () { state.availOk = false; state.sessions = null; renderTimes(); render(); });
      }, 250);
    }

    function render() {
      var p = product(); if (!p) return;
      var r = rateOf(p), pr = price(), inst = instant();
      /* header */
      el.total.textContent = pr.lead; el.totalSub.textContent = pr.sub || "";
      el.caption.textContent = pr.alt ? pr.alt + (pr.note ? " · " + pr.note : "") : (pr.note || "");
      if (el.stickyTotal) el.stickyTotal.textContent = pr.lead;
      if (el.stickySub) el.stickySub.textContent = pr.sub || (p.perParty ? "for two" : "per person");
      /* rate radio visibility per product */
      var rateWrap = $("#pf-rate", root);
      if (rateWrap) { rateWrap.hidden = p.audience !== "everyone"; if (el.rateNote && V.rates) el.rateNote.textContent = V.rates[r === "resident" ? "resident" : "visitor"].note; }
      /* guests */
      var adultsOnly = !!V.adultsOnly;
      var childPrice = r === "resident" && p.resident ? p.resident.jmdChild : (p.visitor ? p.visitor.usdChild : null);
      if (el.childStep) {
        if (p.perParty) { $(".pf-guests", root).hidden = true; } else { $(".pf-guests", root).hidden = false; }
        if (adultsOnly) { el.childStep.setAttribute("data-off", ""); state.children = 0; el.children.value = 0; el.childNote.hidden = false; el.childNote.textContent = "Adults only at this one."; $$("button", el.childStep).forEach(function (b) { b.disabled = true; }); }
        else { el.childStep.removeAttribute("data-off"); $$("button", el.childStep).forEach(function (b) { b.disabled = false; }); el.childNote.hidden = !(childPrice == null && state.children > 0); el.childNote.textContent = childPrice == null ? "We price children when we confirm." : ""; }
        el.childUnit.textContent = childPrice != null ? (r === "resident" ? jmd(childPrice) : usd(childPrice)) + " each" : (adultsOnly ? "" : "ask us");
        el.adultUnit.textContent = p.perParty ? "" : (r === "resident" && p.resident ? jmd(p.resident.jmd) : p.visitor ? usd(p.visitor.usd + (pickupOf() && r === "visitor" ? (pickupOf().add || 0) : 0)) : "") + (p.visitor || p.resident ? " each" : "");
      }
      $$("[data-step]", root).forEach(function (b) { var k = b.getAttribute("data-step"), d = +b.getAttribute("data-d"); var v = state[k]; if (k === "adults") b.disabled = (d < 0 && v <= 1) || (d > 0 && v >= MAX_GUESTS); if (k === "children" && !adultsOnly) b.disabled = (d < 0 && v <= 0) || (d > 0 && v >= MAX_GUESTS); });
      var gn = $("#guests-note", root); if (gn) gn.hidden = !(state.adults + state.children >= MAX_GUESTS);
      /* pickup only on the visitor rate */
      if (el.pickupWrap) el.pickupWrap.hidden = r !== "visitor";
      renderPickup();
      /* airport lounges: the fields follow the product's legs */
      if (isFlight) {
        var legs = p.legs || "both";
        var dl = $("#pf-date-l", root); if (dl) dl.textContent = legs === "out" ? "Departure date" : "Arrival date";
        var d2w = $("#pf-date2-wrap", root); if (d2w) d2w.hidden = legs !== "both";
        var fiw = $("#pf-flight-in-wrap", root); if (fiw) fiw.hidden = legs === "out";
        var fow = $("#pf-flight-out-wrap", root); if (fow) fow.hidden = legs === "in";
      }
      /* contact + cta */
      if (el.contact) el.contact.hidden = !inst;
      var shipWrap = $("#pf-ship-wrap", root); if (shipWrap) shipWrap.hidden = V.slug.indexOf("club-") === 0;
      var liveOff = inst && live && state.availOk === false;
      var canPay = inst && !liveOff;
      el.cta.innerHTML = (canPay ? ICON_CARD : ICON_CHAT) + '<span id="cta-label"></span>';
      $("#cta-label", el.cta).textContent = canPay ? "Book and pay " + pr.lead : (isRequest() ? "Request this date" : "Send enquiry");
      el.ctaSub.textContent = canPay ? (live ? "Confirmed straight away, paid by card on a secure page. You'll get the confirmation by email." : "Paid by card on a secure page and confirmed straight away. We send your booking details shortly by email and WhatsApp.") : liveOff ? "Live availability is offline, so this goes to us on WhatsApp and we confirm the time with the park. Nothing is charged now." : isRequest() ? "We confirm availability first, then send a secure card link. Nothing is charged now." : "We reply within working hours with a secure card link. Nothing is charged now.";
      if (el.ctaAlt) el.ctaAlt.hidden = !canPay;
      if (el.previewWrap) el.previewWrap.hidden = canPay; // the WhatsApp text only matters when the booking goes by WhatsApp
      if (el.dateNote) { var prob = dateProblem(state.date); el.dateNote.hidden = !prob; el.dateNote.className = "pf-hint bad"; el.dateNote.textContent = prob; }
      el.preview.textContent = message();
    }
    var ICON_CARD = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;display:block"><rect x="2" y="5" width="20" height="14" rx="2"></rect><path d="M2 10h20"></path></svg>';
    var ICON_CHAT = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;display:block"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>';

    /* option rows */
    function selectProduct(id, scroll) {
      state.product = id; state.time = ""; state.sessions = null; state.availOk = null;
      $$(".op", root).forEach(function (o) { var r = $("input", o); if (r) r.checked = o.getAttribute("data-id") === id; });
      /* choices default: first n */
      var p = product();
      if (p && p.choose && !state.choices[p.id]) state.choices[p.id] = p.choose.from.slice(0, p.choose.pick);
      renderChoices(); renderTimes(); render(); loadAvailability();
      track("exp_option", { venue: V.slug, product: id });
    }
    function renderChoices() {
      $$(".op", root).forEach(function (o) {
        var id = o.getAttribute("data-id"), p = products[id]; if (!p || !p.choose) return;
        var sel = state.choices[id] || [];
        $$("[data-choice]", o).forEach(function (b) { b.setAttribute("aria-pressed", sel.indexOf(b.getAttribute("data-choice")) >= 0 ? "true" : "false"); });
      });
    }
    $$(".op input[name=product]", root).forEach(function (r) { r.addEventListener("change", function () { if (r.checked) selectProduct(r.value); }); });
    $$(".op [data-choice]", root).forEach(function (b) {
      b.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation();
        var o = b.closest(".op"), id = o.getAttribute("data-id"), p = products[id]; if (!p || !p.choose) return;
        if (state.product !== id) { selectProduct(id); }
        var sel = (state.choices[id] || []).slice(), c = b.getAttribute("data-choice"), i = sel.indexOf(c);
        if (i >= 0) { if (sel.length > 1) sel.splice(i, 1); }
        else { sel.push(c); while (sel.length > p.choose.pick) sel.shift(); }
        state.choices[id] = sel; renderChoices(); render(); if (instant()) loadAvailability();
      });
    });

    /* panel controls */
    $$("input[name=rate]", root).forEach(function (r) { r.addEventListener("change", function () { if (r.checked) { state.rate = r.value; state.sessions = null; state.availOk = null; renderTimes(); render(); loadAvailability(); track("exp_rate", { venue: V.slug, rate: r.value }); } }); });
    if (el.date) { el.date.min = today; el.date.addEventListener("change", function () { state.date = el.date.value; render(); loadAvailability(); }); }
    if (el.date2) { el.date2.min = today; el.date2.addEventListener("change", render); }
    [el.flightIn, el.flightOut, el.first, el.last, el.email, el.phone, el.ship].forEach(function (i) { if (i) i.addEventListener("input", render); });
    $$("[data-step]", root).forEach(function (b) { b.addEventListener("click", function () { var k = b.getAttribute("data-step"), d = +b.getAttribute("data-d"); state[k] = Math.max(k === "adults" ? 1 : 0, Math.min(MAX_GUESTS, state[k] + d)); el[k].value = state[k]; render(); }); });
    /* ---- pickup hotel picker ---- */
    function servedKey(region) { return V.pickups && V.pickups.some(function (pk) { return pk.key === region; }) ? region : null; }
    function renderPickup() {
      if (!V.pickups) return;
      var mode = state.pickupMode, pk = pickupOf();
      $$(".pickup-alts .chip", root).forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-pick") === mode ? "true" : "false"); });
      if (el.pickupOtherWrap) el.pickupOtherWrap.hidden = mode !== "other";
      if (el.pickupAreaWrap) el.pickupAreaWrap.hidden = mode !== "other";
      if (el.pickupNote) {
        var t = "";
        if (mode === "own") t = "No pickup. The meeting point comes with your details.";
        else if (mode === "hotel" && state.pickupHotel && pk) t = pk.key === "own" ? "No hotel pickup from " + state.pickupHotel + " on this one, so it's priced without pickup. Make your own way, or ask us on WhatsApp about a transfer." : pk.label + (pk.add ? ", +" + usd(pk.add) + " per person" : ", pickup included") + ".";
        else if (mode === "other" && pk) t = pk.label + (pk.add ? ", +" + usd(pk.add) + " per person" : ", pickup included") + ". Tell us where and we'll confirm the pickup point.";
        else t = V.pickups.some(function (x) { return x.add; }) ? "Pickup from Negril hotels is included. Lucea and Montego Bay pickups are priced per person." : "Hotel pickup from Negril and Montego Bay is included.";
        el.pickupNote.textContent = t;
      }
    }
    function pickHotel(hh) {
      state.pickupMode = "hotel"; state.pickupHotel = hh.name;
      state.pickup = servedKey(hh.region) || "own";
      if (el.hotelIn) el.hotelIn.value = hh.name;
      closeHotelList(); render(); track("exp_pickup_hotel", { venue: V.slug, hotel: hh.slug, served: state.pickup !== "own" });
    }
    var hCursor = -1;
    function closeHotelList() { if (el.hotelList) { el.hotelList.hidden = true; el.hotelList.innerHTML = ""; } hCursor = -1; }
    function openHotelList(q) {
      if (!el.hotelList) return; var qq = (q || "").toLowerCase().trim();
      var hits = HOTELS.filter(function (hh) { return !qq || hh.name.toLowerCase().indexOf(qq) >= 0; }).slice(0, 8);
      el.hotelList.innerHTML = ""; hCursor = -1;
      if (!hits.length) { var li0 = document.createElement("li"); li0.className = "none"; li0.textContent = "Not on our list. Choose \"Somewhere else\" below and type it in."; el.hotelList.appendChild(li0); }
      hits.forEach(function (hh) {
        var li = document.createElement("li"); li.setAttribute("role", "option"); li.innerHTML = "<span></span><small></small>";
        li.firstChild.textContent = hh.name; li.lastChild.textContent = servedKey(hh.region) ? (REGIONS[hh.region] ? REGIONS[hh.region].label : hh.region) : "no pickup";
        li.addEventListener("mousedown", function (e) { e.preventDefault(); pickHotel(hh); });
        el.hotelList.appendChild(li);
      });
      el.hotelList.hidden = false;
    }
    if (el.hotelIn) {
      el.hotelIn.addEventListener("input", function () { if (state.pickupMode !== "hotel" || el.hotelIn.value !== state.pickupHotel) { state.pickupMode = "hotel"; state.pickupHotel = ""; render(); } openHotelList(el.hotelIn.value); });
      el.hotelIn.addEventListener("focus", function () { openHotelList(el.hotelIn.value); });
      el.hotelIn.addEventListener("blur", function () { setTimeout(closeHotelList, 150); });
      el.hotelIn.addEventListener("keydown", function (e) {
        var items = $$("li[role=option]", el.hotelList);
        if (e.key === "ArrowDown") { e.preventDefault(); hCursor = Math.min(items.length - 1, hCursor + 1); }
        else if (e.key === "ArrowUp") { e.preventDefault(); hCursor = Math.max(0, hCursor - 1); }
        else if (e.key === "Enter") { e.preventDefault(); var pick = items[hCursor >= 0 ? hCursor : 0]; if (pick) pick.dispatchEvent(new MouseEvent("mousedown")); return; }
        else if (e.key === "Escape") { closeHotelList(); return; }
        items.forEach(function (li, i) { li.setAttribute("aria-selected", i === hCursor ? "true" : "false"); });
      });
    }
    $$(".pickup-alts .chip", root).forEach(function (b) {
      b.addEventListener("click", function () {
        var m = b.getAttribute("data-pick");
        if (state.pickupMode === m) { state.pickupMode = "hotel"; state.pickupHotel = ""; state.pickup = V.pickups[0].key; }
        else { state.pickupMode = m; state.pickupHotel = m === "other" && el.pickupHotel ? el.pickupHotel.value.trim() : ""; state.pickup = m === "own" ? "own" : (el.pickup ? el.pickup.value : V.pickups[0].key); }
        if (el.hotelIn) el.hotelIn.value = "";
        render();
      });
    });
    if (el.pickup) el.pickup.addEventListener("change", function () { state.pickup = el.pickup.value; render(); });
    if (el.pickupHotel) el.pickupHotel.addEventListener("input", function () { state.pickupHotel = el.pickupHotel.value.trim(); render(); });
    if (el.ctaWa) el.ctaWa.addEventListener("click", function (e) { e.preventDefault(); sendWhatsApp(); });
    var sticky = $("#sticky-bar", root);
    if (sticky && "IntersectionObserver" in window) { var io = new IntersectionObserver(function (es) { es.forEach(function (x) { sticky.hidden = x.isIntersecting; }); }, { threshold: 0.15 }); io.observe(panel); }

    function sendWhatsApp() {
      var text = message();
      track("exp_request", { venue: V.slug, product: state.product, rate: rateOf(product()), instant: false, code: state.ref });
      window.open(waUrl(text), "_blank", "noopener");
    }
    function need(field, msg) { if (!field || !field.value.trim()) { field && field.focus(); throw new Error(msg); } }
    function pay() {
      var p = product(), prob = dateProblem(state.date), legs = p.legs || "both";
      if (!state.date) { el.date.focus(); throw new Error(isFlight ? (legs === "out" ? "Pick your departure date first." : "Pick your arrival date first.") : "Pick a date first."); }
      if (prob) throw new Error(prob);
      var wantsTime = (p.times && p.times.length) || (state.sessions && state.sessions.length);
      if (wantsTime && !state.time) throw new Error("Pick a start time.");
      var flightIn = "", flightOut = "", date2 = "";
      if (isFlight) {
        flightIn = el.flightIn ? el.flightIn.value.trim().toUpperCase() : ""; flightOut = el.flightOut ? el.flightOut.value.trim().toUpperCase() : ""; date2 = el.date2 ? el.date2.value : "";
        var flightRe = /^[A-Z0-9]{2,3}\s?\d{1,4}[A-Z]?$/;
        if (legs !== "out" && !flightRe.test(flightIn)) { el.flightIn.focus(); throw new Error("We need the arriving flight number, e.g. BA2263."); }
        if (legs !== "in" && !flightRe.test(flightOut)) { el.flightOut.focus(); throw new Error("We need the departing flight number, e.g. BA2262."); }
        if (legs === "both" && (!date2 || date2 < state.date)) { el.date2.focus(); throw new Error("Pick the departure date too."); }
      }
      need(el.first, "We need a first name for the booking."); need(el.last, "And a last name."); need(el.email, "The confirmation goes by email, so we need an address.");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(el.email.value.trim())) { el.email.focus(); throw new Error("That email doesn't look right."); }
      need(el.phone, "A WhatsApp or phone number, so we can send your details.");
      if (V.pickups && rateOf(p) === "visitor" && state.pickup !== "own" && !state.pickupHotel) { if (el.hotelIn) el.hotelIn.focus(); throw new Error("Which hotel should the driver collect you from? Pick it from the list, or choose somewhere else or your own way."); }
      var body = { slug: V.slug, product: p.id, date: state.date, time: wantsTime ? state.time : "", date2: date2, flightIn: flightIn, flightOut: flightOut, adults: state.adults, children: state.children, pickup: state.pickup, pickupHotel: state.pickup === "own" ? "" : state.pickupHotel, choices: chosen(), ref: state.ref, ship: el.ship ? el.ship.value.trim() : "", customer: { first: el.first.value.trim(), last: el.last.value.trim(), email: el.email.value.trim(), phone: el.phone.value.trim() } };
      track("exp_checkout", { venue: V.slug, product: p.id, total: price().total, code: state.ref });
      if (PREVIEW) { alertBox("In the live site this opens the secure card page for " + price().lead + ". After paying, " + (live ? "the booking is created with the park" : "the guest is confirmed and the team gets the booking to send the details") + ", and the guest lands on the confirmation page (see \"After paying\" in the page picker)."); return; }
      el.cta.disabled = true; $("#cta-label", el.cta).textContent = "Opening secure payment…";
      fetch(FN + "exp-checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j }; }); })
        .then(function (x) {
          if (x.j && x.j.url) { window.location.href = x.j.url; return; }
          throw new Error((x.j && x.j.error) || "The payment page didn't open.");
        })
        .catch(function (e) { el.cta.disabled = false; render(); alertBox((e && e.message ? e.message : "Something went wrong.") + " You can send the same booking by WhatsApp and we'll confirm it by hand.", true); });
    }
    function alertBox(text, offerWa) {
      var box = $("#exp-alert", root);
      if (!box) { box = document.createElement("div"); box.id = "exp-alert"; box.className = "pf-hint bad"; box.setAttribute("role", "alert"); box.style.cssText = "padding:12px 14px;border-radius:12px;background:#FFF4E5;color:#8A6D12;font-size:13px;line-height:1.45"; el.cta.parentNode.insertBefore(box, el.cta); }
      box.innerHTML = "";
      box.appendChild(document.createTextNode(text + " "));
      if (offerWa) { var a = document.createElement("a"); a.href = "#"; a.textContent = "Send by WhatsApp"; a.style.cssText = "text-decoration:underline;color:inherit;font-weight:800"; a.addEventListener("click", function (e) { e.preventDefault(); sendWhatsApp(); }); box.appendChild(a); }
      box.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var box = $("#exp-alert", root); if (box) box.remove();
      try {
        if (instant() && (!live || state.availOk !== false)) { pay(); return; }
        if (!isFlight) { var prob = dateProblem(state.date); if (prob) { alertBox(prob); return; } }
        sendWhatsApp();
      } catch (err) { alertBox(err.message); }
    });

    /* the guest's hotel, if they picked one on the hub */
    var myHotel = savedHotel(X);
    if (myHotel) {
      var mins = driveMin(myHotel, V, X.regions || {});
      var fh = $("#fact-hotel", root), fht = $("#fact-hotel-t", root);
      if (fh && fht && mins != null) { fh.hidden = false; fht.textContent = driveLabel(mins) + " from " + myHotel.name; }
      if (V.pickups && el.hotelIn) pickHotel(myHotel);
    }

    /* Tripadvisor: live rating and three reviews, below the panel. Loaded only when the visitor scrolls near it (each load is billed),
       never cached, hidden if nothing comes back. Every Tripadvisor thing links back to Tripadvisor, as their linking policy asks. */
    (function tripadvisor() {
      var sec = $("#ta-sec", root); if (!sec) return;
      function esc(s) { return String(s == null ? "" : s); }
      function setLink(a, href) { if (!a) return; if (href) { a.href = href; a.hidden = false; } else { a.removeAttribute("href"); a.hidden = a.id === "ta-write"; } }
      function paint(d, sample) {
        var name = $("#ta-name", root); name.textContent = d.name || V.name; setLink(name, d.url);
        setLink($("#ta-link", root), d.url); setLink($("#ta-more", root), d.url); setLink($("#ta-write", root), d.writeReview);
        var bub = $("#ta-bubbles", root); if (d.ratingImage) { bub.src = d.ratingImage; bub.alt = d.rating + " of 5 bubbles"; bub.hidden = false; } else bub.hidden = true;
        var aw = $("#ta-award", root); if (aw) { aw.innerHTML = ""; if (d.award && d.award.name) { if (d.award.image) { var ai = document.createElement("img"); ai.src = d.award.image; ai.alt = d.award.name + (d.award.year ? " " + d.award.year : ""); aw.appendChild(ai); } else { var at = document.createElement("span"); at.className = "tag tag-gold"; at.textContent = d.award.name + (d.award.year ? " " + d.award.year : ""); aw.appendChild(at); } aw.hidden = false; } else aw.hidden = true; }
        $("#ta-rating", root).textContent = d.rating ? Number(d.rating).toFixed(1) : "";
        var cnt = $("#ta-count", root); cnt.textContent = d.count ? "from " + fmt(d.count) + " review" + (d.count === 1 ? "" : "s") : ""; setLink(cnt, d.url);
        $("#ta-ranking", root).textContent = d.ranking || "";
        var wrap = $("#ta-reviews", root); wrap.innerHTML = "";
        (d.reviews || []).slice(0, 3).forEach(function (r) {
          var el = document.createElement("article"); el.className = "ta-rev";
          var top = document.createElement("div"); top.className = "ta-rev-top";
          if (r.ratingImage) { var im = document.createElement("img"); im.src = r.ratingImage; im.alt = r.rating + " of 5 bubbles"; top.appendChild(im); }
          var b = document.createElement("b"); b.textContent = esc(r.title); top.appendChild(b); el.appendChild(top);
          var p = document.createElement("p"); var txt = esc(r.text); var cut = txt.length > 320; p.textContent = cut ? txt.slice(0, 300).replace(/\s+\S*$/, "") + "…" : txt; el.appendChild(p);
          if (cut && r.url) { var rm = document.createElement("a"); rm.className = "ta-read"; rm.href = r.url; rm.target = "_blank"; rm.rel = "noopener nofollow"; rm.textContent = "Read more on Tripadvisor"; el.appendChild(rm); }
          var who = [r.user, r.userGeo].filter(Boolean).join(", ");
          var sm = document.createElement("small"); sm.textContent = [who, r.date ? longDate(r.date) : "", r.tripType ? r.tripType.toLowerCase() : ""].filter(Boolean).join(" · "); el.appendChild(sm);
          wrap.appendChild(el);
        });
        var samp = $("#ta-sample", root); if (samp) samp.hidden = !sample;
        sec.hidden = false;
      }
      var loaded = false;
      function load() {
        if (loaded) return; loaded = true;
        if (PREVIEW) {
          paint({ name: V.name, rating: 4.5, count: 1284, ranking: "#3 of 41 things to do nearby", url: "https://www.tripadvisor.com/", writeReview: "https://www.tripadvisor.com/", ratingImage: "", award: { name: "Travelers' Choice", year: 2025 }, reviews: [
            { rating: 5, title: "Best day of the trip", text: "The quads were the highlight for our group of six. Guides were patient with the nervous ones and we came back muddy and laughing. Pickup from the hotel was on time.", date: "2026-08-30", user: "traveller", userGeo: "Toronto", tripType: "Family" },
            { rating: 5, title: "Zipline was worth it", text: "Eight towers and the racing zip at the end. The rappel finish was a surprise. Bring water shoes, you will get wet on the trail.", date: "2026-08-21", user: "traveller", userGeo: "London", tripType: "Couples" },
            { rating: 4, title: "Good, long day", text: "Did the three-tour deal. The safari was longer than we expected and the rum tasting at the end went down well. Lunch is extra, so eat first.", date: "2026-08-12", user: "traveller", userGeo: "Atlanta", tripType: "Friends" }
          ] }, true);
          return;
        }
        fetch(FN + "exp-tripadvisor?slug=" + encodeURIComponent(V.slug), { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (d) { if (d && d.ok && d.rating) paint(d, false); }).catch(function () {});
      }
      var sentinel = $("#ta-sentinel", root);
      if (sentinel && "IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (entries) { if (entries.some(function (e) { return e.isIntersecting; })) { io.disconnect(); load(); } }, { rootMargin: "600px 0px" });
        io.observe(sentinel);
      } else load();
    })();

    /* start */
    var checked = $$(".op:not([data-expired]) input[name=product]:checked", root)[0];
    selectProduct(checked ? checked.value : (V.products[0] && V.products[0].id));
  }

  /* ================= booked page ================= */
  function initBooked(root) {
    var main = $("#booked", root); if (!main) return;
    var q = new URLSearchParams(location.search), sid = q.get("session_id");
    function show(state, data) {
      main.setAttribute("data-state", state);
      $$(".state", main).forEach(function (s) { s.hidden = s.getAttribute("data-for") !== state; });
      if (data) {
        var sfx = state === "pending" ? "-p" : state === "team" ? "-t" : "";
        var dl = $("#bk-details" + sfx, main);
        if (dl) { dl.innerHTML = ""; [["Tour", data.venue], ["Booked", data.product], ["When", data.when], ["Guests", data.guests], ["Pickup", data.pickup], ["Paid", data.total]].forEach(function (kv) { if (!kv[1]) return; var dt = document.createElement("dt"); dt.textContent = kv[0]; var dd = document.createElement("dd"); dd.textContent = kv[1]; dl.appendChild(dt); dl.appendChild(dd); }); }
        var r = $("#bk-ref" + sfx, main); if (r) r.textContent = data.ref || "";
        var o = $("#bk-order", main), ow = $("#bk-order-wrap", main); if (o) o.textContent = data.order || ""; if (ow) ow.hidden = !data.order;
        var em = $("#bk-email", main); if (em) em.textContent = data.email || "your email";
        var emt = $("#bk-email-t", main); if (emt) emt.textContent = data.email || "your email";
        var w = $("#bk-wa", main); if (w && data.ref) w.href = waUrl("Hi Golden Vacation! I've just booked an experience on your website and I have a question. Ref " + data.ref);
      }
    }
    if (PREVIEW) {
      var X = window.GV_EXP || {};
      if (X.previewState === "team") show("team", { venue: "Mystic Mountain", product: "Mystic Gold", when: "Sat 19 Sep 2026", guests: "2 adults", pickup: "", total: "US$320", ref: "GV-EXP-M4T2", order: "", email: "guest@example.com" });
      else show("confirmed", { venue: "JamWest Adventure Park", product: "ATV tour", when: "Sat 19 Sep 2026 at 10:00am", guests: "2 adults", pickup: "Negril area hotel", total: "US$250", ref: "GV-EXP-K7Q2", order: "RKD4M2", email: "guest@example.com" });
      return;
    }
    if (!sid) { show("unknown"); return; }
    var tries = 0;
    (function poll() {
      fetch(FN + "exp-status?session_id=" + encodeURIComponent(sid)).then(function (r) { return r.json(); }).then(function (j) {
        if (!j || !j.ok) { show("unknown"); return; }
        if (j.status === "CONFIRMED") { show(j.confirm === "team" ? "team" : "confirmed", j); return; }
        if (j.status === "NEEDS_ATTENTION" || j.status === "PENDING_SUPPLIER" || j.status === "UNPAID" || tries > 12) { show(j.status === "UNPAID" ? "unknown" : "pending", j); return; }
        tries++; setTimeout(poll, 2500);
      }).catch(function () { if (++tries > 12) show("unknown"); else setTimeout(poll, 3000); });
    })();
  }

  function init(root) {
    root = root || document;
    if (root !== document) { if (root.getAttribute("data-inited")) return; root.setAttribute("data-inited", "1"); }
    var X = window.GV_EXP || {};
    if (X.page === "hub") initHub(root);
    else if (X.page === "venue") initVenue(root);
    else if (X.page === "booked") initBooked(root);
    else if (X.page === "near" && X.hotel) { store("gv_hotel", X.hotel); }
  }
  window.GV_EXP_INIT = init;
  if (!PREVIEW) init(document);
})();

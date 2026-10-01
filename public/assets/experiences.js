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
  function hotelsOf(X) { return (X.hotels || []).map(function (h) { return { name: h[0], slug: h[1], region: h[2], lat: h[3], lng: h[4], port: !!h[5], resort: h[6] == null ? true : !!h[6] }; }); }
  /* ship days. A cruise guest is planned back at the pier by X.shipDay.backBy (3:30pm) or an hour before the all-aboard time they pick.
     The drive from their port puts a tour in a tier: ok (books on the spot), ask (WhatsApp first, we check it against the ship), no (not offered). */
  function clockMins(s) {
    var m = String(s || "").trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm|noon|midnight)?$/); if (!m) return null;
    var h = +m[1], mi = +(m[2] || 0), ap = m[3] || "";
    if (ap === "noon") return 720; if (ap === "midnight") return 0;
    if (ap === "pm" && h < 12) h += 12; if (ap === "am" && h === 12) h = 0;
    return h * 60 + mi;
  }
  function clockText(m) { var h = Math.floor(m / 60) % 24, mi = m % 60; return (h % 12 || 12) + ":" + (mi < 10 ? "0" : "") + mi + (h < 12 ? "am" : "pm"); }
  function shipTier(SD, sdFlag, drive) { if (!SD) return "ok"; if (sdFlag === 0 || sdFlag === false) return "no"; if (drive == null) return "ok"; return drive > SD.askDrive ? "no" : drive > SD.okDrive ? "ask" : "ok"; }
  /* does one start (or an untimed visit) get them back in time from a port `drive` minutes away? */
  function shipSlotOk(SD, p, startMins, drive, backBy) {
    var sd = p.sd || {}; if (sd.no) return false;
    var stay = sd.flex ? Math.min(sd.mins || 120, 120) : (sd.mins || 180), d = drive || 0;
    if (startMins != null) return startMins + stay + d <= backBy;
    return SD.arrive + d + stay + d <= backBy;
  }
  function placeLabel(hh, regions) { return hh.port ? "Cruise port" : (regions && regions[hh.region] ? regions[hh.region].label : hh.region); }
  /* type-ahead over hotels and cruise ports: ports also answer to "cruise", "ship", "terminal", "pier", "dock" and the short town names; an empty box lists the ports first so cruise guests see them without typing.
     Each word typed only has to start a word of the name, in any order, so "riu a" finds RIU Palace Aquarelle; case, accents and punctuation are ignored ("dunns", "st james", "t bird"),
     and words run together still count ("tbird", "moonpalace"). Typos are forgiven: one in a word of 4 letters or more, two from 7 letters ("sandles"), two letters swapped in a 3-letter word ("rui").
     The first letter has to be right and a word of 1 or 2 letters has to be exact, so a short search doesn't pull in odd hotels.
     Order: the words as typed, from the start of a word; then every word starting a word; then words run together; then near misses, fewest typos first;
     last, letters that only turn up inside a word. Each group keeps the list order. */
  var PORT_WORDS = " cruise ship terminal pier dock port ", TOWN_ALIASES = { "montego bay": " mobay ", "ocho rios": " ochi " };
  function normText(s) { s = String(s || "").toLowerCase(); if (s.normalize) s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); return s.replace(/['\u2018\u2019`]/g, "").replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim(); }
  /* fewest typos (a letter added, dropped or changed, or two letters side by side swapped) that turn a into the start of w */
  function typosToStart(a, w) {
    var n = a.length, m = Math.min(w.length, n + 2), d = [], i, j, v, best = 99;
    for (i = 0; i <= n; i++) { d[i] = [i]; }
    for (j = 1; j <= m; j++) d[0][j] = j;
    for (i = 1; i <= n; i++) for (j = 1; j <= m; j++) {
      v = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a.charAt(i - 1) === w.charAt(j - 1) ? 0 : 1));
      if (i > 1 && j > 1 && a.charAt(i - 1) === w.charAt(j - 2) && a.charAt(i - 2) === w.charAt(j - 1)) v = Math.min(v, d[i - 2][j - 2] + 1);
      d[i][j] = v;
    }
    for (j = 0; j <= m; j++) best = Math.min(best, d[n][j]);
    return best;
  }
  /* how far the typed word t is from starting one of the words: 0 one starts with it, 1 or 2 typos, -1 too far */
  function wordTypos(t, words) {
    var allow = t.length >= 7 ? 2 : t.length >= 4 ? 1 : 0, best = -1, k, w, e;
    for (k = 0; k < words.length; k++) {
      w = words[k];
      if (w.indexOf(t) === 0) return 0;
      if (w.charAt(0) !== t.charAt(0)) continue;
      e = t.length === 3 ? (t.charAt(1) === w.charAt(2) && t.charAt(2) === w.charAt(1) ? 1 : 99) : allow ? typosToStart(t, w) : 99;
      if (e <= Math.max(allow, 1) && e < 99 && (best < 0 || e < best)) best = e;
    }
    return best;
  }
  /* 0 the words as typed, from the start of a word; 1 every word starts a word; 2 the words run together; 3 and up near misses (3 + typos);
     99 the letters only turn up inside a word ("rui" in cruise), so those go last; -1 no match */
  function placeScore(text, q) {
    var qq = normText(q), t = " " + normText(text) + " ", toks, words, joined, k, s, typos = 0;
    if (!qq || t.indexOf(" " + qq) >= 0) return 0;
    toks = qq.split(" ");
    if (toks.every(function (w) { return t.indexOf(" " + w) >= 0; })) return 1;
    words = t.trim().split(" "); joined = qq.replace(/ /g, "");
    if (joined.length >= 4) for (k = 0; k < words.length; k++) if (words.slice(k).join("").indexOf(joined) === 0) return 2;
    for (k = 0; k < toks.length; k++) { s = wordTypos(toks[k], words); if (s < 0) break; typos += s; }
    if (k === toks.length) return 3 + typos;
    return t.indexOf(qq) >= 0 ? 99 : -1;
  }
  function textMatches(text, q) { return placeScore(text, q) >= 0; }
  function searchText(hh) { var s = " " + normText(hh.name) + " "; Object.keys(TOWN_ALIASES).forEach(function (k) { if (s.indexOf(k) >= 0) s += TOWN_ALIASES[k]; }); if (hh.port) s += PORT_WORDS; return s; }
  /* the places that match, best first; .near on the result = every one of them is a near miss, so the list also offers WhatsApp */
  function matchPlaces(list, q, opts) {
    var qq = normText(q), portsOnly = !!(opts && opts.portsOnly), limit = (opts && opts.limit) || 8, hits, out;
    if (!qq) {
      hits = list.filter(function (hh) { return !portsOnly || hh.port; });
      return hits.filter(function (hh) { return hh.port; }).concat(hits.filter(function (hh) { return !hh.port; })).slice(0, limit);
    }
    hits = [];
    list.forEach(function (hh, i) { if (portsOnly && !hh.port) return; var s = placeScore(searchText(hh), qq); if (s >= 0) hits.push({ s: s, i: i, hh: hh }); });
    hits.sort(function (a, b) { return a.s - b.s || a.i - b.i; });
    out = hits.slice(0, limit).map(function (x) { return x.hh; });
    out.near = hits.length > 0 && hits[0].s >= 3;
    return out;
  }
  function savedHotel(X) { var slug = store("gv_hotel"); if (!slug) return null; return hotelsOf(X).filter(function (h) { return h.slug === slug; })[0] || null; }

  /* ================= hub: one question first, the days out by area, nearest first once a hotel is picked ================= */
  function initHub(root) {
    var groupsBox = $("#eh-groups", root); if (!groupsBox) return;
    var X = window.GV_EXP || {}, HOTELS = hotelsOf(X), VEN = {}, SD = X.shipDay || null, AP = X.areaPages || {};
    (X.venues || []).forEach(function (v) { VEN[v.slug] = v; });
    var cards = $$(".ecard", groupsBox), homes = cards.map(function (c) { return { card: c, grid: c.parentNode }; });
    var near = $("#eh-near", root), empty = $("#vempty", root), mode = $("#hotel-note", root), modeT = $(".eh-mode-t", root);
    var band = { b30: $('[data-band="30"] .eh-grid', near), b60: $('[data-band="60"] .eh-grid', near), far: $('[data-band="far"] .eh-grid', near) };
    var farT = $(".eh-far-t", near), nearLink = $("#eh-near-link", root);
    var hIn = $("#hotel-in", root), hList = $("#hotel-list", root), hClear = $("#hotel-clear", root);
    var state = { cat: "all", local: false }, hotel = null, cursor = -1;
    function cap1(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
    /* what pickup from this hotel costs on this tour: the same limits the tour page applies */
    function pickFor(ven, h) {
      var who = h.port ? "the pier" : h.name, key = h.port ? h.slug : h.region, e = null;
      (ven.pk || []).forEach(function (p) { if (p.k === key) e = p; });
      if (e && ((e.x && e.x.indexOf(h.slug) >= 0) || (e.lx != null && h.lng > e.lx) || (e.ln != null && h.lng < e.ln) || (e.r && !h.resort))) e = null;
      if (!e) return { kind: "no", text: "No pickup from " + who + ", ask us for a ride" };
      if (e.q) return { kind: "add", text: "Pickup from " + who + " on request" };
      if (e.a) return { kind: "add", text: "Pickup from " + who + ", +US$" + e.a + " per person" };
      return { kind: "yes", text: "Pickup from " + who + " included" };
    }
    function setPick(c) {
      var li = $(".ecard-pick", c); if (!li) return;
      var p = hotel ? pickFor(VEN[c.getAttribute("data-slug")] || {}, hotel) : { kind: li.getAttribute("data-def-kind"), text: li.getAttribute("data-def") };
      li.className = "ecard-pick " + p.kind; $(".t", li).textContent = p.text;
    }
    function filterCards() {
      var shown = 0;
      cards.forEach(function (c) {
        var ok = (state.cat === "all" || (c.getAttribute("data-cats") || "").split(" ").indexOf(state.cat) >= 0) && (!state.local || (c.getAttribute("data-doors") || "").split(" ").indexOf("locals") >= 0);
        c.hidden = !ok; if (ok) shown++;
      });
      $$(".eh-group", groupsBox).forEach(function (g) { g.hidden = !$$(".ecard", g).some(function (c) { return !c.hidden; }); });
      $$(".eh-band", near).forEach(function (b) { b.hidden = !$$(".ecard", b).some(function (c) { return !c.hidden; }); });
      if (farT) { var n = $$(".ecard", band.far).filter(function (c) { return !c.hidden; }).length; farT.textContent = hotel && hotel.port ? n + " more, a long day or not on a ship day" : n + " more further away"; }
      if (empty) empty.hidden = shown > 0;
      $$(".eh-tabs [data-cat]", root).forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-cat") === state.cat ? "true" : "false"); });
    }
    function layout() {
      if (!hotel) {
        homes.forEach(function (h) { h.grid.appendChild(h.card); });
        $$(".eh-port", groupsBox).forEach(function (p) { p.parentNode.appendChild(p); });
        cards.forEach(function (c) { var t = $(".ecard-drive", c); if (t) t.hidden = true; });
        groupsBox.hidden = false; near.hidden = true; if (mode) mode.hidden = true;
      } else {
        var rows = cards.map(function (c) {
          var ven = VEN[c.getAttribute("data-slug")] || {}, m = driveMin(hotel, ven, X.regions || {}), tier = hotel.port ? shipTier(SD, ven.sd, m) : "ok";
          var t = $(".ecard-drive", c);
          if (t) { t.hidden = m == null && tier === "ok"; t.textContent = tier === "no" ? "Not on a ship day" : tier === "ask" ? "Long day, ask us" : cap1(driveLabel(m)); }
          return { c: c, m: m == null ? 9999 : m, tier: tier };
        }).sort(function (a, b) { return (a.tier === "no") - (b.tier === "no") || a.m - b.m; });
        rows.forEach(function (r) { (r.tier === "ok" && r.m <= 30 ? band.b30 : r.tier === "ok" && r.m <= 60 ? band.b60 : band.far).appendChild(r.c); });
        var t30 = $('[data-band="30"] h3', near), t60 = $('[data-band="60"] h3', near);
        if (t30) t30.textContent = hotel.port ? "30 min or less from the pier" : "30 min or less";
        if (t60) t60.textContent = hotel.port ? "Within the hour, still a ship day" : "Within the hour";
        if (nearLink) {
          nearLink.href = (X.base || "/experiences") + (hotel.port || hotel.resort ? "/near/" + hotel.slug : AP[hotel.region] ? "/area/" + AP[hotel.region] : "/");
          $("b", nearLink).textContent = hotel.port ? "Everything from " + hotel.name : hotel.resort ? "Everything near " + hotel.name : "Everything near you";
        }
        if (modeT) modeT.textContent = hotel.port ? (SD ? "Days out from " + hotel.name + ". We plan to have you back at the pier by " + SD.backByText + "." : "Days out from " + hotel.name + ".") : "Sorted by drive time from " + hotel.name + ".";
        groupsBox.hidden = true; near.hidden = false; if (mode) mode.hidden = false;
      }
      cards.forEach(setPick); filterCards();
    }
    function setHotel(hh, save, go) {
      hotel = hh; if (hIn) hIn.value = hh ? hh.name : ""; if (hClear) hClear.hidden = !hh;
      if (save) store("gv_hotel", hh ? hh.slug : null);
      closeList(); layout();
      if (hh) track("exp_hotel", { hotel: hh.slug });
      if (go) { var all = $("#all", root); if (all) all.scrollIntoView({ behavior: "smooth", block: "start" }); }
    }
    function closeList() { if (hList) { hList.hidden = true; hList.innerHTML = ""; } cursor = -1; }
    function openList(q, opts) {
      if (!hList) return;
      var hits = matchPlaces(HOTELS, q, opts || {});
      hList.innerHTML = ""; cursor = -1;
      if (!hits.length) { var li = document.createElement("li"); li.className = "none"; li.textContent = "Not on our list yet. Tell us on WhatsApp and we'll price from there."; hList.appendChild(li); }
      hits.forEach(function (hh) { var li = document.createElement("li"); li.setAttribute("role", "option"); li.innerHTML = "<span></span><small></small>"; li.firstChild.textContent = hh.name; li.lastChild.textContent = placeLabel(hh, X.regions); li.addEventListener("mousedown", function (e) { e.preventDefault(); setHotel(hh, true, true); }); hList.appendChild(li); });
      if (hits.near) { var ln = document.createElement("li"); ln.className = "none"; ln.textContent = "Not the one? Tell us on WhatsApp and we'll price from there."; hList.appendChild(ln); }
      hList.hidden = false;
    }
    if (hIn) {
      hIn.addEventListener("input", function () { openList(hIn.value); });
      hIn.addEventListener("focus", function () { if (!hotel) openList(hIn.value); });
      hIn.addEventListener("blur", function () { setTimeout(function () { if (document.activeElement !== hIn) closeList(); }, 150); }); // "Show my days out" puts the focus back to show the list
      hIn.addEventListener("keydown", function (e) {
        var items = $$("li[role=option]", hList);
        if (e.key === "ArrowDown") { e.preventDefault(); cursor = Math.min(items.length - 1, cursor + 1); }
        else if (e.key === "ArrowUp") { e.preventDefault(); cursor = Math.max(0, cursor - 1); }
        else if (e.key === "Enter") { e.preventDefault(); var pick = items[cursor >= 0 ? cursor : 0]; if (pick) pick.dispatchEvent(new MouseEvent("mousedown")); return; }
        else if (e.key === "Escape") { closeList(); return; }
        items.forEach(function (li, i) { li.setAttribute("aria-selected", i === cursor ? "true" : "false"); });
      });
    }
    /* the arrow and "Show my days out": the first match if they typed something, otherwise the list (also when the only matches are near misses, so nobody lands on a hotel they didn't pick) */
    $$("[data-go]", root).forEach(function (b) { b.addEventListener("click", function () {
      var q = hIn ? hIn.value : "", hits = q ? matchPlaces(HOTELS, q) : [];
      if (hotel && q === hotel.name) { setHotel(hotel, false, true); return; }
      if (hits.length && !hits.near) setHotel(hits[0], true, true); else if (hIn) { hIn.focus(); openList(q); }
    }); });
    function clearHotel() { setHotel(null, true); if (hIn) { try { hIn.focus({ preventScroll: true }); } catch (e) { hIn.focus(); } } }
    if (hClear) hClear.addEventListener("click", clearHotel);
    var change = $("#hotel-change", root); if (change) change.addEventListener("click", function () { var top = $(".eh-q", root); if (top) top.scrollIntoView({ behavior: "smooth", block: "center" }); clearHotel(); });
    $$(".eh-tabs [data-cat]", root).forEach(function (b) { b.addEventListener("click", function () { state.cat = b.getAttribute("data-cat"); filterCards(); track("exp_filter", { cat: state.cat }); }); });
    /* the shortcuts: an area scrolls to its group, the ship opens the cruise ports, "I live in Jamaica" shows resident rates in J$ */
    $$("[data-jump]", root).forEach(function (b) { b.addEventListener("click", function () {
      if (hotel) setHotel(null, true);
      var g = $('.eh-group[data-group="' + b.getAttribute("data-jump") + '"]', root); if (g) g.scrollIntoView({ behavior: "smooth", block: "start" });
      track("exp_filter", { area: b.getAttribute("data-jump") });
    }); });
    $$("[data-ports]", root).forEach(function (b) { b.addEventListener("click", function () { if (hIn) { hIn.value = ""; try { hIn.focus({ preventScroll: true }); } catch (e) { hIn.focus(); } } openList("", { portsOnly: true }); track("exp_door", { door: "port" }); }); });
    $$("[data-local]", root).forEach(function (b) { b.addEventListener("click", function () {
      state.local = !state.local; b.setAttribute("aria-pressed", state.local ? "true" : "false");
      if (state.local) { var j = document.querySelector('.curr [data-c="JMD"]'); if (j && !j.classList.contains("on")) j.click(); }
      filterCards(); var all = $("#all", root); if (all && state.local) all.scrollIntoView({ behavior: "smooth", block: "start" });
      track("exp_door", { door: "locals" });
    }); });
    /* phones show two tours an area; "See all" opens the rest */
    $$(".eh-all", root).forEach(function (b) { b.addEventListener("click", function () {
      var g = b.closest(".eh-group"), open = !g.classList.contains("open"); g.classList.toggle("open", open);
      b.setAttribute("aria-expanded", open ? "true" : "false"); b.textContent = open ? "Show fewer" : "See all " + b.getAttribute("data-n");
    }); });
    var clear = $("#clear-filters", root); if (clear) clear.addEventListener("click", function () { state = { cat: "all", local: false }; $$("[data-local]", root).forEach(function (b) { b.setAttribute("aria-pressed", "false"); }); filterCards(); });
    /* Tripadvisor ratings, fetched live when a card comes into view, once per listing (Tripadvisor's terms: never stored) */
    var taWait = {};
    function fillRating(key, d) { $$('.ecard-rate[data-ta="' + key + '"]', root).forEach(function (li) { if (!d || !d.ok || !d.rating) { li.hidden = true; return; } $("b", li).textContent = d.rating; $("small", li).textContent = "(" + Number(d.count || 0).toLocaleString("en-US") + " reviews)"; li.hidden = false; }); }
    function loadRating(li) {
      var key = li.getAttribute("data-ta"); if (taWait[key]) return; taWait[key] = 1;
      var slug = li.closest(".ecard").getAttribute("data-slug");
      fetch("/.netlify/functions/exp-tripadvisor?slug=" + encodeURIComponent(slug)).then(function (r) { return r.ok ? r.text() : ""; }).then(function (t) { var d = null; try { d = JSON.parse(t.replace(/[\u0000-\u001f]/g, " ")); } catch (e) {} fillRating(key, d); }).catch(function () { fillRating(key, null); });
    }
    var rates = $$(".ecard-rate[data-ta]", root);
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting && en.target._rate) { io.unobserve(en.target); loadRating(en.target._rate); } }); }, { rootMargin: "200px 0px" });
      rates.forEach(function (li) { var c = li.closest(".ecard"); c._rate = li; io.observe(c); });
    }
    /* what the front page search and older links hand over: the kind of day, the area, the hotel; #stay, #port and #locals */
    var qp = new URLSearchParams(location.search), qCat = qp.get("cat"), qArea = qp.get("area"), qs = qp.get("hotel"), hsh = (location.hash || "").slice(1);
    if (qCat && $('.eh-tabs [data-cat="' + qCat + '"]', root)) state.cat = qCat;
    var pre = qs ? HOTELS.filter(function (hh) { return hh.slug === qs; })[0] : savedHotel(X);
    if (pre) setHotel(pre, !!qs, !!qs); else layout();
    if (qArea && !pre) { var g = $('.eh-group[data-group="' + qArea + '"]', root); if (g) setTimeout(function () { g.scrollIntoView({ block: "start" }); }, 60); }
    if (hsh === "locals") { var lb = $("[data-local]", root); if (lb) lb.click(); }
    else if (hsh === "port" && !pre) { var pb = $("[data-ports]", root); if (pb) setTimeout(function () { pb.click(); }, 60); }
    else if (hsh === "stay" && hIn && !pre) setTimeout(function () { try { hIn.focus({ preventScroll: true }); } catch (e) { hIn.focus(); } }, 60);
    if (qCat || qArea) track("exp_filter", { cat: state.cat, area: qArea || "", from: "search" });
  }

  /* ================= venue: the photo viewer ================= */
  /* Tap the hero, the "N photos" pill or any gallery tile and the photo opens full screen: arrows or the keyboard step through,
     a swipe or a tap on either half of the picture does the same on a phone, Escape or the backdrop closes. Built once, on first open. */
  function initPhotos(root) {
    var X = window.GV_EXP || {}; var V = X.venue; var photos = (V && V.photos) || [];
    var openers = $$(".lb-open", root);
    if (!photos.length || !openers.length) return;
    var box = null, cur = 0, opener = null, touchX = null;
    /* the hero strip: native scroll-snap does the swiping, this keeps the dots and arrows in step and lets the viewer hand back to the same slide */
    var strip = $("#hero-track", root), slides = strip ? $$(".hero-slide", strip) : [], dots = $$(".hero-dots button", root), sCur = 0, sTimer = null;
    function slideIdx() { return strip && strip.clientWidth ? Math.max(0, Math.min(slides.length - 1, Math.round(strip.scrollLeft / strip.clientWidth))) : 0; }
    function slideTo(i, instant) {
      if (!strip || slides.length < 2) return;
      i = ((i % slides.length) + slides.length) % slides.length;
      var left = i * strip.clientWidth;
      if (instant || !("scrollTo" in strip)) strip.scrollLeft = left; else strip.scrollTo({ left: left, behavior: "smooth" });
      markSlide(i);
    }
    function markSlide(i) { if (i === sCur) return; sCur = i; dots.forEach(function (d, j) { d.setAttribute("aria-selected", j === i ? "true" : "false"); }); }
    if (strip && slides.length > 1) {
      strip.addEventListener("scroll", function () { clearTimeout(sTimer); sTimer = setTimeout(function () { markSlide(slideIdx()); }, 80); }, { passive: true });
      dots.forEach(function (d) { d.addEventListener("click", function () { slideTo(+d.getAttribute("data-i")); }); });
      var pv = $(".hero-prev", root), nx = $(".hero-next", root);
      if (pv) pv.addEventListener("click", function () { slideTo(slideIdx() - 1); });
      if (nx) nx.addEventListener("click", function () { slideTo(slideIdx() + 1); });
      strip.addEventListener("keydown", function (e) { if (e.key === "ArrowRight") { slideTo(slideIdx() + 1); e.preventDefault(); } else if (e.key === "ArrowLeft") { slideTo(slideIdx() - 1); e.preventDefault(); } });
      window.addEventListener("resize", function () { slideTo(sCur, true); }); // a rotated phone keeps the same photo in view
    }
    var SVG_X = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"></path></svg>';
    var SVG_ARROW = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="M13 6l6 6-6 6"></path></svg>';
    function build() {
      box = document.createElement("div");
      box.className = "lb"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-label", (V.name || "") + " photos"); box.hidden = true;
      box.innerHTML = '<button type="button" class="lb-x" aria-label="Close the photos">' + SVG_X + '</button>' +
        '<button type="button" class="lb-prev" aria-label="Previous photo">' + SVG_ARROW + '</button>' +
        '<figure class="lb-fig"><img class="lb-img" alt=""><figcaption class="lb-cap"><span class="lb-alt"></span><span class="lb-n"></span></figcaption></figure>' +
        '<button type="button" class="lb-next" aria-label="Next photo">' + SVG_ARROW + '</button>';
      document.body.appendChild(box);
      if (photos.length < 2) { $(".lb-prev", box).hidden = true; $(".lb-next", box).hidden = true; $(".lb-n", box).hidden = true; }
      $(".lb-x", box).addEventListener("click", close);
      $(".lb-prev", box).addEventListener("click", function () { go(-1); });
      $(".lb-next", box).addEventListener("click", function () { go(1); });
      $(".lb-img", box).addEventListener("click", function (e) { if (photos.length < 2) return; var r = e.currentTarget.getBoundingClientRect(); go(e.clientX - r.left > r.width / 2 ? 1 : -1); });
      box.addEventListener("click", function (e) { if (e.target === box || e.target.classList.contains("lb-fig")) close(); });
      box.addEventListener("touchstart", function (e) { touchX = e.touches && e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
      box.addEventListener("touchend", function (e) { if (touchX == null || !e.changedTouches || !e.changedTouches.length) return; var dx = e.changedTouches[0].clientX - touchX; touchX = null; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); }, { passive: true });
    }
    function show(i) {
      cur = (i + photos.length) % photos.length;
      var p = photos[cur], im = $(".lb-img", box);
      im.src = p[0]; im.alt = p[1] || "";
      $(".lb-alt", box).textContent = p[1] || "";
      $(".lb-n", box).textContent = (cur + 1) + " / " + photos.length;
      [cur + 1, cur - 1].forEach(function (j) { var q = photos[(j + photos.length) % photos.length]; if (q && q !== p) { var pre = new Image(); pre.src = q[0]; } });
    }
    function go(d) { show(cur + d); }
    function onKey(e) {
      if (e.key === "Escape") { close(); return; }
      if (e.key === "ArrowRight") { go(1); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { go(-1); e.preventDefault(); }
      else if (e.key === "Tab") { /* keep the focus inside the viewer */
        var f = $$("button:not([hidden])", box); if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
        else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
      }
    }
    function open(i, from) {
      if (!box) build();
      opener = from || null;
      show(i);
      box.hidden = false;
      document.documentElement.classList.add("lb-open-page");
      document.addEventListener("keydown", onKey);
      setTimeout(function () { $(".lb-x", box).focus(); }, 0);
      track("exp_photos", { venue: V.slug, photo: cur + 1 });
    }
    function close() {
      if (!box || box.hidden) return;
      box.hidden = true;
      document.documentElement.classList.remove("lb-open-page");
      document.removeEventListener("keydown", onKey);
      slideTo(cur, true); // the strip shows the photo you closed on
      if (opener && opener.focus) { try { opener.focus(); } catch (e) {} }
    }
    openers.forEach(function (b) {
      b.addEventListener("click", function () { open(+(b.getAttribute("data-i") || 0), b.tagName === "BUTTON" ? b : $(".photos-btn", root) || b); });
      if (b.tagName === "IMG") { b.setAttribute("role", "button"); b.setAttribute("tabindex", "0"); b.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(+(b.getAttribute("data-i") || 0), b); } }); }
    });
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
      payWhen: $("#pay-when", root), step1: $("#step-1", root), step2: $("#step-2", root), next: $("#next", root), nextSub: $("#next-sub", root), back: $("#step-back", root), sum: $("#sum", root),
      cruiseLink: $("#cruise-link", root), cruiseWrap: $("#pf-cruise-wrap", root),
    };
    var state = { product: null, rate: V.rates ? "visitor" : (V.products[0] && V.products[0].audience === "resident" ? "resident" : "visitor"), date: "", time: "", adults: 2, children: 0, pickup: V.pickups ? V.pickups[0].key : null, pickupMode: "hotel", pickupHotel: "", pickupPlace: null, choices: {}, sessions: null, availOk: null, ref: ref(), aboard: 0, cruisePort: null, step: 1, cruiseOpen: false };
    var HOTELS = hotelsOf(X), REGIONS = X.regions || {};

    /* ---- ship days: which port the guest is coming from, and what fits before all-aboard ---- */
    var SD = X.shipDay || null;
    var qsHotel = new URLSearchParams(location.search).get("hotel");
    var myHotel = (qsHotel && HOTELS.filter(function (hh) { return hh.slug === qsHotel; })[0]) || savedHotel(X);
    if (qsHotel && myHotel && myHotel.slug === qsHotel) store("gv_hotel", myHotel.slug);
    var portPickups = !!V.pickups && V.pickups.some(function (pk) { return HOTELS.some(function (hh) { return hh.port && hh.slug === pk.key; }); });
    function portOf() {
      if (portPickups && state.pickupMode === "hotel" && state.pickupPlace) return state.pickupPlace.port ? state.pickupPlace : null;
      if (portPickups && state.pickupMode !== "hotel") return null;
      if (state.cruisePort) return state.cruisePort;
      return myHotel && myHotel.port ? myHotel : null;
    }
    function cruise() { return !!SD && V.sd !== 0 && rateOf(product()) !== "resident" && (!!portOf() || !!(el.ship && el.ship.value.trim())); } // residents are never off a ship // lounges are flight-day things, the ship state never applies to them
    function backBy() { return state.aboard ? state.aboard - 60 : SD.backBy; }
    function portDrive() { var pt = portOf(); return pt ? driveMin(pt, V, REGIONS) : null; }
    function driveTier() { return cruise() ? shipTier(SD, V.sd, portDrive()) : "ok"; }
    function slotOk(p, startMins) { if (!cruise()) return true; if (driveTier() === "no" || V.sd === 0) return false; return shipSlotOk(SD, p, startMins, portDrive(), backBy()); }
    function productOk(p) { if (!p || !cruise()) return true; var times = p.times || []; if (!times.length) return slotOk(p, p.sd && p.sd.starts && p.sd.starts.length ? p.sd.starts[0] : null); return times.some(function (t) { return slotOk(p, clockMins(t)); }); }
    function portThatWorks() { /* the nearest port this tour does fit from, for the "try it from" line */
      var best = null; HOTELS.filter(function (hh) { return hh.port; }).forEach(function (pt) { var d = driveMin(pt, V, REGIONS); if (d == null || shipTier(SD, V.sd, d) !== "ok") return; var fits = V.products.some(function (p) { var times = p.times || []; return times.length ? times.some(function (t) { return shipSlotOk(SD, p, clockMins(t), d, SD.backBy); }) : shipSlotOk(SD, p, p.sd && p.sd.starts && p.sd.starts.length ? p.sd.starts[0] : null, d, SD.backBy); }); if (fits && (!best || d < best.d)) best = { pt: pt, d: d }; });
      return best;
    }
    function shipBlock() { if (!cruise()) return false; if (driveTier() === "no" || V.sd === 0) return true; var p = product(); return !!p && !productOk(p); }
    function shipAsk() { return cruise() && driveTier() === "ask"; }
    function shipText() { /* the line under the all-aboard chips, and the CTA note when the ship day decides the path */
      var pt = portOf(), d = portDrive(), tier = driveTier();
      if (V.sd === 0) return "Airport lounges are for flight days, not ship days.";
      if (pt && tier === "no") { var w = portThatWorks(); return "Not on a ship day from " + pt.name + ": " + driveLabel(d) + " each way." + (w ? " It works from " + w.pt.name + " (" + driveLabel(w.d) + ")." : ""); }
      if (pt && tier === "ask") return "A long day from " + pt.name + ", " + driveLabel(d) + " each way. We check it against your all-aboard time before anything is charged.";
      var p = product();
      if (p && !productOk(p)) return "This option can't get you back to the pier by " + clockText(backBy()) + (state.aboard ? "" : ". Later all-aboard? Pick it above") + ".";
      return "Back at the pier by " + clockText(backBy()) + (state.aboard ? ", an hour before all-aboard" : " unless you tell us your all-aboard time") + (pt && d != null ? ", " + driveLabel(d) + " each way from " + pt.name : "") + ".";
    }

    /* expired seasonal products (belt and braces: the build already drops them) */
    $$("[data-until]", root).forEach(function (o) { if (o.getAttribute("data-until") < today) { o.setAttribute("data-expired", ""); var r = $("input", o); if (r) r.checked = false; } });
    /* ?option=<id> opens the page with that option picked (the hub's zipline photo links to /experiences/jamwest?option=zipline) */
    var qOpt = new URLSearchParams(location.search).get("option"), optIn = qOpt ? $$(".op:not([data-expired]) input[name=product]", root).filter(function (r) { return r.value === qOpt; })[0] : null;
    if (optIn) $$(".op input[name=product]", root).forEach(function (r) { r.checked = r === optIn; });
    var first = $$(".op:not([data-expired]) input[name=product]", root)[0];
    if (first && !$$(".op:not([data-expired]) input[name=product]:checked", root).length) first.checked = true;

    function product() { return products[state.product] || null; }
    function rateOf(p) { if (!p) return "visitor"; if (p.audience === "resident") return "resident"; if (p.audience === "visitor") return "visitor"; return state.rate; }
    function pickupByHand() { var pk = V.pickups && rateOf(product()) === "visitor" ? pickupOf() : null; return !!(pk && pk.request); }
    function instant() { var p = product(); return V.booking === "instant" && rateOf(p) === "visitor" && p && p.visitor && !p.request && !pickupByHand() && !shipBlock() && !shipAsk(); }
    /* JamWest tours in the next 7 days can be reserved now and paid on arrival */
    function daysAhead(d) { var t = new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10); return Math.round((Date.parse(d + "T00:00:00Z") - Date.parse(t + "T00:00:00Z")) / 864e5); }
    function arrivalOk() { var p = product(); if (!el.payWhen || !state.date || !p || rateOf(p) !== "visitor" || !instant()) return false; var n = daysAhead(state.date); return n >= 0 && n <= 7; }
    function payOnArrival() { if (!arrivalOk()) return false; var c = el.payWhen.querySelector("input[name=paywhen]:checked"); return !!(c && c.value === "arrival"); }
    function isRequest() { var p = product(); return V.booking === "request" || (p && p.request) || pickupByHand() || shipAsk() || shipBlock(); }
    function pickupOf() { if (!V.pickups) return null; for (var i = 0; i < V.pickups.length; i++) if (V.pickups[i].key === state.pickup) return V.pickups[i]; return V.pickups[0]; }
    function chosen() { var p = product(); if (!p || !p.choose) return []; return state.choices[p.id] || []; }

    function price() {
      var p = product(); if (!p) return { lead: usd(0), sub: "", total: 0, cur: "USD", note: "" };
      var r = rateOf(p), a = state.adults, c = state.children;
      if (p.perParty) { return { lead: usd(p.visitor.usd), sub: "total for two people", total: p.visitor.usd, cur: "USD", note: "Priced for two people, not per person." }; }
      if (r === "resident" && p.resident) {
        var childKnown = p.resident.jmdChild != null;
        var tot = a * p.resident.jmd + (childKnown ? c * p.resident.jmdChild : 0);
        return { lead: jmd(tot), sub: "total for " + a + " adult" + (a === 1 ? "" : "s") + (c ? " + " + c + " child" + (c === 1 ? "" : "ren") : ""), total: tot, cur: "JMD", note: !childKnown && c ? "Children on the resident rate are priced when we confirm." : "Resident rate, Jamaican ID at the gate." };
      }
      if (p.visitor) {
        var pk = state.pickupMode === "other" || (state.pickupMode === "hotel" && state.pickupHotel) ? pickupOf() : null, add = pk ? (pk.add || 0) : 0, addC = pk ? (pk.addChild != null ? pk.addChild : add) : 0;
        var childKnownV = p.visitor.usdChild != null;
        var totV = a * (p.visitor.usd + add) + (childKnownV ? c * (p.visitor.usdChild + addC) : 0);
        return { lead: usd(totV), sub: "total for " + a + " adult" + (a === 1 ? "" : "s") + (c ? " + " + c + " child" + (c === 1 ? "" : "ren") : ""), total: totV, cur: "USD", note: !childKnownV && c ? "Children are priced when we confirm." : (add ? "Includes " + usd(add) + " per person for pickup." : "") };
      }
      return { lead: "Price on request", sub: "", total: 0, cur: "USD", note: "" };
    }

    function dateProblem(iso) {
      if (!iso) return "";
      var d = parseDate(iso); if (!d) return "";
      if (iso < today) return "That date has passed.";
      if (V.closedWeekdays && V.closedWeekdays.indexOf(d.getUTCDay()) >= 0) return V.name + " is closed on " + DAYS[d.getUTCDay()] + "days. Pick another day and we'll price the same thing.";
      if (V.childDays && state.children > 0 && V.childDays.indexOf(d.getUTCDay()) < 0) return V.childDaysText || "Children sail on the family days only. Pick one of those, or book adults only.";
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
      if (V.pickups && rateOf(p) === "visitor") { var pk = pickupOf(); if (pk) lines.push("Pickup: " + (pk.key === "own" ? "making my own way" : (state.pickupHotel && state.pickupHotel !== pk.label ? state.pickupHotel + " (" + pk.label + ")" : pk.label) + (pk.request ? ", transfer to be priced" : ""))); }
      var ch = chosen(); if (ch.length) lines.push("Choice: " + (p.choose.fixed ? p.choose.fixed + " + " : "") + ch.join(" + "));
      if (pr.total) lines.push("Total: " + pr.lead + (pr.alt ? " (" + pr.alt + ")" : "") + (pr.note ? ". " + pr.note : ""));
      else lines.push("Total: to be priced");
      var nm = [el.first && el.first.value.trim(), el.last && el.last.value.trim()].filter(Boolean).join(" ");
      if (nm) lines.push("Name: " + nm);
      if (cruise()) { var pt0 = portOf(); lines.push("Cruise: " + [el.ship && el.ship.value.trim(), pt0 ? "from " + pt0.name : "", state.aboard ? "all-aboard " + clockText(state.aboard) : "all-aboard time not given"].filter(Boolean).join(", ") + (shipBlock() ? " (flagged: not on a ship day)" : shipAsk() ? " (long day, please check)" : "")); }
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
      var late = function (s) { return !slotOk(p, clockMins(s.time)); };
      if (!state.time || !list.some(function (s) { return s.time === state.time && s.seats !== 0 && !late(s); })) { var firstOk = list.filter(function (s) { return s.seats !== 0 && !late(s); })[0]; state.time = firstOk ? firstOk.time : ""; }
      list.forEach(function (s) {
        var b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.setAttribute("data-time", s.time);
        b.innerHTML = s.time + (s.seats != null && s.seats > 0 && s.seats < 6 ? "<small>" + s.seats + " left</small>" : "");
        if (s.seats === 0) { b.disabled = true; b.setAttribute("aria-disabled", "true"); }
        else if (late(s)) { b.disabled = true; b.setAttribute("aria-disabled", "true"); b.classList.add("chip-late"); b.title = "Back after all-aboard"; b.innerHTML = s.time + "<small>after all-aboard</small>"; }
        b.setAttribute("aria-pressed", s.time === state.time ? "true" : "false");
        b.addEventListener("click", function () { state.time = s.time; renderTimes(); render(); });
        el.times.appendChild(b);
      });
      if (el.timesNote) {
        if (cruise() && list.length && list.every(late)) { el.timesNote.hidden = false; el.timesNote.className = "pf-hint bad"; el.timesNote.textContent = "No start gets you back to the pier by " + clockText(backBy()) + (portOf() ? " from " + portOf().name : "") + "." + (state.aboard ? "" : " Later all-aboard? Pick it below."); }
        else if (state.availOk === false) { el.timesNote.hidden = false; el.timesNote.className = "pf-hint"; el.timesNote.textContent = "Live availability is offline right now, so we'll confirm the time by WhatsApp."; }
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
      /* ship days: options that can't get the guest back in time are greyed out, the all-aboard chips show once we know they're off a ship */
      var isCruise = cruise();
      $$(".op", root).forEach(function (o) {
        var op = products[o.getAttribute("data-id")]; if (!op) return;
        var ok = !isCruise || productOk(op), inp = $("input", o), badge = $(".op-badge-ship", o);
        o.classList.toggle("op-noship", !ok); if (inp) inp.disabled = !ok;
        if (!ok && !badge) { badge = document.createElement("span"); badge.className = "op-badge op-badge-ship"; var head = $(".op-head", o); if (head) head.appendChild(badge); }
        if (!ok && badge) badge.textContent = (op.sd && op.sd.no) || driveTier() === "no" ? "Not on a ship day" : "Ends after all-aboard";
        else if (ok && badge) badge.remove();
      });
      if (isCruise && !productOk(p) && driveTier() !== "no" && V.sd !== 0) { var alt = V.products.filter(productOk)[0]; if (alt) { selectProduct(alt.id); return; } }
      var aboardWrap = $("#pf-aboard-wrap", root); if (aboardWrap) aboardWrap.hidden = !isCruise || V.sd === 0;
      /* the cruise question: a small link under the date until the guest opens it, or the site already knows the port; never for residents */
      var cruiseAllowed = !!SD && !isFlight && !portPickups && V.sd !== 0 && r === "visitor";
      if (el.cruiseLink) el.cruiseLink.hidden = !cruiseAllowed || isCruise || state.cruiseOpen;
      if (el.cruiseWrap) el.cruiseWrap.hidden = !cruiseAllowed || !(isCruise || state.cruiseOpen);
      var shipNote = $("#ship-note", root); if (shipNote && isCruise) { shipNote.textContent = shipText(); shipNote.className = "pf-hint" + (shipBlock() ? " bad" : shipAsk() ? " warn" : ""); }
      $$("#pf-aboard .chip", root).forEach(function (b) { b.setAttribute("aria-pressed", (+b.getAttribute("data-aboard") || 0) === state.aboard ? "true" : "false"); });
      var pt1 = portOf(); $$("#pf-ports .chip", root).forEach(function (b) { b.setAttribute("aria-pressed", pt1 && pt1.slug === b.getAttribute("data-port") ? "true" : "false"); });
      var fh0 = $("#fact-hotel", root), fht0 = $("#fact-hotel-t", root);
      if (fh0 && fht0 && myHotel && myHotel.port) { var dm = driveMin(myHotel, V, REGIONS), tr = shipTier(SD, V.sd, dm); fh0.hidden = dm == null && tr !== "no"; fht0.textContent = (dm != null ? driveLabel(dm) + " from " + myHotel.name : myHotel.name) + (tr === "no" || V.sd === 0 ? " · not on a ship day" : tr === "ask" ? " · a long day, we check it first" : " · fits a ship day"); }
      /* contact + cta */
      if (el.contact) el.contact.hidden = !inst;
      var shipWrap = $("#pf-ship-wrap", root); if (shipWrap) shipWrap.hidden = V.slug.indexOf("club-") === 0;
      var liveOff = inst && live && state.availOk === false;
      var canPay = inst && !liveOff;
      el.cta.innerHTML = (canPay ? ICON_CARD : ICON_CHAT) + '<span id="cta-label"></span>';
      $("#cta-label", el.cta).textContent = canPay ? "Book and pay " + pr.lead : shipBlock() ? "Ask us anyway" : (isRequest() ? "Request this date" : "Send enquiry");
      if (el.payWhen) {
        el.payWhen.hidden = !arrivalOk();
        if (payOnArrival()) { el.cta.innerHTML = ICON_CARD + '<span id="cta-label"></span>'; $("#cta-label", el.cta).textContent = "Reserve, pay " + pr.lead + " on arrival"; if (el.preview && el.preview.parentNode) el.preview.parentNode.hidden = true; if (el.ctaAlt) el.ctaAlt.hidden = true; }
      }
      el.ctaSub.textContent = canPay ? (live ? "Confirmed straight away, paid by card on a secure page. You'll get the confirmation by email." : "Paid by card on a secure page and confirmed straight away. We send your booking details shortly by email and WhatsApp.") : liveOff ? "Live availability is offline, so this goes to us on WhatsApp and we confirm the time with the park. Nothing is charged now." : shipBlock() ? shipText() + " Ask us anyway and we'll suggest what fits your ship day. Nothing is charged now." : shipAsk() ? shipText() + " This goes to us on WhatsApp first. Nothing is charged now." : pickupByHand() ? "Pickup from the port is priced by hand, so this goes to us on WhatsApp first and we confirm the total. Nothing is charged now." : isRequest() ? "We confirm availability first, then send a secure card link. Nothing is charged now." : "We reply within working hours with a secure card link. Nothing is charged now.";
      if (el.ctaAlt) el.ctaAlt.hidden = !canPay;
      if (el.previewWrap) el.previewWrap.hidden = canPay; // the WhatsApp text only matters when the booking goes by WhatsApp
      if (el.dateNote) { var prob = dateProblem(state.date); el.dateNote.hidden = !prob; el.dateNote.className = "pf-hint bad"; el.dateNote.textContent = prob; }
      el.preview.textContent = message();
      /* two steps: the booking and its total first, then who's booking and the payment */
      if (el.step1) el.step1.hidden = state.step !== 1;
      if (el.step2) el.step2.hidden = state.step !== 2;
      if (el.nextSub) el.nextSub.textContent = canPay ? "Next: your details, then a secure card page. Nothing is charged yet." : "Next: send it to us on WhatsApp. Nothing is charged now.";
      if (el.stickyCta) el.stickyCta.firstChild.textContent = state.step === 1 ? "Continue" : (canPay ? "Book" : "Request");
      renderSummary(p, pr, r);
      syncSticky();
      cals.forEach(function (c) { c.refresh(); });
    }
    function renderSummary(p, pr, r) {
      if (!el.sum) return;
      el.sum.innerHTML = "";
      var lines = [];
      var ch = chosen();
      lines.push(["b", p.name + (ch.length ? " · " + (p.choose && p.choose.fixed ? p.choose.fixed + " + " : "") + ch.join(" + ") : "")]);
      if (isFlight) {
        var legs = p.legs || "both", fi = el.flightIn ? el.flightIn.value.trim().toUpperCase() : "", fo = el.flightOut ? el.flightOut.value.trim().toUpperCase() : "";
        if (legs !== "out") lines.push(["", "Arrives " + (state.date ? longDate(state.date) : "") + (fi ? " on " + fi : "")]);
        if (legs !== "in") lines.push(["", "Departs " + ((legs === "both" ? (el.date2 && el.date2.value ? longDate(el.date2.value) : "") : (state.date ? longDate(state.date) : ""))) + (fo ? " on " + fo : "")]);
      } else lines.push(["", (state.date ? longDate(state.date) : "Date to confirm") + (state.time ? " at " + state.time : "")]);
      lines.push(["", p.perParty ? "2 people" : state.adults + " adult" + (state.adults === 1 ? "" : "s") + (state.children ? ", " + state.children + " child" + (state.children === 1 ? "" : "ren") : "")]);
      if (V.pickups && r === "visitor") { var pk = pickupOf(); if (pk) lines.push(["", pk.key === "own" ? "Making my own way" : "Pickup: " + (state.pickupHotel && state.pickupHotel !== pk.label ? state.pickupHotel : pk.label)]); }
      if (cruise()) { var pt0 = portOf(); lines.push(["", "Off a ship" + (pt0 ? ", " + pt0.name : "") + (state.aboard ? ", all-aboard " + clockText(state.aboard) : "")]); }
      if (r === "resident") lines.push(["", "Resident rate, Jamaican ID at the gate"]);
      lines.forEach(function (l) { var e = document.createElement(l[0] ? "b" : "span"); e.textContent = l[1]; el.sum.appendChild(e); });
    }
    function goStep(n) {
      state.step = n; render();
      var pr = panel.getBoundingClientRect(); if (pr.top < 0 || pr.top > innerHeight * 0.5) panel.scrollIntoView({ block: "start", behavior: "smooth" });
      if (panel.scrollHeight > panel.clientHeight + 4) panel.scrollTo({ top: 0, behavior: "smooth" });
      if (n === 2 && el.contact && !el.contact.hidden && el.first) setTimeout(function () { el.first.focus({ preventScroll: true }); }, 450);
      track("exp_step", { venue: V.slug, step: n });
    }
    /* what step one needs before the guest moves on (the same checks run again at payment) */
    function checkStep1() {
      var p = product(), prob = dateProblem(state.date), legs = p.legs || "both";
      if (!state.date) { openDate(0); throw new Error(isFlight ? (legs === "out" ? "Pick your departure date first." : "Pick your arrival date first.") : "Pick a date first."); }
      if (prob) throw new Error(prob);
      var wantsTime = (p.times && p.times.length) || (state.sessions && state.sessions.length);
      if (wantsTime && !state.time) throw new Error("Pick a start time.");
      if (isFlight) {
        var flightIn = el.flightIn ? el.flightIn.value.trim().toUpperCase() : "", flightOut = el.flightOut ? el.flightOut.value.trim().toUpperCase() : "", date2 = el.date2 ? el.date2.value : "";
        var flightRe = /^[A-Z0-9]{2,3}\s?\d{1,4}[A-Z]?$/;
        if (legs !== "out" && !flightRe.test(flightIn)) { el.flightIn.focus(); throw new Error("We need the arriving flight number, e.g. BA2263."); }
        if (legs !== "in" && !flightRe.test(flightOut)) { el.flightOut.focus(); throw new Error("We need the departing flight number, e.g. BA2262."); }
        if (legs === "both" && (!date2 || date2 < state.date)) { openDate(1); throw new Error("Pick the departure date too."); }
      }
      if (V.pickups && rateOf(p) === "visitor" && state.pickup !== "own" && !state.pickupHotel && instant()) { if (el.hotelIn) el.hotelIn.focus(); throw new Error("Where should the driver collect you? Pick your hotel or area from the list, or choose I'll make my own way."); }
    }
    var ICON_CARD = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;display:block"><rect x="2" y="5" width="20" height="14" rx="2"></rect><path d="M2 10h20"></path></svg>';
    var ICON_CHAT = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none;display:block"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>';

    /* option rows */
    function selectProduct(id, scroll) {
      state.product = id; state.time = ""; state.sessions = null; state.availOk = null; if (state.step !== 1) state.step = 1;
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
    /* ---- our own calendar on the date boxes: a native date box can't grey out days, this one greys past days, closed weekdays,
       blackout dates, the end of an offer, and the non-family days when children are in the party (the same rules as dateProblem) ---- */
    var LONG_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    var cals = [];
    function openDate(i) { var c = cals[i]; if (c) c.open(); else { var f = i ? el.date2 : el.date; if (f) f.focus(); } }
    function makeCal(input, opts) {
      if (!input || !("closest" in input)) return null;
      var wrap = input.closest(".pf-in"), field = input.closest(".pf-f") || wrap; if (!wrap || !field) return null;
      var host = field.parentElement || field; // the popover sits beside the label, not inside it: a click inside a label is forwarded to its button
      input.type = "hidden";
      var btn = document.createElement("button"); btn.type = "button"; btn.className = "date-btn"; btn.setAttribute("aria-haspopup", "dialog"); btn.setAttribute("aria-expanded", "false");
      wrap.appendChild(btn); wrap.classList.add("has-cal");
      var pop = document.createElement("div"); pop.className = "cal"; pop.setAttribute("role", "dialog"); pop.setAttribute("aria-label", opts.label || "Pick a date"); pop.hidden = true;
      host.classList.add("cal-host"); host.appendChild(pop);
      var view = null; // first day of the month on show
      function iso(d) { return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0"); }
      function label() { btn.textContent = input.value ? longDate(input.value) : (opts.placeholder || "Pick a date"); btn.classList.toggle("empty", !input.value); }
      function paint() {
        var t = parseDate(today), sel = input.value ? parseDate(input.value) : null;
        if (!view) view = sel ? new Date(Date.UTC(sel.getUTCFullYear(), sel.getUTCMonth(), 1)) : new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1));
        var y = view.getUTCFullYear(), m = view.getUTCMonth(), first = new Date(Date.UTC(y, m, 1)), daysIn = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
        var canBack = new Date(Date.UTC(y, m, 1)) > new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1));
        var h = (opts.title ? '<p class="cal-title">' + opts.title + "</p>" : "") + '<div class="cal-head"><button type="button" class="cal-nav" data-nav="-1" aria-label="Previous month"' + (canBack ? "" : " disabled") + '>&#8249;</button><b>' + ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][m] + " " + y + '</b><button type="button" class="cal-nav" data-nav="1" aria-label="Next month">&#8250;</button></div>';
        h += '<div class="cal-grid cal-dow">' + ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(function (d) { return "<span>" + d + "</span>"; }).join("") + "</div><div class=\"cal-grid\">";
        for (var i = 0; i < first.getUTCDay(); i++) h += "<span></span>";
        for (var d = 1; d <= daysIn; d++) {
          var ds = iso(new Date(Date.UTC(y, m, d))), why = opts.problem(ds), off = !!why, isSel = sel && ds === input.value, isToday = ds === today;
          h += '<button type="button" class="cal-d' + (isSel ? " sel" : "") + (isToday ? " today" : "") + '" data-d="' + ds + '"' + (off ? ' disabled aria-disabled="true" title="' + why.replace(/"/g, "&quot;") + '"' : "") + ">" + d + "</button>";
        }
        h += "</div>";
        var legend = opts.legend ? opts.legend() : "";
        if (legend) h += '<p class="cal-legend">' + legend + "</p>";
        pop.innerHTML = h;
        $$(".cal-nav", pop).forEach(function (b) { b.addEventListener("click", function () { var nav = b.getAttribute("data-nav"); view = new Date(Date.UTC(view.getUTCFullYear(), view.getUTCMonth() + (+nav), 1)); paint(); var again = $('.cal-nav[data-nav="' + nav + '"]:not([disabled])', pop) || $(".cal-d:not([disabled])", pop); if (again) again.focus({ preventScroll: true }); }); }); // the repaint replaced the button that had focus, so put focus back inside the calendar
        $$(".cal-d:not([disabled])", pop).forEach(function (b) { b.addEventListener("click", function () { input.value = b.getAttribute("data-d"); label(); close(); input.dispatchEvent(new Event("change", { bubbles: true })); }); });
      }
      var openedAt = 0;
      function open() { cals.forEach(function (c) { if (c !== api) c.close(); }); view = null; paint(); pop.hidden = false; openedAt = Date.now(); btn.setAttribute("aria-expanded", "true"); setTimeout(function () { if (pop.scrollIntoView) pop.scrollIntoView({ block: "nearest" }); var f = $(".cal-d.sel", pop) || $(".cal-d:not([disabled])", pop); if (f) f.focus({ preventScroll: true }); }, 0); } // the desktop panel scrolls inside itself, so bring the whole month into view
      function close() { if (pop.hidden) return; pop.hidden = true; btn.setAttribute("aria-expanded", "false"); }
      btn.addEventListener("click", function () { if (pop.hidden) open(); else close(); });
      pop.addEventListener("keydown", function (e) {
        if (e.key === "Escape") { e.preventDefault(); close(); btn.focus(); return; }
        var days = $$(".cal-d:not([disabled])", pop), i = days.indexOf(document.activeElement); if (i < 0) return;
        var step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 }[e.key]; if (!step) return;
        e.preventDefault(); var cur = +document.activeElement.getAttribute("data-d").slice(8), want = cur + step, next = null;
        days.forEach(function (d) { var n = +d.getAttribute("data-d").slice(8); if (step > 0 ? (n >= want && !next) : (n <= want)) next = d; }); // the nearest open day in that direction
        if (next) next.focus({ preventScroll: true });
      });
      document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !pop.hidden) { close(); btn.focus(); } }); // the whole page: focus may sit outside the calendar after a repaint
      document.addEventListener("click", function (e) { if (Date.now() - openedAt < 150) return; if (e.target && e.target.isConnected && !host.contains(e.target)) close(); }); // the Continue button opens it for an empty date, and that same click must not close it again; a month arrow repaints the grid before this runs, so a detached target was inside the calendar
      var api = { refresh: function () { label(); if (!pop.hidden) paint(); }, close: close, open: open };
      label(); cals.push(api); return api;
    }
    makeCal(el.date, { label: isFlight ? "Arrival date" : "Date", title: isFlight ? "Arrival date" : "", placeholder: "Pick a date", problem: function (ds) { return ds < today ? "That date has passed." : (isFlight ? "" : dateProblem(ds)); }, legend: function () {
      if (isFlight) return "";
      var bits = [];
      if (V.closedWeekdays && V.closedWeekdays.length) bits.push("Closed on " + V.closedWeekdays.map(function (n) { return LONG_DAYS[n] + "s"; }).join(" and "));
      if (V.childDays && state.children > 0) bits.push("With children: " + V.childDays.map(function (n) { return LONG_DAYS[n] + "s"; }).join(" and ") + " only");
      var p = product(); if (p && p.until) bits.push("This offer ends " + longDate(p.until));
      return bits.join(". ") + (bits.length ? "." : "");
    } });
    if (el.date2) makeCal(el.date2, { label: "Departure date", title: "Departure date", placeholder: "Pick a date", problem: function (ds) { return ds < today ? "That date has passed." : (state.date && ds < state.date ? "Before your arrival." : ""); } });
    [el.flightIn, el.flightOut, el.first, el.last, el.email, el.phone, el.ship].forEach(function (i) { if (i) i.addEventListener("input", render); });
    $$("[data-step]", root).forEach(function (b) { b.addEventListener("click", function () { var k = b.getAttribute("data-step"), d = +b.getAttribute("data-d"); state[k] = Math.max(k === "adults" ? 1 : 0, Math.min(MAX_GUESTS, state[k] + d)); el[k].value = state[k]; render(); }); });
    /* ---- pickup hotel picker ---- */
    function servedKey(key) { return V.pickups && V.pickups.some(function (pk) { return pk.key === key; }) ? key : null; }
    /* a place is picked up when its area (or its cruise port) is on the tour's list, it is not named as an exception,
       and it sits inside the tour's edge (Poko Loko: Couples Sans Souci and west) */
    function placeServed(hh) {
      var key = hh.port ? hh.slug : hh.region, pk = V.pickups && V.pickups.filter(function (x) { return x.key === key; })[0];
      if (!pk) return null;
      if ((pk.except && pk.except.indexOf(hh.slug) >= 0) || (pk.resortsOnly && !hh.resort)) return null;
      if ((pk.lngMax != null && hh.lng > pk.lngMax) || (pk.lngMin != null && hh.lng < pk.lngMin)) return null;
      return key;
    }
    /* the areas this tour picks up from, offered in the same list as the hotels for villas and Airbnbs (ports and "own" are not areas) */
    function areaRows(q) {
      if (!V.pickups) return [];
      var qq = normText(q);
      return V.pickups.filter(function (pk) { return pk.key !== "own" && !pk.request && !pk.resortsOnly && !HOTELS.some(function (hh) { return hh.port && hh.slug === pk.key; }); }).map(function (pk) {
        var reg = REGIONS[pk.key], label = (reg ? reg.label : pk.label.replace(/ (area )?hotel$/i, "")) + ", villa or Airbnb";
        return { area: true, key: pk.key, name: label, sub: pk.add ? "+" + usd(pk.add) + " each" : "pickup included", text: " " + label.toLowerCase() + " " + pk.label.toLowerCase() + " airbnb villa apartment guesthouse area " };
      }).filter(function (a) { return !qq || textMatches(a.text, qq); });
    }
    function pickArea(a) {
      state.pickupMode = "other"; state.pickupPlace = null; state.pickup = a.key; state.pickupHotel = el.pickupHotel ? el.pickupHotel.value.trim() : "";
      if (el.hotelIn) el.hotelIn.value = a.name;
      closeHotelList(); render(); track("exp_pickup_area", { venue: V.slug, area: a.key });
      if (el.pickupHotel) setTimeout(function () { el.pickupHotel.focus(); }, 50);
    }
    function renderPickup() {
      if (!V.pickups) return;
      var mode = state.pickupMode, pk = pickupOf();
      $$(".pickup-alts .chip", root).forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-pick") === mode ? "true" : "false"); });
      if (el.pickupOtherWrap) el.pickupOtherWrap.hidden = mode !== "other";
      if (el.pickupNote) {
        var t = "";
        if (mode === "own") t = "No pickup. The meeting point comes with your details.";
        else if (mode === "hotel" && state.pickupHotel && pk) t = pk.key === "own" ? "No pickup from " + state.pickupHotel + " on this one, so it's priced without pickup. Make your own way, or ask us on WhatsApp about a transfer." : pk.request ? "Pickup from " + pk.label + " is priced by hand, so this one goes to us on WhatsApp and we confirm the transfer price before anything is charged." : pk.label + (pk.add ? ", +" + usd(pk.add) + " per person" : ", pickup included") + ".";
        else if (mode === "other" && pk) t = pk.label.replace(/ hotel$/i, "") + (pk.add ? ", +" + usd(pk.add) + " per person" : ", pickup included") + ". Give us the villa or Airbnb name and we confirm the pickup point.";
        else t = V.pickupNote ? V.pickupNote : V.pickups.some(function (x) { return x.add; }) ? "Pickup from Negril hotels is included. Lucea and Montego Bay pickups are priced per person." : "Hotel pickup from Negril and Montego Bay is included.";
        el.pickupNote.textContent = t;
      }
    }
    function pickHotel(hh) {
      state.pickupMode = "hotel"; state.pickupHotel = hh.name; state.pickupPlace = hh;
      state.pickup = placeServed(hh) || "own";
      if (el.hotelIn) el.hotelIn.value = hh.name;
      closeHotelList(); render(); track("exp_pickup_hotel", { venue: V.slug, hotel: hh.slug, served: state.pickup !== "own" });
    }
    var hCursor = -1, portsOnly = false;
    function closeHotelList() { if (el.hotelList) { el.hotelList.hidden = true; el.hotelList.innerHTML = ""; } hCursor = -1; }
    function openHotelList(q) {
      if (!el.hotelList) return;
      var found = matchPlaces(HOTELS, q, { portsOnly: portsOnly }), hits = found.filter(function (hh) { return !hh.port || placeServed(hh); }); portsOnly = false; // only the cruise ports this tour picks up from
      var areas = areaRows(q);
      el.hotelList.innerHTML = ""; hCursor = -1;
      if (!hits.length && !areas.length) { var li0 = document.createElement("li"); li0.className = "none"; li0.textContent = V.pickupNotListed || "Not on our list. Type your area (" + (V.pickupAreas || "Negril, Lucea or Montego Bay") + ") for a villa or Airbnb, or make your own way."; el.hotelList.appendChild(li0); }
      else if (!hits.length) { var li1 = document.createElement("li"); li1.className = "none"; li1.textContent = "Not on our list? Pick your area for a villa or Airbnb:"; el.hotelList.appendChild(li1); }
      hits.forEach(function (hh) {
        var li = document.createElement("li"); li.setAttribute("role", "option"); li.innerHTML = "<span></span><small></small>";
        var sk = placeServed(hh), spk = sk && V.pickups.filter(function (x) { return x.key === sk; })[0];
        li.firstChild.textContent = hh.name; li.lastChild.textContent = !sk ? "no pickup" : (spk && spk.request ? "priced by hand" : (hh.port ? "Cruise port" : (REGIONS[hh.region] ? REGIONS[hh.region].label : hh.region)));
        li.addEventListener("mousedown", function (e) { e.preventDefault(); pickHotel(hh); });
        el.hotelList.appendChild(li);
      });
      /* only near misses for what they typed: their hotel may not be on the list, so say what to do then */
      if (found.near && hits.length && !areas.length) { var li2 = document.createElement("li"); li2.className = "none"; li2.textContent = V.pickupNotListed || "Not the one? Type your area (" + (V.pickupAreas || "Negril, Lucea or Montego Bay") + ") for a villa or Airbnb, or make your own way."; el.hotelList.appendChild(li2); }
      areas.forEach(function (a) {
        var li = document.createElement("li"); li.setAttribute("role", "option"); li.className = "area"; li.innerHTML = "<span></span><small></small>";
        li.firstChild.textContent = a.name; li.lastChild.textContent = a.sub;
        li.addEventListener("mousedown", function (e) { e.preventDefault(); pickArea(a); });
        el.hotelList.appendChild(li);
      });
      /* the open list sits over the chip below it, so the same choice is offered as the last row */
      var liOwn = document.createElement("li"); liOwn.setAttribute("role", "option"); liOwn.className = "own"; liOwn.innerHTML = "<span></span><small></small>";
      liOwn.firstChild.textContent = "I'll make my own way"; liOwn.lastChild.textContent = "no pickup";
      liOwn.addEventListener("mousedown", function (e) { e.preventDefault(); setOwnWay(true); });
      el.hotelList.appendChild(liOwn);
      el.hotelList.hidden = false;
    }
    function setOwnWay(on) {
      state.pickupPlace = null; state.pickupHotel = "";
      if (on) { state.pickupMode = "own"; state.pickup = "own"; closeHotelList(); if (el.hotelIn) el.hotelIn.blur(); }
      else { state.pickupMode = "hotel"; state.pickup = V.pickups[0].key; if (el.hotelIn) setTimeout(function () { el.hotelIn.focus(); }, 50); }
      if (el.hotelIn) el.hotelIn.value = "";
      render();
    }
    if (el.hotelIn) {
      el.hotelIn.addEventListener("input", function () { if (state.pickupMode !== "hotel" || el.hotelIn.value !== state.pickupHotel) { state.pickupMode = "hotel"; state.pickup = V.pickups[0].key; state.pickupHotel = ""; state.pickupPlace = null; render(); } openHotelList(el.hotelIn.value); });
      var blurTimer = null;
      el.hotelIn.addEventListener("focus", function () { clearTimeout(blurTimer); openHotelList(el.hotelIn.value); });
      el.hotelIn.addEventListener("blur", function () { blurTimer = setTimeout(closeHotelList, 150); });
      el.hotelIn.addEventListener("keydown", function (e) {
        var items = $$("li[role=option]", el.hotelList);
        if (e.key === "ArrowDown") { e.preventDefault(); hCursor = Math.min(items.length - 1, hCursor + 1); }
        else if (e.key === "ArrowUp") { e.preventDefault(); hCursor = Math.max(0, hCursor - 1); }
        else if (e.key === "Enter") { e.preventDefault(); var pick = items[hCursor >= 0 ? hCursor : 0]; if (pick) pick.dispatchEvent(new MouseEvent("mousedown")); return; }
        else if (e.key === "Escape") { closeHotelList(); return; }
        items.forEach(function (li, i) { li.setAttribute("aria-selected", i === hCursor ? "true" : "false"); });
      });
    }
    /* one chip: make my own way (tap again to go back to a pickup) */
    $$(".pickup-alts .chip", root).forEach(function (b) { b.addEventListener("click", function () { setOwnWay(state.pickupMode !== "own"); }); });
    if (el.pickup) el.pickup.addEventListener("change", function () { state.pickup = el.pickup.value; render(); });
    if (el.pickupHotel) el.pickupHotel.addEventListener("input", function () { state.pickupHotel = el.pickupHotel.value.trim(); render(); });
    if (el.ctaWa) el.ctaWa.addEventListener("click", function (e) { e.preventDefault(); sendWhatsApp(); });
    /* the bottom bar shows whenever the real button is off screen (a sticky panel taller than the window keeps it below the fold on laptops) */
    var sticky = $("#sticky-bar", root), seen = {};
    function stepBtn() { return state.step === 1 && el.next ? el.next : el.cta; }
    function syncSticky() { if (!sticky) return; var b = stepBtn(); sticky.hidden = !!seen[b.id]; }
    if (sticky && "IntersectionObserver" in window) { var io = new IntersectionObserver(function (es) { es.forEach(function (x) { seen[x.target.id] = x.isIntersecting; }); syncSticky(); }, { threshold: 0.5 }); [el.next, el.cta].forEach(function (b) { if (b) io.observe(b); }); }
    if (el.stickyCta) el.stickyCta.addEventListener("click", function () {
      var b = stepBtn(), r = b.getBoundingClientRect();
      if (r.top >= 0 && r.bottom <= innerHeight) { b.click(); return; }
      var pr = panel.getBoundingClientRect(); if (pr.top < 0 || pr.top > innerHeight * 0.5) panel.scrollIntoView({ block: "start", behavior: "smooth" });
      if (panel.scrollHeight > panel.clientHeight + 4) panel.scrollTo({ top: panel.scrollHeight, behavior: "smooth" }); else b.scrollIntoView({ block: "center", behavior: "smooth" });
      setTimeout(function () { b.focus({ preventScroll: true }); }, 500);
    });
    if (el.next) el.next.addEventListener("click", function () { var box = $("#exp-alert", root); if (box) box.remove(); try { checkStep1(); goStep(2); } catch (err) { alertBox(err.message); } });
    if (el.back) el.back.addEventListener("click", function () { var box = $("#exp-alert", root); if (box) box.remove(); goStep(1); });
    if (el.cruiseLink) el.cruiseLink.addEventListener("click", function () { state.cruiseOpen = true; render(); track("exp_cruise_open", { venue: V.slug }); });

    /* every WhatsApp request is also logged as a Netlify form entry (exp-enquiries), so the site keeps its own list of what came through */
    function logEnquiry(text) {
      if (PREVIEW) return;
      try {
        var p = product(), pr = price(), pk = V.pickups ? pickupOf() : null;
        var body = new URLSearchParams({ "form-name": "exp-enquiries", ref: state.ref, venue: V.name, product: p ? p.name : "", rate: rateOf(p), when: (text.match(/^(Date|Arrives|Departs):.*$/m) || [""])[0], guests: state.adults + " adults" + (state.children ? ", " + state.children + " children" : ""), pickup: pk ? (pk.key === "own" ? "own way" : (state.pickupHotel || pk.label)) : "", total: pr.lead || "", hotel: (savedHotel(X) || {}).name || "", page: location.pathname, message: text });
        fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString(), keepalive: true }).catch(function () {});
      } catch (e) {}
    }
    function sendWhatsApp() {
      var text = message();
      track("exp_request", { venue: V.slug, product: state.product, rate: rateOf(product()), instant: false, code: state.ref });
      logEnquiry(text);
      if (!PREVIEW && window.GV_WA_EXIT) window.GV_WA_EXIT({ ref: state.ref || "", where: "exp-panel", total: (price() || {}).lead || "", context: text });
      window.open(waUrl(text), "_blank", "noopener");
    }
    function need(field, msg) { if (!field || !field.value.trim()) { field && field.focus(); throw new Error(msg); } }
    function pay(mode) {
      var p = product(), prob = dateProblem(state.date), legs = p.legs || "both";
      if (!state.date) { openDate(0); throw new Error(isFlight ? (legs === "out" ? "Pick your departure date first." : "Pick your arrival date first.") : "Pick a date first."); }
      if (prob) throw new Error(prob);
      var wantsTime = (p.times && p.times.length) || (state.sessions && state.sessions.length);
      if (wantsTime && !state.time) throw new Error("Pick a start time.");
      var flightIn = "", flightOut = "", date2 = "";
      if (isFlight) {
        flightIn = el.flightIn ? el.flightIn.value.trim().toUpperCase() : ""; flightOut = el.flightOut ? el.flightOut.value.trim().toUpperCase() : ""; date2 = el.date2 ? el.date2.value : "";
        var flightRe = /^[A-Z0-9]{2,3}\s?\d{1,4}[A-Z]?$/;
        if (legs !== "out" && !flightRe.test(flightIn)) { el.flightIn.focus(); throw new Error("We need the arriving flight number, e.g. BA2263."); }
        if (legs !== "in" && !flightRe.test(flightOut)) { el.flightOut.focus(); throw new Error("We need the departing flight number, e.g. BA2262."); }
        if (legs === "both" && (!date2 || date2 < state.date)) { openDate(1); throw new Error("Pick the departure date too."); }
      }
      need(el.first, "We need a first name for the booking."); need(el.last, "And a last name."); need(el.email, "The confirmation goes by email, so we need an address.");
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(el.email.value.trim())) { el.email.focus(); throw new Error("That email doesn't look right."); }
      need(el.phone, "A WhatsApp or phone number, so we can send your details.");
      if (V.pickups && rateOf(p) === "visitor" && state.pickup !== "own" && !state.pickupHotel) { if (el.hotelIn) el.hotelIn.focus(); throw new Error("Where should the driver collect you? Pick your hotel or area from the list, or choose I'll make my own way."); }
      var body = { slug: V.slug, product: p.id, date: state.date, time: wantsTime ? state.time : "", date2: date2, flightIn: flightIn, flightOut: flightOut, adults: state.adults, children: state.children, pickup: state.pickup, pickupHotel: state.pickup === "own" ? "" : state.pickupHotel, choices: chosen(), ref: state.ref, ship: el.ship ? el.ship.value.trim() : "", port: cruise() && portOf() ? portOf().slug : "", aboard: cruise() ? (state.aboard || "") : "", customer: { first: el.first.value.trim(), last: el.last.value.trim(), email: el.email.value.trim(), phone: el.phone.value.trim() } };
      if (mode === "arrival") { reserve(body); return; }
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
    function reserve(body) {
      track("exp_reserve", { venue: V.slug, product: body.product, total: price().total, code: state.ref });
      if (PREVIEW) { alertBox("In the live site this reserves the booking and the guest pays " + price().lead + " on arrival."); return; }
      el.cta.disabled = true; $("#cta-label", el.cta).textContent = "Reserving…";
      fetch(FN + "exp-reserve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        .then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j }; }); })
        .then(function (x) {
          if (!(x.j && x.j.ok)) throw new Error((x.j && x.j.error) || "That didn't go through.");
          var lead = price().lead, box = document.createElement("div");
          box.className = "reserved"; box.setAttribute("role", "status");
          box.innerHTML = '<span class="kicker">Reserved</span><h3 class="hh"></h3><p>Your reference is <b class="r-ref"></b>. The details are on their way to <b class="r-mail"></b>, and one of our travel professionals will send your pickup details shortly.</p>';
          $("h3", box).textContent = "You're booked in. You pay " + lead + " when you arrive.";
          $(".r-ref", box).textContent = x.j.ref || state.ref; $(".r-mail", box).textContent = (body.customer && body.customer.email) || "your email";
          el.step2.innerHTML = ""; el.step2.appendChild(box); box.scrollIntoView({ behavior: "smooth", block: "center" });
        })
        .catch(function (e) { el.cta.disabled = false; render(); alertBox((e && e.message ? e.message : "Something went wrong.") + " You can send the same booking by WhatsApp and we'll confirm it by hand.", true); });
    }
    function alertBox(text, offerWa) {
      var box = $("#exp-alert", root), anchor = stepBtn();
      if (box && box.nextSibling !== anchor) { box.remove(); box = null; }
      if (!box) { box = document.createElement("div"); box.id = "exp-alert"; box.className = "pf-hint bad"; box.setAttribute("role", "alert"); box.style.cssText = "padding:12px 14px;border-radius:12px;background:#FFF4E5;color:#8A6D12;font-size:13px;line-height:1.45"; anchor.parentNode.insertBefore(box, anchor); }
      box.innerHTML = "";
      box.appendChild(document.createTextNode(text + " "));
      if (offerWa) { var a = document.createElement("a"); a.href = "#"; a.textContent = "Send by WhatsApp"; a.style.cssText = "text-decoration:underline;color:inherit;font-weight:800"; a.addEventListener("click", function (e) { e.preventDefault(); sendWhatsApp(); }); box.appendChild(a); }
      box.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    if (el.payWhen) el.payWhen.addEventListener("change", function () { render(); });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var box = $("#exp-alert", root); if (box) box.remove();
      try {
        if (state.step === 1 && el.next) { checkStep1(); goStep(2); return; } // Enter in a step-one field moves on, it never tries to pay
        if (payOnArrival()) { pay("arrival"); return; }
        if (instant() && (!live || state.availOk !== false)) { pay(); return; }
        if (!isFlight) { var prob = dateProblem(state.date); if (prob) { alertBox(prob); return; } }
        sendWhatsApp();
      } catch (err) { alertBox(err.message); }
    });

    /* the guest's hotel or port, if they picked one on the hub or came from its page */
    if (myHotel) {
      var mins = driveMin(myHotel, V, X.regions || {});
      var fh = $("#fact-hotel", root), fht = $("#fact-hotel-t", root);
      if (fh && fht && mins != null) { fh.hidden = false; fht.textContent = driveLabel(mins) + " from " + myHotel.name; }
      if (V.pickups && el.hotelIn) pickHotel(myHotel); else render();
    }
    /* all-aboard chips, and a way out for someone who picked a port earlier but isn't off a ship today */
    $$("#pf-aboard .chip", root).forEach(function (b) { b.addEventListener("click", function () { state.aboard = +b.getAttribute("data-aboard") || 0; renderTimes(); render(); track("exp_aboard", { venue: V.slug, aboard: state.aboard }); }); });
    /* port chips on the tours without pickup (the pickup picker covers the rest): tap to pick, tap again to clear */
    $$("#pf-ports .chip", root).forEach(function (b) { b.addEventListener("click", function () {
      var slug = b.getAttribute("data-port"), pt = HOTELS.filter(function (hh) { return hh.slug === slug; })[0], cur = portOf();
      if (cur && cur.slug === slug) { state.cruisePort = null; store("gv_hotel", null); if (myHotel && myHotel.port) { myHotel = null; var fh2 = $("#fact-hotel", root); if (fh2) fh2.hidden = true; } }
      else if (pt) { state.cruisePort = pt; store("gv_hotel", pt.slug); if (V.pickups && !portPickups && state.pickupMode !== "own") setOwnWay(true); }
      renderTimes(); render(); track("exp_port", { venue: V.slug, port: state.cruisePort ? slug : "" });
    }); });
    var shipClear = $("#ship-clear", root);
    if (shipClear) shipClear.addEventListener("click", function () {
      if (state.cruisePort || (myHotel && myHotel.port)) store("gv_hotel", null);
      state.cruisePort = null;
      if (myHotel && myHotel.port) { myHotel = null; var fh1 = $("#fact-hotel", root); if (fh1) fh1.hidden = true; }
      if (el.ship) el.ship.value = ""; state.aboard = 0; state.cruiseOpen = false;
      if (V.pickups && state.pickupPlace && state.pickupPlace.port) { state.pickupPlace = null; state.pickupHotel = ""; state.pickup = V.pickups[0].key; if (el.hotelIn) el.hotelIn.value = ""; }
      renderTimes(); render();
    });
    if (el.ship) el.ship.addEventListener("input", function () { renderTimes(); render(); });

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
    else if (X.page === "venue") { initPhotos(root); initVenue(root); }
    else if (X.page === "booked") initBooked(root);
    else if (X.page === "near" && X.hotel) { store("gv_hotel", X.hotel); }
  }
  window.GV_EXP_INIT = init;
  if (!PREVIEW) init(document);
})();

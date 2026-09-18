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
        if (link && !h.hasAttribute("data-page")) link.href = quoteUrl(h.getAttribute("data-slug")); // rows with their own hotel page keep that link
      });
      var leadSlug = page.getAttribute("data-lead");
      var leadRow = $('.hotel[data-slug="' + leadSlug + '"]', page);
      var leadPrice = $(".lead-price .price", page);
      if (leadRow && leadPrice) {
        var lp = priceFor(leadRow, state.nights);
        var ll = $(".lead-price .lbl", page), la = $(".lead-price .ask", page);
        if (ll) ll.textContent = airportName(state.airport) + " · " + state.nights + " nights";
        if (lp != null) { setPrice(leadPrice, lp); leadPrice.hidden = false; if (la) la.hidden = true; }
        else { leadPrice.hidden = true; if (la) la.hidden = false; } // a stay length with no starting price yet (the beach resorts beyond 3 nights) is quoted with the dates
      }
      /* hotel pages list every stay length in the price card: one row per length, repriced for the airport */
      $$(".hp-nrow[data-n]", page).forEach(function (r) {
        var n = r.getAttribute("data-n"), p = leadRow ? priceFor(leadRow, n) : null;
        var pr = $(".price", r), ask = $(".ask", r);
        if (p != null) { if (pr) { setPrice(pr, p); pr.hidden = false; } if (ask) ask.hidden = true; }
        else { if (pr) pr.hidden = true; if (ask) ask.hidden = false; }
        r.href = quoteUrl(leadSlug).replace(/([?&])n=[^&]*/, "$1n=" + encodeURIComponent(n));
      });
      $$(".lead .btn", page).forEach(function (b) { b.href = quoteUrl(leadSlug); });
      $$(".bar .btn, .dest-cta", page).forEach(function (b) { b.href = quoteUrl(leadSlug); });
    }
    function airportName(code) {
      var c = $('[data-airport="' + code + '"]', page);
      return c ? c.getAttribute("data-name") : code;
    }
    /* Whatever the front page search already asked, the quote page should not ask again: the party,
       the rooms and the dates ride along through the destination page. */
    var CARRY = ["adults", "kids", "rooms", "split", "ages", "from", "to"];
    var carried = new URLSearchParams(location.search);
    function quoteUrl(hotel) {
      var u = CFG.base + "/quote/?d=" + encodeURIComponent(page.getAttribute("data-dest")) + "&n=" + encodeURIComponent(state.nights) + "&a=" + encodeURIComponent(state.airport);
      if (hotel) u += "&h=" + encodeURIComponent(hotel);
      CARRY.forEach(function (k) { var v = carried.get(k); if (v) u += "&" + k + "=" + encodeURIComponent(v); });
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
      party: [{ a: 2, k: 0, ages: [] }], meals: "Not sure", name: "", leaving: params.get("from") || "", returning: params.get("to") || "", currency: "US$"
    };
    var MAXG = 16, MAXROOMS = 8;
    function tot(key) { return st.party.reduce(function (n, r) { return n + r[key]; }, 0); }
    function heads() { return tot("a") + tot("k"); }
    function allAges() { return st.party.reduce(function (l, r) { return l.concat(r.ages.slice(0, r.k)); }, []); }
    function splitText() { return st.party.map(function (r) { return r.a + "-" + r.k; }).join(","); }
    var ref = "GV-" + Math.random().toString(36).slice(2, 6).toUpperCase();
    /* The front page hands over the party. "split" says who is in which room, so a two room search
       arrives as two rooms rather than as one lump the guest has to split again. adults and kids are
       still read on their own, for a link made before the split existed, and the old "2 adults, kids"
       phrase is still read after that. */
    var qSplit = (params.get("split") || "").split(",").map(function (p) {
      var x = p.split("-"); return { a: parseInt(x[0], 10), k: parseInt(x[1], 10) };
    }).filter(function (r) { return r.a >= 1 && r.a <= MAXG && r.k >= 0 && r.k <= MAXG; });
    var qa = parseInt(params.get("adults") || "", 10), qk = parseInt(params.get("kids") || "", 10);
    if (qSplit.length) {
      st.party = qSplit.slice(0, MAXROOMS).map(function (r) { return { a: r.a, k: r.k, ages: [] }; });
    } else {
      if (qa >= 1 && qa <= MAXG) st.party[0].a = qa;
      if (qk >= 0 && qk <= MAXG) st.party[0].k = qk;
      if (isNaN(qa) && isNaN(qk)) {
        var who = params.get("who") || "";
        if (/^1 adult/.test(who)) st.party[0].a = 1;
        if (/^3/.test(who)) st.party[0].a = 3;
        if (/kids/.test(who)) st.party[0].k = 1;
      }
    }
    /* the ages arrive as one flat list, in room order, so they go back into the rooms in that order */
    (function () {
      var flat = (params.get("ages") || "").split(",").map(function (x) { return x.trim(); }).filter(function (x) { return /^\d{1,2}$/.test(x); });
      var at = 0;
      st.party.forEach(function (r) { r.ages = flat.slice(at, at + r.k); at += r.k; });
    })();
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
        var b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.textContent = ap.name;
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
      var kidAges = allAges().filter(function (x) { return x !== "" && x != null; });
      function roomLine(r, i) {
        var t = "Room " + (i + 1) + ": " + r.a + " adult" + (r.a === 1 ? "" : "s");
        if (r.k) t += ", " + r.k + " kid" + (r.k === 1 ? "" : "s");
        return t;
      }
      lines.push(st.party.length > 1
        ? "Travellers: " + st.party.map(roomLine).join(" \u00b7 ") + (kidAges.length ? " (aged " + kidAges.join(", ") + ")" : "")
        : "Travellers: " + tot("a") + " adult" + (tot("a") === 1 ? "" : "s") + ", " + tot("k") + " kid" + (tot("k") === 1 ? "" : "s") + (kidAges.length ? " (aged " + kidAges.join(", ") + ")" : ""));
      var apName = "";
      if (d && d.airports) d.airports.forEach(function (x) { if (x.code === st.a) apName = x.name + " (" + x.code + ")"; });
      if (d && d.combo) apName = d.airportName + " (" + d.airport + ")";
      if (apName) lines.push("From: " + apName);
      lines.push("Meals: " + st.meals);
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
    /* ---- the party, a room at a time. Same shape as the front page search, because a quote for
       four adults in one room is a different number from four in two, and the ages decide both
       child pricing and what the hotel will put them in. ---- */
    var partyBox = $("#q-party", q), addRoomBtn = $("#q-addroom", q);
    function qStepper(label, which, at, value, off) {
      var wrap = document.createElement("div");
      wrap.className = "stepper";
      var sp = document.createElement("span");
      sp.textContent = label;
      var inner = document.createElement("div");
      inner.className = "stepper-in";
      var minus = document.createElement("button"), out = document.createElement("output"), plus = document.createElement("button");
      minus.type = plus.type = "button";
      minus.textContent = "−"; plus.textContent = "+";
      minus.setAttribute("aria-label", "Fewer " + label.toLowerCase());
      plus.setAttribute("aria-label", "More " + label.toLowerCase());
      minus.disabled = off(-1); plus.disabled = off(1);
      minus.setAttribute("data-focus", at + which + "-");
      plus.setAttribute("data-focus", at + which + "+");
      minus.addEventListener("click", function () { qBump(at, which, -1); });
      plus.addEventListener("click", function () { qBump(at, which, 1); });
      out.textContent = value;
      inner.appendChild(minus); inner.appendChild(out); inner.appendChild(plus);
      wrap.appendChild(sp); wrap.appendChild(inner);
      return wrap;
    }
    function qBump(at, which, d) {
      var r = st.party[at];
      if (!r || (d > 0 && heads() >= MAXG)) return;
      if (which === "a") r.a = Math.max(1, r.a + d);
      else { r.k = Math.max(0, r.k + d); if (d < 0) r.ages.length = r.k; }
      drawParty();
    }
    function qAges(at) {
      var r = st.party[at], box = document.createElement("div");
      box.className = "hq-ages";
      if (!r.k) { box.hidden = true; return box; }
      for (var i = 0; i < r.k; i++) {
        var lab = document.createElement("label"), sp = document.createElement("span"), inp = document.createElement("input");
        sp.textContent = "Age " + (i + 1);
        inp.type = "number"; inp.min = "0"; inp.max = "17"; inp.inputMode = "numeric"; inp.placeholder = "0-17";
        inp.value = r.ages[i] == null ? "" : r.ages[i];
        inp.setAttribute("data-age", String(i));
        inp.setAttribute("data-focus", at + "age" + i);
        inp.addEventListener("input", function () {
          var n = parseInt(this.value, 10), k = +this.getAttribute("data-age");
          r.ages[k] = isNaN(n) ? "" : Math.max(0, Math.min(17, n));
          if (this.value !== "" && String(r.ages[k]) !== this.value) this.value = r.ages[k];
          render();
        });
        lab.appendChild(sp); lab.appendChild(inp);
        box.appendChild(lab);
      }
      return box;
    }
    function drawParty() {
      if (!partyBox) return;
      var was = document.activeElement, mark = was && was.getAttribute ? was.getAttribute("data-focus") : null;
      partyBox.innerHTML = "";
      st.party.forEach(function (r, at) {
        var sec = document.createElement("div");
        sec.className = "hq-room";
        var head = document.createElement("div");
        head.className = "hq-room-h";
        var t = document.createElement("b");
        t.textContent = "Room " + (at + 1);
        head.appendChild(t);
        if (st.party.length > 1) {
          var rm = document.createElement("button");
          rm.type = "button";
          rm.className = "hq-room-x";
          rm.textContent = "Remove";
          rm.setAttribute("aria-label", "Remove room " + (at + 1));
          rm.addEventListener("click", function () { st.party.splice(at, 1); drawParty(); });
          head.appendChild(rm);
        }
        sec.appendChild(head);
        var row = document.createElement("div");
        row.className = "row2";
        row.appendChild(qStepper("Adults", "a", at, r.a, function (d) { return d > 0 ? heads() >= MAXG : r.a <= 1; }));
        row.appendChild(qStepper("Kids", "k", at, r.k, function (d) { return d > 0 ? heads() >= MAXG : r.k <= 0; }));
        sec.appendChild(row);
        sec.appendChild(qAges(at));
        partyBox.appendChild(sec);
      });
      if (addRoomBtn) addRoomBtn.hidden = st.party.length >= MAXROOMS || heads() >= MAXG;
      render();
      if (mark) { var back = $('[data-focus="' + mark + '"]', partyBox); if (back) back.focus(); }
    }
    if (addRoomBtn) addRoomBtn.addEventListener("click", function () {
      if (st.party.length >= MAXROOMS || heads() >= MAXG) return;
      st.party.push({ a: heads() + 2 <= MAXG ? 2 : 1, k: 0, ages: [] });
      drawParty();
    });
    drawParty();
    $$("[data-meals]", q).forEach(function (b) {
      b.addEventListener("click", function () {
        st.meals = b.getAttribute("data-meals");
        $$("[data-meals]", q).forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
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
      waExit({ ref: send.getAttribute("data-code") || "", where: "getaways-quote", context: message().text });
    });
    fillHotels(); fillChips(); syncOther(); render();
  }


  /* ---- the /getaways/ pill: the same party picker as the front page ---------------------------
     Kept as its own small block rather than shared with home.js, because the two files load on
     different pages and only the front page has home.js. If you change one, change both. */
  var hubForm = $("#hub-quote");
  if (hubForm) {
    var hb = {
      who: $("#hub-who"), pop: $("#hub-pop"), a: $("#hub-a"), k: $("#hub-k"), ages: $("#hub-ages"),
      done: $("#hub-done"), adults: $("#hub-adults"), kids: $("#hub-kids"), agesV: $("#hub-ages-v"),
      din: $("#hub-in"), dout: $("#hub-out")
    };
    var hs = { adults: 2, kids: 0, ages: [] };
    var todayISO = new Date().toISOString().slice(0, 10);
    if (hb.din) hb.din.min = todayISO;
    if (hb.dout) hb.dout.min = todayISO;
    if (hb.din) hb.din.addEventListener("change", function () {
      if (!hb.din.value) return;
      hb.dout.min = hb.din.value;
      if (hb.dout.value && hb.dout.value < hb.din.value) hb.dout.value = "";
    });
    function hubWho() {
      var s = hs.adults + (hs.adults === 1 ? " adult" : " adults");
      if (hs.kids) s += ", " + hs.kids + (hs.kids === 1 ? " child" : " children");
      return s;
    }
    function hubAges() {
      hb.ages.hidden = !hs.kids;
      if ($$("input", hb.ages).length === hs.kids) return;
      hb.ages.innerHTML = "";
      for (var i = 0; i < hs.kids; i++) {
        var lab = document.createElement("label"), sp = document.createElement("span"), inp = document.createElement("input");
        sp.textContent = "Age " + (i + 1);
        inp.type = "number"; inp.min = "0"; inp.max = "17"; inp.inputMode = "numeric"; inp.placeholder = "0-17";
        inp.value = hs.ages[i] == null ? "" : hs.ages[i];
        inp.setAttribute("data-age", String(i));
        inp.addEventListener("input", function () {
          var n = parseInt(this.value, 10), at = +this.getAttribute("data-age");
          hs.ages[at] = isNaN(n) ? "" : Math.max(0, Math.min(17, n));
          if (this.value !== "" && String(hs.ages[at]) !== this.value) this.value = hs.ages[at];
          hubSync();
        });
        lab.appendChild(sp); lab.appendChild(inp);
        hb.ages.appendChild(lab);
      }
    }
    function hubSync() {
      hb.a.textContent = hs.adults;
      hb.k.textContent = hs.kids;
      hb.who.textContent = hubWho();
      hb.adults.value = hs.adults;
      hb.kids.value = hs.kids;
      hb.agesV.value = hs.ages.slice(0, hs.kids).filter(function (x) { return x !== "" && x != null; }).join(",");
      $$("[data-hub]", hb.pop).forEach(function (b) {
        var w = b.getAttribute("data-hub"), d = +b.getAttribute("data-d"), at = w === "a" ? hs.adults : hs.kids;
        b.disabled = d > 0 ? hs.adults + hs.kids >= 12 : at <= (w === "a" ? 1 : 0);
      });
    }
    $$("[data-hub]", hb.pop).forEach(function (b) {
      b.addEventListener("click", function () {
        var w = b.getAttribute("data-hub"), d = +b.getAttribute("data-d");
        if (d > 0 && hs.adults + hs.kids >= 12) return;
        if (w === "a") hs.adults = Math.max(1, hs.adults + d);
        else { hs.kids = Math.max(0, hs.kids + d); if (d < 0) hs.ages.length = hs.kids; }
        hubAges();
        hubSync();
      });
    });
    function hubOpen(on) { hb.pop.hidden = !on; hb.who.setAttribute("aria-expanded", on ? "true" : "false"); }
    hb.who.addEventListener("click", function (ev) { ev.stopPropagation(); hubOpen(hb.pop.hidden); });
    hb.done.addEventListener("click", function () { hubOpen(false); });
    document.addEventListener("click", function (ev) { if (!hb.pop.hidden && !hb.pop.contains(ev.target) && ev.target !== hb.who) hubOpen(false); });
    document.addEventListener("keydown", function (ev) { if (ev.key === "Escape") hubOpen(false); });
    hubAges();
    hubSync();
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

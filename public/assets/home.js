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

  /* ---- the front page search: five tabs, one form, and every one of them lands on a real page ----------
     Getaways goes to a hotel page, a destination page or the getaways quote page. Tours goes to the
     experiences hub already filtered, or straight to a venue when only one fits. Transfers hands its
     choices into the transfers picker. Staycation and Coming to Jamaica go to /quote/. WhatsApp is the
     last step on those pages, not the first step here. */
  var form = $("#home-quote");
  if (form && CFG.modes) {
    var modes = CFG.modes, mode = modes[0], MAXG = CFG.maxGuests || 16, MAXROOMS = 8, COPY = CFG.copy || {};
    var e = {
      air: $("#hq-air"), airCell: $('[data-f="air"]'), place: $("#hq-where"), placeLbl: $("#hq-where-label"),
      placeCell: $('[data-f="place"]'), clear: $("#hq-clear"), list: $("#hq-list"), kind: $("#hq-kind"),
      kindCell: $('[data-f="kind"]'), din: $("#hq-in"), dout: $("#hq-out"), dinLbl: $("#hq-in-label"),
      doutLbl: $("#hq-out-label"), who: $("#hq-who"), pop: $("#hq-pop"), a: $("#hq-a"), k: $("#hq-k"),
      ages: $("#hq-ages"), hint: $("#hq-hint"), done: $("#hq-done"), adults: $("#hq-adults"),
      kids: $("#hq-kids"), agesV: $("#hq-ages-v"), go: $("#hq-go"), needs: $("#hq-needs"),
      flight: $("#hq-flight"), time: $("#hq-time"), flt: $("#hq-flt"), fltNote: $("#hq-flt-note"),
      time2: $("#hq-time2"), flt2: $("#hq-flt2"), outWrap: $("#hq-out-wrap"), flt2Wrap: $("#hq-flt2-wrap"),
      r: $("#hq-r"), roomsLine: $("#hq-rooms-line"), roomsV: $("#hq-rooms-v"), roomsList: $("#hq-rooms-list"),
      tray: $("#hq-tray"), from: $("#hq-from"), fromWrap: $("#hq-from-wrap"),
      fromList: $("#hq-from-list"), fromClear: $("#hq-from-clear"),
      pick: $("#hq-pick"), pickWrap: $("#hq-pick-wrap"), pickList: $("#hq-pick-list"), pickClear: $("#hq-pick-clear")
    };
    var st = { adults: 2, kids: 0, rooms: 1, ages: [], need: [] };

    /* ---- the three place lists. The outbound one rides along in the HTML (22 entries). The Jamaica
       one is 117 hotels and 12 areas, and the city one is every airport city in the world, so both of
       those are fetched the first time somebody types in a field that uses them. Neither is anywhere
       near the page load. ---- */
    var GA = (CFG.places || []).map(function (p) { return { name: p[0], href: p[1], sub: p[2], words: (p[0] + " " + p[2] + " " + p[3]).toLowerCase() }; });
    var JM = null, CITY = null, asked = {}, combos = [];
    function refresh() { combos.forEach(function (c) { c.refresh(); }); }
    function zoneName(d, key) { var z = (d.zones || []).filter(function (x) { return x[0] === key; })[0]; return z ? z[1] : ""; }
    function fetchList(key, url, build) {
      if (asked[key]) return;
      asked[key] = true;
      fetch(url).then(function (r) { return r.json(); }).then(function (d) { build(d); refresh(); }).catch(function () { asked[key] = false; });
    }
    function loadJM() {
      if (JM) return;
      fetchList("jm", "/assets/jm-places.json", function (d) {
        JM = [].concat(
          (d.hotels || []).map(function (h) { return { name: h[0], slug: h[1], zone: h[2], kind: "hotel", sub: zoneName(d, h[2]), words: (h[0] + " " + h[3] + " " + zoneName(d, h[2])).toLowerCase() }; }),
          (d.zones || []).map(function (z) { return { name: z[1], slug: z[0], zone: z[0], kind: "area", sub: z[2] || "Area", words: (z[1] + " " + z[3] + " area villa airbnb guesthouse").toLowerCase() }; })
        );
      });
    }
    /* every airport city in the world, one row per city. The cities people actually fly to Jamaica
       from carry rank 0 so they sort first: "new" is New York before Newcastle, "kingston" is ours
       before Ontario's. Nothing is hidden by the ranking, it only decides the order. */
    function loadCities() {
      if (CITY) return;
      fetchList("city", "/assets/cities.json", function (d) {
        CITY = (d.cities || []).map(function (c) { return { name: c[0], sub: c[1], rank: c[3] || 0, words: (c[0] + " " + c[1] + " " + c[2]).toLowerCase() }; });
      });
    }
    function placePool() { if (mode.places === "jamaica") { loadJM(); return JM || []; } return mode.kinds ? [] : GA; }
    function cityPool() { loadCities(); return CITY || []; }

    /* ---- a suggestion box. Two of them on the page: where they are going, and the city they fly
       from. Both behave the same way, and both keep what was PICKED separate from what was typed. ---- */
    function combo(input, list, clear, poolOf, empty, after) {
      var cursor = -1, picked = null;
      function close() { list.hidden = true; list.innerHTML = ""; cursor = -1; input.setAttribute("aria-expanded", "false"); }
      function open(q) {
        var qq = String(q || "").toLowerCase().trim();
        var items = poolOf();
        if (qq.length < 2) return close();
        /* what they typed the name of comes first: "negril" is the area before it is a hotel with
           Negril in its name, and a city we fly from comes before one we do not */
        var hits = items.filter(function (p) { return p.words.indexOf(qq) >= 0; }).sort(function (x, y) {
          var sx = x.name.toLowerCase().indexOf(qq) === 0 ? 0 : 1, sy = y.name.toLowerCase().indexOf(qq) === 0 ? 0 : 1;
          if (sx !== sy) return sx - sy;
          var rx = x.rank || 0, ry = y.rank || 0;
          if (rx !== ry) return rx - ry;
          var ax = x.kind === "area" ? 0 : 1, ay = y.kind === "area" ? 0 : 1;
          if (ax !== ay) return ax - ay;
          return x.name.length - y.name.length;
        }).slice(0, 8);
        list.innerHTML = "";
        cursor = -1;
        if (!hits.length) {
          /* nothing matched: still a real path forward, never a dead end. While a list is still on
             its way the message would be a lie, so nothing is said until it has landed. */
          var msg = empty();
          if (!msg) return close();
          var li = document.createElement("li");
          li.className = "none";
          li.textContent = msg;
          list.appendChild(li);
        }
        hits.forEach(function (p) {
          var li = document.createElement("li");
          li.setAttribute("role", "option");
          var b = document.createElement("span"); b.textContent = p.name;
          var sm = document.createElement("small"); sm.textContent = p.sub || "";
          li.appendChild(b); li.appendChild(sm);
          li.addEventListener("mousedown", function (ev) { ev.preventDefault(); choose(p); });
          list.appendChild(li);
        });
        list.hidden = false;
        input.setAttribute("aria-expanded", "true");
      }
      function choose(p) {
        picked = p;
        input.value = p.name;
        clear.hidden = false;
        close();
        if (after) after();
      }
      clear.addEventListener("click", function () { picked = null; input.value = ""; clear.hidden = true; close(); input.focus(); });
      input.addEventListener("input", function () { picked = null; clear.hidden = !input.value; open(input.value); });
      input.addEventListener("focus", function () { poolOf(); if (input.value.trim().length > 1) open(input.value); });
      input.addEventListener("blur", function () { setTimeout(close, 120); });
      input.addEventListener("keydown", function (ev) {
        var rows = $$("li[role=option]", list);
        if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
          if (!rows.length) return;
          ev.preventDefault();
          cursor += ev.key === "ArrowDown" ? 1 : -1;
          if (cursor < 0) cursor = rows.length - 1;
          if (cursor >= rows.length) cursor = 0;
          rows.forEach(function (r, i) { r.classList.toggle("on", i === cursor); });
        } else if (ev.key === "Enter" && cursor >= 0 && rows[cursor]) {
          ev.preventDefault();
          rows[cursor].dispatchEvent(new MouseEvent("mousedown"));
        } else if (ev.key === "Escape") close();
      });
      var api = {
        pick: function () { return picked; },
        typed: function () { return input.value.trim(); },
        close: close,
        reset: function () { picked = null; input.value = ""; clear.hidden = true; close(); },
        refresh: function () { if (document.activeElement === input && input.value.trim().length > 1) open(input.value); }
      };
      combos.push(api);
      return api;
    }

    var where = combo(e.place, e.list, e.clear, placePool, function () {
      if (mode.places === "jamaica") return JM ? "Not on our list. Type the area and we'll price it by hand." : "";
      return "Not one of our published trips. Keep typing and we'll quote it.";
    }, function () { e.din.focus(); });
    var origin = combo(e.from, e.fromList, e.fromClear, cityPool, function () {
      return CITY ? "Not on our list. Type it in and we'll work from that." : "";
    }, null);
    /* where the day out should collect them. Optional: plenty of people make their own way. */
    var pickup = combo(e.pick, e.pickList, e.pickClear, function () { loadJM(); return JM || []; }, function () {
      return JM ? "Not on our list. Type the area and we'll sort the pickup." : "";
    }, null);

    /* ---- who's travelling: adults, children, and an age for each child ---- */
    function whoText() {
      var s = st.adults + (st.adults === 1 ? " adult" : " adults");
      if (st.kids) s += ", " + st.kids + (st.kids === 1 ? " child" : " children");
      if (mode.rooms && st.rooms > 1) s += ", " + st.rooms + " rooms";
      return s;
    }
    function drawAges() {
      e.ages.hidden = !st.kids;
      var have = $$("input", e.ages).length;
      if (have !== st.kids) {
        e.ages.innerHTML = "";
        for (var i = 0; i < st.kids; i++) {
          var lab = document.createElement("label");
          var sp = document.createElement("span");
          sp.textContent = (COPY.childAge || "Age") + " " + (i + 1);
          var inp = document.createElement("input");
          inp.type = "number"; inp.min = "0"; inp.max = "17"; inp.inputMode = "numeric";
          inp.placeholder = "0-17";
          inp.value = st.ages[i] == null ? "" : st.ages[i];
          inp.setAttribute("data-age", String(i));
          inp.addEventListener("input", function () {
            var n = parseInt(this.value, 10);
            st.ages[+this.getAttribute("data-age")] = isNaN(n) ? "" : Math.max(0, Math.min(17, n));
            if (String(st.ages[+this.getAttribute("data-age")]) !== this.value && this.value !== "") this.value = st.ages[+this.getAttribute("data-age")];
            sync();
          });
          lab.appendChild(sp); lab.appendChild(inp);
          e.ages.appendChild(lab);
        }
      }
    }
    function sync() {
      e.a.textContent = st.adults;
      e.k.textContent = st.kids;
      e.r.textContent = st.rooms;
      if (e.roomsList) {
        var many = mode.rooms && st.rooms > 1;
        e.roomsList.hidden = !many;
        if (many) {
          var names = [];
          for (var ri = 1; ri <= st.rooms; ri++) names.push("Room " + ri);
          e.roomsList.textContent = names.join(" \u00b7 ");
        }
      }
      e.who.textContent = whoText();
      e.adults.value = st.adults;
      e.kids.value = st.kids;
      e.roomsV.value = mode.rooms ? st.rooms : 1;
      e.agesV.value = st.ages.slice(0, st.kids).join(",");
      var full = st.adults + st.kids >= MAXG;
      e.hint.textContent = full && CFG.overflowEmail
        ? "That's our biggest vehicle and our largest group online. For more than " + MAXG + ", email " + CFG.overflowEmail + " and we'll arrange it."
        : COPY.childAgeHint || "Ages at the time of travel.";
      e.hint.classList.toggle("on", full);
      $$("[data-step]", e.pop).forEach(function (b) {
        var which = b.getAttribute("data-step"), d = +b.getAttribute("data-d");
        if (which === "r") { b.disabled = d > 0 ? st.rooms >= MAXROOMS : st.rooms <= 1; return; }
        var at = which === "a" ? st.adults : st.kids;
        b.disabled = d > 0 ? st.adults + st.kids >= MAXG : at <= (which === "a" ? 1 : 0);
      });
    }
    $$("[data-step]", e.pop).forEach(function (b) {
      b.addEventListener("click", function () {
        var which = b.getAttribute("data-step"), d = +b.getAttribute("data-d");
        if (which === "r") { st.rooms = Math.min(MAXROOMS, Math.max(1, st.rooms + d)); return sync(); }
        if (d > 0 && st.adults + st.kids >= MAXG) return;
        if (which === "a") st.adults = Math.max(1, st.adults + d);
        else { st.kids = Math.max(0, st.kids + d); if (d < 0) st.ages.length = st.kids; }
        drawAges();
        sync();
      });
    });
    function openWho(on) {
      e.pop.hidden = !on;
      e.who.setAttribute("aria-expanded", on ? "true" : "false");
      if (on) { var f = $("input", e.ages); if (f && st.kids) f.focus(); }
    }
    e.who.addEventListener("click", function (ev) { ev.stopPropagation(); openWho(e.pop.hidden); });
    e.done.addEventListener("click", function () { openWho(false); e.go.focus(); });
    document.addEventListener("click", function (ev) { if (!e.pop.hidden && !e.pop.contains(ev.target) && ev.target !== e.who) openWho(false); });
    document.addEventListener("keydown", function (ev) { if (ev.key === "Escape") { openWho(false); combos.forEach(function (c) { c.close(); }); } });

    /* ---- what they need, on the Coming to Jamaica tab. Ticking Flights is what asks them where
       they are flying from: for a guest booking their own long-haul the question never comes up. ---- */
    $$("[data-need]", e.needs).forEach(function (b) {
      b.addEventListener("click", function () {
        var v = b.getAttribute("data-need"), i = st.need.indexOf(v);
        if (i >= 0) st.need.splice(i, 1); else st.need.push(v);
        b.setAttribute("aria-pressed", i >= 0 ? "false" : "true");
        tray();
      });
    });
    /* the tray under the card: the needs chips, the origin city and the flight boxes. It is part of
       the search, so it is only there when one of them has something to ask. */
    function tray() {
      var wantFrom = !!mode.needs && st.need.indexOf("flights") >= 0;
      e.needs.hidden = !mode.needs;
      e.fromWrap.hidden = !wantFrom;
      e.pickWrap.hidden = !mode.pickup;
      if (!mode.pickup) pickup.reset();
      e.flight.hidden = !mode.airports;
      e.tray.hidden = !(mode.needs || mode.airports || mode.pickup);
      form.classList.toggle("has-tray", !e.tray.hidden);
      if (!wantFrom) origin.reset();
    }

    /* ---- the flight number: the two letters and the digits off their ticket ---- */
    var FLIGHT = /^[A-Z0-9]{2}[A-Z]?\s?\d{1,4}[A-Z]?$/;
    function fltVal(el) { el = el || e.flt; return el ? el.value.trim().toUpperCase().replace(/\s+/g, "") : ""; }
    [e.flt, e.flt2].forEach(function (i) {
      if (!i) return;
      i.addEventListener("blur", function () {
        var v = fltVal(i);
        if (v !== i.value) i.value = v;
        var bad = v && !FLIGHT.test(v);
        e.fltNote.textContent = bad
          ? "\u201c" + v + "\u201d doesn't look like a flight number. It's the two letters and the digits on your ticket, like AA1497."
          : "";
        e.fltNote.classList.toggle("bad", !!bad);
      });
    });

    /* ---- the dates: check out never before check in ---- */
    e.din.addEventListener("change", function () {
      if (e.din.value) { e.dout.min = e.din.value; if (e.dout.value && e.dout.value < e.din.value) e.dout.value = ""; }
      returnLeg();
    });
    /* the return leg's own time and flight, asked for only when there is a date back to ask about */
    function returnLeg() {
      var want = !!(mode.airports && e.dout.value);
      if (e.outWrap) e.outWrap.hidden = !want;
      if (e.flt2Wrap) e.flt2Wrap.hidden = !want;
    }
    e.dout.addEventListener("change", returnLeg);

    /* ---- switching tabs ---- */
    function setMode(key, quiet) {
      mode = modes.filter(function (m) { return m.key === key; })[0] || modes[0];
      $$("[data-mode]").forEach(function (c) { c.setAttribute("aria-pressed", c.getAttribute("data-mode") === mode.key ? "true" : "false"); });
      e.airCell.hidden = !mode.airports;
      e.kindCell.hidden = !mode.kinds;
      e.placeCell.hidden = !!mode.kinds;
      e.roomsLine.hidden = !mode.rooms;
      /* "Not sure yet" only where the dates are genuinely optional. A transfer or a day out is one
         flat price whatever the date, so the guest can leave it and still see what it costs. A
         hotel is not: the rate IS the dates, and a room enquiry with no dates on it is one Dino or
         Neomi has to hand straight back. dateOptional says which is which. */
      if (e.din) {
        if (mode.dateOptional) e.din.setAttribute("data-dr-optional", "");
        else e.din.removeAttribute("data-dr-optional");
      }
      st.need = [];
      $$("[data-need]", e.needs).forEach(function (b) { b.setAttribute("aria-pressed", "false"); });
      tray();
      returnLeg();
      e.placeLbl.textContent = mode.placeLabel || "Where to";
      e.place.placeholder = mode.placeHint || "";
      e.dinLbl.textContent = mode.dateIn || "Check in";
      e.doutLbl.textContent = mode.dateOut || "Check out";
      e.go.childNodes[0].nodeValue = mode.cta || "Search";
      where.reset();
      st.rooms = 1;
      sync();
      if (mode.places === "jamaica") loadJM();
      if (!quiet) track("quote_mode", { mode: mode.key });
    }
    $$("[data-mode]").forEach(function (c) { c.addEventListener("click", function () { setMode(c.getAttribute("data-mode")); }); });

    /* ---- where each search goes ---- */
    function params(extra) {
      var q = { adults: st.adults, kids: st.kids };
      if (mode.rooms && st.rooms > 1) q.rooms = st.rooms;
      if (st.ages.slice(0, st.kids).filter(String).length) q.ages = st.ages.slice(0, st.kids).join(",");
      if (e.din.value) q["in"] = e.din.value;
      if (e.dout.value) q.out = e.dout.value;
      for (var k in extra) if (extra[k]) q[k] = extra[k];
      return new URLSearchParams(q).toString();
    }
    function go(url, how) {
      track("search_go", { mode: mode.key, landing: how, adults: st.adults, kids: st.kids, picked: where.pick() ? where.pick().name : (where.typed() || "") });
      window.location.href = url;
    }
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var typed = where.typed(), pick = where.pick();
      if (mode.key === "getaways") {
        /* a hotel page or a destination page when they picked one, the quote page when they didn't */
        if (pick && pick.href) return go(pick.href + "?" + params({}), "page");
        return go("/getaways/quote/?" + params({ d: typed ? "" : "", other: typed }), "quote");
      }
      if (mode.key === "tours") {
        /* The hub filters by its own short list of areas. A hotel goes over as itself and as the
           area it sits in; an area goes over if the hub has one by that name. The hub ignores a
           value it does not know, so the rest simply arrive unfiltered rather than wrongly. */
        var HUB_AREA = { mobay: "mobay", "rose-hall": "mobay", falmouth: "trelawny", "ocho-rios": "ocho", negril: "negril", kingston: "kingston" };
        var pk = pickup.pick(), extra = { cat: e.kind.value !== "all" ? e.kind.value : "" };
        if (pk && pk.kind === "hotel") { extra.hotel = pk.slug; extra.area = HUB_AREA[pk.zone] || ""; }
        else if (pk) extra.area = HUB_AREA[pk.slug] || "";
        else if (pickup.typed()) extra.pickup = pickup.typed();
        return go("/experiences/?" + params(extra), "hub");
      }
      if (mode.key === "transfers") {
        /* Everything the picker needs to price the ride, so it lands on options rather than a form.
           The trip type is worked out rather than asked: a date back means a round trip. */
        var p = { airport: e.air.value, people: st.adults + st.kids, date: e.din.value || "",
          trip: e.dout.value ? "both" : "in", time: e.time.value || "", flight: fltVal(), date2: e.dout.value || "",
          time2: e.dout.value && e.time2 ? e.time2.value || "" : "", flight2: e.dout.value ? fltVal(e.flt2) : "" };
        if (pick && pick.kind === "hotel") p.hotel = pick.slug; else if (typed) p.q = typed;
        Object.keys(p).forEach(function (k) { if (!p[k]) delete p[k]; });
        return go("/transfers/?" + new URLSearchParams(p).toString(), "picker");
      }
      /* staycation and coming to Jamaica: the Jamaica quote page.
         A Jamaica hotel gets its own page here as soon as one exists: the list carries the path. */
      if (pick && pick.page) return go(pick.page + "?" + params({}), "page");
      var q = { mode: mode.key };
      if (pick) { q[pick.kind === "area" ? "area" : "hotel"] = pick.slug; q.place = pick.name; }
      else if (typed) q.place = typed;
      if (mode.key === "coming") {
        var o = origin.pick();
        var from = o ? (o.name + (o.sub ? ", " + o.sub : "")) : origin.typed();
        if (from) q.from = from;
        if (st.need.length) q.needs = st.need.join(",");
      }
      return go("/quote/?" + params(q), "quote");
    });

    setMode(modes[0].key, true);
    /* ---- the nav and the search agree with each other ----------------------------------------
       "Staycations" and "Jamaica" in the nav point at sections of this page. They used to scroll
       there and leave the search on Getaways, which is the wrong question sitting above the right
       section. Now the section and the search tab move together, whether the link was clicked here
       or followed in from another page. */
    var BY_HASH = { staycations: "staycation", coming: "coming", transfers: "transfers", experiences: "tours" };
    function fromHash(h, scroll) {
      var key = BY_HASH[String(h || "").replace(/^#/, "")];
      if (!key || !modes.filter(function (m) { return m.key === key; }).length) return false;
      setMode(key);
      if (scroll) {
        var sec = document.getElementById(String(h).replace(/^#/, ""));
        if (sec) sec.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return true;
    }
    /* a link to a section of this page: switch the tab and scroll, rather than reloading the page */
    $$('a[href^="/#"], a[href^="#"]').forEach(function (a) {
      var h = a.getAttribute("href").replace(/^\//, "");
      if (!BY_HASH[h.replace(/^#/, "")]) return;
      a.addEventListener("click", function (ev) {
        if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.button) return;   /* let them open it in a tab */
        ev.preventDefault();
        if (menu) { menu.classList.remove("open"); if (menuBtn) menuBtn.setAttribute("aria-expanded", "false"); }
        if (history.replaceState) history.replaceState(null, "", h);
        fromHash(h, true);
        track("nav_section", { section: h.replace(/^#/, "") });
      });
    });
    /* arrived here with the hash already set, from another page or a bookmark */
    if (location.hash) fromHash(location.hash, false);
    addEventListener("hashchange", function () { fromHash(location.hash, false); });
    drawAges();
    sync();
  }


  /* ---- /quote/ : the search, read back ----------------------------------------------------------
     Where a Staycation or a Coming to Jamaica search lands. Nothing is computed here and nothing is
     charged: it shows the person what they asked for, lets them add to it, and sends it on. */
  var qp = $("#qp-dl");
  if (qp) {
    var Q = new URLSearchParams(location.search);
    var qMode = Q.get("mode") || "staycation";
    var NEEDS = {};
    (CFG.needs || []).forEach(function (n) { NEEDS[n[0]] = n[1]; });
    function niceDate(s) {
      if (!s) return "";
      var p = String(s).split("-");
      if (p.length !== 3) return s;
      var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
      if (isNaN(d.getTime())) return s;
      return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
    }
    function nights(a, b) {
      if (!a || !b) return 0;
      var d = (Date.parse(b) - Date.parse(a)) / 86400000;
      return d > 0 && d < 400 ? Math.round(d) : 0;
    }
    var adults = Math.max(1, parseInt(Q.get("adults") || "2", 10) || 2);
    var kids = Math.max(0, parseInt(Q.get("kids") || "0", 10) || 0);
    var ages = (Q.get("ages") || "").split(",").map(function (x) { return x.trim(); }).filter(function (x) { return x !== ""; });
    var dIn = Q.get("in") || "", dOut = Q.get("out") || "", n = nights(dIn, dOut);
    var place = Q.get("place") || "", from = Q.get("from") || "";
    var rooms = Math.max(1, parseInt(Q.get("rooms") || "1", 10) || 1);
    var need = (Q.get("needs") || "").split(",").filter(Boolean);
    var ref = "GV-" + (qMode === "coming" ? "JAM" : "STAY") + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();

    /* the title says back to them what they came here for */
    var t = $("#qp-title"), sub = $("#qp-sub");
    if (qMode === "coming") {
      t.textContent = place ? place + ", priced for you." : from ? "Jamaica, from " + from + "." : "Coming to Jamaica.";
      sub.textContent = "Here's what you told us. Add anything we've missed and one of our team prices the whole trip.";
    } else {
      t.textContent = place ? place + ", priced for you." : "Your staycation, priced up.";
      sub.textContent = "Here's what you told us. Resident rates in J$ where the hotel has them.";
    }

    function row(label, value) {
      if (!value) return;
      var dt = document.createElement("dt"); dt.textContent = label;
      var dd = document.createElement("dd"); dd.textContent = value;
      qp.appendChild(dt); qp.appendChild(dd);
    }
    var party = adults + (adults === 1 ? " adult" : " adults");
    if (kids) party += ", " + kids + (kids === 1 ? " child" : " children") + (ages.length ? " (" + ages.join(", ") + ")" : "");
    row("Where", place || "Wherever works best");
    if (qMode === "coming") row("Flying from", from);
    row("Check in", dIn ? niceDate(dIn) : "Flexible");
    row("Check out", dOut ? niceDate(dOut) + (n ? " · " + n + (n === 1 ? " night" : " nights") : "") : "Flexible");
    row("Who's travelling", party);
    if (rooms > 1) row("Rooms", String(rooms));
    if (need.length) row("What you need", need.map(function (k) { return NEEDS[k] || k; }).join(", "));
    $("#qp-ref").textContent = ref;
    $("#qp-back").href = "/#home";

    function message() {
      var lines = [];
      lines.push(qMode === "coming"
        ? "Hi Golden Vacation! I'm coming to Jamaica" + (from ? " from " + from : "") + (place ? ", staying at " + place : "") + " and I'd like a quote."
        : "Hi Golden Vacation! I'd like a staycation quote" + (place ? " for " + place : "") + ", priced in J$ where there's a resident rate.");
      if (dIn || dOut) lines.push("Dates: " + (dIn ? niceDate(dIn) : "flexible") + " to " + (dOut ? niceDate(dOut) : "flexible") + (n ? " (" + n + (n === 1 ? " night" : " nights") + ")" : ""));
      else lines.push("Dates: flexible");
      lines.push("Travellers: " + party + (rooms > 1 ? " in " + rooms + " rooms" : ""));
      if (need.length) lines.push("I need: " + need.map(function (k) { return NEEDS[k] || k; }).join(", "));
      var more = ($("#qp-more").value || "").trim();
      if (more) lines.push("Also: " + more);
      lines.push("Ref " + ref);
      return lines.join("\n");
    }
    $("#qp-send").addEventListener("click", function () {
      var text = message();
      track("quote_send", { where: "quote-page", mode: qMode, code: ref, nights: n, adults: adults, kids: kids });
      if (window.GV_WA_EXIT) window.GV_WA_EXIT({ ref: ref, where: "quote-page", context: text });
      window.open("https://wa.me/" + WA + "?text=" + encodeURIComponent(text), "_blank", "noopener");
    });
    track("quote_view", { mode: qMode, nights: n, adults: adults, kids: kids, needs: need.length });
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

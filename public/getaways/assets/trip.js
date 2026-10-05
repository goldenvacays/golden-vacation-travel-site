/* Golden Vacation & Travel — the trip page (two countries, one trip). Runs after getaways.js, which owns the
   currency switch and logs WhatsApp exits (window.GV_WA_EXIT).

   Every Get a quote opens the date picker first. The trip length is fixed, so the guest picks the day they
   leave and the return fills itself; the earliest day is tomorrow, never today. The WhatsApp message carries
   the dates, the party (a room at a time, like the front page), the city they fly from (Montego Bay unless
   they pick or type another) and any days out added on the page. Without
   script every Get a quote is a plain link to the quote page, and every See the hotel opens the hotel page. */
(function () {
  "use strict";
  var T = window.GV_TRIP;
  if (!T) return;
  var CFG = window.GV_CONFIG || {};
  var WA = CFG.whatsapp || "18763601567";
  var NIGHTS = T.nights || 6;
  var MAXG = 16, MAXROOMS = 8;
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var DAYS_L = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function track(name, params) {
    params = params || {};
    params.page_type = "trip";
    try { if (typeof window.gtag === "function") window.gtag("event", name, params); } catch (e) {}
  }
  function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }

  /* ---- dates ---- */
  function midnight(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
  function iso(d) { var p = function (n) { return (n < 10 ? "0" : "") + n; }; return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()); }
  function parse(s) { var x = String(s || "").split("-"); if (x.length !== 3) return null; var d = new Date(+x[0], +x[1] - 1, +x[2]); return isNaN(d) ? null : d; }
  function same(a, b) { return !!(a && b && a.getTime() === b.getTime()); }
  function label(d) { return DAYS[d.getDay()] + " " + d.getDate() + " " + SHORT[d.getMonth()]; }
  function full(d) { return label(d) + " " + d.getFullYear(); }
  /* The cut-off is Jamaica's day (UTC-5 all year, no daylight saving) wherever the visitor sits, and it is
     worked out again each time the picker opens, so a tab left open overnight cannot book today. */
  var today, earliest, firstMonth, lastMonth;
  function refreshToday() {
    var j = new Date(Date.now() - 5 * 3600000);
    today = new Date(j.getUTCFullYear(), j.getUTCMonth(), j.getUTCDate());
    earliest = addDays(today, 1); /* next-day departures at the earliest, never the same day */
    firstMonth = addMonths(earliest, 0); /* on the last day of a month the picker opens on the next one */
    lastMonth = addMonths(today, 12);
  }
  refreshToday();
  function endOf(d) { return addDays(d, NIGHTS); }
  function bookable(d) { return !!d && d >= earliest && d < addMonths(lastMonth, 1); }

  /* ---- flying from: the trip's own airport (the price on the page) unless they pick or type another city ---- */
  function norm(x) { x = String(x == null ? "" : x); if (x.normalize) x = x.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); return x.toLowerCase().replace(/\s+/g, " ").trim(); }
  function esc(x) { return String(x).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  var ORIG = (T.origins || []).map(function (o) { return { name: o[0], code: o[1], country: o[2], alias: String(o[3] || "").split(",").map(norm).filter(Boolean), region: o[2] === "Jamaica" ? "Jamaica" : (o[2] === "USA" || o[2] === "Canada") ? o[2] : "The Caribbean" }; });
  var HOME = ORIG.filter(function (o) { return o.code === T.airport; })[0] || { name: T.airportName, code: T.airport, country: "Jamaica", region: "Jamaica", alias: [] };
  function isHome(o) { return o.code === HOME.code && o.name === HOME.name; }

  /* ---- state ---- */
  var REF = (function () { var s = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", v = ""; for (var i = 0; i < 4; i++) v += s.charAt(Math.floor(Math.random() * s.length)); return v; })();
  var st = { start: null, party: [{ a: 2, k: 0, ages: [] }], tours: [], month: firstMonth, sent: false, from: HOME };

  /* what the front page search already asked rides along: the day they leave, the party, the rooms */
  (function () {
    var q = new URLSearchParams(location.search);
    var ap = (q.get("a") || "").toUpperCase(), hit = ap ? ORIG.filter(function (o) { return o.code === ap; })[0] : null;
    if (hit) st.from = hit;
    var d = parse(q.get("in") || q.get("from"));
    if (bookable(d)) { st.start = d; st.month = addMonths(d, 0); }
    var split = (q.get("split") || "").split(",").map(function (p) { var x = p.split("-"); return { a: parseInt(x[0], 10), k: parseInt(x[1], 10) }; })
      .filter(function (r) { return r.a >= 1 && r.a <= MAXG && r.k >= 0 && r.k <= MAXG; });
    if (split.length) {
      var room = 0;
      st.party = [];
      split.slice(0, MAXROOMS).forEach(function (r) { if (room + r.a + r.k <= MAXG) { st.party.push({ a: r.a, k: r.k, ages: [] }); room += r.a + r.k; } });
      if (!st.party.length) st.party = [{ a: 2, k: 0, ages: [] }];
    } else {
      var a = parseInt(q.get("adults") || "", 10), k = parseInt(q.get("kids") || "", 10);
      if (a >= 1 && a <= MAXG) st.party[0].a = a;
      if (k >= 0 && k <= MAXG - st.party[0].a) st.party[0].k = k;
    }
    var flat = (q.get("ages") || "").split(",").map(function (x) { return x.trim(); }).filter(function (x) { return /^\d{1,2}$/.test(x); }), at = 0;
    st.party.forEach(function (r) { r.ages = flat.slice(at, at + r.k); at += r.k; });
  })();

  function tot(key) { return st.party.reduce(function (n, r) { return n + r[key]; }, 0); }
  function heads() { return tot("a") + tot("k"); }
  function allAges() { return st.party.reduce(function (l, r) { return l.concat(r.ages.slice(0, r.k)); }, []).filter(function (x) { return x !== "" && x != null; }); }
  function people() {
    var a = tot("a"), k = tot("k");
    return a + (a === 1 ? " adult" : " adults") + (k ? ", " + k + (k === 1 ? " child" : " children") : "");
  }
  function rooms() { var n = st.party.length; return n + (n === 1 ? " room" : " rooms"); }
  function tourList() {
    return st.tours.map(function (key) { var b = $('.tp-add[data-tour="' + key + '"]'); return b ? { key: key, name: b.getAttribute("data-name"), price: +b.getAttribute("data-price") } : null; }).filter(Boolean);
  }

  /* ---- the message that goes to WhatsApp ---- */
  function code() { return "GV-" + T.code + "-" + NIGHTS + "N-" + REF; }
  function message() {
    var lines = ["Hi Golden Vacation! I'd like a quote for " + T.name + " · " + NIGHTS + " nights · " + T.hotelLabel + "."];
    lines.push("Dates: leave " + full(st.start) + ", back " + full(endOf(st.start)));
    var ages = allAges();
    function roomLine(r, i) { return "Room " + (i + 1) + ": " + r.a + " adult" + (r.a === 1 ? "" : "s") + (r.k ? ", " + r.k + " kid" + (r.k === 1 ? "" : "s") : ""); }
    lines.push(st.party.length > 1
      ? "Travellers: " + st.party.map(roomLine).join(" · ") + (ages.length ? " (kids aged " + ages.join(", ") + ")" : "")
      : "Travellers: " + tot("a") + " adult" + (tot("a") === 1 ? "" : "s") + ", " + tot("k") + " kid" + (tot("k") === 1 ? "" : "s") + (ages.length ? " (aged " + ages.join(", ") + ")" : "") + ", 1 room");
    lines.push("From: " + st.from.name + (st.from.code ? " (" + st.from.code + ")" : ""));
    var tl = tourList();
    lines.push("Days out: " + (tl.length ? tl.map(function (t) { return t.name + " (US$" + fmt(t.price) + ")"; }).join(", ") : "none for now"));
    lines.push("Quote me in: " + (document.body.classList.contains("jmd") ? "J$" : "US$"));
    lines.push("Ref " + code());
    return lines.join("\n");
  }

  /* ---- painting: every label that follows the state ---- */
  var binds = {};
  $$("[data-bind]").forEach(function (el) { var k = el.getAttribute("data-bind"); (binds[k] = binds[k] || []).push(el); });
  function put(k, text) { (binds[k] || []).forEach(function (el) { el.textContent = text; }); }
  var fromBoxes = []; /* the Flying from boxes, filled in further down */
  var waBtn = $("#tp-wa");

  function paint() {
    var s = st.start, e = s ? endOf(s) : null;
    put("leave", s ? label(s) : "Pick a date");
    put("leaveShort", s ? label(s) : "Pick dates");
    put("who", people() + " · " + rooms());
    put("whoShort", people());
    put("fromShort", st.from.name);
    var away = !isHome(st.from);
    (binds.priceFrom || []).forEach(function (el) { el.hidden = !away || !T.priceFromOther; el.textContent = away && T.priceFromOther ? T.priceFromOther.replace("{city}", st.from.name) : ""; });
    if (T.homeLine) put("homeText", away && T.homeLineOther ? T.homeLineOther.replace("{city}", st.from.name) : T.homeLine);
    fromBoxes.forEach(function (b) { if (document.activeElement !== b.input) b.input.value = st.from.name; });
    put("barNote", s ? label(s) + " to " + label(e) + " · " + people() + " · no payment yet" : "Pick your dates · quoted on WhatsApp · no payment yet");
    var tl = tourList();
    var extra = tl.length ? " · " + tl.length + (tl.length === 1 ? " day out" : " days out") + " added" : "";
    (binds.sumMain || []).forEach(function (el) {
      if (!s) { el.textContent = "Pick your leaving date"; return; }
      el.innerHTML = "";
      var a = document.createElement("span"), sep = document.createElement("span"), b = document.createElement("span");
      a.textContent = "Leave " + label(s); sep.className = "tp-sum-sep"; sep.textContent = " · "; b.textContent = "Back " + label(e);
      el.appendChild(a); el.appendChild(sep); el.appendChild(b);
    });
    put("sumSub", s ? NIGHTS + " nights · " + people() + ", " + rooms() + extra : "The return fills itself: " + NIGHTS + " nights · " + people() + ", " + rooms() + extra);
    (binds.tourList || []).forEach(function (el) {
      el.hidden = !tl.length;
      el.textContent = tl.length ? "Days out you added: " + tl.map(function (t) { return t.name + " (US$" + fmt(t.price) + ")"; }).join(", ") + ". We price them into the quote." : "";
    });
    /* chips: gold is the one picked; on the bar under the search, the first one still showing is gold until something is picked */
    var anyOn = false;
    $$("[data-pick]").forEach(function (b) {
      var d = parse(b.getAttribute("data-start"));
      b.hidden = !bookable(d);
      var on = !!s && same(d, s);
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
      if (on) anyOn = true;
    });
    if (!anyOn && !s) { var first = $$(".tp-popular [data-pick]").filter(function (b) { return !b.hidden; })[0]; if (first) first.classList.add("is-on"); }
    /* the tours */
    $$(".tp-add[data-tour]").forEach(function (b) {
      var on = st.tours.indexOf(b.getAttribute("data-tour")) >= 0;
      b.setAttribute("aria-pressed", on ? "true" : "false");
      var l = $(".tp-add-l", b); if (l) l.textContent = on ? "Added" : "Add";
    });
    /* the WhatsApp button */
    if (waBtn) {
      if (s) {
        waBtn.href = "https://wa.me/" + WA + "?text=" + encodeURIComponent(message());
        waBtn.target = "_blank"; waBtn.rel = "noopener";
        waBtn.classList.remove("is-off");
        waBtn.removeAttribute("aria-disabled");
        put("waLabel", "Get my quote on WhatsApp");
      } else {
        waBtn.removeAttribute("href"); waBtn.removeAttribute("target"); waBtn.removeAttribute("rel");
        waBtn.classList.add("is-off");
        waBtn.setAttribute("aria-disabled", "true");
        put("waLabel", "Pick a date first");
      }
    }
    if (!st.sent) { put("footNote", T.note); (binds.footNote || []).forEach(function (x) { x.classList.remove("is-sent"); }); }
    /* a row of date chips with nothing left to offer goes away, label and all */
    $$(".tp-popular, .tp-dp-chips").forEach(function (row) { row.hidden = !$$("[data-pick]", row).some(function (b) { return !b.hidden; }); });
    paintCalendar();
  }

  /* ---- the calendar ---- */
  var calDays = $("[data-cal-days]"), calMonth = $("[data-cal-month]");
  function paintCalendar() {
    if (!calDays) return;
    var m = st.month, s = st.start, e = s ? endOf(s) : null;
    if (calMonth) calMonth.textContent = MONTHS[m.getMonth()] + " " + m.getFullYear();
    $$("[data-month]").forEach(function (b) { var d = +b.getAttribute("data-month"); b.disabled = d < 0 ? m <= firstMonth : m >= lastMonth; });
    var html = "", lead = m.getDay(), count = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    for (var i = 0; i < lead; i++) html += '<span class="tp-day-pad" aria-hidden="true"></span>';
    for (var n = 1; n <= count; n++) {
      var d = new Date(m.getFullYear(), m.getMonth(), n), off = !bookable(d);
      var edge = same(d, s) || same(d, e), inr = !!s && d > s && d < e;
      var cls = "tp-day" + (edge ? " is-edge" : "") + (inr ? " is-in" : "") + (same(d, today) ? " is-today" : "");
      var aria = DAYS_L[d.getDay()] + " " + n + " " + MONTHS[d.getMonth()] + " " + d.getFullYear() + (same(d, s) ? ", you leave" : same(d, e) ? ", you come home" : "") + (same(d, today) ? ", today, too soon to leave" : "");
      html += '<button type="button" class="' + cls + '" data-day="' + iso(d) + '"' + (off ? " disabled" : "") + (same(d, s) ? ' aria-pressed="true"' : "") + ' aria-label="' + aria + '" tabindex="-1">' + n + "</button>";
    }
    calDays.innerHTML = html;
    /* one day in the grid takes Tab: the day picked, else the first day that can be picked */
    var tab = $(".tp-day.is-edge:not(:disabled)", calDays) || $(".tp-day:not(:disabled)", calDays);
    if (tab) tab.tabIndex = 0;
  }
  function pickDay(d, how) {
    refreshToday();
    if (!bookable(d)) { paint(); return; } /* a tab left open: a chip that has gone stale just disappears */
    st.start = d;
    st.month = addMonths(d, 0);
    st.sent = false;
    paint();
    track("date_select", { how: how, leave: iso(d), dest: T.slug });
    /* on a short phone screen the summary sits under the calendar: bring it up so the return date shows */
    if (openDlg === datesDlg) { var sum = $(".tp-sum", datesDlg); if (sum && sum.scrollIntoView) { try { sum.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (e) { sum.scrollIntoView(false); } } }
  }
  if (calDays) {
    calDays.addEventListener("click", function (ev) {
      var b = ev.target.closest("[data-day]");
      if (b && !b.disabled) { pickDay(parse(b.getAttribute("data-day")), "calendar"); var again = $('[data-day="' + b.getAttribute("data-day") + '"]', calDays); if (again) again.focus(); }
    });
    calDays.addEventListener("keydown", function (ev) {
      var b = ev.target.closest && ev.target.closest("[data-day]");
      if (!b) return;
      var step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[ev.key];
      if (!step) return;
      ev.preventDefault();
      var to = addDays(parse(b.getAttribute("data-day")), step);
      if (!bookable(to)) return;
      var m = addMonths(to, 0);
      if (m.getTime() !== st.month.getTime()) { st.month = m; paintCalendar(); }
      var t = $('[data-day="' + iso(to) + '"]', calDays);
      if (t) { $$(".tp-day", calDays).forEach(function (x) { x.tabIndex = -1; }); t.tabIndex = 0; t.focus(); }
    });
  }

  /* ---- dialogs: the two hotel panels and the date picker ---- */
  var openDlg = null, returnTo = null, ownBack = false;
  function sheetEntry() { return !!(history.state && history.state.tpSheet); }
  /* a reload can land on the entry a panel left: step back off it, so the next Back leaves the page as expected */
  if (sheetEntry()) { ownBack = true; try { history.back(); } catch (e) { ownBack = false; } }
  function focusables(root) {
    return $$('a[href], button:not([disabled]), select, input, [tabindex]:not([tabindex="-1"])', root).filter(function (el) { return el.offsetParent !== null || el === document.activeElement; });
  }
  function show(dlg, opener) {
    if (openDlg && openDlg !== dlg) { openDlg.hidden = true; }
    else if (!openDlg) returnTo = opener || document.activeElement;
    openDlg = dlg;
    dlg.hidden = false;
    document.documentElement.classList.add("tp-lock");
    if (!sheetEntry()) { try { history.pushState({ tpSheet: 1 }, ""); } catch (e) {} }
    var first = $("[data-close].tp-round", dlg) || focusables(dlg)[0];
    if (first) first.focus({ preventScroll: true });
  }
  function hide(fromHistory) {
    if (!openDlg) return;
    openDlg.hidden = true;
    openDlg = null;
    closeWho(false);
    setPanelParty(false, true);
    document.documentElement.classList.remove("tp-lock");
    if (!fromHistory && sheetEntry()) { ownBack = true; try { history.back(); } catch (e) { ownBack = false; } }
    if (returnTo && returnTo.focus && document.contains(returnTo)) returnTo.focus({ preventScroll: true });
    returnTo = null;
  }
  /* the phone's back button closes the panel instead of leaving the page */
  window.addEventListener("popstate", function (ev) {
    var mine = ownBack; ownBack = false;
    if (ev.state && ev.state.tpSheet) { if (!openDlg) { ownBack = true; try { history.back(); } catch (e) { ownBack = false; } } return; } /* Forward onto a closed panel's entry */
    if (mine) { if (openDlg) { try { history.pushState({ tpSheet: 1 }, ""); } catch (e) {} } return; } /* a panel opened while our own Back was on its way keeps an entry */
    if (openDlg) hide(true);
  });
  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") {
      if (whoPop && !whoPop.hidden) { closeWho(true); return; }
      if (openDlg === datesDlg && panelParty && !panelParty.hidden) { setPanelParty(false); return; }
      if (openDlg) { ev.preventDefault(); hide(false); }
      return;
    }
    if (!openDlg) return;
    if (ev.key === "Tab") {
      var f = focusables(openDlg); if (!f.length) return;
      var i = f.indexOf(document.activeElement);
      if (ev.shiftKey && (i <= 0)) { ev.preventDefault(); f[f.length - 1].focus(); }
      else if (!ev.shiftKey && (i === f.length - 1 || i < 0)) { ev.preventDefault(); f[0].focus(); }
      return;
    }
    if ((ev.key === "ArrowLeft" || ev.key === "ArrowRight") && openDlg.hasAttribute("data-hotel-slug")) {
      var tag = (document.activeElement && document.activeElement.tagName) || "";
      if (/INPUT|SELECT|TEXTAREA/.test(tag)) return;
      ev.preventDefault();
      gallery(openDlg).go(gallery(openDlg).at() + (ev.key === "ArrowRight" ? 1 : -1), "key");
    }
  });

  var datesDlg = $("#tp-dates");
  function openDates(opener, where) {
    refreshToday();
    if (st.start && !bookable(st.start)) st.start = null;
    st.month = st.start ? addMonths(st.start, 0) : (st.month < firstMonth || st.month > lastMonth ? firstMonth : st.month);
    paint();
    show(datesDlg, opener);
    track("quote_open", { where: where || "page", dest: T.slug, has_date: st.start ? "yes" : "no" });
  }
  function openHotel(i, opener, where) {
    var dlg = $("#tp-hotel-" + i);
    if (!dlg) return;
    show(dlg, opener);
    gallery(dlg).go(0, null, true);
    track("hotel_panel_open", { hotel: dlg.getAttribute("data-hotel-slug"), where: where || "page", dest: T.slug });
  }

  /* ---- a hotel's photos: a strip that swipes on a phone, thumbnails and the arrow keys on a computer ---- */
  function gallery(dlg) {
    if (dlg._gal) return dlg._gal;
    var strip = $("[data-strip]", dlg), n = $$(".tp-slide", strip).length, count = $("[data-count]", dlg), thumbs = $$("[data-photo]", dlg), cur = 0, raf = 0, quietUntil = 0, settle = 0;
    var slug = dlg.getAttribute("data-hotel-slug");
    function at() { return cur; }
    function mark(i) {
      cur = i;
      if (count) count.textContent = String(i + 1);
      thumbs.forEach(function (t, k) { if (k === i) t.setAttribute("aria-current", "true"); else t.removeAttribute("aria-current"); });
      var th = thumbs[i]; if (th && th.scrollIntoView && th.parentNode.scrollWidth > th.parentNode.clientWidth) th.parentNode.scrollLeft = Math.max(0, th.offsetLeft - 60);
    }
    function go(i, how, instant) {
      i = (i + n) % n;
      var left = i * strip.clientWidth;
      quietUntil = Date.now() + (instant ? 80 : 900); /* the scroll we start is not a swipe */
      try { strip.scrollTo({ left: left, behavior: instant ? "auto" : "smooth" }); } catch (e) { strip.scrollLeft = left; }
      mark(i);
      if (how) track("hotel_photo", { hotel: slug, photo: i + 1, how: how });
    }
    strip.addEventListener("scroll", function () {
      if (Date.now() < quietUntil || raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0;
        var w = strip.clientWidth || 1, i = Math.round(strip.scrollLeft / w);
        if (i === cur || i < 0 || i >= n) return;
        mark(i);
        clearTimeout(settle);
        settle = setTimeout(function () { track("hotel_photo", { hotel: slug, photo: cur + 1, how: "swipe" }); }, 400);
      });
    }, { passive: true });
    if ("onscrollend" in window) strip.addEventListener("scrollend", function () { quietUntil = 0; });
    /* a click on the photo moves on one, like the thumbnails; on a phone the swipe does it */
    strip.addEventListener("click", function () { if (window.matchMedia("(min-width: 900px)").matches) go(cur + 1, "tap"); });
    thumbs.forEach(function (t) { t.addEventListener("click", function () { go(+t.getAttribute("data-photo"), "thumb"); }); });
    dlg._gal = { go: go, at: at };
    return dlg._gal;
  }
  /* a window that changes size keeps the same photo in view */
  window.addEventListener("resize", function () { if (openDlg && openDlg._gal) openDlg._gal.go(openDlg._gal.at(), null, true); });
  /* coming back to the page from the history keeps the menu on this trip */
  window.addEventListener("pageshow", function () { $$(".tp-combo").forEach(function (s) { s.value = location.pathname; if (!s.value) s.selectedIndex = 0; }); });

  /* ---- the party: a room at a time, the same picker as the front page ---- */
  var whoBtn = $("#tp-who"), whoPop = $("#tp-who-pop"), panelParty = $("#tp-dp-party"), changeBtn = $("[data-change]");
  function bump(at, which, d) {
    var r = st.party[at];
    if (!r || (d > 0 && heads() >= MAXG)) return;
    if (which === "a") r.a = Math.max(1, r.a + d);
    else { r.k = Math.max(0, r.k + d); if (d < 0) r.ages.length = r.k; }
    drawParty();
    partyChanged();
  }
  function partyChanged() { track("travellers_change", { adults: tot("a"), kids: tot("k"), rooms: st.party.length, dest: T.slug }); }
  function stepper(box, labelText, which, at, value, off) {
    var line = document.createElement("div"); line.className = "hq-line";
    var b = document.createElement("b"); b.textContent = labelText;
    var wrap = document.createElement("span"); wrap.className = "hq-step";
    var minus = document.createElement("button"), out = document.createElement("output"), plus = document.createElement("button");
    minus.type = plus.type = "button"; minus.textContent = "−"; plus.textContent = "+";
    minus.setAttribute("aria-label", "One fewer " + labelText.toLowerCase() + ", room " + (at + 1));
    plus.setAttribute("aria-label", "One more " + labelText.toLowerCase() + ", room " + (at + 1));
    minus.disabled = off(-1); plus.disabled = off(1);
    minus.setAttribute("data-focus", box + at + which + "-"); plus.setAttribute("data-focus", box + at + which + "+");
    minus.addEventListener("click", function () { bump(at, which, -1); });
    plus.addEventListener("click", function () { bump(at, which, 1); });
    out.setAttribute("aria-live", "polite"); out.textContent = value;
    wrap.appendChild(minus); wrap.appendChild(out); wrap.appendChild(plus);
    line.appendChild(b); line.appendChild(wrap);
    return line;
  }
  function ageBoxes(box, at) {
    var r = st.party[at], el = document.createElement("div");
    el.className = "hq-ages";
    if (!r.k) { el.hidden = true; return el; }
    for (var i = 0; i < r.k; i++) {
      var lab = document.createElement("label"), sp = document.createElement("span"), inp = document.createElement("input");
      sp.textContent = "Age " + (i + 1);
      inp.type = "number"; inp.min = "0"; inp.max = "17"; inp.inputMode = "numeric"; inp.placeholder = "0-17";
      inp.value = r.ages[i] == null ? "" : r.ages[i];
      inp.setAttribute("data-age", String(i)); inp.setAttribute("data-room", String(at)); inp.setAttribute("data-focus", box + at + "age" + i);
      inp.addEventListener("input", function () {
        var rr = st.party[+this.getAttribute("data-room")], k = +this.getAttribute("data-age"), v = parseInt(this.value, 10);
        rr.ages[k] = isNaN(v) ? "" : Math.max(0, Math.min(17, v));
        if (this.value !== "" && String(rr.ages[k]) !== this.value) this.value = rr.ages[k];
        /* the twin box in the other picker follows without a redraw, so typing keeps its place */
        var twin = $$('[data-room="' + this.getAttribute("data-room") + '"][data-age="' + k + '"]').filter(function (x) { return x !== this; }, this);
        twin.forEach(function (x) { x.value = rr.ages[k]; });
        paint();
      });
      lab.appendChild(sp); lab.appendChild(inp);
      el.appendChild(lab);
    }
    return el;
  }
  function drawParty() {
    var was = document.activeElement, mark = was && was.getAttribute ? was.getAttribute("data-focus") : null;
    $$("[data-party]").forEach(function (box) {
      var name = box.getAttribute("data-party");
      box.innerHTML = "";
      st.party.forEach(function (r, at) {
        var sec = document.createElement("div"); sec.className = "hq-room";
        var head = document.createElement("div"); head.className = "hq-room-h";
        var t = document.createElement("b"); t.textContent = "Room " + (at + 1); head.appendChild(t);
        if (st.party.length > 1) {
          var rm = document.createElement("button"); rm.type = "button"; rm.className = "hq-room-x"; rm.textContent = "Remove";
          rm.setAttribute("aria-label", "Remove room " + (at + 1));
          rm.setAttribute("data-focus", name + at + "rm");
          rm.addEventListener("click", function () { st.party.splice(at, 1); drawParty(); partyChanged(); });
          head.appendChild(rm);
        }
        sec.appendChild(head);
        sec.appendChild(stepper(name, "Adults", "a", at, r.a, function (d) { return d > 0 ? heads() >= MAXG : r.a <= 1; }));
        sec.appendChild(stepper(name, "Children", "k", at, r.k, function (d) { return d > 0 ? heads() >= MAXG : r.k <= 0; }));
        sec.appendChild(ageBoxes(name, at));
        box.appendChild(sec);
      });
    });
    $$("[data-addroom]").forEach(function (b) { b.hidden = st.party.length >= MAXROOMS || heads() >= MAXG; });
    paint();
    if (mark) {
      var back = $('[data-focus="' + mark + '"]');
      if (back && back.disabled) back = $('[data-focus="' + mark.replace(/[-+]$/, function (c) { return c === "-" ? "+" : "-"; }) + '"]');
      if (!back || back.disabled) { var box = $('[data-party="' + mark.replace(/\d.*$/, "") + '"]'); back = box ? $("button:not([disabled])", box) : null; }
      if (back) back.focus();
    }
  }
  $$("[data-addroom]").forEach(function (b) {
    b.addEventListener("click", function () {
      if (st.party.length >= MAXROOMS || heads() >= MAXG) return;
      st.party.push({ a: heads() + 2 <= MAXG ? 2 : 1, k: 0, ages: [] });
      drawParty();
      partyChanged();
    });
  });
  function closeWho(focusBack) {
    if (!whoPop || whoPop.hidden) return;
    whoPop.hidden = true; whoBtn.setAttribute("aria-expanded", "false");
    if (focusBack) whoBtn.focus();
  }
  if (whoBtn && whoPop) {
    whoBtn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      var open = whoPop.hidden;
      whoPop.hidden = !open; whoBtn.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) { var f = $("button", whoPop); if (f) f.focus(); track("travellers_open", { where: "search", dest: T.slug }); }
    });
    $("[data-who-done]", whoPop).addEventListener("click", function () { closeWho(true); });
    document.addEventListener("click", function (ev) {
      if (whoPop.hidden) return;
      var path = ev.composedPath ? ev.composedPath() : [];
      var inside = path.length ? path.indexOf(whoPop) >= 0 || path.indexOf(whoBtn) >= 0 : (whoPop.contains(ev.target) || whoBtn.contains(ev.target));
      if (!inside) closeWho(false);
    });
  }
  function setPanelParty(on, quiet) {
    if (!panelParty || panelParty.hidden === !on) return;
    panelParty.hidden = !on;
    if (changeBtn) changeBtn.setAttribute("aria-expanded", on ? "true" : "false");
    if (on) { var f = $("button", panelParty); if (f) f.focus(); track("travellers_open", { where: "date_picker", dest: T.slug }); }
    else if (changeBtn && !quiet) changeBtn.focus();
  }
  if (changeBtn) changeBtn.addEventListener("click", function () { setPanelParty(panelParty.hidden); });
  var partyDone = $("[data-party-done]");
  if (partyDone) partyDone.addEventListener("click", function () { setPanelParty(false); });

  /* ---- the Flying from boxes (the search bar on a computer, the date picker everywhere): type to search the
     list, arrows and Enter to pick, Escape to put it back; a city that is not on the list is taken as typed ---- */
  /* how well a city on the list answers what was typed: its code or name in full, the start of its name, of a word in
     it, of another name people use for it (MoBay, NYC, Bridgetown), or of its country */
  function fromScore(o, t) {
    var n = norm(o.name), c = norm(o.code), k = norm(o.country), best = 0;
    if (c === t || n === t) return 100;
    if (n.indexOf(t) === 0) best = 90;
    else if ((" " + n).indexOf(" " + t) >= 0) best = 75;
    o.alias.forEach(function (a) { if (a === t) best = Math.max(best, 98); else if (a.indexOf(t) === 0) best = Math.max(best, 88); else if ((" " + a).indexOf(" " + t) >= 0) best = Math.max(best, 70); });
    if (k.indexOf(t) === 0 || (" " + k).indexOf(" " + t) >= 0) best = Math.max(best, 60);
    if (!best && t.length >= 3 && c.indexOf(t) === 0) best = 55;
    if (!best && t.length >= 3 && n.indexOf(t) >= 0) best = 50;
    return best;
  }
  var coarse = window.matchMedia ? window.matchMedia("(pointer: coarse)") : { matches: false };
  function makeFromBox(input, list) {
    var where = input.getAttribute("data-from") || "page", items = [], active = -1, moved = false, typedNow = ""; /* moved: the arrow keys chose the highlighted option */
    var pop = list.classList.contains("tp-from-pop");
    function isOpen() { return !list.hidden; }
    function close() { list.hidden = true; input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant"); active = -1; }
    function setActive(i) {
      var opts = $$("[role=option]", list);
      if (!opts.length) { active = -1; input.removeAttribute("aria-activedescendant"); return; }
      active = (i + opts.length) % opts.length;
      opts.forEach(function (o, k) { o.classList.toggle("is-active", k === active); });
      var el = opts[active], top = el.offsetTop, bottom = top + el.offsetHeight;
      input.setAttribute("aria-activedescendant", el.id);
      if (top < list.scrollTop + 8) list.scrollTop = Math.max(0, top - (el.previousElementSibling && el.previousElementSibling.classList.contains("tp-from-g") ? 40 : 8));
      else if (bottom > list.scrollTop + list.clientHeight - 8) list.scrollTop = bottom - list.clientHeight + 8;
    }
    function row(o, i) {
      var sel = o.typed ? !st.from.code && o.name === st.from.name : o.code === st.from.code && o.name === st.from.name;
      return '<div class="tp-from-o' + (o.typed ? " is-typed" : "") + '" role="option" id="' + input.id + "-o" + i + '" data-i="' + i + '" aria-selected="' + sel + '">'
        + (o.typed ? "<b>" + (sel ? "" : "Use “") + esc(o.name) + (sel ? "" : "”") + "</b><small>Any city, we quote it</small>" : "<b>" + esc(o.name) + " <span>" + esc(o.code) + "</span></b><small>" + esc(o.country) + "</small>") + "</div>";
    }
    function group(label, gi, rows) { return '<div role="group" aria-labelledby="' + input.id + "-g" + gi + '"><div class="tp-from-g" id="' + input.id + "-g" + gi + '">' + esc(label) + "</div>" + rows + "</div>"; }
    /* the list as it fits under the box: on a computer the popover never runs past the bottom of the window */
    function fit() {
      if (!pop) return;
      var room = window.innerHeight - input.getBoundingClientRect().bottom - 32;
      list.style.maxHeight = Math.max(180, Math.min(440, room)) + "px";
    }
    function show(text) {
      var raw = String(text || "").trim().slice(0, 40), t = norm(raw.replace(/\(.*?\)/g, " ")), html = "", at = 0;
      typedNow = t;
      items = [];
      if (!t) {
        /* nothing typed: the whole list by region, with a city they typed before on top */
        var gi = 0;
        if (!st.from.code) { items.push({ name: st.from.name, code: "", country: "", typed: true }); html += group("Your city", gi++, row(items[0], 0)); }
        var region = "", rows = "";
        ORIG.forEach(function (o) {
          if (o.region !== region) { if (rows) html += group(region, gi++, rows); region = o.region; rows = ""; }
          if (o.code === st.from.code && o.name === st.from.name) at = items.length;
          items.push(o); rows += row(o, items.length - 1);
        });
        if (rows) html += group(region, gi++, rows);
      } else {
        var hits = ORIG.map(function (o) { return { o: o, s: fromScore(o, t) }; }).filter(function (x) { return x.s > 0; }).sort(function (a, b) { return b.s - a.s; }).slice(0, 8);
        hits.forEach(function (x) { items.push(x.o); html += row(x.o, items.length - 1); });
        if (t.length >= 3 && (!hits.length || hits[0].s < 98)) { items.push({ name: raw, code: "", country: "", typed: true }); html += row(items[items.length - 1], items.length - 1); }
      }
      if (!items.length) { list.innerHTML = ""; close(); return; } /* nothing to offer yet (one or two letters, no match) */
      list.innerHTML = html;
      moved = false;
      list.hidden = false;
      input.setAttribute("aria-expanded", "true");
      fit();
      if (!t) list.scrollTop = 0;
      setActive(at);
    }
    /* a fresh search each time the box is opened: it empties, with the city still showing as the hint, so typing never mixes into it.
       On a phone the date picker scrolls the box to its top, so the list has room above the keyboard */
    function start() {
      input.placeholder = st.from.name;
      input.value = "";
      show("");
      var sc = !pop && coarse.matches && input.closest(".tp-panel-scroll"), f = sc && input.closest(".tp-dp-from");
      if (f) {
        var y = f.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - 8;
        if (sc.scrollTop < y) { try { sc.scrollTo({ top: y, behavior: "smooth" }); } catch (e) { sc.scrollTop = y; } }
      }
    }
    function pick(o, how, keepFocus) {
      if (!o || !String(o.name || "").trim()) { input.value = st.from.name; close(); return; }
      var changed = o.name !== st.from.name || (o.code || "") !== st.from.code;
      st.from = o.typed || !o.code ? { name: String(o.name).trim().slice(0, 40), code: "", country: "", region: "", alias: [] } : o;
      input.value = st.from.name;
      close();
      if (changed) { st.sent = false; paint(); track("origin_select", { from: st.from.code || "other", city: st.from.code ? st.from.name : "typed", how: how, where: where, dest: T.slug }); } /* nothing typed goes to Analytics */
      if (!keepFocus && coarse.matches) input.blur(); /* on a phone the keyboard goes away */
    }
    /* leaving the box (Tab, a click elsewhere) takes the highlighted option once they have typed three letters or used
       the arrows: what is highlighted is what they get. One or two letters with nothing picked leave the city as it was */
    function commit() {
      var raw = input.value.trim().slice(0, 40), t = norm(raw.replace(/\(.*?\)/g, " "));
      if (isOpen() && active >= 0 && (moved || t.length >= 3)) { pick(items[active], moved ? "list" : "typed", true); return; }
      if (!t || t === norm(st.from.name)) { input.value = st.from.name; return; }
      var exact = ORIG.filter(function (o) { return fromScore(o, t) >= 98; })[0];
      if (exact) { pick(exact, "typed", true); return; }
      input.value = st.from.name;
    }
    input.addEventListener("focus", start);
    input.addEventListener("click", function () { if (!isOpen()) start(); }); /* clicked again after a pick: a new search */
    input.addEventListener("input", function () { show(input.value); });
    input.addEventListener("keydown", function (ev) {
      if (ev.key === "ArrowDown" || ev.key === "ArrowUp") { ev.preventDefault(); if (!isOpen()) show(input.value); else { setActive(active + (ev.key === "ArrowDown" ? 1 : -1)); moved = true; } return; }
      if (ev.key === "Enter") { ev.preventDefault(); if (isOpen() && active >= 0) pick(items[active], "list", true); else commit(); return; }
      if (ev.key === "Escape" && isOpen()) { ev.preventDefault(); ev.stopPropagation(); input.value = st.from.name; close(); }
    });
    input.addEventListener("blur", function () { setTimeout(function () {
      if (document.activeElement === input) return;
      commit();
      close();
      input.value = st.from.name;
    }, 0); });
    list.addEventListener("mousedown", function (ev) { ev.preventDefault(); }); /* the box keeps the focus while an option is clicked */
    list.addEventListener("click", function (ev) { var o = ev.target.closest && ev.target.closest("[data-i]"); if (o) pick(items[+o.getAttribute("data-i")], "list"); });
    window.addEventListener("resize", function () { if (isOpen()) fit(); });
    fromBoxes.push({ input: input, close: close });
  }
  $$("input[data-from]").forEach(function (input) { var list = document.getElementById(input.getAttribute("aria-controls")); if (list) makeFromBox(input, list); });

  /* ---- one listener for the page's buttons and links ---- */
  function plainClick(ev) { return !(ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || (ev.button && ev.button !== 0)); }
  document.addEventListener("click", function (ev) {
    var el = ev.target.closest && ev.target.closest("[data-open], [data-hotel], [data-close], [data-pick], [data-tour], [data-month]");
    if (!el) return;
    if (el.hasAttribute("data-open")) {
      if (el.tagName === "A" && !plainClick(ev)) return;
      ev.preventDefault();
      openDates(el, el.getAttribute("data-where"));
      return;
    }
    if (el.hasAttribute("data-hotel")) {
      if (el.tagName === "A" && !plainClick(ev)) return;
      ev.preventDefault();
      openHotel(+el.getAttribute("data-hotel"), el, el.getAttribute("data-where"));
      return;
    }
    if (el.hasAttribute("data-close")) { ev.preventDefault(); hide(false); return; }
    if (el.hasAttribute("data-pick")) {
      var d = parse(el.getAttribute("data-start"));
      pickDay(d, el.getAttribute("data-pick"));
      if (!openDlg || openDlg !== datesDlg) openDates(el, "popular_" + el.getAttribute("data-pick"));
      return;
    }
    if (el.hasAttribute("data-tour")) {
      var key = el.getAttribute("data-tour"), i = st.tours.indexOf(key);
      if (i >= 0) st.tours.splice(i, 1); else st.tours.push(key);
      paint();
      track(i >= 0 ? "tour_remove" : "tour_add", { tour: key, dest: T.slug });
      return;
    }
    if (el.hasAttribute("data-month")) {
      var m = addMonths(st.month, +el.getAttribute("data-month"));
      if (m < firstMonth || m > lastMonth) return;
      st.month = m; paintCalendar();
      if (el.disabled) { var other = $('[data-month="' + (-(+el.getAttribute("data-month"))) + '"]'); if (other) other.focus(); }
    }
  });

  /* the WhatsApp button: nothing to send until there is a date */
  if (waBtn) {
    waBtn.addEventListener("click", function (ev) {
      if (!st.start) {
        ev.preventDefault();
        var t = $(".tp-day:not(:disabled)", calDays); if (t) t.focus();
        return;
      }
      var text = message(), ref = code(), tl = tourList();
      waBtn.href = "https://wa.me/" + WA + "?text=" + encodeURIComponent(text);
      track("quote_send", { dest: T.slug, where: "trip-dates", nights: NIGHTS, airport: st.from.code || "other", from_city: st.from.code ? st.from.name : "typed", leave: iso(st.start), adults: tot("a"), kids: tot("k"), rooms: st.party.length, tours: st.tours.join(",") || "none", tour_count: tl.length, code: ref });
      if (typeof window.GV_WA_EXIT === "function") window.GV_WA_EXIT({ ref: ref, where: "trip-dates", context: text });
      st.sent = true;
      put("footNote", "WhatsApp opened with your message. Press send there, and one of our travel professionals replies within working hours.");
      $$("[data-bind=footNote]").forEach(function (x) { x.classList.add("is-sent"); });
    });
  }

  /* the combo menu: Panama + Medellín keeps its own page */
  $$(".tp-combo").forEach(function (s) {
    s.addEventListener("change", function () {
      if (s.value && s.value !== location.pathname) { track("combo_switch", { from: T.slug, to: s.value }); location.href = s.value; }
    });
  });

  /* the search bar sits over the hero, then sticks: a deeper shadow once it is stuck */
  var bar = $("#tp-search");
  if (bar) {
    var ticking = false;
    var check = function () { ticking = false; bar.classList.toggle("is-stuck", bar.getBoundingClientRect().top <= 12.5 && window.scrollY > 200); };
    window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(check); } }, { passive: true });
  }

  /* a currency change rewrites the "Quote me in" line */
  $$(".curr button").forEach(function (b) { b.addEventListener("click", function () { setTimeout(paint, 0); }); });

  drawParty();
})();

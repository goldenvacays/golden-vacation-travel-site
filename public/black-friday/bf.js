/* Golden Vacation & Travel: the Black Friday page's live countdown. It counts down to the opening
   (data-opens), then to the close (data-ends), then shows the ended state. Any element with
   data-show="soon", "live" or "over" (or several, space-separated) shows only in those states, so the page
   changes over by itself at 8am on Nov 19 and again after Nov 30 without a rebuild. */
(function () {
  "use strict";
  var clock = document.querySelector("[data-bf-clock]");
  if (!clock) return;
  var OPEN = Date.parse(clock.getAttribute("data-opens"));
  var END = Date.parse(clock.getAttribute("data-ends"));
  var shows = Array.prototype.slice.call(document.querySelectorAll("[data-show]"));
  var unit = {};
  ["d", "h", "m", "s"].forEach(function (k) { unit[k] = clock.querySelector('[data-u="' + k + '"]'); });
  var last = "";
  var timer = null;

  function pad(n) { return n < 10 ? "0" + n : String(n); }
  function put(k, v) { if (unit[k] && unit[k].textContent !== v) unit[k].textContent = v; }
  function apply(state) {
    if (state === last) return;
    last = state;
    document.documentElement.setAttribute("data-bf", state);
    shows.forEach(function (el) {
      el.hidden = (" " + el.getAttribute("data-show") + " ").indexOf(" " + state + " ") < 0;
    });
  }
  function tick() {
    var now = Date.now();
    var state = now < OPEN ? "soon" : now <= END ? "live" : "over";
    apply(state);
    if (state === "over") { if (timer) clearInterval(timer); return; }
    var sec = Math.max(0, Math.floor(((state === "soon" ? OPEN : END) - now) / 1000));
    put("d", String(Math.floor(sec / 86400)));
    put("h", pad(Math.floor((sec % 86400) / 3600)));
    put("m", pad(Math.floor((sec % 3600) / 60)));
    put("s", pad(sec % 60));
  }
  tick();
  timer = setInterval(tick, 1000);

  /* the calendar links are counted in GA4 like the WhatsApp taps */
  Array.prototype.slice.call(document.querySelectorAll("[data-bf-cal]")).forEach(function (a) {
    a.addEventListener("click", function () {
      try { if (typeof window.gtag === "function") window.gtag("event", "bf_calendar", { kind: a.getAttribute("data-bf-cal") }); } catch (e) {}
    });
  });
})();

/* The dates form: who's travelling (the site's picker, a room at a time), their own dates or the cheapest
   dates in the months they tap for the nights they want, saved to the Netlify form bf-early when they press
   Save my dates. The team replies by WhatsApp or email. */
(function () {
  "use strict";
  var form = document.getElementById("bf-form");
  if (!form) return;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var track = function (n, p) { try { if (typeof window.gtag === "function") window.gtag("event", n, p || {}); } catch (e) {} };
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var err = $("#bf-err"), saved = $("#bf-saved");
  var el = function (n) { return form.elements[n]; };
  var val = function (n) { var e = el(n); return e && e.value ? String(e.value).trim() : ""; };
  var fmt = function (s) { if (!s) return ""; var d = new Date(s + "T00:00:00"); return isNaN(d) ? s : d.getDate() + " " + MON[d.getMonth()] + " " + d.getFullYear(); };
  var trip = function () { var c = $("input[name=trip]:checked", form); return c ? c.value : ""; };
  var live = function () { return document.documentElement.getAttribute("data-bf") === "live"; };
  /* the site's visit code on the ref, as chrome.js puts on every other WhatsApp link (it leaves this one to us) */
  var REF = "GV-BF" + (window.GV_VISIT ? "-" + window.GV_VISIT : "");

  /* no dates in the past */
  var now = new Date(); now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  var today = now.toISOString().slice(0, 10);
  el("checkin").min = today; el("checkout").min = today;

  /* who's travelling */
  var MAXROOMS = 6, MAXG = 20, party = [{ a: 2, k: 0, ages: [] }];
  try { var kept = JSON.parse(sessionStorage.getItem("gv_bf_party") || "null"); if (kept && kept.length) party = kept; } catch (e) {}
  var who = $("[data-who]", form), wbtn = $(".who-btn", who), pop = $(".who-pop", who), box = $(".who-party", who), add = $(".who-add", who);
  var tot = function (k) { return party.reduce(function (n, r) { return n + r[k]; }, 0); };
  var heads = function () { return tot("a") + tot("k"); };
  function whoText() {
    var a = tot("a"), k = tot("k"), t = a + (a === 1 ? " adult" : " adults");
    if (k) t += ", " + k + (k === 1 ? " child" : " children");
    if (party.length > 1) t += ", " + party.length + " rooms";
    return t;
  }
  function agesText() {
    return party.map(function (r) { return r.ages.filter(function (x) { return x !== "" && x != null; }).join(","); }).filter(Boolean).join("; ");
  }
  function bump(at, which, d) {
    var r = party[at];
    if (!r || (d > 0 && heads() >= MAXG)) return;
    if (which === "a") r.a = Math.max(1, r.a + d);
    else { r.k = Math.max(0, r.k + d); if (d < 0) r.ages.length = r.k; }
    draw();
  }
  function step(label, which, at, value, off) {
    var line = document.createElement("div"), b = document.createElement("b"), wrap = document.createElement("span");
    var minus = document.createElement("button"), out = document.createElement("output"), plus = document.createElement("button");
    line.className = "who-line"; b.textContent = label; wrap.className = "who-step";
    minus.type = plus.type = "button"; minus.textContent = "−"; plus.textContent = "+";
    minus.setAttribute("aria-label", "One fewer " + label.toLowerCase()); plus.setAttribute("aria-label", "One more " + label.toLowerCase());
    minus.disabled = off(-1); plus.disabled = off(1);
    minus.setAttribute("data-focus", at + which + "-"); plus.setAttribute("data-focus", at + which + "+");
    minus.addEventListener("click", function () { bump(at, which, -1); });
    plus.addEventListener("click", function () { bump(at, which, 1); });
    out.setAttribute("aria-live", "polite"); out.textContent = value;
    wrap.appendChild(minus); wrap.appendChild(out); wrap.appendChild(plus); line.appendChild(b); line.appendChild(wrap);
    return line;
  }
  function ageBox(r) {
    var ages = document.createElement("div"); ages.className = "who-ages";
    if (!r.k) { ages.hidden = true; return ages; }
    for (var i = 0; i < r.k; i++) {
      var lab = document.createElement("label"), sp = document.createElement("span"), inp = document.createElement("input");
      sp.textContent = "Age " + (i + 1);
      inp.type = "number"; inp.min = "0"; inp.max = "17"; inp.inputMode = "numeric"; inp.placeholder = "0-17";
      inp.value = r.ages[i] == null ? "" : r.ages[i]; inp.setAttribute("data-age", String(i));
      inp.addEventListener("input", function () { var n = parseInt(this.value, 10), k = +this.getAttribute("data-age"); r.ages[k] = isNaN(n) ? "" : Math.max(0, Math.min(17, n)); sync(); });
      lab.appendChild(sp); lab.appendChild(inp); ages.appendChild(lab);
    }
    return ages;
  }
  function draw() {
    var was = document.activeElement, mark = was && was.getAttribute ? was.getAttribute("data-focus") : null;
    box.innerHTML = "";
    party.forEach(function (r, at) {
      var sec = document.createElement("div"), head = document.createElement("div"), t = document.createElement("b");
      sec.className = "who-room"; head.className = "who-room-h"; t.textContent = "Room " + (at + 1); head.appendChild(t);
      if (party.length > 1) {
        var x = document.createElement("button"); x.type = "button"; x.className = "who-room-x"; x.textContent = "Remove";
        x.addEventListener("click", function () { party.splice(at, 1); draw(); });
        head.appendChild(x);
      }
      sec.appendChild(head);
      sec.appendChild(step("Adults", "a", at, r.a, function (d) { return d > 0 ? heads() >= MAXG : r.a <= 1; }));
      sec.appendChild(step("Children", "k", at, r.k, function (d) { return d > 0 ? heads() >= MAXG : r.k <= 0; }));
      sec.appendChild(ageBox(r));
      box.appendChild(sec);
    });
    add.hidden = party.length >= MAXROOMS || heads() >= MAXG;
    if (mark) { var back = $('[data-focus="' + mark + '"]', box); if (back) back.focus(); }
    try { sessionStorage.setItem("gv_bf_party", JSON.stringify(party)); } catch (e) {}
    wbtn.textContent = whoText();
    sync();
  }
  function open(on) { pop.hidden = !on; wbtn.setAttribute("aria-expanded", on ? "true" : "false"); }
  wbtn.addEventListener("click", function (ev) { ev.stopPropagation(); open(pop.hidden); });
  pop.addEventListener("click", function (ev) { ev.stopPropagation(); });
  $(".who-done", pop).addEventListener("click", function () { open(false); wbtn.focus(); });
  add.addEventListener("click", function () { if (party.length >= MAXROOMS || heads() >= MAXG) return; party.push({ a: heads() + 2 <= MAXG ? 2 : 1, k: 0, ages: [] }); draw(); });
  document.addEventListener("click", function (ev) { if (!pop.hidden && !pop.contains(ev.target) && ev.target !== wbtn) open(false); });
  document.addEventListener("keydown", function (ev) { if (ev.key === "Escape" && !pop.hidden) { open(false); wbtn.focus(); } });

  /* when: their own dates, or the cheapest dates in the months they tap, for the nights they want */
  var setBox = $("[data-when=set]", form), cheapBox = $("[data-when=cheap]", form), mrow = $("#bf-months", form);
  var cheap = function () { var c = $("input[name=when]:checked", form); return !!c && c.value === "Cheapest dates"; };
  var picked = function () { return $$(".bf-month", mrow).filter(function (b) { return b.getAttribute("aria-pressed") === "true"; }).map(function (b) { return b.getAttribute("data-m"); }); };
  var NMIN = 1, NMAX = 21, want = parseInt(cheapBox.getAttribute("data-nights"), 10) || 3;
  (function () {
    var d = new Date(); d.setDate(1);
    for (var i = 0; i < 12; i++, d.setMonth(d.getMonth() + 1)) {
      var b = document.createElement("button"), m = document.createElement("b"), y = document.createElement("small");
      b.type = "button"; b.className = "bf-month"; b.setAttribute("aria-pressed", "false");
      b.setAttribute("data-m", MON[d.getMonth()] + " " + d.getFullYear());
      m.textContent = MON[d.getMonth()]; y.textContent = String(d.getFullYear());
      b.appendChild(m); b.appendChild(y); mrow.appendChild(b);
      b.addEventListener("click", function () {
        this.setAttribute("aria-pressed", this.getAttribute("aria-pressed") === "true" ? "false" : "true");
        $(".bf-months", form).classList.remove("missing");
        sync(); touched();
      });
    }
  })();
  var nOut = $(".bf-nights output", form), nBtns = $$(".bf-nights button", form);
  function setNights(n) {
    want = Math.max(NMIN, Math.min(NMAX, n));
    nOut.textContent = String(want);
    nBtns.forEach(function (b) { b.disabled = +b.getAttribute("data-n") < 0 ? want <= NMIN : want >= NMAX; });
  }
  nBtns.forEach(function (b) { b.addEventListener("click", function () { setNights(want + +b.getAttribute("data-n")); sync(); touched(); }); });
  function mode() {
    var c = cheap();
    setBox.hidden = c; cheapBox.hidden = !c;
    ["checkin", "checkout", "flexible"].forEach(function (n) { el(n).disabled = c; });
    el("months").disabled = !c;
    $$(".missing", c ? setBox : cheapBox).forEach(function (f) { f.classList.remove("missing"); });
    sync();
  }
  $$("input[name=when]", form).forEach(function (r) { r.addEventListener("change", mode); });

  function nights() {
    var a = val("checkin"), b = val("checkout");
    return a && b ? Math.round((new Date(b) - new Date(a)) / 864e5) : 0;
  }
  function sync() {
    if (val("checkin")) el("checkout").min = val("checkin");
    var c = cheap(), n = c ? want : nights();
    el("nights").value = n > 0 ? String(n) : "";
    el("months").value = c ? picked().join(", ") : "";
    el("state").value = document.documentElement.getAttribute("data-bf") || "soon";
    el("adults").value = tot("a"); el("children").value = tot("k"); el("rooms").value = party.length; el("child_ages").value = agesText();
    el("ref").value = REF;
  }
  form.addEventListener("input", sync);
  form.addEventListener("change", function (ev) {
    sync();
    var f = ev.target && ev.target.closest ? ev.target.closest(".bf-field") : null;
    if (f && f.classList.contains("missing")) f.classList.remove("missing");
  });

  /* a copy for the team's list: the same fields as the form, posted to Netlify Forms; it survives the tab
     going away (sendBeacon), and fetch with keepalive is the fallback */
  function save() {
    var body = new URLSearchParams();
    new FormData(form).forEach(function (v, k) { body.append(k, v); });
    var s = body.toString();
    try { if (navigator.sendBeacon && navigator.sendBeacon("/", new Blob([s], { type: "application/x-www-form-urlencoded" }))) return; } catch (e) {}
    try { fetch("/", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: s, keepalive: true }).catch(function () {}); } catch (e) {}
  }
  function check() {
    var miss = [];
    var trips = $(".bf-trips", form), okTrip = !!trip();
    trips.classList.toggle("missing", !okTrip); if (!okTrip) miss.push("what you're after");
    if (cheap()) {
      var okM = picked().length > 0;
      $(".bf-months", form).classList.toggle("missing", !okM); if (!okM) miss.push(form.getAttribute("data-err-months") || "the months that work");
    } else {
      [["checkin", "arriving date"], ["checkout", "leaving date"]].forEach(function (p) {
        var ok = !!val(p[0]); el(p[0]).closest(".bf-field").classList.toggle("missing", !ok); if (!ok) miss.push(p[1]);
      });
      if (val("checkin") && val("checkout") && val("checkout") <= val("checkin")) { miss.push("leaving after arriving"); el("checkout").closest(".bf-field").classList.add("missing"); }
    }
    var okN = !!val("name"); el("name").closest(".bf-field").classList.toggle("missing", !okN); if (!okN) miss.push("your name");
    /* a way to reach them: their WhatsApp number or their email, either will do */
    var ph = val("phone"), em = val("email"), fp = el("phone").closest(".bf-field"), fe = el("email").closest(".bf-field");
    fp.classList.remove("missing"); fe.classList.remove("missing");
    if (!ph && !em) { miss.push(form.getAttribute("data-err-contact") || "your WhatsApp number or email"); fp.classList.add("missing"); fe.classList.add("missing"); }
    if (ph && ph.replace(/\D/g, "").length < 7) { miss.push("the full WhatsApp number"); fp.classList.add("missing"); }
    if (em && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) { miss.push("a full email address"); fe.classList.add("missing"); }
    return miss;
  }
  /* save the dates: the list the team works from on Nov 19, no WhatsApp step */
  var send = $("#bf-send"), sendHTML = send ? send.innerHTML : "";
  function showErr(miss) {
    err.textContent = (form.getAttribute("data-err") || "") + miss.join(", ") + ".";
    err.hidden = false; saved.hidden = true;
    try { err.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (e) {}
  }
  if (send) {
    send.addEventListener("click", function () {
      sync();
      var miss = check();
      if (miss.length) { showErr(miss); return; }
      err.hidden = true;
      el("via").value = "site";
      save();
      $("span", saved).textContent = form.getAttribute((cheap() ? "data-saved-cheap-" : "data-saved-site-") + (live() ? "live" : "soon")) || "";
      saved.hidden = false;
      send.disabled = true; send.textContent = form.getAttribute("data-sent") || "Sent";
      track("bf_dates_saved", { trip: trip(), state: el("state").value, via: "site", when: cheap() ? "cheapest" : "dates" });
      track("generate_lead", { lead_source: "form", where: "bf-form" });
    });
    /* changed something after sending: they can send again */
    form.addEventListener("input", touched);
    form.addEventListener("change", touched);
  }
  function touched() { if (send && send.disabled) { send.disabled = false; send.innerHTML = sendHTML; } }

  form.addEventListener("submit", function (ev) { ev.preventDefault(); if (send) send.click(); });

  /* a rate tile without its Black Friday price yet fills the form with that trip */
  $$("[data-pick-trip]").forEach(function (a) {
    a.addEventListener("click", function () {
      var t = a.getAttribute("data-pick-trip"), w = a.getAttribute("data-pick-where");
      $$("input[name=trip]", form).forEach(function (r) { r.checked = r.value === t; });
      if (w) el("where").value = w;
      $(".bf-trips", form).classList.remove("missing");
      sync();
      track("bf_tile", { deal: a.getAttribute("data-name") || w || "", priced: "no" });
      setTimeout(function () { try { (cheap() ? $(".bf-month", mrow) : el("checkin")).focus({ preventScroll: true }); } catch (e) {} }, 700);
    });
  });
  setNights(want);
  mode();
  draw();
})();

/* the rates: one kind at a time, or all */
(function () {
  "use strict";
  var bs = Array.prototype.slice.call(document.querySelectorAll(".bf-chips .chip"));
  var tiles = Array.prototype.slice.call(document.querySelectorAll(".bf-deal"));
  bs.forEach(function (b) {
    b.addEventListener("click", function () {
      var k = b.getAttribute("data-lane");
      bs.forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
      tiles.forEach(function (t) { t.hidden = !!k && t.getAttribute("data-lane") !== k; });
      try { if (typeof window.gtag === "function") window.gtag("event", "bf_filter", { lane: k || "all" }); } catch (e) {}
    });
  });
})();

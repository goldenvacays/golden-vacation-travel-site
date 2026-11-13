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

/* The dates form: who's travelling (the site's picker, a room at a time), the WhatsApp message built from
   what was typed, and a copy of each request saved to the Netlify form bf-early as the visitor taps through,
   so the team has the list with dates even if someone never presses send in WhatsApp. */
(function () {
  "use strict";
  var form = document.getElementById("bf-form");
  if (!form) return;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var track = function (n, p) { try { if (typeof window.gtag === "function") window.gtag("event", n, p || {}); } catch (e) {} };
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var go = $("#bf-go"), err = $("#bf-err"), saved = $("#bf-saved");
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

  /* the WhatsApp message, rebuilt as they type */
  function message() {
    var a = val("checkin"), b = val("checkout"), n = a && b ? Math.round((new Date(b) - new Date(a)) / 864e5) : 0;
    var t = (form.getAttribute(live() ? "data-wa-live" : "data-wa-soon") || "").replace(/’/g, "'");
    if (trip()) t += "\nTrip: " + trip();
    if (val("where")) t += "\nWhere: " + val("where");
    if (a) t += "\nDates: " + fmt(a) + (b ? " → " + fmt(b) : "") + (n > 0 ? " (" + n + (n === 1 ? " night" : " nights") + ")" : "") + (el("flexible").checked ? ", can move a little" : "");
    t += "\nWho: " + whoText();
    var ag = agesText(); if (ag) t += " (ages " + ag.replace(/;/g, " /") + ")";
    if (val("name")) t += "\nName: " + val("name");
    t += "\nRef " + REF;
    return { text: t, nights: n };
  }
  function sync() {
    if (val("checkin")) el("checkout").min = val("checkin");
    var m = message();
    el("nights").value = m.nights > 0 ? String(m.nights) : "";
    el("state").value = document.documentElement.getAttribute("data-bf") || "soon";
    el("adults").value = tot("a"); el("children").value = tot("k"); el("rooms").value = party.length; el("child_ages").value = agesText();
    el("ref").value = REF;
    go.href = go.getAttribute("data-base") + "?text=" + encodeURIComponent(m.text);
    return m;
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
    [["checkin", "arriving date"], ["checkout", "leaving date"], ["name", "your name"], ["phone", "WhatsApp number"]].forEach(function (p) {
      var ok = !!val(p[0]); el(p[0]).closest(".bf-field").classList.toggle("missing", !ok); if (!ok) miss.push(p[1]);
    });
    if (val("checkin") && val("checkout") && val("checkout") <= val("checkin")) { miss.push("leaving after arriving"); el("checkout").closest(".bf-field").classList.add("missing"); }
    if (val("phone") && val("phone").replace(/\D/g, "").length < 7) { miss.push("the full WhatsApp number"); el("phone").closest(".bf-field").classList.add("missing"); }
    return miss;
  }
  go.addEventListener("click", function (ev) {
    var m = sync();
    var miss = check();
    if (miss.length) {
      ev.preventDefault();
      err.textContent = (form.getAttribute("data-err") || "") + miss.join(", ") + ".";
      err.hidden = false; saved.hidden = true;
      try { err.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (e) {}
      return;
    }
    err.hidden = true;
    save();
    saved.hidden = false;
    track("bf_dates_saved", { trip: trip(), state: el("state").value });
    track("whatsapp_click", { where: "bf-form", visit: window.GV_VISIT || "" });
    try { if (typeof window.GV_WA_EXIT === "function") window.GV_WA_EXIT({ ref: REF, where: "bf-form", context: m.text }); } catch (e) {}
  });
  form.addEventListener("submit", function (ev) { ev.preventDefault(); go.click(); });

  /* a rate tile without its Black Friday price yet fills the form with that trip */
  $$("[data-pick-trip]").forEach(function (a) {
    a.addEventListener("click", function () {
      var t = a.getAttribute("data-pick-trip"), w = a.getAttribute("data-pick-where");
      $$("input[name=trip]", form).forEach(function (r) { r.checked = r.value === t; });
      if (w) el("where").value = w;
      $(".bf-trips", form).classList.remove("missing");
      sync();
      track("bf_tile", { deal: a.getAttribute("data-name") || w || "", priced: "no" });
      setTimeout(function () { try { el("checkin").focus({ preventScroll: true }); } catch (e) {} }, 700);
    });
  });
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

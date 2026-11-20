(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); }, $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var track = function (n, p) { try { if (window.gtag) gtag("event", n, p || {}); } catch (e) {} };
  var btn = $(".menu-btn"), menu = $("#menu");
  if (btn && menu) { btn.addEventListener("click", function () { var open = menu.classList.toggle("open"); btn.setAttribute("aria-expanded", String(open)); document.body.classList.toggle("menu-open", open); }); $$("a", menu).forEach(function (a) { a.addEventListener("click", function () { menu.classList.remove("open"); document.body.classList.remove("menu-open"); btn.setAttribute("aria-expanded", "false"); }); }); }
  $$("[data-track]").forEach(function (el) { el.addEventListener("click", function () { track("staycation_click", { item: el.getAttribute("data-track") }); }); });
  /* hub filters: who it's for (one of), features (any number, all must match), brand (one of); All clears the lot */
  var rows = $$(".res-row"), state = { kind: "", area: "", park: false, swim: false, brand: "" };
  function applyFilters() {
    if (!rows.length) return;
    var shown = 0;
    rows.forEach(function (r) {
      var ok = (!state.kind || r.getAttribute("data-kind") === state.kind) && (!state.area || r.getAttribute("data-area") === state.area) && (!state.park || r.getAttribute("data-park") === "1") && (!state.swim || r.getAttribute("data-swim") === "1") && (!state.brand || r.getAttribute("data-brand") === state.brand);
      r.hidden = !ok; if (ok) shown++;
    });
    var empty = $(".res-empty"); if (empty) empty.hidden = shown > 0;
    var cnt = $(".res-count b"); if (cnt) cnt.textContent = shown + (shown === 1 ? " resort" : " resorts");
    var all = $('.chips[data-filter=kind] .chip[data-value=""]'); if (all) all.setAttribute("aria-pressed", !state.kind && !state.park && !state.swim && !state.brand ? "true" : "false");
  }
  if (rows.length) {
    $$(".chips[data-filter]").forEach(function (group) {
      var key = group.getAttribute("data-filter");
      $$(".chip", group).forEach(function (chip) { chip.addEventListener("click", function () {
        var v = chip.getAttribute("data-value") || "";
        if (key === "feature") { state[v] = !state[v]; chip.setAttribute("aria-pressed", state[v] ? "true" : "false"); }
        else if (key === "kind" && !v) { state.kind = ""; state.park = state.swim = false; state.brand = ""; $$(".chip", group).forEach(function (c) { c.setAttribute("aria-pressed", "false"); }); $$('.chips[data-filter=feature] .chip, .chips[data-filter=brand] .chip').forEach(function (c) { c.setAttribute("aria-pressed", "false"); }); }
        else { var on = state[key] !== v; state[key] = on ? v : ""; $$(".chip", group).forEach(function (c) { c.setAttribute("aria-pressed", "false"); }); chip.setAttribute("aria-pressed", on ? "true" : "false"); }
        applyFilters();
        track("staycation_filter", { kind: state.kind, area: state.area, park: state.park ? 1 : 0, swim: state.swim ? 1 : 0, brand: state.brand });
      }); });
    });
  }
  function fmtDate(s) { if (!s) return ""; var d = new Date(s + "T00:00:00"); return isNaN(d) ? s : d.getDate() + " " + ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()] + " " + d.getFullYear(); }
  /* who's travelling: one shared party (a room at a time), drawn into every [data-who] on the page */
  var MAXROOMS = 6, MAXG = 20;
  function pread() { try { var p = JSON.parse(sessionStorage.getItem("gv_stay_party") || "null"); if (p && p.length) return p; } catch (e) {} return [{ a: 2, k: 0, ages: [] }]; }
  var party = pread(), whos = $$("[data-who]");
  var adultsOnly = whos.some(function (w) { return w.getAttribute("data-adults-only") === "1"; });
  if (adultsOnly) party.forEach(function (r) { r.k = 0; r.ages = []; });
  var tot = function (k) { return party.reduce(function (n, r) { return n + r[k]; }, 0); }, heads = function () { return tot("a") + tot("k"); };
  function whoText() { var a = tot("a"), k = tot("k"), n = party.length, t = a + (a === 1 ? " adult" : " adults"); if (k) t += ", " + k + (k === 1 ? " child" : " children"); if (n > 1) t += ", " + n + " rooms"; return t; }
  function splitText() { return party.map(function (r, i) { var t = "Room " + (i + 1) + ": " + r.a + (r.a === 1 ? " adult" : " adults"); if (r.k) t += ", " + r.k + (r.k === 1 ? " child" : " children") + (r.ages.filter(function (x) { return x !== "" && x != null; }).length ? " (ages " + r.ages.join(", ") + ")" : ""); return t; }).join("; "); }
  function whoSync() {
    try { sessionStorage.setItem("gv_stay_party", JSON.stringify(party)); } catch (e) {}
    whos.forEach(function (w) {
      $(".who-btn", w).textContent = whoText();
      w.querySelector('[name=adults]').value = tot("a"); w.querySelector('[name=children]').value = tot("k"); w.querySelector('[name=rooms]').value = party.length;
      w.querySelector('[name=child_ages]').value = party.map(function (r) { return r.ages.join(","); }).filter(Boolean).join("; ");
      w.querySelector('[name=split]').value = party.length > 1 ? splitText() : "";
    });
    var f = $("#sform"); if (f) f.dispatchEvent(new Event("change", { bubbles: true }));
    fitRows();
  }
  /* availability rows: does the party fit the room? data-occ holds the ways to fill it as adults+children, e.g. "3+1" or "3+0|2+2"; a child may take an adult's place */
  function fitRows() {
    $$("tr[data-occ]").forEach(function (tr) {
      var tag = $(".av-fit", tr), spec = tr.getAttribute("data-occ"); if (!tag || !spec) return;
      var ways = spec.split("|").map(function (w) { var p = w.split("+"); return { a: +p[0] || 0, k: +p[1] || 0 }; });
      var fits = function (room) { return ways.some(function (w) { return room.a <= w.a && room.a + room.k <= w.a + w.k; }); };
      var ok = party.some(fits);
      tag.hidden = ok; tag.textContent = ok ? "" : (party.length > 1 ? "Too small for any of your rooms" : "Too small for your party, ask us about two rooms");
      tr.classList.toggle("av-small", !ok);
    });
  }
  function whoDraw(w) {
    var box = $(".who-party", w), was = document.activeElement, mark = was && was.getAttribute ? was.getAttribute("data-focus") : null;
    box.innerHTML = "";
    party.forEach(function (r, at) {
      var sec = document.createElement("div"); sec.className = "who-room";
      var head = document.createElement("div"); head.className = "who-room-h"; var t = document.createElement("b"); t.textContent = "Room " + (at + 1); head.appendChild(t);
      if (party.length > 1) { var x = document.createElement("button"); x.type = "button"; x.className = "who-room-x"; x.textContent = "Remove"; x.addEventListener("click", function () { party.splice(at, 1); whoDrawAll(); }); head.appendChild(x); }
      sec.appendChild(head);
      sec.appendChild(step(w, "Adults", "a", at, r.a, function (d) { return d > 0 ? heads() >= MAXG : r.a <= 1; }));
      sec.appendChild(step(w, "Children", "k", at, r.k, function (d) { return adultsOnly || (d > 0 ? heads() >= MAXG : r.k <= 0); }));
      sec.appendChild(ages(at, r));
      box.appendChild(sec);
    });
    $(".who-add", w).hidden = party.length >= MAXROOMS || heads() >= MAXG;
    if (mark) { var back = $('[data-focus="' + mark + '"]', box); if (back) back.focus(); }
  }
  function whoDrawAll() { whos.forEach(whoDraw); whoSync(); }
  function step(w, label, which, at, value, off) {
    var line = document.createElement("div"); line.className = "who-line"; var b = document.createElement("b"); b.textContent = label;
    var wrap = document.createElement("span"); wrap.className = "who-step";
    var minus = document.createElement("button"), out = document.createElement("output"), plus = document.createElement("button");
    minus.type = plus.type = "button"; minus.textContent = "\u2212"; plus.textContent = "+";
    minus.setAttribute("aria-label", "One fewer " + label.toLowerCase()); plus.setAttribute("aria-label", "One more " + label.toLowerCase());
    minus.disabled = off(-1); plus.disabled = off(1);
    minus.setAttribute("data-focus", at + which + "-"); plus.setAttribute("data-focus", at + which + "+");
    minus.addEventListener("click", function () { bump(at, which, -1); }); plus.addEventListener("click", function () { bump(at, which, 1); });
    out.setAttribute("aria-live", "polite"); out.textContent = value;
    wrap.appendChild(minus); wrap.appendChild(out); wrap.appendChild(plus); line.appendChild(b); line.appendChild(wrap); return line;
  }
  function bump(at, which, d) { var r = party[at]; if (!r || (d > 0 && heads() >= MAXG)) return; if (which === "a") r.a = Math.max(1, r.a + d); else { r.k = Math.max(0, r.k + d); if (d < 0) r.ages.length = r.k; } whoDrawAll(); }
  function ages(at, r) {
    var box = document.createElement("div"); box.className = "who-ages"; if (!r.k) { box.hidden = true; return box; }
    for (var i = 0; i < r.k; i++) {
      var lab = document.createElement("label"), sp = document.createElement("span"), inp = document.createElement("input");
      sp.textContent = "Age " + (i + 1); inp.type = "number"; inp.min = "0"; inp.max = "17"; inp.inputMode = "numeric"; inp.placeholder = "0-17"; inp.value = r.ages[i] == null ? "" : r.ages[i]; inp.setAttribute("data-age", String(i)); inp.setAttribute("data-focus", at + "age" + i);
      inp.addEventListener("input", function () { var n = parseInt(this.value, 10), k = +this.getAttribute("data-age"); r.ages[k] = isNaN(n) ? "" : Math.max(0, Math.min(17, n)); whoSync(); });
      lab.appendChild(sp); lab.appendChild(inp); box.appendChild(lab);
    }
    return box;
  }
  whos.forEach(function (w) {
    var btn = $(".who-btn", w), pop = $(".who-pop", w);
    function open(on) { pop.hidden = !on; btn.setAttribute("aria-expanded", on ? "true" : "false"); }
    btn.addEventListener("click", function (ev) { ev.stopPropagation(); var on = pop.hidden; whos.forEach(function (o) { $(".who-pop", o).hidden = true; $(".who-btn", o).setAttribute("aria-expanded", "false"); }); open(on); });
    pop.addEventListener("click", function (ev) { ev.stopPropagation(); });
    $(".who-done", pop).addEventListener("click", function () { open(false); btn.focus(); });
    $(".who-add", pop).addEventListener("click", function () { if (party.length >= MAXROOMS || heads() >= MAXG) return; party.push({ a: heads() + 2 <= MAXG ? 2 : 1, k: 0, ages: [] }); whoDrawAll(); });
    document.addEventListener("click", function (ev) { if (!pop.hidden && !pop.contains(ev.target) && ev.target !== btn) open(false); });
  });
  document.addEventListener("keydown", function (ev) { if (ev.key === "Escape") whos.forEach(function (o) { $(".who-pop", o).hidden = true; }); });
  if (whos.length) whoDrawAll();
  /* search bar */
  var sbar = $("#sbar");
  function sread() { try { return JSON.parse(sessionStorage.getItem("gv_stay_search") || "{}"); } catch (e) { return {}; } }
  function ssave(o) { try { sessionStorage.setItem("gv_stay_search", JSON.stringify(o)); } catch (e) {} }
  if (sbar) {
    var saved = sread();
    ["checkin", "checkout", "area"].forEach(function (k) { var el = sbar.elements[k]; if (el && saved[k] && !el.disabled && el.type !== "hidden") el.value = saved[k]; });
    var today = new Date(); today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    $$("input[type=date]", sbar).forEach(function (d) { d.min = today.toISOString().slice(0, 10); });
    var mirror = function () {
      var o = {}; ["checkin", "checkout", "area"].forEach(function (k) { var el = sbar.elements[k]; if (el) o[k] = el.value; }); ssave(o);
      var f = $("#sform"); if (f) { ["checkin", "checkout"].forEach(function (k) { if (f.elements[k] && !f.elements[k].disabled && o[k]) f.elements[k].value = o[k]; }); f.dispatchEvent(new Event("change", { bubbles: true })); }
      if (rows.length) { state.area = o.area || ""; applyFilters(); }
    };
    sbar.addEventListener("change", mirror); mirror();
    sbar.addEventListener("submit", function (e) { e.preventDefault(); mirror(); var target = $("#rooms") || $("#pick"); if (target) target.scrollIntoView({ behavior: "smooth", block: "start" }); track("staycation_search", { area: (sbar.elements.area || {}).value || "" }); });
  }
  /* resort page: no search bar, so the hub search lands in the card and the strip reads from the card */
  var sform0 = $("#sform");
  if (!sbar && sform0) {
    var sv = sread();
    ["checkin", "checkout"].forEach(function (k) { var el = sform0.elements[k]; if (el && sv[k] && !el.value) el.value = sv[k]; });
    sform0.addEventListener("change", function () { var o = sread(); o.checkin = sform0.elements.checkin.value; o.checkout = sform0.elements.checkout.value; ssave(o); });
  }
  function stripSync() {
    var f = $("#sform"), d = $("#strip-dates"), w = $("#strip-who"); if (!f || !d) return;
    var a = f.elements.checkin.value, b = f.elements.checkout.value, n = a && b ? Math.round((new Date(b) - new Date(a)) / 86400000) : 0;
    d.textContent = n > 0 ? n + (n === 1 ? " night, " : " nights, ") + fmtDate(a) + " to " + fmtDate(b) : (a ? "Check-in " + fmtDate(a) + ", add your check-out" : "Add your dates");
    if (w) w.textContent = whoText();
  }
  $$(".strip-change").forEach(function (a) { a.addEventListener("click", function () { var inp = $("#s-in"); if (inp) setTimeout(function () { try { inp.focus({ preventScroll: true }); } catch (e) {} }, 500); }); });
  /* quote this room: fill the card and go to it */
  $$("[data-room]").forEach(function (b) { b.addEventListener("click", function () {
    var sel = $("#s-room"); if (sel) { sel.value = b.getAttribute("data-room"); sel.dispatchEvent(new Event("change", { bubbles: true })); }
    var card = $("#quote"); if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
    var inp = $("#s-in"); if (inp) setTimeout(function () { try { inp.focus({ preventScroll: true }); } catch (e) {} }, 500);
  }); });
  var form = $("#sform");
  if (!form) return;
  var today = new Date(); today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  $$("input[type=date]", form).forEach(function (d) { d.min = today.toISOString().slice(0, 10); });
  function subject() {
    var r = form.resort.value, a = form.checkin.value, b = form.checkout.value;
    $("#s-subject").value = "Staycation quote · " + r + (a ? " · " + fmtDate(a) + (b ? " to " + fmtDate(b) : "") : "") + " · " + whoText();
  }
  function summary() {
    var box = $("#book-sum"); if (!box) return;
    var a = form.checkin.value, b = form.checkout.value, n = 0;
    if (a && b) { n = Math.round((new Date(b) - new Date(a)) / 86400000); }
    var room = form.room.value || "Room type to be chosen", rooms = Number(form.rooms.value) || 1;
    var hint = $("#rooms-hint"); if (hint) hint.hidden = rooms < 2;
    box.innerHTML = n > 0 ? "<b>" + n + " night" + (n === 1 ? "" : "s") + "</b>, " + fmtDate(a) + " to " + fmtDate(b) + " · " + whoText() + "<br><span>" + room + "</span>" : "<span>Pick your dates</span>";
    /* the WhatsApp button carries what the guest has typed, so nobody asks twice */
    var wa = $("#s-wa");
    if (wa) {
      var t = "Hi, I'd like a quote for " + form.resort.value + ".";
      if (a) t += "\nDates: " + fmtDate(a) + (b ? " to " + fmtDate(b) : "") + (n > 0 ? " (" + n + " night" + (n === 1 ? "" : "s") + ")" : "");
      t += "\nWho: " + whoText();
      var ages = form.child_ages.value; if (ages) t += " (ages " + ages.replace(/;/g, " and") + ")";
      if (rooms > 1) t += "\n" + splitText();
      if (form.room.value) t += "\nRoom: " + form.room.value;
      if (form.notes && form.notes.value.trim()) t += "\nNotes: " + form.notes.value.trim();
      wa.href = wa.getAttribute("data-base") + "?text=" + encodeURIComponent(t);
    }
  }
  form.addEventListener("change", function () { subject(); summary(); stripSync(); }); form.addEventListener("input", function () { subject(); summary(); stripSync(); }); summary(); stripSync(); fitRows();
  form.addEventListener("submit", function (e) {
    var miss = [];
    $$("[data-req]", form).forEach(function (el) {
      var v = (el.value || "").trim(), ok = !!v;
      if (el.type === "email") ok = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
      el.closest(".field, .numbox").classList.toggle("missing", !ok);
      if (!ok) miss.push($("label", el.closest(".field, .numbox")).textContent.replace(/\*/g, "").replace(/the quote comes here/, "").trim());
    });
    if (form.checkin.value && form.checkout.value && form.checkout.value <= form.checkin.value) miss.push("check-out after check-in");
    var err = $(".form-err", form);
    if (miss.length) { e.preventDefault(); err.textContent = "To quote this we still need: " + miss.join(", ") + "."; err.classList.add("show"); err.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    err.classList.remove("show"); subject(); track("staycation_submit", { resort: form.resort.value });
  });
})();

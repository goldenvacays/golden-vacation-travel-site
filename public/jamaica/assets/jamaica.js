(function () {
  "use strict";
  var $ = function (s, r) { return (r || document).querySelector(s); }, $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var track = function (n, p) { try { if (window.gtag) gtag("event", n, p || {}); } catch (e) {} };
  var btn = $(".menu-btn"), menu = $("#menu");
  if (btn && menu) {
    btn.addEventListener("click", function () { var open = menu.classList.toggle("open"); btn.setAttribute("aria-expanded", String(open)); document.body.classList.toggle("menu-open", open); });
    $$("a", menu).forEach(function (a) { a.addEventListener("click", function () { menu.classList.remove("open"); document.body.classList.remove("menu-open"); btn.setAttribute("aria-expanded", "false"); }); });
  }
  $$("[data-track]").forEach(function (el) { el.addEventListener("click", function () { track("jamaica_click", { item: el.getAttribute("data-track") }); }); });
  $$(".faq details").forEach(function (d) { d.addEventListener("toggle", function () { if (d.open) track("jamaica_faq", { q: $("summary", d).textContent.trim().slice(0, 80) }); }); });

  var C = window.GV_JAM;
  /* prices in £, C$ or US$ on the pages that carry the switch: house rates, rounded up, the visitor's pick remembered */
  var CUR = C && C.cur;
  if (CUR) {
    var pick = CUR.def;
    try { var saved = localStorage.getItem("gv_cur"); if (saved && CUR.rates[saved] && $('.cur-switch button[data-cur="' + saved + '"]')) pick = saved; } catch (e) {}
    var paint = function (cur) {
      try { localStorage.setItem("gv_cur", cur); } catch (e) {}
      var rate = CUR.rates[cur], sym = CUR.symbols[cur];
      $$(".money[data-usd]").forEach(function (m) { var n = Math.ceil(parseFloat(m.getAttribute("data-usd")) * rate - 1e-9); m.textContent = sym + n.toLocaleString("en-US"); });
      $$(".cur-switch button").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-cur") === cur ? "true" : "false"); });
      var jf = $("#jform"), el = jf && jf.elements.currency;
      if (el) { var lab = CUR.labels[cur] || ""; if (el.tagName !== "SELECT" || lab) el.value = lab; jf.dispatchEvent(new Event("change", { bubbles: true })); }
    };
    $$(".cur-switch button").forEach(function (b) { b.addEventListener("click", function () { paint(b.getAttribute("data-cur")); track("currency_switch", { cur: b.getAttribute("data-cur") }); }); });
    paint(pick);
  }
  var form = $("#jform");
  if (!C || !form) return;
  var P = C.picker, F = C.form, L = C.labels;
  function fmtDate(s) { if (!s) return ""; var d = new Date(s + "T00:00:00"); return isNaN(d) ? s : d.getDate() + " " + C.months[d.getMonth()] + " " + d.getFullYear(); }

  /* who's travelling: a room at a time, the same picker as the rest of the site */
  var MAXROOMS = 6, MAXG = 20;
  function pread() { try { var p = JSON.parse(sessionStorage.getItem("gv_jam_party") || "null"); if (p && p.length) return p; } catch (e) {} return [{ a: 2, k: 0, ages: [] }]; }
  var party = pread(), whos = $$("[data-who]");
  var tot = function (k) { return party.reduce(function (n, r) { return n + r[k]; }, 0); }, heads = function () { return tot("a") + tot("k"); };
  function whoText() { var a = tot("a"), k = tot("k"), n = party.length, t = a + " " + (a === 1 ? P.adult : P.adults); if (k) t += ", " + k + " " + (k === 1 ? P.child : P.children); if (n > 1) t += ", " + n + " " + P.rooms; return t; }
  function splitText() { return party.map(function (r, i) { var t = P.room + " " + (i + 1) + ": " + r.a + " " + (r.a === 1 ? P.adult : P.adults); if (r.k) t += ", " + r.k + " " + (r.k === 1 ? P.child : P.children) + (r.ages.filter(function (x) { return x !== "" && x != null; }).length ? " (" + r.ages.join(", ") + ")" : ""); return t; }).join("; "); }
  function whoSync() {
    try { sessionStorage.setItem("gv_jam_party", JSON.stringify(party)); } catch (e) {}
    whos.forEach(function (w) {
      $(".who-btn", w).textContent = whoText();
      w.querySelector("[name=adults]").value = tot("a"); w.querySelector("[name=children]").value = tot("k"); w.querySelector("[name=rooms]").value = party.length;
      w.querySelector("[name=child_ages]").value = party.map(function (r) { return r.ages.join(","); }).filter(Boolean).join("; ");
      w.querySelector("[name=split]").value = party.length > 1 ? splitText() : "";
    });
    form.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function step(label, which, at, value, off) {
    var line = document.createElement("div"); line.className = "who-line"; var b = document.createElement("b"); b.textContent = label;
    var wrap = document.createElement("span"); wrap.className = "who-step";
    var minus = document.createElement("button"), out = document.createElement("output"), plus = document.createElement("button");
    minus.type = plus.type = "button"; minus.textContent = "\u2212"; plus.textContent = "+";
    minus.setAttribute("aria-label", P.fewer + label.toLowerCase()); plus.setAttribute("aria-label", P.more + label.toLowerCase());
    minus.disabled = off(-1); plus.disabled = off(1);
    minus.setAttribute("data-focus", at + which + "-"); plus.setAttribute("data-focus", at + which + "+");
    minus.addEventListener("click", function () { bump(at, which, -1); }); plus.addEventListener("click", function () { bump(at, which, 1); });
    out.setAttribute("aria-live", "polite"); out.textContent = value;
    wrap.appendChild(minus); wrap.appendChild(out); wrap.appendChild(plus); line.appendChild(b); line.appendChild(wrap); return line;
  }
  function bump(at, which, d) { var r = party[at]; if (!r || (d > 0 && heads() >= MAXG)) return; if (which === "a") r.a = Math.max(1, r.a + d); else { r.k = Math.max(0, r.k + d); if (d < 0) r.ages.length = r.k; } drawAll(); }
  function ages(at, r) {
    var box = document.createElement("div"); box.className = "who-ages"; if (!r.k) { box.hidden = true; return box; }
    for (var i = 0; i < r.k; i++) {
      var lab = document.createElement("label"), sp = document.createElement("span"), inp = document.createElement("input");
      sp.textContent = P.age + " " + (i + 1); inp.type = "number"; inp.min = "0"; inp.max = "17"; inp.inputMode = "numeric"; inp.placeholder = "0-17"; inp.value = r.ages[i] == null ? "" : r.ages[i]; inp.setAttribute("data-age", String(i)); inp.setAttribute("data-focus", at + "age" + i);
      inp.addEventListener("input", function () { var n = parseInt(this.value, 10), k = +this.getAttribute("data-age"); r.ages[k] = isNaN(n) ? "" : Math.max(0, Math.min(17, n)); whoSync(); });
      lab.appendChild(sp); lab.appendChild(inp); box.appendChild(lab);
    }
    return box;
  }
  function draw(w) {
    var box = $(".who-party", w), was = document.activeElement, mark = was && was.getAttribute ? was.getAttribute("data-focus") : null;
    box.innerHTML = "";
    party.forEach(function (r, at) {
      var sec = document.createElement("div"); sec.className = "who-room";
      var head = document.createElement("div"); head.className = "who-room-h"; var t = document.createElement("b"); t.textContent = P.room + " " + (at + 1); head.appendChild(t);
      if (party.length > 1) { var x = document.createElement("button"); x.type = "button"; x.className = "who-room-x"; x.textContent = P.remove; x.addEventListener("click", function () { party.splice(at, 1); drawAll(); }); head.appendChild(x); }
      sec.appendChild(head);
      sec.appendChild(step(P.Adults, "a", at, r.a, function (d) { return d > 0 ? heads() >= MAXG : r.a <= 1; }));
      sec.appendChild(step(P.Children, "k", at, r.k, function (d) { return d > 0 ? heads() >= MAXG : r.k <= 0; }));
      sec.appendChild(ages(at, r));
      box.appendChild(sec);
    });
    $(".who-add", w).hidden = party.length >= MAXROOMS || heads() >= MAXG;
    if (mark) { var back = $('[data-focus="' + mark + '"]', box); if (back) back.focus(); }
  }
  function drawAll() { whos.forEach(draw); whoSync(); }
  whos.forEach(function (w) {
    var b = $(".who-btn", w), pop = $(".who-pop", w);
    function open(on) { pop.hidden = !on; b.setAttribute("aria-expanded", on ? "true" : "false"); }
    b.addEventListener("click", function (ev) { ev.stopPropagation(); open(pop.hidden); });
    pop.addEventListener("click", function (ev) { ev.stopPropagation(); });
    $(".who-done", pop).addEventListener("click", function () { open(false); b.focus(); });
    $(".who-add", pop).addEventListener("click", function () { if (party.length >= MAXROOMS || heads() >= MAXG) return; party.push({ a: heads() + 2 <= MAXG ? 2 : 1, k: 0, ages: [] }); drawAll(); });
    document.addEventListener("click", function (ev) { if (!pop.hidden && !pop.contains(ev.target) && ev.target !== b) open(false); });
  });
  document.addEventListener("keydown", function (ev) { if (ev.key === "Escape") whos.forEach(function (o) { $(".who-pop", o).hidden = true; }); });

  /* the form: dates, needs, the summary line, and a WhatsApp button that carries what was typed */
  var today = new Date(); today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  var tday = today.toISOString().slice(0, 10);
  $$("input[type=date]", form).forEach(function (d) { d.min = tday; });
  var val = function (n) { var el = form.elements[n]; return el ? (el.value || "").trim() : ""; };
  function needs() { return $$("input[name=need]:checked", form).map(function (c) { return c.value; }); }
  function sync() {
    var a = val("checkin"), b = val("checkout"), n = a && b ? Math.round((new Date(b) - new Date(a)) / 86400000) : 0;
    if (a) form.elements.checkout.min = a;
    $("#j-needs").value = needs().join(", ");
    $("#j-subject").value = "Jamaica trip · " + form.getAttribute("data-audience") + (a ? " · " + fmtDate(a) + (b ? " to " + fmtDate(b) : "") : "") + " · " + whoText();
    var sum = $("#j-sum");
    if (sum) sum.innerHTML = n > 0 ? "<b>" + n + " " + (n === 1 ? F.night : F.nights) + "</b>, " + fmtDate(a) + " \u2192 " + fmtDate(b) + " · " + whoText() : "<span>" + F.sum0 + "</span>";
    var t = form.getAttribute("data-intro");
    if (a) t += "\n" + L.dates + ": " + fmtDate(a) + (b ? " \u2192 " + fmtDate(b) : "") + (n > 0 ? " (" + n + " " + (n === 1 ? F.night : F.nights) + ")" : "");
    t += "\n" + L.who + ": " + whoText();
    var ag = val("child_ages"); if (ag) t += " (" + ag.replace(/;/g, " /") + ")";
    if (party.length > 1) t += "\n" + splitText();
    if (needs().length) t += "\n" + L.needs + ": " + needs().join(", ");
    if (val("area")) t += "\n" + L.area + ": " + val("area");
    if (val("occasion")) t += "\n" + L.occasion + ": " + val("occasion");
    if (val("currency")) t += "\n" + L.currency + ": " + val("currency");
    if (val("notes")) t += "\n" + L.notes + ": " + val("notes");
    t += "\nRef " + form.getAttribute("data-ref");
    var w = $("#j-wa"); if (w) w.href = w.getAttribute("data-base") + "?text=" + encodeURIComponent(t);
  }
  form.addEventListener("change", sync); form.addEventListener("input", sync);
  if (whos.length) drawAll(); else sync();
  $("#j-wa").addEventListener("click", function () { track("jamaica_whatsapp", { page: form.getAttribute("data-ref") }); });
  form.addEventListener("submit", function (e) {
    var miss = [];
    $$("[data-req]", form).forEach(function (el) {
      var v = (el.value || "").trim(), ok = !!v;
      if (el.type === "email") ok = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
      el.closest(".field").classList.toggle("missing", !ok);
      if (!ok) miss.push($("label", el.closest(".field")).textContent.replace(/\*/g, "").trim());
    });
    if (val("checkin") && val("checkout") && val("checkout") <= val("checkin")) miss.push(F.errOrder);
    var err = $(".form-err", form);
    if (miss.length) { e.preventDefault(); err.textContent = F.errPre + miss.join(", ") + "."; err.classList.add("show"); err.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    err.classList.remove("show"); sync(); track("jamaica_submit", { page: form.getAttribute("data-ref") });
  });
})();

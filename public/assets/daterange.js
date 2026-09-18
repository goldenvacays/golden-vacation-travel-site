/* Golden Vacation & Travel — the date picker, shared by every date field on the site.
   ----------------------------------------------------------------------------------------------
   The browser's own date box was the weak point of the search. It shows mm/dd/yyyy to some people
   and dd/mm/yyyy to others, so a Jamaican or British traveller reading 12/01 books January when
   they meant December and nobody catches it until the confirmation. It also has no idea that check
   in and check out belong to each other, so nothing highlights between them and nothing ever says
   how many nights they just picked.

   This replaces it. The native inputs stay in the page and keep their ids, their names and their
   values, so every form that reads them carries on working: this only hides them behind a button
   and writes the value back with a change event, exactly as if somebody had typed it.

   Marking a field up:
     <input type="date" id="hq-in"  data-dr="start" data-dr-pair="#hq-out">
     <input type="date" id="hq-out" data-dr="end">
     <input type="date" id="s-date" data-dr="single">
   Options on the start (or single) input:
     data-dr-optional   offers "Not sure yet" and allows the pair to be left empty
     min / max          honoured, as on the native control
*/
(function () {
  "use strict";
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var DOW = ["S", "M", "T", "W", "T", "F", "S"];
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function iso(d) { var p = function (n) { return String(n).padStart(2, "0"); }; return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()); }
  function parse(s) { var x = String(s || "").split("-"); return x.length === 3 ? new Date(+x[0], +x[1] - 1, +x[2]) : null; }
  function midnight(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
  function nights(a, b) { return Math.round((midnight(b) - midnight(a)) / 86400000); }
  /* written out, never in digits, so there is no dd/mm against mm/dd to get wrong */
  function label(s) { var d = parse(s); return d ? DAYS[d.getDay()] + " " + d.getDate() + " " + SHORT[d.getMonth()] : ""; }
  function full(s) { var d = parse(s); return d ? DAYS[d.getDay()] + " " + d.getDate() + " " + SHORT[d.getMonth()] + " " + d.getFullYear() : ""; }

  var panel = null, open = null;   /* the one panel on the page, and the group using it */

  function build() {
    if (panel) return panel;
    panel = document.createElement("div");
    panel.className = "dr-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Choose dates");
    panel.hidden = true;
    panel.innerHTML =
      '<div class="dr-head">' +
        '<button type="button" class="dr-nav" data-dr-nav="-1" aria-label="Previous month">&#8249;</button>' +
        '<span class="dr-months" id="dr-months"></span>' +
        '<button type="button" class="dr-nav" data-dr-nav="1" aria-label="Next month">&#8250;</button>' +
      '</div>' +
      '<div class="dr-grids" id="dr-grids"></div>' +
      '<div class="dr-foot"><span class="dr-sum" id="dr-sum" aria-live="polite"></span><span class="dr-acts">' +
        '<button type="button" class="dr-clear" id="dr-clear"></button>' +
        '<button type="button" class="dr-done" id="dr-done">Done</button>' +
      '</span></div>';
    document.body.appendChild(panel);
    panel.addEventListener("mousedown", function (ev) { ev.preventDefault(); });
    panel.addEventListener("click", function (ev) {
      /* the grid is redrawn inside this handler, which detaches the button that was clicked. Without
         this the document's outside-click check no longer finds it in the panel and shuts the panel
         on the very tap that was meant to set a date. */
      ev.stopPropagation();
      var nav = ev.target.closest("[data-dr-nav]");
      if (nav) { open.month = addMonths(open.month, +nav.getAttribute("data-dr-nav")); return paint(); }
      var day = ev.target.closest("[data-dr-day]");
      if (day && !day.disabled) return pick(day.getAttribute("data-dr-day"));
      if (ev.target.closest("#dr-done")) return close();
      if (ev.target.closest("#dr-clear")) { open.start.value = ""; if (open.end) open.end.value = ""; fire(); paint(); return open.range ? null : close(); }
    });
    panel.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") { ev.stopPropagation(); return close(true); }
      var d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[ev.key];
      if (!d || !ev.target.hasAttribute || !ev.target.hasAttribute("data-dr-day")) return;
      ev.preventDefault();
      var to = iso(addDays(parse(ev.target.getAttribute("data-dr-day")), d));
      if (parse(to) < parse(iso(open.month))) { open.month = addMonths(open.month, -1); paint(); }
      else if (parse(to) > parse(iso(addMonths(open.month, 2)))) { open.month = addMonths(open.month, 1); paint(); }
      var next = panel.querySelector('[data-dr-day="' + to + '"]');
      if (next) next.focus(); else { open.month = addMonths(parse(to), 0); paint(); var n2 = panel.querySelector('[data-dr-day="' + to + '"]'); if (n2) n2.focus(); }
    });
    return panel;
  }

  function fire() {
    [open.start, open.end].forEach(function (i) { if (i) i.dispatchEvent(new Event("change", { bubbles: true })); });
    paintButtons(open);
  }

  function pick(v) {
    var g = open;
    if (!g.range) { g.start.value = v; fire(); return close(); }
    var a = g.start.value, b = g.end.value;
    /* first tap sets the arrival, second sets the departure. Tapping before the arrival moves the
       arrival rather than refusing, which is what people expect when they change their mind. */
    if (!a || (a && b) || parse(v) < parse(a)) { g.start.value = v; g.end.value = ""; g.field = "end"; }
    else if (v === a) { g.end.value = ""; }
    else { g.end.value = v; g.field = "end"; }
    fire();
    paint();
    if (g.start.value && g.end.value) setTimeout(close, 160);
  }

  function monthGrid(base, g) {
    var y = base.getFullYear(), m = base.getMonth();
    var first = new Date(y, m, 1).getDay(), dim = new Date(y, m + 1, 0).getDate();
    var min = g.start.getAttribute("min"), max = g.start.getAttribute("max");
    var a = parse(g.start.value), b = g.end ? parse(g.end.value) : null;
    var out = '<div class="dr-grid"><div class="dr-mname">' + MONTHS[m] + " " + y + '</div><div class="dr-dow">' +
      DOW.map(function (d) { return "<span>" + d + "</span>"; }).join("") + '</div><div class="dr-days">';
    for (var i = 0; i < first; i++) out += '<span class="dr-pad"></span>';
    for (var day = 1; day <= dim; day++) {
      var d = new Date(y, m, day), v = iso(d), cls = [];
      var off = (min && v < min) || (max && v > max);
      if (a && v === iso(a)) cls.push("dr-a");
      if (b && v === iso(b)) cls.push("dr-b");
      if (a && b && d > a && d < b) cls.push("dr-mid");
      out += '<button type="button" class="dr-day ' + cls.join(" ") + '" data-dr-day="' + v + '"' +
        (off ? " disabled" : "") + ' aria-label="' + full(v) + '"' +
        (a && v === iso(a) ? ' aria-current="date"' : "") + ">" + day + "</button>";
    }
    return out + "</div></div>";
  }

  function paint() {
    var g = open;
    panel.querySelector("#dr-grids").innerHTML = monthGrid(g.month, g) + monthGrid(addMonths(g.month, 1), g);
    panel.querySelector("#dr-months").textContent = MONTHS[g.month.getMonth()] + " " + g.month.getFullYear();
    var a = g.start.value, b = g.end ? g.end.value : "";
    var sum = !a ? (g.range ? "Pick your arrival date" : "Pick a date")
      : g.range && !b ? full(a) + "  \u2192  now the date you come back"
      : g.range ? full(a) + "  \u2192  " + full(b) + "  \u00b7  " + nights(parse(a), parse(b)) + (nights(parse(a), parse(b)) === 1 ? " night" : " nights")
      : full(a);
    panel.querySelector("#dr-sum").textContent = sum;
    var clear = panel.querySelector("#dr-clear");
    /* read live: a field can stop being optional while the page is open. The front page search
       drops "Not sure yet" the moment the guest moves to a tab that has to have a date. */
    var opt = g.start.hasAttribute("data-dr-optional");
    clear.textContent = opt ? "Not sure yet" : "Clear";
    clear.hidden = !a && !opt;
  }

  function place(g) {
    var r = g.anchor.getBoundingClientRect();
    panel.hidden = false;
    panel.style.visibility = "hidden";
    var w = panel.offsetWidth, h = panel.offsetHeight;
    var left = Math.min(Math.max(8, r.left), window.innerWidth - w - 8);
    var below = r.bottom + 8, above = r.top - h - 8;
    var top = (below + h < window.innerHeight || above < 8) ? below : above;
    panel.style.left = Math.round(left + window.scrollX) + "px";
    panel.style.top = Math.round(top + window.scrollY) + "px";
    panel.style.visibility = "";
  }

  function show(g, field) {
    build();
    open = g;
    g.field = field;
    var from = parse(g.start.value) || parse(g.start.getAttribute("min")) || new Date();
    g.month = new Date(from.getFullYear(), from.getMonth(), 1);
    paint();
    place(g);
    panel.classList.toggle("dr-single", !g.range);
    var sel = panel.querySelector(".dr-a") || panel.querySelector(".dr-day:not([disabled])");
    if (sel) sel.focus();
  }

  function close(back) {
    if (!panel || panel.hidden) return;
    panel.hidden = true;
    if (back && open) (open.field === "end" && open.endBtn ? open.endBtn : open.startBtn).focus();
    open = null;
  }

  function btnText(input, other, isEnd) {
    if (!input.value) return isEnd ? "Add date" : "Add date";
    var t = label(input.value);
    if (isEnd && other && other.value) {
      var n = nights(parse(other.value), parse(input.value));
      if (n > 0) t += "  \u00b7  " + n + (n === 1 ? " night" : " nights");
    }
    return t;
  }
  function paintButtons(g) {
    g.startBtn.textContent = btnText(g.start, null, false);
    g.startBtn.classList.toggle("dr-set", !!g.start.value);
    if (g.endBtn) {
      g.endBtn.textContent = btnText(g.end, g.start, true);
      g.endBtn.classList.toggle("dr-set", !!g.end.value);
    }
  }

  function button(input, group, field) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "dr-btn";
    b.setAttribute("aria-haspopup", "dialog");
    input.parentNode.insertBefore(b, input);
    input.type = "hidden";
    b.addEventListener("click", function (ev) {
      ev.stopPropagation();
      if (open === group && !panel.hidden && group.field === field) return close();
      show(group, field);
    });
    return b;
  }

  /* The calendar glyph beside the field was decoration. It looks like a control, so people tap it,
     and it should do what tapping the field does. One that sits in the same box as a single input
     opens that field; one shared by a pair (the front page card has a single glyph for check in and
     check out) opens the arrival. */
  function wireIcon(g, field, box) {
    var svg = box ? box.querySelector("svg") : null;
    if (!svg || svg.getAttribute("data-dr-icon")) return false;
    svg.setAttribute("data-dr-icon", "1");
    svg.style.pointerEvents = "auto";
    svg.addEventListener("click", function (ev) {
      /* preventDefault matters: where the glyph sits inside the field's <label>, the browser would
         forward the click to the button as well, which would open the panel and shut it again */
      ev.preventDefault();
      ev.stopPropagation();
      show(g, field);
    });
    return true;
  }
  /* the nearest box above the control that holds a glyph, without straying into another field */
  function iconBox(btn) {
    var el = btn.parentNode;
    for (var i = 0; i < 4 && el && el !== document.body; i++) {
      if (el.querySelector("svg")) return el;
      el = el.parentNode;
    }
    return null;
  }

  function enhance() {
    var starts = [].slice.call(document.querySelectorAll('[data-dr="start"], [data-dr="single"]'));
    starts.forEach(function (start) {
      if (start.getAttribute("data-dr-on")) return;
      start.setAttribute("data-dr-on", "1");
      var pairSel = start.getAttribute("data-dr-pair");
      var end = pairSel ? document.querySelector(pairSel) : null;
      if (end) end.setAttribute("data-dr-on", "1");
      /* nobody books yesterday. A field that sets no floor of its own gets today. */
      if (!start.getAttribute("min")) start.setAttribute("min", iso(new Date()));
      var g = { start: start, end: end, range: !!end, optional: start.hasAttribute("data-dr-optional") };
      g.startBtn = button(start, g, "start");
      if (end) g.endBtn = button(end, g, "end");
      g.anchor = (start.closest(".hq-dates, .dates-grid, .grid2, .tr-row, .pf, .qf") || start.parentNode);
      /* a glyph in the field's own box belongs to that field; one shared by a pair opens the arrival */
      var own = wireIcon(g, "start", g.startBtn.parentNode) | (end ? wireIcon(g, "end", g.endBtn.parentNode) : 0);
      if (!own) wireIcon(g, "start", iconBox(g.startBtn));
      paintButtons(g);
      /* something else on the page can still write to the field: the transfers picker fills both
         dates straight out of the URL. Repaint when it does. */
      [start, end].forEach(function (i) { if (i) i.addEventListener("change", function () { if (!open) paintButtons(g); }); });
    });
  }

  function init() {
    enhance();
    document.addEventListener("click", function (ev) { if (open && !panel.contains(ev.target) && !ev.target.closest(".dr-btn")) close(); });
    window.addEventListener("resize", function () { if (open) place(open); });
    window.addEventListener("scroll", function () { if (open) place(open); }, true);
    document.addEventListener("keydown", function (ev) { if (ev.key === "Escape" && open) close(true); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
  window.GV_DATES = { refresh: enhance };
})();

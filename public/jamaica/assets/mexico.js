/* Desde México (/jamaica/mexico/): the nights chips reprice every resort card and its WhatsApp message, and the
   quote form nudges toward flight days. Prices live on each card (data-p3, data-u3 ...), built from the same numbers
   as the page; window.GV_MX carries the rest. */
(function () {
  "use strict";
  var X = window.GV_MX;
  if (!X) return;
  var $ = function (s, r) { return (r || document).querySelector(s); }, $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var fmt = function (n) { return Number(n).toLocaleString("en-US"); };
  var track = function (n, p) { try { if (window.gtag) gtag("event", n, p || {}); } catch (e) {} };
  var waLink = function (lines) { return X.wa + "?text=" + encodeURIComponent([X.intro].concat(lines.filter(Boolean)).concat(["Ref " + X.ref]).join("\n")); };

  /* cards stay cheapest first: re-sorted by the price for the chosen nights (ties keep the page order) */
  var box = $(".mx-cards");
  $$(".dc-mx").forEach(function (c, i) { c.setAttribute("data-i", i); });
  function sortCards(n) {
    if (!box) return;
    $$(".dc-mx", box).map(function (c) { return [c, +c.getAttribute("data-p" + n), +c.getAttribute("data-u" + n), +c.getAttribute("data-i")]; })
      .sort(function (a, b) { return a[1] - b[1] || a[2] - b[2] || a[3] - b[3]; })
      .forEach(function (x) { box.appendChild(x[0]); });
    box.scrollLeft = 0;
  }

  var nb = $("#mx-nights");
  if (nb) {
    $$("button", nb).forEach(function (b) {
      b.addEventListener("click", function () {
        var n = b.getAttribute("data-n");
        $$("button", nb).forEach(function (o) { o.setAttribute("aria-pressed", o === b ? "true" : "false"); });
        $$(".dc-mx").forEach(function (c) {
          $(".mx-p", c).textContent = "$" + fmt(c.getAttribute("data-p" + n));
          $(".mx-u", c).textContent = "US$" + fmt(c.getAttribute("data-u" + n));
          $(".mx-n", c).textContent = n;
          c.href = waLink(["Resort: " + c.getAttribute("data-name"), "Noches: " + n + " (" + (X.nightsHint[n] || "") + ")", "Con vuelo desde la CDMX"]);
        });
        sortCards(n);
        track("mx_nights", { n: n });
      });
    });
  }

  /* the form: dates from the first flight, and a nudge when a date has no flight */
  var fin = $("#j-in"), fout = $("#j-out"), hint = $("#mx-dayhint");
  var isFlightDay = function (iso) { return X.flightDays.indexOf(new Date(iso + "T00:00:00Z").getUTCDay()) !== -1; };
  function checkDays() {
    if (!hint) return;
    var bad = [fin, fout].filter(function (f) { return f && f.value && !isFlightDay(f.value); });
    hint.textContent = hint.getAttribute(bad.length ? "data-warn" : "data-ok");
    hint.classList.toggle("warn", !!bad.length);
  }
  if (fin) {
    var min = X.start;
    try { var t = new Date(); t.setMinutes(t.getMinutes() - t.getTimezoneOffset()); var td = t.toISOString().slice(0, 10); if (td > min) min = td; } catch (e) {}
    fin.min = min; if (fout) fout.min = min;
    fin.addEventListener("change", checkDays);
    if (fout) fout.addEventListener("change", checkDays);
  }
})();

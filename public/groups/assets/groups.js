/* Golden Vacation & Travel — Groups. Dependency-free. Currency toggle shares the site's gv_currency setting. */
(function () {
  "use strict";
  var CFG = window.GV_GROUPS || {};
  var RATE = CFG.jmdRate || 160;
  var HOLD_USD = CFG.holdUsd || 95, HOLD_JMD = CFG.holdJmd || 15000;

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function track(name, params) { try { if (typeof window.gtag === "function") window.gtag("event", name, params || {}); } catch (e) {} }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function b64(s) { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
  function unb64(s) { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return decodeURIComponent(escape(atob(s))); }
  function sstore(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } }

  /* ---- currency ---- */
  var currency = "USD";
  function setCurrency(c, save) {
    currency = c;
    document.body.classList.toggle("jmd", c === "JMD");
    $$(".curr button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-c") === c); });
    if (save) store("gv_currency", c);
    var cur = $("#f-currency"); if (cur) cur.value = c === "JMD" ? "J$" : "US$";
    repaintSum();
  }
  $$(".curr button").forEach(function (b) {
    b.addEventListener("click", function () { setCurrency(b.getAttribute("data-c"), true); track("currency_toggle", { currency: b.getAttribute("data-c") }); });
  });
  var savedC = store("gv_currency");
  if (savedC === "JMD" || savedC === "USD") setCurrency(savedC, false);

  /* ---- phone menu ---- */
  var menuBtn = $(".menu-btn"), menu = $(".g-menu");
  if (menuBtn && menu) {
    menuBtn.addEventListener("click", function () {
      var open = !menu.classList.contains("open");
      menu.classList.toggle("open", open);
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    $$("a", menu).forEach(function (a) { a.addEventListener("click", function () { menu.classList.remove("open"); menuBtn.setAttribute("aria-expanded", "false"); }); });
  }

  /* ---- hub: which button was clicked ---- */
  $$("[data-track]").forEach(function (a) {
    a.addEventListener("click", function () { track("groups_cta", { where: a.getAttribute("data-track") }); });
  });

  /* ---- sticky Quote me on phones, once the tiles have scrolled away ---- */
  var sticky = $("#sticky-cta"), tiles = $(".tiles");
  if (sticky && tiles && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      var past = entries[0].boundingClientRect.bottom < 0;
      sticky.hidden = !past; document.body.classList.toggle("has-sticky", past && window.innerWidth < 900);
    }, { threshold: 0 });
    io.observe(tiles);
  }

  /* ---- swipe dots on the phone trips row ---- */
  var row = $(".dests");
  if (row) {
    var dots = $$(".dots i");
    row.addEventListener("scroll", function () {
      var i = Math.round(row.scrollLeft / (row.scrollWidth / Math.max(1, row.children.length)));
      dots.forEach(function (d, k) { d.classList.toggle("on", k === i); });
    }, { passive: true });
  }

  /* ---- the form ---- */
  var form = $("#gform");
  function repaintSum() {
    var sum = $("#seat-sum"); if (!sum || !form) return;
    var seats = Number(($("[name=ready_now]", form) || {}).value || 0);
    var isJ = currency === "JMD";
    var each = isJ ? HOLD_JMD : HOLD_USD, sym = isJ ? "J$" : "US$";
    $("b", sum).textContent = seats + " × " + sym + fmt(each) + " = " + sym + fmt(seats * each);
    $("span", sum).textContent = (seats ? "to hold " + seats + " spot" + (seats === 1 ? "" : "s") + " now. " : "to hold spots now. ") + "Your group pays you, you pay us once. Each hold comes off that person's deposit later.";
  }
  function fmtDate(s) {
    if (!s) return "";
    var d = new Date(s + "T00:00:00"); if (isNaN(d)) return s;
    return d.getDate() + " " + ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()] + " " + d.getFullYear();
  }
  if (form) {
    /* reference number: shown on the sent page and in the email subject */
    var ref = sstore("gv_groups_ref");
    if (!ref) {
      var alpha = "23456789ABCDEFGHJKMNPQRSTUVWXYZ", r = "";
      for (var i = 0; i < 4; i++) r += alpha.charAt(Math.floor(Math.random() * alpha.length));
      ref = "GV-GRP-" + r;
      sstore("gv_groups_ref", ref);
    }
    $("#f-ref").value = ref;

    /* dates cannot be in the past */
    var today = new Date(); today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
    var iso = today.toISOString().slice(0, 10);
    $$("input[type=date]", form).forEach(function (d) { d.min = iso; });

    /* branch and screens */
    var branches = $$("fieldset[data-branch]", form), screens = $$(".screen", form), cur = 1;
    function branchOf() { var c = $("input[name=branch]:checked", form); return c ? c.value : "groups"; }
    function scopeOf(el) { return el.closest("fieldset[data-branch]") || form; }
    function valueOf(name, scope) {
      var els = $$("[name=\"" + name + "\"]", scope).filter(function (x) { var f = x.closest("fieldset[data-branch]"); return !f || !f.disabled; });
      if (!els.length && scope !== form) els = $$("[name=\"" + name + "\"]", form).filter(function (x) { var f = x.closest("fieldset[data-branch]"); return !f || !f.disabled; });
      if (!els.length) return "";
      var el = els[0];
      if (el.type === "radio") { var c = els.filter(function (x) { return x.checked; })[0]; return c ? c.value : ""; }
      if (el.type === "checkbox") return el.checked ? "Yes" : "";
      return (el.value || "").trim();
    }
    function labelOf(name, scope) {
      var els = $$("[name=\"" + name + "\"]", scope).filter(function (x) { var f = x.closest("fieldset[data-branch]"); return !f || !f.disabled; });
      var el = els[0]; if (!el) return "";
      if (el.type === "radio") { var c = els.filter(function (x) { return x.checked; })[0]; return c ? (c.getAttribute("data-label") || c.value) : ""; }
      return valueOf(name, scope);
    }
    var norm = function (s) { return String(s || "").trim().toLowerCase(); };

    /* conditional rows: data-show="field:a|b", "field:!a|b" (not one of), "field:~x" (ticked), "field:>0"; hotel cards per destination */
    function applyShows() {
      $$("[data-show], [data-hotels-for]", form).forEach(function (box) {
        var scope = scopeOf(box), spec = box.getAttribute("data-show") || ("place:" + box.getAttribute("data-hotels-for"));
        var name = spec.split(":")[0], cond = spec.slice(name.length + 1), v = valueOf(name, scope), on;
        if (cond.charAt(0) === ">") on = Number(v || 0) > Number(cond.slice(1));
        else if (cond.charAt(0) === "<") on = v !== "" && Number(v) < Number(cond.slice(1));
        else if (cond.charAt(0) === "~") { var have = v.split(",").map(norm), want = cond.slice(1).split("|").map(norm); on = want.some(function (w) { return have.indexOf(w) > -1; }); }
        else if (cond.charAt(0) === "!") on = !!v && cond.slice(1).split("|").map(norm).indexOf(norm(v)) === -1;
        else on = cond.split("|").map(norm).indexOf(norm(v)) > -1;
        box.hidden = !on;
      });
      $$("input, select, textarea", form).forEach(function (el) {
        var fs = el.closest("fieldset[data-branch]");
        if (fs && fs.disabled) return;
        var off = false, p = el.parentElement;
        while (p && p !== form) { if (p.hidden && (p.hasAttribute("data-show") || p.hasAttribute("data-hotels-for") || p.hasAttribute("data-branches"))) { off = true; break; } p = p.parentElement; }
        el.disabled = off;
      });
    }
    function showBranch() {
      var b = branchOf();
      branches.forEach(function (f) { var on = f.getAttribute("data-branch") === b; f.hidden = !on; f.disabled = !on; });
      $$("[data-branches]", form).forEach(function (box) { var on = box.getAttribute("data-branches").split(",").indexOf(b) > -1; box.hidden = !on; $$("input, select, textarea", box).forEach(function (i) { i.disabled = !on; }); });
      applyShows(); repaintSum(); repaintBrief(); paintRadios();
    }
    $$("input[name=branch]", form).forEach(function (r) { r.addEventListener("change", showBranch); });

    function goTo(n) {
      cur = Math.max(1, Math.min(screens.length, n));
      screens.forEach(function (s) { s.hidden = Number(s.getAttribute("data-screen")) !== cur; });
      $$(".progress i", form).forEach(function (d) { d.classList.toggle("on", Number(d.getAttribute("data-dot")) <= cur); });
      var top = form.getBoundingClientRect().top + window.pageYOffset - 84;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      var first = $(".screen:not([hidden]) input:not([type=hidden]):not([disabled]), .screen:not([hidden]) select:not([disabled]), .screen:not([hidden]) button.chip", form);
      if (first && window.innerWidth >= 900) setTimeout(function () { try { first.focus({ preventScroll: true }); } catch (e) {} }, 350);
      track("groups_form_screen", { screen: cur });
    }
    $$("[data-next]", form).forEach(function (b) { b.addEventListener("click", function () { if (validateScreen(cur)) goTo(cur + 1); }); });
    $$("[data-back]", form).forEach(function (b) { b.addEventListener("click", function () { goTo(cur - 1); }); });
    form.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && e.target && e.target.tagName !== "TEXTAREA" && !e.target.closest("[data-tags]")) {
        e.preventDefault(); if (cur < screens.length) { if (validateScreen(cur)) goTo(cur + 1); } else { form.requestSubmit ? form.requestSubmit() : $("button[type=submit]", form).click(); }
      }
    });

    /* chips → hidden input */
    $$(".chips[data-chips]", form).forEach(function (group) {
      var name = group.getAttribute("data-chips"), multi = group.getAttribute("data-multi") === "true";
      var input = $("input[name=\"" + name + "\"]", group.parentNode);
      $$(".chip", group).forEach(function (chip) {
        chip.addEventListener("click", function () {
          var on = chip.getAttribute("aria-pressed") === "true";
          if (multi) { chip.setAttribute("aria-pressed", on ? "false" : "true"); }
          else { $$(".chip", group).forEach(function (c) { c.setAttribute("aria-pressed", "false"); }); chip.setAttribute("aria-pressed", "true"); }
          if (input) {
            input.value = $$(".chip[aria-pressed=true]", group).map(function (c) { return c.getAttribute("data-value") || c.textContent.trim(); }).join(", ");
            input.dispatchEvent(new Event("change", { bubbles: true }));
          }
          group.classList.remove("missing"); var q = group.closest(".q"); if (q) q.classList.remove("missing");
        });
      });
    });

    /* search-as-you-type picker for places and hotels: one list, works the same on every phone */
    $$("input[list]", form).forEach(function (input) {
      var listEl = document.getElementById(input.getAttribute("list")); if (!listEl) return;
      var options = $$("option", listEl).map(function (o) { return o.value; });
      input.removeAttribute("list"); input.setAttribute("role", "combobox"); input.setAttribute("aria-autocomplete", "list"); input.setAttribute("aria-expanded", "false");
      var wrap = document.createElement("div"); wrap.className = "combo"; input.parentNode.insertBefore(wrap, input); wrap.appendChild(input);
      var menu = document.createElement("div"); menu.className = "combo-menu"; menu.setAttribute("role", "listbox"); menu.hidden = true; wrap.appendChild(menu);
      var active = -1, shown = [];
      function close() { menu.hidden = true; input.setAttribute("aria-expanded", "false"); active = -1; }
      function pick(v) { input.value = v; input.dataset.picked = "1"; input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true })); close(); }
      function open() {
        var q = norm(input.value);
        shown = options.filter(function (o) { return !q || norm(o).indexOf(q) > -1; }).slice(0, 8);
        menu.innerHTML = "";
        if (!shown.length) { close(); return; }
        shown.forEach(function (o, i) {
          var d = document.createElement("div"); d.className = "combo-item"; d.setAttribute("role", "option"); d.textContent = o;
          d.addEventListener("mousedown", function (e) { e.preventDefault(); pick(o); });
          menu.appendChild(d);
        });
        menu.hidden = false; input.setAttribute("aria-expanded", "true"); active = -1;
      }
      function paintActive() { $$(".combo-item", menu).forEach(function (d, i) { d.classList.toggle("on", i === active); }); }
      input.addEventListener("input", function () { if (input.dataset.picked === "1") { delete input.dataset.picked; return; } open(); });
      input.addEventListener("focus", function () { if (input.value) open(); });
      input.addEventListener("blur", function () { setTimeout(close, 120); });
      input.addEventListener("keydown", function (e) {
        if (menu.hidden) return;
        if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(shown.length - 1, active + 1); paintActive(); }
        else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(0, active - 1); paintActive(); }
        else if (e.key === "Enter" && active > -1) { e.preventDefault(); e.stopPropagation(); pick(shown[active]); }
        else if (e.key === "Escape") { close(); }
      }, true);
    });

    /* type one, add another: hotels */
    $$("[data-tags]", form).forEach(function (box) {
      var input = $(".tag-add input", box), add = $("[data-tag-add]", box), list = $(".tags", box), hidden = $("input[type=hidden]", box), items = [];
      function paint() {
        list.innerHTML = "";
        items.forEach(function (it, i) {
          var t = document.createElement("span"); t.className = "tag"; t.textContent = it;
          var x = document.createElement("button"); x.type = "button"; x.className = "tag-x"; x.setAttribute("aria-label", "Remove " + it); x.textContent = "×";
          x.addEventListener("click", function () { items.splice(i, 1); paint(); });
          t.appendChild(x); list.appendChild(t);
        });
        hidden.value = items.join(", ");
        hidden.dispatchEvent(new Event("change", { bubbles: true }));
      }
      function addOne() {
        (input.value || "").split(/[,;\n]+/).forEach(function (part) { var v = part.replace(/^[\s,.;]+|[\s,.;]+$/g, ""); if (v && items.map(norm).indexOf(norm(v)) === -1) items.push(v); });
        input.value = ""; paint(); input.focus();
      }
      hidden.addEventListener("restore", function () { items = hidden.value.split(",").map(function (x) { return x.trim(); }).filter(Boolean); paint(); });
      add.addEventListener("click", addOne);
      input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); addOne(); } });
      input.addEventListener("blur", function () { if ((input.value || "").trim()) addOne(); });
    });

    /* flexible dates: reveal up to three more ranges */
    $$("[data-alt-add]", form).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var box = btn.parentElement, rows = $$("[data-alt]", box), next = rows.filter(function (r) { return r.hidden; })[0];
        if (next) { next.hidden = false; var i = $("input", next); if (i) i.focus(); }
        if (!rows.some(function (r) { return r.hidden; })) btn.hidden = true;
      });
    });
    function paintRadios() { $$(".radio-card", form).forEach(function (c) { var i = $("input[type=radio]", c); c.classList.toggle("checked", !!(i && i.checked)); }); }

    form.addEventListener("change", function (e) {
      if (e.target && e.target.type === "radio") paintRadios();
      applyShows();
      if (e.target && e.target.name === "ready_now") repaintSum();
      if (e.target) { e.target.removeAttribute("aria-invalid"); var q = e.target.closest(".q, .field, .numbox"); if (q) q.classList.remove("missing"); }
      repaintBrief();
    });
    form.addEventListener("input", function (e) {
      if (!e.target) return;
      if (e.target.name === "place") applyShows();
      if (/^(name|email|ready_now|adults|children|org_name|place)$/.test(e.target.name)) { if (e.target.name === "ready_now") repaintSum(); repaintBrief(); }
    });

    /* the brief: what our travel professionals read first */
    function n(name, fs) { return Number(valueOf(name, fs) || 0); }
    function roomsLine(fs) {
      var parts = [];
      [["r_double", "double"], ["r_single", "single"], ["r_triple", "triple"], ["r_quad", "quad"]].forEach(function (p) { var c = n(p[0], fs); if (c) parts.push(c + " " + p[1] + (c === 1 ? "" : "s")); });
      return parts.join(", ");
    }
    function peopleLine(fs) {
      var a = n("adults", fs), c = n("children", fs), ages = valueOf("child_ages", fs);
      var s = a ? a + " adult" + (a === 1 ? "" : "s") : "";
      if (c) s += (s ? ", " : "") + c + " child" + (c === 1 ? "" : "ren") + (ages ? " (" + ages + ")" : "");
      return s;
    }
    function lines() {
      var b = branchOf(), fs = $("fieldset[data-branch=\"" + b + "\"]", form), out = [];
      var pl = peopleLine(form), rl = roomsLine(form), hotelsV = valueOf("hotels", form), tier = valueOf("tier", form), org = valueOf("org_name", form), placeV = valueOf("place", form);
      if (b === "groups") {
        var kind = valueOf("org_type", form);
        out.push(["You are", "booking rooms for " + (org || (kind ? "a " + kind.toLowerCase() + " group" : "a group"))]);
        var areaV = valueOf("area", form); if (areaV) out.push(["Where", areaV]);
        var ci = valueOf("checkin", form), co = valueOf("checkout", form);
        if (ci || co) out.push(["Dates", fmtDate(ci) + " to " + fmtDate(co) + (valueOf("dates_flex", form) ? " (can move)" : "")]);
        if (pl) out.push(["People", pl]);
        if (rl) out.push(["Rooms", rl]);
        if (hotelsV) out.push(["Hotels", hotelsV]);
        if (tier) out.push(["Style", tier.toLowerCase()]);
        if (valueOf("meeting", form) === "Yes") out.push(["Meeting room", (n("meeting_capacity", form) || "?") + " people, " + (n("meeting_days", form) || "?") + " day" + (n("meeting_days", form) === 1 ? "" : "s") + (valueOf("catering", form) ? ", " + valueOf("catering", form).toLowerCase() : "")]);
      } else if (b === "overseas") {
        var occ = valueOf("occasion", form);
        out.push(["You are", "bringing your people to Jamaica" + (occ ? " for a " + occ.toLowerCase() : "") + (org ? " (" + org + ")" : "")]);
        var ar = valueOf("arrival", form), dp = valueOf("departure", form);
        if (ar || dp) out.push(["Dates", fmtDate(ar) + " to " + fmtDate(dp) + (valueOf("staggered", form) ? " (some on other days)" : "")]);
        var ai = valueOf("airport_in", form); if (ai) out.push(["Flying into", ai]);
        if (placeV) out.push(["Where", placeV]);
        if (hotelsV) out.push(["Hotels", hotelsV]);
        if (tier) out.push(["Style", tier.toLowerCase()]);
        if (pl) out.push(["People", pl]);
        if (rl) out.push(["Rooms", rl]);
        var cf = valueOf("coming_from", form); if (cf) out.push(["Coming from", cf]);
      } else {
        var role = valueOf("role", form);
        out.push(["You are", (role ? role.toLowerCase() : "a group leader") + (org ? ", " + org : "") + ", taking a group abroad"]);
        var hotel = labelOf("hotel", form);
        if (placeV || hotel) out.push(["Where", (placeV || "not chosen yet") + (hotel ? ", " + hotel + (/pick/i.test(hotel) && tier ? " (" + tier.toLowerCase() + ")" : "") : "")]);
        var de = valueOf("depart", form), rt = valueOf("return", form);
        if (de || rt) out.push(["Dates", fmtDate(de) + " to " + fmtDate(rt) + (valueOf("dates_flex", form) ? " (can move)" : "")]);
        var ap = valueOf("airport", form); if (ap) out.push(["Flying from", ap]);
        if (pl) out.push(["People", pl]);
        if (rl) out.push(["Rooms", rl]);
        var seats = n("ready_now", form);
        if (seats) out.push(["Ready to book now", seats + ", holding " + (currency === "JMD" ? "J$" + fmt(seats * HOLD_JMD) : "US$" + fmt(seats * HOLD_USD))]);
      }
      var alts = [1, 2, 3].map(function (i) { var a = valueOf("alt" + i + "_from", form), z = valueOf("alt" + i + "_to", form); return a || z ? fmtDate(a) + " to " + fmtDate(z) : ""; }).filter(Boolean);
      if (alts.length) out.push(["Other dates", alts.join("; ")]);
      var inv = valueOf("invoice", form); if (inv) out.push(["Invoice", inv.toLowerCase()]);
      var st = valueOf("status", form); if (st) out.push(["Status", st.toLowerCase()]);
      var qb = valueOf("quote_by", form); if (qb) out.push(["Quote by", fmtDate(qb)]);
      var dec = valueOf("decides", form); if (dec && !/i decide/i.test(dec)) out.push(["Booking", dec.toLowerCase()]);
      out.push(["Quote to", valueOf("email", form) || "[your email]"]);
      return out;
    }
    function repaintBrief() {
      var boxes = [$("#brief-box"), $("#brief-final")].filter(Boolean); if (!boxes.length) return;
      var ls = lines();
      boxes.forEach(function (box) {
        box.innerHTML = "";
        ls.forEach(function (l) {
          var s = document.createElement("span"), bb = document.createElement("b");
          bb.textContent = l[0] + " "; s.appendChild(bb); s.appendChild(document.createTextNode(l[1])); box.appendChild(s);
        });
      });
      var subj = $("#f-subject");
      if (subj) {
        var b = branchOf();
        var bits = [b === "groups" ? "Rooms" : b === "overseas" ? "Overseas" : "Trip abroad"];
        var where = valueOf("place", form) || valueOf("area", form) || (valueOf("hotels", form) || "").split(",")[0].trim(); if (where) bits.push(where);
        var d1 = b === "groups" ? valueOf("checkin", form) : b === "overseas" ? valueOf("arrival", form) : valueOf("depart", form);
        var d2 = b === "groups" ? valueOf("checkout", form) : b === "overseas" ? valueOf("departure", form) : valueOf("return", form);
        if (d1) bits.push(fmtDate(d1) + (d2 ? " to " + fmtDate(d2) : ""));
        var rooms = ["r_double", "r_single", "r_triple", "r_quad"].reduce(function (t, k) { return t + n(k, form); }, 0);
        if (rooms) bits.push(rooms + " rooms"); else if (n("adults", form)) bits.push(n("adults", form) + " adults");
        bits.push(ref);
        subj.value = "Group quote · " + bits.join(" · ");
      }
    }

    /* keep answers if they leave and come back (same browser, 24 hours) */
    var SAVE_KEY = "gv_groups_draft";
    function snapshot() {
      var o = {};
      $$("input, select, textarea", form).forEach(function (el) {
        if (!el.name || /^(form-name|subject|ref|currency|bot-field)$/.test(el.name)) return;
        var fs = el.closest("fieldset[data-branch]"), k = (fs ? fs.getAttribute("data-branch") : "all") + ":" + el.name;
        if (el.type === "radio") { if (el.checked) o[k] = el.value; }
        else if (el.type === "checkbox") { o[k] = el.checked ? "Yes" : ""; }
        else if (!(k in o) || el.value) o[k] = el.value;
      });
      return o;
    }
    function saveDraft() { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ at: Date.now(), screen: cur, v: snapshot() })); } catch (e) {} }
    function restoreDraft() {
      var raw = store(SAVE_KEY); if (!raw) return false;
      var d; try { d = JSON.parse(raw); } catch (e) { return false; }
      if (!d || !d.v || Date.now() - d.at > 86400000) return false;
      var v = d.v, any = false; restoreDraft.screen = d.screen || 1;
      Object.keys(v).forEach(function (k) {
        var parts = k.split(":"), br = parts[0], name = parts.slice(1).join(":"), val = v[k];
        var scopes = br === "all" ? [form] : $$("fieldset[data-branch=\"" + br + "\"]", form); if (!scopes.length) return;
        scopes.forEach(function (scope) { $$("[name=\"" + name + "\"]", scope).forEach(function (el) {
          if (br === "all" && el.closest("fieldset[data-branch]")) return;
          if (el.type === "radio") { el.checked = el.value === val; if (el.checked) any = true; }
          else if (el.type === "checkbox") { el.checked = val === "Yes"; }
          else { el.value = val; if (val) any = true; }
        }); });
      });
      /* chips and tags follow their hidden inputs */
      $$(".chips[data-chips]", form).forEach(function (group) {
        var input = $("input[name=\"" + group.getAttribute("data-chips") + "\"]", group.parentNode); if (!input) return;
        var have = (input.value || "").split(",").map(norm);
        $$(".chip", group).forEach(function (c) { c.setAttribute("aria-pressed", have.indexOf(norm(c.getAttribute("data-value") || c.textContent)) > -1 ? "true" : "false"); });
      });
      $$("[data-tags]", form).forEach(function (box) { var hid = $("input[type=hidden]", box); if (hid && hid.value) { hid.dispatchEvent(new Event("restore")); } });
      return any;
    }
    form.addEventListener("change", saveDraft);
    form.addEventListener("input", saveDraft);

    /* deep links from the hub: ?branch=trips&dest=Panama%20City&hotel=Megapolis */
    var restored = !location.search && restoreDraft();
    var params = new URLSearchParams(location.search);
    var pb = params.get("branch");
    if (pb && $("input[name=branch][value=\"" + pb + "\"]", form)) $("input[name=branch][value=\"" + pb + "\"]", form).checked = true;
    showBranch();
    var pd = params.get("dest"), tfs = $("fieldset[data-branch=trips]", form);
    if (pd && tfs) { var pi = $("input[name=place]", tfs); if (pi) { pi.value = pd; applyShows(); } }
    var ph = params.get("hotel");
    if (ph && tfs) { var hr = $("input[name=hotel][value=\"" + ph + "\"]", tfs); if (hr) { hr.checked = true; applyShows(); paintRadios(); } }
    repaintBrief();
    if (pb && pb !== "groups" || pd) goTo(2);
    else if (restored && restoreDraft.screen > 1) { paintRadios(); applyShows(); repaintBrief(); goTo(Math.min(restoreDraft.screen, screens.length)); }

    /* what we cannot quote without, one screen at a time */
    function hiddenWithin(el, root) { var p = el.parentElement; while (p && p !== root) { if (p.hidden) return true; p = p.parentElement; } return false; }
    function labelText(lab) { if (!lab) return ""; if (lab.getAttribute("data-label")) return lab.getAttribute("data-label"); var t = ""; for (var k = 0; k < lab.childNodes.length; k++) { var nd = lab.childNodes[k]; if (nd.nodeType === 3) t += nd.textContent; else if (nd.nodeType === 1 && !nd.classList.contains("req") && !nd.classList.contains("hint")) t += nd.textContent; } return t.replace(/\*/g, "").trim(); }
    function missingIn(scr) {
      var out = [], b = branchOf();
      function push(el, label) { out.push({ el: el, label: label }); }
      function live(el) { var f = el.closest("fieldset[data-branch]"); if (f && f.getAttribute("data-branch") !== b) return false; return !hiddenWithin(el, scr); }
      $$("[data-req]", scr).forEach(function (el) {
        if (!live(el)) return;
        if (el.classList.contains("chips")) {
          var hid = $("input[name=\"" + el.getAttribute("data-chips") + "\"]", el.parentNode);
          if (!hid || !hid.value) { el.classList.add("missing"); push(el, labelText($(".ql", el.parentNode)) || el.getAttribute("data-chips")); }
          return;
        }
        var v = (el.value || "").trim(), ok = !!v;
        if (el.type === "email") ok = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
        if (el.type === "number") ok = v !== "" && Number(v) >= Number(el.min || 0);
        if (!ok) {
          el.setAttribute("aria-invalid", "true");
          var wrap = el.closest(".field, .numbox, .q"); if (wrap) wrap.classList.add("missing");
          var lab = wrap ? ($("label", wrap) || $(".ql", wrap) || $("span", wrap)) : null;
          push(el, labelText(lab) || el.name);
        }
      });
      $$(".q", scr).forEach(function (q) {
        if (!live(q) || !$(".ql .req", q) || !$("input[type=radio]", q)) return;
        var rs = $$("input[type=radio]", q).filter(function (x) { return !x.disabled; });
        if (rs.length && !rs.some(function (x) { return x.checked; })) { q.classList.add("missing"); push(q, $(".ql", q).getAttribute("data-label")); }
      });
      if (b === "groups") {
        var hot = $("fieldset[data-branch=groups] input[name=hotels]", scr), ar = $("fieldset[data-branch=groups] input[name=area]", scr);
        if (hot && ar && live(ar) && !hot.value && !(ar.value || "").trim()) { ar.setAttribute("aria-invalid", "true"); var w2 = ar.closest(".field"); if (w2) w2.classList.add("missing"); push(ar, "a hotel or an area or town"); }
      }
      $$("[data-rooms-req]", scr).forEach(function (q) {
        if (!live(q)) return;
        var total = $$("input[type=number]", q).reduce(function (t, i) { return t + Number(i.value || 0); }, 0);
        if (!total) { q.classList.add("missing"); push(q, "Rooms by type"); }
      });
      [["checkin", "checkout"], ["arrival", "departure"], ["depart", "return"]].forEach(function (p) {
        var a = $("[name=\"" + p[0] + "\"]", scr), bEl = $("[name=\"" + p[1] + "\"]", scr);
        if (a && bEl && live(bEl) && a.value && bEl.value && bEl.value <= a.value) { bEl.setAttribute("aria-invalid", "true"); push(bEl, "the second date after the first"); }
      });
      if (b === "trips") { var ad = $("fieldset[data-branch=trips] [name=adults]", scr); if (ad && live(ad) && ad.value && Number(ad.value) < 10) { ad.setAttribute("aria-invalid", "true"); push(ad, "ten adults or more for a group rate (under ten, message us on WhatsApp)"); } }
      var seen = {}; return out.filter(function (m) { if (seen[m.label]) return false; seen[m.label] = 1; return true; });
    }
    function validateScreen(k) {
      var scr = $(".screen[data-screen=\"" + k + "\"]", form), err = $(".form-err", scr);
      $$(".missing", scr).forEach(function (x) { x.classList.remove("missing"); });
      $$("[aria-invalid]", scr).forEach(function (x) { x.removeAttribute("aria-invalid"); });
      var miss = missingIn(scr);
      if (!miss.length) { err.classList.remove("show"); return true; }
      err.textContent = "To quote this we still need: " + miss.map(function (m) { return m.label; }).join(", ") + ".";
      err.classList.add("show");
      var first = miss[0].el; first.scrollIntoView({ behavior: "smooth", block: "center" });
      if (first.focus && first.tagName !== "DIV") setTimeout(function () { try { first.focus({ preventScroll: true }); } catch (e) {} }, 300);
      return false;
    }

    /* submit: Netlify Forms by fetch, plain POST as the fallback */
    form.addEventListener("submit", function (e) {
      for (var k = 1; k <= screens.length; k++) { if (!validateScreen(k)) { e.preventDefault(); if (cur !== k) goTo(k); return; } }
      var briefNow = { ref: ref, branch: branchOf(), email: valueOf("email", form), lines: lines(), at: Date.now() };
      if (CFG.preview && CFG.sentUrl) { /* hosted preview: no Netlify, hand the brief over in the address */
        e.preventDefault(); try { localStorage.removeItem(SAVE_KEY); } catch (x) {}
        location.href = CFG.sentUrl + (CFG.sentUrl.indexOf("?") > -1 ? "&" : "?") + "ref=" + encodeURIComponent(ref) + "&b=" + b64(JSON.stringify(briefNow));
        return;
      }
      if (!window.fetch || !window.FormData) return; /* plain POST to Netlify, lands on /groups/sent/ */
      e.preventDefault();
      var btn = $("button[type=submit]", form); btn.disabled = true; btn.textContent = "Sending your brief";
      var data = new FormData(form);
      var body = new URLSearchParams();
      data.forEach(function (v, k) { body.append(k, v); });
      fetch(location.pathname, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() })
        .then(function (res) {
          if (!res.ok) throw new Error("status " + res.status);
          sstore("gv_groups_brief", JSON.stringify(briefNow));
          try { sessionStorage.removeItem("gv_groups_ref"); localStorage.removeItem(SAVE_KEY); } catch (x) {}
          track("groups_submit", { branch: briefNow.branch });
          location.href = CFG.base + "/sent/?ref=" + encodeURIComponent(ref);
        })
        .catch(function () {
          sstore("gv_groups_brief", JSON.stringify(briefNow));
          btn.disabled = false; btn.textContent = CFG.submitLabel || "Email me my quote";
          form.submit(); /* let Netlify handle it the plain way */
        });
    });
  }

  /* ---- sent page ---- */
  var sent = $("#sent");
  if (sent) {
    var q = new URLSearchParams(location.search), sref = q.get("ref"), raw = sstore("gv_groups_brief"), brief = null;
    try { brief = raw ? JSON.parse(raw) : null; } catch (e) { brief = null; }
    if (!brief && q.get("b")) { try { brief = JSON.parse(unb64(q.get("b"))); } catch (e) { brief = null; } }
    if (!sref && brief) sref = brief.ref;
    var refEl = $("#sent-ref");
    if (refEl) { if (sref) refEl.textContent = "Ref " + sref; else refEl.parentNode.hidden = true; }
    var box = $("#brief-box");
    if (box) {
      if (brief && brief.lines && brief.lines.length) {
        box.innerHTML = "";
        brief.lines.forEach(function (l) {
          var s = document.createElement("span"), b = document.createElement("b");
          b.textContent = l[0] + " "; s.appendChild(b); s.appendChild(document.createTextNode(l[1])); box.appendChild(s);
        });
      } else {
        box.closest(".brief").hidden = true;
      }
    }
  }
})();

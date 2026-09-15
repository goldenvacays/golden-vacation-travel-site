/* Hotel pages under /getaways: the photo strip and the full-screen viewer.
   Same behaviour as the tour pages (experiences.js initPhotos): native scroll-snap does the swiping, the dots and
   arrows follow, and tapping any photo opens the viewer at that photo. Data comes from window.GV_HOTEL: photos as [src1600, alt, src2400 or null].
   A "Room tour" badge on a room card (.lb-video, data-video / data-poster / data-title) plays a short clip in the same viewer: muted, looping, with the browser's controls. */
(function () {
  "use strict";
  var H = window.GV_HOTEL || {}; var photos = H.photos || [];
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function track(name, params) { try { if (window.gtag) window.gtag("event", name, params || {}); } catch (e) {} }
  var root = document;
  var openers = $$(".lb-open", root), players = $$(".lb-video", root);
  if (!(photos.length && openers.length) && !players.length) return;
  var box = null, cur = 0, opener = null, touchX = null;
  var strip = $("#hero-track", root), slides = strip ? $$(".hero-slide", strip) : [], dots = $$(".hero-dots button", root), sCur = 0, sTimer = null;
  function slideIdx() { return strip && strip.clientWidth ? Math.max(0, Math.min(slides.length - 1, Math.round(strip.scrollLeft / strip.clientWidth))) : 0; }
  function slideTo(i, instant) {
    if (!strip || slides.length < 2) return;
    i = ((i % slides.length) + slides.length) % slides.length;
    var left = i * strip.clientWidth;
    if (instant || !("scrollTo" in strip)) strip.scrollLeft = left; else strip.scrollTo({ left: left, behavior: "smooth" });
    markSlide(i);
  }
  function markSlide(i) { if (i === sCur) return; sCur = i; dots.forEach(function (d, j) { d.setAttribute("aria-selected", j === i ? "true" : "false"); }); }
  if (strip && slides.length > 1) {
    strip.addEventListener("scroll", function () { clearTimeout(sTimer); sTimer = setTimeout(function () { markSlide(slideIdx()); }, 80); }, { passive: true });
    dots.forEach(function (d) { d.addEventListener("click", function () { slideTo(+d.getAttribute("data-i")); }); });
    var pv = $(".hero-prev", root), nx = $(".hero-next", root);
    if (pv) pv.addEventListener("click", function () { slideTo(slideIdx() - 1); });
    if (nx) nx.addEventListener("click", function () { slideTo(slideIdx() + 1); });
    strip.addEventListener("keydown", function (e) { if (e.key === "ArrowRight") { slideTo(slideIdx() + 1); e.preventDefault(); } else if (e.key === "ArrowLeft") { slideTo(slideIdx() - 1); e.preventDefault(); } });
    window.addEventListener("resize", function () { slideTo(sCur, true); });
  }
  var SVG_X = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"></path></svg>';
  var SVG_ARROW = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="M13 6l6 6-6 6"></path></svg>';
  function build() {
    box = document.createElement("div");
    box.className = "lb"; box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-label", (H.name || "") + " photos"); box.hidden = true;
    box.innerHTML = '<button type="button" class="lb-x" aria-label="Close the photos">' + SVG_X + '</button>' +
      '<button type="button" class="lb-prev" aria-label="Previous photo">' + SVG_ARROW + '</button>' +
      '<figure class="lb-fig"><img class="lb-img" alt=""><video class="lb-vid" muted loop playsinline controls preload="none" hidden></video><figcaption class="lb-cap"><span class="lb-alt"></span><span class="lb-n"></span></figcaption></figure>' +
      '<button type="button" class="lb-next" aria-label="Next photo">' + SVG_ARROW + '</button>';
    document.body.appendChild(box);
    if (photos.length < 2) { $(".lb-prev", box).hidden = true; $(".lb-next", box).hidden = true; $(".lb-n", box).hidden = true; }
    $(".lb-vid", box).addEventListener("click", function (e) { e.stopPropagation(); });
    $(".lb-x", box).addEventListener("click", close);
    $(".lb-prev", box).addEventListener("click", function () { go(-1); });
    $(".lb-next", box).addEventListener("click", function () { go(1); });
    $(".lb-img", box).addEventListener("click", function (e) { if (photos.length < 2) return; var r = e.currentTarget.getBoundingClientRect(); go(e.clientX - r.left > r.width / 2 ? 1 : -1); });
    box.addEventListener("click", function (e) { if (e.target === box || e.target.classList.contains("lb-fig")) close(); });
    box.addEventListener("touchstart", function (e) { touchX = e.touches && e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
    box.addEventListener("touchend", function (e) { if (touchX == null || !e.changedTouches || !e.changedTouches.length) return; var dx = e.changedTouches[0].clientX - touchX; touchX = null; if (!video && Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); }, { passive: true });
  }
  var video = false;
  function photoMode() {
    if (!video) return;
    video = false;
    var v = $(".lb-vid", box); try { v.pause(); } catch (e) {} v.removeAttribute("src"); v.load(); v.hidden = true;
    $(".lb-img", box).hidden = false;
    if (photos.length > 1) { $(".lb-prev", box).hidden = false; $(".lb-next", box).hidden = false; $(".lb-n", box).hidden = false; }
  }
  function showVideo(src, poster, title) {
    video = true;
    var v = $(".lb-vid", box), im = $(".lb-img", box);
    im.hidden = true; $(".lb-prev", box).hidden = true; $(".lb-next", box).hidden = true; $(".lb-n", box).hidden = true;
    if (poster) v.poster = poster; else v.removeAttribute("poster");
    v.src = src; v.hidden = false; v.load();
    var pl = v.play(); if (pl && pl.catch) pl.catch(function () {});
    $(".lb-alt", box).textContent = title || "Room tour";
  }
  function show(i) {
    if (!photos.length) return;
    photoMode();
    cur = (i + photos.length) % photos.length;
    var p = photos[cur], im = $(".lb-img", box);
    if (p[2]) { im.srcset = p[0] + " 1600w, " + p[2] + " 2400w"; im.sizes = "100vw"; } else { im.removeAttribute("srcset"); im.removeAttribute("sizes"); }
    im.src = p[0]; im.alt = p[1] || "";
    $(".lb-alt", box).textContent = p[1] || "";
    $(".lb-n", box).textContent = (cur + 1) + " / " + photos.length;
    [cur + 1, cur - 1].forEach(function (j) { var q = photos[(j + photos.length) % photos.length]; if (q && q !== p) { var pre = new Image(); if (q[2]) { pre.srcset = q[0] + " 1600w, " + q[2] + " 2400w"; pre.sizes = "100vw"; } pre.src = q[0]; } });
  }
  function go(d) { show(cur + d); }
  function onKey(e) {
    if (e.key === "Escape") { close(); return; }
    if (video) { /* the clip has its own controls */ }
    else if (e.key === "ArrowRight") { go(1); e.preventDefault(); }
    else if (e.key === "ArrowLeft") { go(-1); e.preventDefault(); }
    else if (e.key === "Tab") {
      var f = $$("button:not([hidden])", box); if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
    }
  }
  function open(i, from) {
    if (!box) build();
    opener = from || null;
    show(i);
    box.hidden = false;
    document.documentElement.classList.add("lb-open-page");
    document.addEventListener("keydown", onKey);
    setTimeout(function () { $(".lb-x", box).focus(); }, 0);
    track("hotel_photos", { hotel: H.slug, photo: cur + 1 });
  }
  function openVideo(b) {
    if (!box) build();
    opener = b;
    showVideo(b.getAttribute("data-video"), b.getAttribute("data-poster") || "", b.getAttribute("data-title") || "");
    box.hidden = false;
    document.documentElement.classList.add("lb-open-page");
    document.addEventListener("keydown", onKey);
    setTimeout(function () { $(".lb-x", box).focus(); }, 0);
    track("hotel_video", { hotel: H.slug, room: b.getAttribute("data-title") || "" });
  }
  function close() {
    if (!box || box.hidden) return;
    var wasVideo = video;
    photoMode();
    box.hidden = true;
    document.documentElement.classList.remove("lb-open-page");
    document.removeEventListener("keydown", onKey);
    if (!wasVideo) slideTo(cur, true);
    if (opener && opener.focus) { try { opener.focus(); } catch (e) {} }
  }
  players.forEach(function (b) { b.addEventListener("click", function () { openVideo(b); }); });
  openers.forEach(function (b) {
    b.addEventListener("click", function () { open(+(b.getAttribute("data-i") || 0), b.tagName === "BUTTON" ? b : $(".photos-btn", root) || b); });
    if (b.tagName === "IMG") { b.setAttribute("role", "button"); b.setAttribute("tabindex", "0"); b.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(+(b.getAttribute("data-i") || 0), b); } }); }
  });
})();

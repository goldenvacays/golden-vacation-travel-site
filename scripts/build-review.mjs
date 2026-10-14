/**
 * The after-trip review page: public/review/index.html, served at /review.
 *
 * A guest opens it from WhatsApp, a few days after they get home. The link carries the trip, so there is
 * nothing to look up or type:
 *   /review?h=<hotel>&m=<YYYY-MM>&r=<booking ref>&n=<nights>&a=<KIN|MBJ>
 * h is any hotel the site knows: the Jamaica resorts on the status list, the smaller Jamaica hotels on the
 * transfers list and the Getaways hotels. A slug or a name both work (riu-ocho-rios, RIU Ocho Rios).
 * An unknown or missing h asks the guest where they stayed. n and a are optional.
 * A Jamaica stay goes straight to the hotel. A getaway asks about the place first, then the hotel.
 *
 * It is a Netlify form named trip-review. Every field sits in this static HTML, because Netlify keeps only the
 * fields it found here at deploy. The team gets one email per review (netlify/functions/_notify.mjs).
 * Nothing goes on a page by itself: a person reads it, and only words the guest said yes to go into
 * data/reviews.json, which the hotel pages read.
 * The thank-you screen shows everybody the Google review link, whatever they rated. Showing it only to the
 * happy ones would be review gating, which Google bans.
 *
 * Usage: node scripts/build-review.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { ROOT, DATA, S, esc } from "./_getaways-chrome.mjs";

const read = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8"));
const slugify = (s) => String(s).toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const GOOGLE_REVIEW = "https://g.page/r/CfN6fme0tuU1EBM/review";

/* ---------- every hotel a review link can name: slug -> [name, place, kind] (kind j = Jamaica, g = getaway) ---------- */
const HOTELS = {};
/* names shown on the page carry no long dashes: "FDR — Franklyn D. Resort" reads "FDR, Franklyn D. Resort", as on the near pages */
const disp = (n) => String(n).replace(/\s*[—–]\s*/g, ", ");
const add = (slug, name, place, kind) => { if (slug && !HOTELS[slug]) HOTELS[slug] = [disp(name), disp(place), kind]; };
DATA.destinations.forEach((d) => {
  const place = d.slug === "panama" ? "Panama" : d.name;
  d.groups.forEach((g) => g.hotels.forEach((h) => add(h.slug, h.name, place, "g")));
});
const resortsJs = fs.readFileSync(path.join(ROOT, "public/map/resorts.js"), "utf8");
JSON.parse(resortsJs.slice(resortsJs.indexOf("["), resortsJs.lastIndexOf("]") + 1)).forEach((r) => add(slugify(r.name), r.name, r.area || "Jamaica", "j"));
read("data/transfers.json").zones.forEach((z) => (z.places || []).forEach((p) => add(slugify(p), p, z.name, "j")));

/* ---------- the questions ---------- */
const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.6l2.9 5.9 6.5.95-4.7 4.58 1.1 6.47L12 17.45 6.2 20.5l1.1-6.47L2.6 9.45l6.5-.95z"/></svg>';
const stars = (name, label) => `<div class="rv-row"><span class="rv-lab" id="l-${name}">${esc(label)}</span><div class="rv-stars" role="radiogroup" aria-labelledby="l-${name}">${[1, 2, 3, 4, 5].map((i) => `<input type="radio" name="${name}" id="${name}-${i}" value="${i}"><label for="${name}-${i}" aria-label="${i} out of 5">${STAR}</label>`).join("")}</div></div>`;
const yesNo = (name, label) => `<div class="rv-row"><span class="rv-lab" id="l-${name}">${esc(label)}</span><div class="rv-pills" role="radiogroup" aria-labelledby="l-${name}"><input type="radio" name="${name}" id="${name}-yes" value="yes"><label for="${name}-yes">Yes</label><input type="radio" name="${name}" id="${name}-no" value="no"><label for="${name}-no">No</label></div></div>`;
const nav = (back, next = "Next") => `<div class="rv-nav">${back ? '<button class="rv-btn rv-back" type="button" data-back>Back</button>' : ""}<button class="rv-btn rv-go" type="button" data-next>${next}</button></div>`;

const css = `
:root{--ink:#0E0F0E;--gold:#F2B93B;--gold-txt:#A87A12;--alt:#F3F3EF;--line:#E4E4DF;--muted:#63685F;--white:#fff;--cream:#FFF6DF;
--font:Archivo,"Helvetica Neue",Helvetica,Arial,sans-serif}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--white);color:var(--ink);font-family:var(--font);font-size:16px;line-height:1.5;-webkit-font-smoothing:antialiased}
a{color:inherit}h1,h2,p{margin:0}button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer}
[hidden]{display:none!important}
.hh{font-weight:900;font-stretch:110%;letter-spacing:-.04em;line-height:.95}
.rv-top{display:flex;align-items:center;justify-content:space-between;gap:12px;max-width:560px;margin:0 auto;padding:16px 20px}
.rv-word{font-weight:900;font-stretch:110%;letter-spacing:-.03em;font-size:16px;text-decoration:none;white-space:nowrap}
.rv-tag{font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;background:var(--gold);padding:5px 11px;border-radius:999px}
main{max-width:560px;margin:0 auto;padding:4px 20px 48px}
.rv-head{padding:12px 0 6px}
.rv-head h1{font-size:clamp(34px,10vw,48px)}
.rv-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}
.rv-chip{font-size:13px;font-weight:700;background:var(--alt);padding:5px 12px;border-radius:999px}
.rv-intro{margin-top:14px;color:var(--muted);font-size:15px}
.rv-prog{display:flex;gap:5px;margin:22px 0 6px}.rv-prog span{flex:1;height:5px;border-radius:3px;background:var(--line)}.rv-prog span.on{background:var(--gold)}
.rv-step-n{font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.rv-step{padding-top:18px;display:flex;flex-direction:column;gap:16px}
.rv-step h2{font-size:26px}.rv-sub{color:var(--muted);font-size:15px;margin-top:-8px}
.rv-list{background:var(--alt);border-radius:20px;padding:4px 16px}
.rv-row{display:flex;align-items:center;justify-content:space-between;gap:8px 12px;flex-wrap:wrap;padding:10px 0;border-bottom:1px solid var(--line)}
.rv-row:last-child{border-bottom:0}.rv-lab{font-weight:700;font-size:16px}
.rv-stars{display:flex;margin-right:-4px}
.rv-stars input,.rv-pills input{position:absolute;opacity:0;width:1px;height:1px}
.rv-stars label{display:block;padding:6px 3px;cursor:pointer;line-height:0;border-radius:8px}
.rv-stars svg{width:30px;height:30px;fill:var(--line);transition:fill .12s}
.rv-stars label.on svg{fill:var(--gold)}
.rv-stars input:focus-visible+label,.rv-pills input:focus-visible+label{outline:2px solid var(--ink);outline-offset:1px}
.rv-pills{display:flex;gap:6px}
.rv-pills label{cursor:pointer;min-height:40px;display:flex;align-items:center;padding:0 18px;border-radius:999px;background:var(--white);box-shadow:inset 0 0 0 1.5px var(--line);font-weight:700;font-size:15px}
.rv-pills input:checked+label{background:var(--ink);color:var(--white);box-shadow:none}
.rv-skipfood{font-size:14px;color:var(--muted);display:flex;align-items:center;gap:8px;cursor:pointer}
.rv-skipfood input{width:20px;height:20px;accent-color:var(--ink)}
.rv-field{display:flex;flex-direction:column;gap:6px}
.rv-field>label{font-weight:700}.rv-opt{font-weight:400;color:var(--muted);font-size:14px}
.rv-hint{font-size:14px;color:var(--muted)}
textarea,input[type=text]{font:inherit;font-size:16px;color:var(--ink);background:var(--white);border:1.5px solid var(--line);border-radius:14px;padding:12px 14px;width:100%}
textarea{min-height:92px;resize:vertical}
textarea:focus,input[type=text]:focus{outline:2px solid var(--ink);outline-offset:1px;border-color:var(--ink)}
.rv-file{position:relative;display:flex;align-items:center;gap:12px;border:1.5px dashed var(--line);border-radius:14px;padding:10px 12px;cursor:pointer}
.rv-file input{position:absolute;opacity:0;width:1px;height:1px}
.rv-file:focus-within{outline:2px solid var(--ink);outline-offset:1px}
.rv-file-btn{flex:none;height:40px;display:inline-flex;align-items:center;padding:0 16px;border-radius:999px;background:var(--ink);color:var(--white);font-weight:800;font-size:14px}
.rv-file-name{font-size:14px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.rv-consent{background:var(--cream);border-radius:20px;padding:16px;display:flex;flex-direction:column;gap:12px;box-shadow:inset 0 0 0 1.5px var(--gold)}
.rv-line{background:var(--white);border-radius:12px;padding:9px 12px;font-size:15px}
.rv-check{display:flex;gap:10px;align-items:flex-start;cursor:pointer;font-size:15px}
.rv-check input{width:22px;height:22px;margin:1px 0 0;flex:none;accent-color:var(--ink)}
.rv-nav{display:flex;gap:10px;padding-top:4px}
.rv-btn{height:56px;border-radius:999px;font-weight:800;font-size:16px;padding:0 22px}
.rv-go{flex:1;background:var(--ink);color:var(--white)}.rv-go:hover{color:var(--gold)}.rv-go[disabled]{opacity:.6;cursor:default}
.rv-back{box-shadow:inset 0 0 0 2px var(--ink)}
.rv-skip{align-self:center;color:var(--muted);text-decoration:underline;font-size:15px;padding:6px}
.rv-small{font-size:14px;color:var(--muted);text-align:center}
.rv-err{background:#FDECEA;border-radius:14px;padding:12px 14px;font-size:15px}
.rv-done{padding:36px 0 0;text-align:center;display:flex;flex-direction:column;align-items:center;gap:14px}
.rv-tick{width:60px;height:60px;border-radius:50%;background:var(--gold);display:flex;align-items:center;justify-content:center}
.rv-tick svg{width:30px;height:30px;fill:none;stroke:var(--ink);stroke-width:3;stroke-linecap:round;stroke-linejoin:round}
.rv-done h2{font-size:36px}.rv-done>p{max-width:38ch;color:var(--muted)}
.rv-google{margin-top:12px;width:100%;text-align:left;background:var(--ink);color:var(--white);border-radius:20px;padding:20px;display:flex;flex-direction:column;gap:10px}
.rv-google b{font-size:19px;font-weight:900;font-stretch:110%;letter-spacing:-.02em}
.rv-google p{color:#D6D7D2;font-size:15px}
.rv-google a{display:flex;align-items:center;justify-content:center;height:54px;border-radius:999px;background:var(--gold);color:var(--ink);font-weight:800;text-decoration:none;margin-top:4px}
.rv-foot{max-width:560px;margin:0 auto;padding:22px 20px 32px;border-top:1px solid var(--line);font-size:13px;color:var(--muted)}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
`;

/* the page's script: reads the link, fills in the trip, walks the steps, sends the form */
const js = `(function(){
var H=${JSON.stringify(HOTELS)};
var MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
var AIR={KIN:"Kingston",MBJ:"Montego Bay"};
var $=function(s){return document.querySelector(s)},$$=function(s){return Array.prototype.slice.call(document.querySelectorAll(s))};
var q;try{q=new URLSearchParams(location.search)}catch(e){q={get:function(){return null}}}
var raw=(q.get("h")||"").trim().slice(0,80);
var slug=raw.toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"");
var hit=H[slug]||null;
var kind=hit?hit[2]:"";
var month=/^\\d{4}-\\d{2}$/.test(q.get("m")||"")?q.get("m"):"";
var nights=/^\\d{1,2}$/.test(q.get("n")||"")?parseInt(q.get("n"),10):0;
var air=AIR[(q.get("a")||"").toUpperCase()]?(q.get("a")||"").toUpperCase():"";
var ref=(q.get("r")||"").replace(/[^A-Za-z0-9 _-]/g,"").slice(0,40);
var mLabel=function(m){var p=String(m||"").split("-"),i=parseInt(p[1],10);return p[0]&&i>=1&&i<=12?MONTHS[i-1]+" "+p[0]:""};
var hotelName=hit?hit[0]:"",place=hit?hit[1]:"";
var getaway=kind==="g";
/* the place questions only for a getaway */
$$("[data-step]").forEach(function(s){if(s.getAttribute("data-step")==="place"&&!getaway)s.remove()});
$$("[data-getaway-only]").forEach(function(e){if(!getaway)e.remove()});
var steps=$$("[data-step]"),TOTAL=steps.length,at=0;
var set=function(id,v){var e=document.getElementById(id);if(e)e.value=v};
set("f-hotel",hit?slug:raw);set("f-hotel-name",hotelName);set("f-place",place);set("f-kind",getaway?"getaway":hit?"jamaica":"");
set("f-month",month);set("f-nights",nights||"");set("f-airport",air);set("f-booking",ref);
var title=getaway?place:hotelName;
$("#rv-h1").textContent=title?"How was "+title+"?":"How was your trip?";
document.title=(title?"How was "+title+"?":"How was your trip?")+" | Golden Vacation & Travel";
var chips=[];if(nights)chips.push(nights+(nights===1?" night":" nights"));if(air&&getaway)chips.push("from "+AIR[air]);if(mLabel(month))chips.push(mLabel(month));if(getaway&&hotelName)chips.push(hotelName);
$("#rv-chips").innerHTML=chips.map(function(c){return '<span class="rv-chip">'+c.replace(/[<>&]/g,"")+"</span>"}).join("");
$("#rv-intro").textContent=(TOTAL===3?"Three":"Four")+" quick screens, mostly tapping. It helps the next traveller more than you would think.";
$$(".js-hotel").forEach(function(e){e.textContent=hotelName||"your hotel"});
if(getaway)$("#rv-hotel-h").textContent=hotelName;
$$(".js-place").forEach(function(e){e.textContent=place||"there"});
if(!hit){$("#rv-where").hidden=false;if(raw&&!/^[a-z0-9-]+$/.test(raw))set("f-where",raw);else if(raw)set("f-where",raw.replace(/-/g," "))}
if(!getaway){var t=$("#f-tours");if(t)t.placeholder="A tour, a beach, a restaurant nearby."}
var bar=$("#rv-prog");bar.innerHTML=steps.map(function(){return"<span></span>"}).join("");
steps[0].querySelectorAll("[data-back]").forEach(function(b){b.remove()});
function show(n){at=Math.max(0,Math.min(n,TOTAL-1));steps.forEach(function(s,i){s.hidden=i!==at});
$$("#rv-prog span").forEach(function(b,i){b.classList.toggle("on",i<=at)});
$("#rv-step-n").textContent="Step "+(at+1)+" of "+TOTAL;if(at)window.scrollTo(0,0)}
$$("[data-next]").forEach(function(b){b.addEventListener("click",function(){show(at+1)})});
$$("[data-back]").forEach(function(b){b.addEventListener("click",function(){show(at-1)})});
$$(".rv-stars").forEach(function(g){g.addEventListener("change",function(){var c=g.querySelector("input:checked"),v=c?parseInt(c.value,10):0;
g.querySelectorAll("label").forEach(function(l,i){l.classList.toggle("on",i<v)})})});
var nf=$("#f-nofood");if(nf)nf.addEventListener("change",function(){var g=$('.rv-stars[aria-labelledby="l-hotel_food"]');
g.style.opacity=nf.checked?".35":"1";g.querySelectorAll("input").forEach(function(i){i.disabled=nf.checked;if(nf.checked)i.checked=false});
g.querySelectorAll("label").forEach(function(l){l.classList.remove("on")})});
function line(){var n=($("#f-first").value||"").trim().replace(/[<>&]/g,"")||"Your first name";
var bits=[n];if(nights)bits.push(nights+(nights===1?" night":" nights")+(getaway&&air?" from "+AIR[air]:""));if(mLabel(month))bits.push(mLabel(month));
$("#rv-line").textContent=bits.join(", ")}
$("#f-first").addEventListener("input",line);line();
var fp=$("#f-photo");fp.addEventListener("change",function(){var f=fp.files&&fp.files[0];$("#rv-file-name").textContent=f?f.name:"No photo yet";$(".rv-file-btn").textContent=f?"Change":"Add a photo"});
var form=$("#rv-form");
form.addEventListener("submit",function(e){e.preventDefault();var go=$("#rv-send");go.disabled=true;go.textContent="Sending...";$("#rv-err").hidden=true;
var fd=new FormData(form),ph=fd.get("photo");if(ph&&!ph.size)fd.delete("photo");
if(ph&&ph.size>7.5*1024*1024){go.disabled=false;go.textContent="Send it";$("#rv-err").textContent="That photo is too big to send. Please pick a smaller one, or send it without the photo.";$("#rv-err").hidden=false;return}
fetch("/",{method:"POST",body:fd}).then(function(r){if(!r.ok)throw new Error(r.status);
$("#rv-form-view").hidden=true;$("#rv-done").hidden=false;window.scrollTo(0,0);
try{window.gtag&&gtag("event","trip_review_sent",{kind:getaway?"getaway":"jamaica"})}catch(x){}})
.catch(function(){go.disabled=false;go.textContent="Send it";$("#rv-err").hidden=false})});
show(0);
})();`;

const ga = S.ga4 ? `<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${S.ga4}');
addEventListener('load',function(){setTimeout(function(){var s=document.createElement('script');s.async=1;s.src='https://www.googletagmanager.com/gtag/js?id=${S.ga4}';document.head.appendChild(s);},1200);});</script>` : "";

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>How was your trip? | Golden Vacation &amp; Travel</title>
<meta name="description" content="A few quick questions about your trip with Golden Vacation &amp; Travel.">
<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="#0E0F0E">
<link rel="icon" href="/favicon-32x32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preload" href="/assets/fonts/archivo.woff2" as="font" type="font/woff2" crossorigin>
<style>@font-face{font-family:'Archivo';font-style:normal;font-display:swap;font-weight:100 900;font-stretch:62% 125%;src:url(/assets/fonts/archivo.woff2) format('woff2-variations')}${css}</style>
${ga}
</head>
<body>
<header class="rv-top"><a class="rv-word" href="/">GOLDEN VACATION</a><span class="rv-tag">Trip review</span></header>
<main>
<div id="rv-form-view">
  <div class="rv-head">
    <h1 class="hh" id="rv-h1">How was your trip?</h1>
    <div class="rv-chips" id="rv-chips"></div>
    <p class="rv-intro" id="rv-intro">A few quick screens, mostly tapping. It helps the next traveller more than you would think.</p>
  </div>
  <div class="rv-prog" id="rv-prog" aria-hidden="true"></div>
  <p class="rv-step-n" id="rv-step-n">Step 1</p>

  <form id="rv-form" name="trip-review" method="POST" data-netlify="true" netlify-honeypot="bot-field" enctype="multipart/form-data" novalidate>
    <input type="hidden" name="form-name" value="trip-review">
    <p hidden><label>Leave this empty <input name="bot-field"></label></p>
    <input type="hidden" name="hotel" id="f-hotel">
    <input type="hidden" name="hotel_name" id="f-hotel-name">
    <input type="hidden" name="place" id="f-place">
    <input type="hidden" name="kind" id="f-kind">
    <input type="hidden" name="month" id="f-month">
    <input type="hidden" name="nights" id="f-nights">
    <input type="hidden" name="airport" id="f-airport">
    <input type="hidden" name="booking" id="f-booking">

    <section class="rv-step" data-step="place">
      <h2 class="hh"><span class="js-place">The place</span></h2>
      <p class="rv-sub">The place itself, not the hotel.</p>
      <div class="rv-list">
        ${stars("place_getting_around", "Getting around")}
        ${stars("place_food", "Eating out")}
        ${stars("place_safety", "How safe it felt")}
        ${stars("place_value", "Value for money")}
        ${yesNo("place_again", "Would you go back?")}
      </div>
      ${nav(false)}
    </section>

    <section class="rv-step" data-step="hotel">
      <h2 class="hh" id="rv-hotel-h">Your stay</h2>
      <p class="rv-sub">Where you stayed.</p>
      <div class="rv-field" id="rv-where" hidden>
        <label for="f-where">Where did you stay?</label>
        <input type="text" id="f-where" name="where_stayed" placeholder="The hotel, and the town" autocomplete="off">
      </div>
      <div class="rv-list">
        ${stars("hotel_room", "The room")}
        ${stars("hotel_clean", "Cleanliness")}
        ${stars("hotel_location", "Location")}
        ${stars("hotel_food", "The food")}
        <div class="rv-row"><label class="rv-skipfood"><input type="checkbox" id="f-nofood" name="hotel_food_skip" value="yes"> We didn't eat at the hotel</label></div>
        ${stars("hotel_staff", "The staff")}
        ${stars("hotel_value", "Value for money")}
        ${yesNo("hotel_again", "Stay here again?")}
      </div>
      <div class="rv-nav"><button class="rv-btn rv-back" type="button" data-back>Back</button><button class="rv-btn rv-go" type="button" data-next>Next</button></div>
    </section>

    <section class="rv-step" data-step="words">
      <h2 class="hh">In your words</h2>
      <p class="rv-sub">All optional. Even one line helps.</p>
      <div class="rv-field">
        <label for="f-words">What should the next guest know about <span class="js-hotel">the hotel</span>? <span class="rv-opt">Optional</span></label>
        <textarea id="f-words" name="hotel_words" maxlength="1500" placeholder="The room, the food, the pool, the beach."></textarea>
      </div>
      <div class="rv-field">
        <label for="f-tours">Anything you did while you were there? <span class="rv-opt">Optional</span></label>
        <textarea id="f-tours" name="tours" maxlength="800" placeholder="A tour, a day trip, a restaurant."></textarea>
      </div>
      <div class="rv-field" data-getaway-only>
        <label for="f-tip">A tip for a first-timer in <span class="js-place">the place</span> <span class="rv-opt">Optional</span></label>
        <textarea id="f-tip" name="place_tip" maxlength="800" placeholder="Money, getting from the airport, the weather."></textarea>
      </div>
      <div class="rv-nav"><button class="rv-btn rv-back" type="button" data-back>Back</button><button class="rv-btn rv-go" type="button" data-next>Next</button></div>
      <button class="rv-skip" type="button" data-next>Skip this bit</button>
    </section>

    <section class="rv-step" data-step="last">
      <h2 class="hh">Last thing</h2>
      <p class="rv-sub">Then you're done.</p>
      <div class="rv-list">${stars("golden_service", "And how did we do?")}</div>
      <div class="rv-field">
        <label for="f-photo">A photo of the room or the view <span class="rv-opt">Optional</span></label>
        <p class="rv-hint">Your own photo, please. Only one, and only with your OK below.</p>
        <label class="rv-file" for="f-photo"><input type="file" id="f-photo" name="photo" accept="image/*"><span class="rv-file-btn">Add a photo</span><span class="rv-file-name" id="rv-file-name">No photo yet</span></label>
      </div>
      <div class="rv-field">
        <label for="f-first">Your first name</label>
        <input type="text" id="f-first" name="first_name" autocomplete="given-name" maxlength="40" placeholder="Andre">
      </div>
      <div class="rv-consent">
        <div class="rv-line">It would show as: <b id="rv-line">Your first name</b></div>
        <label class="rv-check" for="f-consent"><input type="checkbox" id="f-consent" name="consent" value="yes"><span>Yes, Golden Vacation can show my words and photo on its page for <span class="js-hotel">this hotel</span>, with my first name and the month I went. No surname, nothing else.</span></label>
      </div>
      <p class="rv-err" id="rv-err" role="alert" hidden>That didn't go through. Please try again, or send it to us on WhatsApp.</p>
      <div class="rv-nav"><button class="rv-btn rv-back" type="button" data-back>Back</button><button class="rv-btn rv-go" type="submit" id="rv-send">Send it</button></div>
      <p class="rv-small">A person at Golden reads every one of these before anything goes on our site.</p>
    </section>
  </form>
</div>

<div class="rv-done" id="rv-done" hidden>
  <div class="rv-tick"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.5l5.5 5.5L20 7"/></svg></div>
  <h2 class="hh">Thank you</h2>
  <p>That helps the next traveller more than you'd think. We read every one, and if you said yes, it goes up with your first name and the month you travelled.</p>
  <div class="rv-google">
    <b>One more, and this one is for us</b>
    <p>A few words about Golden on Google helps people find us. If you have a minute, and you haven't already.</p>
    <a href="${GOOGLE_REVIEW}" target="_blank" rel="noopener noreferrer">Write a Google review</a>
  </div>
  <p class="rv-small">Travelling again? <a href="https://wa.me/${S.whatsapp}">WhatsApp us</a>.</p>
</div>
</main>
<footer class="rv-foot">Golden Vacation &amp; Travel · ${esc(S.footerAddress)} · WhatsApp ${esc(S.whatsappDisplay)} · <a href="/privacy/">Privacy</a></footer>
<script>${js}</script>
</body>
</html>
`;

const out = path.join(ROOT, "public/review/index.html");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log("wrote", path.relative(ROOT, out), `${(html.length / 1024).toFixed(0)}K`, "|", Object.keys(HOTELS).length, "hotels the link can name");

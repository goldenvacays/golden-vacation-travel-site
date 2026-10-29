#!/usr/bin/env python3
"""The resort photos in the Teachers' Day deals list: public/teachers-day/img/<slug>.jpg, 240 x 180 (sharp at the
120 x 90 they are shown), cut from each resort's photo on the status map (public/map/photos). Each deal in
data/teachers-day.json names its resort on the map by "status".
Run after changing the deals or a resort photo, then rebuild:
python3 scripts/make-teacher-thumbs.py && node scripts/build-teachers.mjs"""
import json, os, re, sys
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(ROOT, "public/map/resorts.js"), encoding="utf8").read()
resorts = {r["name"]: r for r in json.loads(src[src.index("["): src.rindex("]") + 1])}
deals = json.load(open(os.path.join(ROOT, "data/teachers-day.json"), encoding="utf8"))["deals"]["items"]
out_dir = os.path.join(ROOT, "public/teachers-day/img")
os.makedirs(out_dir, exist_ok=True)

def slugify(s):
    s = str(s).lower().replace("&", " and ")
    return re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9]+", "-", s))

missing = []
for d in deals:
    r = resorts.get(d["status"])
    p = r and r.get("photo") and os.path.join(ROOT, "public/map", r["photo"])
    if not p or not os.path.exists(p):
        missing.append(d["name"])
        continue
    im = ImageOps.exif_transpose(Image.open(p)).convert("RGB")
    im = ImageOps.fit(im, (240, 180), Image.LANCZOS, centering=(0.5, 0.5))
    im.save(os.path.join(out_dir, slugify(d["name"]) + ".jpg"), quality=78, optimize=True, progressive=True)
print("thumbs:", len(deals) - len(missing), "of", len(deals))

# the hero for phones: the 1600 px hero at 900 px, so a phone does not load the full-size photo
hero = json.load(open(os.path.join(ROOT, "data/teachers-day.json"), encoding="utf8"))["hero"]
if hero.get("imgSmall"):
    im = ImageOps.exif_transpose(Image.open(os.path.join(ROOT, "public", hero["img"].lstrip("/")))).convert("RGB")
    im = im.resize((900, round(im.height * 900 / im.width)), Image.LANCZOS)
    im.save(os.path.join(ROOT, "public", hero["imgSmall"].lstrip("/")), quality=78, optimize=True, progressive=True)
    print("hero:", hero["imgSmall"], im.size)
if missing:
    sys.exit("no map photo for: " + ", ".join(missing))

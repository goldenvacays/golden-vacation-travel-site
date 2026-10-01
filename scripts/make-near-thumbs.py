#!/usr/bin/env python3
"""The round resort photo at the top of each near page: public/assets/img/exp/near/<slug>.jpg, 112 px square
(sharp at the 46 px it is shown), cut from the resort's photo on the status map (public/map/photos).
Run after adding or changing a resort photo, then rebuild: python3 scripts/make-near-thumbs.py && node scripts/build-experiences.mjs"""
import json, os, re
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(ROOT, "public/map/resorts.js"), encoding="utf8").read()
resorts = json.loads(src[src.index("["): src.rindex("]") + 1])
out_dir = os.path.join(ROOT, "public/assets/img/exp/near")
os.makedirs(out_dir, exist_ok=True)

def slugify(s):
    s = str(s).lower().replace("&", " and ")
    return re.sub(r"^-+|-+$", "", re.sub(r"[^a-z0-9]+", "-", s))

made = 0
for r in resorts:
    if r.get("status") == "Permanently closed" or not r.get("photo"):
        continue
    p = os.path.join(ROOT, "public/map", r["photo"])
    if not os.path.exists(p):
        print("missing photo:", r["name"], r["photo"])
        continue
    im = ImageOps.exif_transpose(Image.open(p)).convert("RGB")
    im = ImageOps.fit(im, (112, 112), Image.LANCZOS, centering=(0.5, 0.5))
    im.save(os.path.join(out_dir, slugify(r["name"]) + ".jpg"), quality=80, optimize=True, progressive=True)
    made += 1
print("thumbs:", made)

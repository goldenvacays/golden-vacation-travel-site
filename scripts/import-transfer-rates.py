#!/usr/bin/env python3
"""
Turns Hana's transfer rate sheet (Jamaica_Hotel_Rates_with_Markup.xlsx, "Every Rate" tab) into data/transfer-rates.json.

Only SELL prices leave this script. Cost and the supplier never reach the JSON, the page or the functions.

  python3 scripts/import-transfer-rates.py path/to/Jamaica_Hotel_Rates_with_Markup.xlsx

Shape of the output:
  hotels[key]   the 40 hotels and complexes in the sheet: name, sheet area, price zone, the resort-list names that map to it
  rates[key][airport][trip]   the offers for that hotel, one way in / out, or both ways: [{v, seats, bags, price}] cheapest first
  zones[zone][airport][trip]  a fallback for villas, Airbnbs and hotels not in the sheet: per vehicle and seat count, the highest
                              price among the zone's hotels (protects the margin; Hana can lower any of them)
Vehicle rungs (v): car (Economy / Comfort / Micro, 3 seats), business (Business, 3), minivan (Minivan / MPV, 4 to 7),
bizvan (Business MPV / Business Minivan, 5 to 6), minibus (Minibus, 6 to 16), coach (Bus, 16 and up).
Within a rung, an offer that seats fewer people for more money than another offer of the same rung is dropped, so each
rung is a clean ladder (more seats, higher price); an offer that another offer beats on seats at half the price or less
is dropped as a wild one; seats above 25 are left out (the site takes up to 16 people).
Offers are stored compact: [rung, seats, bags, price].
"""
import json, math, re, sys, collections
from pathlib import Path
import openpyxl

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else None
if not SRC or not SRC.exists():
    sys.exit("usage: import-transfer-rates.py <xlsx>")

RUNG = {"Economy": "car", "Comfort": "car", "Micro": "car", "Business": "business", "Minivan": "minivan", "MPV": "minivan",
        "Business MPV": "bizvan", "Business Minivan": "bizvan", "Minibus": "minibus", "Bus": "coach"}
TRIP = {"One-way arrival (airport to hotel)": "in", "One-way departure (hotel to airport)": "out", "Round trip (both ways)": "both"}
AREA_ZONE = {"Montego Bay": "mobay", "Falmouth": "falmouth", "Trelawny": "falmouth", "Hanover (Lucea)": "lucea", "Hanover (Green Island)": "lucea",
             "Negril": "negril", "Runaway Bay": "runaway-bay", "Ocho Rios": "ocho-rios", "South Coast": "south-coast"}
# sheet hotel -> the names on the resort list (public/map/resorts.js) that price like it; and the zone where the sheet's area is too coarse
MATCH = {
    "Azul Beach Resort Negril": ["Azul Beach Resort Negril"],
    "Bahia Principe Runaway Bay complex": ["Bahia Principe Escape Runaway Bay", "Bahia Principe Explore Jamaica"],
    "Beaches Negril": ["Beaches Negril"],
    "Breathless Montego Bay": ["Breathless Montego Bay"],
    "Couples Negril": ["Couples Negril"], "Couples Sans Souci": ["Couples Sans Souci"], "Couples Swept Away": ["Couples Swept Away"], "Couples Tower Isle": ["Couples Tower Isle"],
    "Decameron Club Caribbean": ["Grand Muthu Runaway Bay Club Caribbean"],
    "Deja Resort": ["Deja Resort"],
    "Dreams Rose Hall": ["Dreams Rose Hall"],
    "Excellence Oyster Bay": ["Excellence Oyster Bay"],
    "FDR Franklyn D. Resort": ["FDR — Franklyn D. Resort"],
    "Grand Decameron Montego Beach": ["Grand Decameron Montego Beach", "Grand Decameron Cornwall Beach"],
    "Grand Lido Negril": ["Grand Lido Negril"],
    "Grand Palladium Jamaica & Lady Hamilton complex": ["Grand Palladium Jamaica Resort & Spa", "Grand Palladium Lady Hamilton Resort & Spa"],
    "Hedonism II": ["Hedonism II"],
    "Hyatt Ziva & Zilara Rose Hall": ["Hyatt Zilara Rose Hall", "Hyatt Ziva Rose Hall"],
    "Iberostar Rose Hall complex (Waves / Selection Suites / Joia)": ["Iberostar Waves Rose Hall", "Iberostar Selection Rose Hall", "JOIA Rose Hall by Iberostar"],
    "Jewel Grande Montego Bay": ["Jewel Grande Montego Bay"],
    "Moon Palace Jamaica": ["Moon Palace Jamaica"],
    "Ocean Coral Spring & Ocean Eden Bay complex": ["Ocean Coral Spring", "Ocean Eden Bay"],
    "Princess Grand Jamaica & Princess Senses complex": ["Princess Grand Jamaica", "Princess Senses The Mangrove"],
    "RIU Montego Bay complex (Riu Reggae / Riu Montego Bay / Riu Palace Jamaica)": ["RIU Reggae", "RIU Montego Bay", "RIU Palace Jamaica"],
    "Riu Negril & Riu Palace Tropical Bay complex": ["RIU Negril", "RIU Palace Tropical Bay"],
    "Riu Ocho Rios": ["RIU Ocho Rios"],
    "Riu Palace Aquarelle": ["RIU Palace Aquarelle"],
    "Royalton Blue Waters / White Sands / Hideaway complex": ["Royalton Blue Waters", "Royalton Hideaway Blue Waters"],
    "Royalton Chic": ["Royalton CHIC Jamaica Paradise Cove"],
    "Royalton Negril & Hideaway at Royalton Negril complex": ["Royalton Negril", "Royalton Hideaway Negril"],
    "Sandals Caribbean Cay": ["Sandals Caribbean Cay"], "Sandals Dunn's River": ["Sandals Dunn's River"], "Sandals Montego Bay": ["Sandals Montego Bay"],
    "Sandals Negril": ["Sandals Negril"], "Sandals Ochi": ["Sandals Ochi"], "Sandals Royal Plantation": ["Sandals Royal Plantation"], "Sandals South Coast": ["Sandals South Coast"],
    "SeaGarden Beach Resort": ["Sea Garden Hotel"],
    "Secrets St. James & Wild Orchid": ["Secrets St. James Montego Bay", "Secrets Wild Orchid Montego Bay"],
    "Sunset at the Palms": ["Sunset at the Palms"],
}
ROSE_HALL = {"Dreams Rose Hall", "Hyatt Ziva & Zilara Rose Hall", "Iberostar Rose Hall complex (Waves / Selection Suites / Joia)", "Jewel Grande Montego Bay"}

def slug(s):
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", s.lower().replace("&", " and "))).strip("-")

wb = openpyxl.load_workbook(SRC, data_only=True)
ws = wb["Every Rate"]
rows = [r for r in ws.iter_rows(min_row=7, values_only=True) if r and r[0]]
hotels, offers = {}, collections.defaultdict(list)  # offers[(key, airport, trip)] -> [(v, seats, bags, sell)]
for area, hotel, airport, trip, klass, seats, bags, cost, sell in rows:
    key = slug(hotel)
    zone = "rose-hall" if hotel in ROSE_HALL else AREA_ZONE[area]
    hotels[key] = {"name": hotel, "area": area, "zone": zone, "matches": MATCH.get(hotel, [])}
    if trip not in TRIP or klass not in RUNG or not sell:
        continue
    offers[(key, airport, TRIP[trip])].append((RUNG[klass], int(seats), int(bags or seats), int(sell)))
unknown = [h for h in hotels.values() if not h["matches"]]
if unknown:
    print("no resort-list match for:", ", ".join(h["name"] for h in unknown))

def tidy(items):
    """cheapest per (rung, seats); then within a rung drop any offer that seats fewer for more money; cheapest first"""
    best = {}
    for v, seats, bags, price in items:
        if seats > 25:
            continue
        k = (v, seats)
        if k not in best or price < best[k][3]:
            best[k] = (v, seats, bags, price)
    kept = []
    for v, seats, bags, price in best.values():
        ladder = any(v2 == v and s2 >= seats and p2 <= price and (s2, p2) != (seats, price) for (v2, s2, _, p2) in best.values())
        absurd = any(s2 >= seats and p2 <= price * 0.5 for (_, s2, _, p2) in best.values())  # the sheet carries a few wild offers
        if not ladder and not absurd:
            kept.append((v, seats, bags, price))
    return sorted(kept, key=lambda o: (o[3], o[1]))

rates = collections.defaultdict(lambda: collections.defaultdict(dict))
for (key, airport, trip), items in offers.items():
    rates[key][airport][trip] = [list(o) for o in tidy(items)]

# zone fallback: per (rung, seats) the highest of the hotels' own tidied prices in that zone, then the same ladder rule
zone_pool = collections.defaultdict(list)
for (key, airport, trip), items in offers.items():
    for o in tidy(items):
        zone_pool[(hotels[key]["zone"], airport, trip)].append(o)
zones = collections.defaultdict(lambda: collections.defaultdict(dict))
for (zone, airport, trip), items in zone_pool.items():
    worst = {}
    for v, seats, bags, price in items:
        k = (v, seats)
        if k not in worst or price > worst[k][3]:
            worst[k] = (v, seats, bags, price)
    zones[zone][airport][trip] = [list(o) for o in tidy(list(worst.values()))]

out = {
    "source": "Hana's transfer rate sheet, rates pulled 11 to 12 September 2026. Sell prices only, USD per vehicle, tax included. Regenerate with scripts/import-transfer-rates.py.",
    "airports": ["MBJ", "KIN", "OCJ"],
    "hotels": dict(sorted(hotels.items())),
    "rates": {k: dict(v) for k, v in sorted(rates.items())},
    "zones": {k: dict(v) for k, v in sorted(zones.items())},
}
dest = ROOT / "data" / "transfer-rates.json"
dest.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
n = sum(len(t) for h in out["rates"].values() for a in h.values() for t in a.values())
print(f"wrote {dest.relative_to(ROOT)}: {len(hotels)} hotels, {n} offers, zones: {', '.join(sorted(zones))}, {dest.stat().st_size // 1024}K")

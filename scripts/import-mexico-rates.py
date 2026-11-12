#!/usr/bin/env python3
"""Loads the Desde México rate sheet (the Excel Dino fills in) into data/jamaica-mexico.json.

Reads the yellow inputs only, never the sheet's cached formula results:
  Dates to check: per sample date, the return flight per person and each resort's room price for 2 adults for
                  the whole stay. Per person per night = room total / nights / 2; the lowest per season wins.
  Settings:       standard flight until the Standard dates are filled (B4), peso rate (B8).
  Resorts:        shared transfer per person (column E), web code (column L).
Writes pricing.flightUsd and pricing.rates per season (standard, easter, summer), pricing.transferPp, mxnPerUsd.
The markups (pricing.hotelMarkupPct, pricing.flightMarkupPct) stay as set in the JSON.
Usage: python3 scripts/import-mexico-rates.py path/to/Desde-Mexico-rates.xlsx
"""
import json, sys, datetime as dt
from pathlib import Path
from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'data' / 'jamaica-mexico.json'
SEASONS = {'Standard': 'standard', 'Easter': 'easter', 'Summer': 'summer'}

def num(v):
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) and v > 0 else None

def main(path):
    wb = load_workbook(path)
    dc, st, rs = wb['Dates to check'], wb['Settings'], wb['Resorts']
    # resort columns on the dates tab follow the Resorts tab rows (row 4 onward); the web code is column L
    slugs = []
    r = 4
    while rs.cell(row=r, column=1).value not in (None, ''):
        slugs.append(str(rs.cell(row=r, column=12).value).strip()); r += 1
    first_col = 6
    flights = {s: [] for s in SEASONS.values()}
    rates = {s: {slug: [] for slug in slugs} for s in SEASONS.values()}
    used = 0
    for row in range(1, dc.max_row + 1):
        season = SEASONS.get(str(dc.cell(row=row, column=1).value or '').strip())
        d0, d1 = dc.cell(row=row, column=2).value, dc.cell(row=row, column=3).value
        if not season or not isinstance(d0, (dt.date, dt.datetime)) or not isinstance(d1, (dt.date, dt.datetime)):
            continue
        nights = (d1 - d0).days
        if nights <= 0:
            sys.exit(f'row {row}: the return date is not after the leave date')
        f = num(dc.cell(row=row, column=5).value)
        if f: flights[season].append(f)
        for k, slug in enumerate(slugs):
            total = num(dc.cell(row=row, column=first_col + k).value)
            if total:
                rates[season][slug].append(total / nights / 2); used += 1
    data = json.loads(DATA.read_text(encoding='utf-8'))
    P = data['pricing']
    std_fallback = num(st['B4'].value)
    P['flightUsd'] = {s: (min(v) if v else (std_fallback if s == 'standard' else None)) for s, v in flights.items()}
    P['rates'] = {s: {slug: round(min(v), 2) for slug, v in per.items() if v} for s, per in rates.items()}
    shared = {slugs[i]: num(rs.cell(row=4 + i, column=5).value) for i in range(len(slugs))}
    P['transferPp'] = {k: v for k, v in shared.items() if v}
    fx = num(st['B8'].value)
    if fx: P['mxnPerUsd'] = fx
    P['ratesSource'] = f'{Path(path).name}, loaded {dt.date.today().isoformat()}: {used} room prices'
    DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('flights', P['flightUsd'])
    for s, per in P['rates'].items():
        print(s, per)
    print('shared transfers', P['transferPp'] or 'none (car split stays)', '| peso rate', P['mxnPerUsd'])

if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])

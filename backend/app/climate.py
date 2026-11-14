"""Climate diagnosis from NASA POWER daily data for one grid cell. numpy + stdlib.

Every field in a cell (0.5 x 0.625 degrees, about 55 x 42 km) gets the same weather: this is regional
context, not field-level measurement.  Ported from docs/research/climate-attribution/
(climate_metrics.py, diagnose.py); the crop-stage dates are internal and never returned."""
import datetime as dt
import json
import math
import os
import time

import numpy as np

from . import constants as K
from .series import UpstreamError

POWER = "https://power.larc.nasa.gov/api/temporal/daily/point"
ORIGIN = dt.date(K.POWER_START_YEAR, 1, 1)
DAY = dt.timedelta(days=1)


def cell_of(lat, lon):
    """-> (cache key, centre latitude, centre longitude) of the NASA POWER grid cell holding a point."""
    i, j = round(lat / K.CELL_LAT), round(lon / K.CELL_LON)
    return f"{i}_{j}", i * K.CELL_LAT, j * K.CELL_LON


def write_json(path, obj):
    """Atomic: a reader never sees a half-written file."""
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f"{path.name}.{os.getpid()}.tmp")
    tmp.write_text(json.dumps(obj, separators=(",", ":")))
    os.replace(tmp, path)


async def load_cell(c, lat, lon):
    """Daily series of the cell holding (lat, lon), from $DATA_DIR/climate/<cell>.json or NASA POWER.
    -> {"lat", "lon", "data": {parameter: [value or None per day from 1 Jan 1981]}}"""
    key, clat, clon = cell_of(lat, lon)
    path = K.DATA_DIR / "climate" / f"{key}.json"
    if path.exists() and time.time() - path.stat().st_mtime < K.CLIMATE_CACHE_HOURS * 3600:
        return json.loads(path.read_text())
    try:
        r = await c.get(POWER, timeout=90, params={"parameters": K.POWER_PARAMS, "community": "AG", "latitude": clat, "longitude": clon,
                                                   "start": f"{K.POWER_START_YEAR}0101", "end": dt.date.today().strftime("%Y%m%d"), "format": "JSON"})
        r.raise_for_status()
        par = r.json()["properties"]["parameter"]
        days = sorted(par["T2M"])
        if days[0] != ORIGIN.strftime("%Y%m%d") or len(days) != (dt.datetime.strptime(days[-1], "%Y%m%d").date() - ORIGIN).days + 1:
            raise ValueError("NASA POWER returned a series with missing days")
    except Exception as e:
        if path.exists():
            return json.loads(path.read_text())            # NASA POWER is down: the last copy is good enough
        raise UpstreamError("The climate data service (NASA POWER) did not answer. Please try again in a minute.") from e
    cell = {"lat": clat, "lon": clon, "data": {p: [None if v[d] == -999 else v[d] for d in days] for p, v in par.items()}}
    write_json(path, cell)
    return cell


# ---------- small helpers ----------
def longest_run(mask):
    best = cur = 0
    for v in mask:
        cur = cur + 1 if v else 0
        best = max(best, cur)
    return best


def pct_rank(value, sample):
    """Empirical percentile (0-100) of value within sample (mid-rank)."""
    s = np.asarray(sample, float)
    if not np.isfinite(value):
        return float("nan")
    return 100.0 * (np.sum(s < value) + 0.5 * np.sum(s == value)) / len(s)


def theil_sen(y):
    """Median pairwise slope per step (per year)."""
    y = np.asarray(y, float)
    i, j = np.triu_indices(len(y), 1)
    return float(np.median((y[j] - y[i]) / (j - i)))


def mann_kendall_p(y):
    """Two-sided p of the Mann-Kendall trend test, tie-corrected, normal approximation."""
    y = np.asarray(y, float)
    n = len(y)
    i, j = np.triu_indices(n, 1)
    s = int(np.sum(np.sign(y[j] - y[i])))
    _, counts = np.unique(y, return_counts=True)
    var = (n * (n - 1) * (2 * n + 5) - np.sum(counts * (counts - 1) * (2 * counts + 5))) / 18
    z = 0.0 if s == 0 or var <= 0 else (s - np.sign(s)) / math.sqrt(var)
    return 2 * (1 - 0.5 * (1 + math.erf(abs(z) / math.sqrt(2))))


def htc_class(h):
    return next((name for edge, name in K.HTC_CLASSES if h < edge), "excess moisture")


def _htc(p, t):
    """Selyaninov hydrothermal coefficient: rain / (0.1 * sum of daily mean temperature), over days above 10 C."""
    act = t > K.HTC_ACTIVE_T
    return float(np.nansum(p[act]) / max(0.1 * np.nansum(t[act]), 1e-9))


# ---------- the analysis ----------
def analyse_cell(cell):
    """-> (the `climate` block of the contract, profile inputs {"rainMeanMm", "water", "heat", "frost", "years"})."""
    raw = {k: np.array([np.nan if v is None else v for v in a], float) for k, a in cell["data"].items()}
    ok = np.flatnonzero(np.isfinite(raw["T2M"]) & np.isfinite(raw["PRECTOTCORR"]))
    last_day = ORIGIN + int(ok[-1]) * DAY
    pad = (dt.date(last_day.year, 12, 31) - ORIGIN).days + 1 - len(raw["T2M"])     # windows may reach past the last day served
    t, tx, tn, p, groot, gtop = (np.concatenate([raw[k], np.full(max(pad, 0), np.nan)])
                                 for k in ("T2M", "T2M_MAX", "T2M_MIN", "PRECTOTCORR", "GWETROOT", "GWETTOP"))
    sl = lambda a, b: slice((a - ORIGIN).days, (b - ORIGIN).days + 1)              # inclusive window of days
    # a season counts once its data reach 30 September
    years = [y for y in range(K.POWER_START_YEAR, last_day.year + 1) if dt.date(y, 9, 30) <= last_day]
    base = range(K.NORMAL_YEARS[0], K.NORMAL_YEARS[1] + 1)

    def season(y):
        w = sl(dt.date(y, 5, 1), dt.date(y, 8, 31))
        k = int(np.nanargmax(tx[w]))
        aut = sl(dt.date(y, *K.AUTUMN_FROST_WINDOW[0]), dt.date(y, *K.AUTUMN_FROST_WINDOW[1]))
        frost = np.flatnonzero(tn[aut] <= 0)
        fmin, f0, f1 = K.PROFILE_FROST
        return {"year": y, "rainMayAug": float(np.nansum(p[w])),
                "rainOctApr": float(np.nansum(p[sl(dt.date(y - 1, 10, 1), dt.date(y, 4, 30))])) if y > K.POWER_START_YEAR else None,
                "hotDays30": int(np.sum(tx[w] >= K.HOT_DAY)), "htc": _htc(p[w], t[w]),
                "tmaxPeak": float(tx[w][k]), "tmaxPeakDate": str(dt.date(y, 5, 1) + k * DAY),
                "longestDrySpell": longest_run(p[w] < K.WET_DAY),
                "firstAutumnFrost": str(dt.date(y, *K.AUTUMN_FROST_WINDOW[0]) + int(frost[0]) * DAY) if len(frost) else None,
                "_frost": bool(np.any(tn[sl(dt.date(y, *f0), dt.date(y, *f1))] <= fmin))}

    S = {y: season(y) for y in years}
    normals = {k: float(np.mean([S[y][k] for y in base])) for k in ("rainMayAug", "rainOctApr", "hotDays30", "htc")}

    def ranked(fn, a, b, y):
        """fn over the window [a, b] of year y -> (value, percent of the normal-period mean, percentile).
        Every value is ranked against the SAME calendar window, so a wet July cannot hide a dry May and June."""
        v = fn(sl(a, b))
        ref = [fn(sl(a.replace(year=r), b.replace(year=r))) for r in base]
        mean = float(np.mean(ref))
        return v, (100 * v / mean if mean else float("nan")), pct_rank(v, ref)

    def causes(y):
        sow = dt.date(y, *K.SOWING)
        grow = sl(sow, dt.date(y, 10, 15))
        gdd = np.cumsum(np.maximum(np.nan_to_num(t[grow]), 0))                     # degree days above 0 C from sowing
        at = lambda stage: sow + int(min(np.searchsorted(gdd, K.GDD[stage]), len(gdd) - 1)) * DAY
        emergence, jointing, anthesis, maturity = (at(k) for k in ("emergence", "jointing", "anthesis", "maturity"))
        a0, a1 = anthesis - K.FLOWER_HALF_WINDOW * DAY, anthesis + K.FLOWER_HALF_WINDOW * DAY   # flowering window
        pre, fill = (sow, a1), (a1 + DAY, max(maturity, a1 + DAY))                 # sets grain number; sets grain weight
        harvest = (dt.date(y, *K.HARVEST_WINDOW[0]), dt.date(y, *K.HARVEST_WINDOW[1]))
        rain = lambda w: float(np.nansum(p[w]))
        sc = {k: 0 for k in K.FLAG_AT}
        ev = {k: [] for k in K.FLAG_AT}

        def add(k, pts, text):
            sc[k] += pts
            ev[k].append(text)

        # --- water deficit
        v, pct, _ = ranked(rain, *pre, y)
        if pct <= K.RAIN_PRE_PCT[1]:
            add("water_deficit", 2 if pct <= K.RAIN_PRE_PCT[0] else 1, f"Rain from sowing to the end of flowering was {v:.0f} mm, {pct:.0f}% of normal for those weeks.")
        h = _htc(p[sl(*pre)], t[sl(*pre)])
        if h < K.HTC_PRE[1]:
            add("water_deficit", 2 if h < K.HTC_PRE[0] else 1, f"The hydrothermal coefficient (rain set against heat) from sowing to flowering was {h:.2f}; under {K.HTC_PRE[1]} is severe drought.")
        v, _, pctl = ranked(lambda w: longest_run(p[w] < K.WET_DAY), *pre, y)
        if v >= K.DRY_SPELL_DAYS and pctl >= K.TOP_QUARTER:
            add("water_deficit", 1, f"The longest dry spell before flowering lasted {v} days, among the longest quarter of years.")
        wet = lambda w: float(np.nanmean(groot[w]))
        if min(ranked(wet, a0, a1, y)[2], ranked(wet, *fill, y)[2]) <= K.GWET_DRY_PCTL:
            add("water_deficit", 1, "Modelled root-zone soil wetness around flowering or grain fill was in the driest fifth of years.")
        # --- heat at a sensitive stage
        hot = lambda thr: lambda w: int(np.sum(tx[w] >= thr))
        v = hot(K.HEAT_SEVERE[0])(sl(a0, a1))
        if v >= K.HEAT_SEVERE[1]:
            add("heat", 2, f"{v} days reached {K.HEAT_SEVERE[0]:.0f} °C or more around flowering.")
        v, _, pctl = ranked(hot(K.HEAT_FLOWER[0]), a0, a1, y)
        if v >= K.HEAT_FLOWER[1] and pctl >= K.TOP_QUARTER:
            add("heat", 2, f"{v} days reached {K.HEAT_FLOWER[0]:.0f} °C or more around flowering, among the hottest quarter of years.")
        v, _, pctl = ranked(hot(K.HEAT_SEVERE[0]), *fill, y)
        if v >= K.HEAT_SEVERE[1] and pctl >= K.TOP_QUARTER:
            add("heat", 2, f"{v} days reached {K.HEAT_SEVERE[0]:.0f} °C or more while the grain was filling, among the hottest quarter of years.")
        # --- frost
        low = lambda a, b: float(np.nanmin(tn[sl(a, b)])) if b >= a else float("inf")
        if (v := low(emergence, jointing - DAY)) <= K.FROST_SEEDLING:
            add("frost", 2, f"The night minimum fell to {v:.1f} °C while the crop was at seedling stage.")
        if (v := low(jointing, a1)) <= K.FROST_FLOWER:
            add("frost", 3, f"The night minimum fell to {v:.1f} °C between stem elongation and flowering, the most frost-sensitive stage.")
        if (v := low(*fill)) <= K.FROST_FILL:
            add("frost", 2, f"The night minimum fell to {v:.1f} °C while the grain was filling.")
        # --- excess rain at harvest
        v, pct, pctl = ranked(rain, *harvest, y)
        if pctl >= K.WET_PCTL[0]:
            add("wet_harvest", 1, f"Rain from 15 August to 20 September was {v:.0f} mm, {pct:.0f}% of normal.")
        v, _, pctl = ranked(lambda w: int(np.sum(p[w] >= K.WET_DAY)), *harvest, y)
        if pctl >= K.WET_PCTL[1]:
            add("wet_harvest", 1, f"{v} days had rain in the harvest window (15 August to 20 September).")
        if ranked(lambda w: float(np.nanmean(gtop[w])), *harvest, y)[2] >= K.WET_PCTL[2]:
            add("wet_harvest", 1, "Modelled topsoil wetness in the harvest window was in the wettest 15% of years.")
        # confidence "low" is never used: it needs a regional NDVI check or a second rain source, which this build lacks
        return [{"type": k, "confidence": "high" if sc[k] >= K.FLAG_AT[k] + K.HIGH_CONFIDENCE_EXTRA else "medium", "evidence": ev[k]}
                for k in sc if sc[k] >= K.FLAG_AT[k]]

    out = []
    for y in years:
        if y < K.CLIMATE_FIRST_YEAR:
            continue
        s = S[y]
        out.append({"year": y, "rainMayAug": round(s["rainMayAug"], 1), "rainMayAugPct": round(100 * s["rainMayAug"] / normals["rainMayAug"]),
                    "rainOctApr": round(s["rainOctApr"], 1), "rainOctAprPct": round(100 * s["rainOctApr"] / normals["rainOctApr"]),
                    "hotDays30": s["hotDays30"], "htc": round(s["htc"], 2), "htcClass": htc_class(s["htc"]),
                    "tmaxPeak": round(s["tmaxPeak"], 1), "tmaxPeakDate": s["tmaxPeakDate"], "longestDrySpell": s["longestDrySpell"],
                    "firstAutumnFrost": s["firstAutumnFrost"], "causes": causes(y)})

    climate = {"cell": {"lat": cell["lat"], "lon": cell["lon"]},
               "normals": {"rainMayAug": round(normals["rainMayAug"], 1), "rainOctApr": round(normals["rainOctApr"], 1),
                           "hotDays30": round(normals["hotDays30"], 1), "htc": round(normals["htc"], 2)},
               "seasons": out,
               "droughtYears": [s["year"] for s in out if any(c["type"] == "water_deficit" for c in s["causes"])],
               "trendNote": trend_note([s["year"] for s in out], [s["rainMayAug"] for s in out], [s["hotDays30"] for s in out])}
    # stress profile from the FULL record (formulas: docs/research/kazakhstan-agronomy/README.md, on the 1991-2020 normal)
    clip = lambda x: min(1.0, max(0.0, x))
    profile = {"rainMeanMm": round(normals["rainMayAug"], 1),
               "water": round(float(np.mean([clip((1 - S[y]["rainMayAug"] / normals["rainMayAug"]) / K.WATER_FULL_DEFICIT) for y in years])), 2),
               "heat": round(float(np.mean([clip((S[y]["hotDays30"] - K.HEAT_RANGE[0]) / K.HEAT_RANGE[1]) for y in years])), 2),
               "frost": round(float(np.mean([S[y]["_frost"] for y in years])), 2),
               "years": [years[0], years[-1]]}
    return climate, profile


def trend_note(years, rain, hot):
    """One honest sentence from Theil-Sen slopes and Mann-Kendall tests on May-Aug rain and hot days."""
    span = f"from {years[0]} to {years[-1]}"
    found = []
    for name, unit, y in (("May to August rain", " mm", rain), (f"the number of days at {K.HOT_DAY:.0f} °C or more", " days", hot)):
        p = mann_kendall_p(y)
        if p < K.TREND_P:
            slope = theil_sen(y) * 10
            found.append(f"{name} has {'risen' if slope > 0 else 'fallen'} by about {abs(slope):.0f}{unit} per decade (p = {p:.2f})")
    if not found:
        return (f"We tested May to August rain and the number of hot days ({K.HOT_DAY:.0f} °C or more) for a trend {span} and found no clear trend; "
                "the risk is year-to-year variability.")
    rest = "" if len(found) == 2 else "; the other measure shows no clear trend"
    return (f"In this weather record, {span}, " + " and ".join(found) + rest +
            "; this is one modelled dataset for a 50 km cell, so it suggests a tendency rather than proving a climate trend.")

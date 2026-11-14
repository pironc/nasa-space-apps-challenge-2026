"""Climate diagnosis from NASA POWER daily data for one grid cell. numpy + stdlib.

Every field in a cell (0.5 x 0.625 degrees, about 55 x 42 km) gets the same weather: this is regional
context, not field-level measurement.  Ported from docs/research/climate-attribution/
(climate_metrics.py, diagnose.py); the crop-stage dates are internal and never returned."""
import datetime as dt
import json
import math
import os
import time
import warnings

import numpy as np

from . import constants as K
from .series import UpstreamError

POWER = "https://power.larc.nasa.gov/api/temporal/daily/point"
ORIGIN = dt.date(K.POWER_START_YEAR, 1, 1)
DAY = dt.timedelta(days=1)
ROOT_DRY = "NASA POWER modelled root-zone wetness for the area was in the driest fifth of years in May and June."


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
    """Moisture supply class. A dry class is this climate's normal, not a drought (see DROUGHT_PCTL)."""
    return next((name for edge, name in K.HTC_CLASSES if h < edge), "wet")


def _htc(p, t):
    """Selyaninov hydrothermal coefficient: rain / (0.1 * sum of daily mean temperature), over days above 10 C."""
    act = t > K.HTC_ACTIVE_T
    return float(np.nansum(p[act]) / max(0.1 * np.nansum(t[act]), 1e-9))


# ---------- the analysis ----------
def analyse_cell(cell):
    """-> (the `climate` block of the contract, profile inputs {"rainMeanMm", "water", "heat", "frost", "years"},
    {year: {"water_deficit" or "heat": the date by which the season was already flagged}} for the robust flags,
    hot_before(year, end) -> bool: was it unusually hot from sowing to `end`, like for like against the same dates of other years).
    The heat date is when the 90-day count was reached, usually after a July peak: use hot_before to test heat against a peak.
    Every percent, percentile and "usual" refers to the 1991-2020 values of this cell."""
    raw = {k: np.array([np.nan if v is None else v for v in a], float) for k, a in cell["data"].items()}
    ok = np.flatnonzero(np.isfinite(raw["T2M"]) & np.isfinite(raw["PRECTOTCORR"]))
    last_day = ORIGIN + int(ok[-1]) * DAY
    pad = (dt.date(last_day.year, 12, 31) - ORIGIN).days + 1 - len(raw["T2M"])     # windows may reach past the last day served
    t, tx, tn, p, gtop, groot = (np.concatenate([raw[k], np.full(max(pad, 0), np.nan)])
                                 for k in ("T2M", "T2M_MAX", "T2M_MIN", "PRECTOTCORR", "GWETTOP", "GWETROOT"))
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
        return v, (100 * v / mean if mean else None), pct_rank(v, ref)   # no percent of a zero mean

    # Sowing-dependent descriptors for every year at once, so each year is set against the cell's own 1991-2020 values.
    bi = [years.index(y) for y in base]
    listed = [i for i, y in enumerate(years) if y >= K.CLIMATE_FIRST_YEAR]
    day = lambda d: f"{d.day} {d:%B}"
    D = {}
    for md in K.SOWINGS:
        sows = [dt.date(y, *md) for y in years]
        # rain in each 40-day window (rows: start 0, 5, ... 30 days after sowing), as a share of the normal for the same dates
        mm = np.array([[np.nansum(p[sl(d + k * DAY, d + (k + K.DRY_WINDOW_DAYS - 1) * DAY)]) for d in sows] for k in K.DRY_STARTS])
        usual = mm[:, bi].mean(1, keepdims=True)
        share = np.where(usual > 0, mm / np.maximum(usual, 1e-9), 1.0)             # where it never rains, no rain is the usual: never NaN
        hot = np.array([tx[sl(d, d + K.HEAT_DAYS * DAY)] >= K.HOT_DAY for d in sows])
        D[md] = {"mm": mm, "share": share, "dry_at": min(K.DRY_RATIO, float(np.percentile(share.min(0)[bi], K.DRY_PCTL))),
                 "hot": hot, "hot_at": max(1.0, float(np.percentile(hot.sum(1)[bi], K.HEAT_PCTL)))}

    def tests(y, md):
        """One season, one sowing date -> {cause: (flagged, evidence lines, the number in a few words, date the flag was reached)}."""
        i, d, sow = years.index(y), D[md], dt.date(y, *md)
        out = {}
        # --- water: the driest 40-day window after sowing
        k = int(d["share"][:, i].argmin())
        v, a = float(d["share"][k, i]), sow + K.DRY_STARTS[k] * DAY
        first = np.flatnonzero(d["share"][:, i] <= d["dry_at"])
        out["water_deficit"] = (v <= d["dry_at"],
                                [f"The driest {K.DRY_WINDOW_DAYS} days after sowing ({day(a)} to {day(a + (K.DRY_WINDOW_DAYS - 1) * DAY)}) had {d['mm'][k, i]:.0f} mm of rain, "
                                 f"{100 * v:.0f}% of the 1991 to 2020 mean for the same dates."],
                                f"{100 * v:.0f}% of the usual rain in the driest {K.DRY_WINDOW_DAYS} days",
                                sow + (K.DRY_STARTS[first[0]] + K.DRY_WINDOW_DAYS - 1) * DAY if len(first) else None)
        # --- heat: hot days in the 90 days after sowing
        n = d["hot"].sum(1)
        v = int(n[i])
        reached = np.flatnonzero(np.cumsum(d["hot"][i]) >= d["hot_at"])
        out["heat"] = (v >= d["hot_at"],
                       [f"{v} days reached {K.HOT_DAY:.0f} °C or more in the {K.HEAT_DAYS} days after sowing, rank {1 + int(np.sum(n[listed] > v))} of {len(listed)} "
                        f"seasons since {K.CLIMATE_FIRST_YEAR} (1 = most hot days)."],
                       f"{v} days at {K.HOT_DAY:.0f} °C or more in the {K.HEAT_DAYS} days after sowing",
                       sow + int(reached[0]) * DAY if len(reached) else None)
        # --- frost at a sensitive stage (stage dates from degree days above 0 C; estimates, plus or minus 10 days)
        gdd = np.cumsum(np.maximum(np.nan_to_num(t[sl(sow, dt.date(y, 10, 15))]), 0))
        emergence, jointing, anthesis, maturity = (sow + int(min(np.searchsorted(gdd, K.GDD[k]), len(gdd) - 1)) * DAY for k in K.GDD)
        a1 = anthesis + K.FLOWER_HALF_WINDOW * DAY                                  # end of flowering
        fill = (a1 + DAY, max(maturity, a1 + DAY))
        low = lambda a, b: float(np.nanmin(tn[sl(a, b)])) if b >= a else float("inf")
        ev = [text for v, limit, text in (
            (low(emergence, jointing - DAY), K.FROST_SEEDLING, "while the crop was at seedling stage"),
            (low(jointing, a1), K.FROST_FLOWER, "between stem elongation and flowering, the most frost-sensitive stage"),
            (low(*fill), K.FROST_FILL, "while the grain was filling"))
              if v <= limit for text in [f"The night minimum fell to {v:.1f} °C {text} (stage dates are estimates, plus or minus 10 days)."]]
        out["frost"] = (bool(ev), ev, f"lowest night temperature from emergence to maturity {low(emergence, fill[1]):.1f} °C", None)
        # --- excess rain at harvest: fixed calendar window, so the sowing date does not matter
        harvest = (dt.date(y, *K.HARVEST_WINDOW[0]), dt.date(y, *K.HARVEST_WINDOW[1]))
        ev = []
        v, pct, pctl = ranked(lambda w: float(np.nansum(p[w])), *harvest, y)
        if pctl >= K.WET_PCTL[0]:
            ev.append(f"Rain from 15 August to 20 September was {v:.0f} mm" + ("." if pct is None else f", {pct:.0f}% of the 1991 to 2020 mean."))
        v, _, pctl = ranked(lambda w: int(np.sum(p[w] >= K.WET_DAY)), *harvest, y)
        if pctl >= K.WET_PCTL[1]:
            ev.append(f"{v} days had rain in the harvest window (15 August to 20 September).")
        if ranked(lambda w: float(np.nanmean(gtop[w])), *harvest, y)[2] >= K.WET_PCTL[2]:
            ev.append("Modelled topsoil wetness in the harvest window was in the wettest 15% of years.")
        out["wet_harvest"] = (len(ev) >= 2, ev, "", None)
        return out

    def causes(y):
        """-> (the season's causes, {cause: date} for robust dry or hot flags).
        A cause is robust only when it is flagged for every sowing date; flagged for some, it is shown as numbers."""
        res = [tests(y, md) for md in K.SOWINGS]
        out, ends = [], {}
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")                                         # a window with no wetness values ranks as NaN: no line
            root = ([ROOT_DRY] if ranked(lambda w: float(np.nanmean(groot[w])), dt.date(y, *K.ROOT_WINDOW[0]), dt.date(y, *K.ROOT_WINDOW[1]), y)[2]
                    <= K.ROOT_DRY_PCTL else [])
        for k in res[0]:
            hits = [r[k][0] for r in res]
            if all(hits):
                out.append({"type": k, "robust": True, "evidence": res[1][k][1] + root * (k == "water_deficit")})
                if res[0][k][3]:
                    ends[k] = max(r[k][3] for r in res)                             # reached at every sowing date by then
            elif any(hits):
                out.append({"type": k, "robust": False, "evidence": root * (k == "water_deficit") + [
                    "If " + "; ".join(f"sown on {day(dt.date(y, *md))}: {r[k][2]}" for md, r in zip(K.SOWINGS, res))
                    + f". Unusual for {sum(hits)} of the {len(hits)} sowing dates only, so this depends on the sowing date."]})
        return out, ends

    def hot_before(y, end):
        """Hot days from sowing to `end` (the last day of the peak's ten-day bin), set against the SAME dates of the normal period:
        True when the count is at or above the cell's HEAT_PCTL percentile for every sowing date."""
        def unusual(md):
            n = lambda r: int(np.sum(tx[sl(dt.date(r, *md), end.replace(year=r))] >= K.HOT_DAY))
            return n(y) >= max(1.0, float(np.percentile([n(r) for r in base], K.HEAT_PCTL)))
        return y in S and all(unusual(md) for md in K.SOWINGS)

    percent = lambda v, usual: round(100 * v / usual) if usual else 100             # a rainless normal: 0 of 0 is "as usual", never a division by zero
    pctl = dict(zip(("drought", "severe"), np.percentile([S[y]["htc"] for y in base], K.DROUGHT_PCTL)))
    htcs = sorted(S[years[i]]["htc"] for i in listed)
    out, flags = [], {}
    for y in years:
        if y < K.CLIMATE_FIRST_YEAR:
            continue
        s = S[y]
        found, flags[y] = causes(y)
        out.append({"year": y, "rainMayAug": round(s["rainMayAug"], 1), "rainMayAugPct": percent(s["rainMayAug"], normals["rainMayAug"]),
                    "rainOctApr": round(s["rainOctApr"], 1), "rainOctAprPct": percent(s["rainOctApr"], normals["rainOctApr"]),
                    "hotDays30": s["hotDays30"], "htc": round(s["htc"], 2), "htcClass": htc_class(s["htc"]),
                    "htcRank": 1 + htcs.index(s["htc"]), "htcRankOf": len(htcs),
                    "drought": "severe" if s["htc"] <= pctl["severe"] else "drought" if s["htc"] <= pctl["drought"] else "none",
                    "tmaxPeak": round(s["tmaxPeak"], 1), "tmaxPeakDate": s["tmaxPeakDate"], "longestDrySpell": s["longestDrySpell"],
                    "firstAutumnFrost": s["firstAutumnFrost"], "causes": found})

    climate = {"cell": {"lat": cell["lat"], "lon": cell["lon"]},
               "normals": {"rainMayAug": round(normals["rainMayAug"], 1), "rainOctApr": round(normals["rainOctApr"], 1),
                           "hotDays30": round(normals["hotDays30"], 1), "htc": round(normals["htc"], 2)},
               "seasons": out,
               "droughtYears": [s["year"] for s in out if s["drought"] != "none"],
               "trendNote": trend_note([s["year"] for s in out], [s["rainMayAug"] for s in out], [s["hotDays30"] for s in out])}
    # stress profile from the FULL record (formulas: docs/research/kazakhstan-agronomy/README.md, on the 1991-2020 normal)
    clip = lambda x: min(1.0, max(0.0, x))
    profile = {"rainMeanMm": round(normals["rainMayAug"], 1),
               "water": round(float(np.mean([clip((1 - S[y]["rainMayAug"] / max(normals["rainMayAug"], 1e-9)) / K.WATER_FULL_DEFICIT) for y in years])), 2),
               "heat": round(float(np.mean([clip((S[y]["hotDays30"] - K.HEAT_RANGE[0]) / K.HEAT_RANGE[1]) for y in years])), 2),
               "frost": round(float(np.mean([S[y]["_frost"] for y in years])), 2),
               "years": [years[0], years[-1]]}
    return climate, profile, flags, hot_before


def trend_note(years, rain, hot):
    """One honest sentence from Theil-Sen slopes and Mann-Kendall tests on May-Aug rain and hot days."""
    span = f"{years[0]} to {years[-1]}"
    found = []
    for name, unit, y in (("May to August rain", " mm", rain), (f"the number of days at {K.HOT_DAY:.0f} °C or more", " days", hot)):
        p = mann_kendall_p(y)
        if p < K.TREND_P:
            slope = theil_sen(y) * 10
            found.append(f"{name} has {'risen' if slope > 0 else 'fallen'} by about {abs(slope):.0f}{unit} per decade (p = {p:.2f})")
    if not found:
        return (f"NASA POWER shows no clear trend in May to August rain or in the number of days at {K.HOT_DAY:.0f} °C or more for this grid cell ({span}). "
                "Mean temperature was not tested. We make no trend claim.")
    rest = "" if len(found) == 2 else "; the other measure shows no clear trend"
    return (f"In the NASA POWER record for this grid cell ({span}), " + " and ".join(found) + rest +
            ". Mean temperature was not tested. One modelled dataset for a 50 km cell is not proof of a climate trend.")

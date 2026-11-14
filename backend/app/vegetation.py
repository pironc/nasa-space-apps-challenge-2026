"""Per-field vegetation analysis: dekad series, land use per year, verdicts. numpy only.

Input: per-scene rows for ONE field (date, clear, snow and the field median of ndvi, ndmi, nbr2 over
clear pixels, already offset-corrected).  Ported from docs/research/vegetation-analysis/vegspec.py, with
the rule changes of docs/research/plan-review/README.md (remote-sensing scientist and agronomist)."""
import datetime as dt
import warnings

import numpy as np

from . import constants as K

N = K.D1 - K.D0 + 1
I = lambda m, d: (m - 1) * 3 + min((d - 1) // 10, 2) - K.D0      # season index of the dekad holding a calendar date
PRE = slice(I(5, 1), I(5, 21) + 1)        # 1-31 May: spring-sown crops cannot be green yet
MID = slice(I(6, 21), I(8, 1) + 1)        # 21 Jun-10 Aug: spring-crop canopy window
PEAK = slice(I(6, 1), I(8, 11) + 1)       # 1 Jun-20 Aug: the peak and the season total are read here only
HARVEST_FROM = I(8, 11)                   # from 11 Aug an NDVI fall is ripening or harvest, never a finding
VARS = ("ndvi", "ndmi", "nbr2")
DEKADS = [f"{d} {m}" for m in ("May", "Jun", "Jul", "Aug", "Sep") for d in (1, 11, 21)]


def dekad_of_year(d):
    return (d.month - 1) * 3 + min((d.day - 1) // 10, 2)


def dekad_end(year, i):
    """Last day of season bin i."""
    k = K.D0 + i + 1
    return dt.date(year, k // 3 + 1, k % 3 * 10 + 1) - dt.timedelta(days=1)


def records(rows):
    """Rows from series.s2_series -> dict of equal-length arrays."""
    rec = {"date": np.array([dt.date.fromisoformat(r["date"]) for r in rows], dtype=object)}
    for k in ("clear", "snow") + VARS:
        rec[k] = np.array([np.nan if r[k] is None else r[k] for r in rows], float)
    return rec


def despike(t, v):
    """Cloud and shadow leaks only lower NDVI: drop a pass lower than BOTH neighbours by more than SPIKE_DROP."""
    keep = np.ones(len(v), bool)
    for i in range(1, len(v) - 1):
        if t[i] - t[i - 1] <= K.SPIKE_WIN and t[i + 1] - t[i] <= K.SPIKE_WIN and v[i] < v[i - 1] - K.SPIKE_DROP and v[i] < v[i + 1] - K.SPIKE_DROP:
            keep[i] = False
    return keep


def fill_gaps(y):
    y = y.copy()
    idx = np.flatnonzero(np.isfinite(y))
    for a, b in zip(idx[:-1], idx[1:]):
        if 1 < b - a <= K.MAX_GAP + 1:
            y[a:b + 1] = np.interp(np.arange(a, b + 1), [a, b], [y[a], y[b]])
    return y


def build_year(rec, year):
    """-> {var: 15 dekad values, 'obs': accepted passes per dekad}."""
    dates = rec["date"]
    m = np.array([d.year == year and K.D0 <= dekad_of_year(d) <= K.D1 for d in dates], bool) \
        & (rec["clear"] >= K.MIN_CLEAR) & (rec["snow"] < K.MAX_SNOW) & np.isfinite(rec["ndvi"])
    t = np.array([d.toordinal() for d in dates[m]], int)
    o = np.argsort(t)
    t = t[o]
    keep = despike(t, rec["ndvi"][m][o]) if len(t) > 2 else np.ones(len(t), bool)
    dk = np.array([dekad_of_year(dt.date.fromordinal(int(x))) - K.D0 for x in t[keep]], int)
    out = {"obs": np.bincount(dk, minlength=N)[:N]}
    for v in VARS:
        x = rec[v][m][o][keep]
        y = np.full(N, np.nan)
        for j in np.unique(dk):
            y[j] = np.median(x[dk == j])                       # dekad value = median of the accepted passes
        out[v] = fill_gaps(y)
    return out


def _max(a): return float(np.nanmax(a)) if np.isfinite(a).any() else np.nan
def _med(a): return float(np.nanmedian(a)) if np.isfinite(a).any() else np.nan


def metrics(s, declared=None):
    """Per-year metrics and land-use label from one year's dekad series. First matching label wins.
    declared: "crop", "fallow" or None, the land use stated by the field's owner; it wins over the label ("eff")."""
    nd = s["ndvi"]
    m = {"n_mid": int(np.isfinite(nd[MID]).sum()), "pre": _med(nd[PRE]), "mid_max": _max(nd[MID]), "peak": _max(nd[PEAK]), "declared": declared}
    m["peak_i"] = PEAK.start + int(np.nanargmax(nd[PEAK])) if np.isfinite(m["peak"]) else -1
    m["ndmi_peak"] = float(s["ndmi"][m["peak_i"]]) if m["peak_i"] >= 0 else np.nan
    m["n_green"] = int(np.nansum(nd >= K.GREEN))
    if m["n_mid"] < K.MIN_MID_DEKADS:
        m["use"] = "unknown"
    elif m["pre"] >= K.GREEN_PRE:
        m["use"] = "early_green"                               # perennial grass, hay, winter crop, weeds
    elif m["mid_max"] < K.FALLOW_MAX:
        m["use"] = "fallow"
    elif m["mid_max"] < K.GREEN or m["n_green"] < K.MIN_GREEN_DEKADS:
        m["use"] = "ambiguous"                                 # weedy fallow OR failed or sparse crop
    else:
        m["use"] = "cropped"
    m["eff"] = {"crop": "cropped", "fallow": "fallow"}.get(declared, m["use"])
    return m


def baseline(series, mets, year=None):
    """Statistics over the cropped seasons other than `year` (declared crop, or read as cropped with no
    declaration). None when there are fewer than MIN_BASELINE_YEARS."""
    yrs = [y for y in series if y != year and mets[y]["eff"] == "cropped" and mets[y]["peak_i"] >= 0]
    if len(yrs) < K.MIN_BASELINE_YEARS:
        return None
    nd = np.array([series[y]["ndvi"] for y in yrs])
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")                        # all-empty dekads stay NaN
        return {"years": yrs, "med": np.nanmedian(nd, 0), "p25": np.nanpercentile(nd, 25, 0), "p75": np.nanpercentile(nd, 75, 0),
                "peak_med": float(np.median([mets[y]["peak"] for y in yrs])),
                "peak_i": int(round(float(np.median([mets[y]["peak_i"] for y in yrs])))),
                "ndmi_peak_med": _med(np.array([mets[y]["ndmi_peak"] for y in yrs]))}


def _run(mask):
    best = cur = 0
    for x in mask:
        cur = cur + 1 if x else 0
        best = max(best, cur)
    return best


DEFICIT_TITLE = {"watch": "Peak greenness a little below this field's normal",
                 "warning": "Peak greenness well below this field's normal",
                 "severe": "Peak greenness far below this field's normal"}
V = lambda type, severity, title, detail: {"type": type, "severity": severity, "title": title, "detail": detail}
NOTE = lambda title, detail: V("NOTE", "info", title, detail)


def verdicts(series, mets, year, upto=None):
    """Findings for one season -> ([{type, severity, title, detail}], peak ratio).
    The ratio (windowed peak / usual peak) is None unless the season was judged as a crop against its baseline.
    upto: last season index reached (a season still running); None = the whole season."""
    s, m = series[year], mets[year]
    last = N - 1 if upto is None else upto
    nd = s["ndvi"].copy()
    nd[last + 1:] = np.nan
    use = m["eff"]
    n_obs = int(np.isfinite(nd).sum())
    if use == "unknown" or n_obs < K.MIN_SEASON_DEKADS:
        what = f"Only {n_obs} of the season's {N} ten-day periods" if n_obs < K.MIN_SEASON_DEKADS else \
               f"Only {m['n_mid']} of the {MID.stop - MID.start} ten-day periods in the main growing window (21 June to 10 August)"
        return [V("INSUFFICIENT_DATA", "info", "Too few clear satellite passes to judge this season",
                  f"{what} had a cloud-free view of the field, too few to read the season's peak.")], None
    b = baseline(series, mets, year)
    pk = _max(nd[PEAK])
    pi = PEAK.start + int(np.nanargmax(nd[PEAK])) if np.isfinite(pk) else last
    if b is not None and b["peak_med"] < K.MIN_BASELINE_PEAK:
        b = None
    if use == "ambiguous":                                     # weedy fallow or failed crop: ask, never judge
        share = f" (peak {pk / b['peak_med'] * 100:.0f}% of this field's usual)" if b and np.isfinite(pk) else ""
        return [V("LAND_USE_UNCLEAR", "info", "Failed crop or fallow year? The satellite cannot tell",
                  f"Low green cover in {year}{share}. Was this a crop that failed, or a fallow year? Tell us to complete the analysis.")], None
    out = []
    # BARE_SOIL: 30 days in a row bare AND tilled. Crop years: inside 21 Jun-10 Aug only (August stubble is
    # harvest, not a finding). Fallow years: to 31 Aug, as information.
    fallow = use == "fallow"
    w = slice(MID.start, min(I(8, 21) if fallow else MID.stop - 1, last) + 1)
    bare = nd[w] < K.BARE_NDVI
    if _run(bare) >= K.BARE_RUN_DEKADS and _med(s["nbr2"][w][bare]) < K.TILLED_NBR2:
        span = (f"NDVI (a 0 to 1 greenness index) stayed under {K.BARE_NDVI} for {_run(bare) * 10} days in a row between 21 June and "
                f"{'31 August' if fallow else '10 August'} and the surface looked like tilled soil")
        out.append(V("BARE_SOIL", "info", "Bare through the summer: a fallow year", f"{span}; a fallow year is a choice, not crop stress.") if fallow else
                   V("BARE_SOIL", "warning", "Bare soil in mid-season", f"{span}, so the soil had no growing cover for that time."))
    if fallow:
        return out, None                                       # a fallow year is never stress
    if b is None:
        return out + [V("NO_BASELINE", "info", "Not enough comparable seasons to judge this year",
                        f"A comparison needs at least {K.MIN_BASELINE_YEARS} other cropped seasons of this field with a usual peak NDVI of {K.MIN_BASELINE_PEAK} or more, "
                        "and they were not found, so this season was not checked for a deficit.")], None
    # VEG_DEFICIT: the season has peaked, and peaked low (independent of sowing date and crop timing)
    if not (last >= HARVEST_FROM or (last - pi >= 2 and np.isfinite(nd[last]) and nd[last] <= pk - K.PEAKED_DROP)):
        return out, None
    if _max(nd[PEAK.stop:]) > pk:
        out.append(NOTE("Late green cover not counted", "Green cover after 20 August (regrowth, weeds or a late-sown crop) is not counted as crop performance."))
    # data guard, whatever the land use: the peak must have been seen
    real = s["obs"] > 0
    real[last + 1:] = False
    near = real[max(b["peak_i"] - 1, 0):b["peak_i"] + 2].any()
    T = np.isfinite(nd[PEAK]) & np.isfinite(b["med"][PEAK])
    unseen = out + [NOTE("Peak not observed", f"Clear satellite passes covered {int(real[MID].sum())} of the {MID.stop - MID.start} ten-day periods from 21 June to 10 August"
                         f"{'' if near else ', none of them near the usual peak date of this field'}, and {int(T.sum())} of the {PEAK.stop - PEAK.start} periods from "
                         "1 June to 20 August have a value. Peak not observed (cloud): no judgement this season.")]
    if real[MID].sum() < K.MIN_REAL_MID_DEKADS or not near:
        return unseen, None
    ratio = pk / b["peak_med"]
    if ratio > K.DEFICIT_WATCH:
        return out, ratio
    if T.sum() < K.MIN_SHARED_DEKADS:                          # a low peak, and too many gaps to check the season total
        return unseen, None
    grow = lambda y: float(np.clip(y[PEAK][T] - K.SOIL_BASE, 0, None).sum())
    total = grow(nd) / max(grow(b["med"]), 1e-6)               # gates a level, never raises one
    if total >= K.TOTAL_GATE:
        return out + [NOTE("Lower peak, normal season total", f"Peak NDVI was {ratio * 100:.0f}% of usual but green cover summed from 1 June to 20 August was {total * 100:.0f}% of usual. "
                           "Lower peak but a normal season total: the crop or sowing date probably differs from earlier years.")], ratio
    sev = next(name for edge, name in K.DEFICIT if ratio <= edge)
    detail = (f"Peak NDVI {pk:.2f} (highest between 1 June and 20 August) was {ratio * 100:.0f}% of this field's usual {b['peak_med']:.2f}, "
              f"compared with {len(b['years'])} other cropped seasons since {K.S2_FIRST_YEAR}; green cover summed over those weeks was {total * 100:.0f}% of usual.")
    if m["declared"] == "crop" and m["use"] != "cropped":
        detail += " This year is judged as a crop because it was declared as one; the curve alone cannot tell a failed crop from a weedy fallow."
    if sev != "watch" and s["ndmi"][pi] - b["ndmi_peak_med"] <= -K.NDMI_DROP:
        detail += " The canopy moisture signal (NDMI) was also low at peak."
    return out + [V("VEG_DEFICIT", sev, DEFICIT_TITLE[sev], detail)], ratio


def modis_years(rows, use):
    """MODIS rows -> ([{year, peak, use}], median peak of the cropped years). Compare MODIS only with MODIS.
    use: {year: land use} from Sentinel-2 or a declaration, for the years from S2_FIRST_YEAR on. Before that
    the land use is not known: only an obviously bare summer (peak under MODIS_BARE_PEAK) is set apart."""
    by = {}
    for r in rows:
        if r["reliability"] <= K.MODIS_MAX_RELIABILITY:
            by.setdefault(int(r["date"][:4]), []).append(r["ndvi"])
    years = []
    for y in range(K.MODIS_FIRST_YEAR, max(by, default=K.MODIS_FIRST_YEAR) + 1):
        v = by.get(y, [])
        if y in K.MODIS_GAP_YEARS or len(v) < K.MODIS_MIN_COMPOSITES:
            years.append({"year": y, "peak": None, "use": "unknown"})
        else:
            label = ("fallow" if max(v) < K.MODIS_BARE_PEAK else "cropped") if y < K.S2_FIRST_YEAR else use.get(y)
            years.append({"year": y, "peak": round(max(v), 3), "use": label if label in ("cropped", "fallow") else "unknown"})
    cropped = [y["peak"] for y in years if y["use"] == "cropped"]
    return years, (round(float(np.median(cropped)), 3) if cropped else None)

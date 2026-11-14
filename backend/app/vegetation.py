"""Per-field vegetation analysis: dekad series, land use per year, verdicts. numpy only.

Input: per-scene rows for ONE field (date, clear, snow and the field mean of ndvi, ndmi, nbr2 over
clear pixels, already offset-corrected).  Ported from docs/research/vegetation-analysis/vegspec.py."""
import datetime as dt
import warnings

import numpy as np

from . import constants as K

N = K.D1 - K.D0 + 1
I = lambda m, d: (m - 1) * 3 + min((d - 1) // 10, 2) - K.D0      # season index of the dekad holding a calendar date
PRE = slice(I(5, 1), I(5, 21) + 1)        # 1-31 May: spring-sown crops cannot be green yet
MID = slice(I(6, 21), I(8, 1) + 1)        # 21 Jun-10 Aug: spring-crop canopy window
HARVEST_FROM = I(8, 11)                   # from 11 Aug an NDVI fall is ripening or harvest, never a finding
VARS = ("ndvi", "ndmi", "nbr2")
DEKADS = [f"{d} {m}" for m in ("May", "Jun", "Jul", "Aug", "Sep") for d in (1, 11, 21)]


def dekad_of_year(d):
    return (d.month - 1) * 3 + min((d.day - 1) // 10, 2)


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


def metrics(s):
    """Per-year metrics and land-use label from one year's dekad series. First matching label wins."""
    nd = s["ndvi"]
    m = {"n_mid": int(np.isfinite(nd[MID]).sum()), "pre": _med(nd[PRE]), "mid_max": _max(nd[MID]), "peak": _max(nd)}
    m["peak_i"] = int(np.nanargmax(nd)) if np.isfinite(nd).any() else -1
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
    return m


def is_annual_cropland(mets):
    """Field-level test: bare in May in most years. Perennial grass and steppe fail it."""
    pre = [m["pre"] for m in mets.values() if np.isfinite(m["pre"])]
    return len(pre) >= 3 and float(np.median(pre)) < K.ANNUAL_PRE_MAX


def baseline(series, mets, year=None):
    """Statistics over the usable years other than `year`: cropped years on annual cropland, every
    classified year otherwise. None when there are fewer than MIN_BASELINE_YEARS."""
    annual = is_annual_cropland(mets)
    yrs = [y for y in series if y != year and (mets[y]["use"] == "cropped" if annual else mets[y]["use"] != "unknown")]
    if len(yrs) < K.MIN_BASELINE_YEARS:
        return None
    nd = np.array([series[y]["ndvi"] for y in yrs])
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")                        # all-empty dekads stay NaN
        return {"years": yrs, "med": np.nanmedian(nd, 0), "p25": np.nanpercentile(nd, 25, 0), "p75": np.nanpercentile(nd, 75, 0),
                "peak_med": float(np.median([mets[y]["peak"] for y in yrs])),
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


def verdicts(series, mets, year, upto=None):
    """Findings for one season -> [{type, severity, title, detail}].
    upto: last season index reached (a season still running); None = the whole season."""
    s, m = series[year], mets[year]
    last = N - 1 if upto is None else upto
    nd = s["ndvi"].copy()
    nd[last + 1:] = np.nan
    annual = is_annual_cropland(mets)
    use = m["use"] if annual or m["use"] == "unknown" else "other"   # grass or steppe: crop and fallow labels mean nothing
    V = lambda type, severity, title, detail: {"type": type, "severity": severity, "title": title, "detail": detail}
    n_obs = int(np.isfinite(nd).sum())
    if use == "unknown" or n_obs < K.MIN_SEASON_DEKADS:
        what = f"Only {n_obs} of the season's {N} ten-day periods" if n_obs < K.MIN_SEASON_DEKADS else \
               f"Only {m['n_mid']} of the {MID.stop - MID.start} ten-day periods in the main growing window (21 June to 10 August)"
        return [V("INSUFFICIENT_DATA", "info", "Too few clear satellite passes to judge this season",
                  f"{what} had a cloud-free view of the field, too few to read the season's peak.")]
    out = []
    # BARE_SOIL: 30 days in a row bare inside 21 Jun-31 Aug (absolute rule, needs no baseline)
    w = slice(I(6, 21), min(I(8, 21), last) + 1)
    bare = nd[w] < K.BARE_NDVI
    if annual and _run(bare) >= K.BARE_RUN_DEKADS:
        nbr2 = _med(s["nbr2"][w][bare])
        surface = "" if not np.isfinite(nbr2) else " and looked like tilled soil" if nbr2 < K.TILLED_NBR2 else " and looked like soil under stubble or residue"
        span = f"NDVI (a 0 to 1 greenness index) stayed under {K.BARE_NDVI} for {_run(bare) * 10} days in a row between 21 June and 31 August{surface}"
        out.append(V("BARE_SOIL", "info", "Bare through the summer: this year reads as fallow",
                     f"{span}; a fallow year is a management choice, not crop stress.") if use == "fallow" else
                   V("BARE_SOIL", "warning", "Long stretch of bare soil in summer",
                     f"{span}, which suggests the soil had no growing cover for that time."))
    if use == "fallow":
        return out                                             # a fallow year is never stress
    b = baseline(series, mets, year)
    if b is None:
        return out + [V("NO_BASELINE", "info", "Not enough comparable seasons to judge this year",
                        f"A comparison needs at least {K.MIN_BASELINE_YEARS} other cropped seasons of this field, and fewer were found, so this season was not checked for a deficit.")]
    if b["peak_med"] < K.MIN_BASELINE_PEAK:
        return out + [V("NO_BASELINE", "info", "Not enough comparable seasons to judge this year",
                        f"This field's usual peak NDVI is only {b['peak_med']:.2f}, too low to compare a season against, so this season was not checked for a deficit.")]
    # VEG_DEFICIT: the season has peaked, and peaked low (independent of sowing date and crop timing)
    pk, pi = _max(nd), int(np.nanargmax(nd))
    peaked = last >= HARVEST_FROM or (last - pi >= 2 and np.isfinite(nd[last]) and nd[last] <= pk - K.PEAKED_DROP)
    if not peaked:
        return out
    ratio = pk / b["peak_med"]
    T = np.isfinite(nd) & np.isfinite(b["med"])                # season growth over the dekads both curves have: robust to gaps
    growth = float(np.clip(nd[T] - K.SOIL_BASE, 0, None).sum() / max(np.clip(b["med"][T] - K.SOIL_BASE, 0, None).sum(), 1e-6)) if T.sum() >= K.MIN_SHARED_DEKADS else np.nan
    sev = "severe" if ratio <= K.DEFICIT_SEVERE[0] or growth <= K.DEFICIT_SEVERE[1] else \
          "warning" if ratio <= K.DEFICIT_WARNING[0] or growth <= K.DEFICIT_WARNING[1] else \
          "watch" if ratio <= K.DEFICIT_WATCH else None
    if not sev:
        return out
    detail = f"Peak NDVI {pk:.2f} was {ratio * 100:.0f}% of the {b['peak_med']:.2f} median peak of this field's {len(b['years'])} other cropped seasons"
    if np.isfinite(growth):
        detail += f", and growth summed over the season was {growth * 100:.0f}% of usual"
    detail += "; the curve alone cannot tell a failed crop from an unsown or weedy field." if use == "ambiguous" else "."
    out.append(V("VEG_DEFICIT", sev, DEFICIT_TITLE[sev], detail))
    # LOW_CANOPY_MOISTURE: only ever alongside a deficit, as support for a water explanation
    dn = s["ndmi"][pi] - b["ndmi_peak_med"]
    if np.isfinite(dn) and dn <= K.NDMI_DROP[0] and s["ndmi"][pi] < K.NDMI_DRY_MAX:
        out.append(V("LOW_CANOPY_MOISTURE", "severe" if dn <= K.NDMI_DROP[1] else "warning", "Dry canopy at peak, consistent with a water shortage",
                     f"The canopy moisture index (NDMI) at peak was {s['ndmi'][pi]:+.2f}, {-dn:.2f} below this field's usual {b['ndmi_peak_med']:+.2f}, which supports a water explanation for the low peak."))
    return out


def modis_years(rows):
    """MODIS rows -> ([{year, peak, use}], median peak of the cropped years). Compare MODIS only with MODIS."""
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
            years.append({"year": y, "peak": round(max(v), 3), "use": "fallow" if max(v) < K.MODIS_FALLOW_PEAK else "cropped"})
    cropped = [y["peak"] for y in years if y["use"] == "cropped"]
    return years, (round(float(np.median(cropped)), 3) if cropped else None)

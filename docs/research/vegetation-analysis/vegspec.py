"""Reference implementation of the per-field vegetation analysis spec. numpy only.

Input: per-scene zonal records for ONE field, already offset-corrected and SCL-masked:
  date (datetime.date), clear (0-1), snow (0-1), and field MEDIANS over valid pixels of ndvi, ndmi, nbr2,
  plus p10 / p90 (NDVI percentiles over valid pixels).
Output: per-year dekadal series, per-year metrics + land-use label, alerts for a target year.
Run this file to execute the self-check."""
import datetime as dt
import warnings
import numpy as np

# ---- every threshold in one place ------------------------------------------------------------------------
MIN_CLEAR, MAX_SNOW = 0.75, 0.05          # accept a scene: >=75 % of field pixels SCL in {4,5} and <5 % SCL 11
D0, D1 = 12, 26                           # dekads of year analysed: 12 = 1-10 May ... 26 = 21-30 Sep (15 dekads)
N = D1 - D0 + 1
SPIKE_DROP, SPIKE_WIN = 0.10, 20          # despike: lower than both neighbours (<=20 d away) by >0.10 NDVI
MAX_GAP = 2                               # interpolate across at most 2 empty dekads
BARE_NDVI, TILLED_NBR2 = 0.25, 0.06       # bare: NDVI<0.25; tilled soil if also NBR2<0.06, otherwise residue/stubble
GREEN = 0.45                              # crop canopy present
SOIL_BASE = 0.20                          # bare-soil NDVI, subtracted in the season integral
I = lambda m, d: (m - 1) * 3 + min((d - 1) // 10, 2) - D0      # season index of the dekad holding a calendar date
PRE = slice(I(5, 1), I(5, 21) + 1)        # 1-31 May: spring-sown crops cannot be green yet
MID = slice(I(6, 21), I(8, 1) + 1)        # 21 Jun-10 Aug: spring-crop canopy window
HARVEST_FROM = I(8, 11)                   # from 11 Aug an NDVI fall is senescence or harvest, never an alert
VARS = ("ndvi", "ndmi", "nbr2", "p10", "p90")

def dekad_of_year(d):
    return (d.month - 1) * 3 + min((d.day - 1) // 10, 2)

def despike(t, v):
    """Cloud/shadow leaks only lower NDVI: drop obs lower than BOTH neighbours by > SPIKE_DROP."""
    keep = np.ones(len(v), bool)
    for i in range(1, len(v) - 1):
        if t[i] - t[i - 1] <= SPIKE_WIN and t[i + 1] - t[i] <= SPIKE_WIN and v[i] < v[i - 1] - SPIKE_DROP and v[i] < v[i + 1] - SPIKE_DROP:
            keep[i] = False
    return keep

def fill_gaps(y):
    y = y.copy(); idx = np.flatnonzero(np.isfinite(y))
    for a, b in zip(idx[:-1], idx[1:]):
        if 1 < b - a <= MAX_GAP + 1:
            y[a:b + 1] = np.interp(np.arange(a, b + 1), [a, b], [y[a], y[b]])
    return y

def build_year(rec, year):
    """rec: dict of equal-length arrays (date, clear, snow, *VARS). Returns {var: 15 dekad values, 'obs': real obs per dekad}."""
    dates = rec["date"]
    m = np.array([d.year == year and D0 <= dekad_of_year(d) <= D1 for d in dates]) & (rec["clear"] >= MIN_CLEAR) & (rec["snow"] < MAX_SNOW) & np.isfinite(rec["ndvi"])
    t = np.array([d.toordinal() for d in dates[m]]); o = np.argsort(t); t = t[o]
    keep = despike(t, rec["ndvi"][m][o]) if len(t) > 2 else np.ones(len(t), bool)
    dk = np.array([dekad_of_year(dt.date.fromordinal(int(x))) - D0 for x in t[keep]], int)
    out = {"obs": np.bincount(dk, minlength=N)[:N]}
    for v in VARS:
        x = rec[v][m][o][keep]; y = np.full(N, np.nan)
        for j in np.unique(dk):
            y[j] = np.median(x[dk == j])                       # dekad composite = median of accepted obs
        out[v] = fill_gaps(y)
    return out

def _max(a): return float(np.nanmax(a)) if np.isfinite(a).any() else np.nan
def _med(a): return float(np.nanmedian(a)) if np.isfinite(a).any() else np.nan

def metrics(s):
    """Per-year metrics and land-use label from one year's dekadal series."""
    nd = s["ndvi"]; m = {}
    m["n_mid"] = int(np.isfinite(nd[MID]).sum())
    m["pre"], m["mid_max"], m["peak"] = _med(nd[PRE]), _max(nd[MID]), _max(nd)
    m["peak_i"] = int(np.nanargmax(nd)) if np.isfinite(nd).any() else -1
    m["ndmi_peak"] = float(s["ndmi"][m["peak_i"]]) if m["peak_i"] >= 0 else np.nan
    m["n_green"] = int(np.nansum(nd >= GREEN))
    m["integral"] = float(np.nansum(np.clip(nd - SOIL_BASE, 0, None)) * 10)       # NDVI-days above soil
    g = np.flatnonzero(nd >= 0.30); m["greenup_i"] = int(g[0]) if len(g) else -1  # first dekad with NDVI >= 0.30
    bare = nd < BARE_NDVI
    m["bare_days"] = int(bare.sum() * 10)
    m["bare_tilled_days"] = int((bare & (s["nbr2"] < TILLED_NBR2)).sum() * 10)
    if m["n_mid"] < 3:                               m["use"] = "unknown"
    elif m["pre"] >= 0.40:                           m["use"] = "early_green"     # perennial grass, hay, winter crop, weeds
    elif m["mid_max"] < 0.30:                        m["use"] = "fallow"
    elif m["mid_max"] < GREEN or m["n_green"] < 3:   m["use"] = "ambiguous"       # weedy fallow OR failed/sparse crop
    else:
        m["use"] = "cropped"; pk = m["peak_i"]
        m["group"] = "early" if pk < I(7, 11) else "cereal-like" if pk <= I(8, 1) else "late"
    return m

def is_annual_cropland(mets):
    """Field-level test: bare in May in most years. Perennial grass and steppe fail it."""
    pre = [m["pre"] for m in mets.values() if np.isfinite(m["pre"])]
    return len(pre) >= 3 and float(np.median(pre)) < 0.30

def baseline(series, mets, year, annual=True):
    """Statistics over the OTHER usable years: 'cropped' years for annual cropland, every classified year otherwise. None if < 3."""
    yrs = [y for y in series if y != year and (mets[y]["use"] == "cropped" if annual else mets[y]["use"] != "unknown")]
    if len(yrs) < 3:
        return None
    nd = np.array([series[y]["ndvi"] for y in yrs]); pk = np.array([mets[y]["peak"] for y in yrs])
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        return {"years": yrs, "n": len(yrs), "med": np.nanmedian(nd, 0), "p25": np.nanpercentile(nd, 25, 0), "p75": np.nanpercentile(nd, 75, 0),
                "peak_med": float(np.median(pk)), "peak_mean": float(pk.mean()), "peak_sd": float(pk.std(ddof=1)),
                "ndmi_peak_med": _med(np.array([mets[y]["ndmi_peak"] for y in yrs]))}

def _run(mask):
    best = cur = 0
    for x in mask:
        cur = cur + 1 if x else 0; best = max(best, cur)
    return best

def alerts(series, mets, year, declared=None, upto=None):
    """declared: None | 'fallow' | 'crop' (the user's declaration wins over the inferred label).
    upto: last season index with data (in-season use); None = whole season. Returns [(type, severity, text)]."""
    s, m = series[year], mets[year]; last = N - 1 if upto is None else upto
    nd = s["ndvi"].copy(); nd[last + 1:] = np.nan
    annual = is_annual_cropland(mets)
    use = declared or {"fallow": "fallow", "cropped": "crop", "ambiguous": "ambiguous", "unknown": "unknown"}.get(m["use"], "other")
    if not annual and not declared and use != "unknown":
        use = "other"                                          # grass/steppe: per-year crop/fallow labels mean nothing
    out = []
    if use == "unknown" or np.isfinite(nd).sum() < 5:
        return [("INSUFFICIENT_DATA", "info", "too few cloud-free observations this season")]
    # 1 BARE_SOIL: >=30 consecutive days bare inside 21 Jun-31 Aug (absolute rule, needs no baseline)
    w = slice(I(6, 21), min(I(8, 21), last) + 1); bare = nd[w] < BARE_NDVI
    if annual and _run(bare) >= 3:
        tilled = _med(s["nbr2"][w][bare]) < TILLED_NBR2
        out.append(("BARE_SOIL", "info" if use == "fallow" else "warning",
                    f"{_run(bare) * 10} d without cover in 21 Jun-31 Aug ({'tilled soil' if tilled else 'residue cover'}); {m['bare_days']} bare days May-Sep"))
    if use == "fallow":
        return out                                             # a fallow year is never stress
    b = baseline(series, mets, year, annual)
    if use == "crop":
        # 2 NO_GREENUP: still bare when the field is normally green
        for i, sev in ((I(7, 11), "warning"), (I(6, 21), "watch")):
            if b and last >= i and np.isfinite(nd[i]) and nd[i] < 0.30 and b["med"][i] >= 0.40 and not (nd[:i] >= 0.30).any():
                out.append(("NO_GREENUP", sev, f"NDVI {nd[i]:.2f} in dekad {i}, usual {b['med'][i]:.2f}")); break
        # 3 ABRUPT_DROP before the harvest window, confirmed by the following dekad
        for i in range(1, min(last, HARVEST_FROM - 1) + 1):
            confirmed = i + 1 <= last and np.isfinite(nd[i + 1]) and nd[i + 1] < nd[i - 1] - 0.15
            if s["obs"][i] and np.isfinite(nd[i - 1]) and nd[i - 1] >= GREEN and nd[i - 1] - nd[i] >= 0.20 and confirmed:
                out.append(("ABRUPT_DROP", "warning", f"NDVI {nd[i - 1]:.2f} -> {nd[i]:.2f} in dekad {i}")); break
        # 4 PATCHY: within-field spread while green
        k = np.flatnonzero((nd >= GREEN) & np.isfinite(s["p90"]))
        if len(k) >= 2:
            spread = float(np.median((s["p90"] - s["p10"])[k]))
            if spread >= 0.20:
                out.append(("PATCHY", "warning" if spread >= 0.30 else "watch", f"p90-p10 NDVI spread {spread:.2f} while green"))
    if b is None or b["peak_med"] < 0.35:
        return out + [("NO_BASELINE", "info", "fewer than 3 comparable baseline years: anomaly alerts off")]
    # 5 VEG_DEFICIT: the season has peaked, and peaked low (independent of sowing date and crop timing)
    pk, pi = _max(nd), int(np.nanargmax(nd))
    peaked = last >= HARVEST_FROM or (last - pi >= 2 and np.isfinite(nd[last]) and nd[last] <= pk - 0.05)
    if peaked:
        ratio = pk / b["peak_med"]; z = (pk - b["peak_mean"]) / max(b["peak_sd"], 0.05)
        T = np.isfinite(nd) & np.isfinite(b["med"])            # integral over the dekads both curves have: robust to gaps
        iratio = float(np.clip(nd[T] - SOIL_BASE, 0, None).sum() / max(np.clip(b["med"][T] - SOIL_BASE, 0, None).sum(), 1e-6)) if T.sum() >= 10 else np.nan
        sev = "severe" if ratio <= 0.65 or iratio <= 0.50 else "warning" if ratio <= 0.80 or iratio <= 0.65 else "watch" if ratio <= 0.90 else None
        if sev:
            tag = " -- fallow, unsown or failed crop? confirm land use" if use == "ambiguous" else ""
            out.append(("VEG_DEFICIT", sev, f"peak NDVI {pk:.2f} = {ratio * 100:.0f}% of median peak {b['peak_med']:.2f} (z {z:+.1f}, n={b['n']}); season integral {iratio * 100:.0f}% of usual{tag}"))
        # 6 WATER_STRESS: canopy water content at peak, low in absolute terms and against the field's usual
        dn = s["ndmi"][pi] - b["ndmi_peak_med"]
        if np.isfinite(dn) and dn <= -0.15 and s["ndmi"][pi] < 0.15:
            out.append(("WATER_STRESS", "severe" if dn <= -0.25 else "warning", f"NDMI at peak {s['ndmi'][pi]:+.2f}, {dn:+.2f} vs usual {b['ndmi_peak_med']:+.2f}"))
    return out

def demo():
    """Self-check on a synthetic field: normal years, a drought year, a fallow year."""
    rng = np.random.default_rng(0)
    crop = 0.18 + 0.55 * np.exp(-((np.arange(N) - 7.5) / 2.6) ** 2)
    def year(curve, y):
        dates = np.array([dt.date(y, 5, 1) + dt.timedelta(days=5 * k) for k in range(30)])
        nd = curve[[dekad_of_year(d) - D0 for d in dates]] + rng.normal(0, 0.01, 30)
        return dict(date=dates, clear=np.ones(30), snow=np.zeros(30), ndvi=nd, ndmi=nd - 0.45, nbr2=np.where(nd < 0.25, 0.01, 0.2), p10=nd - 0.04, p90=nd + 0.04)
    recs = [year(crop, y) for y in range(2017, 2021)] + [year(0.18 + 0.5 * (crop - 0.18), 2021), year(np.full(N, 0.17), 2022), year(crop, 2023)]
    recs[6]["ndvi"][12] -= 0.4                                  # one cloud-contaminated observation in the normal year
    rec = {k: np.concatenate([r[k] for r in recs]) for k in recs[0]}
    series = {y: build_year(rec, y) for y in range(2017, 2024)}; mets = {y: metrics(series[y]) for y in series}
    assert is_annual_cropland(mets)
    assert mets[2022]["use"] == "fallow" and mets[2018]["use"] == "cropped", mets
    a21 = {a[0]: a[1] for a in alerts(series, mets, 2021)}
    assert a21.get("VEG_DEFICIT") == "severe" and "WATER_STRESS" in a21, a21      # drought year
    assert [a[0] for a in alerts(series, mets, 2022)] == ["BARE_SOIL"]             # fallow year: bare-soil info only
    assert alerts(series, mets, 2023) == [], alerts(series, mets, 2023)            # normal year, harvest decline, one cloudy obs: silent
    assert "VEG_DEFICIT" not in [a[0] for a in alerts(series, mets, 2021, upto=I(6, 21))]   # too early to call a deficit
    print("demo OK")

if __name__ == "__main__":
    demo()

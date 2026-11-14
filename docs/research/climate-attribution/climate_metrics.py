"""Deterministic climate metrics from NASA POWER daily point JSON. numpy + stdlib only.

Usage: python3 -I climate_metrics.py <power_lst.json> [<power_utc_imerg.json>]
Run with no args for the self-check only.
"""
import json
import math
import sys
from datetime import date

import numpy as np

FILL = -999.0
BASE = (1991, 2020)  # WMO standard normal period


# ---------- loading ----------
def load(path):
    """-> (dates[np.datetime64[D]], {param: float array with nan for fill}, lat, elev)"""
    j = json.load(open(path))
    par = j["properties"]["parameter"]
    keys = sorted(next(iter(par.values())).keys())
    dates = np.array([f"{k[:4]}-{k[4:6]}-{k[6:]}" for k in keys], dtype="datetime64[D]")
    out = {}
    for p, d in par.items():
        a = np.array([d[k] for k in keys], dtype=float)
        a[a == FILL] = np.nan
        out[p] = a
    lon, lat, elev = j["geometry"]["coordinates"]
    return dates, out, lat, elev


def ymd(dates):
    y = dates.astype("datetime64[Y]").astype(int) + 1970
    m = dates.astype("datetime64[M]").astype(int) % 12 + 1
    doy = (dates - dates.astype("datetime64[Y]")).astype(int) + 1
    return y, m, doy


# ---------- evapotranspiration (FAO-56) ----------
def ra_mj(lat_deg, doy):
    """Extraterrestrial radiation, MJ m-2 day-1 (FAO-56 eq. 21-25)."""
    phi = math.radians(lat_deg)
    dr = 1 + 0.033 * np.cos(2 * np.pi * doy / 365)
    dec = 0.409 * np.sin(2 * np.pi * doy / 365 - 1.39)
    ws = np.arccos(np.clip(-np.tan(phi) * np.tan(dec), -1, 1))
    return 24 * 60 / np.pi * 0.0820 * dr * (ws * np.sin(phi) * np.sin(dec) + np.cos(phi) * np.cos(dec) * np.sin(ws))


def et0_hargreaves(tmax, tmin, tmean, ra):
    """FAO-56 eq. 52 (Hargreaves-Samani 1985), mm/day."""
    return 0.0023 * (tmean + 17.8) * np.sqrt(np.maximum(tmax - tmin, 0)) * 0.408 * ra


def _es(t):
    return 0.6108 * np.exp(17.27 * t / (t + 237.3))


def et0_pm(tmax, tmin, tmean, tdew, u2, rs, ps_kpa, ra, elev):
    """FAO-56 Penman-Monteith eq. 6, mm/day. G=0, albedo 0.23."""
    delta = 4098 * _es(tmean) / (tmean + 237.3) ** 2
    gamma = 0.000665 * ps_kpa
    es = (_es(tmax) + _es(tmin)) / 2
    ea = _es(tdew)
    rso = (0.75 + 2e-5 * elev) * ra
    rns = 0.77 * rs
    rnl = 4.903e-9 * ((tmax + 273.16) ** 4 + (tmin + 273.16) ** 4) / 2 * (0.34 - 0.14 * np.sqrt(ea)) * (
        1.35 * np.clip(rs / rso, 0.3, 1.0) - 0.35
    )
    rn = rns - rnl
    return np.maximum(
        (0.408 * delta * rn + gamma * 900 / (tmean + 273) * u2 * (es - ea)) / (delta + gamma * (1 + 0.34 * u2)), 0
    )


# ---------- small helpers ----------
def longest_run(mask):
    """Longest run of True in a boolean array."""
    best = cur = 0
    for v in mask:
        cur = cur + 1 if v else 0
        best = max(best, cur)
    return best


def pct_rank(value, sample):
    """Empirical percentile (0-100) of value within sample (mid-rank)."""
    s = np.asarray(sample, float)
    s = s[~np.isnan(s)]
    return 100.0 * (np.sum(s < value) + 0.5 * np.sum(s == value)) / len(s)


def zscore(value, sample):
    s = np.asarray(sample, float)
    return (value - np.nanmean(s)) / np.nanstd(s, ddof=1)


def theil_sen(y):
    """Median pairwise slope per step (per year)."""
    y = np.asarray(y, float)
    i, j = np.triu_indices(len(y), 1)
    return float(np.median((y[j] - y[i]) / (j - i)))


def mann_kendall(y):
    """-> (S, Z, two-sided p) with tie correction, normal approximation."""
    y = np.asarray(y, float)
    n = len(y)
    i, j = np.triu_indices(n, 1)
    s = int(np.sum(np.sign(y[j] - y[i])))
    _, counts = np.unique(y, return_counts=True)
    var = (n * (n - 1) * (2 * n + 5) - np.sum(counts * (counts - 1) * (2 * counts + 5))) / 18
    z = 0.0 if s == 0 else (s - np.sign(s)) / math.sqrt(var)
    p = 2 * (1 - 0.5 * (1 + math.erf(abs(z) / math.sqrt(2))))
    return s, z, p


def htc_class(h):
    """Selyaninov HTC classes (see report for sources)."""
    if h < 0.4:
        return "very severe drought"
    if h < 0.5:
        return "severe drought"
    if h < 0.7:
        return "moderate drought"
    if h < 1.0:
        return "mild drought / insufficient moisture"
    if h <= 1.5:
        return "adequate moisture"
    return "excess moisture"


# ---------- per-season metrics ----------
def season_metrics(dates, d, lat, elev, year, sow=(5, 15), base_t=0.0):
    """All per-year metrics for one grid point. Windows are calendar defaults; GDD stage dates are estimated."""
    y, m, doy = ymd(dates)
    yr = y == year
    tmax, tmin, t, p = d["T2M_MAX"], d["T2M_MIN"], d["T2M"], d["PRECTOTCORR"]
    out = {"year": year}

    def win(m1, d1, m2, d2):
        a = np.datetime64(date(year, m1, d1))
        b = np.datetime64(date(year, m2, d2))
        return (dates >= a) & (dates <= b)

    mjja = win(5, 1, 8, 31)
    out["valid_days_mjja"] = int(np.sum(~np.isnan(p[mjja])))
    out["p_mjja"] = float(np.nansum(p[mjja]))
    out["p_mjjas"] = float(np.nansum(p[win(5, 1, 9, 30)]))
    out["p_month"] = {mm: float(np.nansum(p[yr & (m == mm)])) for mm in (4, 5, 6, 7, 8, 9)}
    out["p_coldseason"] = float(np.nansum(p[(dates >= np.datetime64(date(year - 1, 11, 1))) & (dates <= np.datetime64(date(year, 3, 31)))]))
    out["tmean_mjja"] = float(np.nanmean(t[mjja]))
    # dry spells: WMO/ETCCDI CDD uses < 1 mm
    out["dry_spell_max_mjja"] = longest_run(p[mjja] < 1.0)
    out["dry_spell_max_jun_jul"] = longest_run(p[win(6, 1, 7, 31)] < 1.0)
    # heat
    out["hot30_mjja"] = int(np.sum(tmax[mjja] >= 30))
    out["hot32_mjja"] = int(np.sum(tmax[mjja] >= 32))
    out["hot35_mjja"] = int(np.sum(tmax[mjja] >= 35))
    out["tmax_peak"] = float(np.nanmax(tmax[mjja]))
    out["tmax_peak_date"] = str(dates[mjja][np.nanargmax(tmax[mjja])])
    # growing degree days from sowing, base 0 C, and estimated stage dates
    grow = win(sow[0], sow[1], 9, 30)
    gdd = np.cumsum(np.maximum(np.nan_to_num(t[grow]) - base_t, 0))
    gd = dates[grow]

    def when(thr):
        k = np.searchsorted(gdd, thr)
        return gd[min(k, len(gd) - 1)]

    st = {"emergence": when(150), "anthesis_start": when(800), "anthesis_end": when(950), "maturity": when(1550)}
    out["stage_dates"] = {k: str(v) for k, v in st.items()}
    out["gdd0_sow_to_aug31"] = float(gdd[np.searchsorted(gd, np.datetime64(date(year, 8, 31)))])
    anth = (dates >= st["anthesis_start"] - 5) & (dates <= st["anthesis_end"] + 5)
    fill = (dates > st["anthesis_end"] + 5) & (dates <= st["maturity"])
    out["anthesis_hot30"] = int(np.sum(tmax[anth] >= 30))
    out["anthesis_hot32"] = int(np.sum(tmax[anth] >= 32))
    out["grainfill_hot32"] = int(np.sum(tmax[fill] >= 32))
    out["grainfill_hot35"] = int(np.sum(tmax[fill] >= 35))
    # frost
    early = (dates >= st["emergence"]) & (dates <= np.datetime64(date(year, 6, 20)))
    late = win(8, 10, 9, 20)
    out["frost0_emergence"] = int(np.sum(tmin[early] <= 0))
    out["frost_m2_emergence"] = int(np.sum(tmin[early] <= -2))
    out["frost_m4_emergence"] = int(np.sum(tmin[early] <= -4))
    out["frost0_anthesis"] = int(np.sum(tmin[anth] <= 0))
    out["frost_m2_late"] = int(np.sum(tmin[late] <= -2))
    out["frost0_late"] = int(np.sum(tmin[late] <= 0))
    aug_sep = win(8, 1, 9, 30)
    below0 = dates[aug_sep][tmin[aug_sep] <= 0]
    out["first_autumn_frost"] = str(below0[0]) if len(below0) else None
    # ET0 + water balance
    ra = ra_mj(lat, doy)
    hg = et0_hargreaves(tmax, tmin, t, ra)
    out["et0_hg_mjja"] = float(np.nansum(hg[mjja]))
    out["cwb_mjja"] = out["p_mjja"] - out["et0_hg_mjja"]  # climatic water balance P - ET0
    out["p_over_et0_mjja"] = out["p_mjja"] / out["et0_hg_mjja"]
    if "ALLSKY_SFC_SW_DWN" in d and not np.isnan(d["ALLSKY_SFC_SW_DWN"][mjja]).any():
        pm = et0_pm(tmax, tmin, t, d["T2MDEW"], d["WS2M"], d["ALLSKY_SFC_SW_DWN"], d["PS"], ra, elev)
        out["et0_pm_mjja"] = float(np.nansum(pm[mjja]))
    # Selyaninov HTC: sum P / (0.1 * sum T) over days with Tmean > 10 C
    for name, w in (("htc_mjja", mjja), ("htc_jja", win(6, 1, 8, 31)), ("htc_jun_jul", win(6, 1, 7, 31))):
        act = w & (t > 10)
        out[name] = float(np.nansum(p[act]) / (0.1 * np.nansum(t[act])))
    # soil wetness
    out["gwetroot_jun_jul"] = float(np.nanmean(d["GWETROOT"][win(6, 1, 7, 31)]))
    out["gwetroot_may1"] = float(np.nanmean(d["GWETROOT"][win(4, 25, 5, 5)]))
    out["gwetroot_aug15_sep15"] = float(np.nanmean(d["GWETROOT"][win(8, 15, 9, 15)]))
    out["p_aug15_sep15"] = float(np.nansum(p[win(8, 15, 9, 15)]))
    out["wetdays_aug15_sep15"] = int(np.sum(p[win(8, 15, 9, 15)] >= 1.0))
    out["gwettop_aug15_sep15"] = float(np.nanmean(d["GWETTOP"][win(8, 15, 9, 15)]))
    out["gwettop_may"] = float(np.nanmean(d["GWETTOP"][win(5, 1, 5, 31)]))
    out["p_apr_may"] = out["p_month"][4] + out["p_month"][5]
    out["p_may_jul"] = out["p_month"][5] + out["p_month"][6] + out["p_month"][7]
    out["tmin_min_emergence"] = float(np.nanmin(tmin[early])) if early.any() else float("nan")
    out["frost_m2_grainfill"] = int(np.sum(tmin[fill] <= -2))
    return out


def with_anomalies(rows, base=BASE):
    """Add percent-of-normal, z-score and percentile versus the baseline years."""
    ref = [r for r in rows if base[0] <= r["year"] <= base[1]]
    for r in rows:
        for k in ("p_mjja", "p_mjjas", "hot30_mjja", "htc_mjja", "htc_jja", "gwetroot_jun_jul", "gwetroot_may1", "cwb_mjja",
                  "et0_hg_mjja", "tmean_mjja", "dry_spell_max_mjja", "p_aug15_sep15", "gwetroot_aug15_sep15", "p_coldseason",
                  "gwettop_aug15_sep15", "gwettop_may", "p_apr_may", "p_may_jul", "wetdays_aug15_sep15"):
            s = [x[k] for x in ref]
            r[k + "_pctl"] = pct_rank(r[k], s)
            r[k + "_z"] = float(zscore(r[k], s))
        r["p_mjja_pct_normal"] = 100 * r["p_mjja"] / np.mean([x["p_mjja"] for x in ref])
        r["p_month_pct_normal"] = {mm: 100 * r["p_month"][mm] / np.mean([x["p_month"][mm] for x in ref]) for mm in r["p_month"]}
    return rows


# ---------- self-check ----------
def demo():
    assert longest_run([1, 1, 0, 1, 1, 1, 0]) == 3
    # FAO-56 example 8: Ra at 20 S on 3 Sep (doy 246) = 32.2 MJ m-2 day-1
    assert abs(float(ra_mj(-20, np.array([246]))[0]) - 32.2) < 0.15
    # FAO-56 example 18 (Uccle 6 July): ET0 = 3.9 mm/day with Rs 22.07, u2 2.078, ea 1.409 (Tdew ~ 12.0 C), z 100 m
    ra = ra_mj(50.8, np.array([187]))
    et = et0_pm(np.array([21.5]), np.array([12.3]), np.array([16.9]), np.array([12.0]), np.array([2.078]),
                np.array([22.07]), np.array([100.1]), ra, 100)
    assert abs(float(et[0]) - 3.9) < 0.15, et
    # monotonic series: MK significant, Sen slope exact
    s, z, p = mann_kendall(np.arange(30) * 2.0)
    assert s == 435 and p < 1e-6 and abs(theil_sen(np.arange(30) * 2.0) - 2.0) < 1e-12
    assert mann_kendall([1, 1, 1, 1])[2] == 1.0
    assert htc_class(0.35) == "very severe drought" and htc_class(1.2) == "adequate moisture"
    assert pct_rank(5, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) == 45.0
    print("self-check ok")


if __name__ == "__main__":
    demo()
    if len(sys.argv) < 2:
        sys.exit(0)
    dates, d, lat, elev = load(sys.argv[1])
    years = list(range(1991, 2027))
    rows = with_anomalies([season_metrics(dates, d, lat, elev, yy) for yy in years])
    json.dump(rows, open(sys.argv[1].replace(".json", "_metrics.json"), "w"), indent=1)
    cols = ["p_mjja", "p_mjja_pct_normal", "p_mjja_z", "p_mjja_pctl", "hot30_mjja", "hot32_mjja", "hot35_mjja", "tmax_peak",
            "dry_spell_max_mjja", "htc_mjja", "htc_jja", "et0_hg_mjja", "cwb_mjja", "gwetroot_jun_jul", "gwetroot_jun_jul_pctl"]
    print("year " + " ".join(c[:13].rjust(13) for c in cols))
    for r in rows:
        print(str(r["year"]) + " " + " ".join(f"{r[c]:13.2f}" for c in cols))

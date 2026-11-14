"""Stage-window diagnosis on top of climate_metrics.py. numpy + stdlib only.

Usage: python3 diagnose.py <power_lst.json>
Windows follow the crop (GDD-estimated stages), and every value is ranked against the SAME calendar window
in the baseline years, so a wet July cannot hide a dry May-June (the 2021 case).
"""
import sys
from datetime import date

import numpy as np

import climate_metrics as cm

BASE = range(1991, 2021)
D = np.timedelta64(1, "D")


def shift(day, year):
    """Same month-day in another year (29 Feb -> 28 Feb)."""
    d = day.astype(object)
    return np.datetime64(date(year, d.month, min(d.day, 28) if d.month == 2 else d.day))


def ranked(dates, fn, start, end):
    """fn(mask) for [start, end] and for the same calendar window in each baseline year.
    -> (value, percent of baseline mean, percentile 0-100)"""
    v = fn((dates >= start) & (dates <= end))
    ref = [fn((dates >= shift(start, y)) & (dates <= shift(end, y))) for y in BASE]
    mean = float(np.mean(ref))
    return v, (100 * v / mean if mean else float("nan")), cm.pct_rank(v, ref)


def stages(dates, t, year, sow=(5, 15)):
    """GDD base 0 C from sowing; thresholds from Miller et al. 2001 (hard red spring wheat)."""
    w = (dates >= np.datetime64(date(year, *sow))) & (dates <= np.datetime64(date(year, 10, 15)))
    gdd = np.cumsum(np.maximum(np.nan_to_num(t[w]), 0))
    at = lambda thr: dates[w][min(np.searchsorted(gdd, thr), w.sum() - 1)]
    return {"sowing": np.datetime64(date(year, *sow)), "emergence": at(140), "jointing": at(620),
            "anthesis": at(850), "grainfill_start": at(1070), "maturity": at(1600)}


def diagnose(dates, d, year, veg_low=True, regional_low=None, second_source_agrees=None, sow=(5, 15)):
    """-> (facts dict, [(cause, confidence, [evidence])])"""
    t, tx, tn, p = d["T2M"], d["T2M_MAX"], d["T2M_MIN"], d["PRECTOTCORR"]
    s = stages(dates, t, year, sow)
    f = {"stages": {k: str(v) for k, v in s.items()}}
    a0, a1 = s["anthesis"] - 7 * D, s["anthesis"] + 7 * D  # flowering window
    pre = (s["sowing"], a1)  # sowing -> end of flowering: sets grain number
    fill = (a1 + D, s["maturity"])  # grain fill: sets grain weight
    harvest = (np.datetime64(date(year, 8, 15)), np.datetime64(date(year, 9, 20)))

    f["rain_pre"], f["rain_pre_pct"], f["rain_pre_pctl"] = ranked(dates, lambda m: float(np.nansum(p[m])), *pre)
    htc = lambda m: float(np.nansum(p[m & (t > 10)]) / max(0.1 * np.nansum(t[m & (t > 10)]), 1e-9))
    f["htc_pre"], _, f["htc_pre_pctl"] = ranked(dates, htc, *pre)
    f["dry_spell_pre"], _, f["dry_spell_pre_pctl"] = ranked(dates, lambda m: cm.longest_run(p[m] < 1.0), *pre)
    f["gwetroot_anthesis"], _, f["gwetroot_anthesis_pctl"] = ranked(dates, lambda m: float(np.nanmean(d["GWETROOT"][m])), a0, a1)
    f["gwetroot_fill"], _, f["gwetroot_fill_pctl"] = ranked(dates, lambda m: float(np.nanmean(d["GWETROOT"][m])), *fill)
    f["rain_fill"], f["rain_fill_pct"], f["rain_fill_pctl"] = ranked(dates, lambda m: float(np.nansum(p[m])), *fill)
    f["hot31_anthesis"], _, f["hot31_anthesis_pctl"] = ranked(dates, lambda m: int(np.sum(tx[m] >= 31)), a0, a1)
    f["hot35_anthesis"] = int(np.sum(tx[(dates >= a0) & (dates <= a1)] >= 35))
    f["hot35_fill"], _, f["hot35_fill_pctl"] = ranked(dates, lambda m: int(np.sum(tx[m] >= 35)), *fill)
    f["tmax_peak"] = float(np.nanmax(tx[(dates >= s["sowing"]) & (dates <= s["maturity"])]))
    seedling = (dates >= s["emergence"]) & (dates < s["jointing"])
    boot_flower = (dates >= s["jointing"]) & (dates <= a1)
    fillm = (dates > a1) & (dates <= s["maturity"])
    f["tmin_seedling"] = float(np.nanmin(tn[seedling]))
    f["tmin_boot_flower"] = float(np.nanmin(tn[boot_flower]))
    f["tmin_fill"] = float(np.nanmin(tn[fillm]))
    f["rain_harvest"], f["rain_harvest_pct"], f["rain_harvest_pctl"] = ranked(dates, lambda m: float(np.nansum(p[m])), *harvest)
    f["wetdays_harvest"], _, f["wetdays_harvest_pctl"] = ranked(dates, lambda m: int(np.sum(p[m] >= 1.0)), *harvest)
    _, _, f["gwettop_harvest_pctl"] = ranked(dates, lambda m: float(np.nanmean(d["GWETTOP"][m])), *harvest)

    sc = {"water": 0, "heat": 0, "frost": 0, "excess": 0}
    ev = {k: [] for k in sc}

    def add(k, pts, text):
        sc[k] += pts
        ev[k].append(text)

    # --- water deficit (score >= 3 to flag)
    if f["rain_pre_pct"] <= 50:
        add("water", 2, "rain sowing-to-flowering %.0f mm = %.0f%% of normal" % (f["rain_pre"], f["rain_pre_pct"]))
    elif f["rain_pre_pct"] <= 70:
        add("water", 1, "rain sowing-to-flowering %.0f mm = %.0f%% of normal" % (f["rain_pre"], f["rain_pre_pct"]))
    if f["htc_pre"] < 0.4:
        add("water", 2, "HTC %.2f (< 0.4)" % f["htc_pre"])
    elif f["htc_pre"] < 0.6:
        add("water", 1, "HTC %.2f (< 0.6)" % f["htc_pre"])
    if f["dry_spell_pre"] >= 15 and f["dry_spell_pre_pctl"] >= 75:
        add("water", 1, "%d-day dry spell before flowering" % f["dry_spell_pre"])
    if min(f["gwetroot_anthesis_pctl"], f["gwetroot_fill_pctl"]) <= 20:
        add("water", 1, "root-zone wetness in the driest fifth of years")
    # --- heat (score >= 2 to flag)
    if f["hot35_anthesis"] >= 2:
        add("heat", 2, "%d days >= 35 C around flowering" % f["hot35_anthesis"])
    if f["hot31_anthesis"] >= 5 and f["hot31_anthesis_pctl"] >= 75:
        add("heat", 2, "%d days >= 31 C around flowering (top quarter of years)" % f["hot31_anthesis"])
    if f["hot35_fill"] >= 2 and f["hot35_fill_pctl"] >= 75:
        add("heat", 2, "%d days >= 35 C during grain fill (top quarter of years)" % f["hot35_fill"])
    # --- frost (score >= 2 to flag)
    if f["tmin_seedling"] <= -4:
        add("frost", 2, "%.1f C at seedling stage" % f["tmin_seedling"])
    if f["tmin_boot_flower"] <= 0:
        add("frost", 3, "%.1f C between jointing and flowering" % f["tmin_boot_flower"])
    if f["tmin_fill"] <= -2:
        add("frost", 2, "%.1f C during grain fill" % f["tmin_fill"])
    # --- excess rain at harvest (score >= 2 to flag)
    if f["rain_harvest_pctl"] >= 80:
        add("excess", 1, "15 Aug-20 Sep rain %.0f mm = %.0f%% of normal" % (f["rain_harvest"], f["rain_harvest_pct"]))
    if f["wetdays_harvest_pctl"] >= 80:
        add("excess", 1, "%d wet days in the harvest window" % f["wetdays_harvest"])
    if f["gwettop_harvest_pctl"] >= 85:
        add("excess", 1, "topsoil wetness in the wettest 15% of years")

    need = {"water": 3, "heat": 2, "frost": 2, "excess": 2}
    name = {"water": "water deficit", "heat": "heat during a sensitive stage", "frost": "frost damage",
            "excess": "excess rain / waterlogging at harvest"}
    out = []
    for k in sc:
        if sc[k] < need[k]:
            continue
        conf = "high" if sc[k] >= need[k] + 2 else "medium"
        if regional_low is False or second_source_agrees is False:
            conf = "low"  # weather is a ~50 km signal: a field-only anomaly or disagreeing sources weaken it
        out.append((name[k], conf, ev[k]))
    if veg_low and not [o for o in out if o[0] != name["excess"]]:
        out.append(("not explained by weather: possibly management, nutrients, pests or monoculture - needs local review",
                    "medium" if regional_low is False else "low", ["no weather indicator crossed its threshold"]))
    f["scores"] = sc
    return f, out


def demo(dates, d):
    """Known years at 53.2N 63.6E: 2021 and 2010 must flag water deficit, 2024 must not."""
    lab = lambda y: [c[0] for c in diagnose(dates, d, y)[1]]
    assert "water deficit" in lab(2021) and "water deficit" in lab(2010), (lab(2021), lab(2010))
    assert "water deficit" not in lab(2024) and "heat during a sensitive stage" not in lab(2024), lab(2024)
    print("diagnose self-check ok")


if __name__ == "__main__":
    dates, d, lat, elev = cm.load(sys.argv[1])
    demo(dates, d)
    n = {"water deficit": 0, "heat during a sensitive stage": 0, "frost damage": 0, "excess rain / waterlogging at harvest": 0}
    for yy in range(1991, 2027):
        f, res = diagnose(dates, d, yy)
        for c in res:
            if c[0] in n:
                n[c[0]] += 1
        print(yy, f["scores"], "|", " || ".join("%s [%s]: %s" % (c[0][:38], c[1], "; ".join(c[2])) for c in res))
    print("flag frequency over 36 years:", n)
    for yy in (2021, 2024):
        f, _ = diagnose(dates, d, yy)
        print(yy, {k: (round(v, 2) if isinstance(v, float) else v) for k, v in f.items()})

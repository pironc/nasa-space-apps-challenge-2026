"""Demo-story check + trends for 53.2N 63.6E. Usage: python3 analyse.py <power_lst.json> [<power_utc_imerg.json>]"""
import sys
from datetime import date

import numpy as np

import climate_metrics as cm

dates, d, lat, elev = cm.load(sys.argv[1])
y, m, doy = cm.ymd(dates)
rows = cm.with_anomalies([cm.season_metrics(dates, d, lat, elev, yy) for yy in range(1991, 2027)])
by = {r["year"]: r for r in rows}

print("== A. 2001-2026 May-Aug precipitation and days with Tmax > 30 C ==")
sel = [by[yy] for yy in range(2001, 2027)]
gt30 = {yy: int(np.sum(d["T2M_MAX"][(y == yy) & (m >= 5) & (m <= 8)] > 30)) for yy in range(2001, 2027)}
pm = np.array([r["p_mjja"] for r in sel])
hm = np.array([gt30[r["year"]] for r in sel])
print("year p_mjja_mm days_gt30")
for r in sel:
    print(r["year"], round(r["p_mjja"], 1), gt30[r["year"]])
print("median 2001-2026: p=%.1f mm, days>30=%.1f | mean p=%.1f" % (np.median(pm), np.median(hm), pm.mean()))
print("median 2001-2025: p=%.1f mm, days>30=%.1f" % (np.median(pm[:-1]), np.median(hm[:-1])))
for yy in (2021, 2024):
    r = by[yy]
    print(yy, "p=%.1f mm (%.0f%% of 2001-2026 median), days>30=%d (median %.1f), rank p %d/26 (1=driest), rank hot %d/26 (1=hottest)" % (
        r["p_mjja"], 100 * r["p_mjja"] / np.median(pm), gt30[yy], np.median(hm),
        1 + int(np.sum(pm < r["p_mjja"])), 1 + int(np.sum(hm > gt30[yy]))))

print("\n== B. Detail 2021 vs 2024 (baseline 1991-2020) ==")
keys = ["p_mjja", "p_mjja_pct_normal", "p_mjja_z", "p_mjja_pctl", "p_month", "p_month_pct_normal", "p_coldseason", "p_coldseason_pctl",
        "tmean_mjja", "tmean_mjja_z", "hot30_mjja", "hot32_mjja", "hot35_mjja", "tmax_peak", "tmax_peak_date", "dry_spell_max_mjja",
        "dry_spell_max_jun_jul", "stage_dates", "gdd0_sow_to_aug31", "anthesis_hot30", "anthesis_hot32", "grainfill_hot32",
        "grainfill_hot35", "frost0_emergence", "frost_m2_emergence", "frost0_anthesis", "frost0_late", "frost_m2_late",
        "first_autumn_frost", "et0_hg_mjja", "et0_pm_mjja", "cwb_mjja", "cwb_mjja_z", "p_over_et0_mjja", "htc_mjja", "htc_jja",
        "htc_jun_jul", "gwetroot_may1", "gwetroot_may1_pctl", "gwetroot_jun_jul", "gwetroot_jun_jul_pctl", "gwetroot_aug15_sep15",
        "gwetroot_aug15_sep15_pctl", "p_aug15_sep15", "p_aug15_sep15_pctl", "wetdays_aug15_sep15"]
for k in keys:
    def f(v):
        if isinstance(v, dict):
            return {a: (round(b, 1) if isinstance(b, float) else b) for a, b in v.items()}
        return round(v, 2) if isinstance(v, float) else v
    print(k.ljust(26), "2021:", f(by[2021].get(k)), "| 2024:", f(by[2024].get(k)))

print("\n== C. Baseline 1991-2020 normals ==")
ref = [by[yy] for yy in range(1991, 2021)]
for k in ("p_mjja", "hot30_mjja", "hot32_mjja", "hot35_mjja", "dry_spell_max_mjja", "htc_mjja", "htc_jja", "et0_hg_mjja", "cwb_mjja",
          "tmean_mjja", "gdd0_sow_to_aug31", "gwetroot_jun_jul"):
    v = np.array([r[k] for r in ref], float)
    print(k.ljust(22), "mean=%.2f median=%.2f sd=%.2f min=%.2f max=%.2f" % (v.mean(), np.median(v), v.std(ddof=1), v.min(), v.max()))
print("monthly P normals:", {mm: round(float(np.mean([r["p_month"][mm] for r in ref])), 1) for mm in (4, 5, 6, 7, 8, 9)})
print("HTC class counts 1991-2026:", {c: sum(cm.htc_class(r["htc_mjja"]) == c for r in rows) for c in
      ("very severe drought", "severe drought", "moderate drought", "mild drought / insufficient moisture", "adequate moisture", "excess moisture")})

print("\n== D. ET0: Hargreaves vs FAO-56 PM, MJJA sums ==")
both = [(r["et0_hg_mjja"], r["et0_pm_mjja"]) for r in rows if "et0_pm_mjja" in r]
a = np.array(both)
print("n=%d  HG mean=%.0f  PM mean=%.0f  ratio HG/PM=%.3f  r=%.3f" % (len(a), a[:, 0].mean(), a[:, 1].mean(), (a[:, 0] / a[:, 1]).mean(), np.corrcoef(a.T)[0, 1]))
print("EVLAND (MERRA-2 actual ET) MJJA: 2021=%.0f mm 2024=%.0f mm" % tuple(np.nansum(d["EVLAND"][(y == yy) & (m >= 5) & (m <= 8)]) for yy in (2021, 2024)))
ra = cm.ra_mj(lat, doy)
ok = ~np.isnan(d["TOA_SW_DWN"])
print("Ra formula vs POWER TOA_SW_DWN: mean bias %.3f MJ, r=%.4f" % (np.mean(ra[ok] - d["TOA_SW_DWN"][ok]), np.corrcoef(ra[ok], d["TOA_SW_DWN"][ok])[0, 1]))

print("\n== E. Trends 1991-2025 (Theil-Sen per decade, Mann-Kendall) ==")
tr = [by[yy] for yy in range(1991, 2026)]
ann = {yy: (float(np.nansum(d["PRECTOTCORR"][y == yy])), float(np.nanmean(d["T2M"][y == yy]))) for yy in range(1991, 2026)}
series = {
    "MJJA precipitation (mm)": [r["p_mjja"] for r in tr],
    "May precipitation (mm)": [r["p_month"][5] for r in tr],
    "June precipitation (mm)": [r["p_month"][6] for r in tr],
    "July precipitation (mm)": [r["p_month"][7] for r in tr],
    "Aug precipitation (mm)": [r["p_month"][8] for r in tr],
    "Nov-Mar precipitation (mm)": [r["p_coldseason"] for r in tr],
    "Annual precipitation (mm)": [ann[r["year"]][0] for r in tr],
    "MJJA mean T (C)": [r["tmean_mjja"] for r in tr],
    "Annual mean T (C)": [ann[r["year"]][1] for r in tr],
    "Days Tmax>=30 MJJA": [r["hot30_mjja"] for r in tr],
    "Days Tmax>=35 MJJA": [r["hot35_mjja"] for r in tr],
    "Longest dry spell MJJA (d)": [r["dry_spell_max_mjja"] for r in tr],
    "HTC May-Aug": [r["htc_mjja"] for r in tr],
    "ET0 Hargreaves MJJA (mm)": [r["et0_hg_mjja"] for r in tr],
    "P - ET0 MJJA (mm)": [r["cwb_mjja"] for r in tr],
    "GDD0 sowing->31 Aug": [r["gdd0_sow_to_aug31"] for r in tr],
    "GWETROOT Jun-Jul": [r["gwetroot_jun_jul"] for r in tr],
}
for name, s in series.items():
    S, z, p = cm.mann_kendall(s)
    print(name.ljust(30), "Sen %+8.3f /decade  MK Z=%+.2f p=%.3f  %s | 1991-2005 mean %.2f vs 2011-2025 mean %.2f" % (
        10 * cm.theil_sen(s), z, p, "SIGNIFICANT" if p < 0.05 else "not significant", np.mean(s[:15]), np.mean(s[-15:])))
print("same, full record 1981-2025 for T and P (annual + MJJA):")
yrs = range(1981, 2026)
for name, s in {
    "MJJA precipitation (mm)": [float(np.nansum(d["PRECTOTCORR"][(y == yy) & (m >= 5) & (m <= 8)])) for yy in yrs],
    "MJJA mean T (C)": [float(np.nanmean(d["T2M"][(y == yy) & (m >= 5) & (m <= 8)])) for yy in yrs],
    "Days Tmax>=30 MJJA": [int(np.sum(d["T2M_MAX"][(y == yy) & (m >= 5) & (m <= 8)] >= 30)) for yy in yrs],
}.items():
    S, z, p = cm.mann_kendall(s)
    print(name.ljust(30), "Sen %+8.3f /decade  MK Z=%+.2f p=%.3f" % (10 * cm.theil_sen(s), z, p))

print("\n== F. Soil wetness monthly means and percentile vs 1991-2020, 2021 and 2024 ==")
for var in ("GWETTOP", "GWETROOT", "GWETPROF"):
    for yy in (2021, 2024):
        line = []
        for mm in (5, 6, 7, 8, 9):
            v = float(np.nanmean(d[var][(y == yy) & (m == mm)]))
            s = [float(np.nanmean(d[var][(y == k) & (m == mm)])) for k in range(1991, 2021)]
            line.append("%d: %.2f (p%.0f)" % (mm, v, cm.pct_rank(v, s)))
        print(var, yy, " ".join(line))
print("GWETROOT all-days range 1991-2025: min %.2f max %.2f" % (np.nanmin(d["GWETROOT"][y >= 1991]), np.nanmax(d["GWETROOT"][y >= 1991])))
print("FROST_DAYS param vs Tmin<=0, May-Sep 2021/2024:", [(int(np.nansum(d["FROST_DAYS"][(y == yy) & (m >= 5) & (m <= 9)])), int(np.sum(d["T2M_MIN"][(y == yy) & (m >= 5) & (m <= 9)] <= 0))) for yy in (2021, 2024)])
print("POWER GDD4_4 sum 15 May-31 Aug 2021/2024:", [round(float(np.nansum(d["GDD4_4"][(dates >= np.datetime64(date(yy, 5, 15))) & (dates <= np.datetime64(date(yy, 8, 31)))])), 0) for yy in (2021, 2024)])

if len(sys.argv) > 2:
    print("\n== G. Second opinion inside POWER: IMERG_PRECTOT (UTC) vs PRECTOTCORR (UTC), MJJA sums ==")
    du, u, _, _ = cm.load(sys.argv[2])
    yu, mu, _ = cm.ymd(du)
    a, b, yy_ok = [], [], []
    for yy in range(2001, 2026):
        w = (yu == yy) & (mu >= 5) & (mu <= 8)
        if np.isnan(u["IMERG_PRECTOT"][w]).any():
            continue
        a.append(float(np.sum(u["PRECTOTCORR"][w]))); b.append(float(np.sum(u["IMERG_PRECTOT"][w]))); yy_ok.append(yy)
    a, b = np.array(a), np.array(b)
    for yy, p1, p2 in zip(yy_ok, a, b):
        print(yy, "MERRA2corr=%.0f IMERG=%.0f" % (p1, p2))
    print("n=%d mean MERRA2corr=%.0f IMERG=%.0f, r=%.2f, IMERG/MERRA2=%.2f" % (len(a), a.mean(), b.mean(), np.corrcoef(a, b)[0, 1], b.mean() / a.mean()))
    for yy in (2021, 2024):
        i = yy_ok.index(yy)
        print(yy, "MERRA2corr %.0f mm = %.0f%% of its 2001-2025 mean | IMERG %.0f mm = %.0f%% of its mean" % (a[i], 100 * a[i] / a.mean(), b[i], 100 * b[i] / b.mean()))

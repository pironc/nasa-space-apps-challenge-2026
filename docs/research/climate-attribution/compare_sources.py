"""Compare POWER (MERRA-2) with Open-Meteo archive files. Usage: python3 compare_sources.py <power_lst.json> <label=open_meteo.json>..."""
import json
import sys

import numpy as np

import climate_metrics as cm

dates, d, lat, elev = cm.load(sys.argv[1])
y, m, _ = cm.ymd(dates)
YRS = list(range(1991, 2026))


def seasonal(dts, tmax, tmean, pr):
    yy, mm, _ = cm.ymd(dts)
    out = {}
    for k in YRS:
        w = (yy == k) & (mm >= 5) & (mm <= 8)
        out[k] = (float(np.nansum(pr[w])), int(np.nansum(tmax[w] > 30)), float(np.nanmean(tmean[w])), float(np.nanmax(tmax[w])))
    return out


src = {"POWER/MERRA-2": seasonal(dates, d["T2M_MAX"], d["T2M"], d["PRECTOTCORR"])}
for arg in sys.argv[2:]:
    label, path = arg.split("=", 1)
    j = json.load(open(path))["daily"]
    f = lambda k: np.array([np.nan if v is None else v for v in j[k]], float)
    src[label] = seasonal(np.array(j["time"], dtype="datetime64[D]"), f("temperature_2m_max"), f("temperature_2m_mean"), f("precipitation_sum"))

ref = src["POWER/MERRA-2"]
names = ["MJJA precip mm", "days Tmax>30", "MJJA mean T", "peak Tmax"]
for label, s in src.items():
    print("\n##", label)
    for i, nm in enumerate(names):
        a = np.array([s[k][i] for k in YRS], float)
        b = np.array([ref[k][i] for k in YRS], float)
        S, z, p = cm.mann_kendall(a)
        print("%-15s mean %7.2f | 2021 %7.2f (rank %2d of %d, 1=lowest) | 2024 %7.2f (rank %2d) | r vs POWER %.2f | bias vs POWER %+7.2f | Sen %+.3f/decade p=%.3f" % (
            nm, a.mean(), s[2021][i], 1 + int(np.sum(a < s[2021][i])), len(a), s[2024][i], 1 + int(np.sum(a < s[2024][i])),
            np.corrcoef(a, b)[0, 1], (a - b).mean(), 10 * cm.theil_sen(a), p))
    a = np.array([s[k][0] for k in YRS])
    print("  2021 precip = %.0f%% of 1991-2020 mean; 2024 = %.0f%%" % (100 * s[2021][0] / a[:30].mean(), 100 * s[2024][0] / a[:30].mean()))

# daily Tmax agreement, May-Aug 1991-2025
if len(sys.argv) > 2:
    label, path = sys.argv[2].split("=", 1)
    j = json.load(open(path))["daily"]
    od = np.array(j["time"], dtype="datetime64[D]")
    ot = np.array([np.nan if v is None else v for v in j["temperature_2m_max"]], float)
    common, ia, ib = np.intersect1d(dates, od, return_indices=True)
    mm = cm.ymd(common)[1]
    w = (mm >= 5) & (mm <= 8) & ~np.isnan(d["T2M_MAX"][ia]) & ~np.isnan(ot[ib])
    diff = d["T2M_MAX"][ia][w] - ot[ib][w]
    print("\nDaily Tmax May-Aug, POWER minus %s: mean %+.2f C, RMSD %.2f C, r=%.3f, n=%d" % (label, diff.mean(), np.sqrt((diff ** 2).mean()), np.corrcoef(d["T2M_MAX"][ia][w], ot[ib][w])[0, 1], w.sum()))
    print("2021-07-02 Tmax: POWER %.1f, %s %.1f" % (d["T2M_MAX"][dates == np.datetime64("2021-07-02")][0], label, ot[od == np.datetime64("2021-07-02")][0]))

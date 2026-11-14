"""Numpy-only core used by the throwaway analysis scripts (mirrors the spec in report.md)."""
import numpy as np, datetime as dt

BANDS = ["B02", "B04", "B05", "B08", "B8A", "B11", "B12"]
SQ = ["A_crop2026", "B_fallow2026", "C_bigSE", "D_brownNW", "E_brownNE", "F_steppe"]

def load(path):
    z = np.load(path, allow_pickle=False)
    d = {k: z[k] for k in z.files}
    d["date"] = np.array([dt.date.fromisoformat(s[:10]) for s in d["datetime"]])
    d["offset"] = np.where(d["baseline"].astype(float) >= 4.0, 1000.0, 0.0)  # THE rule
    return d

def refl(d, sq, band, harmonise=True):
    dn = d[f"{sq}__{band}"].astype("float32")
    off = d["offset"][:, None, None] if harmonise else 0.0
    r = (dn - off) / 10000.0
    r[dn == 0] = np.nan  # 0 = NODATA
    return r

def nd(a, b):
    with np.errstate(invalid="ignore", divide="ignore"):
        return np.where((a + b) > 0, (a - b) / (a + b), np.nan)

def scene_stats(d, sq, harmonise=True, valid_classes=(4, 5)):
    """Per-scene zonal stats over the square. Returns dict of 1-D arrays (one per scene)."""
    scl = d[f"{sq}__SCL"]
    R = {b: refl(d, sq, b, harmonise) for b in BANDS}
    ok = np.isin(scl, valid_classes) & np.isfinite(R["B04"]) & np.isfinite(R["B08"])
    n = scl.shape[1] * scl.shape[2]
    out = {"clear": ok.reshape(len(scl), -1).sum(1) / n,
           "snow": (scl == 11).reshape(len(scl), -1).sum(1) / n,
           "cloud": np.isin(scl, (8, 9, 10)).reshape(len(scl), -1).sum(1) / n,
           "shadow": np.isin(scl, (2, 3)).reshape(len(scl), -1).sum(1) / n}
    for c in range(12):
        out[f"scl{c}"] = (scl == c).reshape(len(scl), -1).sum(1) / n
    idx = {"ndvi": nd(R["B08"], R["B04"]), "ndmi": nd(R["B08"], R["B11"]), "ndre": nd(R["B08"], R["B05"]),
           "nbr2": nd(R["B11"], R["B12"]),
           "bsi": nd(R["B11"] + R["B04"], R["B08"] + R["B02"])}
    for k, v in idx.items():
        v = np.where(ok, v, np.nan).reshape(len(scl), -1)
        with np.errstate(all="ignore"):
            import warnings
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                out[k] = np.nanmedian(v, 1); out[k + "_mean"] = np.nanmean(v, 1); out[k + "_std"] = np.nanstd(v, 1)
                out[k + "_p10"] = np.nanpercentile(v, 10, 1); out[k + "_p90"] = np.nanpercentile(v, 90, 1)
    return out

def dekad_index(date):
    """0-based dekad of year (36 per year): 3 per month, days 1-10, 11-20, 21-end."""
    return (date.month - 1) * 3 + min((date.day - 1) // 10, 2)

def despike(t, v, drop=0.10, win=20):
    """Drop obs that are lower than BOTH neighbours (within `win` days) by more than `drop`: cloud/shadow leak.
    t: day ordinals sorted, v: values. Returns boolean keep mask."""
    keep = np.ones(len(v), bool)
    for i in range(1, len(v) - 1):
        if t[i] - t[i - 1] <= win and t[i + 1] - t[i] <= win and v[i] < v[i - 1] - drop and v[i] < v[i + 1] - drop:
            keep[i] = False
    return keep

def to_dekads(dates, vals, first=12, last=26, how="max"):
    """Composite one season's observations into dekads first..last (12 = 1-10 May, 26 = 21-30 Sep). NaN where empty."""
    out = np.full(last - first + 1, np.nan)
    dk = np.array([dekad_index(x) for x in dates])
    for j in range(first, last + 1):
        m = (dk == j) & np.isfinite(vals)
        if m.any():
            out[j - first] = vals[m].max() if how == "max" else np.median(vals[m])
    return out

def fill_gaps(y, max_gap=3):
    """Linear interpolation across interior gaps of <= max_gap dekads; longer gaps and edges stay NaN."""
    y = y.copy(); ok = np.isfinite(y); idx = np.flatnonzero(ok)
    for a, b in zip(idx[:-1], idx[1:]):
        if 1 < b - a <= max_gap + 1:
            y[a:b + 1] = np.interp(np.arange(a, b + 1), [a, b], [y[a], y[b]])
    return y

def whittaker(y, lam=2.0):
    """Whittaker smoother with 0/1 weights (Eilers 2003); gaps are interpolated. numpy only."""
    w = np.isfinite(y).astype(float); m = len(y)
    D = np.diff(np.eye(m), 2, axis=0)
    return np.linalg.solve(np.diag(w) + lam * D.T @ D, w * np.nan_to_num(y))

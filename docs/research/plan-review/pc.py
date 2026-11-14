"""Scratch helpers for the data-seam review. httpx only (+ numpy for local checks)."""
import asyncio, json, math, time
import httpx

STAC = "https://planetarycomputer.microsoft.com/api/stac/v1/search"
DATA = "https://planetarycomputer.microsoft.com/api/data/v1"
STATS = DATA + "/item/statistics"
UA = {"User-Agent": "research-client/1.0"}
CLEAR = "(SCL==4)|(SCL==5)"
SENT = -9
BINS, RANGE = 400, (-1.0, 1.0)          # 0.005-wide bins


def rect(lon, lat, w_km=2.0, h_km=1.5):
    dlon = w_km / (111.32 * math.cos(math.radians(lat))) / 2
    dlat = h_km / 110.95 / 2
    ring = [[lon - dlon, lat - dlat], [lon + dlon, lat - dlat], [lon + dlon, lat + dlat], [lon - dlon, lat + dlat], [lon - dlon, lat - dlat]]
    return {"type": "Feature", "properties": {}, "geometry": {"type": "Polygon", "coordinates": [ring]}}


def s2_expression(baseline: str, sent=SENT) -> str:
    """Band 1 = clear mask (1/0); bands 2-4 = NDVI, NDMI, NBR2 where clear else the sentinel.
    Baseline >= 04.00: DN = refl*10000 + 1000, so every two-band SUM loses 2000 (differences are unaffected)."""
    d = "-2000" if float(baseline) >= 4 else ""
    idx = lambda a, b: f"where({CLEAR},({a}-{b})/({a}+{b}{d}),{sent})"
    return ";".join([f"where({CLEAR},1,0)", idx("B08", "B04"), idx("B08", "B11"), idx("B11", "B12"), "where(SCL==11,1,0)"])


def s2_params(item, baseline):
    return {"collection": "sentinel-2-l2a", "item": item, "asset_as_band": "true", "max_size": 512,
            "expression": s2_expression(baseline), "histogram_bins": BINS, "histogram_range": f"{RANGE[0]},{RANGE[1]}"}


def hist_quantiles(counts, edges, qs):
    """Quantiles from a histogram with linear interpolation inside the bin. Returns None for an empty histogram."""
    n = sum(counts)
    if not n: return [None] * len(qs)
    out = []
    for q in qs:
        target, cum = q * n, 0.0
        for c, lo, hi in zip(counts, edges[:-1], edges[1:]):
            if c and cum + c >= target:
                out.append(lo + (hi - lo) * (target - cum) / c); break
            cum += c
        else: out.append(edges[-1])
    return out


def parse_s2(stat):
    """stat: list of 5 band dicts from the statistics response -> one row (clear, snow, ndvi median/p10/p90/mean, ndmi, nbr2 medians)."""
    m, nd, nm, nb, sn = stat
    # NOTE valid_percent = valid pixels / BOUNDING-BOX pixels, so mean*valid_percent/100 (field_series.py) under-reports "clear"
    # for every polygon that is not a lat/lon-aligned rectangle. clear is finalised in s2_series: mean * n_px / max(n_px).
    row = {"clear": round(m["mean"], 4), "snow": round(sn["mean"], 4), "n_px": int(m["valid_pixels"]), "valid_percent": m["valid_percent"]}
    if m["mean"] <= 0: return row
    f = m["mean"]
    unsent = lambda b: (b["mean"] - SENT * (1 - f)) / f          # masked mean, undoing the sentinel
    q = lambda b, qs: [None if x is None else round(x, 4) for x in hist_quantiles(b["histogram"][0], b["histogram"][1], qs)]
    row["p10"], row["ndvi"], row["p90"] = q(nd, [0.10, 0.50, 0.90])
    row["ndvi_mean"] = round(unsent(nd), 4)
    row["ndmi"], row["nbr2"] = q(nm, [0.5])[0], q(nb, [0.5])[0]
    row["ndmi_mean"], row["nbr2_mean"] = round(unsent(nm), 4), round(unsent(nb), 4)
    row["hist_frac"] = round(sum(nd["histogram"][0]) / max(m["valid_pixels"], 1), 4)   # should equal clear/valid: sanity check
    return row


async def search(c, collection, geometry, start, end, fields):
    body = {"collections": [collection], "intersects": geometry, "datetime": f"{start}T00:00:00Z/{end}T23:59:59Z", "limit": 1000,
            "fields": {"include": ["id"] + [f"properties.{f}" for f in fields], "exclude": ["assets", "links", "geometry", "bbox"]}}
    url, out = STAC, []
    while url:
        for attempt in range(4):
            try:
                r = await c.post(url, json=body)
                if r.status_code == 200: break
            except httpx.HTTPError: pass
            await asyncio.sleep(1 + 2 * attempt)
        r.raise_for_status(); js = r.json(); out += js["features"]
        nxt = [l for l in js.get("links", []) if l["rel"] == "next"]
        url, body = (nxt[0]["href"], nxt[0].get("body", body)) if nxt else (None, body)
    return out


CODES = {}


async def stats(c, sem, feature, params):
    async with sem:
        for attempt in range(4):
            try:
                r = await c.post(STATS, params=params, json=feature)
                CODES[r.status_code] = CODES.get(r.status_code, 0) + 1
                if r.status_code == 200: return list(r.json()["properties"]["statistics"].values())
                if r.status_code == 500: return None
            except httpx.HTTPError as e:
                CODES[type(e).__name__] = CODES.get(type(e).__name__, 0) + 1
            await asyncio.sleep(1 + 2 * attempt)
    return None


def dedup_s2(items, months=("05", "09")):
    best = {}
    for it in items:
        p = it["properties"]; d = p["datetime"][:10]
        if not (months[0] <= d[5:7] <= months[1]): continue
        k = (d, p.get("s2:mgrs_tile")); v = (float(p.get("s2:processing_baseline", "0")), it["id"])
        if k not in best or v > best[k][0]: best[k] = (v, it)
    return [v[1] for v in best.values()]


async def s2_series(c, sem, feature, start, end):
    items = await search(c, "sentinel-2-l2a", feature["geometry"], start, end, ["datetime", "s2:processing_baseline", "s2:mgrs_tile"])
    todo = dedup_s2(items)
    async def one(it):
        p = it["properties"]; b = p.get("s2:processing_baseline", "0")
        s = await stats(c, sem, feature, s2_params(it["id"], b))
        if not s: return None
        return {"date": p["datetime"][:10], "item": it["id"], "baseline": b, **parse_s2(s)}
    rows = [r for r in await asyncio.gather(*(one(it) for it in todo)) if r]
    npoly = max((r["n_px"] for r in rows), default=1) or 1      # polygon pixel count = best-covered scene (swath-edge scenes have fewer valid pixels)
    for r in rows:
        r["clear_bbox"] = round(r["clear"] * r["valid_percent"] / 100, 4)      # what field_series.py would have stored
        r["clear"] = round(r["clear"] * r["n_px"] / npoly, 4); r["snow"] = round(r["snow"] * r["n_px"] / npoly, 4)
    byday = {}
    for r in rows:                                           # tile overlap: keep the better-covered tile per day
        if r["date"] not in byday or r["clear"] > byday[r["date"]]["clear"]: byday[r["date"]] = r
    return sorted(byday.values(), key=lambda r: r["date"]), len(items), len(todo)


async def modis_series(c, sem, feature, start, end):
    items = await search(c, "modis-13Q1-061", feature["geometry"], start, end, ["start_datetime", "platform"])
    todo = [it for it in items if it["id"].startswith("MOD13Q1") and "05" <= it["properties"]["start_datetime"][5:7] <= "09"]
    async def one(it):
        s = await stats(c, sem, feature, [("collection", "modis-13Q1-061"), ("item", it["id"]), ("assets", "250m_16_days_NDVI"), ("assets", "250m_16_days_pixel_reliability")])
        if not s or s[0]["mean"] is None or s[1]["mean"] is None: return None      # all pixels nodata in that composite (seen live)
        return {"date": it["properties"]["start_datetime"][:10], "item": it["id"], "ndvi": round(s[0]["mean"] * 1e-4, 4), "ndvi_median": round(s[0]["median"] * 1e-4, 4),
                "reliability": round(s[1]["mean"], 2), "rel_max": s[1]["max"], "n_px": s[0]["valid_pixels"]}
    rows = [r for r in await asyncio.gather(*map(one, todo)) if r]
    last = {}
    for r in sorted(rows, key=lambda r: r["item"]): last[r["date"]] = r      # reprocessed duplicates: keep the latest production stamp
    return sorted(last.values(), key=lambda r: r["date"]), len(items), len(todo)


def client(conc):
    return httpx.AsyncClient(timeout=60, limits=httpx.Limits(max_connections=conc), headers=UA)


if __name__ == "__main__":
    assert s2_expression("03.00").count("-2000") == 0 and s2_expression("05.11").count("-2000") == 3
    q = hist_quantiles([0, 10, 10, 0], [0, 1, 2, 3, 4], [0.1, 0.5, 0.9])
    assert [round(x, 6) for x in q] == [1.2, 2.0, 2.8], q
    assert hist_quantiles([0, 0], [0, 1, 2], [0.5]) == [None]
    print("pc.py self-check OK")

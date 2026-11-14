"""Reference shape of the recommended backend path (deps: httpx only).
Per-field time series from Planetary Computer with no raster libraries:
  Sentinel-2 L2A  -> cloud-masked NDVI / NDMI / NDRE + clear fraction, one POST per scene
  MODIS 13Q1      -> 16-day NDVI back to 2000, one POST per composite
usage: field_series.py CONCURRENCY S2_SINCE MODIS_SINCE   (ISO dates; rows strictly after them are fetched)"""
import asyncio, json, sys, time, collections
import httpx

STAC = "https://planetarycomputer.microsoft.com/api/stac/v1/search"
STATS = "https://planetarycomputer.microsoft.com/api/data/v1/item/statistics"
CLEAR = "(SCL==4)|(SCL==5)"   # vegetation | bare soil. ponytail: 2-class mask; add 6/7 if scenes get too sparse
SEASON = ("05", "09")         # May..September

def s2_expression(baseline: str) -> str:
    """Band 1 = clear mask, bands 2-4 = index where clear else 0. Masked mean = mean(band)/mean(mask).
    Processing baseline >= 04.00 stores DN = reflectance*10000 + 1000, so the sum loses 2000 (difference is unaffected)."""
    d = "-2000" if float(baseline) >= 4 else ""
    idx = lambda b: f"where({CLEAR},(B08-{b})/(B08+{b}{d}),0)"
    return ";".join([f"where({CLEAR},1,0)", idx("B04"), idx("B11"), idx("B05")])

async def search(c, collection, geometry, start, fields):
    body = {"collections": [collection], "intersects": geometry, "datetime": f"{start}T00:00:00Z/..", "limit": 1000,
            "fields": {"include": ["id"] + [f"properties.{f}" for f in fields], "exclude": ["assets", "links", "geometry", "bbox"]}}
    url, out = STAC, []
    while url:
        r = await c.post(url, json=body); r.raise_for_status(); js = r.json(); out += js["features"]
        nxt = [l for l in js.get("links", []) if l["rel"] == "next"]
        url, body = (nxt[0]["href"], nxt[0].get("body", body)) if nxt else (None, body)
    return out

async def stats(c, sem, feature, params):
    async with sem:
        for attempt in range(3):
            try:
                r = await c.post(STATS, params=params, json=feature)
                if r.status_code == 200: return list(r.json()["properties"]["statistics"].values())
                if r.status_code == 500: return None      # deterministic per-item failure seen on 1 of ~3,000 calls: skip the scene
            except httpx.HTTPError: pass
            await asyncio.sleep(1 + 2 * attempt)          # 429/502/timeouts: back off
    return None

async def s2_series(c, sem, feature, since):
    items = await search(c, "sentinel-2-l2a", feature["geometry"], since, ["datetime", "s2:processing_baseline", "s2:mgrs_tile"])
    best = {}                                             # reprocessing duplicates: keep the highest baseline per (date, tile)
    for it in items:
        p = it["properties"]; d = p["datetime"][:10]
        if not (SEASON[0] <= d[5:7] <= SEASON[1]) or d <= since: continue
        k = (d, p.get("s2:mgrs_tile")); v = (float(p.get("s2:processing_baseline", "0")), it["id"])
        if k not in best or v > best[k][0]: best[k] = (v, it)
    async def one(it):
        p = it["properties"]
        s = await stats(c, sem, feature, {"collection": "sentinel-2-l2a", "item": it["id"], "asset_as_band": "true", "max_size": 512,
                                          "expression": s2_expression(p.get("s2:processing_baseline", "0"))})
        if not s: return None
        clear = s[0]["mean"]; row = {"date": p["datetime"][:10], "item": it["id"], "valid": round(clear * s[0]["valid_percent"] / 100, 3)}
        for name, band in zip(("ndvi", "ndmi", "ndre"), s[1:]): row[name] = round(band["mean"] / clear, 4) if clear > 0 else None
        return row
    rows = [r for r in await asyncio.gather(*(one(v[1]) for v in best.values())) if r]
    byday = {}                                            # polygon on a tile overlap: keep the better-covered tile per day
    for r in rows:
        if r["date"] not in byday or r["valid"] > byday[r["date"]]["valid"]: byday[r["date"]] = r
    return sorted(byday.values(), key=lambda r: r["date"]), len(items), len(best)

async def modis_series(c, sem, feature, since):
    items = await search(c, "modis-13Q1-061", feature["geometry"], since, ["start_datetime", "platform"])
    todo = [it for it in items if SEASON[0] <= it["properties"]["start_datetime"][5:7] <= SEASON[1] and it["properties"]["start_datetime"][:10] > since]
    async def one(it):
        s = await stats(c, sem, feature, [("collection", "modis-13Q1-061"), ("item", it["id"]), ("assets", "250m_16_days_NDVI"), ("assets", "250m_16_days_pixel_reliability")])
        if not s: return None
        # scale 0.0001 applied here: unscale=true on the API multiplies by 10000 instead (seen live). reliability 0 good, 1 marginal, 2 snow, 3 cloud
        return {"date": it["properties"]["start_datetime"][:10], "item": it["id"], "ndvi": round(s[0]["mean"] * 1e-4, 4), "reliability": round(s[1]["mean"], 2)}
    rows = [r for r in await asyncio.gather(*map(one, todo)) if r]
    return sorted(rows, key=lambda r: (r["date"], r["item"])), len(items), len(todo)

async def main(conc, s2_since, modis_since, feature):
    sem = asyncio.Semaphore(conc); t = time.time()
    async with httpx.AsyncClient(timeout=60, limits=httpx.Limits(max_connections=conc), headers={"User-Agent": "data-path-spike/0.1"}) as c:
        (s2, n_s2, c_s2), (mod, n_mod, c_mod) = await asyncio.gather(s2_series(c, sem, feature, s2_since), modis_series(c, sem, feature, modis_since))
    return {"s2": s2, "modis": mod}, f"S2 {n_s2} found/{c_s2} calls/{len(s2)} rows | MODIS {n_mod} found/{c_mod} calls/{len(mod)} rows | {time.time()-t:.1f}s at concurrency {conc}"

if __name__ == "__main__":
    assert s2_expression("03.00").count("-2000") == 0 and s2_expression("05.11").count("-2000") == 3 and s2_expression("04.00").startswith("where((SCL==4)|(SCL==5),1,0);")
    root = __file__.rsplit("/", 2)[0]
    feature = json.load(open(root + "/out/polygon.geojson"))
    out, msg = asyncio.run(main(int(sys.argv[1]), sys.argv[2], sys.argv[3], feature))
    print(msg)
    name = f"{root}/out/field_series_{sys.argv[2]}_{sys.argv[3]}.json"; json.dump(out, open(name, "w"), separators=(",", ":"))
    import os; print("json bytes:", os.path.getsize(name))

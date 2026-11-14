"""Per-field satellite series from the Planetary Computer statistics endpoint: no key, no raster libraries.

Sentinel-2 L2A: one POST per scene returns the clear fraction, the snow fraction and the field MEDIAN of
NDVI, NDMI and NBR2 over clear pixels, read from the endpoint's histogram (masked pixels are filled with
MASK_FILL, which falls outside the histogram range; the endpoint's own median counts them, so it is not used).
MODIS 13Q1: one POST per 16-day composite, back to 2000."""
import asyncio

import httpx

from . import constants as K

STAC = "https://planetarycomputer.microsoft.com/api/stac/v1/search"
STATS = "https://planetarycomputer.microsoft.com/api/data/v1/item/statistics"
CLEAR = "|".join(f"(SCL=={c})" for c in K.CLEAR_SCL)
FAILED = object()                      # an upstream call that never answered (as opposed to "skip this scene")
_sem = asyncio.Semaphore(K.CONCURRENCY)   # global: every user shares the same upstream budget


class UpstreamError(RuntimeError):
    """An outside data service failed; the message is safe to show to a user."""


def s2_expression(baseline: str) -> str:
    """Band 1 = clear mask, band 2 = snow mask, bands 3-5 = NDVI, NDMI, NBR2 where clear, else MASK_FILL.
    Baseline >= 04.00 stores reflectance * 10000 + 1000 in EVERY band: a sum of two bands loses 2000,
    a difference of two bands is unaffected."""
    d = "-2000" if float(baseline) >= K.OFFSET_BASELINE else ""
    idx = lambda a, b: f"where({CLEAR},({a}-{b})/({a}+{b}{d}),{K.MASK_FILL})"
    return ";".join([f"where({CLEAR},1,0)", f"where(SCL=={K.SNOW_SCL},1,0)", idx("B08", "B04"), idx("B08", "B11"), idx("B11", "B12")])


def hist_quantiles(counts, edges, qs):
    """Quantiles from a histogram, linear inside a bin. None for an empty histogram."""
    n = sum(counts)
    if not n:
        return [None] * len(qs)
    out = []
    for q in qs:
        target, cum = q * n, 0.0
        for c, lo, hi in zip(counts, edges[:-1], edges[1:]):
            if c and cum + c >= target:
                out.append(lo + (hi - lo) * (target - cum) / c)
                break
            cum += c
        else:
            out.append(edges[-1])
    return out


async def _post(c, url, **kw):
    """POST with backoff on rate limits, gateway errors and timeouts. None when every try failed."""
    for attempt in range(K.RETRIES):
        try:
            r = await c.post(url, **kw)
            if r.status_code not in (429, 502, 503, 504):
                return r
        except httpx.TransportError:
            pass
        await asyncio.sleep(1 + 2 * attempt)
    return None


async def _search(c, collection, geometry, start, props):
    body = {"collections": [collection], "intersects": geometry, "datetime": f"{start}T00:00:00Z/..", "limit": 1000,
            "fields": {"include": ["id"] + [f"properties.{p}" for p in props], "exclude": ["assets", "links", "geometry", "bbox"]}}
    url, out = STAC, []
    while url:
        r = await _post(c, url, json=body)
        if r is None or r.status_code != 200:
            raise UpstreamError("The satellite catalogue (Planetary Computer) did not answer. Please try again in a minute.")
        js = r.json()
        out += js["features"]
        nxt = [l for l in js.get("links", []) if l["rel"] == "next"]
        url, body = (nxt[0]["href"], nxt[0].get("body", body)) if nxt else (None, body)
    return out


async def _stats(c, feature, params):
    """Statistics blocks of one item; None = skip this scene (its own HTTP 500); FAILED = no answer."""
    async with _sem:
        r = await _post(c, STATS, params=params, json=feature)
    if r is not None and r.status_code == 500:
        return None                    # a deterministic per-item HTTP 500 was seen on 1 of about 3,000 scenes
    if r is None or r.status_code != 200:
        return FAILED
    return list(r.json()["properties"]["statistics"].values())


async def _all(calls):
    out = await asyncio.gather(*calls)
    failed = sum(r is FAILED for r in out)
    if out and failed > K.MAX_FAILED_SHARE * len(out):
        raise UpstreamError(f"The satellite statistics service (Planetary Computer) did not answer for {failed} of {len(out)} scenes. Please try again in a minute.")
    return [r for r in out if r is not None and r is not FAILED]


async def s2_series(c, geometry):
    """-> rows {date, clear, snow, ndvi, ndmi, nbr2}, one per day, May-Sep from S2_FIRST_YEAR. No tile-level cloud filter."""
    feature = {"type": "Feature", "properties": {}, "geometry": geometry}
    items = await _search(c, "sentinel-2-l2a", geometry, f"{K.S2_FIRST_YEAR}-{K.SEASON_MONTHS[0]:02d}-01",
                          ["datetime", "s2:processing_baseline", "s2:mgrs_tile"])
    best = {}                          # reprocessed copies: keep the highest baseline per (date, tile)
    for it in items:
        p = it["properties"]
        d = p["datetime"][:10]
        if not K.SEASON_MONTHS[0] <= int(d[5:7]) <= K.SEASON_MONTHS[1]:
            continue
        k, v = (d, p.get("s2:mgrs_tile")), (float(p.get("s2:processing_baseline") or 0), it["id"])
        if k not in best or v > best[k][0]:
            best[k] = (v, it)

    async def one(it):
        p = it["properties"]
        s = await _stats(c, feature, {"collection": "sentinel-2-l2a", "item": it["id"], "asset_as_band": "true", "max_size": K.MAX_SIZE,
                                      "histogram_bins": K.HIST_BINS, "histogram_range": "-1,1", "expression": s2_expression(p.get("s2:processing_baseline") or "0")})
        if s is None or s is FAILED:
            return s
        m = s[0]["mean"] or 0.0
        row = {"date": p["datetime"][:10], "item": it["id"], "px": s[0]["valid_pixels"], "clear": m, "snow": s[1]["mean"] or 0.0}
        for name, band in zip(("ndvi", "ndmi", "nbr2"), s[2:]):
            q = hist_quantiles(*band["histogram"], [0.5])[0]             # median of the clear pixels
            row[name] = None if q is None else round(q, 4)
        return row

    rows = await _all(one(v[1]) for v in best.values())
    # A scene at the swath edge covers part of the field: scale by pixels seen / pixels in the whole field.
    # (valid_percent cannot do this: it is the share of the bounding box, 50 % for a triangle.)
    full = max((r["px"] for r in rows), default=0) or 1
    byday = {}                         # field on a tile overlap: keep the better-covered tile per day
    for r in rows:
        cover = r.pop("px") / full
        r["clear"], r["snow"] = round(r["clear"] * cover, 3), round(r["snow"] * cover, 3)
        if r["date"] not in byday or r["clear"] > byday[r["date"]]["clear"]:
            byday[r["date"]] = r
    return sorted(byday.values(), key=lambda r: r["date"])


async def modis_series(c, geometry):
    """-> rows {date, ndvi (field mean), reliability (worst pixel)}: MOD13Q1 (Terra) composites starting inside MODIS_WINDOW, from 2000."""
    feature = {"type": "Feature", "properties": {}, "geometry": geometry}
    items = await _search(c, "modis-13Q1-061", geometry, f"{K.MODIS_FIRST_YEAR}-01-01", ["start_datetime"])
    todo = {}                          # many items lack the platform property: filter on the id
    for it in items:
        d = it["properties"]["start_datetime"][:10]
        if it["id"].startswith("MOD13Q1") and K.MODIS_WINDOW[0] <= (int(d[5:7]), int(d[8:10])) <= K.MODIS_WINDOW[1]:
            todo.setdefault(d, []).append(it["id"])

    async def one(d, ids):
        # A field near a tile edge matches two tiles and one answers null: keep the item that has data.
        for item in sorted(ids, reverse=True):                 # ponytail: the empty tile costs one wasted call per date; probe tiles once if it matters
            s = await _stats(c, feature, [("collection", "modis-13Q1-061"), ("item", item),
                                          ("assets", "250m_16_days_NDVI"), ("assets", "250m_16_days_pixel_reliability")])
            if s is FAILED:
                return s
            if s and s[0]["mean"] is not None and s[1]["mean"] is not None:
                # scale 0.0001 applied here: unscale=true on the API multiplies instead.
                # reliability: 0 good, 1 marginal, 2 snow, 3 cloud; the field MAX, so one cloudy pixel rejects the composite
                return {"date": d, "ndvi": round(s[0]["mean"] * 1e-4, 4), "reliability": s[1]["max"]}
        return None

    return sorted(await _all(one(d, i) for d, i in todo.items()), key=lambda r: r["date"])

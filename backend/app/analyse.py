"""Field polygon -> FieldAnalysis JSON (the contract in frontend/src/lib/analysis.ts)."""
import asyncio
import datetime as dt
import hashlib
import json
import math

import httpx
import numpy as np

from . import climate, series, vegetation as veg
from . import constants as K

SOILGRIDS = "https://rest.isric.org/soilgrids/v2.0/properties/query"
MODIS_NOTE = (f"NASA MODIS at 250 m: the highest NDVI between June and late August of each year. MODIS reads about 0.1 higher than "
              f"Sentinel-2, so compare MODIS years only with each other. A year with a peak under {K.MODIS_FALLOW_PEAK} is shown as fallow. "
              "2025 is left out: the source archive has no MODIS data from 26 June to 17 November 2025.")


# ---------- geometry: validation, cache key, area ----------
def canonical_ring(geometry):
    """Validated outer ring: rounded to 5 decimals (about 1 m), open, counter-clockwise, starting at its
    smallest vertex.  Raises ValueError with a message fit to show the user."""
    if not isinstance(geometry, dict) or geometry.get("type") != "Polygon":
        raise ValueError("The field must be a single GeoJSON Polygon.")
    rings = geometry.get("coordinates")
    if not isinstance(rings, list) or len(rings) != 1:
        raise ValueError("The field must be one outline without holes.")
    if not isinstance(rings[0], list) or not K.MIN_VERTICES <= len(rings[0]) <= K.MAX_VERTICES:
        raise ValueError(f"The outline needs {K.MIN_VERTICES} to {K.MAX_VERTICES} points (the last one closes the ring).")
    try:
        pts = [(round(float(x), 5), round(float(y), 5)) for x, y, *_ in rings[0]]
    except (TypeError, ValueError):
        raise ValueError("Every point of the outline must be a [longitude, latitude] pair.") from None
    if not all(math.isfinite(x) and math.isfinite(y) and -180 <= x <= 180 and -85 <= y <= 85 for x, y in pts):
        raise ValueError("The outline has coordinates out of range.")
    pts = [p for i, p in enumerate(pts) if i == 0 or p != pts[i - 1]]
    if len(pts) > 1 and pts[0] == pts[-1]:
        pts.pop()
    twice_area = sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1]))
    if len(pts) < 3 or twice_area == 0:
        raise ValueError("The outline has no area.")
    if twice_area < 0:
        pts.reverse()
    i = pts.index(min(pts))
    return pts[i:] + pts[:i]


def field_hash(ring):
    return hashlib.sha256(json.dumps(ring, separators=(",", ":")).encode()).hexdigest()[:16]


def area_ha(ring):
    """Area on a sphere (the formula @turf/area uses), in hectares."""
    rad = math.radians
    s = sum((rad(x2) - rad(x1)) * (2 + math.sin(rad(y1)) + math.sin(rad(y2))) for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]))
    return abs(s) * K.EARTH_RADIUS_M ** 2 / 2 / 10_000


def validate(geometry):
    """-> (canonical ring, hectares). ValueError when the polygon is not an acceptable field."""
    ring = canonical_ring(geometry)
    ha = area_ha(ring)
    if not K.MIN_HA <= ha <= K.MAX_HA:
        raise ValueError(f"The field covers {ha:,.1f} ha; it must be between {K.MIN_HA} and {K.MAX_HA:,.0f} ha.")
    return ring, ha


# ---------- soil (presets only) ----------
async def soil_at(c, lat, lon):
    """One ISRIC SoilGrids point query, 0-30 cm means. None on any failure: soil is a nice-to-have."""
    try:
        r = await c.get(SOILGRIDS, timeout=K.SOIL_TIMEOUT_S, params=[("lon", lon), ("lat", lat), ("value", "mean")]
                        + [("property", p) for p in ("clay", "sand", "phh2o")] + [("depth", d) for d in K.SOIL_DEPTHS])
        r.raise_for_status()
        out = {}
        for layer in r.json()["properties"]["layers"]:
            v = [(d["values"]["mean"], K.SOIL_DEPTHS[d["label"]]) for d in layer["depths"]]
            out[layer["name"]] = sum(x * w for x, w in v) / sum(w for _, w in v) / layer["unit_measure"]["d_factor"]
        return {"clayPct": round(out["clay"], 1), "sandPct": round(out["sand"], 1), "ph": round(out["phh2o"], 1),
                "source": "ISRIC SoilGrids 2.0, 250 m, 0 to 30 cm (modelled, not a field test)"}
    except Exception:
        return None


# ---------- assembly ----------
def _nums(a, nd=3):
    """numpy array -> JSON list: rounded, null where there is no value. NaN never leaves this module."""
    return [None if not np.isfinite(x) else round(float(x), nd) for x in a]


def assemble(field_id, ring, s2_rows, cell, modis_rows=None, soil=None, today=None):
    """Pure: fetched inputs -> the FieldAnalysis dict."""
    today = today or dt.date.today()
    ha = area_ha(ring)
    rec = veg.records(s2_rows)
    years = range(K.S2_FIRST_YEAR, max((d.year for d in rec["date"]), default=K.S2_FIRST_YEAR) + 1)
    S = {y: veg.build_year(rec, y) for y in years}
    M = {y: veg.metrics(S[y]) for y in years}
    seasons = []
    for y in years:
        # a season still running is judged only up to the current ten-day bin
        upto = None if today >= dt.date(y, 10, 1) else max(veg.dekad_of_year(today) - K.D0, 0)
        m = M[y]
        seasons.append({"year": y, "ndvi": _nums(S[y]["ndvi"]), "ndmi": _nums(S[y]["ndmi"]), "obs": [int(n) for n in S[y]["obs"]],
                        "use": m["use"], "peak": None if m["peak_i"] < 0 else round(m["peak"], 3),
                        "peakDekad": None if m["peak_i"] < 0 else m["peak_i"], "verdicts": veg.verdicts(S, M, y, upto)})
    b = veg.baseline(S, M)
    clim, profile = climate.analyse_cell(cell)
    judged = [s for s in seasons if s["use"] != "unknown"]
    bare = [s for s in judged if s["use"] == "fallow" or any(v["type"] == "BARE_SOIL" for v in s["verdicts"])]
    modis = None
    if modis_rows and ha >= K.MODIS_MIN_HA:
        myears, mmed = veg.modis_years(modis_rows)
        if mmed is not None:
            modis = {"years": myears, "peakMedian": mmed, "note": MODIS_NOTE}
    return {
        "schema": K.SCHEMA, "id": field_id, "generatedAt": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "field": {"areaHa": round(ha, 1), "centre": [round(sum(x for x, _ in ring) / len(ring), 5), round(sum(y for _, y in ring) / len(ring), 5)]},
        "dekads": veg.DEKADS, "seasons": seasons,
        "baseline": b and {"years": b["years"], "median": _nums(b["med"]), "p25": _nums(b["p25"]), "p75": _nums(b["p75"]), "peakMedian": round(b["peak_med"], 3)},
        "modis": modis, "climate": clim,
        "profile": {"rainMeanMm": profile["rainMeanMm"], "water": profile["water"], "heat": profile["heat"], "frost": profile["frost"],
                    "bare": round(len(bare) / len(judged), 2) if judged else 0.0, "years": profile["years"]},
        "soil": soil,
    }


async def analyse(geometry, field_id, include_modis=False, include_soil=False) -> dict:
    """Fetch everything for one field (Sentinel-2, NASA POWER, optionally MODIS and soil) and analyse it."""
    ring = canonical_ring(geometry)
    geom = {"type": "Polygon", "coordinates": [[list(p) for p in ring + ring[:1]]]}      # what leaves the server: rounded outline only
    lon, lat = sum(x for x, _ in ring) / len(ring), sum(y for _, y in ring) / len(ring)  # ponytail: vertex mean, not the area centroid; fine for a 50 km weather cell
    async with httpx.AsyncClient(timeout=60, limits=httpx.Limits(max_connections=K.CONCURRENCY + 4), headers={"User-Agent": K.USER_AGENT}) as c:
        s2, cell, modis, soil = await asyncio.gather(
            series.s2_series(c, geom), climate.load_cell(c, lat, lon),
            series.modis_series(c, geom) if include_modis and area_ha(ring) >= K.MODIS_MIN_HA else asyncio.sleep(0),
            soil_at(c, lat, lon) if include_soil else asyncio.sleep(0))
    return assemble(field_id, ring, s2, cell, modis, soil)

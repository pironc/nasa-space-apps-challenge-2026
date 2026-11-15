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
              f"Sentinel-2 and its pixels include neighbouring land, so MODIS is compared only with MODIS. From {K.S2_FIRST_YEAR} on, a year is "
              f"marked cropped or fallow from the Sentinel-2 curve or the declared land use. Land use before {K.S2_FIRST_YEAR} is not known: "
              f"a summer with a MODIS peak under {K.MODIS_BARE_PEAK:.2f} is shown as bare (a fallow year or a failed crop), every other one as cropped-looking. "
              "2025 is excluded: the source archive has no MODIS data from 26 June to 17 November 2025.")
NO_WEATHER_REASON = ("No unusually dry or hot spell was flagged in the regional weather record before this crop's peak.{} Causes this app cannot see include "
                     "a local shortfall of rain, hail, a frost pocket, late sowing, weeds, pests, disease, nutrition, herbicide injury, or a different crop "
                     "from earlier years; this needs a field visit.")
AFTER_PEAK = " {} weather was flagged this season, but only by a date after this peak, so it remains a possible reason."
SOME_SOWINGS = " {} weather was unusual for some of the sowing dates tested only, so it remains a possible reason."
MODIS_DISAGREES = " The NASA MODIS record at 250 m does not show this year as unusual; the two disagree, which is {} reason for a field visit."
NO_CROP_NOTE = ("No cropped season found", f"No season since {K.S2_FIRST_YEAR} looks like an annual crop on this outline. Check that it follows a field.")


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
    except (TypeError, ValueError, OverflowError):
        raise ValueError("Every point of the outline must be a [longitude, latitude] pair.") from None
    if not all(math.isfinite(x) and math.isfinite(y) and -180 <= x <= 180 and -85 <= y <= 85 for x, y in pts):
        raise ValueError("The outline has coordinates out of range.")
    pts = [p for i, p in enumerate(pts) if i == 0 or p != pts[i - 1]]
    if len(pts) > 1 and pts[0] == pts[-1]:
        pts.pop()
    if len(pts) < 3:
        raise ValueError("The outline has no area.")
    if _crosses(pts):
        raise ValueError("The outline crosses itself.")
    twice_area = sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1]))
    if twice_area == 0:
        raise ValueError("The outline has no area.")
    if twice_area < 0:
        pts.reverse()
    i = pts.index(min(pts))
    return pts[i:] + pts[:i]


def _crosses(pts):
    """True when two non-adjacent edges of the closed ring cross (touching at a point is allowed). At most 200 points, so every pair is tried."""
    side = lambda a, b, c: (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
    edges = list(zip(pts, pts[1:] + pts[:1]))
    return any(side(a, b, c) * side(a, b, d) < 0 and side(c, d, a) * side(c, d, b) < 0
               for i, (a, b) in enumerate(edges) for c, d in edges[i + 2:len(edges) - (i == 0)])


def field_hash(ring, declared_use=None):
    """Cache key and id: the outline, the declared land use and the version of the rules."""
    return hashlib.sha256(json.dumps([K.RULES, ring, sorted((declared_use or {}).items())], separators=(",", ":")).encode()).hexdigest()[:16]


def area_ha(ring):
    """Area on a sphere (the formula @turf/area uses), in hectares."""
    rad = math.radians
    s = sum((rad(x2) - rad(x1)) * (2 + math.sin(rad(y1)) + math.sin(rad(y2))) for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]))
    return abs(s) * K.EARTH_RADIUS_M ** 2 / 2 / 10_000


def validate(geometry):
    """-> (canonical ring, hectares). ValueError when the polygon is not an acceptable field."""
    ring = canonical_ring(geometry)
    xs, ys = zip(*ring)
    w, s, e, n = K.KZ_BOX
    if not (w <= min(xs) and max(xs) <= e and s <= min(ys) and max(ys) <= n):
        raise ValueError("Croppy only covers Kazakhstan. Draw the field inside Kazakhstan.")
    if max(xs) - min(xs) > K.MAX_SPAN_DEG[0] or max(ys) - min(ys) > K.MAX_SPAN_DEG[1]:   # a strip of few hectares can cross dozens of satellite tiles
        raise ValueError("The outline spans more than about 30 km. Outline a single field.")
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


def explanation(deficit, ratio, flags, before, modis_usual=False, some=()):
    """How the regional weather record relates to one season's greenness, in fixed wording. None = nothing to say.
    deficit: severity of the season's VEG_DEFICIT or None; ratio: peak / usual peak, None when the season was not judged;
    flags: the causes ("water_deficit", "heat") robustly flagged over the whole season; before: those that already held by the end of
    the peak's ten-day bin (weather after the peak cannot explain the peak); modis_usual: the MODIS peak of the year was near its median;
    some: the causes flagged for some sowing dates only. Those, and season flags reached only after the peak, are named as possible reasons,
    so the "nothing flagged before the peak" sentence does not sit against the season's own weather numbers."""
    words = lambda ks: " and ".join(w for k, w in (("water_deficit", "dry"), ("heat", "hot")) if k in ks)
    if deficit in ("warning", "severe"):
        if not before:
            maybe = "".join(text.format(words(ks).capitalize()) for text, ks in ((AFTER_PEAK, flags), (SOME_SOWINGS, some)) if words(ks))
            return (NO_WEATHER_REASON.format(maybe)
                    + (MODIS_DISAGREES.format("another") if modis_usual else ""))
        return (f"Regional weather was unusually {words(before)} before this crop's peak (NASA POWER, about 50 km grid). That is consistent with the low "
                "greenness on this field. The grid cannot show whether this field received the same weather."
                + (" Dry and hot conditions came together; the data cannot say which did more harm." if len(before) == 2 else "")
                + (MODIS_DISAGREES.format("a") if modis_usual else ""))
    if flags and ratio is not None and ratio > K.DEFICIT_WATCH:
        return f"Regional weather was unusually {words(flags)} this season, but this field's greenness stayed within its usual range."
    return None                                                   # a watch, a fallow or unjudged year, or nothing flagged


def assemble(field_id, ring, s2_rows, cell, modis_rows=None, soil=None, today=None, declared_use=None):
    """Pure: fetched inputs -> the FieldAnalysis dict. declared_use: {year: "crop" | "fallow"}, wins over the inferred label."""
    today = today or dt.date.today()
    ha = area_ha(ring)
    rec = veg.records(s2_rows)
    years = range(K.S2_FIRST_YEAR, max((d.year for d in rec["date"]), default=K.S2_FIRST_YEAR) + 1)
    S = {y: veg.build_year(rec, y) for y in years}
    M = {y: veg.metrics(S[y], (declared_use or {}).get(y)) for y in years}
    clim, profile, flags, hot_before = climate.analyse_cell(cell)
    modis = None
    if modis_rows and ha >= K.MODIS_MIN_HA:
        myears, mmed = veg.modis_years(modis_rows, {y: M[y]["eff"] for y in years})
        if mmed is not None:
            modis = {"years": myears, "peakMedian": mmed, "note": MODIS_NOTE}
    mpeak = {m["year"]: m["peak"] for m in modis["years"] if m["peak"] is not None} if modis else {}
    seasons = []
    some = {s["year"]: [c["type"] for c in s["causes"] if not c["robust"]] for s in clim["seasons"]}
    for y in years:
        # a season still running is judged only up to the current ten-day bin
        upto = None if today >= dt.date(y, 10, 1) else max(veg.dekad_of_year(today) - K.D0, 0)
        m = M[y]
        found, ratio = veg.verdicts(S, M, y, upto)
        deficit = next((v["severity"] for v in found if v["type"] == "VEG_DEFICIT"), None)
        f, before = flags.get(y, {}), []
        if deficit in ("warning", "severe"):                       # only then is there a peak to explain
            end = veg.dekad_end(y, m["peak_i"])
            before = [k for k, held in (("water_deficit", "water_deficit" in f and f["water_deficit"] <= end), ("heat", hot_before(y, end))) if held]
        seasons.append({"year": y, "ndvi": _nums(S[y]["ndvi"]), "ndmi": _nums(S[y]["ndmi"]), "obs": [int(n) for n in S[y]["obs"]],
                        "use": m["use"], "declared": m["declared"], "peak": None if m["peak_i"] < 0 else round(m["peak"], 3),
                        "peakDekad": None if m["peak_i"] < 0 else m["peak_i"], "verdicts": found,
                        "explanation": explanation(deficit, ratio, f, before, y in mpeak and mpeak[y] >= K.MODIS_USUAL * modis["peakMedian"], some.get(y, ()))})
    if seasons and not any(M[y]["eff"] == "cropped" for y in years):   # a town, a lake, a forest, grassland: say so once
        seasons[-1]["verdicts"].append(veg.NOTE(*NO_CROP_NOTE))
    b = veg.baseline(S, M)
    judged = [s for s in seasons if M[s["year"]]["eff"] not in ("unknown", "ambiguous")]   # seasons whose land use is known
    bare = [s for s in judged if M[s["year"]]["eff"] == "fallow" or any(v["type"] == "BARE_SOIL" for v in s["verdicts"])]
    return {
        "schema": K.SCHEMA, "id": field_id, "generatedAt": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "field": {"areaHa": round(ha, 1), "centre": [round(sum(x for x, _ in ring) / len(ring), 5), round(sum(y for _, y in ring) / len(ring), 5)]},
        "dekads": veg.DEKADS, "seasons": seasons,
        "baseline": b and {"years": b["years"], "median": _nums(b["med"]), "p25": _nums(b["p25"]), "p75": _nums(b["p75"]), "peakMedian": round(b["peak_med"], 3)},
        "modis": modis, "climate": clim,
        "profile": {"rainMeanMm": profile["rainMeanMm"], "water": profile["water"], "heat": profile["heat"], "frost": profile["frost"],
                    "bare": round(len(bare) / len(judged), 2) if judged else 0.0, "years": profile["years"]},
        "soil": soil,
        # the passes clear over the field, so the map can show the field as the satellite saw it that day
        # offset: the pass stores reflectance + 1000 (baseline 04.00 and later), which the map's greenness tiles must undo
        "scenes": [{"date": r["date"], "item": r["item"], "clear": r["clear"], "offset": bool(r.get("offset"))} for r in s2_rows
                   if r.get("item") and r["clear"] >= K.MIN_CLEAR and r["snow"] < K.MAX_SNOW],
    }


async def analyse(geometry, field_id, include_modis=False, include_soil=False, declared_use=None) -> dict:
    """Fetch everything for one field (Sentinel-2, NASA POWER, optionally MODIS and soil) and analyse it.
    declared_use: {year: "crop" | "fallow"} as stated by the field's owner."""
    ring = canonical_ring(geometry)
    geom = {"type": "Polygon", "coordinates": [[list(p) for p in ring + ring[:1]]]}      # what leaves the server: rounded outline only
    lon, lat = sum(x for x, _ in ring) / len(ring), sum(y for _, y in ring) / len(ring)  # ponytail: vertex mean, not the area centroid; fine for a 50 km weather cell
    async with httpx.AsyncClient(timeout=60, limits=httpx.Limits(max_connections=K.CONCURRENCY + 4), headers={"User-Agent": K.USER_AGENT}) as c:
        s2, cell, modis, soil = await asyncio.gather(
            series.s2_series(c, geom), climate.load_cell(c, lat, lon),
            series.modis_series(c, geom) if include_modis and area_ha(ring) >= K.MODIS_MIN_HA else asyncio.sleep(0),
            soil_at(c, lat, lon) if include_soil else asyncio.sleep(0))
    return assemble(field_id, ring, s2, cell, modis, soil, declared_use=declared_use)

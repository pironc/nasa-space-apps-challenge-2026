"""Self-check of the analysis on synthetic data. No network.  Run from backend/:  uv run python tests/selfcheck.py"""
import datetime as dt
import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app import analyse as A, climate, constants as K, series, vegetation as veg  # noqa: E402

RECT = {"type": "Polygon", "coordinates": [[[62.7296, 53.788], [62.7704, 53.788], [62.7704, 53.812], [62.7296, 53.812], [62.7296, 53.788]]]}


def s2_rows():
    """A synthetic field: normal crops 2018-2021 and 2024, a drought year 2022, a fallow year 2023."""
    rng = np.random.default_rng(0)
    crop = 0.18 + 0.55 * np.exp(-((np.arange(veg.N) - 7.5) / 2.6) ** 2)
    curves = {y: crop for y in (2018, 2019, 2020, 2021, 2024)} | {2022: 0.18 + 0.5 * (crop - 0.18), 2023: np.full(veg.N, 0.17)}
    rows = []
    for y, curve in sorted(curves.items()):
        for k in range(30):
            d = dt.date(y, 5, 1) + dt.timedelta(days=5 * k)
            nd = float(curve[veg.dekad_of_year(d) - K.D0] + rng.normal(0, 0.01))
            rows.append({"date": str(d), "clear": 1.0, "snow": 0.0, "ndvi": nd, "ndmi": nd - 0.45, "nbr2": 0.01 if nd < 0.25 else 0.2})
    leak = next(r for r in rows if r["date"] == "2024-06-30")
    leak["ndvi"] -= 0.4                                                       # a cloud leak in a normal year: must be despiked
    rows.append({"date": "2024-07-02", "clear": 0.7, "snow": 0.0, "ndvi": 0.0, "ndmi": 0.0, "nbr2": 0.0})   # under 75 % clear: rejected
    rows.append({"date": "2024-07-03", "clear": 0.9, "snow": 0.2, "ndvi": 0.0, "ndmi": 0.0, "nbr2": 0.0})   # "snow" in July is cloud: rejected
    rows.append({"date": "2024-07-04", "clear": 0.0, "snow": 0.0, "ndvi": None, "ndmi": None, "nbr2": None})
    return sorted(rows, key=lambda r: r["date"])


def check_series():
    old, new = series.s2_expression("03.00"), series.s2_expression("05.11")
    assert old.count("-2000") == 0 and new.count("-2000") == 3 and series.s2_expression("04.00") == new
    assert new.startswith("where((SCL==4)|(SCL==5),1,0);where(SCL==11,1,0);") and new.count(";") == 4
    assert "(B08-B04)/(B08+B04-2000)" in new and "(B11-B12)/(B11+B12-2000)" in new and "(B08-B11)/(B08+B11)" in old


def check_vegetation():
    rec = veg.records(s2_rows())
    S = {y: veg.build_year(rec, y) for y in range(2018, 2025)}
    M = {y: veg.metrics(S[y]) for y in S}
    kinds = lambda y, **kw: {v["type"]: v["severity"] for v in veg.verdicts(S, M, y, **kw)}
    assert veg.is_annual_cropland(M)
    assert S[2019]["obs"].sum() == 30 and S[2024]["obs"].sum() == 29, S[2024]["obs"]   # 2024: the leak despiked, 3 bad scenes rejected
    assert M[2023]["use"] == "fallow" and M[2019]["use"] == "cropped", M
    assert kinds(2022) == {"VEG_DEFICIT": "severe", "LOW_CANOPY_MOISTURE": "severe"}, kinds(2022)   # drought year
    assert kinds(2023) == {"BARE_SOIL": "info"}, kinds(2023)                 # fallow year: bare-soil note only, never stress
    assert "choice" in veg.verdicts(S, M, 2023)[0]["detail"]
    assert kinds(2024) == {}, veg.verdicts(S, M, 2024)                       # normal year, harvest decline, bad scenes: silent
    assert "VEG_DEFICIT" not in kinds(2022, upto=veg.I(6, 21))               # too early in the season to call a deficit
    assert all("LOW_CANOPY_MOISTURE" not in kinds(y) or "VEG_DEFICIT" in kinds(y) for y in S)
    two = {y: S[y] for y in (2018, 2019, 2022)}                              # too few other cropped years
    assert [v["type"] for v in veg.verdicts(two, {y: M[y] for y in two}, 2022)] == ["NO_BASELINE"]
    empty = veg.build_year(rec, 2030)
    assert veg.metrics(empty)["use"] == "unknown" and [v["type"] for v in veg.verdicts(S | {2030: empty}, M | {2030: veg.metrics(empty)}, 2030)] == ["INSUFFICIENT_DATA"]
    years, med = veg.modis_years(modis_rows())
    use = {y["year"]: y["use"] for y in years}
    assert use[2023] == "fallow" and use[2025] == "unknown" and use[2010] == "unknown" and use[2021] == "cropped" and med == 0.8, (use, med)


def modis_rows():
    rows = []
    for y in range(2000, 2027):
        for md in ("06-10", "06-26", "07-12", "07-28", "08-13"):
            peak = 0.35 if y == 2023 else 0.6 if y == 2021 else 0.8
            rows.append({"date": f"{y}-{md}", "ndvi": peak - 0.1 * (md != "07-12"), "reliability": 3.0 if y == 2010 else 0.0})   # 2010: all cloud
    return rows


def power_cell():
    """Synthetic daily weather 1981-2026: the same mild year every year, except
    2021 (no rain 1 May-15 Jul, +12 C maxima in June and July), 2010 (frost on 25 June), 2024 (wet harvest)."""
    d0, d1 = climate.ORIGIN, dt.date(2026, 11, 10)
    days = [d0 + dt.timedelta(days=i) for i in range((d1 - d0).days + 1)]
    t = np.array([2 + 18 * np.cos(2 * np.pi * (d.timetuple().tm_yday - 200) / 365) for d in days])
    tx, tn = t + 6, t - 6
    p = np.array([2.0 if i % 2 == 0 else 0.0 for i in range(len(days))])
    wet = np.full(len(days), 0.6)
    top = wet.copy()
    for i, d in enumerate(days):
        if d.year == 2021 and dt.date(2021, 5, 1) <= d <= dt.date(2021, 7, 15):
            p[i], wet[i] = 0.0, 0.4
        if d.year == 2021 and d.month in (6, 7):
            tx[i] += 12
        if d in (dt.date(2010, 6, 25), dt.date(2010, 6, 26)):
            tn[i] = -3.0
        if dt.date(2024, 8, 15) <= d <= dt.date(2024, 9, 20):
            p[i], top[i] = 8.0, 0.9
    f = lambda a: [round(float(x), 2) for x in a]
    return {"lat": 54.0, "lon": 62.5, "data": {"T2M": f(t), "T2M_MAX": f(tx), "T2M_MIN": f(tn), "PRECTOTCORR": f(p), "GWETROOT": f(wet), "GWETTOP": f(top)}}


def check_climate():
    assert climate.longest_run([1, 1, 0, 1, 1, 1, 0]) == 3
    assert climate.mann_kendall_p(np.arange(30) * 2.0) < 1e-6 and abs(climate.theil_sen(np.arange(30) * 2.0) - 2.0) < 1e-12
    assert climate.mann_kendall_p([1, 1, 1, 1]) == 1.0
    assert climate.htc_class(0.35) == "very severe drought" and climate.htc_class(0.55) == "severe drought" and climate.htc_class(1.2) == "adequate moisture" and climate.htc_class(2) == "excess moisture"
    assert climate.pct_rank(5, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) == 45.0
    assert climate.cell_of(53.8, 62.75) == ("108_100", 54.0, 62.5)
    c, prof = climate.analyse_cell(power_cell())
    by = {s["year"]: s for s in c["seasons"]}
    causes = lambda y: {k["type"]: k["confidence"] for k in by[y]["causes"]}
    assert c["seasons"][0]["year"] == 1991 and c["seasons"][-1]["year"] == 2026 and prof["years"] == [1981, 2026]
    assert causes(2021) == {"water_deficit": "high", "heat": "high"}, by[2021]
    assert causes(2010) == {"frost": "medium"} and causes(2024) == {"wet_harvest": "medium"} and causes(2015) == {}, (by[2010], by[2024], by[2015])
    assert c["droughtYears"] == [2021]
    assert by[2015]["rainMayAugPct"] in (100, 101) and by[2021]["rainMayAugPct"] < 50 and by[2021]["htc"] < by[2015]["htc"]
    assert by[2021]["hotDays30"] == 61 and by[2015]["hotDays30"] == 0 and by[2021]["tmaxPeakDate"].startswith("2021-07")
    assert by[2021]["longestDrySpell"] >= 76 and by[2015]["longestDrySpell"] == 1
    assert by[2015]["firstAutumnFrost"] and by[2015]["firstAutumnFrost"][5:7] in ("09", "10")
    assert 0 < prof["water"] < 0.05 and prof["heat"] == 0.02 and prof["frost"] == 0.02, prof   # one bad year in 46
    assert "no clear trend" in c["trendNote"]
    assert "risen" in climate.trend_note(list(range(1991, 2027)), [150.0] * 36, [float(i) for i in range(36)])


def check_polygon():
    ring, ha = A.validate(RECT)
    assert 709 < ha < 724, ha                                                # 2.68 km x 2.67 km
    c = RECT["coordinates"][0]
    same = [{"type": "Polygon", "coordinates": [x]} for x in (c[::-1], c[1:-1] + c[:2], [[x + 2e-6, y] for x, y in c])]
    assert all(A.field_hash(A.canonical_ring(g)) == A.field_hash(ring) for g in same) and len(A.field_hash(ring)) == 16
    box = lambda w, n=5: {"type": "Polygon", "coordinates": [[[62, 53], [62 + w, 53], [62 + w, 53 + w], [62, 53 + w], [62, 53]][:n]]}
    bad = [{"type": "Point", "coordinates": [62, 53]}, {"type": "MultiPolygon", "coordinates": [RECT["coordinates"]]},
           {"type": "Polygon", "coordinates": [c, c]},                       # a hole
           box(0.02, 3),                                                     # too few points
           {"type": "Polygon", "coordinates": [[[62 + i * 1e-4, 53 + (i % 2) * 0.01] for i in range(201)]]},   # too many points
           box(0.0005), box(0.2),                                            # 0.2 ha and 30,000 ha
           {"type": "Polygon", "coordinates": [[[62, 95], [62.01, 95], [62.01, 95.01], [62, 95]]]},
           {"type": "Polygon", "coordinates": [[[62, 53], [62.01, 53.01], [62.02, 53.02], [62, 53]]]},          # a line: no area
           {"type": "Polygon", "coordinates": [[["a", 53], [62.01, 53], [62.01, 53.01], [62, 53]]]}, None]
    for g in bad:
        try:
            A.validate(g)
        except ValueError:
            continue
        raise AssertionError(f"accepted {g}")
    A.validate({"type": "Polygon", "coordinates": [[[62, 53], [62.02, 53], [62.02, 53.02], [62, 53]]]})   # a triangle is a field


# The contract (frontend/src/lib/analysis.ts), key by key.
CONTRACT = {
    "FieldAnalysis": ["schema", "id", "generatedAt", "field", "dekads", "seasons", "baseline", "modis", "climate", "profile", "soil"],
    "field": ["areaHa", "centre"],
    "Season": ["year", "ndvi", "ndmi", "obs", "use", "peak", "peakDekad", "verdicts"],
    "Verdict": ["type", "severity", "title", "detail"],
    "Baseline": ["years", "median", "p25", "p75", "peakMedian"],
    "modis": ["years", "peakMedian", "note"],
    "ModisYear": ["year", "peak", "use"],
    "climate": ["cell", "normals", "seasons", "droughtYears", "trendNote"],
    "normals": ["rainMayAug", "rainOctApr", "hotDays30", "htc"],
    "ClimateSeason": ["year", "rainMayAug", "rainMayAugPct", "rainOctApr", "rainOctAprPct", "hotDays30", "htc", "htcClass", "tmaxPeak",
                      "tmaxPeakDate", "longestDrySpell", "firstAutumnFrost", "causes"],
    "Cause": ["type", "confidence", "evidence"],
    "StressProfile": ["rainMeanMm", "water", "heat", "frost", "bare", "years"],
    "soil": ["clayPct", "sandPct", "ph", "source"],
}


def check_contract():
    ts = ROOT.parent / "frontend" / "src" / "lib" / "analysis.ts"
    if ts.exists():                                                          # the list above must not drift from the contract
        text = ts.read_text()
        assert all(f"{k}:" in text for keys in CONTRACT.values() for k in keys)
    soil = {"clayPct": 35.2, "sandPct": 27.1, "ph": 7.0, "source": "canned"}
    a = A.assemble("canned", A.canonical_ring(RECT), s2_rows(), power_cell(), modis_rows(), soil, today=dt.date(2026, 11, 14))
    a = json.loads(json.dumps(a, allow_nan=False))                           # NaN never; what the browser will parse

    def keys(obj, name):
        assert list(obj) == CONTRACT[name], (name, list(obj))
    keys(a, "FieldAnalysis"), keys(a["field"], "field"), keys(a["baseline"], "Baseline"), keys(a["modis"], "modis")
    keys(a["climate"], "climate"), keys(a["climate"]["normals"], "normals"), keys(a["profile"], "StressProfile"), keys(a["soil"], "soil")
    assert a["schema"] == 1 and len(a["dekads"]) == 15 and a["dekads"][0] == "1 May" and a["dekads"][-1] == "21 Sep"
    assert [s["year"] for s in a["seasons"]] == list(range(2018, 2025)) and list(a["climate"]["cell"]) == ["lat", "lon"]
    for s in a["seasons"]:
        keys(s, "Season")
        assert len(s["ndvi"]) == len(s["ndmi"]) == len(s["obs"]) == 15 and s["use"] in ("cropped", "fallow", "ambiguous", "early_green", "unknown")
        for v in s["verdicts"]:
            keys(v, "Verdict")
            assert v["type"] in ("VEG_DEFICIT", "LOW_CANOPY_MOISTURE", "BARE_SOIL", "INSUFFICIENT_DATA", "NO_BASELINE") and v["severity"] in ("info", "watch", "warning", "severe")
            assert v["title"] and v["detail"].endswith(".") and "nan" not in v["detail"]
    for m in a["modis"]["years"]:
        keys(m, "ModisYear")
    for s in a["climate"]["seasons"]:
        keys(s, "ClimateSeason")
        assert all(s[k] is not None for k in s if k != "firstAutumnFrost")
        for c in s["causes"]:
            keys(c, "Cause")
            assert c["type"] in ("water_deficit", "heat", "frost", "wet_harvest") and c["confidence"] in ("low", "medium", "high") and c["evidence"]
    assert all(len(a["baseline"][k]) == 15 for k in ("median", "p25", "p75")) and a["baseline"]["years"] == [2018, 2019, 2020, 2021, 2024]
    assert a["profile"]["bare"] == round(1 / 7, 2) and a["field"]["centre"] == [62.75, 53.8]
    small = A.assemble("small", A.canonical_ring({"type": "Polygon", "coordinates": [[[62, 53], [62.005, 53], [62.005, 53.005], [62, 53.005], [62, 53]]]}),
                       [], power_cell(), modis_rows())                       # 19 ha, no scenes at all: still a valid answer
    assert small["modis"] is None and small["baseline"] is None and small["soil"] is None and small["seasons"][0]["verdicts"][0]["type"] == "INSUFFICIENT_DATA"
    json.dumps(small, allow_nan=False)


def check_api():
    """The endpoint's own branches, in process: cache hit, 429 past two builds, 502 when upstream is down, 422."""
    import asyncio
    import tempfile

    import httpx

    from app import main

    async def slow(geometry, fid):
        await asyncio.sleep(0.2)
        return {"schema": K.SCHEMA, "id": fid}

    async def down(geometry, fid):
        raise series.UpstreamError("the satellite service is down")

    box = lambda i: {"geometry": {"type": "Polygon", "coordinates": [[[62 + i, 53], [62.02 + i, 53], [62.02 + i, 53.02], [62 + i, 53.02], [62 + i, 53]]]}}

    async def run():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app), base_url="http://test") as c:
            assert (await c.get("/api/health")).json() == {"ok": True}
            main.analyse = slow
            rs = await asyncio.gather(*(c.post("/api/analyse", json=box(i)) for i in range(3)))
            assert sorted(r.status_code for r in rs) == [200, 200, 429], [r.status_code for r in rs]
            built = next(i for i, r in enumerate(rs) if r.status_code == 200)
            assert len(list((K.DATA_DIR / "fields").glob("*.json"))) == 2 and not list((K.DATA_DIR / "fields").glob("*.tmp"))
            main.analyse = down
            r = await c.post("/api/analyse", json=box(built))                 # served from the cache: no build, no upstream
            assert r.status_code == 200 and r.json() == rs[built].json() and len(r.json()["id"]) == 16
            r = await c.post("/api/analyse", json=box(7))
            assert r.status_code == 502 and "down" in r.json()["detail"] and main._building == 0
            assert (await c.post("/api/analyse", json={"geometry": {"type": "Point", "coordinates": [62, 53]}})).status_code == 422

    with tempfile.TemporaryDirectory() as tmp:
        K.DATA_DIR = Path(tmp)
        asyncio.run(run())


if __name__ == "__main__":
    for check in (check_series, check_vegetation, check_climate, check_polygon, check_contract, check_api):
        check()
        print(check.__name__, "ok")

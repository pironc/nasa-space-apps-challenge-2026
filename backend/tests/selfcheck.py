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
    """A synthetic field: normal crops 2018-2021 and 2024, a dry year 2022 (a canopy two thirds as high), a tilled fallow 2023,
    a half-height canopy in 2025 (failed crop or weedy fallow: ambiguous), another crop in 2026 (lower, longer canopy)."""
    rng = np.random.default_rng(0)
    bell = lambda width: np.exp(-((np.arange(veg.N) - 7.5) / width) ** 2)
    crop = 0.18 + 0.55 * bell(2.6)
    curves = {y: crop for y in (2018, 2019, 2020, 2021, 2024)} | {2022: 0.18 + 0.374 * bell(3.2), 2023: np.full(veg.N, 0.17),
                                                                  2025: 0.18 + 0.5 * (crop - 0.18), 2026: 0.18 + 0.44 * bell(4.5)}
    rows = []
    for y, curve in sorted(curves.items()):
        for k in range(30):
            d = dt.date(y, 5, 1) + dt.timedelta(days=5 * k)
            nd = float(curve[veg.dekad_of_year(d) - K.D0] + rng.normal(0, 0.01))
            rows.append({"date": str(d), "clear": 1.0, "snow": 0.0, "ndvi": nd, "ndmi": 1.5 * nd - 0.8, "nbr2": 0.01 if nd < 0.25 else 0.2})
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
    assert new.count(",-9)") == 3                                             # masked pixels fall outside the histogram range
    # field medians come from the endpoint histogram
    q = series.hist_quantiles([0, 10, 10, 0], [0, 1, 2, 3, 4], [0.1, 0.5, 0.9])
    assert [round(x, 6) for x in q] == [1.2, 2.0, 2.8] and series.hist_quantiles([0, 0], [0, 1, 2], [0.5]) == [None], q
    px = np.random.default_rng(1).normal(0.6, 0.1, 5000)                      # a field's clear pixels, plus masked ones at -9
    counts, edges = np.histogram(np.concatenate([px, np.full(3000, K.MASK_FILL)]), bins=K.HIST_BINS, range=(-1, 1))
    assert abs(series.hist_quantiles(counts.tolist(), edges.tolist(), [0.5])[0] - np.median(px)) < 0.0025


def check_vegetation():
    rec = veg.records(s2_rows())
    S = {y: veg.build_year(rec, y) for y in range(2018, 2027)}

    def run(year, declared={}, patch=None, **kw):
        """-> ({verdict type: severity}, peak ratio, verdicts) for one season, optionally with its dekad series patched."""
        s = S | {year: {k: v.copy() for k, v in S[year].items()}}
        (patch or (lambda x: None))(s[year])
        M = {y: veg.metrics(s[y], declared.get(y)) for y in s}
        out, ratio = veg.verdicts(s, M, year, **kw)
        return {v["type"]: v["severity"] for v in out}, ratio, out

    M = {y: veg.metrics(S[y]) for y in S}
    assert S[2019]["obs"].sum() == 30 and S[2024]["obs"].sum() == 29, S[2024]["obs"]   # 2024: the leak despiked, 3 bad scenes rejected
    assert [M[y]["use"] for y in (2019, 2022, 2023, 2025, 2026)] == ["cropped", "cropped", "fallow", "ambiguous", "cropped"], M
    assert M[2019]["peak_i"] in (7, 8) and abs(M[2019]["peak"] - 0.71) < 0.02
    assert veg.baseline(S, M)["years"] == [2018, 2019, 2020, 2021, 2022, 2024, 2026]   # cropped seasons only
    # windowed deficit: level from the peak ratio, only with a low season total; NDMI is one line of the detail
    kinds, ratio, out = run(2022)
    assert kinds == {"VEG_DEFICIT": "warning"} and 0.65 < ratio <= 0.80, out
    assert "compared with 6 other cropped seasons since 2018" in out[0]["detail"] and out[0]["detail"].endswith("(NDMI) was also low at peak.")
    assert "(highest ten-day median between 1 June and 20 August)" in out[0]["detail"] and out[0]["title"] == "Peak greenness well below this field's normal"
    assert veg.DEFICIT_TITLE["watch"] == "Peak greenness below this field's normal"   # a watch is never worded "well below" or "a little below"
    assert "VEG_DEFICIT" not in run(2022, upto=veg.I(6, 21))[0]               # too early in the season to call a deficit
    kinds, ratio, out = run(2026)                                             # a changed crop: lower peak, normal season total
    assert kinds == {"NOTE": "info"} and ratio <= 0.90 and "crop or sowing date probably differs" in out[0]["detail"], out
    assert run(2024)[0] == {} and run(2024)[1] > 0.9                          # normal year, harvest decline, bad scenes: silent

    def late(s):
        s["ndvi"][veg.I(8, 21):] = 0.8
    assert "after 20 August" in run(2019, patch=late)[2][0]["detail"] and run(2019, patch=late)[0] == {"NOTE": "info"}   # regrowth is not the peak
    assert M[2019]["peak"] == veg.metrics(run(2019, patch=late) and S[2019])["peak"] < 0.75

    def clouded(s):
        s["obs"][veg.MID] = 0                                                 # values only interpolated across the peak
    kinds, ratio, out = run(2022, patch=clouded)
    assert kinds == {"NOTE": "info"} and ratio is None and "Peak not observed (cloud): no judgement this season." in out[0]["detail"], out
    assert run(2022, {2022: "crop"}, patch=clouded)[0] == {"NOTE": "info"}    # the guard holds whatever the declared use

    # bare soil: crop years only inside 21 June to 10 August and only when tilled; fallow years as information
    def stubble(s):
        s["ndvi"][veg.I(8, 11):], s["nbr2"][veg.I(8, 11):] = 0.18, 0.01       # senesced and bare from 11 August

    def bare(nbr2):
        def f(s):
            s["ndvi"][veg.I(6, 21):veg.I(7, 21)], s["nbr2"][veg.I(6, 21):veg.I(7, 21)] = 0.18, nbr2
        return f
    assert "BARE_SOIL" not in run(2019, patch=stubble)[0]
    crop = {2019: "crop"}                                                     # undeclared, this patched year reads as ambiguous: a prompt only
    assert run(2019, crop, patch=bare(0.01))[0].get("BARE_SOIL") == "warning" and run(2019, crop, patch=bare(0.01))[2][0]["title"] == "Bare soil in mid-season"
    assert "BARE_SOIL" not in run(2019, crop, patch=bare(0.10))[0]            # residue cover, not tilled soil
    assert run(2019, patch=bare(0.01))[0] == {"LAND_USE_UNCLEAR": "info"}
    kinds, ratio, out = run(2023)
    assert kinds == {"BARE_SOIL": "info"} and ratio is None and "choice" in out[0]["detail"], out   # fallow: never stress
    assert not any("May" in v["detail"] or "September" in v["detail"] for y in S for v in run(y)[2])   # no May to September counts

    # an ambiguous year: one prompt, no severity, no bare soil, not in the baseline
    kinds, ratio, out = run(2025)
    assert kinds == {"LAND_USE_UNCLEAR": "info"} and ratio is None, out
    assert out[0]["detail"].startswith("Low green cover in 2025 (peak 6") and out[0]["detail"].endswith("Was this a crop that failed, or a fallow year? Answer below to complete the analysis.")
    # the declared land use wins over the label
    assert run(2025, {2025: "crop"})[0] == {"VEG_DEFICIT": "severe"} and "declared" in run(2025, {2025: "crop"})[2][0]["detail"]
    assert run(2025, {2025: "fallow"})[0] == {} and run(2022, {2022: "fallow"})[0] == {}
    assert "compared with 5 other cropped seasons" in run(2022, {2019: "fallow"})[2][0]["detail"]   # a declared fallow leaves the baseline
    assert veg.metrics(S[2025], "crop")["use"] == "ambiguous" and veg.metrics(S[2025], "crop")["eff"] == "cropped"

    two = {y: S[y] for y in (2018, 2019, 2022)}                              # too few other cropped years
    assert [v["type"] for v in veg.verdicts(two, {y: M[y] for y in two}, 2022)[0]] == ["NO_BASELINE"]
    empty = veg.build_year(rec, 2030)
    (v,) = veg.verdicts(S | {2030: empty}, M | {2030: veg.metrics(empty)}, 2030)[0]
    assert veg.metrics(empty)["use"] == "unknown" and v["type"] == "INSUFFICIENT_DATA" and "clear view of soil or vegetation (cloud, snow and water do not count)" in v["detail"]
    assert str(veg.dekad_end(2021, 0)) == "2021-05-10" and str(veg.dekad_end(2021, 8)) == "2021-07-31" and str(veg.dekad_end(2021, 14)) == "2021-09-30"
    # MODIS: from 2018 the label comes from Sentinel-2 or the declaration, before 2018 only an obviously bare summer is set apart
    years, med = veg.modis_years(modis_rows(), {y: M[y]["eff"] for y in M})
    use = {y["year"]: y["use"] for y in years}
    assert use[2023] == "fallow" and use[2021] == "cropped" and use[2005] == "fallow" and use[2006] == "cropped", use
    assert use[2025] == use[2010] == "unknown" and med == 0.8, (use, med)    # 2025: source gap; 2010: all cloud


def modis_rows():
    rows = []
    for y in range(2000, 2027):
        for md in ("06-10", "06-26", "07-12", "07-28", "08-13"):
            peak = 0.35 if y == 2005 else 0.6 if y in (2021, 2023) else 0.8   # 2005: a bare summer; 2023: fallow by Sentinel-2 only
            rows.append({"date": f"{y}-{md}", "ndvi": peak - 0.1 * (md != "07-12"), "reliability": 3.0 if y == 2010 else 0.0})   # 2010: all cloud
    return rows


def power_cell():
    """Synthetic daily weather 1981-2026: the same mild year every year (rain varies a little from year to year), except
    2022 (no rain 1 May-15 Jul, +12 C maxima in June and July), 2019 (the same heat, normal rain), 2005 (no rain 10 Jul-25 Aug:
    a dry spell only a late-sown crop meets), 2010 (frost on 14 July), 2012 (frost on 30 June: at a sensitive stage only if sown early), 2024 (wet harvest)."""
    d0, d1 = climate.ORIGIN, dt.date(2026, 11, 10)
    days = [d0 + dt.timedelta(days=i) for i in range((d1 - d0).days + 1)]
    t = np.array([2 + 18 * np.cos(2 * np.pi * (d.timetuple().tm_yday - 200) / 365) for d in days])
    tx, tn = t + 6, t - 6
    p = np.array([(2.0 if i % 2 == 0 else 0.0) * (1 + 0.02 * (d.year * 7 % 11 - 5)) for i, d in enumerate(days)])
    wet = np.full(len(days), 0.6)
    top = wet.copy()
    for i, d in enumerate(days):
        if dt.date(2022, 5, 1) <= d <= dt.date(2022, 7, 15) or dt.date(2005, 7, 10) <= d <= dt.date(2005, 8, 25):
            p[i], wet[i] = 0.0, 0.4
        if d.year in (2019, 2022) and d.month in (6, 7):
            tx[i] += 12
        if d in (dt.date(2010, 7, 14), dt.date(2010, 7, 15), dt.date(2012, 6, 30)):
            tn[i] = -3.0
        if dt.date(2024, 8, 15) <= d <= dt.date(2024, 9, 20):
            p[i], top[i] = 8.0, 0.9
    f = lambda a: [round(float(x), 2) for x in a]
    return {"lat": 54.0, "lon": 62.5, "data": {"T2M": f(t), "T2M_MAX": f(tx), "T2M_MIN": f(tn), "PRECTOTCORR": f(p), "GWETROOT": f(wet), "GWETTOP": f(top)}}


def check_climate():
    assert climate.longest_run([1, 1, 0, 1, 1, 1, 0]) == 3
    assert climate.mann_kendall_p(np.arange(30) * 2.0) < 1e-6 and abs(climate.theil_sen(np.arange(30) * 2.0) - 2.0) < 1e-12
    assert climate.mann_kendall_p([1, 1, 1, 1]) == 1.0
    assert [climate.htc_class(h) for h in (0.35, 0.55, 0.7, 0.9, 1.2, 2)] == ["very dry", "dry", "moderately dry", "slightly dry", "adequate", "wet"]
    assert climate.pct_rank(5, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) == 45.0
    assert climate.cell_of(53.8, 62.75) == ("108_100", 54.0, 62.5)
    c, prof, flags, hot_before = climate.analyse_cell(power_cell())
    by = {s["year"]: s for s in c["seasons"]}
    causes = lambda y: {k["type"]: k["robust"] for k in by[y]["causes"]}
    assert c["seasons"][0]["year"] == 1991 and c["seasons"][-1]["year"] == 2026 and prof["years"] == [1981, 2026]
    # robust = flagged for sowing on 10, 20 and 30 May
    assert causes(2022) == {"water_deficit": True, "heat": True}, by[2022]
    assert "0 mm of rain, 0% of the 1991 to 2020 mean" in by[2022]["causes"][0]["evidence"][0] and "rank 1 of 36" in by[2022]["causes"][1]["evidence"][0]
    assert causes(2019) == {"heat": True} and causes(2010) == {"frost": True} and causes(2024) == {"wet_harvest": True} and causes(2015) == {}, (by[2019], by[2010], by[2024], by[2015])
    assert causes(2005) == {"water_deficit": False} and causes(2012) == {"frost": False}, (by[2005], by[2012])   # flagged for some sowing dates only
    for y in (2005, 2012):
        (line,) = by[y]["causes"][0]["evidence"]
        assert line.startswith("If sown on 10 May: ") and "30 May" in line and line.endswith("depends on the sowing date."), line
    assert "% of the usual rain" in by[2005]["causes"][0]["evidence"][0] and "°C" in by[2012]["causes"][0]["evidence"][0]
    # only robust dry or hot flags carry a date; here they were reached well before a July peak
    assert set(flags[2022]) == {"water_deficit", "heat"} and flags[2019].keys() == {"heat"} and flags[2005] == flags[2010] == {}
    assert flags[2022]["water_deficit"] == dt.date(2022, 7, 8) and flags[2022]["heat"] == dt.date(2022, 6, 1), flags[2022]
    # HTC: rank among the listed seasons, drought only by the cell's own 1991-2020 percentiles
    assert by[2022]["htcRank"] == 1 and by[2022]["htcRankOf"] == 36 and by[2022]["drought"] == "severe" and by[2005]["drought"] != "none"
    assert by[2005]["htcRank"] == 2 and by[2015]["htcRank"] > 2 and all(1 <= s["htcRank"] <= 36 for s in c["seasons"])   # equal seasons share a rank
    assert c["droughtYears"] == [s["year"] for s in c["seasons"] if s["drought"] != "none"] and 2022 in c["droughtYears"] and 5 <= len(c["droughtYears"]) <= 9, c["droughtYears"]
    assert by[2015]["drought"] == "none" and 95 <= by[2015]["rainMayAugPct"] <= 105 and by[2022]["rainMayAugPct"] < 50 and by[2022]["htc"] < by[2015]["htc"]
    assert by[2022]["hotDays30"] == 61 and by[2015]["hotDays30"] == 0 and by[2022]["tmaxPeakDate"].startswith("2022-07")
    assert by[2022]["longestDrySpell"] >= 76 and by[2015]["longestDrySpell"] == 1
    assert by[2015]["firstAutumnFrost"] and by[2015]["firstAutumnFrost"][5:7] in ("09", "10")
    assert 0 < prof["water"] < 0.1 and prof["heat"] == 0.04 and prof["frost"] == 0.04, prof   # two hot and two frost years in 46
    assert c["trendNote"] == ("NASA POWER shows no clear trend in May to August rain or in the number of days at 30 °C or more for this grid cell (1991 to 2026). "
                              "Mean temperature was not tested. We make no trend claim.")
    note = climate.trend_note(list(range(1991, 2027)), [150.0] * 36, [float(i) for i in range(36)])
    assert "risen by about 10 days per decade" in note and "not proof" in note and "Mean temperature was not tested." in note, note
    # modelled root-zone wetness: one more evidence line on a water cause, only when May and June were in the driest fifth
    assert by[2022]["causes"][0]["evidence"][-1] == climate.ROOT_DRY and climate.ROOT_DRY not in json.dumps([by[2005], by[2019], by[2015]])
    # hot before the peak, like for like: hot days from sowing to a date against the same dates of other years
    assert hot_before(2022, dt.date(2022, 7, 20)) and hot_before(2019, dt.date(2019, 7, 20)) and not hot_before(2015, dt.date(2015, 7, 20))
    assert not hot_before(2022, dt.date(2022, 5, 31)) and not hot_before(2030, dt.date(2030, 7, 20))   # heat after the date, a year not served
    late = power_cell()                                                      # every year 15 hot days from 25 July; 2021 also 1 to 10 July
    for i in range(len(late["data"]["T2M_MAX"])):
        d = climate.ORIGIN + dt.timedelta(days=i)
        if dt.date(d.year, 7, 25) <= d <= dt.date(d.year, 8, 8) or dt.date(2021, 7, 1) <= d <= dt.date(2021, 7, 10):
            late["data"]["T2M_MAX"][i] = 38.0
    _, _, flags, hot_before = climate.analyse_cell(late)
    assert flags[2021]["heat"] > dt.date(2021, 7, 20)                        # the full-season count is reached after a 20 July peak ...
    assert hot_before(2021, dt.date(2021, 7, 20)) and not hot_before(2020, dt.date(2020, 7, 20))   # ... yet it was unusually hot before it
    # a cell where it never rains: no division by zero, no NaN in any number or text
    dry = power_cell()
    dry["data"]["PRECTOTCORR"] = [0.0] * len(dry["data"]["PRECTOTCORR"])
    c, prof, _, _ = climate.analyse_cell(dry)
    assert "nan" not in json.dumps(c, allow_nan=False).lower() and prof["water"] == 1.0 and {s["rainMayAugPct"] for s in c["seasons"]} == {100}


def check_explanation():
    """The three fixed sentences that join the field's greenness and the regional weather."""
    dry, hot, both = ["water_deficit"], ["heat"], ["heat", "water_deficit"]
    E = A.explanation
    a = E("warning", 0.72, dry, dry)
    assert a.startswith("Regional weather was unusually dry before this crop's peak (NASA POWER, about 50 km grid). That is consistent with the low greenness")
    assert a.endswith("The grid cannot show whether this field received the same weather.")
    b = E("severe", 0.6, both, both)
    assert "unusually dry and hot before" in b and b.endswith("Dry and hot conditions came together; the data cannot say which did more harm.")
    assert "unusually hot before" in E("severe", 0.6, [], hot) and "dry" not in E("severe", 0.6, dry, hot)   # hot before the peak without a season flag
    modis = "The NASA MODIS record at 250 m does not show this year as unusual; the two disagree, which is {} reason for a field visit."
    assert E("warning", 0.72, dry, dry, True) == a + " " + modis.format("a")
    c = E("warning", 0.72, [], [])                                           # nothing flagged at all
    assert c.startswith("No unusually dry or hot spell was flagged in the regional weather record before this crop's peak. Causes this app cannot see include a local shortfall of rain,")
    assert c.endswith("or a different crop from earlier years; this needs a field visit.") and "does not explain" not in c
    assert E("warning", 0.72, [], [], True) == c + " " + modis.format("another")
    # flagged only after the peak, or for some sowing dates only: not an explanation, but said, so the sentence does not deny the numbers beside it
    after = c.replace("peak. ", "peak. Dry and hot weather was flagged this season, but only by a date after this peak, so it remains a possible reason. ")
    assert E("warning", 0.72, both, []) == after != c
    s = E("warning", 0.72, [], [], some=["frost", "water_deficit"])
    assert s == c.replace("peak. ", "peak. Dry weather was unusual for some of the sowing dates tested only, so it remains a possible reason. ")
    assert E("warning", 0.72, [], [], some=["frost"]) == c and E("warning", 0.72, dry, dry, some=["heat"]) == a
    assert E(None, 1.02, dry, []) == "Regional weather was unusually dry this season, but this field's greenness stayed within its usual range."
    assert "unusually dry and hot this season" in E(None, 0.95, both, []) and "MODIS" not in E(None, 0.95, both, [], True)
    assert E("watch", 0.85, dry, dry, True) is None and E("watch", 0.85, [], []) is None       # never for a watch
    assert E(None, None, dry, []) is None and E(None, 1.0, [], []) is None and E(None, 0.88, dry, []) is None


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
    def refused(g):
        try:
            A.validate(g)
        except ValueError as e:
            return str(e)
        raise AssertionError(f"accepted {g}")
    for g in bad:
        refused(g)
    at = lambda x, y, w=0.02, h=0.02: {"type": "Polygon", "coordinates": [[[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]]]}
    for g in (at(10, 23), at(60, -75), at(-140, 30), at(45.99, 48), at(87.99, 48), at(62, 39.99), at(62, 55.99)):   # Sahara, Antarctica, ocean, the box edges
        assert refused(g) == "Field Shift only covers Kazakhstan. Draw the field inside Kazakhstan.", g
    A.validate(at(46, 40)), A.validate(at(87.98, 55.98))
    for g in (at(50, 45, 35, 0.00002), at(62, 53, 0.51, 0.0005), at(62, 53, 0.0005, 0.31)):                    # long thin strips of a few hectares
        assert refused(g) == "The outline spans more than about 30 km. Outline a single field.", g
    A.validate(at(62, 53, 0.105, 0.063))                                     # 4,900 ha in one block is still a field
    bowtie = lambda pts: {"type": "Polygon", "coordinates": [pts]}
    for pts in ([[62.70, 53.77], [62.72, 53.78], [62.72, 53.77], [62.70, 53.79]], [[62.70, 53.77], [62.72, 53.78], [62.72, 53.77], [62.70, 53.78]]):
        assert refused(bowtie(pts)) == "The outline crosses itself.", pts   # lobes of unequal and of equal size
    A.validate(bowtie([[62.70, 53.77], [62.72, 53.77], [62.71, 53.78], [62.72, 53.79], [62.70, 53.79], [62.71, 53.78]]))   # touching at one point is not crossing
    assert "longitude, latitude" in refused(bowtie([[10 ** 400, 53], [62.01, 53], [62.01, 53.01], [62, 53]]))   # an integer too large for a float
    for f in json.loads((ROOT / "presets.geojson").read_text())["features"]:  # the demo outlines pass every rule above
        A.validate(f["geometry"])
    A.validate({"type": "Polygon", "coordinates": [[[62, 53], [62.02, 53], [62.02, 53.02], [62, 53]]]})   # a triangle is a field


# The contract (frontend/src/lib/analysis.ts), key by key.
CONTRACT = {
    "FieldAnalysis": ["schema", "id", "generatedAt", "field", "dekads", "seasons", "baseline", "modis", "climate", "profile", "soil", "scenes"],
    "field": ["areaHa", "centre"],
    "Season": ["year", "ndvi", "ndmi", "obs", "use", "declared", "peak", "peakDekad", "verdicts", "explanation"],
    "Verdict": ["type", "severity", "title", "detail"],
    "Baseline": ["years", "median", "p25", "p75", "peakMedian"],
    "modis": ["years", "peakMedian", "note"],
    "ModisYear": ["year", "peak", "use"],
    "climate": ["cell", "normals", "seasons", "droughtYears", "trendNote"],
    "normals": ["rainMayAug", "rainOctApr", "hotDays30", "htc"],
    "ClimateSeason": ["year", "rainMayAug", "rainMayAugPct", "rainOctApr", "rainOctAprPct", "hotDays30", "htc", "htcClass", "htcRank", "htcRankOf",
                      "drought", "tmaxPeak", "tmaxPeakDate", "longestDrySpell", "firstAutumnFrost", "causes"],
    "Cause": ["type", "robust", "evidence"],
    "StressProfile": ["rainMeanMm", "water", "heat", "frost", "bare", "years"],
    "soil": ["clayPct", "sandPct", "ph", "source"],
    "Preset": ["id", "name", "region", "note", "rotation", "areaHa", "geometry", "demoYears", "declaredUse"],
}
VERDICTS = ("VEG_DEFICIT", "BARE_SOIL", "LAND_USE_UNCLEAR", "NOTE", "INSUFFICIENT_DATA", "NO_BASELINE")
NEVER = ("caused", "management problem", "monoculture", "you should", "recommended", "profit", "income", "alert", "nan")   # words no result may carry


def check_shape(a):
    """One FieldAnalysis, as the browser will parse it, against the contract."""
    def keys(obj, name):
        assert list(obj) == CONTRACT[name], (name, list(obj))
    keys(a, "FieldAnalysis"), keys(a["field"], "field"), keys(a["climate"], "climate"), keys(a["climate"]["normals"], "normals"), keys(a["profile"], "StressProfile")
    for name in ("baseline", "modis", "soil"):
        a[name] is None or keys(a[name], "Baseline" if name == "baseline" else name)
    assert a["schema"] == 1 and len(a["dekads"]) == 15 and a["dekads"][0] == "1 May" and a["dekads"][-1] == "21 Sep" and list(a["climate"]["cell"]) == ["lat", "lon"]
    for s in a["seasons"]:
        keys(s, "Season")
        assert len(s["ndvi"]) == len(s["ndmi"]) == len(s["obs"]) == 15 and s["use"] in ("cropped", "fallow", "ambiguous", "early_green", "unknown")
        assert s["declared"] in ("crop", "fallow", None) and (s["explanation"] is None or s["explanation"].endswith("."))
        assert s["peakDekad"] is None or (veg.PEAK.start <= s["peakDekad"] < veg.PEAK.stop and s["peak"] == max(x for x in s["ndvi"][veg.PEAK] if x is not None))
        for v in s["verdicts"]:
            keys(v, "Verdict")
            assert v["type"] in VERDICTS and v["severity"] in ("info", "watch", "warning", "severe") and v["title"] and v["detail"].endswith(".")
            assert v["severity"] == "info" or v["type"] in ("VEG_DEFICIT", "BARE_SOIL")
    for m in (a["modis"] or {"years": []})["years"]:
        keys(m, "ModisYear")
        assert m["use"] in ("cropped", "fallow", "unknown") and (m["peak"] is not None or m["use"] == "unknown")
    for s in a["climate"]["seasons"]:
        keys(s, "ClimateSeason")
        assert all(s[k] is not None for k in s if k != "firstAutumnFrost") and s["drought"] in ("none", "drought", "severe") and 1 <= s["htcRank"] <= s["htcRankOf"]
        for c in s["causes"]:
            keys(c, "Cause")
            assert c["type"] in ("water_deficit", "heat", "frost", "wet_harvest") and isinstance(c["robust"], bool) and c["evidence"]
            assert c["robust"] or c["evidence"][-1].endswith("depends on the sowing date.")
    assert a["climate"]["droughtYears"] == [s["year"] for s in a["climate"]["seasons"] if s["drought"] != "none"]
    text = json.dumps(a, ensure_ascii=False).lower()
    assert not [w for w in NEVER if w in text], [w for w in NEVER if w in text]


def check_contract():
    ts = ROOT.parent / "frontend" / "src" / "lib" / "analysis.ts"
    if ts.exists():                                                          # the list above must not drift from the contract
        text = ts.read_text()
        assert all(f"{k}:" in text for keys in CONTRACT.values() for k in keys)
        assert all(f'"{v}"' in text for v in VERDICTS) and "LOW_CANOPY_MOISTURE" not in text and "confidence" not in text
    soil = {"clayPct": 35.2, "sandPct": 27.1, "ph": 7.0, "source": "canned"}
    a = A.assemble("canned", A.canonical_ring(RECT), s2_rows(), power_cell(), modis_rows(), soil, today=dt.date(2026, 11, 14))
    a = json.loads(json.dumps(a, allow_nan=False))                           # NaN never; what the browser will parse
    check_shape(a)
    by = {s["year"]: s for s in a["seasons"]}
    assert list(by) == list(range(2018, 2027)) and all(len(a["baseline"][k]) == 15 for k in ("median", "p25", "p75"))
    assert a["baseline"]["years"] == [2018, 2019, 2020, 2021, 2022, 2024, 2026] and a["field"]["centre"] == [62.75, 53.8]
    assert a["profile"]["bare"] == round(1 / 8, 2)                           # 2023 of the 8 seasons whose land use is known
    assert by[2022]["explanation"].startswith("Regional weather was unusually dry and hot before this crop's peak")   # deficit, dry and hot before the peak
    assert by[2022]["explanation"].endswith("the two disagree, which is a reason for a field visit.")                 # MODIS 2022 sits at its median
    assert not any(v["title"] == A.NO_CROP_NOTE[0] for s in a["seasons"] for v in s["verdicts"])
    assert by[2019]["explanation"].startswith("Regional weather was unusually hot this season, but")                  # hot season, normal field
    assert [by[y]["explanation"] for y in (2018, 2023, 2025, 2026)] == [None] * 4 and all(s["declared"] is None for s in a["seasons"])
    assert {m["year"]: m["use"] for m in a["modis"]["years"]}[2025] == "unknown" and "before 2018 is not known" in a["modis"]["note"] and "2025 is excluded" in a["modis"]["note"]
    assert "only with MODIS" in a["modis"]["note"] and f"{K.MODIS_BARE_PEAK:.2f}" in a["modis"]["note"]
    # a declared land use wins: 2025 becomes a judged crop year, 2019 leaves the baseline
    d = A.assemble("canned", A.canonical_ring(RECT), s2_rows(), power_cell(), modis_rows(), soil, today=dt.date(2026, 11, 14), declared_use={2025: "crop", 2019: "fallow"})
    d = json.loads(json.dumps(d, allow_nan=False))
    check_shape(d)
    dy = {s["year"]: s for s in d["seasons"]}
    assert dy[2025]["declared"] == "crop" and dy[2025]["use"] == "ambiguous" and [v["type"] for v in dy[2025]["verdicts"]] == ["VEG_DEFICIT"]
    assert dy[2025]["explanation"].startswith("No unusually dry or hot spell was flagged") and dy[2025]["explanation"].endswith("this needs a field visit.")   # no MODIS in 2025
    assert dy[2019]["declared"] == "fallow" and dy[2019]["use"] == "cropped" and dy[2019]["verdicts"] == [] and dy[2019]["explanation"] is None
    assert d["baseline"]["years"] == [2018, 2020, 2021, 2022, 2024, 2025, 2026] and {m["year"]: m["use"] for m in d["modis"]["years"]}[2019] == "fallow"
    small = A.assemble("small", A.canonical_ring({"type": "Polygon", "coordinates": [[[62, 53], [62.005, 53], [62.005, 53.005], [62, 53.005], [62, 53]]]}),
                       [], power_cell(), modis_rows())                       # 19 ha, no scenes at all: still a valid answer
    assert small["modis"] is None and small["baseline"] is None and small["soil"] is None and small["seasons"][0]["verdicts"][0]["type"] == "INSUFFICIENT_DATA"
    assert small["seasons"][-1]["verdicts"][-1] == veg.NOTE("No cropped season found", "No season since 2018 looks like an annual crop on this outline. Check that it follows a field.")
    check_shape(json.loads(json.dumps(small, allow_nan=False)))
    mid = A.assemble("mid", A.canonical_ring({"type": "Polygon", "coordinates": [[[62, 53], [62.016, 53], [62.016, 53.01], [62, 53.01], [62, 53]]]}),
                     s2_rows(), power_cell(), modis_rows())                  # about 120 ha: under the 150 ha MODIS needs
    assert 100 < mid["field"]["areaHa"] < K.MODIS_MIN_HA and mid["modis"] is None and "MODIS" not in mid["seasons"][4]["explanation"]
    # the built presets, when present: the index and every file follow the contract
    presets = ROOT.parent / "frontend" / "public" / "presets"
    if (presets / "index.json").exists():
        for pr in json.loads((presets / "index.json").read_text()):
            assert list(pr) == CONTRACT["Preset"] and pr["rotation"] in ("wwww", "fwwb") and len(pr["demoYears"]) == 2, pr["id"]
            assert all(k.isdigit() and v in ("crop", "fallow") for k, v in pr["declaredUse"].items())
            assert "no farmer was consulted" in pr["note"] and "declared" not in pr["note"]   # the demo's land use is the team's assumption, and says so
            f = json.loads((presets / f"{pr['id']}.json").read_text())
            check_shape(f)
            assert f["id"] == pr["id"] and {str(s["year"]): s["declared"] for s in f["seasons"] if s["declared"]} == pr["declaredUse"]


def check_api():
    """The endpoint's own branches, in process: cache hit, 429 past MAX_BUILDS, one build per field, time limit, per-connection limit, 502, 422, 413."""
    import asyncio
    import tempfile

    import httpx

    from app import main

    calls = []

    async def slow(geometry, fid, declared_use=None):
        calls.append(fid)
        await asyncio.sleep(0.2)
        return {"schema": K.SCHEMA, "id": fid}

    async def down(geometry, fid, declared_use=None):
        raise series.UpstreamError("the satellite service is down")

    box = lambda i: {"geometry": {"type": "Polygon", "coordinates": [[[62 + i, 53], [62.02 + i, 53], [62.02 + i, 53.02], [62 + i, 53.02], [62 + i, 53]]]}}
    fields = lambda: list((K.DATA_DIR / "fields").glob("*.json"))

    async def run():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=main.app), base_url="http://test") as c:
            post = lambda body, **kw: c.post("/api/analyse", json=body, **kw)
            assert (await c.get("/api/health")).json() == {"ok": True}
            assert main.app.docs_url is None and main.app.redoc_url is None and main.app.openapi_url is None
            main.analyse = slow
            rs = await asyncio.gather(*(post(box(i)) for i in range(K.MAX_BUILDS + 1)))
            assert sorted(r.status_code for r in rs) == [200] * K.MAX_BUILDS + [429], [r.status_code for r in rs]
            built = next(i for i, r in enumerate(rs) if r.status_code == 200)
            assert len(fields()) == K.MAX_BUILDS and not list((K.DATA_DIR / "fields").glob("*.tmp")) and not main._inflight
            main.analyse = down
            r = await post(box(built))                                        # served from the cache: no build, no upstream
            assert r.status_code == 200 and r.json() == rs[built].json() and len(r.json()["id"]) == 16
            r = await post(box(7))
            assert r.status_code == 502 and "down" in r.json()["detail"] and not main._inflight
            r = await post({"geometry": {"type": "Point", "coordinates": [62, 53]}})
            assert r.status_code == 422 and r.json()["detail"] == "The field must be a single GeoJSON Polygon."
            main.analyse = slow                                               # a declared land use is part of the cache key
            r = await post(box(built) | {"declaredUse": {"2023": "fallow"}})
            assert r.status_code == 200 and r.json()["id"] != rs[built].json()["id"]
            for use in ({"2023": "wheat"}, {"1900": "crop"}, {"2017": "crop"}, {str(dt.date.today().year + 1): "fallow"}, {"x": "crop"}):
                r = await post(box(built) | {"declaredUse": use})             # an unknown use, a year outside 2018 to this year
                assert r.status_code == 422 and isinstance(r.json()["detail"], str), (use, r.text)
            # two first requests for one field: one build, the second waits for it and gets the same answer
            calls.clear()
            r1, r2 = await asyncio.gather(post(box(8)), post(box(8)))
            assert r1.status_code == r2.status_code == 200 and r1.json() == r2.json() and len(calls) == 1, calls
            # a build past the time limit: the usual 502 sentence, and the slot is free again
            K.BUILD_TIMEOUT_S = 0.05
            r = await post(box(9))
            assert r.status_code == 502 and r.json()["detail"] == "A satellite or climate data service did not answer. Please try again in a minute." and not main._inflight
            K.BUILD_TIMEOUT_S = 150
            # one connection, many new fields: refused past BUILDS_PER_HOUR; its cached fields and other connections are still served
            main._recent.clear()
            K.BUILDS_PER_HOUR, K.KEEP_FILES = 2, {"fields": 3, "climate": 100}
            me = {"headers": {"x-forwarded-for": "10.9.9.9, 203.0.113.7"}}    # the last entry counts; the first is whatever the caller wrote
            codes = [(await post(box(10 + i), **me)).status_code for i in range(3)]
            assert codes == [200, 200, 429] and (await post(box(10), **me)).status_code == 200, codes
            r = await post(box(12), headers={"x-forwarded-for": "203.0.113.7, 198.51.100.1"})
            assert r.status_code == 200 and len(fields()) == 3                # ... and the oldest cache files were pruned
            # a body over the size limit is refused unread, a number too large for a float is a plain 422
            r = await c.post("/api/analyse", content=b'{"geometry":"' + b"x" * 60_000 + b'"}', headers={"content-type": "application/json"})
            assert r.status_code == 413 and r.json() == {"detail": "The request is too large."}
            huge = '{"geometry":{"type":"Polygon","coordinates":[[[1' + "0" * 400 + ',53],[62.02,53],[62.02,53.02],[62,53]]]}}'
            r = await c.post("/api/analyse", content=huge, headers={"content-type": "application/json"})
            assert r.status_code == 422 and "longitude, latitude" in r.json()["detail"], r.text

    with tempfile.TemporaryDirectory() as tmp:
        K.DATA_DIR = Path(tmp)
        asyncio.run(run())


if __name__ == "__main__":
    for check in (check_series, check_vegetation, check_climate, check_explanation, check_polygon, check_contract, check_api):
        check()
        print(check.__name__, "ok")

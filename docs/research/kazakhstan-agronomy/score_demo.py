"""Throwaway check of the proposed rotation scoring. Run: python3 -I score_demo.py ../out/crop_catalogue.draft.json

Stress profile (0..1 each) -> scores for candidate rotations -> pick baseline / water-resilient / soil-restoring.
Stdlib only. The asserts at the bottom are the self-check.
"""
import json, sys

CAT = json.load(open(sys.argv[1]))
CROPS = {c["id"]: c for c in CAT["crops"]}
PRED = CAT["predecessor_yield_factor"]
PRICE = {  # relative to wheat = 1.0; judgement from 2025 quotes (wheat 65-70k KZT/t, flax/rapeseed 200k+)
    "spring_wheat": 1.0, "durum": 1.2, "barley": 0.8, "oats": 0.7, "millet": 0.9, "flax": 2.8, "sunflower": 2.2,
    "rapeseed": 2.8, "lentil": 2.5, "field_pea": 1.6, "chickpea": 2.5, "sweet_clover": 0.0, "fallow": 0.0}

def clip(x, lo=0.0, hi=1.0):
    return max(lo, min(hi, x))

def stress_profile(years, rain_mean_mm):
    """years: list of dicts with rain_pct (May-Aug rain / 2001-2020 mean), hot30 (days Tmax>=30 C, May-Aug),
    late_frost (bool: Tmin<=-2 C after 25 May or before 5 Sep), ndvi_peak (10 Jun-20 Aug)."""
    n = len(years)
    med = sorted(y["ndvi_peak"] for y in years)[n // 2]
    return {
        "rain_mean_mm": rain_mean_mm,                                         # May-Aug, 2001-2020, NASA POWER
        "water": sum(clip((1 - y["rain_pct"]) / 0.5) for y in years) / n,
        "heat": sum(clip((y["hot30"] - 15) / 25) for y in years) / n,
        "frost": sum(1 for y in years if y["late_frost"]) / n,
        "bare": sum(1 for y in years if y["ndvi_peak"] < 0.30) / n,           # fallow or failed-crop years
        "variability": clip((max(y["ndvi_peak"] for y in years) - min(y["ndvi_peak"] for y in years)) / med / 0.6),
    }

def allowed(rot, s):
    """Hard zone gates (judgement, agronomist should confirm): a crop that does not belong in the zone is never proposed."""
    gates = {
        "rapeseed": s["rain_mean_mm"] >= 200 and s["heat"] < 0.30,   # heat at flowering aborts pods: forest-steppe only
        "chickpea": s["rain_mean_mm"] < 190,                          # disease and late maturity in wetter zones
        "field_pea": s["heat"] < 0.45,
        "millet": s["frost"] < 0.30,
        "sunflower": s["frost"] < 0.20,
    }
    return all(gates.get(r, True) for r in rot)

def pred_factor(prev):
    if prev in ("spring_wheat", "durum"):
        return PRED["wheat_second_after_fallow"]
    return PRED.get(prev, PRED.get(prev + "_j", 0.85))

def crop_fit(c, s):
    """Climate fit of one crop on this field, 0..1."""
    return clip(1 - 0.5 * s["water"] * (1 - c["drought_tol_j"] / 5) * 2
                  - 0.5 * s["heat"] * (1 - c["heat_tol_j"] / 5) * 2
                  - 0.5 * s["frost"] * c["frost_sens_j"])

def score(rot, s):
    n = len(rot)
    cs = [CROPS[r] for r in rot]
    cereal = [r in ("spring_wheat", "durum") for r in rot]
    wheat_share = sum(cereal) / n
    back_to_back = sum(1 for i in range(n) if cereal[i] and cereal[i - 1]) / n   # rotation is cyclic
    groups = len({c["group"] for c in cs if c["group"] != "fallow"})
    # productivity in wheat-equivalent t/ha per rotation year (mid national yield x predecessor effect x price)
    prod = 0.0
    for i, c in enumerate(cs):
        if not c.get("yield_t_ha") or c["id"] == "fallow":
            continue
        y = sum(c["yield_t_ha"]) / 2 * crop_fit(c, s)
        if cereal[i]:
            y *= pred_factor(rot[i - 1])
        prod += y * PRICE[c["id"]] * (0.6 + 0.4 * c["market"] / 5)   # thin markets discount the gross value
    prod /= n
    dry_carry = sum(1 for i in range(n) if cs[i - 1]["water_use_j"] >= 5 and rot[i] != "fallow") / n  # sunflower, sweet clover before a crop
    return {
        "productivity_weq_t_ha": round(prod, 2),
        "climate_fit": round(sum(crop_fit(c, s) for c in cs if c["id"] != "fallow") / max(1, sum(1 for c in cs if c["id"] != "fallow")) - 0.3 * dry_carry * s["water"], 2),
        "soil": round(clip(sum(c["residue_cover_j"] for c in cs) / (5 * n) * 0.5
                           + min(1, sum(sum(c["n_fix_kg_ha"]) / 2 for c in cs) / n / 30) * 0.3
                           + (1 - rot.count("fallow") / n * 4) * 0.2), 2),
        "pest_break": round(clip(1 - wheat_share * 0.6 - back_to_back * 0.8 + (groups - 1) * 0.15), 2),
        "market": round(sum(c["market"] for c in cs if c["id"] != "fallow") / (5 * n), 2),
        "bare_fallow_share": round(rot.count("fallow") / n, 2),
    }

TEMPLATES = {
    "water": [
        ["spring_wheat", "flax", "spring_wheat", "barley"],
        ["spring_wheat", "sunflower", "barley", "spring_wheat"],
        ["spring_wheat", "millet", "spring_wheat", "flax"],
        ["fallow", "spring_wheat", "flax", "barley"],
        ["spring_wheat", "rapeseed", "spring_wheat", "barley"],
    ],
    "soil": [
        ["oats", "spring_wheat", "spring_wheat", "barley"],
        ["lentil", "spring_wheat", "flax", "barley"],
        ["field_pea", "spring_wheat", "flax", "barley"],
        ["sweet_clover", "spring_wheat", "spring_wheat", "barley"],
        ["field_pea", "spring_wheat", "rapeseed", "spring_wheat"],
        ["chickpea", "spring_wheat", "flax", "barley"],
    ],
}

def weights(kind, s):
    if kind == "water":   # drier / hotter field history -> climate fit dominates
        return {"climate_fit": 0.40 + 0.2 * s["water"], "productivity": 0.30, "market": 0.20, "soil": 0.05, "pest_break": 0.05}
    return {"soil": 0.40 + 0.2 * s["bare"], "pest_break": 0.20, "productivity": 0.20, "climate_fit": 0.10, "market": 0.10}

def pick(kind, s):
    w = weights(kind, s)
    best = None
    for rot in TEMPLATES[kind]:
        if not allowed(rot, s):
            continue
        sc = score(rot, s)
        total = (w["climate_fit"] * sc["climate_fit"] + w["soil"] * sc["soil"] + w["pest_break"] * sc["pest_break"]
                 + w["market"] * sc["market"] + w["productivity"] * clip(sc["productivity_weq_t_ha"] / 2.0))
        if best is None or total > best[0]:
            best = (round(total, 3), rot, sc)
    return best

if __name__ == "__main__":
    # Real numbers from this session: NASA POWER (rain %, hot days) and MODIS box-mean NDVI peaks, 2019-2024.
    kostanay = [dict(rain_pct=p, hot30=h, late_frost=f, ndvi_peak=n) for p, h, f, n in
                [(0.72, 18, False, 0.61), (1.49, 26, False, 0.68), (0.55, 45, False, 0.55), (0.89, 11, False, 0.59), (1.12, 34, False, 0.47), (1.66, 5, False, 0.85)]]
    shortandy = [dict(rain_pct=p, hot30=h, late_frost=f, ndvi_peak=n) for p, h, f, n in
                 [(0.79, 18, True, 0.58), (0.96, 21, False, 0.54), (0.72, 23, False, 0.41), (0.74, 15, False, 0.55), (0.50, 41, False, 0.46), (2.00, 8, False, 0.71)]]
    petropavl = [dict(rain_pct=p, hot30=h, late_frost=f, ndvi_peak=n) for p, h, f, n in
                 [(1.04, 5, False, 0.73), (0.74, 22, False, 0.56), (0.70, 28, False, 0.63), (1.07, 4, False, 0.70), (0.80, 22, False, 0.55), (1.47, 1, False, 0.81)]]
    base = ["fallow", "spring_wheat", "spring_wheat", "barley"]
    mono = ["spring_wheat", "spring_wheat", "spring_wheat", "spring_wheat"]
    out = {}
    for name, yrs, rain in (("Kostanay", kostanay, 170), ("Akmola", shortandy, 168), ("North Kazakhstan", petropavl, 212)):
        s = stress_profile(yrs, rain)
        out[name] = (s, score(base, s), pick("water", s), pick("soil", s))
        print(f"\n== {name}: stress {{{', '.join(f'{k} {v:.2f}' for k, v in s.items())}}}")
        print("  baseline F-W-W-B     ", score(base, s))
        print("  continuous wheat     ", score(mono, s))
        for kind in ("water", "soil"):
            t, rot, sc = pick(kind, s)
            print(f"  {kind:5s} -> {'-'.join(rot):52s} total {t}  {sc}")

    # self-check: fails if the logic stops making agronomic sense
    s_k, b_k, w_k, so_k = out["Kostanay"]
    s_a = out["Akmola"][0]
    assert s_a["water"] > out["North Kazakhstan"][0]["water"], "Akmola point should score drier than Petropavl"
    assert so_k[2]["bare_fallow_share"] == 0 and so_k[2]["soil"] > b_k["soil"], "soil strategy must beat baseline on soil and drop bare fallow"
    assert so_k[2]["pest_break"] >= b_k["pest_break"], "soil strategy should not worsen the pest break"
    assert score(mono, s_k)["pest_break"] < b_k["pest_break"], "continuous wheat must score worst on pest break"
    for site in ("Kostanay", "Akmola"):
        assert "rapeseed" not in out[site][2][1] + out[site][3][1], "rapeseed must not be proposed in the dry steppe"
    assert "chickpea" not in out["North Kazakhstan"][2][1] + out["North Kazakhstan"][3][1], "chickpea must not be proposed in the forest-steppe"
    dry = dict(rain_mean_mm=150, water=0.9, heat=0.9, frost=0.0, bare=0.25, variability=1.0)
    wet = dict(rain_mean_mm=230, water=0.0, heat=0.0, frost=0.0, bare=0.25, variability=0.2)
    assert crop_fit(CROPS["millet"], dry) > crop_fit(CROPS["spring_wheat"], dry) > crop_fit(CROPS["rapeseed"], dry)
    assert abs(crop_fit(CROPS["rapeseed"], wet) - 1) < 1e-9
    print("\nself-check passed")

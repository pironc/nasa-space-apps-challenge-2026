"""Probe: can the Planetary Computer data API return masked per-field index statistics in ONE call per scene?"""
import json, sys, time, urllib.parse, urllib.request, concurrent.futures as cf
FEAT = {"type": "Feature", "properties": {}, "geometry": {"type": "Polygon", "coordinates": [[[63.60, 53.20], [63.64, 53.20], [63.64, 53.22], [63.60, 53.22], [63.60, 53.20]]]}}
URL = "https://planetarycomputer.microsoft.com/api/data/v1/item/statistics?"
SENT = -9.0

def field_stats(item_id, baseline):
    off = 1000 if baseline >= "04.00" else 0   # ESA offset since baseline 04.00
    m = "(SCL>=4)&(SCL<=6)"                    # vegetation, bare soil, water
    idx = lambda a, b: "where(%s,(%s-%s)/(%s+%s-%d),%g)" % (m, a, b, a, b, 2 * off, SENT)
    expr = ";".join([idx("B08", "B04"), idx("B08", "B05"), idx("B08", "B11"), "where(%s,1,0)" % m])
    q = urllib.parse.urlencode({"collection": "sentinel-2-l2a", "item": item_id, "expression": expr, "asset_as_band": "true", "max_size": 256})
    req = urllib.request.Request(URL + q, data=json.dumps(FEAT).encode(), headers={"Content-Type": "application/json", "User-Agent": "research-client/1.0"})
    with urllib.request.urlopen(req, timeout=120) as r:
        s = list(json.load(r)["properties"]["statistics"].values())
    f = s[3]["mean"]
    un = lambda x: None if f == 0 else round((x["mean"] - SENT * (1 - f)) / f, 4)   # undo the sentinel
    return {"valid_frac": round(f, 3), "n": int(s[3]["count"]), "ndvi_mean": un(s[0]), "ndre_mean": un(s[1]), "ndmi_mean": un(s[2])}

items = [("S2A_MSIL2A_20210705T065621_R063_T41UNV_20210705T214126", "03.00"),
         ("S2B_MSIL2A_20210710T065629_R063_T41UNV_20210710T184459", "03.00"),
         ("S2A_MSIL2A_20240719T065621_R063_T41UNV_20240719T124419", "05.10")]
t = time.time()
with cf.ThreadPoolExecutor(3) as ex:
    for (iid, b), res in zip(items, ex.map(lambda x: field_stats(*x), items)):
        print(iid[11:19], b, res)
print("3 scenes in parallel: %.1fs" % (time.time() - t))

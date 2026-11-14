"""Shared stdlib-only helpers for the spike. No third-party deps."""
import json, time, urllib.request, urllib.parse, urllib.error

STAC = "https://planetarycomputer.microsoft.com/api/stac/v1"
DATA = "https://planetarycomputer.microsoft.com/api/data/v1"
UA = "data-path-spike/0.1"

def rect(lon, lat, w_km=2.0, h_km=1.5):
    import math
    dlon = w_km / (111.32 * math.cos(math.radians(lat))) / 2
    dlat = h_km / 110.95 / 2
    ring = [[lon-dlon, lat-dlat],[lon+dlon, lat-dlat],[lon+dlon, lat+dlat],[lon-dlon, lat+dlat],[lon-dlon, lat-dlat]]
    return {"type": "Feature", "properties": {}, "geometry": {"type": "Polygon", "coordinates": [ring]}}

def http(url, body=None, timeout=60):
    """Returns (status, parsed_json_or_text, seconds, headers)."""
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers={"User-Agent": UA, "Content-Type": "application/json", "Accept": "application/json"})
    t = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read(); st = r.status; hd = dict(r.headers)
    except urllib.error.HTTPError as e:
        raw = e.read(); st = e.code; hd = dict(e.headers)
    except Exception as e:
        return 0, repr(e), time.time()-t, {}
    dt = time.time()-t
    try: return st, json.loads(raw), dt, hd
    except Exception: return st, raw[:500].decode("utf8", "replace"), dt, hd

def search(collection, geom, datetime, query=None, limit=250, fields=None):
    """All pages of a STAC search. Returns (features, seconds, pages)."""
    body = {"collections": [collection], "intersects": geom, "datetime": datetime, "limit": limit}
    if query: body["query"] = query
    if fields: body["fields"] = fields
    url = STAC + "/search"; feats = []; t = time.time(); pages = 0
    while url:
        st, js, dt, _ = http(url, body)
        if st != 200: raise RuntimeError(f"search {st}: {js}")
        feats += js["features"]; pages += 1
        nxt = [l for l in js.get("links", []) if l["rel"] == "next"]
        if nxt:
            url = nxt[0]["href"]; body = nxt[0].get("body", body)
        else: url = None
    return feats, time.time()-t, pages

def stats(collection, item, feature, params, timeout=60):
    q = urllib.parse.urlencode([("collection", collection), ("item", item)] + params)
    return http(f"{DATA}/item/statistics?{q}", feature, timeout)

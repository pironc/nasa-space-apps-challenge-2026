"""Persistence sketch for Field Shift. Standard library only (sqlite3, hashlib, json).

Run:  python3 -I store_sketch.py <path-to-a-POWER-daily-point-JSON>
It builds a throwaway database in a temp dir, runs the self-check, prints sizes.
"""
import datetime as dt
import hashlib
import json
import math
import os
import shutil
import sqlite3
import sys
import tempfile

ALGO = 1  # bump when masking or index maths changes; rows with another value are deleted at startup

SCHEMA = """
CREATE TABLE IF NOT EXISTS fields(
  id           TEXT PRIMARY KEY,      -- polygon hash, see field_id()
  geometry     TEXT NOT NULL,         -- canonical ring as JSON [[lon,lat],...]
  area_ha      REAL NOT NULL,
  lat REAL NOT NULL, lon REAL NOT NULL,   -- centroid
  cell_id      TEXT NOT NULL,         -- NASA POWER grid cell, see power_cell()
  is_preset    INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  refreshed_at TEXT,                  -- last successful satellite refresh
  last_seen_at TEXT                   -- last time any browser asked for it (for pruning)
);
CREATE TABLE IF NOT EXISTS observations(
  field_id   TEXT NOT NULL REFERENCES fields(id) ON DELETE CASCADE,
  source     TEXT NOT NULL,           -- 's2' | 'landsat'
  date       TEXT NOT NULL,           -- acquisition day, YYYY-MM-DD
  scene_ids  TEXT NOT NULL,           -- JSON array of STAC item ids that were read
  baseline   TEXT,                    -- e.g. '05.10' (Sentinel-2 processing baseline)
  valid_frac REAL NOT NULL,           -- clear pixels / pixels inside the polygon, 0..1
  n_valid    INTEGER NOT NULL,
  ndvi_mean REAL, ndvi_p10 REAL, ndvi_p50 REAL, ndvi_p90 REAL,
  ndre_mean REAL, ndmi_mean REAL,
  algo       INTEGER NOT NULL,
  fetched_at TEXT NOT NULL,
  PRIMARY KEY(field_id, source, date)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS climate_cells(
  cell_id TEXT PRIMARY KEY, lat REAL NOT NULL, lon REAL NOT NULL,
  fetched_at TEXT NOT NULL, sources TEXT, api_version TEXT
);
CREATE TABLE IF NOT EXISTS climate_daily(
  cell_id TEXT NOT NULL, date TEXT NOT NULL,
  t2m REAL, t2m_max REAL, t2m_min REAL, precip REAL, gwetroot REAL, gwettop REAL, srad REAL,
  PRIMARY KEY(cell_id, date)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS analyses(   -- only for results that are slow or not reproducible (LLM text)
  field_id TEXT NOT NULL, kind TEXT NOT NULL, input_hash TEXT NOT NULL,
  created_at TEXT NOT NULL, result TEXT NOT NULL,
  PRIMARY KEY(field_id, kind, input_hash)
);
"""


def utcnow():
    return dt.datetime.now(dt.timezone.utc)


def connect(path):
    con = sqlite3.connect(path, timeout=30, check_same_thread=False)
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("PRAGMA foreign_keys=ON")
    con.executescript(SCHEMA)
    con.execute("DELETE FROM observations WHERE algo != ?", (ALGO,))
    con.commit()
    return con


# ---------- polygon cache key ----------

def canonical_ring(geojson_polygon, ndigits=5):
    """Outer ring, rounded to 5 decimals (about 1 m), open, counter-clockwise, starting at its smallest vertex."""
    if geojson_polygon.get("type") != "Polygon" or len(geojson_polygon["coordinates"]) != 1:
        raise ValueError("one simple polygon without holes, please")
    pts = [(round(float(x), ndigits), round(float(y), ndigits)) for x, y in geojson_polygon["coordinates"][0]]
    pts = [p for i, p in enumerate(pts) if i == 0 or p != pts[i - 1]]
    if len(pts) > 1 and pts[0] == pts[-1]:
        pts.pop()
    if not 3 <= len(pts) <= 200:
        raise ValueError("polygon needs 3 to 200 distinct vertices")
    if not all(-180 <= x <= 180 and -85 <= y <= 85 for x, y in pts):
        raise ValueError("coordinates out of range")
    twice_area = sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1]))
    if twice_area == 0:
        raise ValueError("polygon has no area")
    if twice_area < 0:
        pts.reverse()
    i = pts.index(min(pts))
    return pts[i:] + pts[:i]


def field_id(ring):
    return hashlib.sha256(json.dumps(ring, separators=(",", ":")).encode()).hexdigest()[:16]


def area_ha(ring):
    """Planar approximation around the ring's mean latitude; within about 1% for fields of a few km."""
    lat0 = math.radians(sum(y for _, y in ring) / len(ring))
    k = 111_320.0
    xy = [(x * k * math.cos(lat0), y * 110_574.0) for x, y in ring]
    return abs(sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(xy, xy[1:] + xy[:1]))) / 2 / 10_000


def power_cell(lat, lon):
    """MERRA-2 grid used by NASA POWER meteorology: 0.5 deg latitude by 0.625 deg longitude. Returns id and cell centre."""
    i, j = round(lat / 0.5), round(lon / 0.625)
    return "%d_%d" % (i, j), i * 0.5, j * 0.625


# ---------- incremental satellite refresh ----------

def refresh_s2(con, fid, search, compute, today, history_start="2017-05-01", recheck_days=10):
    """search(start, end) -> [{'id','date','baseline'}] (metadata only, cheap).
    compute(items_for_one_day) -> dict of statistics (pixel read, slow). Returns the days that were (re)computed."""
    last = con.execute("SELECT max(date) FROM observations WHERE field_id=? AND source='s2'", (fid,)).fetchone()[0]
    start = history_start if last is None else (dt.date.fromisoformat(last) - dt.timedelta(days=recheck_days)).isoformat()
    known = set()
    for (ids,) in con.execute("SELECT scene_ids FROM observations WHERE field_id=? AND source='s2' AND date>=?", (fid, start)):
        known.update(json.loads(ids))
    by_day = {}
    for it in search(start, today):
        by_day.setdefault(it["date"], []).append(it)
    todo = {d: its for d, its in by_day.items() if any(i["id"] not in known for i in its)}
    now = utcnow().isoformat(timespec="seconds")
    for day, items in sorted(todo.items()):
        s = compute(items)
        with con:  # one transaction per day: a crash mid-refresh keeps what was already done
            con.execute(
                "INSERT INTO observations VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) "
                "ON CONFLICT(field_id, source, date) DO UPDATE SET scene_ids=excluded.scene_ids, baseline=excluded.baseline,"
                " valid_frac=excluded.valid_frac, n_valid=excluded.n_valid, ndvi_mean=excluded.ndvi_mean, ndvi_p10=excluded.ndvi_p10,"
                " ndvi_p50=excluded.ndvi_p50, ndvi_p90=excluded.ndvi_p90, ndre_mean=excluded.ndre_mean, ndmi_mean=excluded.ndmi_mean,"
                " algo=excluded.algo, fetched_at=excluded.fetched_at",
                (fid, "s2", day, json.dumps(sorted(i["id"] for i in items)), max(i.get("baseline") or "" for i in items), s["valid_frac"], s["n_valid"],
                 s.get("ndvi_mean"), s.get("ndvi_p10"), s.get("ndvi_p50"), s.get("ndvi_p90"), s.get("ndre_mean"), s.get("ndmi_mean"), ALGO, now))
    with con:
        con.execute("UPDATE fields SET refreshed_at=? WHERE id=?", (now, fid))
    return sorted(todo)


# ---------- climate: replace the whole cell, at most once a day ----------

POWER_COLS = ["T2M", "T2M_MAX", "T2M_MIN", "PRECTOTCORR", "GWETROOT", "GWETTOP", "ALLSKY_SFC_SW_DWN"]


def store_power(con, cell_id, lat, lon, payload):
    """payload = parsed JSON of one NASA POWER daily point response. Replaces every stored day for the cell."""
    p = payload["properties"]["parameter"]
    fill = payload["header"]["fill_value"]
    rows = []
    for d in sorted(p[POWER_COLS[0]]):
        vals = [None if p[c][d] == fill else p[c][d] for c in POWER_COLS]
        rows.append([cell_id, "%s-%s-%s" % (d[:4], d[4:6], d[6:])] + vals)
    with con:
        con.execute("DELETE FROM climate_daily WHERE cell_id=?", (cell_id,))
        con.executemany("INSERT INTO climate_daily VALUES(?,?,?,?,?,?,?,?,?)", rows)
        con.execute("INSERT OR REPLACE INTO climate_cells VALUES(?,?,?,?,?,?)",
                    (cell_id, lat, lon, utcnow().isoformat(timespec="seconds"),
                     json.dumps(payload["header"].get("sources")), payload["header"]["api"]["version"]))
    return len(rows)


def climate_is_fresh(con, cell_id, ttl_hours=24):
    row = con.execute("SELECT fetched_at FROM climate_cells WHERE cell_id=?", (cell_id,)).fetchone()
    return bool(row) and utcnow() - dt.datetime.fromisoformat(row[0]) < dt.timedelta(hours=ttl_hours)


# ---------- snapshot for hosts with a throwaway disk ----------

def snapshot(con, dest_path):
    """Consistent copy of the live database written as ONE whole file (what a bucket mount handles well)."""
    tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False).name
    out = sqlite3.connect(tmp)
    con.backup(out)
    out.close()
    shutil.copyfile(tmp, dest_path)
    os.remove(tmp)


# ---------- self-check ----------

def demo(power_json_path):
    box = [[63.60, 53.20], [63.64, 53.20], [63.64, 53.22], [63.60, 53.22], [63.60, 53.20]]
    a = canonical_ring({"type": "Polygon", "coordinates": [box]})
    same = [
        box[::-1],                                   # drawn the other way round
        box[2:-1] + box[:2] + [box[2]],              # started at another corner
        box[:-1],                                    # not closed
        [[x + 2e-7, y - 2e-7] for x, y in box],      # float noise from the map library
    ]
    for ring in same:
        assert field_id(canonical_ring({"type": "Polygon", "coordinates": [ring]})) == field_id(a), ring
    moved = [[x + 0.001, y] for x, y in box]
    assert field_id(canonical_ring({"type": "Polygon", "coordinates": [moved]})) != field_id(a)
    assert 570 < area_ha(a) < 610, area_ha(a)
    assert power_cell(53.21, 63.62) == ("106_102", 53.0, 63.75) == power_cell(52.80, 63.95)
    assert power_cell(53.30, 63.70)[0] != "106_102"
    for bad in ([[0, 0], [1, 1]], [[0, 0], [1, 1], [2, 2]], [[0, 0], [0, 95], [1, 0]]):
        try:
            canonical_ring({"type": "Polygon", "coordinates": [bad]})
            raise AssertionError("accepted a bad polygon: %r" % bad)
        except ValueError:
            pass

    tmpdir = tempfile.mkdtemp(prefix="fieldshift-")
    con = connect(os.path.join(tmpdir, "fieldshift.db"))
    fid = field_id(a)
    cell, clat, clon = power_cell(53.21, 63.62)
    con.execute("INSERT INTO fields(id,geometry,area_ha,lat,lon,cell_id,created_at) VALUES(?,?,?,?,?,?,?)",
                (fid, json.dumps(a), area_ha(a), 53.21, 63.62, cell, "2026-11-14T00:00:00"))
    con.commit()

    catalogue = [{"id": "S2_%s_%s" % (y, d), "date": "%d-07-%02d" % (y, d), "baseline": "05.10"} for y in range(2017, 2027) for d in range(1, 31, 3)]
    reads = []

    def search(start, end):
        return [i for i in catalogue if start <= i["date"] <= end]

    def compute(items):
        reads.append(items[0]["date"])
        return {"valid_frac": 0.9, "n_valid": 1400, "ndvi_mean": 0.6, "ndvi_p10": 0.4, "ndvi_p50": 0.6, "ndvi_p90": 0.8, "ndre_mean": 0.3, "ndmi_mean": 0.2}

    first = refresh_s2(con, fid, search, compute, "2026-07-20")
    assert len(first) == len([i for i in catalogue if i["date"] <= "2026-07-20"])
    assert refresh_s2(con, fid, search, compute, "2026-07-20") == [], "second run must read no pixels"
    catalogue.append({"id": "S2_2026_late", "date": "2026-07-15", "baseline": "05.10"})      # arrived late, inside the re-check window
    catalogue.append({"id": "S2_2026_new", "date": "2026-07-22", "baseline": "05.10"})       # new acquisition
    catalogue.append({"id": "S2_2026_19_reprocessed", "date": "2026-07-19", "baseline": "05.13"})  # same day, new product id
    catalogue.append({"id": "S2_2019_old_late", "date": "2019-07-02", "baseline": "05.10"})   # outside the window: NOT picked up
    assert refresh_s2(con, fid, search, compute, "2026-07-25") == ["2026-07-15", "2026-07-19", "2026-07-22", "2026-07-25"]
    n = con.execute("SELECT count(*), count(DISTINCT date) FROM observations").fetchone()
    assert n[0] == n[1], "one row per field and day"
    assert "05.13" == con.execute("SELECT baseline FROM observations WHERE date='2026-07-19'").fetchone()[0]

    with open(power_json_path) as fh:
        payload = json.load(fh)
    assert not climate_is_fresh(con, cell)
    n_days = store_power(con, cell, clat, clon, payload)
    assert climate_is_fresh(con, cell)
    assert store_power(con, cell, clat, clon, payload) == n_days == con.execute("SELECT count(*) FROM climate_daily").fetchone()[0]
    assert con.execute("SELECT count(*) FROM climate_daily WHERE t2m = -999").fetchone()[0] == 0

    print("field id:", fid, "| area ha: %.0f" % area_ha(a), "| POWER cell:", cell, (clat, clon))
    print("climate days stored:", n_days, "| days still empty at the end (not yet published):",
          con.execute("SELECT count(*) FROM climate_daily WHERE t2m IS NULL").fetchone()[0])
    print("year  rain May-Sep mm   days Tmax>=30C   frost days May-Sep   mean root-zone wetness Jun-Aug")
    for row in con.execute(
            "SELECT substr(date,1,4) y, round(sum(precip)), sum(t2m_max>=30), sum(t2m_min<0),"
            " round(avg(CASE WHEN substr(date,6,2) IN ('06','07','08') THEN gwetroot END),2)"
            " FROM climate_daily WHERE cell_id=? AND substr(date,6,2) BETWEEN '05' AND '09' GROUP BY y", (cell,)):
        print("%s  %15s %15s %20s %32s" % row)

    snap = os.path.join(tmpdir, "snapshot.db")
    snapshot(con, snap)
    chk = sqlite3.connect(snap)
    assert chk.execute("SELECT count(*) FROM observations").fetchone() == con.execute("SELECT count(*) FROM observations").fetchone()
    assert chk.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
    print("observation rows:", n[0], "| snapshot bytes:", os.path.getsize(snap), "| sqlite", sqlite3.sqlite_version, "| python", sys.version.split()[0])
    chk.close()
    con.close()
    shutil.rmtree(tmpdir)
    print("self-check passed")


if __name__ == "__main__":
    demo(sys.argv[1])

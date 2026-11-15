"""Save the clear Sentinel-2 images of each demo field for every season since 2018 (full size for its demo years), so the map can animate the field
day by day from local files instead of asking the tile server for every frame.

Run after build_presets.py (it reads the scene lists from the preset files):
    uv run python scripts/build_frames.py

Writes frontend/public/frames/<preset id>/<date>.jpg and an index.json per field:
    {"bounds": [west, south, east, north], "frames": [{"date": "2021-07-10", "file": "2021-07-10.jpg"}, ...]}
Each image covers the field and the land around it (one picture per date, not a tile pyramid).
"""
import asyncio
import json
import math
from pathlib import Path
from urllib.parse import urlencode

import httpx

ROOT = Path(__file__).resolve().parents[2]
PRESETS = ROOT / "frontend" / "public" / "presets"
OUT = ROOT / "frontend" / "public" / "frames"
BBOX_URL = "https://planetarycomputer.microsoft.com/api/data/v1/item/bbox/{w},{s},{e},{n}/{width}x{height}.jpg"
WIDTH = 640                  # px across for the demo years; about 7 to 10 m per pixel over these fields
OTHER_WIDTH = 512            # the other years, a little smaller to keep the download down
FIRST_YEAR = 2018            # usable Sentinel-2 seasons start here
PAD = 0.6                    # land shown around the field, as a share of the field's own size on each side
MIN_PAD_DEG = 0.015          # at least about 1 to 1.6 km of context
CONCURRENCY = 8
SEASON = ("05-01", "09-30")


def frame_bounds(ring):
    xs, ys = [p[0] for p in ring], [p[1] for p in ring]
    px = max((max(xs) - min(xs)) * PAD, MIN_PAD_DEG)
    py = max((max(ys) - min(ys)) * PAD, MIN_PAD_DEG)
    return [round(min(xs) - px, 5), round(min(ys) - py, 5), round(max(xs) + px, 5), round(max(ys) + py, 5)]


def height_for(b, width=WIDTH):
    """Pixel height that keeps the picture undistorted on a Web Mercator map."""
    merc = lambda lat: math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))
    return max(1, round(width * (merc(b[3]) - merc(b[1])) / math.radians(b[2] - b[0])))


async def fetch(c, sem, url, path):
    async with sem:
        for attempt in range(3):
            try:
                r = await c.get(url)
                if r.status_code == 200 and r.content:
                    path.write_bytes(r.content)
                    return True
                if r.status_code == 404:
                    return False
            except httpx.HTTPError:
                pass
            await asyncio.sleep(1 + 2 * attempt)
    return False


async def main():
    presets = json.loads((PRESETS / "index.json").read_text())
    sem = asyncio.Semaphore(CONCURRENCY)
    async with httpx.AsyncClient(timeout=90, headers={"User-Agent": "fieldshift/0.1"}) as c:
        for p in presets:
            analysis = json.loads((PRESETS / f"{p['id']}.json").read_text())
            b = frame_bounds(p["geometry"]["coordinates"][0])
            demo = {str(y) for y in p["demoYears"]}
            scenes = [s for s in analysis["scenes"] if s["date"][:4] >= str(FIRST_YEAR) and SEASON[0] <= s["date"][5:] <= SEASON[1]]
            folder = OUT / p["id"]
            folder.mkdir(parents=True, exist_ok=True)
            params = urlencode({"collection": "sentinel-2-l2a", "assets": "visual", "asset_bidx": "visual|1,2,3", "nodata": "0"})

            async def one(s):
                path = folder / f"{s['date']}.jpg"
                if path.exists() and path.stat().st_size:
                    return s["date"]
                width = WIDTH if s["date"][:4] in demo else OTHER_WIDTH
                url = BBOX_URL.format(w=b[0], s=b[1], e=b[2], n=b[3], width=width, height=height_for(b, width)) + f"?{params}&item={s['item']}"
                return s["date"] if await fetch(c, sem, url, path) else None

            got = sorted(d for d in await asyncio.gather(*map(one, scenes)) if d)
            (folder / "index.json").write_text(json.dumps({"bounds": b, "frames": [{"date": d, "file": f"{d}.jpg"} for d in got]}, separators=(",", ":")))
            size = sum(f.stat().st_size for f in folder.glob("*.jpg"))
            print(f"{p['id']}: {len(got)} of {len(scenes)} frames, {size / 1e6:.1f} MB, {FIRST_YEAR} to {max((d[:4] for d in got), default='-')}")


if __name__ == "__main__":
    assert height_for([62.64, 53.74, 62.74, 53.80]) in range(640, 660)   # at 54 N, 0.06 deg of latitude spans about as much Mercator as 0.1 deg of longitude
    asyncio.run(main())

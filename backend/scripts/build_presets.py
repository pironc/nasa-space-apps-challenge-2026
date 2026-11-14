"""Build the preset fields: backend/presets.geojson -> frontend/public/presets/<id>.json and index.json.
Rerunnable; needs the network.  Run from backend/:  uv run python scripts/build_presets.py"""
import asyncio
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from app.analyse import analyse  # noqa: E402

OUT = ROOT.parent / "frontend" / "public" / "presets"


async def main():
    index = []
    for f in json.loads((ROOT / "presets.geojson").read_text())["features"]:
        p, t = f["properties"], time.time()
        a = await analyse(f["geometry"], p["id"], include_modis=True, include_soil=True)
        (OUT / f"{p['id']}.json").write_text(json.dumps(a, separators=(",", ":"), allow_nan=False))
        index.append({"id": p["id"], "name": p["name"], "region": p["region"], "note": p["note"], "rotation": p["rotation"],
                      "areaHa": a["field"]["areaHa"], "geometry": f["geometry"], "demoYears": p["demoYears"]})
        peaks = " ".join(f"{s['year']}:{s['peak']}/{s['use']}" for s in a["seasons"])
        print(f"{p['id']}: {time.time() - t:.1f} s | {a['field']['areaHa']} ha | modis {'yes' if a['modis'] else 'no'} | soil {'yes' if a['soil'] else 'no'}\n  {peaks}")
    (OUT / "index.json").write_text(json.dumps(index, indent=1))


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    asyncio.run(main())

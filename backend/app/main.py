"""Field Shift API. One process serves /api/* and, when it has been built, the frontend."""
import datetime as dt
import json
import time
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from typing import Literal

from pydantic import BaseModel
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import constants as K
from .analyse import analyse, field_hash, validate
from .climate import write_json
from .series import UpstreamError

app = FastAPI(title="Field Shift API")
_building = 0                          # first-time builds in flight (one worker, one event loop: a plain counter is enough)


class AnalyseRequest(BaseModel):
    geometry: dict
    declaredUse: dict[int, Literal["crop", "fallow"]] = {}   # year -> land use stated by the user; wins over the inferred label


@app.get("/api/health")
def health():
    return {"ok": True}


def _fresh(path, today):
    """Seasons are judged once finished, so a cached field only ages while new passes can arrive."""
    in_season = dt.date(today.year, 5, 1) <= today <= dt.date(today.year, 10, 15)
    return not in_season or time.time() - path.stat().st_mtime < K.FIELD_CACHE_HOURS * 3600


@app.post("/api/analyse")
async def analyse_field(req: AnalyseRequest):
    global _building
    try:
        ring, _ = validate(req.geometry)
    except ValueError as e:
        raise HTTPException(422, str(e)) from None
    fid = field_hash(ring, req.declaredUse)
    path = K.DATA_DIR / "fields" / f"{fid}.json"
    cached = None
    if path.exists():
        cached = json.loads(path.read_text())
        if cached.get("schema") == K.SCHEMA and _fresh(path, dt.date.today()):
            return cached
    if _building >= K.MAX_BUILDS:
        raise HTTPException(429, "The server is already building other fields. Please try again in a minute.")
    _building += 1
    try:
        result = await analyse(req.geometry, fid, declared_use=req.declaredUse)
    except (UpstreamError, httpx.HTTPError) as e:
        if cached and cached.get("schema") == K.SCHEMA:
            return cached                                  # upstream is down: an older analysis beats an error
        raise HTTPException(502, str(e) if isinstance(e, UpstreamError) else
                            "A satellite or climate data service did not answer. Please try again in a minute.") from None
    finally:
        _building -= 1
    write_json(path, result)
    return result


DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if DIST.is_dir():
    class SPA(StaticFiles):
        """Static files with an index.html fallback, so client-side URLs survive a reload."""
        async def get_response(self, path, scope):
            try:
                return await super().get_response(path, scope)
            except StarletteHTTPException as e:
                if e.status_code != 404 or path.startswith("api/"):
                    raise
                return await super().get_response("index.html", scope)

    app.mount("/", SPA(directory=DIST, html=True))

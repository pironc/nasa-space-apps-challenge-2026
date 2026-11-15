"""Croppy API. One process serves /api/* and, when it has been built, the frontend."""
import asyncio
import datetime as dt
import json
import time
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from typing import Literal

from pydantic import BaseModel
from starlette.exceptions import HTTPException as StarletteHTTPException

from . import constants as K
from .analyse import analyse, field_hash, validate
from .climate import write_json
from .series import UpstreamError

app = FastAPI(title="Croppy API", docs_url=None, redoc_url=None, openapi_url=None)   # a public URL needs no request form
_inflight = {}                         # field id -> the task building it (one worker, one event loop: a plain dict is enough)
_recent = {}                           # connection -> start times of the new builds it asked for in the last hour


@app.middleware("http")
async def small_bodies(request, call_next):
    """Refuse a large or unsized body before anything reads it: parsing 16 MB of JSON once took the whole instance down."""
    n = request.headers.get("content-length", "")
    if request.method == "POST" and not (n.isdecimal() and len(n) < 9 and int(n) <= K.MAX_BODY_BYTES):
        return JSONResponse({"detail": "The request is too large."}, 413)
    return await call_next(request)


@app.exception_handler(RequestValidationError)
async def plain_422(request, exc):
    """One plain sentence instead of FastAPI's list, which repeats the whole input back."""
    return JSONResponse({"detail": "The request must be JSON with a field outline (geometry) and, optionally, the declared land use by year."}, 422)


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


def _allow(who, now):
    """Count one new build for this connection; False once it has had BUILDS_PER_HOUR in the last hour."""
    if len(_recent) > 10_000:                                  # addresses seen long ago: drop them all, the limit restarts for an hour at worst
        _recent.clear()
    mine = _recent[who] = [t for t in _recent.get(who, []) if t > now - 3600]
    if len(mine) >= K.BUILDS_PER_HOUR:
        return False
    mine.append(now)
    return True


async def _build(geometry, declared, fid, path, cached):
    """One first-time build: time-limited, cached, and independent of the request that started it."""
    try:
        result = await asyncio.wait_for(analyse(geometry, fid, declared_use=declared), K.BUILD_TIMEOUT_S)
        write_json(path, result)
        for folder, keep in K.KEEP_FILES.items():              # the cache folder is memory on Cloud Run: keep the newest files only
            for old in sorted((K.DATA_DIR / folder).glob("*.json"), key=lambda f: f.stat().st_mtime)[:-keep]:
                old.unlink(missing_ok=True)
        return result
    except (UpstreamError, httpx.HTTPError, asyncio.TimeoutError) as e:
        if cached and cached.get("schema") == K.SCHEMA:
            return cached                                      # upstream is down: an older analysis beats an error
        raise HTTPException(502, str(e) if isinstance(e, UpstreamError) else
                            "A satellite or climate data service did not answer. Please try again in a minute.") from None
    finally:
        del _inflight[fid]


@app.post("/api/analyse")
async def analyse_field(req: AnalyseRequest, request: Request):
    try:
        ring, _ = validate(req.geometry)
    except ValueError as e:
        raise HTTPException(422, str(e)) from None
    today = dt.date.today()
    if not all(K.S2_FIRST_YEAR <= y <= today.year for y in req.declaredUse):   # also bounds the cache keys one outline can make
        raise HTTPException(422, f"Land use can be declared for the seasons {K.S2_FIRST_YEAR} to {today.year} only.")
    fid = field_hash(ring, req.declaredUse)
    path = K.DATA_DIR / "fields" / f"{fid}.json"
    cached = None
    if path.exists():
        cached = json.loads(path.read_text())
        if cached.get("schema") == K.SCHEMA and _fresh(path, today):
            return cached
    task = _inflight.get(fid)                                  # the same field is already being built: wait for that build
    if task is None:
        if len(_inflight) >= K.MAX_BUILDS:
            raise HTTPException(429, "The server is already building other fields. Please try again in a minute.")
        # ponytail: Cloud Run appends the caller's address last in X-Forwarded-For (not checked on the deployed URL); behind another proxy pick that proxy's entry
        who = (request.headers.get("x-forwarded-for") or (request.client.host if request.client else "")).split(",")[-1].strip()
        if not _allow(who, time.time()):
            raise HTTPException(429, "This connection has analysed many new fields in the last hour. Please try again later.")
        task = _inflight[fid] = asyncio.ensure_future(_build(req.geometry, req.declaredUse, fid, path, cached))
        task.add_done_callback(lambda t: t.cancelled() or t.exception())   # every caller may have hung up: the failure is then nobody's, not a log warning
    return await asyncio.shield(task)                          # shielded: a caller hanging up does not stop the build others may wait for


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

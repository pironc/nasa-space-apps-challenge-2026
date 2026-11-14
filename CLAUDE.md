# CLAUDE.md — NASA Space Apps Challenge 2026: Field Shift

## 1. Identity
- **Repo:** `https://github.com/pironc/nasa-space-apps-challenge-2026.git`
- **Event:** NASA Space Apps Challenge 2026 (Nov 14–15, 2026), registered at the Singapore local event.
- **Challenge:** *Field Shift: Adapting Farms with NASA Data*
- **Product:** a no-login web app where a farmer or agronomist watches crop fields in **northern Kazakhstan**, scrubs back through time, gets stress alerts on the fields they saved, and compares three crop-rotation strategies with evidence, data gaps and local-review risks.
- **Status:** ideation. Section 9 lists what is still undecided. Do not scaffold code until those are settled.

## 2. Git conventions
- Conventional commits (`feat:`, `fix:`, `docs:`, `chore:` …), one feature per commit; short-lived feature branches merged locally are fine.
- Commits are authored by the user only. **No `Co-Authored-By: Claude` line, no "Generated with" footer.**
- Never push. The user pushes.

## 3. Judging rubric (every feature must serve one of these)
1. **Earth observation analysis:** vegetation stress/decay, bare-soil windows, temperature and heat stress, rainfall, soil moisture, frost risk, from NASA and partner data.
2. **Farmer priorities and local context:** crop characteristics, water demand, nitrogen fixing, erosion, organic matter, pest-cycle interruption, market suitability.
3. **At least three rotation strategies compared:** baseline, climate/water-resilient shift, soil-restoring shift.
4. **Transparent trade-offs for each strategy:** why suggested, quantitative evidence from the selected field, expected benefits, information gaps (what satellites cannot see), risks needing local farmer or agronomist review. The tool is decision support, never a replacement for human judgment.

The rotation comparison (3 and 4) is what the brief scores. The map, time slider and alerts are the way in, not the deliverable.

## 4. Target region: northern Kazakhstan grain belt
- **Where:** Kostanay, Akmola and North Kazakhstan regions (roughly 51–55°N, 61–72°E), the rainfed spring-wheat belt that grows most of the country's wheat.
- **Why it fits the challenge:**
  - Fields are huge (often hundreds of hectares), so 10–30 m satellite pixels give clean per-field statistics.
  - The standard rotation is spring wheat for several years then a **bare summer fallow**: that is literally a bare-soil window with a known wind-erosion problem.
  - Rainfed and drought-prone: 2021 was a severe drought year (NASA POWER shows 40 °C at Kostanay on 2 July 2021), 2024 was a very good year. That contrast is the demo.
  - Diversifying wheat monoculture into oilseeds and pulses is a real, current debate there, so the three strategies are not invented.
- **Season:** sowing mid-May, harvest late August to September. Snow cover roughly November to April, so analyse **May–September only** and ignore winter scenes.
- **Demo presets:** 3 fields, one per region, picked by eye from imagery during the first spike (candidate areas: Karabalyk/Fyodorov districts in Kostanay, Shortandy in Akmola, around Petropavl in North Kazakhstan). Drawing a field anywhere else in the world still works; only the crop catalogue is tuned for this region.
- **Rotation strategies for this region (starting point, to be checked against sources):**
  1. *Baseline:* spring wheat – spring wheat – spring wheat – summer fallow.
  2. *Climate/water-resilient:* swap part of the wheat for flax, sunflower, barley or millet; shifted sowing dates; stubble retention to trap snow.
  3. *Soil-restoring:* replace bare fallow with lentils, field peas, chickpea or a sweet-clover green manure.
- **Honest trade-off to surface:** a pulse or cover crop uses soil water that bare fallow would have stored for the next wheat crop. This is the main "needs local review" risk.

## 5. Product scope
- **No login, no database.** Saved regions live in the browser's `localStorage`. The backend caches computed results as JSON files on disk.
- **Map:** world map, focused on Kazakhstan at start.
- **Time slider:** switches the date of the NASA imagery layers (true colour and 16-day NDVI) for regional context. At field zoom, Sentinel-2 NDVI for the selected date.
- **Saved regions:** user draws a polygon, names it, declares its current rotation (satellites cannot tell which crop is planted). Area capped (about 5,000 ha) so reads stay small.
- **Alerts:** only for saved regions, computed when the app loads. No background jobs, no notifications. Deterministic rules:
  - NDVI well below the field's own multi-year median for the same part of the season.
  - NDMI drop (water stress).
  - Bare soil (mean NDVI < 0.22) between May and September.
- **Diagnosis:** pair the vegetation signal with NASA POWER rainfall deficit, heat days, frost days and root-zone soil wetness to say whether stress looks like water/heat or something else.
- **Three strategy cards** with evidence, benefits, gaps, local-review risks. Rule-based templates and a hand-written crop catalogue (about 10 crops, one JSON file). LLM prose is optional polish, added last.
- **Because the event runs in November, live "current" alerts will be quiet (snow).** The demo story is the slider: 2021 drought versus 2024.

## 6. Tech stack
- **Backend (`/backend`):** Python 3.11+, FastAPI, Uvicorn, Pydantic v2, `httpx`, `numpy`, `xarray`, `pystac-client`, `planetary-computer`, `odc-stac`.
- **Frontend (`/frontend`):** React, TypeScript, Vite, Tailwind CSS, Leaflet (`react-leaflet`) with Leaflet-Geoman for drawing, Recharts, Lucide.
- **Deploy (later):** one Dockerfile, FastAPI serves the built frontend and `/api/*`, on Google Cloud Run.
- **Deliberately dropped from the first draft:** Meteomatics (needs credentials, NASA POWER covers it), direct SMAP/ECOSTRESS/GPM downloads (need Earthdata login and heavy files; POWER soil wetness and the NASA imagery layers cover it), MapLibre (needs a keyed tile provider), docker-compose, a custom domain, user accounts.

## 7. Data sources (all verified reachable without a key on 2026-11-14)
| Purpose | Source | Notes |
| --- | --- | --- |
| Global time-slider imagery | NASA GIBS WMTS: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/{layer}/default/{YYYY-MM-DD}/{matrixSet}/{z}/{y}/{x}.{ext}` | `MODIS_Terra_CorrectedReflectance_TrueColor` (jpg) and `MODIS_Terra_L3_NDVI_16Day` (png, from 2000), both `GoogleMapsCompatible_Level9`. `MODIS_Terra_NDVI_8Day` only covers the current year. SMAP soil-moisture layers also exist. Layer list: `.../best/1.0.0/WMTSCapabilities.xml`. |
| Field statistics | Planetary Computer STAC `https://planetarycomputer.microsoft.com/api/stac/v1`, collection `sentinel-2-l2a` (2015+), `landsat-c2-l2` for older history | Sign with `planetary_computer.sign_inplace`. `eo:cloud_cover < 20`, mask with `SCL`. Also available: `hls2-l30`, `hls2-s30` (NASA Harmonized Landsat Sentinel), `modis-13Q1-061`, `nasadem`. |
| Field NDVI overlay tiles | Planetary Computer data API: `/api/data/v1/item/tiles/WebMercatorQuad/{z}/{x}/{y}@1x?collection=sentinel-2-l2a&item={id}&expression=(B08-B04)/(B08+B04)&asset_as_band=true&rescale=0,1&colormap_name=rdylgn` | Renders coloured tiles for us, so the backend never produces images. |
| Climate | NASA POWER `https://power.larc.nasa.gov/api/temporal/daily/point`, `community=AG` | `T2M`, `T2M_MAX`, `T2M_MIN`, `PRECTOTCORR`, `GWETROOT`, `GWETTOP`, `ALLSKY_SFC_SW_DWN`. Grid is about 50 km: regional context, not field level. Say so in the UI. |

Indices (Sentinel-2 bands): NDVI `(B08-B04)/(B08+B04)`, NDRE `(B08-B05)/(B08+B05)`, NDMI `(B08-B11)/(B08+B11)`.

## 8. Engineering guardrails
- Never download full scenes. Clip to the polygon's bounding box with `odc-stac`, read at 20 m or coarser (fields here are large).
- A multi-year series for a freshly drawn field takes tens of seconds, not three. Show progress, cache the result, and keep the 3 presets precomputed in `backend/app/data/presets/` so the demo is instant and survives upstream throttling.
- The diagnosis and the three strategies must work with no LLM key.
- Vertical slice first: map polygon → real NDVI and POWER numbers → three cards. Everything else after.

## 9. Open decisions (settle before coding)
1. Confirm the northern grain belt as the target (alternative: irrigated cotton in Turkistan region, smaller fields and a salinity story satellites cannot see).
2. Confirm that monitoring is the entry point and the rotation comparison is the centrepiece.
3. LLM narrative: skip, or add at the end with Claude or Gemini.
4. Who is on the team and how much of the 48 hours is left.

## 10. Checklist: accounts, credentials, publishing
### Local development (nothing to request)
- [ ] Python 3.11+ and Node 20+ installed
- [ ] No API keys needed: NASA POWER, NASA GIBS, Planetary Computer and OpenStreetMap tiles are all keyless
- [ ] Optional: `ANTHROPIC_API_KEY` or `GEMINI_API_KEY` in `.env` (never committed) for narrative polish
- [ ] Optional: NASA Earthdata Login (free, `urs.earthdata.nasa.gov`), only if we later pull SMAP or HLS directly

### Space Apps submission (check exact rules on the team page)
- [ ] Team created on `spaceappschallenge.org` and this challenge selected
- [ ] GitHub repo public, with a LICENSE and a README
- [ ] Project page text, demo (short video or slide deck) and final submission before the Sunday deadline
- [ ] Declare AI use (this project is built with Claude Code) as the rules require
- [ ] Credit data sources: NASA POWER, NASA GIBS/MODIS, Landsat (NASA/USGS), "contains modified Copernicus Sentinel data", Microsoft Planetary Computer, OpenStreetMap contributors

### Going online (when the local app works)
- [ ] Google Cloud account with billing and the free credit activated
- [ ] `gcloud` CLI installed and logged in; a project created; Cloud Run, Cloud Build and Artifact Registry APIs enabled
- [ ] `Dockerfile` (build frontend, serve it from FastAPI), preset JSON baked into the image
- [ ] `gcloud run deploy --source .` with secrets passed as env vars, min instances 1 during judging to avoid cold starts
- [ ] Use the `*.run.app` HTTPS URL. A custom domain is optional and only worth it if time is left
- [ ] Smoke test from a phone: presets load instantly, drawing a new field works, alerts and cards render

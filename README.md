# Field Shift

**Which rotation survives the next drought?** A decision-support web app for the NASA Space Apps Challenge 2026, challenge *Field Shift: Adapting Farms with NASA Data*. Team **pironc**, Singapore local event.

Field Shift looks at a crop field in the northern Kazakhstan grain belt the way NASA's satellites have seen it since 2000, sets each season against the field's own normal and against the regional weather record, and compares three crop-rotation options: the current rotation, a climate and water-resilient shift, and a soil-restoring shift. Every option lists why it is suggested, the evidence behind it, what satellites cannot see, and what a local farmer or agronomist has to check. It supports a decision. It does not make one.

## What it does

- **Map.** Pick what the map shows: NASA vegetation (MODIS NDVI), true colour, soil moisture (SMAP) or rainfall (GPM IMERG), with a time slider back to 2001 and a yearly Sentinel-2 mosaic underneath. Zoomed in on a field, the whole view shows Sentinel-2 as it was on each clear pass, fading from one pass to the next as the days go by.
- **Fields.** Three demo fields traced on satellite imagery, one per region. Draw your own field to analyse it live (needs the analysis service running).
- **Strategies.** Three rotation options scored from a crop catalogue against the field's stress profile. Sliders for the farmer's priorities (save water, build soil, income now) and a "drier and hotter" what-if change the ranking in the browser.
- **Seasons.** Greenness through each season since 2018 (Sentinel-2) against the field's own normal, with findings such as a peak well below normal or bare soil in mid-season, and the NASA MODIS record since 2000.
- **Climate.** Each season's rain, heat, frost and moisture supply from NASA POWER against the 1991 to 2020 normal, and what the regional weather suggests about a poor season.
- **About the data.** A glossary, how satellite data differs from ground measurements, and a statement of uncertainty.

## How it works

```
Field outline ──► Planetary Computer statistics (one call per satellite pass)
                    • NASA MODIS MOD13Q1, 250 m, 2000 onward  ─► long record
                    • ESA Sentinel-2 L2A, 20 m, 2018 onward    ─► field detail
               ──► NASA POWER daily weather for the grid cell, 1981 onward
               ──► fixed, readable rules (Python) ─► findings per season
               ──► rotation scoring (TypeScript, in the browser) ─► three options
```

No machine-learning model and no language model runs in the app. Every number is computed by rules that can be read in `backend/app/` and `frontend/src/lib/rotation.ts`, with every threshold in `backend/app/constants.py`.

Demo fields are precomputed into static files (`frontend/public/presets/`), so they load instantly and work without the analysis service.

## Run it

Requirements: Node 20.19+ or 22.12+, Python 3.11+, [uv](https://docs.astral.sh/uv/).

```bash
# analysis service
cd backend
uv sync
uv run python tests/selfcheck.py          # no network needed
uv run uvicorn app.main:app --port 8000

# app (second terminal)
cd frontend
npm install
npm run dev                               # http://localhost:5173, /api is proxied to port 8000
```

One container for both: `docker build -t fieldshift . && docker run -p 8088:8080 fieldshift`.

Rebuild the demo fields from live data: `cd backend && uv run python scripts/build_presets.py`.

No API keys are needed for anything.

## What it cannot know

- Satellites see how green a field is, not which crop was sown, its yield, the soil's chemistry or the water stored at depth. A fallow year and a failed crop can look alike, so the app asks.
- Weather comes from a modelled grid of about 50 km. Every field in a cell gets the same numbers; a local storm or a frost pocket is invisible.
- Thresholds are indicative and have not been checked against yields or ground data.
- The crop catalogue and the scoring weights are the authors' judgement from published sources. No local agronomist has reviewed them yet.
- The app makes no claim about a climate trend: the NASA POWER record for these cells shows none that is statistically clear.

## Data and credits

- **NASA POWER.** The data was obtained from National Aeronautics and Space Administration (NASA) Langley Research Center's Prediction Of Worldwide Energy Resources (POWER) project funded through the NASA Earth Science Division. The data was obtained from the POWER Project's Daily 2.10.3 version in November 2026.
- **NASA GIBS and MODIS.** We acknowledge the use of imagery provided by services from NASA's Global Imagery Browse Services (GIBS), part of NASA's Earth Science Data and Information System (ESDIS). Layers: MODIS Terra corrected reflectance and 16-day NDVI, SMAP L4 root-zone soil moisture, GPM IMERG precipitation rate. Field statistics use the MODIS MOD13Q1 v6.1 vegetation index product.
- **Sentinel-2.** Contains modified Copernicus Sentinel data 2018-2026.
- **Satellite mosaic.** EOxCloudless https://cloudless.eox.at by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2017-2025), CC BY-NC-SA 4.0.
- **Base map.** OpenFreeMap © OpenMapTiles, data from OpenStreetMap contributors.
- **Soil.** ISRIC SoilGrids 2.0 (modelled, 250 m), CC BY 4.0.
- MODIS and Sentinel-2 are read through the Microsoft Planetary Computer.
- Agronomy sources (FAO, USDA, the A.I. Barayev Research and Production Centre for Grain Farming and others) are listed per row in `frontend/src/data/crop-catalogue.ts` and in `docs/research/kazakhstan-agronomy/`.

This project is not affiliated with or endorsed by NASA.

## Open-source software used

Frontend: React, Vite, TypeScript, Tailwind CSS, shadcn/ui (Radix UI), mapcn, MapLibre GL JS, Terra Draw, Turf, Recharts, Lucide, Sonner, Vaul, cmdk, Geist typeface. Backend: FastAPI, Uvicorn, HTTPX, NumPy. Exact versions are in `frontend/package.json` and `backend/pyproject.toml`; each package carries its own licence (MIT, BSD, Apache 2.0, ISC or OFL).

## Use of AI tools

- The team chose the challenge, the region and the product direction, and made the design decisions.
- The code, the research notes in `docs/research/` and the plan review were written with an AI coding assistant (Claude Code, Anthropic) under the team's direction. The notes mark what was verified by running it and what is unverified recall.
- No AI model runs inside the app. All findings and rotation scores come from fixed rules.
- No AI-generated images, video or audio are used.

## Repository

- `frontend/`: the web app.
- `backend/`: the analysis service and the preset builder.
- `docs/research/`: design research, reference prototypes and the independent plan review.
- `docs/deck-outline.md`: outline of the demo deck.
- `CLAUDE.md`: the working brief.

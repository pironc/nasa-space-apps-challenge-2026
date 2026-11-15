# CLAUDE.md — NASA Space Apps Challenge 2026: Field Shift

## 1. Identity and status
- **Repo:** `https://github.com/pironc/nasa-space-apps-challenge-2026.git`
- **Event:** NASA Space Apps Challenge 2026, **Universal Event** (online; the team moved from the Singapore event on 14 Nov). Deadline per the event page, read on 14 Nov: "November 15 at 11:59 PM local time, according to the team's creator". The creator's clock is this machine's (UTC+5), so plan for **Sunday 15 Nov 23:59 on this machine** and confirm the time shown on the team page. Saving the project page after the deadline voids eligibility.
- **Challenge:** *Field Shift: Adapting Farms with NASA Data*. Official text: `docs/research/space-apps-rules/field_shift_official.md`.
- **Product:** a no-login web app where a farmer or agronomist watches crop fields in the northern Kazakhstan grain belt on a map, scrubs back through time, gets stress alerts on the fields they saved, and compares three crop-rotation strategies with evidence, data gaps and local-review risks.
- **Status (14 Nov, evening):** the app works end to end. Three demo fields are precomputed from live data, the analysis API analyses a drawn field in 20 to 45 s, and one container serves everything (`docker build -t fieldshift .`). Not done: deployment, the deck, a real-phone check. Research and the independent plan review are in `docs/research/`. Where the notes in sections 8 and 9 and the code disagree, **the code and `backend/app/constants.py` are current**; the review in `docs/research/plan-review/README.md` explains why the rules changed.
- **Checks:** `cd backend && uv run python tests/selfcheck.py`; `cd frontend && npm run build && node scripts/check-rotation.ts && npm run check:data`. Rebuild demo fields with `cd backend && uv run python scripts/build_presets.py`. The map shows the clear Sentinel-2 passes of the selected field over the whole view, as live Planetary Computer tiles faded day by day; `frontend/public/sw.js` caches them.

## 2. Working rules
- **Git:** conventional commits (`feat:`, `fix:`, `docs:`, `chore:`), one feature per commit; short-lived feature branches merged locally are fine. Commits are authored by the user only: **no `Co-Authored-By: Claude`, no "Generated with" footer.** Never push; the user pushes.
- **Libraries before custom code**, for behaviour and for design. Reach for a shadcn component, a registry item or an existing package first; write our own only for the gap that is left.
- **Read the matching note in `docs/research/` before building a part.** The prototypes there ran against live data on 2026-11-14 and are the reference implementations; they are throwaway code, not app code.
- Never put a NASA logo or mission insignia in the app, deck or video (Space Apps rule).

## 3. What the judges score
Five criteria, each 1 to 5, at every judging level: **Impact, Creativity, Validity, Relevance, Presentation.**
- **Relevance** asks that the project addresses the challenge and uses NASA data as "a core component rather than a superficial addition". At least one NASA dataset is required for Global Award eligibility. So NASA products carry the analysis (MODIS for the long baseline, NASA POWER for climate, GIBS layers on the map); ESA Sentinel-2 is the partner complement for field detail.
- **Validity** is why every number is computed by transparent rules, thresholds are labelled indicative, and the app says what it cannot know.
- **Presentation:** the demo is a slide deck of **7 slides or fewer** (title and intro count) **or a video of 30 seconds or less**, in English, showing team name, members and the challenge. Going over makes the project ineligible for Global Judging.

The challenge's objectives are all worded "may". The ones this project takes on:
1. Earth-observation analysis: vegetation stress, bare-soil windows, heat, rainfall, soil moisture, frost, water balance.
2. Farmer priorities and local context: declared rotation, crop characteristics, water use, nitrogen fixing, erosion, pest-cycle interruption, market suitability.
3. At least three rotation strategies including the existing one. "Climate/water-resilient" and "soil-restoring" are our own labels, not official wording.
4. For each strategy: why suggested, evidence, benefits, information gaps, risks needing local review. The tool supports a decision and never replaces farmer judgment.
5. Cheap extras the official text names and judges may look for: a glossary of terms (NDVI and so on), a note on how satellite data differs from ground measurements, a statement of model uncertainty, farmer-entered priorities.

## 4. Target region: northern Kazakhstan grain belt
- **Where:** Akmola, Kostanay and North Kazakhstan regions, about 79% of the national wheat area in 2024.
- **Why it fits:** very large rainfed fields; spring wheat dominates (much of North Kazakhstan is continuous wheat); bare summer fallow still covers 8 to 14% of arable land; drought years are frequent; replacing fallow and diversifying wheat is a live local debate with trial data from the Barayev centre at Shortandy.
- **Calendar:** sowing 14 to 27 May, fields only green from early June, NDVI peak 10 June to 28 July, harvest late August to early October, snow mid-October to late April. Analyse 1 May to 30 September; May scenes are bare seedbed and must never count as "bare soil" stress.
- **Demo years:** 2021 (drought: 94 mm of May-August rain at Kostanay against a median of 177, 45 days above 30 °C, NASA POWER peak 40.4 °C on 2 July) against 2024 (283 mm, 5 hot days). 2023 was as bad as 2021 nationally and worse in Akmola. 2024 also had a wet harvest.
- **Preset fields:** one per region, inside these cropland blocks (cropland share checked; individual field outlines still have to be drawn along real boundaries and their curves inspected, because a fallow year looks like a drought year):
  - Kostanay, north Fyodorov district, 53.80 N 62.75 E (2021 against 2024)
  - Akmola, west of Shortandy, 51.72 N 70.75 E (2023 against 2024)
  - North Kazakhstan, Tayinsha district, 53.90 N 69.60 E
- **Baseline rotation is whatever the user declares.** Offer two presets: "fallow, wheat, wheat, barley" and "continuous wheat".
- **Honest trade-off, now quantified:** wheat after lentil or mustard yields about 12% less than after fallow, after oats about 6% less, after pea 18 to 25% less. Oats is the best-documented local fallow replacement.

## 5. Build order (reshaped after an independent review on 14 Nov)
The first plan was horizontal (UI, then data, then analysis, then strategies, then presets, then deploy) and about three times the time available. The order is now vertical: one demo field carried end to end, then widened.

1. **Done: UI shell and map.** Toggleable NASA layers with opacity and legends, time slider, draw and save a field.
2. **One preset field end to end (Kostanay).** Python pipeline writes the analysis as static JSON under `frontend/public/presets/`; the app opens on that field, at a July date of its stressed year, on the Strategies tab. Presets need no backend, so the app can also be hosted as static files.
3. **Panel:** Strategies (default tab: farmer priorities, a "drier and hotter" what-if, three cards, comparison table), Seasons (NDVI against the field's normal, season verdicts, NASA MODIS record since 2000), Climate (NASA POWER season against normal, causes), and an "About the data" dialog (glossary, satellite versus ground, uncertainty, credits).
4. **Deploy early**, submit early, then: second and third preset, live analysis of a drawn field through the API, phone polish.

Contract between the two halves: `frontend/src/lib/analysis.ts`. Rotation scoring runs in the browser (`frontend/src/lib/rotation.ts`) so the cards respond to the farmer's priorities.

Product framing: this is rotation decision support. Season findings are called **verdicts**, never alerts or notifications (there is no login, so nobody could be notified).

**Cut for this weekend:** LLM narrative, Russian and Kazakh, field chat, Cloud Storage mount, incremental refresh, per-year land-use override UI, live Sentinel-2 overlay tiles, sowing-date editor, three of the six verdict types (patchy, no green-up, abrupt drop), second rainfall source, HLS, dark mode.
**Cut by the clock, last to go first:** polish pass, phone check, drawn-field live analysis, third preset, second preset.
**Never cut:** one preset, three verdicts, three cards with gaps and local-review lists, deploy, deck, README credits.

Deck outline: `docs/deck-outline.md`. Numbers on slides come from the app's own output for the demo field, never from the research notes (those were measured at a different grid cell).

## 6. Tech stack
### Frontend (`/frontend`)
React 19, TypeScript, Vite 8, Tailwind 4, shadcn/ui (Radix base, Nova preset), MapLibre GL JS 6 through the **mapcn** registry component, **terra-draw** for drawing, `@turf/area` for hectares, Recharts through the shadcn `chart` component, lucide icons. Needs Node `^20.19` or `>=22.12`.

```bash
npx shadcn@4.23.0 init -t vite -b radix -p nova -n frontend --no-monorepo --no-rtl --pointer -y
rm -rf frontend/.git            # the CLI creates its own repository and commit inside the folder
cd frontend
npx shadcn@4.23.0 add sidebar switch slider toggle toggle-group badge tabs chart card table sonner dialog alert-dialog sheet drawer skeleton command tooltip popover scroll-area separator collapsible select label input empty spinner alert -y
npx shadcn@4.23.0 add @mapcn/map -y          # installs maplibre-gl@^6
npm i terra-draw@1.39.0 terra-draw-maplibre-gl-adapter@1.5.0 @turf/area@7.4.0
```
Map notes (details and working snippets in `docs/research/map-stack/`):
- Basemap: OpenFreeMap (`https://tiles.openfreemap.org/styles/positron`), keyless. Always pass `styles` to mapcn: its default is CARTO, which now demands a key. Use one fixed theme for the map; swapping styles tears down custom layers and the drawing tool.
- Satellite basemap: EOX Sentinel-2 cloudless, one mosaic per year 2017 to 2025, keyless, non-commercial licence.
- Load the MapLibre worker from the bundle (first import in `main.tsx`), not from unpkg.
- Raster layers: `tileSize: 256` on every source; change the date with `source.setTiles([url])` (no blank frame); `visibility: none` stops loading, `raster-opacity: 0` preloads. Call `map.resize()` when the sidebar or panel changes size.
- Layer panel and time slider are built from shadcn `Switch`, `Slider`, `ToggleGroup` and `Button` over one layer config array. The slider steps through a generated list of valid dates and changes tiles on release, not during the drag.
- terra-draw is headless: the toolbar is three shadcn buttons. Cap drawn fields at 5,000 ha.

### Backend (`/backend`)
Python 3.11+, FastAPI, Uvicorn (one worker), Pydantic v2, `httpx`, `numpy`. Later, only if the narrative is built: `anthropic`, `slowapi`.
**Not needed:** `pystac-client`, `planetary-computer`, `odc-stac`, `xarray`, `rasterio`. The hosted statistics endpoint replaces local raster reads (same values within 0.003, four times faster, 2 MB of dependencies instead of 224 MB).

### Deploy
One Dockerfile; FastAPI serves the built frontend and `/api/*`; Google Cloud Run, one instance.

### Dropped
Leaflet (blanks the layer on every date change), Meteomatics (the offer ends with the hackathon), direct SMAP/ECOSTRESS/GPM downloads, docker-compose, custom domain, user accounts, a database server.

## 7. UI rules
- **No movement on press.** Clicking a button or control must never scale, shrink, translate or otherwise transform it; the pressed state is a colour change only. shadcn's generated Button contains `active:not-aria-[haspopup]:translate-y-px` and `transition-all`: delete the first, replace the second with `transition-colors active:transition-none`, and give each variant an `active:` and `aria-pressed:` colour (fixed file: `docs/research/ui-design/button.tsx`). Add the `check:press` grep script from `docs/research/ui-design/README.md` to the build. Never run `shadcn add --overwrite` afterwards.
- **Installed design skills that contradict this rule:** `emil-design-eng`, `animate` and `review-animations` prescribe `scale(0.97)` on press, `hallmark` a 1px drop. This rule wins. Do not use those for the app.
- **Design skills to use:** `impeccable` (dashboard / Operate mode) for the shell, `dataviz` before the first chart, `break-ui` once the first slice works, `impeccable` again for the phone pass and polish.
- **Colour:** neutral chrome with one blue accent. Red, orange, yellow and green are reserved for the NDVI ramp and alert status, always paired with an icon and a label. Never invert map tiles in dark mode.
- **Layout:** map first. Left sidebar: layers, then saved fields with alert badges. Time slider floating at the bottom of the map. Right panel: the selected field's analysis in tabs (Overview, Climate, Strategies), widening for the three strategy cards. On a phone: full-screen map, sidebar as a sheet, analysis as a bottom drawer. Selection, date and tab live in the URL query string.

## 8. Data sources (all keyless, live-checked 2026-11-14)
### Map layers: NASA GIBS
`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/{layer}/default/{YYYY-MM-DD}/{matrixSet}/{z}/{y}/{x}.{ext}`

| Layer | Matrix set | Notes |
| --- | --- | --- |
| `MODIS_Terra_CorrectedReflectance_TrueColor` (jpg) | `GoogleMapsCompatible_Level9` | daily |
| `MODIS_Terra_L3_NDVI_16Day` (png) | `GoogleMapsCompatible_Level9` | from 2000; dates snap to 16-day periods that restart each 1 January |
| `SMAP_L4_Analyzed_Root_Zone_Soil_Moisture` (png) | `GoogleMapsCompatible_Level6` | soil moisture |
| `IMERG_Precipitation_Rate` (png) | `GoogleMapsCompatible_Level6` | rainfall |

Requests beyond a layer's native zoom return HTTP 400, so set `maxzoom` on the source. Dated tiles are served `no-store`. Legends: `https://gibs.earthdata.nasa.gov/legends/`.

### Field statistics: Planetary Computer, no key, no signing
1. STAC search `POST https://planetarycomputer.microsoft.com/api/stac/v1/search` for `sentinel-2-l2a` items over the field, **without** a tile-level cloud filter (it discards 28% of the scenes that are clear over the field).
2. One call per scene: `POST https://planetarycomputer.microsoft.com/api/data/v1/item/statistics?collection=sentinel-2-l2a&item={id}&asset_as_band=true&max_size=512&histogram_bins=400&histogram_range=-1,1&expression={E}` with the field as a GeoJSON Feature body. Expressions joined with `;`, mask `C = (SCL==4)|(SCL==5)`, masked pixels filled with -9 so they fall outside the histogram. The field value is the **median** of clear pixels read from the histogram (the endpoint's own median includes masked pixels; a masked mean flipped 4 of 27 field-seasons). The clear fraction is scaled by valid pixels, not by `valid_percent`, which is the polygon's share of its bounding box. Implementation: `backend/app/series.py`.
3. **Offset trap.** Items with `s2:processing_baseline >= 04.00` (everything from 2022) carry a +1000 offset on every band. Subtract it, keyed on the baseline and never on the date: NDVI becomes `(B08-B04)/(B08+B04-2000)`. Uncorrected, a 2024 scene reads NDVI 0.38 instead of 0.62 and the 2021-against-2024 story inverts. The same correction applies to the overlay tile expression.
4. 2022 and 2023 hold two copies of each acquisition: keep the highest baseline. Accept a scene when at least 75% of the field is clear. Treat HTTP 500 on a single item as "skip"; retry 429, 502 and timeouts.
5. Usable Sentinel-2 seasons start in **2018**. Measured on the demo fields, which sit under two orbits (about 550 scenes for nine seasons): 20 to 45 s for a new field. Use one global concurrency limit across users.
6. Long baseline (NASA): `modis-13Q1-061` through the same endpoint with `assets=250m_16_days_NDVI&assets=250m_16_days_pixel_reliability` (no expressions; scale by 0.0001 yourself; filter ids starting `MOD13Q1`; no data on Planetary Computer between 2025-06-26 and 2025-11-17). MODIS reads about 0.11 higher than Sentinel-2: compare each sensor only with itself. Hide the MODIS baseline for fields under about 100 ha.
7. Field overlay tiles: `/api/data/v1/item/tiles/WebMercatorQuad/{z}/{x}/{y}@1x.png` with the same expression; build the query with `URLSearchParams` because a raw `+` returns HTTP 400; pass the item bbox as source bounds; about 2 s per tile, so one item at field zoom only.

Indices: NDVI `(B08-B04)/(B08+B04)`, NDMI `(B08-B11)/(B08+B11)`, NBR2 `(B11-B12)/(B11+B12)` (tells tilled fallow from stubble).

### Climate: NASA POWER
`https://power.larc.nasa.gov/api/temporal/daily/point`, `community=AG`, parameters `T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,GWETROOT,GWETTOP,EVLAND`, from 1981, default time standard. Grid is 0.5 x 0.625 degrees (about 55 x 42 km at 53 N): every field in a cell gets identical weather, so request the cell centre and cache one file per cell (about 5 MB, 4 s). There is no reference-evapotranspiration parameter: compute it with Hargreaves. Say in the UI that climate is regional context, not field level.

## 9. Analysis (all deterministic)
Specs with formulas, thresholds and back-tests: `docs/research/vegetation-analysis/`, `docs/research/climate-attribution/`, `docs/research/kazakhstan-agronomy/`. Keep every threshold in one constants file and label severities as indicative: they were tuned on a handful of squares with no ground truth.
- **Series:** 15 ten-day bins from 1 May to 30 September, despiked, short gaps filled, no smoothing.
- **Land use per year** inferred from the curve (fallow, cropped, ambiguous, unknown); the user's declaration always overrides, and the app asks only about years it cannot classify.
- **Season findings (called verdicts, never alerts):** vegetation deficit (peak between 1 June and 20 August against the median peak of the field's other cropped seasons; the season total can only cancel a finding, never raise one, so a different crop or a late sowing is a note, not a deficit) and bare soil in mid-season (three ten-day bins under NDVI 0.25 inside 21 June to 10 August with tilled-soil signature; to 31 August and information-only in a fallow year). A season whose peak was hidden by cloud gets "no judgement". A low year the curve cannot classify gets one question (failed crop or fallow?) and no severity. Declared land use always wins over the inferred label.
- **Climate:** a dry flag is the driest 40-day window after sowing at 40% of normal or less; a heat flag is the count of days at 30 °C or more in the 90 days after sowing at the cell's 90th percentile or above. Each is tested for sowing on 10, 20 and 30 May and called robust only if all three agree. A season is a drought only by the cell's own record (hydrothermal coefficient at or below its 20th percentile). The link between weather and a field's greenness is stated in three fixed, cautious sentences (`backend/app/analyse.py`); the app never says weather caused a loss on a field.
- **No trend claims.** NASA POWER shows no significant drying or warming trend in the growing season here. Show year-to-year variability and drought frequency per decade instead.
- **Rotation strategies:** a stress profile (water, heat, frost, bare) plus the crop catalogue (`docs/research/kazakhstan-agronomy/crop_catalogue.draft.json`, 12 crops with a source per row and judgement cells marked) scores candidate four-year templates on productivity, soil, pest break, climate fit and market. The catalogue ranks and weights are unreviewed judgement: say so on the cards and date-stamp market statements.
- **Every card lists** what satellites cannot see (crop sown, salinity, pH, phosphorus, herbicide history, water stored at depth, prices) and what needs local review (water left for the next wheat, herbicide carry-over, seed and buyer access, machinery, lease and subsidy rules).

## 10. Storage and history
- **Keep history of our own derived numbers, never of imagery.** NASA and ESA keep the imagery online; what is expensive is reading it. Per field: about 800 small rows (date, scene id, baseline, clear fraction, indices), 94 KB. Each refresh asks only for scenes newer than the last stored date.
- **Format:** plain JSON files under `$DATA_DIR` written atomically: one per field (keyed by a hash of the normalised polygon and the rules version `constants.RULES`; raise it whenever a rule changes) and one per climate cell. Demo fields are built by `backend/scripts/build_presets.py` from `backend/presets.geojson` into `frontend/public/presets/` and served as static files.
- **Saved regions stay in the browser** (`localStorage`: id, name, declared rotation, geometry). The server stores geometry and numbers only, never names. Losing the server's disk loses nothing a user owns.
- **Refresh when a field is opened** (skip if refreshed under 12 hours ago; climate under 24 hours). No scheduled job: without login there is nobody to notify. "New since last visit" is a date kept in the browser.
- **Online:** Cloud Run's disk is memory and resets on redeploy. Presets ship in the image; user-drawn fields rebuild on next open. A Cloud Storage volume mount for `$DATA_DIR` is the later, optional durable step (whole-file JSON writes are safe there).
- **Abuse limits on a public URL:** reject non-polygons, holes, more than 200 vertices or more than 5,000 ha; cap first-time builds running at once.

## 11. LLM role
- **The analysis is algorithms.** Indices, anomaly detection, cause attribution and rotation scoring are arithmetic and fixed rules, reproducible and showable on screen. Published tests show language models are weak at exactly these jobs.
- **An LLM writes words, not numbers:** the plain-language narrative of the three cards from a list of precomputed facts, each sentence citing fact ids; a checker discards the text if it contains a number that is not in the cited facts; the rule-based template text is shown first and stays if anything fails. Then Russian, then Kazakh labelled "machine translated, not reviewed". Reference: `docs/research/llm-role/proto_cards.py`.
- Everything must work with no key. Test for the key explicitly. The key lives only in the backend environment, never in a `VITE_` variable, in a dedicated workspace with a spend limit.
- Preset narratives are generated once, read by a human and committed, so the judged demo never depends on a live model call.
- Label LLM text in the UI ("AI-written summary") and tag it in the API response.

## 12. Decisions
Settled with the user on 2026-11-14:
- **AI acknowledgement:** a "Use of AI tools" section in the README, a note in the `package.json` and `pyproject.toml` descriptions, a label on LLM text in the UI, and the "Use of Super Intelligence (SI)" field on the project page. Commits stay free of AI attribution.
- **Team:** "pironc", Singapore virtual event, confirmed participant.

Still open:
- **LLM key.** Needed only for the phase 5 narrative. Without an Anthropic API key the app ships with rule-based text only.
- **Scope of the no-movement rule.** Assumed: press feedback only. Dialog and popover open animations and the sliding switch thumb stay unless told otherwise.

## 13. Checklist
### Local development (nothing to request)
- [x] Node 23.11, Python 3.11 and 3.12, uv and Docker are installed on this machine
- [x] No API keys needed: NASA POWER, NASA GIBS, Planetary Computer, OpenFreeMap and EOX are keyless
- [ ] Optional: `ANTHROPIC_API_KEY` in `backend/.env` (never committed)

### Space Apps submission
- [ ] Confirmed participant, team created, challenge selected
- [ ] Project page fields: Project Name, High-Level Summary, Link to Project Demo, Link to Final Project, Detailed Description, Use of Super Intelligence (SI), NASA Data, Space Agency Partner Data and Other References
- [ ] Demo: 7 slides or fewer, or a video of 30 seconds or less; public link without login
- [ ] Repo public with an OSI licence (otherwise NASA applies Apache 2.0) and a README
- [ ] List every dataset, library, text and image used; teams that do not cite can lose a nomination
- [ ] Credits, exact wording:
  - NASA POWER: "The data was obtained from National Aeronautics and Space Administration (NASA) Langley Research Center's Prediction Of Worldwide Energy Resources (POWER) project funded through the NASA Earth Science Division." plus "The data was obtained from the POWER Project's Daily 2.10.3 version on YYYY/MM/DD."
  - NASA GIBS and MODIS: "We acknowledge the use of imagery provided by services from NASA's Global Imagery Browse Services (GIBS), part of NASA's Earth Science Data and Information System (ESDIS)."
  - Sentinel-2: "Contains modified Copernicus Sentinel data 2018-2026"
  - EOX: "EOxCloudless https://cloudless.eox.at by EOX IT Services GmbH (Contains modified Copernicus Sentinel data <year>)"
  - OpenFreeMap © OpenMapTiles, data from OpenStreetMap; accessed through Microsoft Planetary Computer
- [ ] Submit early on Sunday, resubmit as the app improves, last save well before 23:59 Sunday local time (Universal Event rule: the team creator's local time)

### Going online
- [ ] Google Cloud account; the $300 trial is for new accounts only and does not pay for LLM API calls
- [ ] Install the `gcloud` CLI (not on this machine yet), log in, create a project, enable Cloud Run, Cloud Build and Artifact Registry
- [ ] `Dockerfile`: build the frontend, serve it from FastAPI, presets in the image
- [x] `Dockerfile` builds and runs locally (health, app, preset and a live analysis all answer)
- [ ] `gcloud run deploy fieldshift --source . --region europe-west4 --allow-unauthenticated --min-instances 1 --max-instances 1 --timeout 600 --memory 1Gi`
- [ ] Use the `*.run.app` URL; no custom domain (new domains can trip judges' web filters)
- [ ] Judging runs to 17 December (finalists) and 26 January 2027 (winners): keep the app and any LLM key alive that long, or rely on presets
- [ ] Smoke test from a phone: presets load instantly, drawing a field works, alerts and cards render
- [ ] Port 8080 on this machine is taken by another project's server; run local containers on another port

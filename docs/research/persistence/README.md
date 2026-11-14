# What to store and where

Research note from the design phase, 2026-11-14. Each finding is tagged: `verified-live` (a command was run), `source-read` (the cited source was read) or `memory` (unverified recall). Paths to scratch files that were not kept in the repo are historical.

## Recommendation

Yes, keep history, but store our own numbers rather than NASA's files: for each field and each satellite pass about ten statistics, plus the daily climate series for each NASA POWER grid cell. NASA and ESA keep the imagery online permanently, so the only thing worth saving is the expensive part, the reading; after the first build, opening a field only fetches passes that arrived since last time. Put this in one SQLite file using Python's built-in sqlite3 (no new dependency), treated as a cache that can always be rebuilt; this replaces "no database" in the brief. Keep saved regions in the browser's localStorage and let the server cache by a hash of the polygon, so losing the server's disk loses nothing a user owns and no user-typed text is ever stored server-side. To publish, ship the three presets as a seed database inside the image and run Cloud Run with exactly one instance; add a whole-file snapshot to a bucket only if time is left, and never open SQLite directly on a bucket mount. Refresh fields when the app is opened and compute alerts as of the slider date; skip the scheduled job this weekend, because without login there is nobody to notify. Separately, fix one correctness problem found on the way: Sentinel-2 scenes from 2022 onward carry a +1000 offset that lowers NDVI (0.21 instead of 0.32 on the test field) and would distort the 2021 versus 2024 comparison.

## Spec

**No report.md:** the harness refused that write ("Subagents should return findings as text"), so everything is in this output and `report_path` is omitted. Tested code (stdlib only, self-check passes on Python 3.9, 3.11, 3.12): `docs/research/persistence/scripts/store_sketch.py`. Hosted-statistics probe: same folder, `pc_stats_probe.py`.

### Store: `sqlite3` (stdlib), WAL, raw SQL, `$DATA_DIR/fieldshift.db`, one Uvicorn worker

| Persist | Never persist |
|---|---|
| per field+date index stats, `valid_frac`, scene ids, baseline, `algo` | pixels, map tiles |
| POWER daily rows per grid cell | signed URLs (45 min expiry; terms forbid sharing tokens) |
| field geometry by hash | full STAC JSON (~16 KB/scene) |
| LLM text by input hash | rule-based alerts and cards (recompute in ms) |

```sql
fields(id PK, geometry, area_ha, lat, lon, cell_id, is_preset, created_at, refreshed_at, last_seen_at)
observations(field_id, source, date, scene_ids, baseline, valid_frac, n_valid,
  ndvi_mean, ndvi_p10, ndvi_p50, ndvi_p90, ndre_mean, ndmi_mean, algo, fetched_at,
  PRIMARY KEY(field_id, source, date))
climate_cells(cell_id PK, lat, lon, fetched_at, sources, api_version)
climate_daily(cell_id, date, t2m, t2m_max, t2m_min, precip, gwetroot, gwettop, srad,
  PRIMARY KEY(cell_id, date))
analyses(field_id, kind, input_hash, created_at, result, PRIMARY KEY(field_id, kind, input_hash))
```
Store cloudy dates too (stats NULL, `valid_frac` 0) so they are never re-read. Measured: 4,336 climate days + 100 observations = 471 KB.

### Keys
- Field: outer ring, round to 5 decimals, drop closing point, force counter-clockwise, start at smallest vertex, `sha256(json)[:16]`. Reject non-Polygon, holes, fewer than 3 or more than 200 vertices, over 5,000 ha.
- Climate: `f"{round(lat/0.5)}_{round(lon/0.625)}"`; request the cell centre; default time standard only.

### Refresh
- Satellite: skip if `refreshed_at` under 12 h; `start = max(date) - 10 days` (first time `2017-05-01`); STAC metadata search; read only days containing an unseen scene id; `INSERT ... ON CONFLICT(field_id, source, date) DO UPDATE`, one transaction per day.
- Climate: skip if fetched under 24 h; one full-range request; `-999` to NULL; `DELETE` + `INSERT` the cell in one transaction. No tail patching, so provisional days heal themselves.
- `ALGO` constant; `DELETE FROM observations WHERE algo != ?` at startup.
- The slow step can be one hosted call per scene instead of local raster code: `POST https://planetarycomputer.microsoft.com/api/data/v1/item/statistics?collection=sentinel-2-l2a&item=ID&asset_as_band=true&max_size=256&expression=E1;E2;E3;MASK` with the field as a GeoJSON Feature body, where `Ei = where((SCL>=4)&(SCL<=6),(B08-B04)/(B08+B04-2*OFF),-9)`, `MASK = where((SCL>=4)&(SCL<=6),1,0)`, `OFF = 1000 if baseline >= "04.00" else 0`. Then `valid_frac = mean(MASK)` and `mean_clear = (mean + 9*(1-f))/f`.

### Saved regions
localStorage `{id, name, rotation, geometry}`. Presets from `GET /api/presets` so an empty browser is never empty. Optional later: share link `/?f=<id>`. Abuse controls: the validation above, cap about 300 non-preset fields (prune by `last_seen_at`), `threading.Semaphore(2)` on first builds then 429, `--max-instances 1`.

### Hosting
1. `seed.db` in the image; at boot copy to `$DATA_DIR` if absent.
2. Optional: bucket mount; boot prefers `/mnt/store/fieldshift.db`; after writes `con.backup()` to a temp file, then copy that single file.
```
gcloud run deploy fieldshift --source . --region europe-west4 --allow-unauthenticated \
  --min-instances 1 --max-instances 1 --timeout 600 --set-env-vars DATA_DIR=/tmp/data
gcloud run services update fieldshift --region europe-west4 \
  --add-volume name=store,type=cloud-storage,bucket=BUCKET \
  --add-volume-mount volume=store,mount-path=/mnt/store
```
Service account needs `roles/storage.objectUser`. Do refresh work inside the request. Ranked below these: JSON files on the mount, Firestore (`google-cloud-firestore` 2.34.1, second code path), e2-micro VM (own HTTPS), Cloud SQL. Not acceptable: SQLite opened on a Cloud Storage or NFS mount.

### Attribution (exact)
- POWER: "The data was obtained from National Aeronautics and Space Administration (NASA) Langley Research Center's Prediction Of Worldwide Energy Resources (POWER) project funded through the NASA Earth Science Division." plus "The data was obtained from the POWER Project's Daily 2.10.3 version on YYYY/MM/DD."
- GIBS and MODIS: "We acknowledge the use of imagery provided by services from NASA's Global Imagery Browse Services (GIBS), part of NASA's Earth Science Data and Information System (ESDIS)."
- Landsat: "USGS/NASA Landsat Program."
- Sentinel-2: "Contains modified Copernicus Sentinel data 2017-2026"
- OpenStreetMap: "© OpenStreetMap contributors", linked to openstreetmap.org/copyright
- Planetary Computer: none required; courtesy "accessed through Microsoft Planetary Computer".

All six permit caching and redistributing derived statistics and showing tiles.

### Alerts
On open: render stored rows, then `POST /api/fields/{id}/refresh`. "New since last visit" is a date kept in localStorage. Alerts take `as_of=<slider date>`, a `WHERE date <= ?` filter. Later: one Cloud Scheduler HTTP job (3 free per billing account, attempt deadline up to 30 min) calling the same refresh function.

## Corrections this made to the first brief

- Section 5, "No login, no database ... caches computed results as JSON files on disk": change to "No login. One SQLite file (Python's built-in sqlite3) as a rebuildable server cache of per-field statistics and climate series. Saved regions stay in localStorage; the server stores geometry only, never names or rotations."
- Section 7, index formulas: for Sentinel-2 scenes with s2:processing_baseline >= 04.00 (from 2022-01-25) subtract 1000 from every band first. Measured on the test field: 2024-07-19 mean NDVI 0.206 uncorrected versus 0.323 corrected. The 2021 scenes on Planetary Computer are baseline 03.00 and 02.12 and need no correction, so the 2021 versus 2024 demo is exactly where this bites. The 0.22 bare-soil threshold is affected too.
- Section 7, NDVI overlay tile URL: for post-2022 scenes the expression must be (B08-B04)/(B08+B04-2000), and the URL as written returns a JPEG with no transparency; use `.../{z}/{x}/{y}@1x.png?...`.
- Section 7, `eo:cloud_cover < 20`: this is a whole-tile figure. One scene rated 6.8% cloudy left only 21% of the test field clear. Use a looser scene filter and decide per field from the stored valid-pixel fraction.
- Section 7, NASA POWER: request the grid-cell centre and cache per cell (POWER's docs ask for one request per cell and warn of blocking); keep the default time standard (UTC gives different daily values and no recent solar). POWER's docs also now list higher-resolution rain (IMERG, about 10 km) and soil moisture (SMAP, about 9 km) through separate parameter aliases; names not checked.
- Section 5, alerts "computed when the app loads": keep, and add that alerts are evaluated as of the slider date from stored history, since live alerts are empty in November (latest passes are 99.5 to 100% cloud).
- Section 8, presets in `backend/app/data/presets/`: ship them as rows in a seed database copied into place at boot, so presets and user-drawn fields share one code path.
- Section 6, backend stack: `xarray`, `odc-stac` and `numpy` may be unnecessary. Planetary Computer's `POST /api/data/v1/item/statistics` returned cloud-masked NDVI, NDRE, NDMI and the clear fraction for a polygon in one call per scene (about 1.4 s). Whoever owns the data pipeline should decide between that and local raster reads.
- Section 10, deploy line: add `--max-instances 1` (SQLite needs a single writer and one cache), and do refresh work inside the request because CPU is only allocated during requests by default. The checklist item for the gcloud CLI is still open: it is not installed on this machine.
- Section 10, credit line: replace the short list with the exact sentences given in details (POWER needs two sentences including version and access date; Sentinel needs the word "modified" and the year).
- Section 10, "No API keys needed": still true, but note that Planetary Computer is a preview service with no uptime commitment and unpublished rate limits, and that its tokens may not be passed to the browser.

## Risks

- Planetary Computer is a preview service with no uptime commitment and unpublished limits. If it throttles during judging, new fields fail; presets in the seed database and the stored cache keep the demo working.
- Without the bucket snapshot, any redeploy or instance replacement resets the cache of user-drawn fields to the seed. Nothing a user owns is lost, but those fields rebuild on next open.
- With one instance, several judges drawing new fields at once will queue; the semaphore turns the overflow into a clear "busy, try again" rather than a timeout.
- Cloud Run's disk is memory: the database is small, but large temporary files would eat into the instance's RAM.
- Scenes that arrive or are re-issued more than 10 days after the last stored date are not picked up until a full re-scan is added.
- If the +1000 offset is fixed after rows were stored, those rows are wrong; bump ALGO so they are deleted and recomputed.
- A bug in the 24-hour climate freshness check could hammer NASA POWER with identical requests, which its docs say can get the client blocked.
- Browser-only storage means fields vanish in private mode, on another device, or after a week of non-use in Safari.
- GIBS tiles are served as non-cacheable, so dragging the time slider re-downloads every tile; change the date on release, not during the drag.
- OpenStreetMap tiles have no service guarantee and can be withdrawn; GIBS true colour is the fallback base layer.
- During a Cloud Run revision switch two instances briefly overlap; with the snapshot enabled the last writer wins and a few minutes of cache could be lost.

## Open questions

- Local raster reads (odc-stac) or the hosted statistics endpoint for the per-scene step? The hosted call removes the heaviest dependencies but leans on a preview API with unknown rate limits. The stored rows are identical either way.
- How loose should the scene-level cloud filter be? Reading every date instead of only scenes under 20% roughly triples first-build work (about 60 dates per season instead of 15 to 34) but stops clear field-days being thrown away.
- First-build time for a new field was not measured end to end. Estimate from the probe: about 250 scene-days at 1.4 s each with 8 in parallel is under a minute.
- History start: 2017 (two Sentinel-2 satellites) or 2015? And should climate go back to 1991 so a proper 30-year normal exists for the rainfall deficit?
- Is cross-device access to saved fields wanted this weekend? Default assumed: no, with a share link as the cheap later step.
- Is a roughly 1 to 2 MB binary seed.db in git acceptable, or should it be a text SQL dump?
- Current USGS wording for the Landsat credit could not be read (bot check on usgs.gov); the 2008 policy caption is what was verified.
- Which Cloud Run region? europe-west4 is a suggestion only; if the hosted statistics endpoint is used, a region near the judges may be the better choice.
- The bucket snapshot was tested locally only, not on a real Cloud Run mount.

## Findings

- **[source-read]** NASA POWER explicitly asks clients to request each grid cell once, which is a direct instruction to cache per cell.
  - Evidence: https://power.larc.nasa.gov/docs/services/api/temporal/daily/ : "with the 0.5° x 0.5° global grid you only need to submit one request per cell. If your application persists in requesting the same relative location, it will potentially be blocked." Same page: maximum 20 parameters per point request.
- **[verified-live]** Points in the same MERRA-2 cell (0.5° latitude by 0.625° longitude) return identical POWER series, so the cache key round(lat/0.5)_round(lon/0.625) with a cell-centre request is valid.
  - Evidence: curl to power.larc.nasa.gov daily point API: (53.21, 63.62), (52.80, 63.95) and centre (53.0, 63.75) gave identical T2M, T2M_MAX, T2M_MIN, PRECTOTCORR, GWETROOT, GWETTOP for 2021-06-01..07-10; the centre also matched solar; (53.30, 63.70) in the next cell did not match. Solar is on a coarser grid and differed for the off-centre point.
- **[verified-live]** A full POWER history for one cell is a single cheap request, so replacing the whole cell daily is simpler than incremental patching.
  - Evidence: 2015-01-01..2026-11-14, 7 parameters: HTTP 200, 498,503 bytes, 1.67 s, 4,336 days. Response headers x-app-version: v2.10.3.
- **[verified-live]** The newest POWER days are missing or provisional. Today the default request has no values after 2026-11-10 (solar after 2026-11-09), returned as -999.
  - Evidence: Same request: last valid T2M and PRECTOTCORR 20261110, ALLSKY_SFC_SW_DWN 20261109, header fill_value -999.0, sources ['MERRA2','GEOSIT','SYN1DEG','FLASHFLUX','POWER'].
- **[source-read]** POWER's recent meteorology is a near-real-time product later replaced by MERRA-2; recent solar is preliminary for 3 to 4 months.
  - Evidence: https://power.larc.nasa.gov/docs/methodology/data/sources_meteorology/ : GEOS-IT "is appended to the end of the MERRA-2 daily time series ... generally ready within about two days of real-time. The MERRA-2 values in the resulting daily time series are typically updated every several months." https://power.larc.nasa.gov/docs/methodology/data/sources_fluxes/ : CERES SYN1deg to "NRT minus ~3–4 months", FLASHFlux latency 5–7 days.
- **[verified-live]** POWER time standards must not be mixed: the same date gives different daily values, and the UTC request returned no solar values at all in the recent window.
  - Evidence: 2026-11-05 T2M 4.43 (time-standard=UTC) versus 3.40 (default LST); UTC window 2026-10-20..11-14 had 0 of 26 valid ALLSKY_SFC_SW_DWN days.
- **[verified-live]** Stored climate rows answer long-term questions with one SQL query, and the real data confirms the brief's demo contrast.
  - Evidence: store_sketch.py over the real Kostanay-cell series: May-Sep rain 119 mm and 45 days with max >= 30 °C in 2021; 301 mm and 5 days in 2024. T2M_MAX on 2021-07-02 = 40.42 °C.
- **[verified-live]** Planetary Computer anonymous tokens expire after 45 minutes and unsigned reads are refused, so signed URLs must never be stored.
  - Evidence: GET https://planetarycomputer.microsoft.com/api/sas/v1/token/sentinel-2-l2a at 04:51:50 UTC returned msft:expiry 05:36:50Z. Unsigned range read of a B04 blob: HTTP 409 "Public access is not permitted on this storage account".
- **[source-read]** Planetary Computer terms forbid passing tokens to third parties and give no service guarantee.
  - Evidence: https://github.com/microsoft/PlanetaryComputerDataCatalog/blob/main/src/pages/Terms.js (last updated January 2023): "Tokens may not be sublicensed to, distributed to, or shared with third parties"; previews are provided "as-is" without "any service level commitments"; "not meant for production use (though such use is not prohibited)".
- **[source-read]** Planetary Computer publishes no numeric rate limits today; limits depend on being inside Azure West Europe and on a subscription key; data is anonymously accessible.
  - Evidence: https://github.com/microsoft/PlanetaryComputerDataCatalog/blob/main/docs/concepts/sas.md (file last changed 2024-10-14): "Datasets in the Planetary Computer are anonymously accessible"; key via `planetarycomputer configure` or PC_SDK_SUBSCRIPTION_KEY. No rate-limit headers were present on any response I received.
- **[source-read]** An optional subscription key still works for people who already hold one, but there is no documented way to obtain a new one.
  - Evidence: https://github.com/microsoft/PlanetaryComputer/issues/464 : reply 2025-12-08 says a key "grants you higher rate limits when request SAS tokens and longer-lived SAS tokens"; a 2026-08-28 comment asking how to get one, noting the developer site is no longer active, is unanswered; issue still open.
- **[verified-live]** Catalogue searches are cheap and reading is the expensive part: a whole season of scene metadata takes under 2 s, one small remote read about 0.6 s.
  - Evidence: count_items.py: May-Sep search for one polygon 1.6-1.7 s per year; 2017: 33 dates, 2021: 61, 2024: 58, 2026: 66 (15, 34, 17, 28 dates with scene cloud < 20). Four 64 KB signed range reads: 0.59-0.64 s each.
- **[verified-live]** Scenes arrive quickly, and old scenes on Planetary Computer still carry their original processing versions, so stored rows stay valid; a 10-day re-check window is conservative.
  - Evidence: Pass of 2026-11-13 06:51 UTC (generated 09:47 UTC) was listed at 2026-11-14 04:50 UTC. Baselines over the test polygon: 2017 02.12; 2021 02.12 and 03.00; 2024 05.10 and 05.11; 2026 05.12 and 05.13.
- **[verified-live]** The test polygon lies in an overlap of two image tiles, so every date returns two scenes that must be grouped into one row per day.
  - Evidence: Every search returned paired items for tiles 41UNV and 41UNU with the same datetime (for example 2021: 61 + 61 items over 61 dates).
- **[verified-live]** Sentinel-2 scenes processed from 2022-01-25 (baseline 04.00+) carry a +1000 offset on every band; ignoring it lowers NDVI substantially and corrupts any comparison across 2022.
  - Evidence: https://github.com/microsoft/PlanetaryComputerExamples/blob/main/datasets/sentinel-2-l2a/baseline-change.ipynb (cutoff 2022-01-25, offset 1000). Live on the 2024-07-19 scene over the test polygon via the hosted statistics endpoint: mean NDVI 0.206 naive versus 0.323 corrected; 98th percentile 0.52 versus 0.77, the corrected value matching the 2021 scene's 0.775.
- **[verified-live]** Scene-wide cloud cover is a poor proxy for one field, so the per-field valid-pixel fraction must be computed and stored.
  - Evidence: Scene S2B_MSIL2A_20210710T065629_R063_T41UNV has eo:cloud_cover 6.8, yet only 20.6% of the test polygon was clear (SCL classes 4-6); the SCL histogram showed 7,761 of 13,203 pixels as high-probability cloud.
- **[verified-live]** Planetary Computer's data API can return cloud-masked NDVI, NDRE and NDMI means plus the clear fraction for a polygon in one call per scene, with no raster libraries on our side.
  - Evidence: pc_stats_probe.py: POST /api/data/v1/item/statistics with a GeoJSON Feature and four ';'-separated expressions returned HTTP 200; three scenes in parallel took 1.8 s total (about 1.4 s per single call). Example output 2021-07-05: valid_frac 0.985, ndvi_mean 0.305, ndre_mean 0.199, ndmi_mean -0.005. Anonymous, rate limits unknown.
- **[verified-live]** The schema, polygon key, incremental refresh, climate store and snapshot all work with the standard library alone.
  - Evidence: store_sketch.py self-check passes under Python 3.9.6 (SQLite 3.54.0), 3.11.15 and 3.12.13 (SQLite 3.53.3) with warnings as errors: same field drawn reversed, from another corner, unclosed or with 2e-7 noise gives the same id; second refresh reads nothing; a late scene, a new pass and a re-issued same-day product are each read once; snapshot passes PRAGMA integrity_check. Database with 4,336 climate days and 100 observation rows: 471,040 bytes.
- **[source-read]** Cloud Run's container disk is memory-backed and lost when the instance stops; idle instances can be stopped at any time; by default CPU is only available during requests.
  - Evidence: https://docs.cloud.google.com/run/docs/container-contract : "It is an in-memory file system, so writing to it uses the instance's memory." "Data written to the file system doesn't persist when the instance stops." "an idle instance can be shut down at any time". https://docs.cloud.google.com/run/docs/configuring/billing-settings : "With request-based billing, CPU is only allocated during request processing." Flag for the alternative: --no-cpu-throttling.
- **[source-read]** SQLite must not be opened directly on a Cloud Storage or NFS mount in Cloud Run.
  - Evidence: https://docs.cloud.google.com/run/docs/configuring/services/cloud-storage-volume-mounts : "Cloud Storage FUSE does not provide concurrency control for multiple writes (file locking) to the same file", "the last write wins". https://docs.cloud.google.com/storage/docs/cloud-storage-fuse/overview : "shouldn't be used as the backend for storing a database", "can only write whole objects at a time". https://docs.cloud.google.com/run/docs/configuring/services/nfs-volume-mounts : "Cloud Run does not support NFS locking."
- **[source-read]** Cloud Run bucket mounts need the second-generation environment and Storage Object User for writes; the request timeout defaults to 5 minutes and can reach 60.
  - Evidence: Same mount page: "Volume mounts require the second generation execution environment"; "grant the Storage Object User (roles/storage.objectUser) role"; commands `--add-volume name=VOLUME_NAME,type=cloud-storage,bucket=BUCKET_NAME` and `--add-volume-mount volume=VOLUME_NAME,mount-path=MOUNT_PATH`. https://docs.cloud.google.com/run/docs/configuring/request-timeout : "set by default to 5 minutes (300 seconds) and can be extended up to 60 minutes".
- **[source-read]** Cloud Run's new ephemeral disk does not provide durability.
  - Evidence: https://docs.cloud.google.com/run/docs/release-notes : 2026-11-04 "Cloud Run ephemeral disk is in General Availability (GA)", a volume that persists only for the life of an instance. Also 2026-10-12: budget spend caps that pause Cloud Run workloads are GA.
- **[source-read]** Free allowances relevant to the alternatives: Firestore 1 GiB and 50,000 reads / 20,000 writes per day with a 1 MiB document limit; one e2-micro VM free in three US regions; Cloud Storage free tier only in US regions; 3 Cloud Scheduler jobs free per billing account.
  - Evidence: https://docs.cloud.google.com/firestore/quotas ; https://docs.cloud.google.com/free/docs/free-cloud-features ; https://cloud.google.com/scheduler/pricing ("Each Google billing account gets 3 jobs per month free"); https://docs.cloud.google.com/scheduler/docs/reference/rest/v1/projects.locations.jobs (HTTP attempt deadline "[15 seconds, 30 minutes]"). PyPI: google-cloud-firestore 2.34.1, planetary-computer 1.0.0.
- **[source-read]** NASA data (POWER, GIBS, MODIS) may be cached and redistributed; POWER and GIBS each ask for a specific acknowledgement sentence.
  - Evidence: https://www.earthdata.nasa.gov/engage/open-data-services-software-policies/data-use-guidance : "data provided from a NASA-led mission are licensed as Creative Commons Zero (CC0)", no implied NASA endorsement. https://power.larc.nasa.gov/docs/referencing/ : reference sentences quoted in details, plus a request for notification "if POWER data is transmitted to other researchers". https://nasa-gibs.github.io/gibs-api-docs/ : GIBS acknowledgement sentence quoted in details.
- **[source-read]** Landsat data and products derived from it carry no restrictions; the policy's caption is "USGS/NASA Landsat Program."
  - Evidence: Landsat Data Distribution Policy (signed January 2008), https://d9-wret.s3.us-west-2.amazonaws.com/assets/palladium/production/s3fs-public/atoms/files/Landsat_Data_Policy.pdf , section IV D and E. Planetary Computer's landsat-c2-l2 collection labels its licence link "Public Domain". The current usgs.gov citation pages returned HTTP 202 with a bot check, so any newer credit wording is unverified.
- **[source-read]** Copernicus Sentinel data may be reproduced, distributed, adapted and combined; modified data must carry 'Contains modified Copernicus Sentinel data [Year]'.
  - Evidence: https://sentinels.copernicus.eu/documents/247904/690755/Sentinel_Data_Legal_Notice (PDF read in full, 2 pages).
- **[source-read]** OpenStreetMap tiles may be hotlinked for normal viewing with attribution and an intact Referer, but pre-fetching is prohibited and access can be withdrawn.
  - Evidence: https://operations.osmfoundation.org/policies/tiles/ : "Bulk downloading is any pre-emptive fetching of tiles other than those a user is actively viewing", "Offline use is not permitted", "there is no SLA or guarantee". https://osmfoundation.org/wiki/Licence/Attribution_Guidelines : "© OpenStreetMap contributors" acceptable, link to openstreetmap.org/copyright.
- **[verified-live]** GIBS tiles are not cacheable by the browser, OSM and Planetary Computer tiles are; the brief's tile URL returns JPEG unless .png is added.
  - Evidence: Response headers: GIBS (true colour and NDVI layers) cache-control "max-age=0, no-store, no-cache, must-revalidate"; OSM "max-age=91634, stale-while-revalidate=604800"; Planetary Computer tile "public, max-age=3600". Tile request without extension returned content-type image/jpeg; with @1x.png returned image/png; expression (B08-B04)/(B08+B04-2000) accepted with HTTP 200. GIBS docs state no key and no usage limits.
- **[source-read]** Safari deletes a site's localStorage after seven days of browser use without interaction with the site, so browser-only saved fields are not permanent on iPhones.
  - Evidence: https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/ (2020): "deleting all of a website's script-writable storage after seven days of Safari use without user interaction on the site"; home-screen web apps are exempt. Current Safari behaviour not re-tested.
- **[verified-live]** In November there is nothing for a scheduled refresh to find over the target region.
  - Evidence: The eight most recent Sentinel-2 items over the test polygon (2026-11-08 to 11-13) have eo:cloud_cover between 99.5 and 100.
- **[verified-live]** The local machine has Python 3.11.15 and 3.12.13, uv 0.11.32, Node 23.11.0 and Docker 28.0.1; the gcloud CLI is not installed; the default python3 is 3.9.6.
  - Evidence: command -v / --version checks run on this machine.
- **[verified-live]** Any current Debian-based Python image ships an SQLite new enough for the upsert and WITHOUT ROWID syntax used.
  - Evidence: https://sources.debian.org/api/src/sqlite3/ : bookworm 3.40.1, trixie 3.46.1 (upsert needs 3.24). Which Debian release python:3.11-slim currently uses was not checked.
- **[memory]** europe-west4 is suggested because the imagery is stored in Azure West Europe; the benefit is not measured and largely disappears if the hosted statistics endpoint is used.
  - Evidence: Planetary Computer docs name West Europe as the data centre (sas.md). No latency comparison between regions was run.

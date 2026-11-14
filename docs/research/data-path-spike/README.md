# How to fetch per-field time series (measured)

Research note from the design phase, 2026-11-14. Each finding is tagged: `verified-live` (a command was run), `source-read` (the cited source was read) or `memory` (unverified recall). Paths to scratch files that were not kept in the repo are historical.

## Recommendation

Use the Planetary Computer statistics endpoint (path A) for all per-field numbers: one POST per scene returns the clear-pixel fraction and cloud-masked NDVI, NDMI and NDRE for the polygon, with no key, no signing and no raster libraries. The only dependency is httpx, which the brief already lists; numpy, xarray, pystac-client, planetary-computer and odc-stac can be dropped from the backend. A newly drawn field takes 14-16 s for ten Sentinel-2 seasons at 20 concurrent calls, or about 30 s (18 s at 32 concurrent) if the MODIS 2000-2026 baseline is fetched in the same run; an incremental refresh takes 1-4 s. odc-stac (path B) gave the same values within 0.003 but took 60 s for ten seasons, varied a lot between runs, and needs 66 packages and 224 MB. On the history question: yes, keep history, but of the derived per-field series (94 KB of JSON per field for both sensors), not of imagery; each refresh then asks only for scenes newer than the last stored date. Two things will silently corrupt results if missed: Sentinel-2 items with processing baseline 04.00 or later need the 1000 offset (NDVI reads 0.38 instead of 0.62 without it), and the tile-level cloud filter in the brief discards 28% of the scenes that are clear over the field. I could not write report.md because the harness refuses report files from subagents; scripts and raw results are in the scratch folder and the full content is in the details below.

## Spec

`report.md` was not written: the harness refuses report files from subagents. Scripts, raw results and downloads are in `docs/research/data-path-spike/` (`scripts/`, `out/`, `downloads/`). `scripts/field_series.py` (88 lines, httpx only) is the reference implementation.

**Test polygon.** 53.2 N 63.6 E is Kostanay city. Used a 2.0 x 1.5 km rectangle centred 63.2 E, 53.51 N (300 ha, 100% cropland, tile 41UNV). It spans about three fields.

**Path A call (one per scene, no key, no signing)**
```
POST https://planetarycomputer.microsoft.com/api/data/v1/item/statistics
  ?collection=sentinel-2-l2a&item={id}&asset_as_band=true&max_size=512&expression={E}
body: GeoJSON Feature
E = where(C,1,0);where(C,(B08-B04)/(B08+B04{D}),0);where(C,(B08-B11)/(B08+B11{D}),0);where(C,(B08-B05)/(B08+B05{D}),0)
C = (SCL==4)|(SCL==5)
D = "-2000" if float(s2:processing_baseline) >= 4.0 else ""
```
- Clear fraction = `mean[0] * valid_percent/100`; masked index = `mean[i] / mean[0]`.
- Join expressions with `;` (repeating the parameter keeps only the last).
- Fails: `nodata=-9999` (500), bitwise `&` (500; use `floor(x/64)%2==1`).
- `assets=SCL&categorical=true` returns the class histogram.

**Timings**

| Run | Time |
| --- | --- |
| One call, cold connection | 1.1-1.5 s (server 0.25-0.5 s) |
| One call, keep-alive pool | p50 0.7 s, p95 1.3-1.7 s |
| One season, 31 scenes, 20 concurrent | 3.3 s (50 s sequential) |
| Ten seasons 2017-2026: 1 search + 294 calls | 14.4-16.0 s at 20; 9.2 s at 40; 24.8 s at 10 |
| Same plus MODIS May-Sep 2000-2026 (797 calls) | 30.4 s at 20; 18.4 s at 32 |
| Incremental refresh | 1.1 s (nothing new); 2.3 s (8 calls); 3.9 s (36 calls) |
| 5,000 ha polygon, one call | 2.0-3.8 s; 1.7 s with `max_size=512` |
| Path B, one season | first process 32.3 s; warm 8-10 s; one slow episode 45 s |
| Path B, ten seasons (measured) | 59.8 s |

**Throttling.** About 4,500 anonymous calls in 40 minutes, peak concurrency 40: zero 429. One 2016 item returns a deterministic 500; skip such items.

**Path B.** 66 packages, 224 MB (odc-stac 0.5.3, rasterio 1.5.2, xarray 2026.9.0, numpy 2.5.4, dask 2026.8.0, pystac-client 0.9.1, planetary-computer 1.0.0) against 7 packages, 2.4 MB for httpx 0.28.1. Values agree with path A within 0.003.

**Path C.**
- `modis-13Q1-061`: 1,162 items, 2000-02-18 to 2026-10-16 (Terra 561, Aqua 522, 79 untagged). All of them via `assets=250m_16_days_NDVI&assets=250m_16_days_pixel_reliability`: 35.6 s at concurrency 20.
- Expressions fail for this collection (asset names start with a digit). `unscale=true` returns values 10,000 times too large; multiply by 0.0001 yourself.
- Gap: no items between 2025-06-26 and 2025-11-17.
- ORNL subset API: keyless, 10 dates per request, 12-37 s per request, one 503. Offline backfill only.
- AppEEARS: 403 without an Earthdata token.
- Mosaic: register (1.4 s) and tiles work; mosaic point returns 500; no mosaic statistics.

**Sentinel-2 facts.**
- Earliest item 2015-09-05. May-Sep dates: 2016: 22 (3 usable), 2017: 11 (4 usable), 2018-2026: 29-36.
- Usable scenes (at least 80% clear in the polygon) 2018-2026: 7-16 per season, median 12; gaps up to 60 days.
- Offset: baselines 04.00 to 05.13 carry `BOA_ADD_OFFSET=-1000`; B04 1st percentile jumps from about 200 to about 1100. Scene 2024-07-04: NDVI 0.382 raw, 0.622 corrected.
- 2022 and 2023 have two items per date (two baselines): keep the highest baseline.
- Tile `eo:cloud_cover<20` loses 30 of 106 usable scenes and keeps 20 unusable ones.

**Curves (Sentinel-2 NDVI, at least 80% clear)**
```
2021: 05-01 .16 | 05-21 .14 | 06-05 .20 | 06-20 .39 | 06-30 .47 | 07-10 .49 | 07-20 .51 peak | 08-04 .41 | 08-14 .33 | 08-24 .22
2024: 05-10 .18 | 05-25 .17 | 06-14 .39 | 07-04 .62 | 07-29 .64 peak | 08-28 .50 | 09-02 .51 | 09-12 .32 | 09-27 .24
```
- S2 yearly peaks 2018-2026: .61 .55 .48 .51 .40 .70 .64 .75 .67.
- MODIS yearly peaks 2000-2026: median 0.71; 2021 = 0.63 (9th lowest of 27); 2024 = 0.81 (25th).
- MODIS reads about 0.11 higher than S2 (r = 0.89): compute anomalies within one sensor.

**Storage.** Both series for one field are 94 KB of JSON (294 + 503 rows, item id per row). Refresh = STAC search from the last stored date, then statistics for the new items only.

**Backend rules.**
1. Offset by baseline, never by date.
2. Dedup per (date, tile) by baseline, then per date by clear fraction.
3. Usable = clear fraction >= 0.8 (0.5 adds about 25% more scenes).
4. One global semaphore (20-32) across all users.
5. Retry 429, 502 and timeouts with backoff; treat 500 as skip.
6. MODIS: dedup by (date, platform); skip seasons with too few June-August composites (2025); hide the MODIS baseline below about 100 ha.

## Corrections this made to the first brief

- Section 7, field NDVI overlay tiles and the 'Indices' line: the formulas are only right on reflectance. On Planetary Computer, items with s2:processing_baseline >= 04.00 (everything from 2022 on) need the 1000 offset, i.e. (B08-B04)/(B08+B04-2000) and the same -2000 for NDRE and NDMI. Uncorrected, the 2024-07-04 scene reads NDVI 0.38 instead of 0.62, which would invert the 2021-versus-2024 demo.
- Section 7, 'eo:cloud_cover < 20, mask with SCL': drop the tile-level prefilter. It discards 30 of 106 scenes that are clear over the field and keeps 20 that are not. Process every scene and filter on the per-polygon SCL clear fraction (>= 0.8).
- Section 6 backend stack: numpy, xarray, pystac-client, planetary-computer and odc-stac are not needed. httpx alone covers STAC search and statistics.
- Section 7 'Sign with planetary_computer.sign_inplace' and section 8 'Clip to the polygon's bounding box with odc-stac, read at 20 m': replace both with POST /api/data/v1/item/statistics (GeoJSON body, max_size=512). No signing is involved.
- Section 8 'A multi-year series for a freshly drawn field takes tens of seconds': measured 14-16 s for ten Sentinel-2 seasons, about 30 s with the MODIS 2000-2026 baseline (18 s at 32 concurrent), 1-4 s for a refresh.
- Section 7 'sentinel-2-l2a (2015+)': at the test location there is one item in 2015, 3 usable scenes in 2016 and 4 in 2017. Dependable coverage starts in 2018, so a Sentinel-2 'multi-year median' rests on nine seasons.
- Section 7 'landsat-c2-l2 for older history': modis-13Q1-061 through the same statistics endpoint is the simpler long baseline (2000 onwards, 250 m, a NASA product). Note its gap on Planetary Computer from 2025-06-26 to 2025-11-17 for tile h21v03.
- Section 5 alert 'Bare soil (mean NDVI < 0.22) between May and September': NDVI is 0.11-0.18 every May before emergence (2021 and 2024 both), so the rule fires on every field each spring. Restrict it to after emergence, for example 15 June to 31 August.
- Section 4 demo story: the 2021-versus-2024 contrast exists on the test polygon, but 2021 is not its worst year (2022 and 2020 peak lower in Sentinel-2; MODIS ranks 2021 9th lowest of 27). Choose preset fields by looking at their curves, and remember a fallow year looks like a drought year in peak NDVI.
- Section 4 presets: draw polygons along real field boundaries. A plain 300 ha rectangle on 100% cropland still covered about three fields.
- Section 5 'No database': compatible with keeping history. The per-field JSON cache is the history (94 KB per field); it only needs the last stored date and item ids so a refresh can be incremental.

## Risks

- The whole path depends on one hosted API whose own OpenAPI title is 'Preview of Tile Access Features'. If it slows or fails during judging, only the precomputed presets work, so commit them early.
- Forgetting the baseline offset fails silently: every season from 2022 on looks about 0.24 NDVI lower at peak and the app would report false stress.
- Not deduplicating reprocessed items double-counts dates in 2022 and 2023.
- Individual items can return a permanent HTTP 500 (1 in about 3,000 here); a series builder that aborts on the first error would fail for that field.
- Usable scenes can be 55-60 days apart inside a season, so alerts and same-part-of-season medians must tolerate sparse data.
- MODIS 250 m pixels mix in neighbouring fields for small polygons, and MODIS reads about 0.11 higher than Sentinel-2; mixing sensors in one anomaly gives false signals.
- Fallow years and drought years look alike in peak NDVI; without the declared rotation the stress alert will misfire.
- Path B timings varied sixfold within minutes (load 7 s to 42 s for the same season), so it is not a dependable fallback for a live demo.
- ORNL was unstable during the test (503, timeouts, 12-37 s responses); anything that calls it at request time will hang.

## Open questions

- Which SCL classes count as clear (4 and 5 only, or also 6 and 7) and which clear-fraction threshold (0.8 gives 7-16 scenes per season, 0.5 about 25% more).
- Whether to backfill the 2025 MODIS gap for the three presets from ORNL offline, or simply exclude 2025 from the MODIS baseline.
- How the statistics endpoint behaves with several users at once from one Cloud Run IP; the limit is undocumented and only tested to 40 concurrent calls from one machine.
- Latency from the deployment region was not measured; all timings are from the developer machine, about 190 ms from the front door.
- Polygons that straddle an MGRS tile overlap or a UTM zone boundary: the dedup-by-day logic is written but not tested live.
- Whether the low 2022 peak on the test rectangle is drought or a fallow year for part of it; presets need a known rotation to tell.
- Whether to add HLS for the 'NASA data' rubric line; on Planetary Computer it only starts in 2020 and each call took 3.6 s.
- Cloud Run's filesystem is not persistent (from memory, not checked), so server-side history would be lost on redeploy unless it is baked into the image or also kept in the browser.

## Findings

- **[verified-live]** The suggested test spot 53.2 N, 63.6 E is the city of Kostanay, not cropland (92% built-up, 0% cropland). Test rectangle moved to 2.0 x 1.5 km centred 63.2 E, 53.51 N: 300 ha, 100% cropland class, MGRS tile 41UNV, one orbit (R063).
  - Evidence: scripts/a0_landcover.py and a0_scan.py: ESA WorldCover 2021 categorical stats '63.6,53.2 classes={10:3133,30:617,40:98,50:55116,60:76} cropland(40)=0%'; '(63.2, 53.51) 100.0%'
- **[verified-live]** POST /api/data/v1/item/statistics with a GeoJSON Feature body and expression=(B08-B04)/(B08+B04)&asset_as_band=true returns polygon NDVI statistics without any key or SAS signing.
  - Evidence: scripts/a2_one.py: 'ndvi: HTTP 200 in 1.46s mean=0.4676 median=0.4615 count=27195 valid%=100.0'; OpenAPI at https://planetarycomputer.microsoft.com/api/data/v1/openapi.json
- **[verified-live]** NDVI, NDMI and NDRE come back in one request when expressions are joined with ';'. Repeating the expression parameter returns only the last one.
  - Evidence: scripts/a2_one.py: 'three_semicolon: HTTP 200 in 1.55s' with three result blocks (0.4676, -0.0436, 0.3029); 'three_repeat_param' returned only the NDRE block
- **[verified-live]** SCL cloud masking works in the same call with numexpr where(); the masked mean is mean(where(clear,index,0)) / mean(where(clear,1,0)) and the clear fraction is the mean of where(clear,1,0). A categorical SCL histogram also works (assets=SCL&categorical=true).
  - Evidence: scripts/a2_one.py 'all_in_one: HTTP 200 in 1.79s'; 'scl_categorical hist: [[3465.0, 3423.0], [4.0, 5.0]]'; cross-check against odc-stac in out/pathA_2021.json vs out/pathB_2021.json: max abs diff 0.0032 on usable scenes
- **[verified-live]** Expression forms that fail: nodata=-9999 with a where() fill (HTTP 500), 0/0 as a NaN fill (HTTP 400), bitwise & (HTTP 500). floor(x/64)%2==1 works as a bit test.
  - Evidence: scripts/a2_one.py 'masked_where_nodata: HTTP 500', 'masked_where_nan: HTTP 400 Unsupported band math expression'; scripts/a10_other.py and a11_bits.py (Fmask&14 -> 500; floor(Fmask/2)%8==0 -> 200, clear 1.0, NDVI 0.5029)
- **[verified-live]** Path A timings: one cold call 1.1-1.5 s (server-timing 250-500 ms, TLS setup about 0.6 s); on a keep-alive httpx pool p50 0.70-0.78 s. One season (31 scenes) 3.3 s with 20 threads, 50.2 s sequential.
  - Evidence: curl timing 'tcp 0.19s tls 0.57-0.61s total 1.12-1.48s server-timing total;dur=246'; scripts/a3_season.py '2021: 31 items | stats 3.32s wall (20 workers) | codes {200: 31}' and '50.23s wall (1 workers)'
- **[verified-live]** Ten Sentinel-2 seasons (2017-2026): one STAC search (785 items, 2.0-2.3 s with a fields filter) plus 294 statistics calls took 14.4 s and 16.0 s at concurrency 20, 9.2 s at 40 and 24.8 s at 10, all HTTP 200.
  - Evidence: scripts/a8_full.py output: 'stats 13.87s wall at concurrency 20 | codes {200: 294} | TOTAL 16.0s', 'concurrency 40 ... TOTAL 9.2s', 'concurrency 10 ... TOTAL 24.8s', 'concurrency 20 ... TOTAL 14.4s'
- **[verified-live]** Ten S2 seasons plus MODIS May-September 2000-2026 in one run (797 calls) took 30.4 s at concurrency 20 and 18.4 s at 32. Incremental refresh: 1.1 s when nothing is new, 2.3 s for 8 new scenes, 3.9 s for 36. Both series for one field are 94 KB of JSON.
  - Evidence: scripts/field_series.py output: 'S2 785 found/294 calls/294 rows | MODIS 1162 found/503 calls/503 rows | 30.4s at concurrency 20', '18.4s at concurrency 32', 'S2 15 found/4 calls | MODIS 8 found/4 calls | 2.3s', '0 calls ... 1.1s', 'json bytes: 93907'
- **[verified-live]** No rate limiting on anonymous access: roughly 4,500 data-API calls and 40 STAC searches in about 40 minutes at up to 40 concurrent, zero HTTP 429, no rate-limit headers. One Sentinel-2 item returns a deterministic HTTP 500 for every asset.
  - Evidence: status counters in a3/a8/c1/field_series outputs (all 200); out/pathA_2016.json row S2A_MSIL2A_20160519T064632_R020_T41UNV_20210528T215133 status 500 after 3 attempts; scripts/a7_err.py; response headers 'x-cache: CONFIG_NOCACHE'. Call total is my own tally, not a logged count.
- **[verified-live]** Path B (odc-stac, B04/B08/B11/SCL at 20 m, May-Sep 2021, 31 scenes): first process after install 32.3 s (21.6 s of it a one-off import), warm runs 8-10 s (load 3.9-7.2 s), one slow episode with a 42 s load. Ten seasons measured at 59.8 s. Install is 66 packages, 224 MB, against 7 packages, 2.4 MB for httpx alone.
  - Evidence: scripts/b1_odc.py outputs: 'import 21.57s ... load 7.11s ... process 32.3s'; repeats 'load 7.16s, 6.55s, 4.87s'; 'load 42.04s'; 'TOTAL wall 59.8s' for 2017-2026; 'du -sh venv-a venv-b' = 2.4M / 224M; uv install log (odc-stac 0.5.3, rasterio 1.5.2, xarray 2026.9.0, numpy 2.5.4, dask 2026.8.0, pystac-client 0.9.1, planetary-computer 1.0.0, httpx 0.28.1)
- **[verified-live]** The 1000 offset must be applied on this collection for processing baseline 04.00 and later, keyed on s2:processing_baseline, not on date. STAC assets carry no offset metadata and unscale=true does nothing. On the same 2024-07-04 scene NDVI is 0.382 uncorrected and 0.622 with (B08-B04)/(B08+B04-2000).
  - Evidence: scripts/a5_offset.py: MTD XML 'BOA_ADD_OFFSET [(0,-1000),...]' for baselines 04.00-05.12 and none for 02.12/03.00; B04 1st percentile 235 (2019), 200 (2021) vs 1103 (2022), 1259 (2023), 1192 (2024); scripts/a6_variants.py '2024 raw expr mean=0.3823', '2024 unscale=true mean=0.3823', '2024 offset expr mean=0.6223'
- **[verified-live]** Earliest Sentinel-2 L2A item at this location is 2015-09-05. May-September dates per year: 2016: 22 (3 usable), 2017: 11 (4 usable), 2018-2026: 29-36. 2022 and 2023 contain duplicate items per date under two baselines (50 items for 31 dates, 59 for 31).
  - Evidence: scripts/a4_inventory.py: 'earliest 5: S2A_MSIL2A_20150905T065826...'; '2022 items 50 distinct dates 31 ... baselines {05.10: 19, 04.00: 31}'; '2023 items 59 distinct dates 31'
- **[verified-live]** Usable scenes per season (at least 80% of the polygon SCL 4 or 5): 4 in 2017, then 7-16 for 2018-2026, median 12; gaps between usable scenes reach 55-60 days in 2019, 2022, 2023. The tile-level eo:cloud_cover < 20 prefilter drops 30 of 106 usable scenes and keeps 20 that are cloudy over the field.
  - Evidence: table computed from out/pathA_2017..2026.json: 'SUM 294 scenes, 106 valid>=0.8, 134 valid>=0.5, 96 cc<20, 30 lost by prefilter, 20 kept unusable'; scripts/d1_curves.py max_gap_days column
- **[verified-live]** MODIS 13Q1 on Planetary Computer: 1,162 items for the polygon from 2000-02-18 to 2026-10-16 (Terra 561, Aqua 522, 79 untagged). All of them through the statistics endpoint took 35.6 s at concurrency 20 (p50 0.53 s per call), search 9.3 s. Expressions fail for this collection and unscale=true returns values 10,000 times too large.
  - Evidence: scripts/c1_modis.py: 'search: 1162 items, 2 pages, 9.32s'; 'stats: 1162 calls in 35.61s wall at concurrency 20 | codes {200: 1162}'; 'expr masked: HTTP 400 Invalid expression syntax: invalid decimal literal'; 'unscale mean=58118714.29'
- **[verified-live]** Planetary Computer's MODIS 13Q1 has a gap for tile h21v03: no items between 2025-06-26 and 2025-11-17. ORNL has those dates.
  - Evidence: item date list from out/pathC_modis.json for 2025 ends '06-26' then resumes '11-17'; ORNL subset for A2025177-A2025273 returned 2025-07-12 8520, 2025-07-28 8552, 2025-08-13 7715 (downloads/ornl_2025.json)
- **[verified-live]** ORNL DAAC MODIS subset API is keyless but unfit for request-time use: 10 dates maximum per request, 12-37 s per request today, one 503 and one 60 s timeout, point-plus-window only. NASA AppEEARS needs an Earthdata Login token (403 without).
  - Evidence: curl https://modis.ornl.gov/rst/api/v1/MOD13Q1/subset...: 'HTTP 200 12.27s', '24.17s', '34.50s', '36.68s'; '/products HTTP 503 16.2s'; 'exceeds maximum subset tiles support of 10' (HTTP 400); https://appeears.earthdatacloud.nasa.gov/api/task -> HTTP 403 'You don't have the permission', /api/product -> 200 (193 products)
- **[verified-live]** Mosaic endpoints are for display only: POST /mosaic/register works (1.4 s) and mosaic tiles render (2.5 s), but the mosaic point endpoint returned HTTP 500 and there is no mosaic statistics endpoint. Item tiles, /item/crop.png and /item/feature.png work with the offset-corrected expression.
  - Evidence: scripts/a9_mosaic_big.py: 'register 200 1.43s', 'point: 500', 'mosaic tile z12: 200 image/jpeg 24055 bytes 2.49s'; path list in downloads/pc-openapi.json; scripts/a12_tiles.py '/item/crop.png 200 image/png 38841 bytes 1.71s'
- **[verified-live]** max_size=512 makes call time independent of field size: a 5,000 ha polygon takes 2.0-3.8 s at full resolution and 1.7 s with max_size=512, NDVI differs by 0.0005; ten-season results for the 300 ha field are identical with and without it.
  - Evidence: scripts/a9_mosaic_big.py: '7.07x7.07 km (4998 ha) []: [2.42, 1.96, 3.78]s ndvi 0.4563' vs "[('max_size','512')]: [1.72, 1.65, 1.7]s ndvi 0.4558"; comparison of field_series output vs pathA_full: max diff 0.0
- **[verified-live]** The 2021 versus 2024 contrast holds on this polygon: Sentinel-2 peak NDVI 0.51 on 2021-07-20 and down to 0.22 by 24 August, against 0.64 on 2024-07-29 and still 0.50 on 2 September. But 2021 is not the lowest year: S2 peaks are lower in 2022 (0.40) and 2020 (0.48), and in the MODIS record 2021 ranks 9th lowest of 27 while 2024 ranks 25th.
  - Evidence: scripts/d1_curves.py output (curves and per-year tables); MODIS 'median of yearly peaks 0.707; 2021 rank 9/27 from lowest; 2024 rank 25/27'
- **[verified-live]** MODIS and Sentinel-2 yearly peak NDVI track each other (Pearson r 0.89, 2018-2026) but MODIS reads about 0.11 higher, so anomalies must be computed within one sensor.
  - Evidence: computed from d1_curves.py yearly peaks: 'Pearson r 0.89 | mean offset MODIS-S2: 0.107' (2025 MODIS peak is truncated by the gap)
- **[verified-live]** The test rectangle covers about three fields, not one: one large field plus a strip on the east and a slice on the south with lower NDVI.
  - Evidence: downloads/item_crop.png (NDVI crop of 2024-07-04 from POST /item/crop.png), inspected visually
- **[verified-live]** sentinel-2-l2a is hosted in Azure West Europe; the anonymous SAS token (needed only for path B) expires 45 minutes after issue.
  - Evidence: STAC collection JSON 'msft:region': 'westeurope'; https://planetarycomputer.microsoft.com/api/sas/v1/token/sentinel-2-l2a 'msft:expiry 2026-11-14T06:00:43Z' fetched at 05:15:43Z
- **[source-read]** Planetary Computer documents that rate limits exist and depend on region and subscription key, without a number for the data API.
  - Evidence: Search snippet of https://planetarycomputer.microsoft.com/docs/concepts/sas (the docs site is a JavaScript app and could not be read directly, so this is a snippet, not a full read)
- **[verified-live]** HLS on Planetary Computer starts 2020-01-01 only; Landsat Collection 2 Level-2 goes back to 1982 and both work through the same statistics endpoint. There is no VIIRS vegetation-index collection among the 139 collections.
  - Evidence: scripts/a10_other.py: 'hls2-s30: temporal [[2020-01-01...' ; 'landsat-c2-l2 2000-05-01/2000-09-30: 11 items', '2010: 26 items', 'ndvi sr-scaled 200'; downloads/pc_collections.json
- **[memory]** From a Cloud Run region in Europe the per-call time should fall below the 0.7 s measured here, because this machine sits about 190 ms from the front door.
  - Evidence: Inference from the curl breakdown (tcp 0.19 s, server-timing 0.25-0.5 s); not measured from any cloud region

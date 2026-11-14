# Per-field vegetation analysis

Research note from the design phase, 2026-11-14. Each finding is tagged: `verified-live` (a command was run), `source-read` (the cited source was read) or `memory` (unverified recall). Paths to scratch files that were not kept in the repo are historical.

## Recommendation

Build the analysis as plain numpy rules; nothing here needs an LLM, whose only useful place is turning the computed metrics and alerts into prose. The one fix that cannot be skipped: Planetary Computer does not harmonise Sentinel-2, so subtract 1000 from every reflectance band of items with processing baseline 04.00 or higher, in the statistics and in the overlay tile expression. Without it a dense July 2026 crop reads NDVI 0.55 instead of 0.82 and the 2021 versus 2024 demo is wrong. Mask with SCL classes 4 and 5, accept a scene when at least 75 % of the field is clear, use field medians in 10-day bins, and judge stress on the season's peak NDVI against the median peak of the field's own cropped years; same-date comparison flagged a late-peaking crop as a severe deficit on real data. Read B12 as well, because bare soil needs NBR2 to tell tilled fallow from stubble. Start with Sentinel-2 only (usable seasons begin in 2018) and add the MODIS 2000-onward record second, for fields above about 150 ha, to say things like "second-worst peak in 26 years". On keeping history: yes, but store the per-scene field statistics (about 500 small rows per field), not imagery, and fetch only new scenes on each load. Treat every threshold as a starting value: they were tuned on six hand-picked 25 ha squares in one tile with no ground truth.

## Spec

**No report.md was written.** The harness refused the write (sub-agents may not create report files), so `report_path` is empty and the spec is here. Runnable numpy-only reference (186 lines, self-check passes): `docs/research/vegetation-analysis/scripts/vegspec.py`. Its run on real data, every year 2017 to 2026: `docs/research/vegetation-analysis/out/run_spec_output.txt`.

**Read**: SCL, B04, B08, B11, B12 at 20 m (B05 and B8A not needed). STAC filter `eo:cloud_cover < 80`. Keep one item per (datetime, `s2:mgrs_tile`): the highest `s2:processing_baseline`. Read SCL first; fetch bands only if the scene passes.

**Offset**
```python
off = 1000.0 if float(item.properties["s2:processing_baseline"]) >= 4.0 else 0.0
refl = np.where(dn == 0, np.nan, np.clip(dn.astype("float32") - off, 0, None) / 1e4)  # never SCL
tile_expr = "(B08-B04)/(B08+B04-2000)" if off else "(B08-B04)/(B08+B04)"
```

**Mask**: valid pixel = SCL in {4, 5}, polygon buffered inward 20 m. Accept a scene if clear fraction >= 0.75 and SCL 11 < 5 %. Store per scene the field **median** of NDVI, NDMI `(B08-B11)/(B08+B11)`, NBR2 `(B11-B12)/(B11+B12)`, plus NDVI p10 and p90.

**Series** (1 May to 30 Sep, 15 dekads): drop any observation more than 0.10 below both neighbours within 20 days; dekad = median of accepted observations; linear fill across at most 2 empty dekads; no smoothing.

**Year metrics**: `pre` = median NDVI in May; `mid_max` = max 21 Jun to 10 Aug; `peak` and its dekad; `n_green` = dekads >= 0.45; `bare_days` = 10 x dekads < 0.25 (tilled if NBR2 < 0.06, otherwise residue).

**Land use**, first match wins: unknown (< 3 dekads with data in 21 Jun to 10 Aug); early_green (`pre >= 0.40`); fallow (`mid_max < 0.30`); ambiguous (`mid_max < 0.45` or `n_green < 3`); cropped (peak before 11 Jul = early, to 10 Aug = cereal-like, later = late). The field is annual cropland if the multi-year median of `pre` is < 0.30. The user's declaration overrides.

**Baseline**: the other years labelled cropped, at least 3.

| Alert | Rule | Levels |
| --- | --- | --- |
| VEG_DEFICIT | After the peak (date >= 11 Aug, or peak >= 2 dekads old and NDVI <= peak - 0.05): `r = peak / median(peak_b)`; `I = sum max(nd-0.2,0) / sum max(med_b-0.2,0)` over shared dekads (>= 10) | watch r <= 0.90; warning r <= 0.80 or I <= 0.65; severe r <= 0.65 or I <= 0.50 |
| WATER_STRESS | `d` = NDMI at peak minus baseline median NDMI at peak, and NDMI at peak < 0.15 | warning d <= -0.15; severe d <= -0.25 |
| BARE_SOIL | >= 3 consecutive dekads NDVI < 0.25 inside 21 Jun to 31 Aug | info if fallow, otherwise warning |
| NO_GREENUP | NDVI < 0.30 where baseline median >= 0.40, no earlier dekad >= 0.30 | watch at 21 Jun; warning at 11 Jul |
| ABRUPT_DROP | Before 11 Aug: previous dekad >= 0.45, drop >= 0.20, next dekad still >= 0.15 lower | warning |
| PATCHY | Median of (p90 - p10) over dekads >= 0.45 | watch 0.20; warning 0.30 |

Report `z = (peak - mean_b) / max(sd_b, 0.05)` with n, never gate on it. A fallow year returns after BARE_SOIL. Under 3 baseline years only the baseline-free rules run. `alerts(..., upto=i)` replays the season as of any dekad, which suits the time slider.

**False-positive guards**: cloud (clear fraction, median, despike, and the season maximum cannot be lowered by a low outlier); snow (SCL 11 invalid, May to September only); harvest (no drop or bare logic counts after 11 Aug); fallow (excluded from baseline, never stress); late sowing or crop change (peak-based); weed flush (3 green dekads required); hay cut (word ABRUPT_DROP as "sudden loss of cover", not stress).

**MODIS add-on** (fields >= about 150 ha): Planetary Computer `modis-13Q1-061`, ids starting `MOD13Q1` (do not filter on `platform`), `250m_16_days_NDVI` x 0.0001, `pixel_reliability` <= 1, pixels >= 250 m inside the boundary, June to August peak per year, then percent of median, z, `VCI = 100 (p - min) / (max - min)` and rank. MODIS against MODIS only.

**Persist per scene**: item_id, date, baseline, clear, snow, ndvi, ndmi, nbr2, p10, p90, n_px.

**Versions run**: Python 3.11, numpy 2.4.6, pystac-client 0.9.1, planetary-computer 1.0.0, odc-stac 0.5.3, rasterio 1.4.4.

**Skipped**: smoothing (add a Whittaker smoother if preset curves look jagged), NDRE and BSI (no rule uses them), HLS (starts 2020 on Planetary Computer), same-date z-score alerts (keep the same-date median as the shaded band on the chart).

Housekeeping: one command briefly wrote and deleted a one-line temp file at `/tmp/claude-q.txt`, outside the scratch folder; nothing remains and no process is running.

## Corrections this made to the first brief

- Section 7, NDVI overlay tile URL: the expression (B08-B04)/(B08+B04) is wrong for items with s2:processing_baseline 04.00 or higher (everything from 2022-01-26). Use (B08-B04)/(B08+B04-2000) for those items; verified to work on the data API.
- Sections 7 and 8 never mention the baseline 04.00 offset. Add: subtract 1000 from every reflectance band when the item's baseline is 04.00 or higher, and keep only the highest-baseline copy of each acquisition (2022 and 2023 hold duplicates).
- Section 7, 'eo:cloud_cover < 20': replace with '< 80' plus a field-level test (at least 75 % of the polygon's pixels in SCL class 4 or 5). The 20 % filter left 7 scenes and 9 empty dekads of 15 in 2024, the demo's good year.
- Section 5, 'Bare soil (mean NDVI < 0.22)': use the field median, a threshold of 0.25, a run of at least 30 days inside 21 June to 31 August, and NBR2 to say whether the soil is tilled or under stubble.
- Section 7, indices: add NBR2 = (B11-B12)/(B11+B12), which requires reading B12. NDRE (B05) is not used by any rule and can be dropped.
- Section 5, 'NDVI well below the field's own multi-year median for the same part of the season': make the alert peak-based (season peak against the median peak of cropped years). Keep the same-date median as a shaded band on the chart; as an alert it fires on late sowing and on any change of crop.
- Section 5, 'NDMI drop (water stress)': define it at the peak against the field's usual NDMI at peak. On its own it is nearly the same signal as NDVI; its value is in supporting a water diagnosis together with POWER rainfall.
- Section 7, 'sentinel-2-l2a (2015+)': usable seasons start in 2018 (2015 has 1 to 5 scenes, 2016 and 2017 have one satellite and 5 to 8 empty dekads). 'Multi-year' means 8 seasons, fewer after removing fallow years.
- Section 7, 'Also available: hls2-l30, hls2-s30': on Planetary Computer both start on 2020-01-01, so they are not a historical baseline.
- Section 7, modis-13Q1-061: many items lack the platform property (filter on the id prefix MOD13Q1 instead) and composites from mid-July to early November 2025 are missing at the source.
- Section 5 should state that the user's declared land use per year overrides the inferred one, and that the app asks only about years the curve cannot classify; satellites could not tell a failed crop from a weedy fallow in 2021 on two of four test fields.
- Section 7, tile path ending '@1x': it returned image/jpeg in my test. Request '@1x.png' if transparency outside the scene footprint is wanted.

## Risks

- Skipping the offset fix silently corrupts everything from 2022 on: NDVI about 0.26 too low on dense crops, so 2024 would look worse than 2019 and every post-2022 season would raise deficit alerts.
- Thresholds are calibrated on a small, unvalidated sample. Present severities as indicative and keep all constants in one place (they are, at the top of vegspec.py).
- Land-use inference feeds the rotation advice and is weakest exactly in drought years. A wrong 'fallow' label removes a stress alert and distorts the rotation history; the user's declaration has to be easy to give.
- Crop group from peak timing (early, cereal-like, late) is little better than a guess; showing it without the word 'inferred' would overclaim.
- A full-history read for a new field is hundreds of megabytes and about a minute even when threaded; sequential reads would take over 20 minutes. Presets must be precomputed and results cached per scene.
- Upstream gaps: Planetary Computer's MODIS collection lacks half of the 2025 season, and the NASA ORNL subset API timed out today. Do not put either on the demo's critical path.
- SCL leaks cloud edges and haze. The guards (clear fraction, median, despike, peak-based alert) absorbed it on the test squares, but a single hazy scene at the only clear date near the peak can still lower the peak.
- Polygons that include strips, two fields or non-cropland produce misleading medians. PATCHY and the annual-cropland test flag these cases but do not fix them.
- Live alerts will be empty in November. The replay option (alerts as of a past date) is what makes the alert logic visible in the demo.

## Open questions

- Do the thresholds hold on the three demo presets? They come from six 25 ha squares in one Kostanay tile with no ground truth; rerun run_spec.py on the presets before trusting the severity levels.
- Is the MODIS long record worth adding this weekend? It costs a second reader and about 40 s per field uncached, and 2025 is incomplete at the source; it buys the 'worst in N years' statement and a real VCI.
- Was 2022 really a dry year around Karabalyk? Sentinel-2, MODIS and the steppe square agree it was, but I did not check it against POWER rainfall or reported yields.
- Should the ambiguous years (peak NDVI between 0.30 and 0.45) be shown as possible crop failure or stay silent until the user declares the land use? The reference flags them with a 'confirm land use' note.
- Will whole-field polygons of 100 to 500 ha pass the 0.75 clear-fraction test often enough? Larger polygons catch more partial cloud than my interior squares did.
- Can bytes be cut by reading 40 to 80 m overviews for large fields? Untested, and how the SCL overviews were resampled is unknown.

## Findings

- **[verified-live]** Planetary Computer serves Sentinel-2 L2A unharmonised: raw values carry the +1000 shift from processing baseline 04.00 onward.
  - Evidence: Same field, July, median raw B04: 481 (2018, pb 02.12), 914 (2021, pb 03.00), 1852 (2022, pb 04.00/05.10), 1445 (2026, pb 05.12). 0.1th percentile of raw B04: 100 before, 1016 after. Script: docs/research/vegetation-analysis/scripts/explore1.py
- **[source-read]** Planetary Computer's own documentation says the offset propagates to its hosted L2A data and tells users to clip at 1000 and subtract 1000 for scenes from 2022-01-25.
  - Evidence: https://github.com/microsoft/PlanetaryComputerExamples/blob/main/datasets/sentinel-2-l2a/baseline-change.ipynb (harmonize_to_old: cutoff 2022-01-25, offset 1000, bands B01 to B12 and B8A)
- **[source-read]** ESA: the offset is -1000 for L1C and L2A from PB 04.00 (25 January 2022), fixed for all bands and scenes, stored as BOA_ADD_OFFSET_VALUES_LIST; reflectance = (DN + offset) / 10000.
  - Evidence: https://forum.step.esa.int/t/info-introduction-of-additional-radiometric-offset-in-pb04-00-products/35431
- **[verified-live]** Nothing applies the offset automatically: STAC items have no raster:bands scale or offset and the COG headers report scale 1, offset 0.
  - Evidence: rasterio on a pb 04.00 B04 asset: 'scales (1.0,) offsets (0.0,)'; B04 asset keys are proj:*, gsd, type, roles, title, eo:bands only.
- **[verified-live]** The overlay tile expression in the brief is wrong for 2022 onward; the corrected expression works on the data API.
  - Evidence: Item S2C_MSIL2A_20260722T070621_R106_T41UMV_20260722T103609, zonal mean over a cropped square: 0.554 with (B08-B04)/(B08+B04), 0.817 with (B08-B04)/(B08+B04-2000). Both tile requests returned HTTP 200; the naive tile renders the crop orange, the corrected one green.
- **[verified-live]** Baselines at three locations (Kostanay, Akmola, North Kazakhstan): 02.12 for 2015 to 2020, 02.12 and 03.00 in 2021, 04.00 from 2022-01-26, then 05.09 to 05.13. No pre-2022 item carries an offset baseline, so the date rule and the baseline rule agree today.
  - Evidence: STAC search tally per year, May to September, script docs/research/vegetation-analysis/scripts/baseline_tally.py
- **[verified-live]** 2022 and 2023 contain the same acquisition twice under two baselines; they must be deduplicated.
  - Evidence: Duplicate datetimes per May to September season: 38 to 47 in 2022 (04.00 plus 05.10), 37 to 50 in 2023 (05.09 plus 05.10).
- **[verified-live]** Usable Sentinel-2 history starts in 2018, giving 8 complete baseline seasons before 2026, fewer once fallow years are removed.
  - Evidence: Scenes per May to September season at the three locations: 1 to 5 in 2015, 21 to 29 in 2016, 32 to 47 in 2017, about 60 from 2018, 72 to 76 in 2025 and 2026 (three satellites).
- **[verified-live]** Field NDVI from partly cloudy scenes is biased low, and the bias grows as the clear fraction falls; 0.75 is the lowest defensible acceptance threshold and the median beats the mean.
  - Evidence: 1,120 observations against interpolation between fully clear neighbours: share more than 0.10 too low = 39 % (clear 0.05 to 0.25), 16 % (0.25 to 0.50), 10 % (0.50 to 0.75), 6 % (0.75 to 0.90), 3 % (0.90 to 0.99), 1 % (>= 0.99). Median absolute error 0.068 down to 0.015.
- **[verified-live]** The brief's tile-level filter eo:cloud_cover < 20 discards about half the usable scenes and does not improve quality.
  - Evidence: One square, scenes kept / empty dekads of 15: 2024 7 / 9 with the filter against 17 / 5 with cloud < 80 and field clear >= 0.75; 2022 12 / 7 against 21 / 5. For fully clear fields the error is the same at 0 to 20 % and 60 to 80 % tile cloud (median 0.014 and 0.019).
- **[verified-live]** With the recommended filter a season from 2018 yields 14 to 42 accepted scenes and 0 to 5 empty dekads of 15; 2024 is the cloudiest.
  - Evidence: Six test squares, script docs/research/vegetation-analysis/scripts/explore2.py
- **[verified-live]** SCL class 11 (snow) in summer is almost always bright cloud; class 2 behaves as cloud shadow on this flat terrain; bare dark soil is class 5 on clear days. Only classes 4 and 5 should count as valid.
  - Evidence: Snow flagged on 2019-08-08, 2019-07-04 and 2018-06-24, always alongside heavy cloud; one scene with 73 % class 2 over a cropped field under broken cloud; a fallow square was 100 % class 5 on every clear date of 2022.
- **[source-read]** SCL class values 0 to 11 and their labels.
  - Evidence: https://sentiwiki.copernicus.eu/web/s2-processing
- **[source-read]** A published precedent for the despike rule: SCL masks miss cloud shadows, thin clouds and cloud-adjacent pixels, which lower NDVI; the authors remove drops of 0.15 followed by a recovery of 0.15.
  - Evidence: https://arxiv.org/abs/2403.09554 (Tsardanidis et al. 2024, methods section, read from the PDF text)
- **[source-read]** JRC ASAP: a pixel is critical when the z-score of cumulative NDVI is below -1 and the mean NDVI difference is below -10 % of the historical mean; a unit is warned when critical area exceeds 25 % of active crop area; levels 1 to 4 depend on indicator agreement and growth stage. It works in dekads with a Whittaker smoother (lambda 3000) and season thresholds at 25 %, 75 % and 35 % of amplitude.
  - Evidence: https://agricultural-production-hotspots.ec.europa.eu/files/asap_warning_classification_v_4_0.pdf
- **[source-read]** FAO ASIS counts cropland pixels whose season-mean Vegetation Health Index is below 35 %, in dekads; NOAA classes VHI 36 to 40 light, 26 to 35 moderate, 16 to 25 severe, 6 to 15 extreme, 0 to 5 exceptional drought.
  - Evidence: https://www.fao.org/giews/earthobservation/asis/index_1.jsp and https://www.star.nesdis.noaa.gov/smcd/emb/vci/VH/vh_browseVH.php
- **[source-read]** GEOGLAM Crop Monitor classes are analyst judgements defined by expected yield against a five-year average (Poor 5 to 25 % below, Failure 25 % or more below), with a named driver; there is no NDVI threshold.
  - Evidence: https://www.cropmonitor.org/global-classification-system
- **[memory]** NASA Harvest GLAM and USDA Crop Explorer show MODIS NDVI and its anomaly through crop masks for analysts to interpret; I found no published alert thresholds.
  - Evidence: Search summaries only (glam.nasaharvest.org, ipad.fas.usda.gov); the pages themselves were not opened successfully.
- **[verified-live]** Same-date comparison against the multi-year median false-alarms when the crop or sowing date changes; a peak-based rule does not.
  - Evidence: A season that peaked at 0.78 in September (the field's best integral) scored 47 % of the same-dekad median in July and was flagged severe by the first version of the rules; the peak-based version raised no deficit alert. Same pattern on a second square (0.81 peak, 89 %).
- **[verified-live]** With eight seasons the z-score is noisy and VCI is degenerate; percent of median peak is the stable metric.
  - Evidence: Peak NDVI standard deviation across cropped years: 0.07 to 0.17 depending on square and year left out (n = 4 to 8). VCI on the Sentinel-2 record was 0 for the worst year and 100 for the best on every square.
- **[verified-live]** NDMI at the peak separates dry seasons but moves with NDVI rather than ahead of it.
  - Evidence: NDMI at peak 0.12 to 0.44 in normal-peak years against -0.07 to 0.13 in low-peak years; difference from the usual value -0.19 to -0.33 in low years, never below -0.11 otherwise. In June 2021 NDVI and NDMI fell together scene by scene.
- **[verified-live]** MODIS MOD13Q1 tracks Sentinel-2 at the centre of these large fields well enough to rank years, but not to mix sensors.
  - Evidence: Peak NDVI, 3x3 MODIS pixels against Sentinel-2, 2016 to 2026, six squares: correlation 0.94, 0.91, 0.60, 0.74, 0.77, 0.97; bias +0.01 to +0.08; RMSE 0.04 to 0.17. No step across 2022, which also confirms the offset fix.
- **[verified-live]** The 2000-onward record gives a statement Sentinel-2 cannot: on one cropped square 2021 was the second-lowest peak of 26 years.
  - Evidence: Square A, MODIS: 2021 peak 0.44 = 60 % of median, z -2.6, VCI 4, rank 2 of 26 (2010 lowest); 2024 106 %, VCI 80. Steppe square: 2021 rank 1 of 26.
- **[verified-live]** Planetary Computer's modis-13Q1-061 has defects: the platform property is missing on many items, and composites for day-of-year 193 to 305 of 2025 are absent.
  - Evidence: 2001: 15 of 24 items without platform; 2024: 19 of 24. 2025 MOD13Q1 dates jump from 177 to 321 at Kostanay, Akmola and a US location. 603 composites x 3 layers x 6 points read in 40 s.
- **[verified-live]** The NASA ORNL DAAC MODIS subset API was not usable today.
  - Evidence: GET https://modis.ornl.gov/rst/api/v1/MOD13Q1/dates returned HTTP 504 after 61 s; two further requests timed out at 20 and 25 s.
- **[verified-live]** HLS on Planetary Computer starts on 2020-01-01, so it adds nothing as a long baseline.
  - Evidence: Collection metadata for hls2-s30 and hls2-l30: temporal interval starts 2020-01-01T00:00:00Z. modis-13Q1-061 starts 2000-02-18.
- **[verified-live]** In this region bare tilled soil reads NDVI 0.14 to 0.23, summer fallow 0.16 to 0.26, stubble 0.18 to 0.45. NDVI < 0.22 misses 41 % of fallow observations; 0.25 misses 15 %.
  - Evidence: Fully clear observations on four cropland squares: seedbed n = 80, 89 % under 0.22 and 95 % under 0.25; summer fallow n = 27, 59 % and 85 %; stubble n = 82, 27 % and 39 %.
- **[verified-live]** NBR2 = (B11-B12)/(B11+B12) separates tilled soil from stubble at about 0.06; NDVI cannot.
  - Evidence: NBR2 median 0.02 (seedbed), 0.03 (fallow), 0.15 (stubble), 0.26 (canopy). Share under 0.06: 75 %, 81 %, 4 %, 0 %. One field dropped from 0.12 and 0.10 in early May 2018 to 0.035 and 0.013 after seeding.
- **[source-read]** Published thresholds for exposed soil: NDVI < 0.25 and NBR2 < 0.07, with crop development marked by NDVI > 0.6.
  - Evidence: https://meetingorganizer.copernicus.org/EGU21/EGU21-11153.html (Dvorakova and van Wesemael 2021)
- **[memory]** Castaldi et al. 2019 found NBR2 0.05 best; NBR2 equals the Normalized Difference Tillage Index of van Deventer 1997; wet soil raises NBR2 and can mimic residue.
  - Evidence: Search summaries only; the papers were not opened.
- **[source-read]** Field-level MODIS NDVI curves have separated cropland, fallow, hayfield and unused land in Akmola with 92 % overall accuracy; fallow stays under 0.5 and flat; sowing May to early June, peak late July to early August, harvest from late August.
  - Evidence: https://acrs-aars.org/proceeding/ACRS2019/TuC2-1.pdf (Bekbayeva et al. 2019)
- **[verified-live]** Land use from the curve is unreliable in drought years and for anything between clearly cropped and clearly bare.
  - Evidence: Rules applied to four cropland squares: 2021 gave two 'ambiguous' and one 'fallow' label; a fallow square reached 0.58 for a single dekad (caught by the three-dekad rule); the steppe square was labelled cropped, fallow or ambiguous in different years until the field-level May-greenness test excluded it.
- **[verified-live]** Within-field NDVI spread (p90 minus p10) is about 0.11 for a uniform crop and rises under stress.
  - Evidence: Interior squares, cropped years, while green: median 0.11, 90th percentile 0.20, maximum 0.28. One square: 0.07 to 0.10 in good years, 0.22 in 2021 and 0.28 in 2022.
- **[verified-live]** The six alert rules behave sensibly on real data: good years silent, dry years flagged, fallow years reported as bare soil only, a late crop not flagged.
  - Evidence: docs/research/vegetation-analysis/out/run_spec_output.txt: 2018, 2024, 2025, 2026 at most a watch; 2021 and 2022 warning or severe on three of four cropland squares; fallow years 90 to 130 bare days against mostly 20 to 80 when cropped. The synthetic self-check in vegspec.py prints 'demo OK'.
- **[verified-live]** The planned reader (pystac-client, planetary-computer, odc-stac) reproduces direct rasterio values, and polygon masking needs no new dependency.
  - Evidence: docs/research/vegetation-analysis/scripts/odc_reader_check.py: NDVI equal to three decimals on 9 scenes. rasterio.features.geometry_mask on the odc-stac grid: 106 ha polygon, 2,658 pixels, NDVI median 0.813.
- **[verified-live]** Reading history is slow and heavy unless parallelised: sequential odc-stac took about 2.7 s per scene, and every window read pulls a whole 512 x 512 block.
  - Evidence: 9 scenes in 24 s sequentially. Threaded rasterio: 584 scenes x 8 bands x 6 windows in 353 s, more than 6.6 GB transferred (nettop). COG block size 512 x 512, deflate.
- **[verified-live]** The Planetary Computer data API can do zonal statistics server-side but cannot exclude masked pixels, so it is only correct for nearly cloud-free scenes.
  - Evidence: POST /api/data/v1/item/statistics with a GeoJSON polygon: SCL histogram via assets=SCL&categorical=true works; where(...) expression works but nodata=-9999 returns HTTP 500. Fully clear scene: median 0.751 against 0.750 locally. About 1.2 s per call.
- **[memory]** The real MODIS footprint is larger than the nominal 250 m pixel and shifts between dates, so only pixels well inside a field are pure; northern Kazakhstan fields were abandoned and recultivated after 2000; strip cropping is used against wind erosion there.
  - Evidence: Recall of Tan et al. 2006, Duveiller and Defourny 2010 and regional literature; not opened today.
- **[memory]** ESA validation gives SCL a balanced accuracy of about 95 % without snow and 77 % with snow, and Sen2Cor applies no dilation around clouds.
  - Evidence: Search summaries of ESA validation slides and the CMIX report; the documents were not opened.

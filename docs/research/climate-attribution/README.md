# Climate diagnosis from NASA POWER

Research note from the design phase, 2026-11-14. Each finding is tagged: `verified-live` (a command was run), `source-read` (the cited source was read) or `memory` (unverified recall). Paths to scratch files that were not kept in the repo are historical.

## Recommendation

Build the diagnosis as plain deterministic rules on NASA POWER alone; it is enough, and it reproduces the demo story. At Kostanay, 2021 comes out as 94 mm of May-August rain (53% of the 2001-2026 median) with 45 days above 30 C, and 2024 as 283 mm (160%) with 5 such days. Cache one POWER file per grid cell on disk (1981 to today is about 5 MB and 4 seconds), because every point in a 0.5 x 0.625 degree cell returns the same series; so yes, keep the history locally instead of re-fetching. Rank each indicator inside crop-stage windows (sowing to flowering, flowering, grain fill, harvest) against the cell's own 1991-2020 history, because a May-August total hides the 2021 damage. Use Hargreaves for reference evapotranspiration and the Selyaninov coefficient as the headline drought index, since Kazhydromet uses it operationally. Add IMERG rainfall from the same POWER API as the second opinion, and treat ERA5 through Open-Meteo as an optional agreement badge. Do not claim a drying or warming trend: POWER shows none that is significant in the growing season here, so show year-to-year variability and drought frequency instead. Keep the LLM out of the analysis and use it, if at all, only to phrase the computed evidence.

## Spec

**Not delivered:** the long `report.md` was not written, because the harness blocks subagents from writing report files. Its content is condensed here and in the findings. Working scripts and raw outputs are in `docs/research/climate-attribution/scripts/` (`climate_metrics.py`, `diagnose.py`, `analyse.py`, `compare_sources.py`, `*_output.txt`); downloads are in `.../climate-attribution/downloads/`.

## API (v2.10.3, checked 2026-11-14)
`https://power.larc.nasa.gov/api/temporal/daily/point?parameters=...&community=AG&latitude=..&longitude=..&start=19810101&end=YYYYMMDD&format=JSON`
- Maximum 20 parameters per request. Start must be >= 1981-01-01. Fill value is -999.
- No reference-ET parameter exists. `FROST_DAYS` exists but matched the count of `T2M_MIN <= 0` in both seasons checked.
- Latency depends on `time-standard`:

| Request | Meteorology and soil wetness | Radiation | IMERG |
| --- | --- | --- | --- |
| LST (default) | 2026-11-10 (4 days) | 2026-11-09 | unavailable |
| UTC | 2026-11-12 (2 days) | 2026-08-31 | 2026-09-14 |

- Cache key: `lat_c = round(lat*2)/2`; `lon_c = round((lon+180)/0.625)*0.625-180`.
- Call 1 (LST, cached per cell): `T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,GWETROOT,GWETTOP,EVLAND`.
- Call 2 (optional, UTC, from 1998): `IMERG_PRECTOT,PRECTOTCORR`.
- Climatology endpoint `/api/temporal/climatology/point` accepts `start=1991&end=2020` but is monthly only; compute normals from the daily series.

## Metrics (numpy only, baseline 1991-2020)
- **Rain anomaly:** `pct = 100*P/mean`, `z = (P-mean)/sd`, plus empirical percentile. This is a z-score, not SPI.
- **Dry spell:** longest run of `PRECTOTCORR < 1.0` mm.
- **Stages:** `GDD = cumsum(max(T2M,0))` from sowing (default 15 May, editable). Thresholds: emergence 140, jointing 620, anthesis 850, grain fill 1070, maturity 1600 (Miller et al. 2001 ranges: 125-160, 592-659, 807-901, 1068-1174, 1538-1665).
- **Heat:** days `T2M_MAX >= 31` and `>= 35` in anthesis +/- 7 days; days `>= 35` in grain fill (Porter and Gawith maxima: 31.0 at anthesis, 35.4 at grain fill).
- **Frost:** `T2M_MIN <= -4` at seedling stage, `<= 0` from jointing to flowering, `<= -2` in grain fill (K-State C646: -4, -1, -2 C; I widened -1 to 0 for reanalysis error).
- **ET0 (Hargreaves, FAO-56 eq. 52):** `0.0023*(Tmean+17.8)*sqrt(Tmax-Tmin)*0.408*Ra`, where `Ra = 24*60/pi*0.0820*dr*(ws*sin(phi)*sin(dec)+cos(phi)*cos(dec)*sin(ws))`, `dr = 1+0.033*cos(2*pi*J/365)`, `dec = 0.409*sin(2*pi*J/365-1.39)`, `ws = arccos(-tan(phi)*tan(dec))`.
- **Water balance:** `sum(P)-sum(ET0)` and `P/ET0`. No custom soil bucket; GWETROOT already is one.
- **Selyaninov HTC:** `sum(P)/(0.1*sum(T))` over days with `T2M > 10`. Proposed classes: < 0.4 very severe, 0.4-0.6 severe, 0.6-0.8 moderate, 0.8-1.0 mild, 1.0-1.5 adequate, > 1.5 excess.
- **Soil wetness:** window mean of GWETROOT or GWETTOP as a percentile of the same calendar window.
- **Trends:** Theil-Sen slope per decade and Mann-Kendall p (tie-corrected, `math.erf`), for 1991-2025.

## Attribution table
Windows: `pre` = sowing to anthesis + 7 days; `flower` = anthesis +/- 7 days; `fill` = flowering end to maturity; `harvest` = 15 Aug to 20 Sep.

| Cause | Evidence (points) | Flag at |
| --- | --- | --- |
| Water deficit | rain in `pre` <= 50% of normal (2) or <= 70% (1); HTC in `pre` < 0.4 (2) or < 0.6 (1); dry spell >= 15 days and top quarter (1); GWETROOT percentile <= 20 (1) | 3 |
| Heat at a sensitive stage | >= 2 days >= 35 C in `flower` (2); >= 5 days >= 31 C in `flower` and top quarter (2); >= 2 days >= 35 C in `fill` and top quarter (2) | 2 |
| Frost damage | seedling <= -4 C (2); jointing to flowering <= 0 C (3); grain fill <= -2 C (2) | 2 |
| Excess rain at harvest | rain percentile >= 80 (1); wet-day percentile >= 80 (1); GWETTOP percentile >= 85 (1) | 2 |
| Not explained by weather | field NDVI low and none of water, heat or frost flagged | |

- **Confidence:** high = score at least 2 above the flag level; medium = flagged; low = the surrounding region's NDVI is normal, or the second rain source disagrees.
- **Back-test over 36 seasons:** water deficit 10 (1991, 1995, 1998, 2001, 2004, 2009, 2010, 2012, 2013, 2021), heat 13, frost 0, wet harvest 7 (including 2023, 2024, 2025).

## 2021 versus 2024 at 53.2 N, 63.6 E
| Metric | 2021 | 2024 | Reference |
| --- | --- | --- | --- |
| May-Aug rain | 93.8 mm | 283.2 mm | 2001-2026 median 176.9 |
| Days above 30 C | 45 | 5 | median 20.5 |
| Rain, sowing to flowering | 13 mm (19% of normal) | 100 mm (127%) | |
| HTC May-Aug | 0.37 | 1.33 | 1991-2020 mean 0.66 |
| Peak Tmax | 40.4 C on 2 July | 31.6 C | |
| Longest dry spell | 34 days | 12 days | mean 17.5 |
| Rule scores (water / heat) | 6 / 4 | 0 / 0 | flag at 3 / 2 |

## Trends 1991-2025
| Series | POWER slope per decade (p) | ERA5 |
| --- | --- | --- |
| May-Aug rain | +17.8 mm (0.09) | +2.4 mm (0.78) |
| May-Aug mean temperature | -0.03 C (0.93) | +0.29 C (0.20) |
| Hot days | -1.6 (0.37) | +1.3 (0.29) |
| Annual rain | +34.8 mm (0.02) | +14.5 mm (0.36) |

Show the farmer a 35-year strip of seasons coloured by HTC class, the drought count per decade (3, 4, 2, 1), and a plain "no clear trend" chip per metric.

## Second sources
- **IMERG via POWER:** r = 0.86 with PRECTOTCORR on May-Aug sums and 18% wetter; it agrees on both demo years.
- **Open-Meteo `models=era5`:** no key, 1.1 s for 36 years; HTC 0.36 and 1.37 against POWER's 0.37 and 1.33. Free tier is non-commercial.
- **CHIRPS:** v2 stops at 50 N; v3 reaches 60 N but has no point API.

## Corrections this made to the first brief

- Section 5 says 'no database', which stays true, but add that raw POWER series are cached on disk per grid cell (0.5 x 0.625 degree), about 5 MB per cell for 1981 to today. This answers the request's question: keep the history locally, refresh only the tail.
- Section 7, climate row: 'about 50 km' is precisely 0.5 x 0.625 degree for meteorology (about 55 x 42 km at 53 N) and 1 x 1 degree for radiation. Any two fields in one cell get identical weather.
- Section 7, climate row: note the time-standard trap. Default LST gives no IMERG; UTC gives IMERG but radiation only to 2.5 months ago. Use LST for the main call and a separate UTC call for IMERG_PRECTOT.
- Section 7, parameter list: ALLSKY_SFC_SW_DWN is not needed if ET0 uses Hargreaves. Add EVLAND, and IMERG_PRECTOT as the NASA second opinion.
- Section 5, diagnosis: 'root-zone soil wetness' must be used as a percentile against the cell's own history and only as supporting evidence. Its raw range is tiny and it lagged the 2021 drought.
- Section 5, diagnosis: 'rainfall deficit' and 'heat days' should be measured in crop-stage windows from a user-editable sowing date, not over May to September as a block.
- Section 5, diagnosis: 'frost days' will almost never fire. With mid-May sowing POWER shows no damaging frost between emergence and maturity in 36 seasons at Kostanay; show the first autumn frost date instead.
- Section 4: the 40 C claim is correct for POWER (40.42 C on 2 July 2021); ERA5 says 39.4 C. Worth wording as 'NASA POWER shows'.
- Section 4 or 5: add excess rain at harvest as a diagnosis class. It flags 2023 and 2024, so the 'very good' 2024 season also carries a wet-harvest caveat.
- Anywhere the brief implies 'shifting weather and water trends' as a drying or warming story: POWER does not support that at this cell. Lead with variability and drought frequency.

## Risks

- Absolute heat-day counts depend on the data source: POWER averages 23.5 days above 30 C per season here against 17.5 in ERA5. The rules therefore combine a physiological threshold with a top-quarter test, but the heat flag still fires in 13 of 36 seasons.
- Heat and drought arrive together (5 of the 10 drought seasons also flag heat), so the tool cannot say which one did the damage; it should show both.
- Stage dates come from a default sowing date and a Canadian GDD table; they can be one to two weeks off for local varieties, which shifts the flowering window.
- Rainfall at 53 N is roughly half model-generated in MERRA-2, and one cell covers about 55 x 42 km. Local storms, hail and frost hollows are invisible.
- Trend results are fragile: POWER and ERA5 disagree on the sign of the temperature trend. A confident trend statement in the demo could be challenged.
- POWER's rate limit is unpublished. Without the per-cell cache, a burst of freshly drawn fields could hit HTTP 429.
- The rule thresholds were calibrated on a single grid cell (Kostanay). The Akmola and North Kazakhstan presets were not back-tested.
- The long report file was not written (blocked by the harness), so the caller only has this output plus the scripts and their text outputs.

## Open questions

- Sowing date per field and year: the stage windows depend on it. Default 15 May, but should the user enter it? In 2024 a wet spring reportedly pushed sowing later.
- Which HTC class table to print: Kazhydromet's exact gradation was not found online, and the literature has several. The proposed edges are consistent with two Kazakh sources but partly reconstructed.
- Is the regional NDVI comparison (field versus surrounding MODIS NDVI) available from the vegetation side? The confidence rule and the 'not explained by weather' label rely on it.
- Station truth for Kostanay was not checked, so the size of POWER's local bias in Tmax and rain is unknown; only ERA5 and IMERG were compared.
- Why RZMC_PRCNTL (SMAP root-zone percentile) returns only fill values at this point was not established.
- Whether a hackathon demo counts as non-commercial use under Open-Meteo's terms is not stated on their page.

## Findings

- **[verified-live]** The AG daily catalogue has 152 parameters and includes all of T2M, T2M_MAX, T2M_MIN (C), PRECTOTCORR (mm/day), GWETROOT, GWETTOP, GWETPROF (0 to 1), ALLSKY_SFC_SW_DWN (MJ/m^2/day), WS2M (m/s), RH2M (%), T2MDEW (C), EVPTRNS (MJ/m^2/day, 'Evapotranspiration Energy Flux') and EVLAND (mm/day).
  - Evidence: curl https://power.larc.nasa.gov/api/system/manager/parameters?community=AG&temporal=daily (HTTP 200, 46 kB), parsed with jq
- **[verified-live]** POWER has no reference-evapotranspiration parameter in AG daily; it must be computed.
  - Evidence: Requests with parameters=ET0 returned HTTP 422 'One of your parameters is incorrect: ET0.'; PET and ET0 are absent from the catalogue keys
- **[verified-live]** A frost-day parameter exists (FROST_DAYS, defined as 2 m temperature cooling to the dew point with both below 0 C), but in the two seasons checked it equals the count of days with T2M_MIN <= 0.
  - Evidence: Catalogue definition; May-Sep sums 4 vs 4 (2021) and 8 vs 8 (2024) in scripts/analysis_output.txt section F
- **[verified-live]** Maximum 20 parameters per point request.
  - Evidence: 21 parameters returned HTTP 422: 'A maximum of 20 parameters are can currently be requested in one submission.'
- **[verified-live]** Temporal extent starts 1981-01-01; radiation is valid from 1984-01-01 and IMERG_PRECTOT from 1998-01-01 at this point.
  - Evidence: start=19800101 returned 422 'The data starts at 1981/01/01'; first-valid dates computed with jq on the 1981-2026 downloads
- **[verified-live]** Latency on 2026-11-14 depends on the time standard. Default LST: meteorology and soil wetness last valid 2026-11-10, radiation 2026-11-09. UTC: meteorology and soil wetness 2026-11-12, radiation 2026-08-31, IMERG 2026-09-14. Soil wetness has the same latency as meteorology.
  - Evidence: Last non-fill date per parameter in downloads/power_lst_1981_2026.json and downloads/power_2026_20p.json
- **[verified-live]** IMERG_PRECTOT is served by POWER only for UTC requests.
  - Evidence: LST response message: 'The IMERG Source Data is not available at the Local Solar Time (LST) standard.'
- **[verified-live]** Meteorology is on a 0.5 x 0.625 degree grid and radiation on 1 x 1 degree; any point in the same cell returns identical values.
  - Evidence: (53.2,63.6), (52.8,64.0) and (53.24,63.45) returned identical T2M_MAX and rain for 1-3 July 2021; (53.3,63.6) and (53.2,63.4) differed. Resolution stated at https://power.larc.nasa.gov/docs/methodology/
- **[verified-live]** Timing with curl: 2001-2025 with 20 parameters took 4.7 s for 3.00 MB; the brief's 7 parameters took 1.8 s for 1.05 MB JSON (0.43 MB CSV); 1981-2026 with 19 parameters took 4.1 s for 5.22 MB.
  - Evidence: curl -w time_total and size_download on the daily point endpoint for 53.2 N, 63.6 E
- **[source-read]** No rate-limit number is published; the docs only list HTTP 429. About 20 requests in this session produced no 429.
  - Evidence: https://power.larc.nasa.gov/docs/services/api/ and https://packages.ropensci.org/nasapower/doc/manual.html ('limit queries to prevent server overloads', no figures)
- **[verified-live]** The climatology endpoint works with a custom period but returns only monthly and annual values, and its T2M_MAX is the period extreme, not the mean daily maximum.
  - Evidence: /api/temporal/climatology/point with start=1991&end=2020 returned 'January 1991 - December 2020'; default range was January 2001 - December 2025; T2M_MAX JUL = 39.74
- **[source-read]** POWER docs: MERRA-2 runs to about a month behind real time, GEOS-IT fills the tail within about two days, and trend analysis should end 2 months before real time. Global validation: daily Tmax bias -1.23 C and RMSE 3.10 C, daily Tmin RMSE 3.15 C, daily precipitation RMSE 3.69 mm/day.
  - Evidence: https://power.larc.nasa.gov/docs/methodology/data/sources_meteorology/
- **[verified-live]** Demo story holds. 2001-2026 medians: May-Aug rain 176.9 mm, 20.5 days above 30 C. 2021: 93.8 mm (53%, third driest after 2004 and 2010) and 45 days (most). 2024: 283.2 mm (160%, wettest) and 5 days (fewest).
  - Evidence: scripts/analysis_output.txt section A, computed from downloads/power_lst_1981_2026.json
- **[verified-live]** POWER gives T2M_MAX = 40.42 C at Kostanay on 2 July 2021, as the brief says; ERA5 gives 39.4 C for the same day.
  - Evidence: jq on the POWER download; scripts/compare_output.txt last line
- **[verified-live]** A May-August total hides the 2021 damage: rain from sowing to end of flowering was 13 mm (19% of normal, lowest on record) while July had 69 mm (146% of normal) after flowering. Stage windows are needed.
  - Evidence: scripts/diagnose_output.txt (2021 facts) and scripts/analysis_output.txt section B (p_month)
- **[verified-live]** GWETROOT is a weak, lagging indicator: June-July means span only 0.55 to 0.65 over 30 years, and in 2021 it sat at the 40th percentile in June-July before falling to the 2nd percentile by 15 Aug-15 Sep.
  - Evidence: scripts/analysis_output.txt sections B, C and F
- **[verified-live]** Hargreaves is an adequate ET0: over 36 seasons Hargreaves / Penman-Monteith = 0.97 with r = 0.97, and my extraterrestrial-radiation formula matches POWER's TOA_SW_DWN (r = 0.9998, bias -0.09 MJ). The Penman-Monteith code reproduces the FAO-56 worked example (3.9 mm/day).
  - Evidence: scripts/analysis_output.txt section D; demo() assertion in scripts/climate_metrics.py; formulas read at https://www.fao.org/4/x0490e/x0490e07.htm
- **[source-read]** Selyaninov HTC is the operational agro-drought index in Kazakhstan: Kazhydromet staff write that they monitor atmospheric drought with percent of normal precipitation and 'the hydrothermal coefficient of G.T. Selyaninov, the most widespread in agrometeorology'. Formula: P / (0.1 x sum of daily mean T) over the period with T above 10 C.
  - Evidence: https://journal.kazhydromet.kz/kazgidro/article/download/144/132/6742 (Kozhakhmetov et al. 2016); formula in https://ges.rgo.ru/jour/article/download/121/122; Kazakhstan listed as user at https://www.droughtmanagement.info/?p=2012
- **[source-read]** HTC class anchors: below 0.4 is 'the most adverse conditions for the cereal crops' (most of Kostanay region in 2010); a Kazhydromet paper calls May-July HTC 0.46-0.58 strongly arid, 0.66-0.77 moderately arid and 0.80-0.91 slightly arid.
  - Evidence: https://ges.rgo.ru/jour/article/download/121/122 and https://journal.kazhydromet.kz/kazgidro/article/download/297/309/7327 (Baisholanov 2010)
- **[memory]** The upper HTC classes (1.0-1.5 adequate, above 1.5 excess) and the exact 0.2-step edges are my reconstruction; Kazhydromet's published table was not found.
  - Evidence: Three searches returned differing gradations (for example 0.4 / 0.5 / 0.6, and zone scales 0.4 / 0.7 / 1.0 / 1.3 / 1.6)
- **[source-read]** Wheat heat thresholds (Porter and Gawith 1999, as tabulated by Luo 2011): anthesis optimum 21.0 C and maximum 31.0 C; grain filling optimum 20.7 C and maximum 35.4 C (+/-2.0). 35 C for a short period around anthesis severely reduces yield.
  - Evidence: Table 1 and section 3.1 of https://pagesperso.locean-ipsl.upmc.fr/escape/luo2011.climaticchange.pdf (DOI 10.1007/s10584-011-0028-6)
- **[source-read]** Wheat frost thresholds (two hours of exposure): tillering -11 C, jointing -4 C, boot -2 C, heading -1 C, flowering -1 C, milk -2 C, dough -2 C.
  - Evidence: Table 1 of https://bookstore.ksre.ksu.edu/pubs/C646.PDF (K-State C646), extracted with pdftotext
- **[source-read]** Hard red spring wheat stages in GDD base 0 C: emergence 125-160, tillering 369-421, stem elongation 592-659, anthesis 807-901, seed fill 1068-1174, dough 1434-1556, maturity 1538-1665.
  - Evidence: Table 1 of https://landresources.montana.edu/soilfertility/documents/PDF/pub/GDDPlantStagesMT200103AG.pdf (Miller, Lanier, Brandt 2001)
- **[verified-live]** Rule back-test at this cell over 36 seasons: water deficit flags 10 (1991, 1995, 1998, 2001, 2004, 2009, 2010, 2012, 2013, 2021), heat 13, frost 0, wet harvest 7. 2021 scores water 6 and heat 4; 2024 scores 0 and 0.
  - Evidence: scripts/diagnose_output.txt; assertions in demo() of scripts/diagnose.py pass
- **[source-read]** At 53 N, PRECTOTCORR is only partly gauge-based: MERRA-2 tapers from gauge-based to model precipitation between 42.5 and 62.5 degrees latitude. Roughly 47% gauge weight at 53.2 N is my linear interpolation.
  - Evidence: https://nordata.physics.utoronto.ca/en/annexes-datasets-descriptions/72-precipitation/modern-era-retrospective-analysis-for-research-and-applications-version-2-merra-2/ (cites Reichle et al. 2017, doi:10.1175/JCLI-D-16-0570.1)
- **[source-read]** MERRA-2 does not assimilate station 2 m temperature.
  - Evidence: https://nordata.physics.utoronto.ca/en/annexes-datasets-descriptions/71-temperature/modern-era-retrospective-analysis-for-research-and-applications-version-2-merra-2
- **[verified-live]** IMERG via POWER agrees with PRECTOTCORR on the demo years: May-Aug sums r = 0.86 over 2001-2025, IMERG 18% wetter; 2021 is 71% of the IMERG mean (54% in PRECTOTCORR) and 2024 is 155% (164%).
  - Evidence: scripts/analysis_output.txt section G, from downloads/power_25y_20p.json (UTC)
- **[verified-live]** Open-Meteo ERA5 agrees with POWER on the demo years but differs in level: HTC 2021 0.36 vs 0.37 and 2024 1.37 vs 1.33; May-Aug rain r = 0.79; POWER daily Tmax is 0.71 C warmer (RMSD 1.84 C, r = 0.96), giving 23.5 vs 17.5 hot days per season.
  - Evidence: scripts/compare_output.txt and the inline run; https://archive-api.open-meteo.com/v1/archive with models=era5
- **[verified-live]** Open-Meteo needs no key but meters by weight: one 36-year request cost 374-468 of a 600-per-minute budget and the next request got HTTP 429. Free tier is non-commercial, CC BY 4.0, 600/min, 5,000/h, 10,000/day. Its ERA5-Land model returned null precipitation for all 13,101 days.
  - Evidence: X-RateLimit-* response headers in downloads/om_hdr.txt and om_hdr2.txt; https://open-meteo.com/en/terms; jq count on downloads/om_era5land_1991_2026.json
- **[source-read]** CHIRPS v2 stops at 50 N. CHIRPS v3 reaches 60 N at 0.05 degree from 1981, but offers only bulk files (22.9 MB per monthly global GeoTIFF), with no point API.
  - Evidence: https://data.chc.ucsb.edu/products/CHIRPS/v3.0/README-CHIRPSv3.0.txt ('A 10 degree increase in spatial extent. CHIRPS v3.0 extends to 60N-60S'); HEAD request on chirps-v3.0.2021.06.tif
- **[verified-live]** No significant growing-season trend at this cell for 1991-2025 in POWER: May-Aug rain +17.8 mm/decade (p 0.09), May-Aug mean temperature -0.03 C/decade (p 0.93), hot days -1.6/decade (p 0.37), HTC +0.07/decade (p 0.13). Only annual rain (+34.8 mm/decade, p 0.02) and Nov-Mar rain (+7.3 mm/decade, p 0.03) are significant.
  - Evidence: scripts/analysis_output.txt section E
- **[verified-live]** ERA5 disagrees with POWER on the sign of the temperature trend (May-Aug +0.29 C/decade, p 0.20; annual +0.28 C/decade, p 0.06) and does not confirm the rain increase (annual +14.5 mm/decade, p 0.36).
  - Evidence: scripts/compare_output.txt and inline comparison run on downloads/om_era5only_1991_2026.json
- **[memory]** 2021 was a real drought year for the region: Kazakhstan expected its 2021 grain crop to fall about 24%, and one analysis put Kostanay grain yield 43% below 2020. In 2024, early-September rain lowered grain quality.
  - Evidence: Search-result summaries of https://www.producer.com/news/kazakhstan-sees-2021-grain-crop-down-24-due-to-drought and USDA FAS reports; pages not opened

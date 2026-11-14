# Northern Kazakhstan agronomy and crop catalogue

Research note from the design phase, 2026-11-14. Each finding is tagged: `verified-live` (a command was run), `source-read` (the cited source was read) or `memory` (unverified recall). Paths to scratch files that were not kept in the repo are historical.

## Recommendation

Keep the northern grain belt as the target: the evidence holds up and the rotation debate there is real and current. Change the baseline, though. Bare fallow is now only 8 to 14% of arable land in the three regions and much of North Kazakhstan is continuous wheat, so the baseline card should score the rotation the user declares, with "fallow, wheat, wheat, barley" and "continuous wheat" as presets. Compute every number and every crop choice with deterministic rules over the catalogue JSON I drafted, because the rubric scores transparent evidence and a rule can be shown on screen; use an LLM only afterwards to turn a finished card into plain prose or answer "why not this crop" from the same JSON. For the demo, use 2021 against 2024 on the Kostanay preset and 2023 against 2024 on the Akmola preset, since 2023 was as bad as 2021 nationally and worse in Akmola. Fix the bare-soil alert before building on it: NDVI below 0.22 in May is a normal seedbed, so test the mid-June to mid-August peak instead. On keeping history: yes, store the derived per-field and per-point series locally rather than re-fetching, because Planetary Computer's MODIS collection has a five-month hole in 2025 and a multi-year series costs hundreds of requests. The long report file was not written (the harness refused a report-file write from this agent), so the evidence is carried in the findings below, the catalogue JSON and the scripts.

## Spec

**Files** (under `docs/research/kazakhstan-agronomy/`): `out/crop_catalogue.draft.json` (12 crops plus fallow, every column, source per row, `_j` keys = my judgement), `scripts/score_demo.py` (scoring sketch, asserts pass), `out/modis_ndvi.csv`. No `report.md`: the harness refused a report-file write from this agent.

**Wheat, Mt / t per ha:** 2019 11.45/1.01 · 2020 14.26/1.18 · 2021 11.81/0.93 · 2022 16.40/1.28 · 2023 12.11/0.92 · 2024 18.58/1.42 · 2025 19.33/1.58 · 2026 15.80/1.40 (USDA November estimate).

**Regions, 2024 satellite wheat area:** Akmola 3.68 Mha (32.8%), Kostanay 2.98 (26.6%), North Kazakhstan 2.23 (19.9%) = 79.3%. Fallow share 8.0 / 13.9 / 10.7%.

**Calendar:** sow 14-27 May by soil zone; NDVI peak 10 Jun-28 Jul; harvest late Aug to early Oct; last spring frost median 6-11 May (latest 30 May); first autumn frost median 26 Sep-1 Oct (earliest 11 Sep); snow mid-Oct to late Apr.

**Stress profile, 0 to 1 each:**
```
water = mean_y clip((1 - rainMayAug_y / mean_2001_2020) / 0.5)
heat  = mean_y clip((days Tmax>=30C May-Aug - 15) / 25)
frost = share of years with Tmin<=-2C after 25 May or before 5 Sep
peak_y = max field-median NDVI, 15 Jun-20 Aug;  bare = share(peak_y < 0.30)
```
2019-2024 at city points: Kostanay water 0.28, heat 0.39; Akmola 0.43, 0.28; North Kazakhstan 0.25, 0.18.

**Crop fit:** `1 - water*(1-drought/5) - heat*(1-heat/5) - 0.5*frost*frost_sens`.

**Zone gates (judgement):** rapeseed needs mean May-Aug rain >= 200 mm and heat < 0.30; chickpea rain < 190 mm; pea heat < 0.45; millet frost < 0.30; sunflower frost < 0.20.

**Yield of the following wheat, fallow = 1.00:** oats 0.94, lentil or mustard 0.88, pea 0.82, second wheat 0.83 (sourced); flax 0.88, sunflower 0.75, sweet clover 0.92 (judgement).

**Indicators per 4-year template:**
- productivity = mean(yield x fit x factor x price ratio x (0.6 + 0.4*market/5))
- soil = 0.5*residue/5 + 0.3*min(1, N/30) + 0.2*(1 - 4*fallow share)
- pest break = 1 - 0.6*wheat share - 0.8*wheat-after-wheat share + 0.15*(crop groups - 1)
- climate fit = mean crop fit; market = mean market/5

**Templates (W wheat, B barley, F fallow):**
- Baseline: declared rotation; presets F-W-W-B and W-W-W-W.
- Water-resilient: W-flax-W-B, W-sunflower-B-W, W-millet-W-flax, F-W-flax-B, W-rapeseed-W-B. Weights: climate 0.40 + 0.2*water, productivity 0.30, market 0.20. Always add the practice note: tall stubble, no autumn tillage, sow 20-25 May.
- Soil-restoring: oats-W-W-B, lentil-W-flax-B, pea-W-flax-B, sweet clover-W-W-B, pea-W-rapeseed-W, chickpea-W-flax-B. Weights: soil 0.40 + 0.2*bare, pest 0.20, productivity 0.20.

**Catalogue summary** (local days | water use 1-5 | drought/heat 1-5 | dryland N kg/ha | market 1-5 | national t/ha):

| Crop | Days | Water | D/H | N | Mkt | Yield |
| --- | --- | --- | --- | --- | --- | --- |
| Spring wheat | 90-105 | 3 | 3/2 | 0 | 5 | 0.92-1.58 |
| Durum | 98-110 | 3 | 3/3 | 0 | 3 | as wheat |
| Barley | 75-90 | 2 | 4/3 | 0 | 4 | 1.08-1.71 |
| Oats | 85-100 | 3 | 2/2 | 0 | 2 | 0.79-1.71 |
| Flax | 95-115 | 3 | 4/3 | 0 | 4 | 0.50-0.89 |
| Sunflower | 110-130 | 5 | 4/4 | 0 | 5 | 0.76-1.46 |
| Rapeseed | 90-110 | 4 | 2/1 | 0 | 4 | 0.63-1.95 |
| Lentil | 85-100 | 2 | 4/2 | 30-80 | 4 | 0.74-1.34 |
| Field pea | 80-95 | 2 | 3/2 | 40-100 | 3 | 0.95-1.35 |
| Chickpea | 95-115 | 3 | 5/4 | 20-60 | 2 | 0.36-1.01 |
| Proso millet | 70-90 | 1 | 5/5 | 0 | 2 | 0.79-1.10 |
| Sweet clover | biennial | 5 | 5/4 | 60-120 | 1 | wheat after: 1.96 |

Yields are FAOSTAT and USDA; days, ranks and dryland N are judgement. FAO days and water need, FAO-56 root depth, frost notes and market reasons are in the JSON.

**Demo blocks** (cropland share; peak NDVI 2021 / 2023 / 2024):
- Kostanay 53.80N, 62.75E: 98.8%; 0.55 / 0.47 / 0.85
- Akmola 51.72N, 70.75E: 95.2%; 0.41 / 0.46 / 0.71
- North Kazakhstan 53.90N, 69.60E: 95.3%; 0.63 / 0.55 / 0.81

**Satellites cannot see:** the crop and variety sown; salinity and solonetz patches; pH and carbonate; available phosphorus and nitrate; water stored at depth; herbicide history; weed seedbank, disease inoculum, saiga damage; snow depth and stubble on the field; whether a low-NDVI summer was fallow or failure; prices and contracts.

**Needs local review:** water left for the next wheat (6-25% yield cost); herbicide carry-over before pulses, flax, sunflower, rapeseed; salinity; phosphorus and the right inoculant strain; seed supply; elevator and buyer access, single-buyer exposure (Turkey for lentil, China for sunflower); machinery (low-cut headers, row planter, drying); thin residue after pulses and flax; return intervals (lentil 4-5 years); September frost and wet harvest; lease length and regional subsidy rules.

## Corrections this made to the first brief

- Section 4, baseline rotation: 'spring wheat x3 then bare fallow' is the textbook case, not the norm. Fallow was 8-14% of arable land in the three regions in 2024 and North Kazakhstan is 75-87% wheat every year. Make the baseline the user-declared rotation with presets 'fallow, wheat, wheat, barley' (the Barayev control) and 'continuous wheat'.
- Section 4, demo contrast: 2023 was as bad as 2021 nationally (0.92 vs 0.93 t/ha) and worse in Akmola (May-Aug rain 50% of normal at Shortandy against 72% in 2021). Use 2021 vs 2024 for the Kostanay preset and 2023 vs 2024 for the Akmola preset. 2024 was very good but 2025 was larger (19.33 vs 18.58 Mt).
- Section 4, demo presets: around Petropavl the land is forest-steppe with only 33-82% cropland and almost no NDVI drought signal. Use Tayinsha district (53.90N, 69.60E) for North Kazakhstan, north Fyodorov district (53.80N, 62.75E) for Kostanay, and west of Shortandy (51.72N, 70.75E) for Akmola.
- Section 4, season: harvest runs from late August to early October, and snow cover in reanalysis lasts from about mid-October to late April. Crops are only green from early June; May scenes are bare seedbed.
- Section 5, bare-soil alert: 'mean NDVI < 0.22 between May and September' flags every spring-sown field in May. Replace with: peak field NDVI between 15 June and 20 August below about 0.30 means fallow or crop failure (threshold is my judgement, tune on the presets).
- Section 5, diagnosis: POWER root-zone wetness (GWETROOT) only moved between 0.51 and 0.66 across the best and worst years at these points. Use it as an anomaly against the point's own history, never as an absolute threshold.
- Section 4, strategy 2: sunflower is drought-tolerant but dries the soil profile for the next crop, and rapeseed is heat-sensitive and belongs only in the wetter north. Section 4, strategy 3: the best-documented local fallow replacement is oats (rotation output +27% at Shortandy), ahead of pulses; add oats and mustard to the options.
- Section 4, honest trade-off: it can now be quantified. Wheat after lentil or mustard yielded about 12% less than after fallow (Barayev 2018-2020), after oats about 6% less, and older trials put the gap at 20-25% for pea.
- Section 7, Planetary Computer `modis-13Q1-061`: no items from 2025-06-26 to 2025-11-17 at the test point, the 2024-08-12 Terra composite is missing, and 2024 items have `platform: null`. Filter on the item id prefix (MOD13Q1), not on platform, and do not rely on this collection for 2025.
- Section 4, the 40 C claim is correct: NASA POWER gives 40.4 C at 53.21N 63.63E on 2021-07-02.

## Risks

- Catalogue ranks, zone gates and scoring weights are untuned judgement. The scoring sketch proves the logic runs and reads sensibly; it is not calibrated agronomy and must be labelled decision support.
- Several agronomy facts rest on one research centre's trials at Shortandy (Akmola). Kostanay and North Kazakhstan differ in rainfall and soils, and the older trials contradict the newer ones on how much pea costs the next wheat (20-25% vs about 12% for lentil).
- Climate figures came from NASA POWER at the three cities, not at the demo blocks, on a roughly 50 km grid. Re-query at each preset's coordinates; expect the same pattern but different numbers.
- MODIS numbers are 6 km box means that mix fields, fallow and grass. Field-level Sentinel-2 values will be higher at peak and lower on fallow; the 0.30 fallow threshold needs checking on real field polygons.
- Market facts move fast: lentil and flax areas have boomed and crashed within three years, and export tax, VAT and import rules changed three times in 2026. Date-stamp every market statement on the cards.
- Sources that could not be opened today and are quoted from search snippets only: Suleimenov et al. 2005 (pea and wild oats), Manitoba frost thresholds, sunflower duty and lentil export shares, Kostanay soil phosphorus and pH, herbicide carry-over intervals. These are tagged 'memory' in the findings.
- FAO water-need figures describe unstressed irrigated crops (450-650 mm for wheat) and overstate what any crop gets here (170-210 mm of May-Aug rain plus snowmelt). Showing them raw on a card would mislead; use the relative rank.
- fas.usda.gov pages return 403 to scripts and the USDA IPAD site is retired; GAIN PDFs are still reachable through the GAIN API and PSD bulk zips. The FAOSTAT API now needs a token; only the bulk zip is keyless.

## Open questions

- Which baseline should the three presets declare: 'fallow, wheat, wheat, barley' or 'continuous wheat'? The fallow years should be visible in the field's own NDVI history, so this can be checked per preset once a field polygon is drawn.
- Can anyone with agronomy knowledge of the region review the catalogue before the demo? All 1-5 ranks, local season lengths, dryland nitrogen ranges, zone gates and several predecessor factors are my judgement.
- The water-resilient strategy currently picks a sunflower rotation everywhere because of price. Is that acceptable (it matches what farmers are doing), or should price weigh less so flax, millet or barley win on drier fields?
- No official region-by-region wheat production table for 2024-2026 was found; shares here are satellite-derived sown area. Is that sufficient for the pitch?
- Individual field boundaries were not verified. Someone has to draw one roughly 400 ha field inside each block on Sentinel-2 imagery and confirm it is a single management unit.
- The 2026 season (hot, dry May-June in Akmola and North Kazakhstan, wet in Kostanay) is fresh and regionally split. Worth adding as a third slider stop?

## Findings

- **[verified-live]** National wheat production (Mt) and yield (t/ha) by harvest year: 2019 11.45/1.01, 2020 14.26/1.18, 2021 11.81/0.93, 2022 16.40/1.28, 2023 12.11/0.92, 2024 18.58/1.42, 2025 19.33/1.58, 2026 15.80/1.40 (USDA November 2026 estimate). Area harvested fell from 13.13 Mha in 2023 to 11.30 Mha in 2026.
  - Evidence: USDA PSD bulk file https://apps.fas.usda.gov/psdonline/downloads/psd_grains_pulses_csv.zip (file dated 2026-11-10), parsed with scripts/psd_kz.py
- **[source-read]** The 2026 wheat-only final figure is not published yet. The ministry reported 24.3 Mt of all grains (bunker weight) against about 27 Mt in 2025; FAS Astana forecast wheat at 14.0 Mt in April and 15.0 Mt in July 2026 after a hot, dry May-June in Akmola and North Kazakhstan, with Kostanay wetter than 2024-2025.
  - Evidence: https://www.trend.az/casia/kazakhstan/4240964.html (30 Oct 2026); GAIN KZ2026-0007 and KZ2026-0008 fetched from apps.fas.usda.gov/newgainapi
- **[source-read]** The three regions hold about 79% of wheat area: 2024 satellite-monitored wheat sown area was Akmola 3.68 Mha (32.8%), Kostanay 2.98 Mha (26.6%), North Kazakhstan 2.23 Mha (19.9%), together 8.89 of 11.22 Mha. They also hold 10.4 of 12.8 Mt of licensed elevator capacity. USDA wrote in 2009 that about 75% of the country's wheat is produced there.
  - Evidence: Bureau of National Statistics analytical note, 6 Mar 2025, Table 4: https://stat.gov.kz/upload/iblock/b46/5jwhuo2jfnxulna4w63a5jxgj59rgzb3/Аналитический материал анг.pdf ; GAIN KZ2026-0003 Table 2; https://web.archive.org/web/2023/https://ipad.fas.usda.gov/highlights/2009/08/kaz_05aug2009/
- **[source-read]** Bare fallow is now a minority practice: 2024 fallow area was Kostanay 556k ha, Akmola 377k ha, North Kazakhstan 343k ha (1.62 Mha nationally), which is 13.9%, 8.0% and 10.7% of fallow plus spring-sown area. A strict wheat-wheat-wheat-fallow rotation would be 25%.
  - Evidence: Same stat.gov.kz note, Tables 1 and 2; shares are my arithmetic. These are satellite-derived areas, lower than official sown-area statistics.
- **[source-read]** USDA describes North Kazakhstan as having 75 to 87% of arable land in wheat every year, and cites UNDP that about 75% of Kazakhstan's soil is degraded and land-survey data that fertility fell 17% in 20 years, blaming wheat monocropping and low fertiliser use.
  - Evidence: GAIN KZ2026-0007 (29 Apr 2026), section 'Soil Degradation Continues to Depress Grain Yields'
- **[source-read]** The classic rotation is four-field: clean fallow, two wheats, then barley, oats or an oilseed; some farms grow nothing but wheat. The second wheat after fallow yields 15 to 20% less. Fields frequently exceed 400 ha. Spring wheat is planted in the second half of May; harvest begins in late August and usually ends by early October.
  - Evidence: USDA IPAD commodity intelligence report, Aug 2009, read via Wayback: https://web.archive.org/web/2023/https://ipad.fas.usda.gov/highlights/2009/08/kaz_05aug2009/ (the live IPAD site is retired)
- **[source-read]** Barayev centre sowing optimum: 14-24 May on ordinary chernozem, 16-26 May on southern chernozem, 17-27 May on dark chestnut soils; over 50+ years medium-ripening varieties did best sown 20-25 May; harvesting after 20 September costs yield and quality. The summer rainfall maximum now falls in June in 64% of recent years against 30% long-term, and with a June maximum the sowing date matters little.
  - Evidence: https://baraev.kz/news/3368-the-use-of-agricultural-technology-of-wheat-cultivation-in-a-changing-climate.html
- **[verified-live]** 2021 drought confirmed at Kostanay (53.21N 63.63E): Tmax 40.4 C on 2021-07-02, May-Aug rain 94 mm (55% of the 2001-2020 mean of 170 mm), June rain 11 mm (mean 37), 45 days at or above 30 C (mean 23). In 2024 the same point had 283 mm (166%) and 5 hot days.
  - Evidence: NASA POWER daily API, community=AG, 2001-01-01 to 2026-11-10; scripts/power_summary.py and scripts/power_snow.py
- **[verified-live]** 2023 was a double hit: June drought then prolonged rain at harvest. Wheat fell 26% to 12.11 Mt; only 21% graded food quality, 29% feed, half non-class. At Shortandy May-Aug rain was 84 mm (50% of normal) with 41 hot days, then 77 mm fell between 20 Aug and 30 Sep. Akmola's 2021 was milder (72% of normal rain).
  - Evidence: GAIN KZ2024-0002 (28 Feb 2024) https://oilworld.ru/data/postfiles/346850/Grain_and_Feed_Kazakhstan_2024-0002.pdf ; NASA POWER at 51.70N 71.00E
- **[verified-live]** Snow and frost from reanalysis at three points, 2001-2026: snow cover established median 15-17 Oct (range 27 Sep to 7 Nov), last snow median 30 Apr to 8 May, peak depth median 37-42 cm; last spring frost median 6-11 May (latest 29-30 May); first autumn frost median 26 Sep to 1 Oct (earliest 11 Sep). MERRA-2 likely keeps snow too long.
  - Evidence: NASA POWER SNODP and T2M_MIN; scripts/power_snow.py
- **[source-read]** Fallow stores little extra water: only 5-15% more than stubble; wheat after fallow beat wheat after oats by 2-8.9%; grain per hectare of the whole rotation was 20-27% higher without fallow. Precipitation-use efficiency is 18-20% on fallow against over 40% under no-till continuous wheat with tall stubble; conventional fallow loses 60-70% of snowmelt and 6-7 t/ha of soil.
  - Evidence: Suleimenov and Akshalov (ICARDA) abstract https://download.clib.psu.ac.th/datawebclib/e_resource/e_database/agronomy/2002/Browse/pdf/A06-suleimenov023832-Oral.pdf ; Akshalov (Barayev institute) https://topsoil.nserl.purdue.edu/isco/isco18/abstracts/Akshalov_Adoption%20of%20no-till%20in%20north%20kazakhstan.pdf
- **[source-read]** Barayev trial 2018-2020 at 51.6395N 71.0210E: wheat yielded 2.14 t/ha after fallow, 2.01 after oats, 1.88-1.89 after lentil and mustard. Whole-rotation output was 2.13 t/ha for oats-wheat-wheat-barley against 1.68 for the fallow control and 1.66 for mustard-wheat-pea-wheat.
  - Evidence: FAO GSOIL4N poster, Akhmetova and Kiyas: https://www.fao.org/fileadmin/user_upload/GSP/GSOIL4N/GSOIL4N-Posters/ID_201.pdf
- **[source-read]** Barayev long-term means in t/ha: oats in place of fallow 2.38, pea 1.46-1.51, chickpea 1.12-1.23, lentil 0.96, flax 0.76, sunflower 0.70, rapeseed 0.67, mustard 0.66; millet out-yielded wheat by 0.3 t/ha in the 2012 drought; wheat after sweet clover green manure averaged 1.96 over 13 years; lentil should not return to a field within 4-5 years.
  - Evidence: https://baraev.kz/scientific_articles/523-diversification-increases-the-efficiency-of-arable-land.html (machine-translated page by the head of the crop rotation laboratory)
- **[source-read]** Barayev 2021-2023 programme: highest net income came from 'mustard, wheat, peas, wheat' and 'peas, wheat, flax, barley'; nitrogen still added 0.14-0.19 t/ha to wheat after pea and 0.15-0.37 after flax; soil carbon under zero tillage rose from 1.79 to 2.22%; 45 years of continuous wheat was not significantly below rotation yields; in a severe drought autumn tillage stored 22-24 mm more water than no-till on low-humus chernozem.
  - Evidence: https://baraev.kz/projects/3415-intensive-farming.html
- **[source-read]** A break crop does not clean the field by itself: in 2020 septoria and helminthosporium leaf spot on wheat reached 40.3% after lentil, 35.6% after pea, 36.3% after fallow and 40.0% after flax, with 100% incidence; epidemics occur 4-5 years in 10.
  - Evidence: https://baraev.kz/news/1564-influence-of-predecessors-on-the-distribution-and-development-of-septoria-blight-on-spring-wheat-in-2020.html
- **[source-read]** No-till and snow: about 2 of 19 Mha are fully no-till and 9.3 Mha minimum tillage; zero-till wheat yields 25% above ploughed; residue snow-trapping with zero tillage raised yields up to 58%; snow is about 40% of the 250-350 mm annual precipitation; oats instead of fallow raised total grain output 37%.
  - Evidence: FAO Save and Grow fact sheet 10 (2015): https://openknowledge.fao.org/server/api/core/bitstreams/5726e489-0775-4724-8994-5cacefb5c158/content
- **[verified-live]** Area trends, thousand ha, 2015 to 2024: flax 623 to 873 (peak 1,366 in 2021, 726 in 2023); sunflower 701 to 1,257; rapeseed 221 to 149 (365 in 2018, 93 in 2023); lentil 38 to 351 (331 in 2017, 61 in 2020); field pea 45 to 127; barley 2,037 to 2,283; wheat 11,570 to 13,067. USDA has sunflower at 1,770 in 2025 and 2,200 in 2026, rapeseed 323 and 490.
  - Evidence: FAOSTAT bulk file https://bulks-faostat.fao.org/production/Production_Crops_Livestock_E_Asia.zip parsed with scripts/fao_kz.py; USDA PSD oilseeds bulk file
- **[source-read]** 2025 areas reported from statistics-bureau data: wheat 12.195 Mha (-6.7%), oilseeds 3.95 Mha (+44%), sunflower 1.777 Mha, flax 1.347 Mha (+54%), rapeseed 323k ha (+117%), pulses 777k ha (+59%), lentil 641k ha (+83%), pea 108k ha (-15%).
  - Evidence: https://agroreview.com/en/newsen/crops/kazakhstan-increased-production-oilseeds-and/ (9 Feb 2026, secondary report); wheat and oilseed totals match Annex 1 of GAIN KZ2026-0003
- **[source-read]** Diversification is government policy: the 2026 plan cut wheat by 125k ha and raised fodder (+242k), barley (+94k) and oilseeds (+55k). 2026 seed subsidies per tonne of original seed: wheat 166,000 KZT, barley 154,000, oats 135,000, lentil 239,300. About 400,000 t of discounted diesel, 700 bn tenge of preferential spring credit, and the state Food Contract Corporation buys about 5% of the wheat crop.
  - Evidence: https://primeminister.kz/en/news/kazakstanda-maily-dakyldar-men-zemsopke-arnalgan-alkaptar-ulgaidy-31111 (24 Feb 2026); GAIN KZ2026-0007 annexes 1-2
- **[source-read]** Markets are concentrated and policy-sensitive. Wheat and flour 2024/25: Uzbekistan 4.38 Mt, Afghanistan 1.82, Tajikistan 1.39 of 10.19 Mt; wheat sales to China collapsed in 2025/26 on rail congestion and inspections. In 2026 alone the VAT refund on exports was cut to one fifth in January and restored on 19 June, and a six-month wheat import ban began 30 June. Flax and rapeseed were quoted at 200,000 KZT/t or more against 65,000-70,000 for wheat in early 2025.
  - Evidence: GAIN KZ2026-0003, KZ2026-0007, KZ2026-0008; https://timesca.com/kazakhstan-to-diversify-agricultural-crops-for-higher-yields-and-increased-profits/
- **[memory]** Sunflower seed carries a 20% export duty with a 100 EUR/t floor and China takes about 83% of seed exports; Turkey takes about 88% of lentil exports and lentil prices fell on the 2025 glut; Kostanay arable soils are widely phosphorus-deficient (25-80 mg/kg) with pH 7.1 to 8.6; sulfonylurea and clopyralid residues persist longer in dry alkaline soil and injure lentil, pea, flax and sunflower.
  - Evidence: Search-result snippets only, pages not opened (Grain Union and Ukragroconsult reports, Kostanay agrochemical monitoring papers, Australian and North Dakota extension notes). Treat as leads.
- **[source-read]** Crop water needs and rooting depth used in the catalogue: FAO gives wheat/barley/oats 450-650 mm and 120-150 days, millet 450-650 mm and 105-140 days, sunflower 600-1000 mm, pea 350-500 mm and 90-100 days; no FAO water figure for flax, lentil, chickpea or rapeseed. FAO-56 root depth: cereals, flax, rapeseed 1.0-1.5 m, sunflower 0.8-1.5, millet 1.0-2.0, lentil 0.6-0.8, pea and chickpea 0.6-1.0.
  - Evidence: https://www.fao.org/4/s2022e/s2022e07.htm (Tables 6 and 14); https://www.fao.org/4/x0490e/x0490e0e.htm (Table 22)
- **[source-read]** Nitrogen fixed under irrigation (kg/ha, converted from lb/ac): sweet clover 250, pea 200, lentil 150, chickpea 121. Sweet clover 'uses more soil moisture than other green manure crops' and this 'has suppressed the yield of subsequent crops'. Fixation drops once soil plus fertiliser N exceeds about 40 kg/ha, and chickpea needs a different rhizobium from pea and lentil. Dryland ranges in the catalogue are my own estimates.
  - Evidence: https://www1.agric.gov.ab.ca/$department/deptdocs.nsf/all/faq7979 ; https://www.saskatchewan.ca/business/agriculture-natural-resources-and-industry/agribusiness-farmers-and-ranchers/crops-and-irrigation/soils-fertility-and-nutrients/inoculation-of-pulse-crops
- **[verified-live]** Three demo blocks are confirmed cropland: Kostanay 53.80N 62.75E is 98.8% cropland in a 6 km box, Akmola 51.72N 70.75E is 95.2%, North Kazakhstan 53.90N 69.60E (Tayinsha) is 95.3%. Karabalyk 53.75N 62.25E is 90.7%. Blocks right around Petropavl are only 33-82% cropland.
  - Evidence: ESA WorldCover 2021 v200 through Planetary Computer /api/data/v1/item/statistics with categorical=true; scripts/worldcover_check.py
- **[verified-live]** MODIS box-mean peak NDVI for 2021 / 2023 / 2024: Kostanay block 0.55 / 0.47 / 0.85, Akmola block 0.41 / 0.46 / 0.71, Tayinsha block 0.63 / 0.55 / 0.81. In 2021 the Kostanay block fell from 0.55 on 12 July to 0.35 by 28 July; in 2023 it stayed at 0.43-0.46 from mid-August to end of September (normally 0.22-0.28), the wet-harvest signature. A block south-west of Petropavl barely moves (0.73-0.79 every year).
  - Evidence: Planetary Computer modis-13Q1-061 Terra composites 2019-2026, out/modis_ndvi.csv (324 rows), scripts/modis_ndvi.py and scripts/ndvi_summary.py
- **[verified-live]** Cropland NDVI is 0.18-0.33 in the 9 May composite and 0.22-0.43 in the 25 May composite at the three blocks, peaking between 10 June and 28 July. A rule that flags NDVI below 0.22 anywhere in May-September fires on ordinary seedbeds.
  - Evidence: out/modis_ndvi.csv, same run
- **[verified-live]** Planetary Computer's modis-13Q1-061 is incomplete: no items between 2025-06-26 and 2025-11-17 at 53.8N 62.75E, the 2024-08-12 Terra composite is absent, and 2024 items have platform null, so a platform=terra filter drops the year. A box near a sinusoidal tile edge (Tayinsha) matches two tiles, one returning no data.
  - Evidence: STAC search on https://planetarycomputer.microsoft.com/api/stac/v1/search run today; first run of scripts/modis_ndvi.py lost all of 2024 until the filter was changed to the item-id prefix
- **[verified-live]** Sentinel-2 L2A has five scenes under 20% cloud for July 2021 at the Kostanay block (tile 41UMV: 3, 5, 18, 20, 25 July), so the 2021 field-zoom story is feasible.
  - Evidence: STAC search, collection sentinel-2-l2a, eo:cloud_cover < 20
- **[verified-live]** The proposed scoring runs and gives differentiated, defensible picks on real numbers: soil strategy selects lentil-wheat-flax-barley for Kostanay and Akmola and pea-wheat-rapeseed-wheat for North Kazakhstan. The water strategy selects wheat-sunflower-barley-wheat on all three, which shows the weights still over-reward price.
  - Evidence: python3 -I scripts/score_demo.py out/crop_catalogue.draft.json prints the scores and 'self-check passed'
- **[verified-live]** Fetching history is cheap for climate and expensive for imagery: a 26-year daily POWER series for 7 parameters is one request of about 1.1 MB, while 8 years of MODIS box statistics for four sites took 324 requests.
  - Evidence: downloads/power/*.json sizes and the modis_ndvi.py run
- **[memory]** A 2023 state of emergency in several northern regions, the spring 2024 snowmelt floods, and tan spot, common root rot, Hessian fly and grain cutworm as rotation-sensitive problems are my recall only; searches today did not confirm them.
  - Evidence: No source found in this session

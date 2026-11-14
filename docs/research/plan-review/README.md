# Independent review of the plan (14 Nov 2026)

Three critics read the brief cold and two agents verified the seams between research tracks with live calls. AI-assisted review; findings marked as verified were run that day.


## Judge

As planned (phases 1 to 4 and 6) I score it Impact 3, Creativity 3, Validity 4, Relevance 3, Presentation 3: 16/25, honest science behind a weak pitch. Points are lost in three places: presets sit in the skippable phase 5, so a judge opening the link in November gets an empty map; the product leads with monitoring the challenge never asks for, with the rotation comparison in the third tab; and NASA data is core on one leg of three. Two outputs would embarrass the team before an expert: the "water-resilient" card is wheat, sunflower, barley, wheat at every site, and a MODIS "worst year since 2000" line would crown a fallow year at two presets (both checked today). The repo still holds no app code, and the machine clock read 17:26 Singapore time when I checked, not 14:00, so about 30 hours remain including sleep. About 10 hours of specific changes, with the deck counted and paid for by the cuts listed, would lift this to roughly 20 to 21.

### Must fix

- **Presets are outside the product. Phase 5 holds 'three preset fields precomputed and committed', but 'Phases 1 to 4 and 6 are the product', while phase 6 and the smoke test assume presets exist. In November live alerts are empty and current imagery is snow.**
  - Fix: Move one preset (Kostanay) to the start of phase 2, before any UI: draw the real outline, build its JSON with docs/research/data-path-spike/field_series.py, commit it. The app opens on that field with a July 2021 date and the strategies visible. Add the other two presets only after the deck draft exists.
- **The demo numbers in the plan do not belong to the demo field. The 94 mm against 177, 45 hot days and 40.4 C are for the Kostanay city cell (I reproduced them exactly), 85 km from the preset and in another NASA POWER cell. At the preset cell 2021 has 88 mm against a median of 210, 42 days above 30 C and a 39.2 C peak. 2024 is the wettest of 26 years there (358 mm), so '2021 against 2024' is second-driest against wettest.**
  - Fix: Put only numbers the app computes for the preset on slides. Make the claim '2021 against this field's normal' and use 2024 only as the picture. Show late July to early August, where the contrast is largest: on the 2 x 2 km block at the preset coordinates NDVI was 0.31 on 7 August 2021 against 0.67 on 1 August 2024, while the peaks were 0.52 and 0.81. Expect a 'warning', not 'severe': 0.52 is 73% of the cropped-year median of 0.71.
- **The MODIS 'worst in N years' ranking is not fallow-aware. On the Kostanay block the lowest MODIS peak of 26 years is 2023, a fallow year (Sentinel-2 NDVI 0.18 to 0.26 through June and July); 2021 is fifth lowest at 80% of the median. On the Akmola block the lowest is 2021, also bare fallow (0.15 to 0.17 all summer). The plan's example line 'second-worst peak in 26 years' comes from a different test square.**
  - Fix: Exclude years the curve labels fallow before ranking, with a MODIS-specific threshold (MODIS reads about 0.11 higher, and the 2023 fallow year reaches 0.35 by late July and 0.42 by late August). Word the result from the data: 'one of the five weakest seasons since 2000'. Use the fallow year as a feature: 'fallow, not stress'.
- **NASA data is core on one leg of three. Climate rests on NASA POWER (good). Every per-field number rests on ESA Sentinel-2. The MODIS baseline is sixth in the cut order, ahead only of the LLM narrative. SMAP and IMERG are map pictures only.**
  - Fix: Take the MODIS baseline out of the cut list. Precompute it for the presets (the reference script already fetches both sensors in about 30 s). Make the 26-year strip the first chart, labelled 'NASA MODIS 2000 to 2026', with Sentinel-2 as 'detail since 2018 (ESA)'. Pitch line: a 400 ha field is 64 MODIS pixels, so the NASA record resolves these fields. In the 'NASA Data' field list SMAP and IMERG as map context, not analysis inputs.
- **The rotation cards do not respond to the data, and the water card is agronomically wrong. I ran score_demo.py: 'water-resilient' is wheat, sunflower, barley, wheat at all three sites, although the catalogue rates sunflower water use 5 of 5. With stress profiles recomputed at the preset cells all three presets get the same two cards, and the top three water templates sit within 0.024 of each other. Two zone gates sit on the threshold: Kostanay rain mean 199 mm against a 200 mm gate, North Kazakhstan heat 0.32 against 0.30.**
  - Fix: (a) Remove price from the water ranking and bar crops with water use 4 or more from water templates (30 minutes). (b) Run the scoring as a pure function in the browser with two controls: farmer priorities (water, soil, income weights) and a 'drier and hotter' scenario slider. The sketch already flips to millet and flax when dry and to rapeseed when wet. (c) Show 'close call' when the top two are within 0.03. (d) Build the stress profile from the full POWER record, not six years.
- **The product is framed as monitoring. Section 1 leads with 'watches crop fields ... gets stress alerts'; section 7 puts Strategies third of three tabs. The challenge asks for rotation decision support and for when fields are 'typically' bare or vulnerable, which is multi-year history, not live alerts. With no login, nobody receives an alert.**
  - Fix: Make Strategies the first and default tab. Rename alerts to season verdicts and never pitch notifications. Build two rules (deficit, bare or fallow) plus the as-of replay for the demo year. Drop alert badges, 'new since last visit' and the other four alert types from the judged path.
- **Two ingredients from the challenge's first paragraph are missing from the build: 'local soil information' has no source, and 'farmer priorities' is listed in section 3 item 5 but in no phase. The satellite-versus-ground note is also absent from phase 4.**
  - Fix: Priorities: the control in the previous item. Soil: precompute an ISRIC SoilGrids point for each preset and show it as 'modelled soil, 250 m, not a field test'. The API answered today in 18.9 s for the Kostanay preset: clay 35%, sand 28%, pH 6.8. Add one static dialog with the glossary, satellite-versus-ground note and uncertainty statement.
- **The deck gets one line in phase 6 and has no story, and the clock is later than the brief says. `date` gave 14:26 at UTC+5, which is 17:26 Singapore time; the last commit was 13:33 Singapore time and the repo is still docs only.**
  - Fix: Budget about 30 hours, not 34. Draft the deck from static screenshots of the first preset as soon as it renders. Submit a first version by Sunday noon Singapore time. Use the outline in 'extra'. Open with the NASA MODIS NDVI picture of the grain belt in July 2021 against July 2024, then pivot to the rotation question within two slides.

### Should fix

- The NDMI rule is called 'water stress', yet the plan's own note says it is nearly the same signal as NDVI.
  - Fix: Label it 'low canopy moisture (supports the water diagnosis)' and never show it as a standalone finding.
- Map layer labels overclaim. GIBS titles IMERG_Precipitation_Rate 'Precipitation Rate (IMERG)' with a daily step, and the tile I viewed was mostly blank. SMAP L4 is '12z Instantaneous, Model Value-Added' at 9 km, one flat colour at field zoom.
  - Fix: Label them 'rain rate on this day' and 'modelled root-zone moisture, 9 km, context'. Skip the GRACE layer (it ends in July 2022) and MODIS LST (large cloud holes in the tile I viewed).
- The vegetation spec wants field medians, p10 and p90 and a 20 m inward buffer, but the chosen data path returns masked means of the unbuffered polygon. Percentiles are contaminated by the zero fill on any scene that is not fully clear (read from field_series.py, not tested live). Thresholds were tuned on one and will run on the other; the clear-fraction cut is 0.75 in one note and 0.8 in the other.
  - Fix: Say 'field mean' everywhere, pick one clear-fraction value, cut the PATCHY alert, and re-check the deficit thresholds on the first preset.
- The season water budget ignores snow. The plan's notes say about 40% of annual precipitation is snow, but the diagnosis counts May to August rain only. Frost fired in 0 of 36 seasons because it is tested inside wheat stages only.
  - Fix: Add October to April precipitation as a percentile fact, and the first autumn frost date against each crop's season length. Both come from the cached POWER file. Keep the stubble and snow-trapping note on every card.
- Card claims are stronger than their sources. Wheat-after-predecessor figures come from one three-year trial at Shortandy and are applied to all three regions. The pea figure partly rests on an unopened source. The pest-break score ignores the team's own source showing leaf spot at 40% after lentil against 36% after fallow. 'Productivity in wheat-equivalent t/ha' reads as a yield forecast.
  - Fix: Print 'Barayev trial, Shortandy, 2018 to 2020' on the card. Word pest break as root-disease, weed and insect cycles only. Show productivity as a relative bar with no unit.
- 'No trend claims' reads as a disclaimer against a challenge framed on changing conditions.
  - Fix: State it as a finding: 'We tested for a drying trend and found none; the risk is variability.' Use the count the app computes. It depends on definition: 10 of 36 seasons by the plan's rule at the city cell, 6 of 36 under 70% of mean rain at the preset cell.
- The third preset has no story. On the North Kazakhstan block 2021 MODIS is 101% of the median, and May to August rain was 77% in 2021 and 83% in 2023.
  - Fix: Skip it, or keep it only if its cards differ after the scoring fix.
- AI-use optics in a public repo. docs/research contains agent chatter ('the harness refused report files from subagents'), and CLAUDE.md bans AI attribution in commits. Judges 'will be able to see any SI-generated indicators' and assess originality.
  - Fix: Settle section 12 item 1 now. Put a plain 'Use of AI tools' section at the top of the README, head the research notes as AI-assisted and team-reviewed, and state that the idea and region choice are the team's.
- English only; Russian sits in phase 5.
  - Fix: If an hour is left, ship static Russian text for the three cards of the first preset and show one screenshot on the impact slide.
- Planned work no judge will notice in 7 slides: the press-animation grep gate and multi-pass design-skill workflow, phone sheet and drawer, URL query state, incremental refresh with algo versions and the 12-hour rule, bucket mount, vertex limits, field overlay tiles, cross-fade preloading, LLM validator, Kazakh, chat.
  - Fix: Apply the fixed button.tsx (two minutes) and cut the rest until the deck is submitted. That frees roughly 6 to 8 hours.
- The impact slide has no numbers.
  - Fix: Use figures already in the notes: 11.8 Mt of wheat in 2021 against 18.6 Mt in 2024; three regions hold 79% of wheat area; 1.62 Mha of bare fallow in 2024. Soil loss of 6 to 7 t/ha on conventional fallow gives up to about 10 Mt a year (my multiplication; label it an upper bound).

### Material

## Scores as planned (phases 1 to 4 and 6 finished)

| Criterion | Score | Reachable |
| --- | --- | --- |
| Impact | 3 | 4 |
| Creativity | 3 | 4 |
| Validity | 4 | 4, and safe before experts |
| Relevance | 3 | 4 to 5 |
| Presentation | 3 | 4 |
| Total | 16/25 | 20 to 21 |

**Impact 3.** The problem is real and large: the notes put the three regions at 79% of Kazakhstan's wheat area, the harvest swung from 11.8 to 18.6 Mt, and replacing bare fallow is state policy. As phased, the product is English only, has no login so its "alerts" reach nobody, and its advice rests on one research station and an unreviewed catalogue. The large farms here probably already use commercial field monitoring (my inference, not checked). What remains is an agronomist exploring options, which is what the challenge asks.

**Creativity 3.** An NDVI map with alerts is the most common agriculture entry. The original parts are quiet: telling fallow from failure, cards that list what satellites cannot see, the local drought index, refusing to claim a trend. Judges do not score quiet. A ranking that moves when the farmer drags a priority or a "drier" slider is the visible hook.

**Validity 4.** This is the best criterion. Rules and thresholds are on screen, the catalogue has a source per row, sensors are never mixed, the offset trap is handled, and gaps are stated. It is fragile: thresholds were tuned on six squares, the weights put sunflower on the water card, the MODIS rank is not fallow-aware, and quoted climate numbers come from another cell. It scores 4 with a generalist and 3 if an agronomist opens the water card.

**Relevance 3.** The three-strategy comparison matches the Objectives paragraph item for item. Against that, soil information and farmer priorities are missing from the build, the product leads with monitoring, and NASA data is core only for climate. The three presets also get identical cards. It reaches 4 with MODIS first, priorities and soil; 5 needs cards that visibly move with the data.

**Presentation 3.** The UI will look clean, and the NASA NDVI contrast between July 2021 and July 2024 is striking (I viewed both tiles). The plan has no story, no preset in the product phases, and a headline place no judge knows. Judged on the live link without a preset it is a 2.

## Changes ranked by score gained per hour

Gains are my estimate in rubric points out of 25.

| # | Change | Hours | Gain | Per hour |
| --- | --- | --- | --- | --- |
| 1 | Strategies as default tab; app opens on the preset at a July 2021 date | 0.25 | 0.6 | 2.4 |
| 2 | Honest labels (canopy moisture, rain rate, replay, trial name, no t/ha unit); deck numbers taken from the app | 0.5 | 0.5 | 1.0 |
| 3 | Fix the water ranking so sunflower cannot win | 0.5 | 0.5 | 1.0 |
| 4 | Impact numbers and the stakes line | 0.5 | 0.5 | 1.0 |
| 5 | One real preset first, committed (prerequisite for everything) | 2 | 1.3 | 0.65 |
| 6 | MODIS 26-year strip as lead chart, fallow-aware rank | 1.5 | 0.9 | 0.6 |
| 7 | Priorities and scenario sliders on browser-side scoring | 2 | 1.2 | 0.6 |
| 8 | Glossary, satellite-versus-ground note, uncertainty, crop-group one-liners | 0.5 | 0.3 | 0.6 |
| 9 | Soil panel from SoilGrids for presets | 0.75 | 0.3 | 0.4 |
| 10 | Deck built to the outline below (mandatory) | 3 | 1.0 | 0.33 |
| 11 | Russian static cards for one preset | 1 | 0.3 | 0.3 |
| 12 | Bare-days-per-season chart | 0.75 | 0.2 | 0.27 |
| 13 | Pre-season moisture and autumn frost facts | 0.75 | 0.2 | 0.27 |
| 14 | Draw-your-own field end to end | 4+ | 0.6 | 0.15 |
| 15 | LLM narrative | 2 to 3 | 0.2 | under 0.1 |

Rows 1 to 9 take about 8.5 hours and the deck 3 more. The cuts in the should-fix list free 6 to 8 hours.

## Seven slides (the demo link)

Exactly seven, no appendix. Host as a PDF in the repo.

1. **Title:** product name, "Which rotation survives the next drought?", team name, members, "Field Shift: Adapting Farms with NASA Data", live link; background is NASA MODIS NDVI of the grain belt, July 2021 beside July 2024, with the GIBS credit and no logo.
2. **Stakes:** Kazakhstan's wheat went from 11.8 Mt in 2021 to 18.6 Mt in 2024; three northern regions hold 79% of it; 1.6 Mha sits as bare fallow each year as drought insurance; the farmer's question is fallow, continuous wheat, or something new.
3. **What NASA saw on one field:** the 26-year MODIS strip with 2021 marked and the fallow year labelled "fallow, not stress", the 2021 season curve against the field's normal, and the app's NASA POWER rain and heat figures with the diagnosis.
4. **The answer:** the comparison table of declared rotation, water-resilient and soil-restoring, with why, evidence, benefit, gap and local-review risk, and the trade-off number with its trial named.
5. **It responds to you:** two screenshots of the priorities and "drier, hotter" sliders reordering the ranking, plus the soil panel.
6. **How it works and what it cannot know:** MODIS, NASA POWER and GIBS, with ESA Sentinel-2 for detail, feed readable rules that produce the cards; climate is a 50 km cell, thresholds are indicative, the catalogue is unreviewed, no trend is claimed, and satellites cannot see the crop sown or soil chemistry.
7. **Impact and next:** who uses it, that only the crop catalogue is regional, next steps (agronomist review, Russian and Kazakh, Landsat), credits, and the AI-use line.

## Thirty-second video (cut to 28 s, captions burned in, screen recording only)

Captions take their numbers from the app. Put it on the project page as a GIF; embedding a video in the deck may count against the limit (my caution, not a rule I verified).

| Time | Shot | Caption |
| --- | --- | --- |
| 0 to 3 s | NASA MODIS NDVI over the grain belt, wipe from July 2021 to July 2024 | "Same fields. Same month. NASA MODIS." |
| 3 to 8 s | Zoom to the preset field; slider scrubs June to August 2021; verdict turns amber | "2021: 88 mm of rain where 210 is normal. 42 days above 30 C." |
| 8 to 12 s | The 26-year strip; 2021 highlighted; fallow year labelled | "26 years of NASA data. It knows fallow from failure." |
| 12 to 19 s | Three strategy cards; cursor passes Why, Evidence, Gaps, Local review | "So what should rotate in? Three strategies, with evidence and gaps." |
| 19 to 24 s | Drag "drier summers" and "protect soil"; the ranking reorders | "Your priorities. Your climate. The ranking moves." |
| 24 to 28 s | End card: product, team, members, challenge name, URL | "Supports the farmer's judgment. Never replaces it." |

## Verified today, and what is inference

- **Run by me:**
  - NASA POWER daily series at the city cell and the three preset cells.
  - Sentinel-2 and MODIS for 2 x 2 km blocks at the Kostanay and Akmola coordinates, for 2021, 2023 and 2024. These are squares, not real field outlines.
  - score_demo.py as committed, and again with preset-cell profiles.
  - GIBS capabilities and six sample tiles.
  - One SoilGrids query.
  - `date`.
- **Stored data from an earlier run of this review:** the full 2000 to 2026 MODIS ranks and all North Kazakhstan block values. The stored 2021, 2023 and 2024 values matched my re-fetch on both blocks I checked.
- **Read, not run:** the mean-against-median mismatch.
- **Judgement:** all score gains, the commercial-tools remark, and how a judge reads AI traces.
- **Housekeeping:** nothing in the repo was touched and no process is left running. Scratch files are in scratch/review/judge/

## Delivery lead

Not as written. CLAUDE.md §5 plus §7, §10 and §11 add up to roughly 60 hours of work (my estimate), and the real budget is about 19 focused hours. The machine clock, checked against an outside time source, read 17:25 Singapore time when I started, not 14:00, so 30.5 hours of wall clock remain. A reduced version fits: three precomputed preset fields carried end to end (map, three alerts, climate diagnosis, three strategy cards), deployed, with deck and README, and at most one or two of draw-your-own-field, slider replay and the MODIS line on top. The foundations are sound: today I re-ran the data, vegetation, climate and scoring prototypes and the §6 scaffold commands, and all of them work. Three things will sink it if left alone: the phase order puts the judged centrepiece, the presets and the deploy last; the strategy scoring gives numbers that contradict the card labels; and deploy, repo visibility and the submission page are untested. No more review rounds: four hours passed between the research commit (10:33 local) and the first build commit (14:32 local).

### Must fix

- **The clock in the brief is three hours off. `date` and an external HTTP Date header both gave 09:25 UTC, which is 17:25 Singapore time and 14:25 on this UTC+5 machine. The '14:00 Singapore time' in the task is the local clock. At 17:30 SGT there are 30.5 hours of wall clock, about 19.5 focused hours after 6.5 h sleep, meals and a closing buffer.**
  - Fix: Put one two-clock line at the top of §5 (SGT and local = SGT minus 3 h) and write every checkpoint in both. Use the schedule in 'extra', which starts at 17:30 SGT.
- **The plan is about three times the available capacity. My estimate for §5 as written, including the phone layout, design-skill passes, storage design and LLM path, is about 60 h (range 50-70). Phase 3 alone is about 13 h and phase 6 about 10 h, which the plan covers in one line.**
  - Fix: Adopt the reduced scope in 'extra': about 32 h of work split across an agent lane (about 22 h) and a parallel human lane (about 9 h), with 5 h of second-tier items below explicit cut lines.
- **Phase order is horizontal. The three-strategy comparison is phase 4 of 6, the presets that make the demo safe are phase 5, and deploy is phase 6. Work has started on branch feat/ui-shell in that order.**
  - Fix: Go vertical on presets. Tonight: fix the preset JSON contract with one hand-written sample, draw the preset polygons and fetch raw data, build analyse() and write the preset JSON. Sunday morning: the panel that renders it. Sunday 15:00 SGT: deploy and first real save. Drawing, slider replay and the MODIS line come after that. Time-box the shell to 20:00 SGT tonight.
- **The cut order lists only optional extras, protects the LLM narrative longest, and has no cut line inside phases 1 to 4, where the hours are.**
  - Fix: Replace it with the ordered cut list and dated cut lines in 'extra'. Cut now, not later: LLM narrative and validator, Russian, Kazakh, field chat, Cloud Storage mount, incremental refresh, per-year land-use override UI, phone drawer, four of the five design-skill passes, URL state sync, dark mode.
- **The rotation scoring contradicts its own card labels. I ran score_demo.py with the README's city numbers: the 'soil-restoring' card scores 0.59 on soil against 0.60 for the 'continuous wheat' baseline preset at Kostanay and Akmola. The 'water-resilient' card is never the best on climate fit, and at Akmola it is below the fallow baseline (0.70 against 0.71). It is wheat-sunflower-barley-wheat at all three sites, and still is with price ratios flattened to 1. At two sites the soil card beats or equals the water card on four of five indicators. The script's self-check passes because it compares against the fallow baseline only.**
  - Fix: Time-box 75 minutes tonight. Add asserts over 3 presets x 2 baselines: the soil card beats both baselines on soil, the water card beats both on climate fit, and the two cards differ. Show bars or low/medium/high, not two-decimal scores. Take the unsourced price ratio out of productivity. If it is still incoherent at the end of the box, rename the cards by what they change ('add an oilseed break', 'replace fallow with oats or a legume'), which §3 allows because the labels are our own.
- **The data prototype does not produce what the analysis prototype consumes. field_series.py emits per-scene means of ndvi, ndmi, ndre plus the clear fraction. vegspec.py expects field medians of ndvi, ndmi, nbr2, p10, p90 plus a snow fraction, and its thresholds were tuned on medians of interior 25 ha squares read with a different reader. A 25-line adapter makes it run (I tried it), but PATCHY and the tilled-or-stubble wording have no data behind them.**
  - Fix: Before the presets are fetched, finalise the expression: add NBR2 (B11, B12) and an SCL 11 fraction, drop NDRE. Do not try to get p10/p90 from the hosted endpoint. Ship three alerts (vegetation deficit, water stress, bare soil) behind an ENABLED set. Then eyeball the alert output on each preset before trusting severities.
- **The presets do not exist yet and the demo story depends on them. §4 says the outlines still have to be drawn and inspected. On the README's test rectangle, through the real pipeline, 2021 came out 'warning' while 2020 came out 'severe', 2018 'ambiguous' and 2022 'unknown'. A badly drawn polygon inverts the 2021-against-2024 story.**
  - Fix: Human task tonight, 20:45-22:30 SGT: draw one real field per block on satellite imagery, run the fetch (30 s per field), look at peak NDVI per year, redraw if the story year is a fallow year. Commit polygons, raw Sentinel-2 and MODIS series and the POWER cell file tonight. Hand-declare land use per year for the presets in the build script.
- **Deploy is unproven and scheduled last. gcloud is not installed (checked), there is no sign of a Google Cloud project, and a first `gcloud run deploy --source` usually costs 1-2 hours of billing, API and permission errors. The statistics endpoint has never been called from a Cloud Run address.**
  - Fix: Deploy a hello-world tonight by 22:30 SGT: FastAPI serving a static page plus /api/health that makes one live statistics call. Build the frontend so presets load as static files with no backend, and keep a GitHub Pages copy as the standing fallback. Add .gcloudignore and .dockerignore so node_modules is not uploaded.
- **The repository may not be on GitHub. Local `master` shows `[origin/master: gone]` and there are no remote-tracking refs at all. I did not contact the remote, so 'nothing is pushed' is an inference.**
  - Fix: The developer pushes, sets the repo public, adds a LICENSE file and opens it in a private window tonight, before the first save.
- **No submission times are fixed. §13 says 'submit early on Sunday' with no hour, and which form fields are mandatory or length-limited is still unknown.**
  - Fix: Save #0 tonight by 19:30 SGT: name, three-sentence summary, repo link, a three-slide placeholder deck, NASA data list. Save #1 on Sunday at 15:00 SGT with whatever is deployed. Final save between 22:15 and 22:45 SGT. No save after 23:30 SGT (20:30 local).
- **Submission collateral has no time budget: deck of 7 slides or fewer with real screenshots, README with exact credit wording, licences for every library, the AI-use section, eight project-page fields, private-window link checks. That is about 6 hours.**
  - Fix: Run it as the human lane while the agent codes: deck outline and README skeleton on Saturday night, deck v1 on Sunday morning. Feature freeze at 20:30 SGT on Sunday. Use a PDF deck committed to the repo, not a video (a 31-second video is ineligible).

### Should fix

- §10 storage is built for a product, not this weekend. The series builder only keeps May to September scenes, so incremental refresh, the 12 h and 24 h freshness rules, the `algo` version and 'new since last visit' have nothing to do before May 2027, after judging ends on 26 January.
  - Fix: One JSON per polygon hash in /tmp, written once. Keep the abuse limits (polygon only, no holes, 200 vertices, 5,000 ha, one global semaphore, cap on concurrent builds). Delete the Cloud Storage mount from the plan, not 'later'.
- MODIS in the live build path doubles a new field's wait: 30.2 s measured today against about 15 s for Sentinel-2 alone. It also drags in the 2025 gap, the 100 ha rule and reliability masking.
  - Fix: MODIS for the three presets only. It comes for free in the same preset fetch tonight. Show one line ('nth-lowest peak of 26 seasons, 2025 excluded as incomplete at source'). Cut line Sunday 18:30 SGT for the UI line; the data is committed either way.
- Six alert types. PATCHY has no data on this path. NO_GREENUP and ABRUPT_DROP only appear in replay, and in my 2021 replay on the test rectangle nothing fired before 11 August.
  - Fix: Port vegspec.py whole (186 lines, self-check passes) and enable three: vegetation deficit, water stress, bare soil. Design the UI for three.
- Growing-degree-day stage windows with an editable sowing date. The code exists and re-ran cleanly today, but it puts 2021 maturity on 29 July and 2024 on 9 August, weeks before the late-August harvest §4 states. The rotation scoring does not use the windows at all.
  - Fix: Port climate_metrics.py and diagnose.py unchanged. Cut the sowing-date editor and never display stage dates. If the Akmola or North Kazakhstan cells give nonsense, switch to fixed calendar windows.
- Land-use inference with a per-year declaration flow ('asks only about years it cannot classify') is about 2 h of UI and state.
  - Fix: Keep the classifier (it is a few lines inside vegspec.metrics and stops fallow reading as drought). Show the label as 'inferred'. Cut the override UI. Keep one field-level select with the two rotation presets.
- Phone layout as specified (bottom drawer over the map, touch drawing, an `impeccable adapt` pass) is 2.5-3 h, and touch drawing is untested.
  - Fix: 'Does not break' tier only, 30 minutes on Sunday after save #1: the sidebar becomes a sheet (shadcn default), the panel stacks under a 45dvh map, the draw toolbar is hidden on touch screens.
- Five design-skill passes (impeccable init and shape, dataviz, break-ui, adapt, polish) cost 3-4 h including the churn they create. init also writes PRODUCT.md, DESIGN.md and .impeccable/ into the repo.
  - Fix: Read dataviz once before the first chart (15 min) and run one 45-minute polish pass after save #1. The wireframe and colour tokens in docs/research/ui-design/README.md sections 5 and 6 are the design brief.
- Live Planetary Computer overlay tiles for the field-zoom NDVI picture take about 2 s per tile from a preview API.
  - Fix: For presets, pre-render one NDVI image per preset and demo year with the item crop endpoint, commit the PNGs and show them as an image source. Skip the overlay for drawn fields.
- Small scope creep in §7 and the wireframe: URL state sync, dark mode, command search, alert popover, slider play and cross-fade.
  - Fix: Force light theme, read `?field=` once on load so the deck can deep-link a preset, drop the rest.
- One agent stream is the bottleneck on Saturday night: analyse() and the panel UI are about 8.5 h of serial work.
  - Fix: Once the preset JSON contract and a hand-written sample exist, a second agent session can build the panel against the sample while the first builds analyse(). The directories do not overlap. Only do this if steering two sessions is comfortable.
- Stale or loose numbers in the brief. Port 8080 had nothing listening when I checked. The POWER cell file for the seven listed parameters is 1.9 MB in 2.7 s, not 'about 5 MB, 4 s'. §8 says 75% clear while the data note says 80%.
  - Fix: Fix when next editing CLAUDE.md. None blocks work.

### Material

Tags: **[V]** verified by me today, **[R]** read in the notes or code, **[E]** my estimate or inference. Times are **SGT (local UTC+5 in brackets)**.

## 1. Capacity

| | Hours |
| --- | --- |
| Wall clock, Sat 17:30 to Sun 23:59 SGT [V] | 30.5 |
| Sleep 03:00-09:30 SGT (00:00-06:30) | 6.5 |
| Meals, wind-down, closing buffer | 4.5 |
| Focused hours [E] | 19.5 |
| Plan as written [E] | about 60 |
| Reduced plan [E] | about 32: agent lane 22, parallel human lane 9 |

Core agent work is about 17.5 h and the second tier about 5 h. Expect to finish the core plus one or two second-tier items.

## 2. Estimates (hours) [E]

| Phase / item | As written | Reduced | Lane | Note |
| --- | --- | --- | --- | --- |
| **0. Not in the plan** | 0 | 1.25 | human | push, public, LICENSE, placeholder deck, save #0 |
| **1. UI shell and map** | **7.75** | **4.5** | | |
| Scaffold, components, mapcn, press fix | 0.5 | done | agent | commits 0fe10a8, 36eb796 |
| Shell, basemap, 4 GIBS rows, legends, preset polygons, list | 3.5 | 2.25 | agent | proof files compile [V] |
| Time slider (valid dates, year toggle) | 1.25 | 0.75 | agent | second tier |
| Draw, name, save, live call | 1.75 | 1.5 | agent | second tier |
| URL state, dark mode | 0.75 | 0 | | cut |
| **2. Field data** | **7.75** | **3.5** | | |
| FastAPI skeleton, dev proxy | 0.5 | 0.5 | agent | |
| Series builder, validation, cache | 2.75 | 1.25 | agent | write-once cache |
| POWER per cell | 0.5 | 0.25 | agent | 2.7 s, 1.9 MB [V] |
| Live overlay tiles | 1.0 | 0 | | pre-rendered PNG for presets |
| Charts, loading and error states | 3.0 | 1.5 | agent | |
| **3. Analysis** | **13.25** | **5.25** | | |
| vegspec port and adapter | 1.5 | 0.5 | agent | adapter ran [V] |
| Alerts UI | 1.5 | 0.75 | agent | three alerts |
| Land-use override UI | 2.0 | 0 | | cut |
| Climate port, diagnosis tab | 3.75 | 1.25 | agent | no sowing editor |
| Check thresholds on presets | 1.0 | 0.75 | both | |
| As-of replay | 1.25 | 0.5 | agent | precomputed per dekad; second tier |
| HTC strip, drought frequency, trend chips | 1.0 | 0 | | stretch |
| MODIS baseline | 2.25 | 0.75 | agent | presets only; second tier |
| **4. Rotation strategies** | **7.5** | **5.25** | | |
| Scoring port | 1.0 | 0.5 | agent | |
| Make scores coherent | 0 | 1.25 | both | not in plan; see must-fix |
| Declared-rotation editor | 1.25 | 0.25 | agent | two presets in a select |
| Card text templates | 1.5 | 1.25 | agent | |
| Cards, table, glossary, notes | 2.5 | 2.0 | agent | |
| **5. Presets and narrative** | **8.75** | **1.75** | | |
| Draw, inspect, fetch, commit presets | 1.75 | 1.75 | human | tonight |
| LLM narrative, validator, rate limit | 4.5 | 0 | | cut |
| Russian, Kazakh | 2.5 | 0 | | cut |
| **6. Publish and submit** | **9.75** | **7.75** | | |
| Dockerfile, gcloud, first deploy | 2.5 | 2.25 | both | tonight |
| Redeploys, production-only bugs | 1.0 | 0.75 | both | |
| GitHub Pages copy | 0 | 0.5 | human | fallback host |
| Cloud Storage mount | 1.0 | 0 | | cut |
| README, licences, AI-use section | 1.25 | 1.0 | human | |
| Deck | 2.0 | 1.75 | human | |
| Project page text, link checks | 2.0 | 1.5 | human | |
| **Cross-cutting** | **8.0** | **2.5** | | |
| Phone layout | 2.5 | 0.5 | agent | second tier |
| Design-skill passes | 3.0 | 1.0 | agent | dataviz read, one polish |
| Steering, commits | 2.5 | 1.0 | human | |
| **Total** | **about 63** | **about 32** | | |

## 3. Critical path and first submission

1. Repo pushed and public (human, 15 min).
2. Preset JSON contract and one hand-written sample (30 min).
3. Three polygons, raw Sentinel-2, MODIS and POWER committed (human, 1.75 h; the fetch is 30 s per field [V]).
4. `analyse()` writes `frontend/public/presets/<id>.json` (agent, 4 h, including the scoring repair).
5. Panel renders the preset JSON, Strategies tab first (agent, 4.5 h).
6. Public URL, Cloud Run or GitHub Pages (0.75 h if the hello-world worked tonight).
7. Deck v1, README, page text (human, in parallel).

- **Earliest save:** about 75 minutes after the developer starts on it. It needs a public repo, a three-slide PDF and form text, and no working app. Target **Sat 19:30 SGT (16:30)**.
- **First real save:** **Sun 15:00 SGT (12:00)**, with whatever is deployed.
- Steps 4 and 5 are about 8.5 h of serial agent work against about 7 h available before 13:00 on Sunday. Either run them in two sessions after step 2, or accept that save #1 has the Strategies and Overview tabs and the Climate tab follows.

## 4. Cut order

**Cut now:**
1. Kazakh
2. Russian
3. LLM narrative, validator, slowapi
4. Field chat
5. Cloud Storage mount and incremental refresh
6. Per-year land-use override UI
7. Phone drawer and touch drawing
8. impeccable init/shape, break-ui, adapt
9. URL sync, dark mode, command search
10. Live overlay tiles
11. Sowing-date editor
12. PATCHY, NO_GREENUP, ABRUPT_DROP
13. Second rainfall source, HLS

**Cut by the clock, last to go first:** polish pass, phone check, MODIS line, slider replay, draw-your-own-field, Climate tab UI.

**Never cut:** presets, three alerts, three cards with gaps and local-review lists, deploy, deck, README credits.

| Challenged item | Verdict |
| --- | --- |
| MODIS baseline | Keep for presets only. Data arrives in tonight's fetch [V]. Not in the live path. Rank it above the LLM. |
| LLM narrative and validator | Cut. No key in the environment [V], never run against a model [R], and the judged demo would show static text anyway. If a key appears and all else is done by Sun 17:00: one offline script, a human read, committed text with the label, 45 min. |
| Russian and Kazakh | Cut both. Judging is in English. Without the LLM it is an i18n layer through every component. |
| Six alert types | Three. See should-fix. |
| GDD stage windows | Keep the code, cut the editor, hide the stage dates. |
| Land-use inference | Keep the classifier, cut the UI. |
| Five indicators | The formulas are free. The problem is the output [V]. Repair or relabel tonight. |
| Phone layout | 'Does not break' only. |
| Design-skill passes | One read, one pass. |
| Cloud Storage mount | Delete. Nothing durable is at stake. |

## 5. Dependencies and fallbacks

| Dependency | State today | Fallback | Trigger |
| --- | --- | --- | --- |
| Planetary Computer statistics | Alive: 797 calls, 30.2 s, 0 failures [V]. Untested from Cloud Run and with several users. Preview API [R]. | No second reader. Presets are static files. A failed live build shows 'live satellite service unavailable, preset fields still work'. | /api/health probe on first deploy |
| mapcn | Registry answers, installs in 6 s, builds with the proof files [V]. Not browser-run on radix-nova. | Raw maplibre-gl in a 30-line component. RasterLayer and useFieldDraw only need the map object [R]. | No map on screen by Sat 19:00 SGT |
| OpenFreeMap | Style returns 200 in 0.11 s [V]. No SLA to 26 January [R]. | On style error or timeout, swap to an inline raster style on the EOX layer (about 15 lines). No labels that need its glyphs. | Automatic at runtime |
| Cloud Run | Unproven for this account. | GitHub Pages static build with presets (`base: './'`). Keep it as a copy even if Cloud Run works. | Hello-world not live by Sat 22:30 SGT |
| gcloud | Not installed [V]. Homebrew cask `gcloud-cli` 593.0.0 exists [V]. | Cloud Shell in the browser: clone the public repo and deploy from there [E]. | Install not done in 15 min |
| GIBS, EOX, POWER | 200 in 1.1 s, 0.9 s, 2.7 s [V] | Committed preset files and screenshots | n/a |

## 6. Precompute and commit

Tonight:
- Three preset polygons (GeoJSON).
- Raw Sentinel-2 2017-2026 and MODIS 2000-2026 series per preset (94 KB each [V]), fetched with the final expression.
- POWER daily file per preset cell (1.9 MB each [V]).
- Land use per year for each preset, declared by hand in the build script.

As soon as analyse() runs:
- One result JSON per preset in `frontend/public/presets/`, so the frontend needs no backend. Contents: alerts per year, alerts as of each dekad for the two demo years, diagnosis, stress profile, three cards for both baseline presets, MODIS rank.
- One clear Sentinel-2 item id per preset and demo year, and the pre-rendered NDVI PNG for each.

As soon as the map works:
- Screenshots of the 2021 and 2024 GIBS NDVI layers over each preset, for the deck.

Sunday:
- The deck as a PDF in the repo, so the demo link is a GitHub file.

## 7. Schedule

14:00-17:30 SGT is already gone: it was 17:25 SGT when this review started.

| SGT (local) | Agent lane | Human lane | Checkpoint / cut line |
| --- | --- | --- | --- |
| **Sat 17:30-18:00** (14:30-15:00) | Continue the shell | Read this, decide cuts, push repo, make it public | |
| **18:00-20:00** (15:00-17:00) | Thin shell: basemap, GIBS rows, preset list, empty tabbed panel. Then the JSON contract and sample | LICENSE, 3-slide placeholder PDF, open the form. Then install gcloud and create the project | **19:00: no map on screen, switch to raw maplibre-gl.** **19:30: SAVE #0.** 20:00: stop the shell wherever it is |
| 20:00-20:45 (17:00-17:45) | | Break | |
| **20:45-22:30** (17:45-19:30) | Backend skeleton, series builder with the final expression, POWER, `build_presets.py`, hello-world Dockerfile with /api/health probe | Draw three fields, fetch, inspect, redraw. First Cloud Run deploy | **22:30: presets and raw data committed** (fewer than three clean ones: go with what is clean, Kostanay at minimum). **22:30: hello-world not live, GitHub Pages is the host** |
| **22:30-02:30** (19:30-23:30) | `analyse()`: vegspec with three alerts, climate, stress profile, scoring with asserts, card templates. Write the preset JSON | Review preset numbers, declare land use, deck outline, README skeleton | **75 min into scoring: still incoherent, rename cards by action.** **02:30: preset JSON with three strategies committed** |
| 02:30-03:00 (23:30-00:00) | | Commit, write five lines for the morning | |
| **03:00-09:30** (00:00-06:30) | | **Sleep** | |
| 09:30-10:00 (06:30-07:00) | | Breakfast | |
| **Sun 10:00-13:00** (07:00-10:00) | Panel on preset JSON, in this order: Strategies cards and table, Overview chart and alerts, Climate, glossary and notes, attribution, states | Deck v1, README credits and licences | **13:00: Strategies or Overview missing, drop the Climate tab UI and show the diagnosis as a list in Overview** |
| 13:00-13:45 (10:00-10:45) | | Lunch | |
| **13:45-15:00** (10:45-12:00) | Real deploy, fix production-only bugs | Private-window and phone check, screenshots into the deck, page text | **15:00: SAVE #1 with whatever is deployed.** No public URL showing presets: all feature work stops until there is one |
| **15:00-18:30** (12:00-15:30) | Second tier in order: (1) draw-your-own-field with live build, loading and error states; (2) slider on GIBS layers plus as-of alerts; (3) MODIS line for presets | Deck v2, README, test each redeploy | **17:30: drawing not working on the deployed URL, remove the Draw button.** **18:30: slider replay or MODIS line not done, dropped** |
| 18:30-19:15 (15:30-16:15) | | Dinner | |
| **19:15-20:30** (16:15-17:30) | Phone check (30 min), one polish pass (45 min) | Deck final text | **20:30: FEATURE FREEZE** |
| **20:30-22:15** (17:30-19:15) | Final deploy at 20:30, then fixes to broken things only | Fresh screenshots, export the deck (7 slides or fewer, team and challenge on it), push, check every link in a private window, phone smoke test | |
| **22:15-22:45** (19:15-19:45) | | **FINAL SAVE.** Reopen the page in a private window | |
| 22:45-23:30 (19:45-20:30) | | Buffer for a broken link only | **23:30 SGT (20:30 local): hands off the form** |

Scratch files are in `scratch/review/schedule/` (`code/score_probe.py`, `code/adapter_probe.py`, `out/`, `scaffold/`). Nothing in the project was changed and no process is left running.

## Remote-sensing scientist and agronomist

The core design is sound and the two headline demo contrasts survive a live re-run today on the preset blocks (Kostanay 2021: peak 74% of usual, robust regional dry spell; Akmola 2023: peak 72%, driest pre-flowering window on record at any sowing date). The plan is not yet scientifically safe to show, though: the rules were tuned on field medians but the plan fetches masked means (4 of 27 preset site-seasons change label or alert), the replay uses hindsight, and several alerts fire on normal farming (August stubble, late green-up, a changed crop). The climate attribution cannot separate causes for one field on a 50 km grid: its heat flag fires in 11 to 18 of 36 seasons, flags flip with a 10-day sowing shift, and the headline "19% of normal rain" for Kostanay 2021 becomes 82% if flowering is 10 days later. The rotation scoring puts sunflower in the "water-resilient" card everywhere even with all prices set to 1, ranks the only locally trialled option (oats) last, and its "soil-restoring" pick scores below continuous wheat on soil. Every must-fix below is a rule change, a deletion or a wording change, about five to six hours in total. The machine clock read 14:48 UTC+5 (17:48 Singapore) when I finished, so roughly 30 hours remain, not 34.

### Must fix

- **Statistic mismatch. vegspec.py needs field MEDIANS of NDVI, NDMI, NBR2 plus NDVI p10/p90 and the SCL 11 share. The planned call returns masked MEANS, and field_series.py fetches NDVI, NDMI and NDRE only: no B12 (so no NBR2, no tilled-versus-stubble test), no percentiles (so no PATCHY), no snow share. Verified live on three preset blocks, 2018-2026: feeding means instead of medians changed the land-use label or an alert in 4 of 27 site-seasons. Kostanay block 2018: peak 0.68 (median) against 0.52 (mean), 'cropped' becomes 'ambiguous' with a false VEG_DEFICIT; 2019 gains false VEG_DEFICIT and WATER_STRESS. On uniform polygons (Akmola block) nothing changed; the damage is on mixed polygons.**
  - Fix: Keep the hosted endpoint, one POST per scene, and take the median from a histogram. expression = where(C,1,0);where(C,(B08-B04)/(B08+B04{D}),-2);where(C,(B08-B11)/(B08+B11{D}),-2);where(C,(B11-B12)/(B11+B12{D}),-2);where(SCL==11,1,0) with C=(SCL==4)|(SCL==5), D=-2000 when baseline >= 04.00, plus histogram_bins=300&histogram_range=-2,1. clear = mean[0]*valid_percent/100; snow = mean[4]; median, p10, p90 = quantiles of the histogram bins at or above -1 (the first 100 bins hold the masked pixels), 0.01 resolution. Accept a scene when clear >= 0.75 and snow < 0.05. Drop NDRE. Write stat=median into the file's algo version. Verified live: the call works, 1.4-2.0 s each, about 550 calls per preset in 2 minutes at 10 threads with no failed call, and it reproduces the note's 0.622 mean for the 2024-07-04 scene.
- **The replay is not a replay. alerts(upto=i) truncates the curve but keeps the land-use label, despike and gap fill computed from the whole season. Verified on presets: with observations after the as-of date really removed, an undeclared season is 'unknown' until 11-20 July and the first deficit alert appears as of 21-31 July in both demo years. Second defect, verified on a synthetic normal crop whose peak was never observed: undeclared returns INSUFFICIENT_DATA, but declaring 'crop' bypasses that guard and raises VEG_DEFICIT watch (peak 81% of usual). Real cases exist: the Kostanay block has no accepted scene from 21 June to 20 July 2026 and none from 21 July to 31 August 2025.**
  - Fix: For an as-of date, delete the target season's scenes dated after it BEFORE despike, gap fill and metrics, then run the rules. Unfinished season with no declaration: no in-season alert before 11 August, show 'Declare this year's crop or fallow to switch on in-season alerts.' Baseline stays all other cropped seasons; print 'compared with N other cropped seasons 2018-2026, including later ones'. Data guard applied whatever the declared use: VEG_DEFICIT needs at least 3 dekads with a real (not interpolated) observation in 21 June-10 August and at least 1 real observation within one dekad of the baseline's median peak dekad; otherwise output 'Peak not observed (cloud): no judgement this season.' Replay caption: 'Reconstruction from the satellite record up to this date. It is not a log of alerts that were sent.'
- **VEG_DEFICIT fires on a changed crop and is blind to a late green flush; WATER_STRESS is not an independent signal. Verified in docs/research/vegetation-analysis/run_spec_output.txt: square A 2020 (season integral 130% of usual), B 2023 (124%, 10 green dekads) and D 2024 (141%) all get VEG_DEFICIT, and A 2020 and B 2023 also get WATER_STRESS warning or severe, because a crop with a lower but longer canopy is judged against a wheat baseline. The 'or I <= 0.65' branch fires on late sowing and short-season crops, the very case the note rejected same-date comparison for. Opposite failure: square A 2023 had a mid-season maximum of 0.52 against a usual 0.75 and stayed silent because NDVI reached 0.78 in early September, in a year the plan calls a national drought with a wet harvest. Since the app recommends flax, lentil and pea, a farmer who follows it gets permanent alerts.**
  - Fix: Take peak and integral over 1 June-20 August only. r = peak / median baseline peak; I = sum(max(NDVI-0.20,0)) / same for the baseline median curve over shared dekads (at least 6) of that window. Levels: watch r <= 0.90, warning r <= 0.80, severe r <= 0.65, each only if I < 0.90. If r <= 0.90 and I >= 0.90: no alert, info line 'Lower peak but a normal season total: the crop or sowing date probably differs from earlier years.' I never raises or escalates a level. If the season's highest NDVI falls after 20 August and exceeds the window peak: info 'Green cover after 20 August (regrowth, weeds or a late-sown crop) is not counted as crop performance.' NDMI: no separate alert. When VEG_DEFICIT is warning or severe and NDMI at peak is 0.15 or more below the baseline's, add the evidence line 'Canopy moisture signal (NDMI) also low at peak.' Use the words 'water stress' only when the climate dry-spell test also passes. Checked against the printed r and whole-season I of the note's table and my preset runs (Kostanay 2021, Akmola 2023, Tayinsha 2021 stay at warning); the windowed integral itself was not recomputed.
- **BARE_SOIL fires on August stubble, and its message counts seedbed days. Verified on the Akmola preset block for the demo year 2023: the drought-hit crop senesced by 5 August (NDVI 0.20, 0.18, 0.17 in the three August dekads, NBR2 0.10-0.12) and the rule returns 'BARE_SOIL warning: 30 d without cover (residue cover)'. Same on the Tayinsha block in 2020. The window runs to 31 August although the same spec says nothing after 11 August counts. The message also prints 'N bare days May-Sep' (40-90 days in every normal cropped year), which contradicts section 4: May seedbed must never count.**
  - Fix: Cropped, ambiguous or undeclared years: at least 3 consecutive dekads under 0.25 inside 21 June-10 August AND median NBR2 of those dekads < 0.06, then 'Bare soil in mid-season' (warning). Fallow years (declared, or mid-season maximum < 0.30): same test to 31 August, info only. Remove 'bare days May-Sep' from every message. If an erosion figure is wanted, show 'days of bare tilled soil, 1 May-30 September, seedbed included' on the soil card, never as an alert. Verified: with the 10 August end both false warnings disappear and the two real fallow years on the presets keep their info line.
- **NO_GREENUP watch at 21 June is a late-sowing alarm, and 'ambiguous' years carry severities. Verified: all 6 firings of NO_GREENUP watch (3 in the note's output, 3 on the preset blocks: Akmola 2020, Kostanay 2018, Tayinsha 2022) were followed by a normal peak. Ambiguous years (failed crop or weedy fallow) currently get VEG_DEFICIT severe and BARE_SOIL warning with a small 'confirm land use' tag. Verified at the preset block centres: Akmola was fallow in 2021 and 'ambiguous' in 2023 (the demo year); Kostanay was fallow in 2023; Tayinsha 'ambiguous' in 2020 and 2023; Kostanay 2026 'unknown'.**
  - Fix: Delete the 21 June watch. Keep one test: on 11 July, declared crop, NDVI < 0.30, baseline median for that dekad >= 0.40, no earlier dekad >= 0.30, then 'Crop has not greened up' (warning). Ambiguous year: no severity, no BARE_SOIL, excluded from the baseline and from the rotation history; show one prompt: 'Low green cover in <year> (peak X% of this field's usual). Was this a crop that failed, or a fallow year? Tell us to complete the analysis.' Every preset file carries a declared land use for each year 2018-2026, set after looking at the curve of the final outline.
- **Stage windows are two to three weeks early and the flags are not robust. Verified by re-running diagnose.py on fresh POWER data for five cells: (1) maturity lands 75-86 days after sowing (29 July 2021, 9 August 2024) while the catalogue says 90-105 days and the preset Sentinel-2 curves still read NDVI 0.47-0.76 on 1-10 August in normal years; (2) the headline '13 mm = 19% of normal, sowing to flowering' for 2021 at the Kostanay city cell becomes 60 mm = 82% (water score 6 to 1) when flowering is 10 days later, because 47 mm fell on 11-12 July; (3) the heat flag fires in 11-18 of 36 seasons and switches on or off with a 10-day sowing shift in 4-8 seasons per cell; the water flag flips in 2-6. Also climate_metrics.py and diagnose.py use different stage thresholds and windows.**
  - Fix: One stage table, in diagnose.py only: GDD base 0 from sowing, emergence 140, jointing 700, anthesis 1000, maturity 1850; default sowing 20 May (anthesis and maturity are the medians at day 55 and day 97 in the four cells: 962-1006 and 1806-1868; day 55 for flowering is my regional judgement). Run for sowing 10, 20 and 30 May; show a cause only if flagged in all three, otherwise show the numbers with 'depends on sowing date'. Water: replace 'rain sowing to flowering' by the driest 40-day window: for windows starting 0, 5, ... 30 days after sowing, rain / 1991-2020 mean rain of the same dates; take the minimum; flag when <= 0.40 and <= the cell's 20th percentile. Heat: one descriptor, days with Tmax >= 30 C from sowing to sowing + 90 days, with its rank in 1991-2026; 'unusually hot' when >= the cell's 90th percentile at all three sowing dates. Label stage dates 'estimated, plus or minus 10 days'. Tested: the dry-spell rule flags Kostanay 2021 at both cells (0.21, 0.31) and Akmola 2023 (0.34), 3-6 of 36 seasons at three cells, none at the Tayinsha cell; the heat rule flags 2-5 of 36 seasons including Kostanay-preset 2021 and Akmola 2023.
- **Two class tables (README edges 0.4/0.6/0.8/1.0, code 0.4/0.5/0.7/1.0), and either one calls the normal climate a drought. Verified on POWER 1991-2026: at the Kostanay city cell 34 of 36 seasons are below 1.0; at the Akmola preset cell 18 of 36 are below 0.6, so half of all seasons would be 'severe' or 'very severe drought'. That also contradicts the note's own count of 10 drought seasons in 36.**
  - Fix: Keep the README edges and rename the classes as moisture supply: < 0.4 very dry, 0.4-0.6 dry, 0.6-0.8 moderately dry, 0.8-1.0 slightly dry, 1.0-1.5 adequate, > 1.5 wet. Call a season a 'drought' only when its May-August HTC is at or below the cell's own 20th percentile for 1991-2020 ('severe' at or below the 10th). Always print 'HTC x.xx, rank k of 36 (1 = driest)'.
- **The attribution claims more than a 50 km grid can support. Verified cases: (1) Tayinsha block 2020: canopy never above 0.45 from mid-June, yet the printed cause is 'heat during grain fill' from 18-19 July and 3 August, after the effect; (2) Akmola cell 2022: water deficit flagged at all four sowing dates while the field's peak equals its median; (3) Kostanay block 2022: a 13% dip (watch) would get 'not explained by weather: possibly management, nutrients, pests or monoculture'; (4) the vegetation note's squares flag 2022 at warning or severe on 3 of 4 cropland squares and on unmanaged steppe, while POWER for that area shows 144% of normal rain before flowering and 8 hot days. The two modules were never run on the same place. The confidence rule depends on regional_low, which nothing computes.**
  - Fix: Three verdicts, exact wording. (a) Field deficit at warning or severe and a dry spell or unusual heat that ends on or before the dekad of the observed NDVI peak: 'Regional weather was unusually dry [and hot] before this crop's peak (NASA POWER, about 50 km grid). That is consistent with the low greenness on this field. The grid cannot show whether this field received the same weather.' (b) Weather flagged, field normal: 'Regional weather was unusually dry this season, but this field's greenness stayed within its usual range.' (c) Field deficit, no weather flag before the peak: 'The regional weather record does not explain the low greenness. Causes this app cannot see include a local shortfall of rain, hail, a frost pocket, late sowing, weeds, pests, disease, nutrition, herbicide injury, or a different crop from earlier years. This needs a field visit.' No attribution sentence for a watch. When dry and hot together: 'Dry and hot conditions came together; the data cannot say which did more harm.' Wet harvest is a separate note. Delete the high/medium/low confidence labels and list the evidence lines instead. Never print 'management', 'monoculture' or 'caused'.
- **An implied trend and three reference periods. The per-decade drought count reads as 'droughts are getting rarer', the last 'decade' has 6 seasons, and the count changes with the sowing assumption (verified: 7 to 10 flagged seasons at one cell). POWER and ERA5 disagree on the sign of the temperature trend. Reference periods in use: 1991-2020 (climate note), 2001-2020 (agronomy note), median of 2001-2026 (section 4).**
  - Fix: Show the 36-season strip only; delete per-decade counts. Chip text: 'NASA POWER shows no clear trend in growing-season rain or temperature for this grid cell (1991-2025). ERA5 shows about +0.3 C per decade, also not statistically clear. We make no trend claim.' One reference everywhere: the 1991-2020 mean and percentiles of the cell. Restate section 4 accordingly (city cell: 94 mm = 57% of the 1991-2020 mean of 166 mm; preset cell: 87 mm = 45% of 196 mm) and re-query POWER at each preset's own cell.
- **Sunflower wins the 'water-resilient' card everywhere, and it is not a price artefact. Verified by running the sketch: wheat-sunflower-barley-wheat wins at all three sites, and still wins with every price set to 1 and with prices rescaled. Real causes: (1) the predecessor factor is applied only when the next crop is wheat, and the template puts barley after sunflower, so the 0.75 penalty never applies; (2) yields are national mid-ranges (sunflower 1.11 t/ha against 0.70 in the Barayev dry-steppe trials, rapeseed 1.29 against 0.67, oats 1.25 against 2.38); (3) the dry-carry penalty is worth 0.02. The catalogue itself ranks sunflower water use 5 of 5. With the factor applied to every following crop and Barayev yields for sunflower and rapeseed, sunflower drops to third at all three sites. Picks are also decided in the third decimal (Kostanay soil: 0.711 against 0.710) and flip between lentil and pea under either change. PRICE lives in the script, unsourced per row, with wheat at its early-2025 low (65-70k KZT/t) and oilseeds at their high; against the October 2025 floor of 115k the flax ratio is 1.7, not 2.8.**
  - Fix: (1) Apply the predecessor factor to every crop that follows, not only wheat. (2) Use the local trial yield where the catalogue has one (new key yield_local_t_ha); national range only as a marked fallback. (3) No crop with water_use_j = 5 in the water-resilient strategy unless fallow follows it; remove wheat-sunflower-barley-wheat from that list. If sunflower is shown, it is a separate 'market option' line with: 'Sunflower leaves a drier soil profile; the next crop may yield less (this app assumes 25% less, a judgement). Usual advice is not to return to the same field within 6 years.' (4) Totals within 0.03 are a tie: show both with 'no clear difference between these two'. (5) Move prices into the catalogue with date and source per row; primary number is tonnes of grain per rotation hectare; rename the price-weighted figure 'Gross value index (prices of <month year>, production costs not included)'. Never write profit or income.
- **The 'soil-restoring' pick is not better for soil than the baseline. Verified output: continuous wheat scores 0.60 on soil; the pick for Kostanay and Akmola (lentil-wheat-flax-barley) scores 0.59 and puts two thin-residue crops in four years on wind-erosion land. Oats-wheat-wheat-barley, the only template with a local rotation trial (2.13 against 1.68 t/ha at Shortandy), ranks last at every site. pest_break is 1.0 (perfect) for pea-wheat-rapeseed-wheat, two Sclerotinia hosts two years apart, while the note records 36-40% septoria on wheat after every predecessor.**
  - Fix: A soil-restoring candidate must score at least 0.05 above the declared baseline on soil and contain at most one crop with residue_cover_j <= 2 in four years; if none qualifies, show no pick and say: 'Your rotation already keeps residue on the soil. The gains available are nitrogen and a break from wheat diseases, not soil cover.' Always show oats-wheat-wheat-barley beside the scored pick, labelled 'Measured at Shortandy 2018-2020: 27% more grain per rotation hectare than the fallow rotation.' Add an evidence grade to every template: 'local rotation trial', 'crops trialled locally, rotation not', or 'judgement'. Cap pest_break at 0.8 and rename it 'break from wheat diseases and weeds (does not replace scouting)'.
- **Carry-over, return intervals and zone gates are not enforced. Herbicide carry-over is one generic bullet on every card although the soil pick sows lentil straight after sprayed cereals. No return interval exists except a remark for lentil, while four-year templates bring flax, rapeseed, pea or sunflower back every four years. Verified on POWER: the frost gates for sunflower and millet never bind (Tmin <= -2 C before 20 September in 0-4 of 36 seasons at the four cells), so both are allowed everywhere including 53.9 N; gates and the stress profile use six seasons (2019-2024) of city-point data, and the 200 mm rapeseed gate sits inside POWER's rainfall error (preset cells 157-196 mm).**
  - Fix: Catalogue: add plantback_sensitive = true for lentil, field pea, chickpea, flax, sunflower, rapeseed, sweet clover, and min_return_years (sunflower 6, flax 5, rapeseed 4, lentil 4, field pea 4, chickpea 4; standard agronomy from memory, mark as judgement). First line of any card that introduces such a crop: 'Before sowing <crop>: check which herbicides were used on this field in the last two seasons. Residues of sulfonylurea and some other cereal herbicides last longer in dry, alkaline soil and can injure <crop>. This app cannot see herbicide history.' If a template returns a crop sooner than min_return_years: '<crop> every 4 years is shorter than the usual <n>-year gap; alternate with another break crop.' Gates from the cell's 1991-2020 normals, shown as warnings: rapeseed May-August rain >= 190 mm, 170-190 'borderline, local check', below 170 not shown; sunflower and millet carry 'Late crop: early hybrids only, harvest in late September or October, frost and drying risk' where the 20th percentile of the sum of daily mean temperature above 10 C (15 May-15 September) is below 2100 (preset cells: 2031-2066); where annual rain is below 300 mm add to any fallow-free card: 'In the dry steppe, research still keeps one fallow field in four to six. Consider stubble-retained fallow rather than removing fallow.' All numeric gates are my judgement and need a local agronomist.
- **The MODIS baseline, if built, will mis-rank. Verified today: MOD13Q1 on Planetary Computer jumps from 26 June to 17 November 2025 (GIBS has the year); at the Tayinsha preset two MODIS tiles match and one returns null statistics, which the reference code multiplies, so the whole build raises. The reference averages the reliability band, so 25% cloud passes a 'mean <= 1' test. Fallow years are not excluded: a field in a four-year fallow rotation has about six fallow summers since 2000 and they take the lowest ranks (the data-path note found 2021 only 9th lowest of 27 on a three-field rectangle). Size limit is 100 ha in the plan and 150 ha in the vegetation note; season count is 26 in one note, 27 in the other.**
  - Fix: Only fields of 150 ha or more. A season counts when at least 4 of the composites starting 10 June-28 August exist with reliability max <= 1 (use the max the endpoint already returns); this drops 2025: say '26 seasons, 2000-2026 without 2025'. Skip rows whose mean is null; keep one row per date (highest valid_percent). Seasons with a June-August peak below 0.40 (the 0.30 fallow line plus the sensor offset) are 'fallow-like' and not ranked. Peaks within 0.03 are ties. Wording: 'Among the <k> lowest of <N> cropped-looking summers since 2000 (MODIS, 250 m pixels that include neighbouring land).' Never 'worst in 26 years'. It is sixth on the cut list; cutting it costs the science nothing.
- **The narrative checker only tests numbers, and the plan has no list of forbidden claims or fixed caveat lines. A fluent sentence such as 'the drought caused the loss' or 'we recommend lentil' passes. The spec also prints z-scores from 4-8 seasons (my preset run printed 'z -4.0, n=6').**
  - Fix: Adopt the 'never say / say instead' table in extra as fixed template text. Checker: discard LLM text containing caused, due to, proves, confirms, will yield, guarantee, recommend, you should, must, best, profit, income, healthy, or any crop name absent from the cited facts. Never show a z-score with fewer than 10 seasons: show 'lowest of N seasons'. Fixed lines: under every alert, 'Indicative level, compared with this field's own N earlier cropped seasons; not checked against yield.' Under every climate panel, 'Regional estimate for a grid cell of about 50 km (NASA POWER). Not a measurement on this field.' On every card, 'An option to discuss with your agronomist, not a recommendation. Scores rest on a draft catalogue that no local agronomist has reviewed (dated 2026-11-14).' Carry the uncertainty statement and the satellite-versus-ground note from extra in a visible 'About the data' panel.

### Should fix

- Absolute greenness thresholds do not transfer to drier fields. Verified: the Akmola block's median cropped peak is 0.56, so the 0.45 'green' line is 80% of normal there and any warning-level year is automatically labelled 'ambiguous' instead of stressed.
  - Fix: After the first pass, set the green line for the field to min(0.45, 0.75 x median cropped peak) and relabel; or keep it and rely on declared land use, saying so in the prompt.
- Severity rests on single scenes. Verified: moving the clear-fraction limit from 0.75 to 0.80 moved 3 of 27 preset site-seasons across a level (Tayinsha 2023 from warning to severe) while losing only 0-3 scenes a season.
  - Fix: Keep 0.75. Define the peak as the mean of the highest dekad and its higher neighbour, and print the number of images behind each season next to the level.
- ABRUPT_DROP fires on an early-maturing crop. Verified on the Tayinsha block 2026: peak in mid-June, 'drop' in the last dekad of July, alert present with medians and absent with means. Pea, barley and lentil ripen before the 11 August cut-off.
  - Fix: Fire only when the drop starts within two dekads after the season's running peak and before 11 August; word it 'sudden loss of green cover'.
- Alerts flicker during replay. Verified on a declared-crop run of the Akmola 2021 season: deficit on at 11-20 July, off at 21-31 July, on again at 1-10 August.
  - Fix: Latch each alert for the rest of the season once raised.
- Mixed polygons are flagged but still analysed. Verified: the Kostanay block has PATCHY warning in 4 of 9 seasons and mean and median peaks differ by up to 0.16.
  - Fix: When p90-p10 is 0.30 or more in at least two green dekads, show 'This outline seems to contain more than one field or crop. Redraw it along one field for reliable alerts' and withhold severities and strategy cards.
- A declared rotation has no phase, so fallow years cannot be placed on calendar years and in-season alerts cannot know this year's use.
  - Fix: One select per field: 'What was on this field in <last year>?' and derive the other years from the rotation.
- Water stored before sowing is ignored although snow is about 40% of annual precipitation; climate_metrics.py already computes November-March precipitation and never uses it.
  - Fix: Show 'November-March precipitation: percentile against 1991-2020' as one evidence line. Display only, no scoring.
- The last two months of POWER come from a different model version than the long record (the note cites POWER's own advice to stop trend work two months before real time).
  - Fix: Mark values newer than 60 days 'preliminary' and leave them out of percentiles.
- Map layers invite field-level reading. Verified in the GIBS capabilities file: the SMAP layer is a modelled 9 km product, a 12:00 UTC snapshot; the IMERG layer is a daily rate with gaps in its valid dates; the MODIS NDVI layer reads about 0.1 higher than the field chart.
  - Fix: Legend text: 'Modelled soil moisture, about 9 km, not your field'; 'Daily mean rain rate, about 10 km, not a rain total'; 'MODIS greenness (250 m) reads higher than the field chart (Sentinel-2)'. Build the slider's date list from the capabilities periods.
- A long thin polygon under 5,000 ha can exceed the 10 km overlap between Sentinel-2 tiles, so no single tile covers it and every scene fails the clear test silently (inferred from the dedup logic, not tested).
  - Fix: Reject outlines whose bounding box is longer than 10 km on either side.
- Smoke and haze are not masked by the scene classification and lower NDVI most in hot dry summers, the years of interest (inferred, unguarded). One hazy scene at the only clear date near the peak lowers the peak (verified on a synthetic case: a normal crop gets a watch).
  - Fix: Carry the caveat in the uncertainty statement; the neighbour-averaged peak above removes most of it.
- The stress profile is built from six seasons (2019-2024) at city points, and 'variability' is computed and never used.
  - Fix: Compute water and heat from the preset's own cell over 1991-2020 plus the field's 2018-2026 history; delete 'variability' or show it.
- field_series.py carries the comment 'add 6/7 if scenes get too sparse'. Class 7 is where thin cloud edges land.
  - Fix: Delete the comment; classes 4 and 5 only.
- Catalogue gaps a local reader will notice: mustard has a predecessor factor but no crop row; perennial grasses (the state-backed option for degraded land) are absent; oats has no note that wild oat cannot be controlled in the crop.
  - Fix: Add one line each to the 'needs local review' list rather than new scoring.

### Material

## 1. Values the plan should fix

| Topic | Variants found | Fix to |
| --- | --- | --- |
| Field statistic | median (vegetation and agronomy notes) / masked mean (CLAUDE.md section 8 step 2, field_series.py) | median, p10, p90 from the endpoint histogram |
| Clear fraction | 0.75 (section 8, vegetation) / 0.80 (data-path) | 0.75, plus snow class under 5% |
| Scene classes | 4 and 5 / "add 6/7 if sparse" | 4 and 5 only |
| Tile cloud filter | under 80% (vegetation) / none (section 8, data-path) | none |
| Bare dekad | NDVI 0.22 / 0.25 | 0.25 (Sentinel-2 median) |
| Fallow year | mid-season max under 0.30 over 21 Jun-10 Aug / peak under 0.30 over 15 Jun-20 Aug or 10 Jun-20 Aug | max over 21 Jun-10 Aug under 0.30; MODIS equivalent 0.40 |
| Bare-soil alert window | 21 Jun-31 Aug / 15 Jun-31 Aug / 15 Jun-20 Aug, against an 11 Aug harvest cut-off | 21 Jun-10 Aug for crops; to 31 Aug for fallow, info only |
| Bare days | whole May-Sep count printed in the alert / "May never counts" (section 4) | remove from alerts |
| Crop peak window | whole season / 21 Jun-10 Aug / June-August / 10 or 15 Jun-20 Aug | 1 Jun-20 Aug for peak and integral, both sensors |
| Stage thresholds (GDD) | 140/620/850/1070/1600, window 7 d (diagnose.py) / 150/800-950/1550, window 5 d (climate_metrics.py) / 90-105 days (catalogue) | 140/700/1000/1850, sowing 20 May, tested at 10, 20, 30 May |
| Heat threshold | 30 C (section 4, agronomy) / 31 and 35 C (diagnose) / 30, 32, 35 C (metrics) | days at or above 30 C, sowing to sowing + 90 d, ranked |
| HTC classes | 0.4/0.6/0.8/1.0/1.5 (README) / 0.4/0.5/0.7/1.0/1.5 (code) | README edges, moisture names; drought = own 20th percentile |
| Reference period | 1991-2020 / 2001-2020 / median of 2001-2026 | 1991-2020 everywhere |
| MODIS minimum field | 100 ha (section 8, data-path) / 150 ha (vegetation) | 150 ha |
| MODIS seasons | 26 / 27 | 26: 2000-2026 without 2025 |
| Sentinel-2 seasons | from 2018 / "ten seasons 2017-2026" | nine: 2018-2026 |
| MODIS against Sentinel-2 | +0.11 / +0.01 to +0.08 | "about 0.1 higher"; never compared |

## 2. Uncertainty statement (app text)

**How sure is this?** Field greenness comes from Sentinel-2 images. Cloud can hide a field for weeks, so a season rests on roughly 12 to 30 usable images and its peak can be missed. Alert levels compare this field with its own earlier cropped seasons (at most eight); the thresholds are indicative and have not been checked against yields or ground data. Weather comes from NASA POWER, a modelled grid of about 50 km: every field in a cell gets the same numbers, and a local storm, hail or a frost pocket is invisible. Crop stage dates are estimates, plus or minus 10 days. Rotation scores rest on a draft crop catalogue in which many values are the authors' judgement and no local agronomist has reviewed it; prices are dated. Treat every result as a reason to go and look, not as a finding.

## 3. Satellite data versus ground measurements (app text)

A satellite measures reflected light, not the crop. NDVI tells how much green leaf covers the ground. It does not measure yield, grain quality, soil moisture, nutrients or disease, and it cannot tell crop from weeds: a weedy field can look as green as a good crop, and a failed crop can look like fallow. A Sentinel-2 pixel is 10 to 20 m; the field value is the middle value of the cloud-free pixels on that day. A MODIS pixel is 250 m and mixes your field with its neighbours. Rain, temperature and soil wetness in this app are model estimates for an area about 50 km wide (9 km for the soil-moisture map layer), not readings from your field. A rain gauge, a soil probe or a walk through the crop is more accurate for your field and should overrule the app when they disagree. What satellites add is the same measurement on every field, every few days, back to 2018.

## 4. Never say / say instead

| Never | Say instead |
| --- | --- |
| "Drought (heat, frost) caused the loss on this field" | "Regional weather was unusually dry before this crop's peak. That is consistent with the low greenness on this field." |
| "Not caused by weather", "management problem", "monoculture is the cause" | "The regional weather record does not explain the low greenness. This needs a field visit." |
| "Water stress detected" from NDMI alone | "Canopy moisture signal (NDMI) low at peak" |
| A yield or a yield loss in t/ha or % | "Peak greenness X% of this field's usual" |
| "Bare soil" for a May seedbed or stubble after harvest | No alert |
| "Healthy", "no problem" | "No alert from satellite greenness. Weeds, disease and grain quality do not always change greenness." |
| Silence when cloud hid the peak | "Peak not observed (cloud): no judgement this season" |
| "Getting drier / hotter / wetter", "droughts are rarer" | "No clear trend in this dataset. We make no trend claim." |
| "Recommended rotation", "best crop", "you should sow" | "An option to discuss with your agronomist" |
| "Soil moisture in your field" | "Modelled soil wetness for the surrounding area" |
| "Worst in 26 years" | "Among the k lowest of N cropped-looking summers since 2000 (250 m pixels that include neighbours)" |
| Profit, income, margin | "Gross value index, prices of <month year>, costs not included" |
| "Wheat", "cereal" as the crop seen | "Curve shape typical of a cereal (inferred, not observed)" |
| "No frost" | "No damaging frost in the regional record; frost pockets are not visible" |
| "Fixes X kg of nitrogen" as a field fact | "Typical dryland range (judgement), needs inoculation and enough moisture" |
| A replayed alert shown as one that was sent | "Reconstruction from the satellite record up to this date" |
| z-scores or "sigma" from fewer than 10 seasons | "Lowest of N seasons" |

## 5. Glossary (plain language)

1. **NDVI (greenness index)**: a number from about 0.1 (bare soil) to 0.9 (dense green crop), worked out from red and near-infrared light. More green leaf, higher number.
2. **NDMI (canopy moisture index)**: a similar number that drops when leaves hold less water or the canopy is thin. It supports a dry-season reading; it does not measure soil water.
3. **Peak greenness**: the highest NDVI the field reached between 1 June and 20 August. The app compares it with the field's own usual peak.
4. **Baseline (the field's usual)**: the middle value of this same field in its other cropped years since 2018. Fallow years are left out.
5. **Fallow**: a year with no crop, the soil kept bare or under stubble to store water and control weeds. From space it looks like a failed crop, so the app asks you.
6. **Cloud-free share**: the part of the field a satellite saw clearly on a given day. Images with less than three quarters of the field clear are not used.
7. **Dekad**: a ten-day block. The season from 1 May to 30 September is cut into 15 of them so years can be compared.
8. **Grid cell (regional weather)**: the roughly 50 km square for which NASA POWER gives one weather value. Every field inside it gets the same rain and temperature.
9. **Hydrothermal coefficient (HTC, Selyaninov)**: rain divided by one tenth of the summed daily temperatures on warm days. Around 1 means enough moisture; below 0.6 is dry. Used by Kazhydromet.
10. **Carry-over**: what one season leaves for the next, either less soil water after a thirsty crop or herbicide residue that can injure the following crop. Satellites cannot see either.

## 6. What was verified, and limits

- Run today: score_demo.py and vegspec.py (self-checks pass); diagnose.py on fresh NASA POWER downloads for five cells (Kostanay city, the three preset cells, Karabalyk), reproducing the note's 10/13/0/7 flag counts; about 1,700 statistics calls building nine Sentinel-2 seasons for a 2.0 x 1.5 km rectangle at each preset block centre; STAC and capabilities checks for MODIS and GIBS.
- Limits: the rectangles are not field outlines, so labels will change once real boundaries are drawn. The modified vegetation thresholds were checked against printed ratios, not re-tuned. The stage recalibration assumes flowering near day 55; return intervals and zone-gate numbers come from general agronomy, not from a source opened today. There is still no ground truth anywhere in this design.
- Scratch work: scratch/review/science/code and scratch/review/science/dl. Six files dated 10:35-10:42 were already in the code folder from an earlier run; I did not use or change them. Nothing was written in the repository and no process is left running.

## 7. Order of work (about five to six hours)

1. Histogram median in the scene call, with NBR2 and snow share (45 min).
2. Truncate-before-build replay and the peak-coverage guard (30 min).
3. Deficit window and gate, NDMI as evidence, bare-soil window, delete the green-up watch, ambiguous prompt (60 min).
4. Stage table, three sowing dates, driest 40-day window, heat descriptor, HTC names (60 min).
5. Verdict wording, fixed caveat lines, never-say table in templates and checker (45 min).
6. Scoring: predecessor on every crop, local yields, sunflower out of the water card, tie rule, soil constraint, oats trial line, herbicide and return-interval lines (75 min).
7. Declared land use in the three preset files after drawing real outlines (30 min). Skip the MODIS baseline unless everything above is done.

## Live check: backend data path and preset fields

Proven live: one statistics POST per scene, httpx only, returns the clear fraction, snow fraction, NDVI median/p10/p90 and NDMI/NBR2 medians of clear pixels, by filling masked pixels with -9 and adding histogram_bins=400&histogram_range=-1,1; against exact pixels on 42 scenes the largest error was 0.0025. vegspec.py ran unchanged (thresholds untouched, numpy for the rules) on that output for three traced fields, 2018 to 2026. The endpoint's own median and percentile fields, the p parameter, nodata and NaN fills are all unusable for masked scenes. The reference field_series.py cannot feed the rules as written: it has no NBR2, p10, p90 or snow, and its clear-fraction formula (mean x valid_percent) is wrong for any polygon that is not a lat/lon rectangle. The demo story holds at Kostanay (2021 against 2024) and, at warning level in Sentinel-2 only, at North Kazakhstan (2021 against 2024); at Akmola 2023 is flagged severe but labelled "ambiguous", so it holds only with a declared land use. Not proven: field outlines are traced by eye on 10 m imagery, not cadastral; land-use labels are inferences with no ground truth; MODIS does not confirm the North Kazakhstan 2021 deficit; throttling from a Cloud Run IP and incremental refresh were not tested. A new field costs 42 to 49 s at 20 concurrent calls (27 to 35 s at 32 to 40), not 15 s, because all three blocks sit under two Sentinel-2 orbits.

## Part 1: the request that works (verified live)
```
POST https://planetarycomputer.microsoft.com/api/data/v1/item/statistics
 ?collection=sentinel-2-l2a&item={id}&asset_as_band=true&max_size=512
 &histogram_bins=400&histogram_range=-1,1
 &expression=where(C,1,0);where(C,(B08-B04)/(B08+B04{D}),-9);where(C,(B08-B11)/(B08+B11{D}),-9);where(C,(B11-B12)/(B11+B12{D}),-9);where(SCL==11,1,0)
C = (SCL==4)|(SCL==5)   D = "-2000" if float(s2:processing_baseline) >= 4 else ""   body = GeoJSON Feature
```
Reading it (`b0..b4 = list(statistics.values())`):
- `clear = b0.mean * b0.valid_pixels / N_poly`, `snow = b4.mean * b0.valid_pixels / N_poly`, with `N_poly = max(valid_pixels)` over the field's scenes.
- NDVI p10 / median / p90 = quantiles of `b1.histogram` (counts, edges), linear inside a bin. Sentinel pixels fall outside the range and drop out; `sum(counts)` equalled the clear-pixel count. NDMI and NBR2 medians come from `b2`, `b3` the same way.
- Response is 37.6 KB (3 KB before); server time 270 to 350 ms, unchanged.

Variants on one 75%-clear scene:
| Variant | Result |
| --- | --- |
| Response's own `median`, `percentile_N`, `p=10&p=50&p=90` | include the -9 pixels: p10 = -9, median 0.620 against true 0.646 |
| `nodata=-9` | HTTP 500 |
| `nodata=0` | no effect |
| NaN fill (`sqrt` of negative, x/x of zero, `arcsin`) | silently becomes 0, valid_percent stays 100 |
| inf fill | 1.8e308, mean null |
| explicit bin edges; `categorical=true` on `floor(100*NDVI)` | work |

No mask parameter exists in the OpenAPI.

Accuracy against exact pixels (`/item/feature.npy`), 42 accepted scenes of 2019, 2021, 2022, 2024 on the spike rectangle, max abs error: NDVI median 0.0023, p10 0.0025, p90 0.0016, NDMI 0.0015, NBR2 0.0009.

Median minus masked mean, same scenes: NDVI mean -0.005, 90th percentile 0.027, max 0.080 (2022-06-20: 0.204 against 0.283); NDMI max 0.031; NBR2 max 0.016.

Feeding vegspec means instead of medians changed 4 of 27 field-years. Worst: the North Kazakhstan 2020 fallow year became "ambiguous" with VEG_DEFICIT severe.

`valid_percent` is the polygon's share of its bounding box: 77.56 on fully covered scenes of the Kostanay trapezoid. The field_series.py formula accepted 150 scenes there; the corrected one 200.

## Parts 2 and 3: fields
Traced on July true-colour and NDVI of 2021, 2023, 2024 (2020 for North Kazakhstan), 30 to 40 m inside the edges. 17 candidates were screened. C = cropped, A = ambiguous, F = fallow. MODIS rank 1 = lowest.

**Kostanay, 414 ha, 53.774 N 62.696 E**
| 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| .75 C | .37 A | .78 C | .53 C | .60 C | .59 A | .85 C | .74 C | .65 C |
- 2021: VEG_DEFICIT warning (72% of median 0.75, integral 64%), WATER_STRESS severe.
- 2023: VEG_DEFICIT severe tagged "confirm land use", WATER_STRESS warning. The field is bare tilled soil on 13 July 2023.
- 2024: none.
- MODIS, 25 usable years: 2021 0.60 rank 7; 2023 0.57 rank 5; 2024 0.89 rank 25 (highest).
- **Holds: show 2021 against 2024.** 2022 rates worse than 2021 (severe, integral 49%). 2019 and 2023 need a declared fallow.

**Akmola, 333 ha, 51.722 N 70.742 E**
| 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| .63 C | .56 C | .58 C | .20 F | .58 C | .41 A | .65 C | .57 C | .54 C |
- 2021: BARE_SOIL info only.
- 2023: VEG_DEFICIT severe (72% of 0.58, integral 32%) tagged "confirm land use", BARE_SOIL warning.
- 2024: none.
- MODIS, 26 years: 2021 0.29 rank 1 (the fallow year); 2023 0.48 rank 6; 2024 0.69 rank 21.
- **Holds only with 2023 declared as crop: show 2023 against 2024.** All four candidates in this block peaked at 0.39 to 0.43 in mid-season 2023, under the 0.45 "green" threshold. The contrast is modest.

**North Kazakhstan, 449 ha, 53.895 N 69.581 E**
| 2018 | 2019 | 2020 | 2021 | 2022 | 2023 | 2024 | 2025 | 2026 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| .84 C | .72 C | .43 F | .54 C | .78 C | .68 C | .81 C | .58 C | .61 C |
- 2021: VEG_DEFICIT warning (75% of 0.72, integral 61%), WATER_STRESS warning.
- 2023: WATER_STRESS warning only.
- 2024: none.
- MODIS, 26 years: 2021 0.71 rank 10 (97% of median); 2023 0.75 rank 17; 2024 0.86 rank 26 (highest). The lowest year is 2020, the fallow year.
- **Holds in Sentinel-2 at warning level: show 2021 against 2024.** MODIS does not back 2021.

Replayed as of 31 July 2021, no deficit alert fires at Kostanay or North Kazakhstan; it appears from 11 August.

## Timing and throttling
| Field | S2 calls | S2 + MODIS at 20 concurrent | Higher concurrency |
| --- | --- | --- | --- |
| Kostanay | 553 | 32.1 + 9.7 = 41.8 s (rerun 44.9 s) | not run |
| Akmola | 548 | 31.7 + 10.2 = 41.9 s | 40: 21.0 + 5.7 = 26.7 s |
| North Kazakhstan | 556 | 31.6 + 17.1 = 48.7 s | 32: 23.6 + 11.6 = 35.2 s |

- Each field sits under two Sentinel-2 orbits of one tile: about 61 dates per season, not 31.
- North Kazakhstan MODIS made 523 calls; 255 went to a neighbouring tile that returns null.
- About 14,000 statistics calls in 34 minutes, peak 40 concurrent: zero 429, seven 502, all recovered on retry.

## Verified against inferred
- Verified: everything above.
- Inferred: 2019 and 2023 at Kostanay are weedy fallow (from imagery and curve shape); 200 bins would halve the payload at about 0.005 error; PATCHY may read slightly higher on 10 m pixels than the 20 m it was tuned on.

### Problems found

- The uncommitted backend/app/series.py feeds field MEANS and no p10/p90. Measured on the three presets, means flip the North Kazakhstan 2020 fallow year to 'ambiguous' with VEG_DEFICIT severe, and the PATCHY rule cannot run.
  - Fix: Change the fill from 0 to -9, add histogram_bins=400&histogram_range=-1,1, and add a 12-line histogram-quantile function (hist_quantiles in the scratch pc.py). Keep its existing px / max(px) coverage scaling.
- backend/app/constants.py MODIS_FALLOW_PEAK = 0.41 misses three of the four fallow or weedy-fallow years on the presets: MODIS peaks were 0.45 (North Kazakhstan 2020), 0.44 and 0.57 (Kostanay 2019, 2023); only Akmola 2021 at 0.29 is caught. The 'worst year on record' line would name a fallow year.
  - Fix: From 2018 on, exclude years by the Sentinel-2 label or the declared land use rather than a MODIS threshold; before 2018 say land use is unknown.
- backend/app/series.py keeps one MODIS item per date with setdefault. For North Kazakhstan the search returns two tiles per date and only h22v03 has data. Today the first id was h22v03 on all 263 dates, so it works by result order only.
  - Fix: Keep the item whose statistics are non-null, or probe one item per tile once and drop the empty tile; that also saves the 255 wasted calls.
- Akmola has no stressed year the rules call clear: 2023 is 'ambiguous' on all four candidates screened in that block (mid-season max 0.39 to 0.43 against the 0.45 threshold tuned at Kostanay).
  - Fix: Ship the Akmola preset with 2023 declared as crop and 2021 as fallow; the alert is then an untagged VEG_DEFICIT severe. Do not change the threshold this weekend.
- MODIS does not confirm the North Kazakhstan 2021 deficit: 97% of its median, rank 10 of 26, against 75% of median in Sentinel-2.
  - Fix: On that preset show the Sentinel-2 comparison and use MODIS only for '2024 is the highest peak since 2000'.
- At Kostanay, 2022 is rated worse than 2021 (severe through the integral clause, against warning), which can confuse a '2021 drought' narrative.
  - Fix: Tell the story on peak NDVI and water stress (2021: 0.53 and WATER_STRESS severe; 2024: 0.85 and silent), or accept that 2022 shows as a second stressed year.
- The dekad median lowers the peak in scene-rich years: North Kazakhstan 2021 has a best single scene of 0.598 but a dekad peak of 0.54. Sunny drought years have more scenes, so the deficit is slightly overstated. Observed once; the size of the bias is not measured.
  - Fix: Leave as is for the hackathon and mention it in the uncertainty note.
- Each response is 37.6 KB, so a new 550-scene field downloads about 21 MB.
  - Fix: Use histogram_bins=200 if bandwidth or memory on Cloud Run matters (about 0.005 quantile error, inferred, not measured).
- Field outlines were traced by eye on 10 m imagery with a 30 to 40 m inward buffer; they are not cadastral. The Akmola field has drainage gullies inside it and the Kostanay field a pond notch.
  - Fix: Open each polygon over the EOX basemap once before committing the presets.
- The best-looking Kostanay unit was left out because it is about 640 ha: 2021 cropped at 68% of median with VEG_DEFICIT severe and WATER_STRESS severe, 2019 and 2023 cleanly labelled fallow, 2024 at 0.84.
  - Fix: If the 500 ha guide can stretch, trace it (block centre 53.810 N 62.757 E; screening run in series_K2.json) and use it instead of the 414 ha field.

## Live check: frontend stack as one project

The section 6 setup works as one project: all four commands ran exactly as written with zero deviations (about 85 s on Node 23.11), and the result type-checks and builds. The section 7 button file is a clean drop-in, `check:press` passes, and the compiled CSS has 16 `:active` rules, none of which moves anything. The combined page (sidebar, mapcn map, both GIBS layers, EOX toggle, date slider, terra-draw, MapGeoJSON, dialog, sheet, toast) ran in headless Chromium at 1280x800 and 390x844, on both the production build and the dev server. It produced 0 console errors, 0 page errors, 0 failed or 4xx tile requests, the worker loaded from the bundle, and there were no unpkg or CARTO requests. The map resizes by itself when the sidebar collapses, and dialogs and sheets paint above the map with or without `isolate`. Putting the two halves together did surface real defects, each with a fix I verified: the README's compiled-CSS press check fails on MapLibre's stylesheet, the floating date bar hides the map attribution, overlays inside `<Map>` inherit Helvetica, the template `typecheck` script checks nothing, a later `shadcn add -y` stalls on the fixed button, and the reference draw hook saves a duplicate field on every edit. Not proven: a real phone or GPU, Safari and Firefox, a true touch drag on the slider (pointer events were emulated), and slow networks. The repo already has a `frontend/` scaffold (commits 0fe10a8, 36eb796) that I only read; three of these defects look still present there.

## Final command list (verified, fresh directory)
```bash
npx shadcn@4.23.0 init -t vite -b radix -p nova -n frontend --no-monorepo --no-rtl --pointer -y   # 63 s
rm -rf frontend/.git                      # nested repo confirmed ("feat: initial commit")
cd frontend
npx shadcn@4.23.0 add sidebar switch slider toggle toggle-group badge tabs chart card table sonner dialog alert-dialog sheet drawer skeleton command tooltip popover scroll-area separator collapsible select label input empty spinner alert -y   # 9 s, 31 files
npx shadcn@4.23.0 add @mapcn/map -y       # 6 s; adds maplibre-gl, @types/geojson, registry entry, index.css rules
npm i terra-draw@1.39.0 terra-draw-maplibre-gl-adapter@1.5.0 @turf/area@7.4.0   # 5 s
```
Deviations needed: none. The only noise is `EBADENGINE` warnings (eslint 10 wants `^20.19 || ^22.13 || >=24`; this machine has 23.11).

Then, all verified:
- Copy `docs/research/ui-design/button.tsx` over `src/components/ui/button.tsx`. It differs from the generated file only on lines 7, 11, 13, 15, 17 and 19.
- Copy `docs/research/map-stack/{worker.ts,RasterLayer.tsx,sources.ts,useFieldDraw.ts}` to `src/map/`, with `import "./map/worker"` as the first line of `main.tsx`. They type-check unchanged on TypeScript 6.0.3.
- `package.json` scripts:
```json
"typecheck": "tsc -b",
"build": "npm run check:press && tsc -b && vite build && npm run check:press:css",
"check:press": "! grep -rnE \"active:[^ \\\"']*(scale|translate|rotate|skew)\" src",
"check:press:css": "! sed 's/forced-colors:active//g' dist/assets/*.css | grep -oE \":active[^{}]*\\{[^}]*(translate|scale|rotate|transform)[^}]*\\}\""
```
- `index.css`, unlayered: `.maplibregl-map .maplibregl-ctrl-bottom-right { bottom: 3.75rem; }`
- Later component adds: `printf 'n\n' | npx shadcn@4.23.0 add <names> -y && npm run check:press`

## Versions installed
react and react-dom 19.3.1, vite 8.3.8, typescript 6.0.3, tailwindcss and @tailwindcss/vite 4.3.5, shadcn 4.23.0 (style `radix-nova`), radix-ui 1.8.1, maplibre-gl 6.18.0, terra-draw 1.39.0, terra-draw-maplibre-gl-adapter 1.5.0, @turf/area 7.4.0, recharts 3.8.0, sonner 2.0.8, vaul 1.1.2, cmdk 1.1.1, next-themes 0.4.6, lucide-react 1.73.0, @types/geojson 7946.0.16, eslint 10.15.0, eslint-plugin-react-hooks 7.1.1.

## Build and bundle
`npm run build` exits 0; `vite build` takes about 0.33 s.

| File | Raw | Gzip |
| --- | --- | --- |
| `index-*.js` | 1,632.95 kB | 455.95 kB |
| `maplibre-gl-worker-*.js` | 519.18 kB | 147 kB |
| `index-*.css` | 179.49 kB | 27.25 kB |
| Geist fonts (5 files) | 76 kB | n/a |

`dist/` totals 2.3 MB. Vite warns `INEFFECTIVE_DYNAMIC_IMPORT`: the static import in `worker.ts` defeats mapcn's lazy import, so everything is one chunk.

## Press check (section 7)
- `check:press`: exit 0 with the fixed button, exit 1 with the generated one.
- `check:press:css` as written in the README: exit 1 on this project. The two matches are MapLibre's `@media (forced-colors:active){a.maplibregl-ctrl-logo{…}}` blocks, whose SVG data URLs contain `transform=`.
- With the `sed` strip: exit 0 on the fixed button, exit 1 on the generated one (`:active:not([aria-haspopup]){--tw-translate-y:1px;translate:…}`).
- Independent scan of the compiled CSS: 16 rules with `:active` in the selector, 0 with transform, translate, scale or rotate. They are background colours, one ring, `transition-property:none` and MapLibre cursors.

## Browser results (Playwright 1.65.1, Chromium, SwiftShader; identical on `vite preview` and `vite dev`)
- **Load:** map loaded in 1.5 to 2.7 s on desktop and 0.4 to 0.7 s on the phone viewport.
- **Console:** 0 errors and 0 page errors. Desktop logged one repeated GL driver performance warning ("GPU stall due to ReadPixels"), which I take to be a software-rendering artefact; the phone viewport logged nothing.
- **Network:** 0 responses at 400 or above, 0 failed, 0 aborted. Desktop requests: OpenFreeMap 25, GIBS 68, EOX 40. Worker URL `localhost/assets/maplibre-gl-worker-*.js`; unpkg 0, cartocdn 0, also with a dark-mode OS.
- **Resize, no `map.resize()` call in the app:**

| State | Wrapper width | Canvas width |
| --- | --- | --- |
| Expanded | 1024 | 1024 |
| Collapsed, +100 ms | 1152 | 1109 |
| Collapsed, +300 ms | 1280 | 1280 |
| Re-expanded | 1024 | 1024 |
| After Ctrl+B | 1280 | 1280 |

- **Layers:** sources report `tileSize` 256 and `maxzoom` 9 (GIBS) or 14 (EOX). The rasters sit at style indexes 36 to 38, under the first label layer (39). Switch sets `visibility`; opacity slider sets `raster-opacity` (0.8 to 0.5 after six ArrowLeft presses).
- **Date slider:** while held, the label moved 2021-07-12 to 2021-08-13 with 0 GIBS requests and the source unchanged. On release there were 20 requests for the new date, settled in about 0.8 s, and the frame 60 ms after release was not blank.
- **Drawing:** a triangle at zoom 11 saved as "Field 1 (254 ha)" by mouse, and 254.5 ha by touch taps on the phone viewport. MapGeoJSON rendered the preset and the drawn field.
- **Stacking:** `elementFromPoint` at the draw button, zoom button and slider thumb returns `dialog-overlay` or `sheet-overlay`, with and without `isolate`. Below 768 px the sidebar opens as a sheet above the map and closes on an overlay tap.
- **390 px:** `scrollWidth` 390, no overflow. Header, toolbar (8 to 169 px) and zoom control (349 to 381 px) do not collide.

## What the screenshots show
- **1280x800:** sidebar with two switch-and-slider rows, the EOX switch and the field list; NDVI over positron with place labels on top; toolbar top-left, zoom top-right, date bar bottom-centre, attribution above it. The 2021-07-12 true-colour scene is about half cloud.
- **390x844:** full-screen map, same overlays. Expanded attribution is 2 lines, or 4 with EOX on (86 px), until the first drag collapses it.
- **Before the attribution fix:** the date bar covered the attribution completely on the phone and partly on desktop.

## Scratch
Everything is in `scratch/review/frontend-seam/run2/`. An earlier attempt had left a `frontend/` and a Playwright install in the parent folder; I worked in the fresh `run2/` and reused only its Playwright browsers. Both servers I started (4317, 4318) are stopped. The listener on 8081 and the chrome-headless processes belong to other projects and were left alone.

### Problems found

- The README's `check:press:css` fails (exit 1) on the combined project. maplibre-gl.css contains two `@media (forced-colors:active)` blocks whose SVG data URLs include `transform=`, so the grep reports a false positive on every build. The ui-design test had no MapLibre; the map-stack test never ran the check.
  - Fix: Use `! sed 's/forced-colors:active//g' dist/assets/*.css | grep -oE ":active[^{}]*\{[^}]*(translate|scale|rotate|transform)[^}]*\}"`. Verified: exit 0 with the fixed button, exit 1 with the generated one.
- The floating date bar hides MapLibre's attribution. At 390 px the expanded attribution box [10,788,380,834] sat entirely under the bar [8,790,382,836]; at 1280 px it was partly covered, and worse with the long EOX credit. OpenFreeMap, OSM and EOX require visible attribution. The repo's `frontend/src/App.tsx:74` puts the slider at `bottom-8`, which by my measurements still overlaps on a phone and with EOX on (inferred from reading, not run).
  - Fix: Add unlayered CSS in index.css: `.maplibregl-map .maplibregl-ctrl-bottom-right { bottom: 3.75rem; }`. Verified: no overlap at either width. Keep mapcn's MapControls out of its default bottom-right corner (I used top-right).
- Tailwind utilities cannot override MapLibre's stylesheet. maplibre-gl.css is unlayered and Tailwind 4 utilities live in a cascade layer, so adding `absolute` to `.maplibregl-map` left the computed position `relative`. A `className` on mapcn's `<Map>` cannot change position, overflow or font.
  - Fix: Size the map through its parent (`relative min-h-0 flex-1` wrapper, with the Map keeping `h-full w-full`). Override `.maplibregl-*` rules with plain CSS of higher specificity or with `!` utilities.
- Everything rendered as a child of mapcn `<Map>` inherits `.maplibregl-map { font: 12px/20px Helvetica Neue, Arial }`. The draw toolbar's computed font was Helvetica, not Geist; mapcn's own zoom buttons are too.
  - Fix: Put `font-sans` (and an explicit text size) on the root of every overlay inside `<Map>`. Verified: computed font becomes Geist Variable.
- The template's `npm run typecheck` is `tsc --noEmit` against a root tsconfig with `files: []`, so it checks nothing: it exits 0 with a planted `const x: number = "string"`. The repo's `frontend/package.json` still has it. An agent told to run type-check gets a false green.
  - Fix: Set `"typecheck": "tsc -b"`. Verified: it catches the planted error (TS2322).
- After the button fix, `npx shadcn@4.23.0 add <component> -y` is no longer non-interactive when the component depends on button. It stops at "The file button.tsx already exists. Would you like to overwrite? (y/N)" despite `-y`. In a non-TTY shell, `add accordion pagination -y` wrote accordion.tsx and died before pagination.tsx. The button survived.
  - Fix: Run `printf 'n\n' | npx shadcn@4.23.0 add <names> -y`, then `npm run check:press`. Verified: new files are created and button.tsx is skipped. `--dry-run` shows whether button would be overwritten.
- The reference `docs/research/map-stack/useFieldDraw.ts` saves a duplicate field on every edit. terra-draw fires `finish` for select-mode drags too; dragging one vertex added "Field 2 (330 ha)". The repo's own hook already handles finish differently, so this applies to anyone copying the prototype.
  - Fix: In the finish handler: `if (ctx.action !== 'draw') return`. Verified: the field count stays the same after a vertex drag.
- The 5,000 ha cap in the reference hook is a silent refusal. A 64,970 ha triangle at zoom 7 was not saved, but the drawing collapsed to a stray two-point line, the readout showed "0.0 ha" and the user got no message. The repo's hook still validates with `ValidateMaxAreaSquareMeters` inside the mode (line 42).
  - Fix: Keep only the self-intersection check in the mode's `validation`. Check area in the finish handler: if too big, `draw.removeFeatures([id])` and `toast.error(...)`. Verified: toast "Too large: 64970 ha (max 5,000 ha)", drawing removed, readout reset.
- Sonner's default toast position lands on the floating date bar: bottom-right on desktop covered the date label, and on the phone it covered the whole bar.
  - Fix: `<Toaster position="top-center" />`. Verified: toast box [462,23,818,76], clear of the bar. The repo already does this.
- The template ThemeProvider binds a bare `d` key to toggle dark mode. Pressing `d` flipped the chrome to dark while the fixed-light map stayed light. The default theme is also `system`.
  - Fix: Delete the keydown effect in `src/components/theme-provider.tsx` and use `<ThemeProvider defaultTheme="light">`. The repo already has both. With a dark-mode OS I verified html class `light` and 0 CARTO requests.
- `npm run lint` fails out of the box with 16 errors from eslint-plugin-react-hooks 7: 14 in mapcn's `map.tsx`, 1 in shadcn's `use-mobile.ts`, 1 in the reference `useFieldDraw.ts`. The page code itself is clean.
  - Fix: Do not put lint in the build or treat it as a gate this weekend. If wanted, add `src/components/ui/**` and `src/hooks/use-mobile.ts` to the eslint ignores.
- One 1.63 MB JS chunk (456 kB gzip) plus a 519 kB worker. The static `maplibre-gl` import in `worker.ts` defeats mapcn's lazy import (Vite warns `INEFFECTIVE_DYNAMIC_IMPORT`). If FastAPI serves `dist/` uncompressed, a phone downloads about 2.3 MB (inferred; the backend was not tested here).
  - Fix: Accept the single chunk for the hackathon and add `GZipMiddleware` to FastAPI. Do not spend time on code splitting.
- Below 768 px the shadcn sidebar is a sheet that is not in the DOM until opened (0 sidebar elements before the tap). Any layer or field state held inside sidebar components is lost on close.
  - Fix: Keep layer, date and field state above the sidebar (app state or URL) and render map layers from the `<Map>` tree. Verified: toggling EOX inside the phone sheet loaded 12 EOX tiles and persisted after closing.
- `sonner.tsx` as generated imports `useTheme` from next-themes, which has no provider in the Vite template. It works (toast rendered, no error), but on a dark OS the toaster reports theme `dark` while the app is light. The default toast still looked right (white background).
  - Fix: Already fixed in the repo (import from `@/components/theme-provider`, next-themes removed). Section 6 should carry the two steps from `docs/research/ui-design/README.md` section 1.
- Not tested: a real phone or GPU (WebGL2 through SwiftShader only), Safari and Firefox, a real touch drag on the Radix slider (pointer events were mouse-emulated at the phone viewport), slow or venue Wi-Fi, and the 12 px slider thumbs and 32 px controls under a finger.
  - Fix: Do the phone smoke test from the section 13 checklist as soon as phase 1 is deployed, not on Sunday night.

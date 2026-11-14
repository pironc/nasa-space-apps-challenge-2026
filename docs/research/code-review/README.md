# Review of the built app (14 Nov 2026, evening)

Four AI-assisted reviewers with different lenses. Each finding says whether it was reproduced.


## Backend correctness

The three preset files are numerically sound: every peak, usual peak, ratio, season total and severity in every verdict matches an independent recompute from the arrays, and a live re-run of the Kostanay polygon returned the preset byte for byte. No blocker, but I would not show the live "draw a field" path to judges as it stands. Fix first the Tayinsha 2021 sentence "The regional weather record does not explain the low greenness", which sits directly under numbers showing a hot, dry season on the opening view of that demo field. Then add a Kazakhstan bounding box: the API currently analyses the Sahara, Antarctica and the open ocean with confident spring-wheat wording, and the same hole lets a stranger fill the cache and hold both build slots. Third, show the API's own error text: a 0.4 ha drawn field currently tells the judge the service is unreachable. Kostanay 2021 and Akmola 2023 are the robust demo years; Tayinsha 2021 is the weak one.

### [major] Tayinsha 2021 (demo opening year): "The regional weather record does not explain the low greenness" contradicts the weather numbers on the same tab
- Where: backend/app/analyse.py:20 (NO_WEATHER_REASON) and :104-106; heat flag date in backend/app/climate.py:178-183; shipped in frontend/public/presets/nk-tayinsha.json, season 2021
- Reproduced: yes
- Evidence: Browser, Tayinsha, Climate tab 2021: rain 146 mm (76% of normal), hot days 33 against a normal of 17, hottest day 39.6 C on 3 Jul, "37% / 44% / 48% of the usual rain in the driest 40 days", then directly below: "The regional weather record does not explain the low greenness... This needs a field visit." The same sentence is quoted on the Strategies tab. Recomputed from the cached NASA POWER cell: 1 May to 31 Jul 2021 rain was 71% of normal (6th driest of 36) with 22 hot days against 11.9 (8th of 36). Related cause: a robust heat flag is dated when the full-season threshold count is reached (Kostanay 2021-08-20, Akmola 2023-07-29, Tayinsha 2023-08-09), always after a July peak, so "hot before the peak" never fires on real data; Akmola 2023 had 22 hot days by 10 Jul (2nd of 36) and the text says only "dry". Screenshots: (local path) and tay_Seasons.png
- Fix: Reword the first sentence at analyse.py:20 to say what was tested, e.g. "No unusually dry or hot spell was flagged in the regional weather record before this crop's peak." Update the two startswith asserts in backend/tests/selfcheck.py:211 and :321, then rebuild the presets (or replace the sentence in nk-tayinsha.json).

### [major] No geographic limit: any polygon on Earth gets a confident Kazakhstan spring-wheat analysis (the map zooms out to the world)
- Where: backend/app/analyse.py:66-72 (validate); POST /api/analyse
- Reproduced: yes
- Evidence: All returned 200 on port 8021. Argentina (-33.5 lat): May to September winter read as the season, 9 "drought" years. Egypt desert: "Bare through the summer: a fallow year... a choice, not crop stress" for all 9 years, rain "1698% of normal". Libya (Kufra): the text "nan% of the usual rain in the driest 40 days" appears 70 times. Svalbard and Antarctica: all 36 seasons "severe" drought with HTC 0.00, "night minimum fell to -49.9 C between stem elongation and flowering". Open Pacific: seasons holds only 2018 while climate runs 1991 to 2026; Antarctica stops at 2025 (year gaps). Responses saved as out_*.json in the scratch folder. A rainless synthetic cell raises ZeroDivisionError in climate.py:235/252; no real cell I tried reached it.
- Fix: In validate(), after canonical_ring: if not all(46 <= x <= 88 and 40 <= y <= 56 for x, y in ring): raise ValueError("Field Shift only covers Kazakhstan. Draw the field inside Kazakhstan.")

### [major] A stranger can hold both build slots and grow the cache without limit
- Where: backend/app/main.py:26 (declaredUse accepts any integer year), main.py:54-58, backend/app/constants.py:16 (MAX_BUILDS = 2); cache in DATA_DIR=/tmp/data, which is memory on Cloud Run
- Reproduced: yes
- Evidence: With two builds in flight a third polygon got 429 at once. The two in flight were the same polygon sent twice: both ran in full (25.9 s and 38.8 s) and held both slots. declaredUse {"1900":"crop"}, {"99999":"fallow"} and {"-5":"crop"} on one polygon each returned a new id and wrote a new cache file. An ocean polygon builds in 1 to 3 s and each new NASA POWER cell writes about 0.6 MB: my 15 test polygons left 8.2 MB. I did not run a sustained loop.
- Fix: 1) the bounding box above; 2) main.py after validate: reject declaredUse years outside 2018..this year with a 422; 3) constants.py:16 raise MAX_BUILDS to about 6 (the 40-call semaphore still caps upstream load).

### [major] The UI discards the API's error text: a 0.4 ha drawn field shows "the analysis service is not reachable" with a Retry that can never work
- Where: frontend/src/lib/data.ts:12 (throws status and URL only) and frontend/src/components/analysis-panel.tsx:137-143 (fixed text); frontend/src/map/useFieldDraw.ts checks only the 5,000 ha maximum
- Reproduced: yes
- Evidence: Browser: drew a 0.4 ha triangle and saved. Network: 422 {"detail":"The field covers 0.4 ha; it must be between 0.5 and 5,000 ha."}. Panel: "Live analysis is not available. Live analysis needs the analysis service, which is not reachable. The demo fields work without it." plus Retry. The same fixed text is the only branch for 429 (server busy) and 502 (satellite service down). Screenshot: (local path)
- Fix: data.ts:12: read the JSON body and throw new Error(detail) when detail is a string; keep the error in the failed state and show it in the EmptyDescription. Also block Save under 0.5 ha next to the existing tooLarge check in field-map.tsx:70.

### [major] No overall build timeout: if the Planetary Computer statistics service stalls, a request hangs for about 44 minutes and keeps a build slot
- Where: backend/app/main.py:58; per-call timeout 60 s x 3 tries in backend/app/series.py:51-61
- Reproduced: yes
- Evidence: Scaled run only, not at the real timeout: statistics URL pointed at a local socket that accepts and never answers, timeout cut to 0.25 s. Result: 553 scenes, 1,659 attempts, then the 502. At the real 60 s timeout with backoff that is 553/40 batches x 189 s, about 44 minutes. Normal builds took 17 to 78 s.
- Fix: main.py:58: result = await asyncio.wait_for(analyse(req.geometry, fid, declared_use=req.declaredUse), 150), and add TimeoutError to the except tuple on :59 so it returns the existing 502 text (import asyncio).

### [minor] Tayinsha 2021 warning is fragile: "Peak NDVI 0.54 (highest between 1 June and 20 August)" is a ten-day median, and MODIS on the same tab shows a normal year
- Where: backend/app/vegetation.py:74 (ten-day median) and :202 (detail wording); nk-tayinsha.json season 2021
- Reproduced: yes
- Evidence: Refetched the per-scene rows (they reproduce all three presets' ndvi arrays exactly). Tayinsha, fully clear passes: 26 Jul 2021 = 0.562, 31 Jul 2021 = 0.598. The 21 to 31 Jul bin is the median of 0.515, 0.458, 0.562, 0.598 = 0.538. Using the best clear pass in every year the ratio is 81% (watch) instead of 75% (warning). MODIS 2021 peak 0.714 against a median of 0.735; the tab reads "2021 was among the 10 lowest of 25 cropped-looking summers" under the warning.
- Fix: vegetation.py:202: say "highest ten-day median between 1 June and 20 August". For the demo, lead with Kostanay 2021 or Akmola 2023, where both readings agree (71% vs 70%, 72% vs 72%).

### [minor] "Tell us to complete the analysis" never completes for a drawn field
- Where: backend/app/vegetation.py:158 (the sentence); frontend/src/lib/data.ts:24-28 (request body carries geometry only); frontend/src/App.tsx:28-29
- Reproduced: yes
- Evidence: Browser: drew a 3.6 ha field next to the Kostanay preset; 2021 and 2025 came back LAND_USE_UNCLEAR (2 of 9 seasons; same count on a 1 ha field inside the preset). Chose "It was a crop": the label became "crop (declared)" and the text "the season findings are recalculated when the field is analysed again" appeared, but only one POST was ever sent and it had no declaredUse; no deficit finding appears.
- Fix: Smallest: drop "Tell us to complete the analysis." at vegetation.py:158. Proper: send the answers as declaredUse in data.ts:27 and key the page cache on field id plus answers; the backend already honours it.

### [minor] Drought label wording disagrees with the rank shown beside it
- Where: frontend/src/components/climate-tab.tsx:177; label from backend/app/climate.py:227,239 (percentiles of 1991-2020), rank from :228,238 (1991-2026)
- Reproduced: yes
- Evidence: Kostanay 2021 (demo year): drought "severe", so the tab says "lowest tenth of this area's seasons" next to "rank 4 of 36" (11%). Live polygon in Astana: 2022 is "drought" ("lowest fifth") at rank 10 of 36, and 10 of 36 seasons are marked drought. Labels are otherwise monotonic with rank in all three presets.
- Fix: climate-tab.tsx:177: "Its hydrothermal coefficient is at or below the 10th (20th) percentile of this area's 1991 to 2020 seasons."

### [minor] A 400-digit integer coordinate returns 500
- Where: backend/app/analyse.py:38
- Reproduced: yes
- Evidence: POST with a coordinate of 1 followed by 400 zeros: "500 Internal Server Error"; server log: OverflowError: int too large to convert to float. Every other malformed body I sent returned 422.
- Fix: except (TypeError, ValueError, OverflowError):

### [minor] Self-intersecting outline is accepted and its area is the difference of the two lobes
- Where: backend/app/analyse.py:45-49 (canonical_ring)
- Reproduced: yes
- Evidence: Bow-tie [[62.70,53.77],[62.72,53.78],[62.72,53.77],[62.70,53.79]] returned 200 with areaHa 73.2; the two lobes are 97.6 ha and 24.4 ha (122 ha). A symmetric bow-tie returns 422 "The outline has no area."
- Fix: Reject a ring where two non-adjacent edges cross ("The outline crosses itself."), or leave it if the draw tool cannot produce one.

### [minor] Non-field land inside Kazakhstan gets field wording: a city reads as fallow every year, open water as cloud
- Where: backend/app/vegetation.py:95-96 (fallow label) and :148-149 (INSUFFICIENT_DATA text)
- Reproduced: yes
- Evidence: Astana centre (187 ha): use "fallow" for all 9 years, no verdicts, profile.bare 1.0. Caspian Sea: all 9 years "Too few clear satellite passes... Only 0 of the season's 15 ten-day periods had a cloud-free view of the field". Forest (taiga) is handled sensibly: "early_green" for 9 years, each with "Not enough comparable seasons to judge this year", baseline null.
- Fix: vegetation.py:149: "...had a clear view of soil or vegetation (cloud, snow and water do not count)...". For the city case, a one-line note when no season since 2018 reads as cropped.

### Checked and working

- Verdict numbers: for all 27 preset seasons I recomputed, without app code, the windowed peak and its bin, the leave-one-out usual peak, the ratio, the season total and the severity; all match the verdict text. Demo years: Kostanay 2021 0.534/0.747 = 71.5% (text 72%), total 65.4%; Akmola 2023 0.415/0.578 = 71.8% (72%), total 37.2%; Tayinsha 2021 0.538/0.721 = 74.6% (75%), total 68.3%; the three 2024 seasons are 121%, 115% and 120% with no finding.
- Reproducibility: a live API run of the Kostanay polygon equals the preset exactly (seasons, baseline, climate, profile, field), and freshly fetched per-scene rows rebuild the ndvi arrays of all three presets exactly.
- Climate numbers: May to August rain, percent of normal, hot days, HTC, HTC rank and drought label recomputed independently from the cached NASA POWER cells for all 36 seasons of all three cells; all match.
- Internal consistency in the presets: no deficit in a declared-fallow year; every explanation naming dry weather has a robust water flag dated on or before the peak bin (Kostanay 2021: 8 Jul vs 20 Jul; Akmola 2023: 8 Jul vs 10 Jul); "hot this season" lines have a robust heat flag and a ratio above 90%; baseline years equal the cropped or declared-crop years; profile.bare is 2/9, 1/9, 1/9.
- Hot-day counts: the three presets sit in three different cells, so differing counts are legitimate; within a field the two counts are labelled with different windows (May to August vs 90 days after sowing).
- Edge cases returning 422 with a plain message: under 0.5 ha, over 5,000 ha, antimeridian crossing (reported as 2,684,315 ha), longitude 180.01, latitude 86, symmetric bow-tie, 3 points, 201 vertices, Point, MultiPolygon, Feature wrapper, hole, string/null/dict/nested coordinates, NaN and 1e999 literals.
- Non-JSON, empty, array and null bodies and a bad declaredUse return 422 with FastAPI's list-shaped detail, never a 500; GET /api/analyse and unknown /api paths return 404 JSON.
- Wrong winding order and an unclosed ring are accepted and normalised.
- Cache: reversed order, rotated start point, unclosed ring, duplicated vertex, a third coordinate, 2e-7 jitter and swapped declaredUse key order all returned the same id and generatedAt in 0.0 s; raising RULES changes the key.
- Two simultaneous first builds of one polygon: both 200, identical seasons, the file on disk parses, no .tmp left (single worker, synchronous write then os.replace).
- During builds /api/health and cached fields answer in 0.00 s; a 1 ha field inside the Kostanay preset builds in 17 s and gives a coherent result.
- No NaN or Infinity in the three presets or in 13 live responses under a strict parser; selfcheck's check_shape passes on all of them; no null where the contract says number; climate years 1991 to 2026 are contiguous everywhere and vegetation years 2018 to 2026 are contiguous for every land polygon.
- uv run python tests/selfcheck.py: all seven checks pass.
- Server on port 8021 and the test socket on 8027 are stopped; git status is clean; all scratch files are under (local path)

## Browser walkthrough (desktop and phone)

Safe to show judges on a desktop: across 1440x900, 1280x720 and a 390x844 touch phone I got no crash, no console error and no failed request (only cancelled map tiles), and the live analysis of a drawn field finished in 42 s. It undersells itself in the first minute, though, and nothing here is a blocker. Fix first: (1) only two of the three strategies fit on screen at both desktop sizes, and (2) on the opening field the Save water and Build soil sliders change nothing. Next: Rain, Soil moisture and True colour draw underneath NDVI, so their switches look dead; and the first card says water stress is "low" on the 2021 drought demo. The three under-30-minute changes that most help a first-time viewer: (a) move the "Side by side" table above the cards so all three options show at once; (b) add one line above "What matters to you" stating the season finding, e.g. "2021: peak greenness well below this field's normal (warning). Three rotation options below."; (c) put "Demo fields" above "Map layers" in the sidebar and draw NDVI at the bottom of the layer stack. Avoid window widths between 768 and about 1000 px for the demo, and on a phone the selected field sits hidden under the drawer.

### [major] Only two of the three strategies are visible; the third card and the comparison table are far below the fold
- Where: frontend/src/components/strategies-tab.tsx:160-203 (card grid minmax(17rem,1fr), then the table); first load at 1440x900 and 1280x720
- Reproduced: yes
- Evidence: At 1280x720 card tops are y=551, 551, 2454: the judge sees the headers of two cards. At 1440x900 the panel is 764 px wide, two cards across, and "Soil-restoring shift" starts about 1,450 px down; the panel scrolls 3,722 px. Collapsing the sidebar at 1440 gives three across. Shots: d02-first-5s.png, e01-first-1280.png, d04-strategies-scroll2.png, i05-sidebar-collapsed-1440.png.
- Fix: Move the "Side by side" section (lines 170-203) above the cards section (160-168), so all three options and their five levels show on the first screen. Optional: change minmax(17rem,1fr) to minmax(14.5rem,1fr) at line 163 for three across at 1440.

### [major] "Save water" and "Build soil" sliders change nothing on the opening demo field
- Where: frontend/src/lib/rotation.ts:467-470 (priorityLine) and the ranking above it; Strategies tab, Fyodorov north (default) and Tayinsha with "Fallow, wheat, wheat, barley"
- Reproduced: yes
- Evidence: Mouse-dragged each slider to 0 and 1, and swept with Home/End on all three demo fields and both rotations. On Fyodorov/fwwb and Tayinsha/fwwb, water and soil at either extreme leave all three rotations and all 15 bars identical. The only change is an extra bullet in cards 2 and 3: "You gave water a high priority, which shifted the weights behind this option." Only Market and output at low swaps barley for lentil. The soil card never changes with any priority on any field under recorded conditions. The drier dial works (millet/flax, lower bars). Shots: d10-priority-water-1.png, d10-priority-soil-1.png.
- Fix: Smallest honest fix, in strategies-tab.tsx under the three dials: also compute compareStrategies with DEFAULT_PRIORITIES and show one line, "Same three options as with medium priorities" or "Changed: <card title>". Reword rotation.ts:470 so it does not claim the weights "shifted" this option when it is identical. For the demo, use "Market and output" set low and the "Drier and hotter" dial, which do respond.

### [major] Rain, Soil moisture and True colour draw under the NDVI layer, so switching them on looks like nothing happened
- Where: frontend/src/lib/layers.ts:32-102 (array order is draw order; ndvi is last, so on top at 0.85 opacity); sidebar layer switches
- Reproduced: yes
- Evidence: Pixel difference of the map before and after each switch, NDVI at its default: Rain 0.00/255 at field zoom (5.7 zoomed out), Soil moisture 14, True colour 13; the map still reads as the same green NDVI picture. With NDVI off the same layers show clearly. All tiles returned 200. Shots: g01-default-ndvi-plus-truecolor.png, g02-zoomed-out-soil.png against g03-ndvi-off-rain.png.
- Fix: Move the ndvi entry (layers.ts:88-101) to the front of LAYERS so anything switched on draws above it, and keep the sidebar order with app-sidebar.tsx:39 `const PANEL_ORDER = [LAYERS[0], ...LAYERS.slice(1).reverse()]`.

### [major] Demo fields and My fields are hidden below the sidebar fold, with no scrollbar
- Where: frontend/src/components/app-sidebar.tsx:78-152 (Map layers group first, then Demo fields at 128-133); 1280x720 and 1440x900
- Reproduced: yes
- Evidence: At 1280x720 the sidebar ends mid-way through "Satellite mosaic"; the "Demo fields" heading is not on screen at all. At 1440x900 the third demo field (Tayinsha) is cut in half and My fields is invisible. Sidebar content is 930 px in a 716 px box with scrollbar-width: none; with every layer on it is 1,463 px. Shots: e01-first-1280.png, d02-first-5s.png, f04-all-layers-on-top.png.
- Fix: Move the Demo fields group (lines 128-133) and My fields above the Map layers group.

### [major] First card says water stress here is "low", on the drought demo and against the app's own Climate tab
- Where: frontend/src/lib/rotation.ts:354 and 472 (stressLine); source value backend/app/climate.py:252; first "Why" bullet of every card
- Reproduced: yes
- Evidence: Fyodorov north shows "Water stress in this location's weather record is low and heat stress is moderate." The same field's Climate tab shows normal HTC 0.81 ("Around 1 is enough moisture"), "Dry seasons are normal here", and 2021 as a severe drought at 45% of normal rain. profile.water = 0.18 is the mean May-August shortfall against the cell's own normal, so it reads "low" almost anywhere regardless of aridity. An agronomist will call this wrong for the Kostanay steppe.
- Fix: Reword rotation.ts:472 to say what the number measures, e.g. "Against this location's own normal, rain shortfalls are {small|moderate|large} in a typical year and heat is {…}; a normal year here is already short of moisture (hydrothermal coefficient {normals.htc})."

### [major] Climate tab says "Nothing stood out" for 2024, the wettest season of 36
- Where: frontend/src/components/climate-tab.tsx:199-201; Fyodorov north, Climate tab, season 2024 (the demo's comparison year)
- Reproduced: yes
- Evidence: Table for 2024: rain 358 mm, 183% of normal; HTC 1.76 "wet"; rank 36 of 36 (1 = driest). Directly under it: "Nothing stood out in the regional weather record of 2024." The preset has causes: [] for that season. Text saved in text-kostanay-climate-2024.txt, shot e09-climate-2024.png.
- Fix: Before the fallback at line 199 add: if season.htcRank === season.htcRankOf (or rainMayAugPct >= 150) show "Wettest season of the record: {rainMayAugPct}% of normal May to August rain." Otherwise reword the fallback to "No dry-spell, heat, frost or harvest-rain flag in {year}."

### [major] The first screen never states the finding; it opens on sliders
- Where: frontend/src/components/strategies-tab.tsx:134 (top of the tab); first load at any size
- Reproduced: yes
- Evidence: In the first five seconds a judge sees a blurred green map at field zoom, three priority sliders and two card headers. The story (2021 peak NDVI 0.53, 72% of usual, severe regional drought) only appears inside "What this rests on" bullets below the fold or on the other tabs. The only description of the app is the 12 px sidebar line. Shots: d02-first-5s.png, e01-first-1280.png, p02-first-5s.png.
- Fix: Pass `year` into StrategiesTab (analysis-panel.tsx:170) and render one line above "What matters to you" from analysis.seasons for that year: "{year}: {verdict.title} ({severity}). Three rotation options below."

### [major] Layout breaks between 768 and about 1000 px wide
- Where: frontend/src/App.tsx:101 and 118 (sidebar 256 px + panel 352 px leave the map 160-290 px); tablet or half-screen window
- Reproduced: yes
- Evidence: Resized with Strategies open. Map width: 292 px at 900, 192 px at 800, 160 px at 768. At 800 the time slider's label wraps one word per line ("16- / day / period / to / 27 / Jul / 2021"), "Draw field" overlaps the zoom buttons, and the attribution wraps over four lines. At 767 it switches cleanly to the phone layout; back at 1440 everything returns. Shot: i03-resize-800.png.
- Fix: Start with the sidebar closed on narrow desktops: App.tsx:101 `<SidebarProvider defaultOpen={window.innerWidth >= 1100}>`.

### [major] Phone: the selected field is hidden under the drawer, and drawing with the drawer open is not workable
- Where: frontend/src/components/field-map.tsx:56 (fitBounds padding 96 ignores the drawer) and :85-88 (draw start); frontend/src/App.tsx:139 (max-h-[80dvh]); 390x844
- Reproduced: yes
- Evidence: First load on the phone: drawer covers y=169 to 844; the visible map strip shows no outline because the field is centred behind the drawer. Tapping "Draw field" with the drawer open leaves an 83 px strip (y 86-169). The hint grows to four lines once the area appears and covered my first corner, so the closing tap never registered (still "376 ha | Cancel", no form). With the drawer closed, drawing, saving, live analysis, delete and undo all worked by touch. Shots: p02-first-5s.png, q02-draw-closed-drawer-open.png, r03-phone-form.png.
- Fix: field-map.tsx:56: on mobile use padding {top: 60, bottom: Math.round(innerHeight * 0.8), left: 24, right: 24}. For drawing: have the Draw button deselect the field on mobile (call onSelect(null) next to draw.start() at :86) so the drawer closes.

### [major] The tab strip jumps away from the pointer when a tab is pressed
- Where: frontend/src/components/analysis-panel.tsx:153 (TabsList) with frontend/src/App.tsx:98 and 131 (panel 56rem on Strategies, 22rem otherwise)
- Reproduced: yes
- Evidence: At 1440: on Strategies the tabs sit at x=696-1042, y=154. After clicking Seasons they are at x=1108-1421, y=236 and the pointer is over the map canvas. At 1280 the pressed tab moved from x=884 to 1052. The change happens on mouse-down. No other control moved or scaled when pressed (buttons, switch, sliders, season chips, sidebar rows, selects, zoom: identical box and transform before and during press).
- Fix: Keep the tabs in one screen position: analysis-panel.tsx:153 `className="w-full @2xl:ml-auto @2xl:w-80"`, which right-aligns the strip in the wide panel at the same width it has in the narrow one. The row offset also needs matching, or keep the header layout the same in both widths.

### [minor] Choosing another demo field keeps the previous year, so Shortandy west opens on its fallow year
- Where: frontend/src/App.tsx:110 and 121 (onSelect={setSelectedId}); click "Shortandy west" after first load
- Reproduced: yes
- Evidence: URL after clicking the second and third demo fields stays date=2021-07-12. Shortandy west's demo years are [2023, 2024], but Seasons opens on 2021 "Fallow, declared" with a flat line; its drought story needs a click on 2023. Shot: d06-field1-seasons.png.
- Fix: In the select handler, when the field is a preset also call setDate(snapDate(midJuly(preset.demoYears[0]))), as lines 40-42 already do for the first field.

### [minor] "Compare with" goes blank when the selected season equals the comparison year
- Where: frontend/src/components/seasons-tab.tsx:229-243; Fyodorov north, Seasons, click the 2024 chip
- Reproduced: yes
- Evidence: Default comparison is 2024. Clicking the 2024 chip leaves the select empty and drops the comparison line, because the selected year is filtered out of the options while the value stays 2024. Shot: e04-compare-same-year.png.
- Fix: Line 229: `value={String(compare === year ? "none" : compare ?? "none")}`.

### [minor] Answering "crop or fallow?" only relabels the chip; the promised recalculation never happens
- Where: frontend/src/components/seasons-tab.tsx:110-114 and frontend/src/lib/data.ts:27 (POST body sends geometry only); drawn field, Seasons, a "Your input" year
- Reproduced: yes
- Evidence: On the drawn field, 2021 was "Unclear, inferred / Your input". Clicking "It was fallow" changed three labels and showed "the season findings are recalculated when the field is analysed again". No request followed, Strategies text was unchanged, and after a reload the chip was back to "Your input". Shots: i01-question.png, i02-answered-fallow.png.
- Fix: Cheapest: change the text at seasons-tab.tsx:112 to "Noted for this visit only. It does not change the findings or the rotation cards yet." Proper fix: send declaredUse in data.ts:27, which the API already accepts.

### [minor] Every API failure reads "service is not reachable"; a field under 0.5 ha can be saved and then fails forever
- Where: frontend/src/lib/data.ts:9-14 (json() drops the response body); frontend/src/components/analysis-panel.tsx:138-143; frontend/src/components/field-map.tsx:108 (no minimum size)
- Reproduced: yes
- Evidence: Mocked 429 ("The server is already building other fields. Please try again in a minute.") and 422 ("The field covers 0.1 ha; it must be between 0.5 and 5,000 ha."). Both show "Live analysis needs the analysis service, which is not reachable." Retry on the 422 loops to the same screen. The real API returns exactly these details (curl-tested), and MAX_BUILDS is 2, so a third simultaneous drawer gets the 429. Shots: s01-api-429.png, s02-api-422.png.
- Fix: In json(), on !r.ok read `(await r.json()).detail` and throw it; keep the message in the failed state and show it in EmptyDescription. Disable "Save field" under 0.5 ha, as is already done over 5,000 ha.

### [minor] Back button leaves the app; an unknown ?field= gives a silent empty state
- Where: frontend/src/App.tsx:54 (replaceState only) and :40 (no fallback when the id is unknown)
- Reproduced: yes
- Evidence: history.length stays 2 after selecting fields, tabs and years; goBack landed on about:blank. /?field=does-not-exist shows "Select a field" with the URL unchanged and no message. A link to a drawn field can never open for anyone else, since fields live in localStorage. Shot: h18-bad-field.png.
- Fix: App.tsx:40: also fall back to list[0] when query.get("field") matches neither a preset nor a saved field, and toast "That field is saved only in the browser that drew it." Back: pushState when selectedId changes plus a popstate listener, or leave as is and avoid Back in the demo.

### [minor] Bars for 1991-2000 (rain) and 2000 (MODIS) look clickable but do nothing
- Where: frontend/src/components/climate-tab.tsx:222 and 252; frontend/src/components/seasons-tab.tsx:319 and 348 (FIRST_YEAR guard with cursor-pointer on every bar)
- Reproduced: yes
- Evidence: Rain chart: a click at 10% of its width left the URL and heading on 2006; clicks at 45%, 80% and 97% switched to 2005, 2019 and 2026. MODIS chart: the first bar (2000) did nothing; a 2006 bar switched the year. After a click the chart also shifts 28-50 px vertically because the table above changes height.
- Fix: Give cursor-pointer only to bars with year >= FIRST_YEAR via the Cell className, or say "Click a bar from 2001 on to open that season" in the subtitle.

### [minor] A long field name without spaces runs off the panel
- Where: frontend/src/components/analysis-panel.tsx:101
- Reproduced: yes
- Evidence: A 40-character name of W's (the input's maxLength) runs past the right edge of the 352 px panel and is cut by the window. A Cyrillic name with spaces wrapped correctly. Shot: s04-long-name.png.
- Fix: Add `break-words` (or `[overflow-wrap:anywhere]`) to the h2 className.

### [minor] Map does not refit when the panel widens, cutting the field off
- Where: frontend/src/components/field-map.tsx:52-59 (FitToField refits only on selection change)
- Reproduced: yes
- Evidence: Field selected on Seasons (map 832 px wide), then Strategies (map 420 px): the 446 ha field no longer fits and only its top and bottom edges are visible. Shot: h11-drawn-strategies.png.
- Fix: Refit on the map's `resize` event as well, or add the panel's wide flag to the effect's dependencies.

### [minor] Colour alone separates the selected and comparison seasons in the NDVI chart, and marks the selected bar in the rain chart
- Where: frontend/src/components/seasons-tab.tsx:278-279 and 283-284; frontend/src/components/climate-tab.tsx:254
- Reproduced: yes
- Evidence: 2021 (blue) and 2024 (orange) are both solid 2 px lines with identical dots; the legend maps colour to year. In the rain chart the selected year is only a blue bar among grey ones. Status icons, drought triangles, fallow hatching and the indicator bars all carry a shape or a word as well. Shot: d06-field0-seasons.png.
- Fix: seasons-tab.tsx:278: add strokeDasharray="4 3" to the comparison Line and a dashed swatch in its legend entry. Rain chart: add the same ReferenceArea band the MODIS chart uses (seasons-tab.tsx:329).

### [minor] Public URL: Swagger UI is served and the request body size is unbounded
- Where: backend/app/main.py:20 and :40
- Reproduced: yes
- Evidence: /docs, /redoc and /openapi.json return 200. A 3 MB POST with a junk extra key was accepted and a full analysis ran (200 after 18 s). Geometry validation is sound: point, hole, 0.0 ha, 737,097 ha, non-numeric coordinates, bad JSON and bad declaredUse all return 422 in 2 ms. Path traversal attempts return index.html. Field names with HTML render as text in the panel and the toast (no script ran).
- Fix: main.py:20: `FastAPI(title="Field Shift API", docs_url=None, redoc_url=None, openapi_url=None)`. Reject bodies over about 50 KB at the top of analyse_field (check the Content-Length header).

### [minor] "Evidence: Crops trialled locally, rotation not" reads as cut off
- Where: frontend/src/lib/rotation.ts:266; second strategy card header
- Reproduced: yes
- Evidence: I took it for clipped text on first sight and checked the DOM: it is the full string. Shot: d02-first-5s.png.
- Fix: Change the string to "Each crop trialled locally; this sequence is not".

### Checked and working

- Setup: frontend/dist matches HEAD (the one newer source file is types only), so no rebuild. Backend ran on 8022 with DATA_DIR in the scratch folder and is stopped; servers on 8023, 8026 and 8029 belong to others and were left alone; git status clean. Screenshots: (local path)
- First load at 1440x900, 1280x720 and 390x844: no console error, no page error, no failed request other than tiles cancelled while the map moves; every GIBS and EOX tile returned 200
- All three demo fields load and all three tabs render on each; no text overflows its box at either desktop size or on the phone
- "Drier and hotter" dial and the "Market and output" slider change the cards and bars and say why; returning the dials to default restores the original cards exactly; arrow keys work on sliders
- Changing the declared rotation updates card 1; "Other or not sure" is stated as an assumption on the card
- Season chips: each of the nine sets the map date, the URL and the findings; wording per season is consistent with the preset data
- Comparison year select (None and other years), NDVI chart tooltip, MODIS and rain bar clicks from 2001 on; a pre-2018 year shows a clear placeholder in the Sentinel-2 section
- Numbers agree across tabs: 43 hot days, 45% rain and rank 4 of 36 for Kostanay 2021 match between the strategy card, the Climate table and the preset file
- About the data: opens, scrolls, closes with Escape and X; the credit date and mosaic year fill in
- Opacity sliders work for all five layers; Satellite mosaic and NDVI-off states render; the soil layer shows "No data before 2016" for 2001
- Time slider: label follows the drag, tiles load on release, play steps every 2.5 s, pause holds, wraps at year end, year select covers 2001-2026, short 2026 ends at 16 Oct
- Draw on desktop: corners placed over a demo field do not steal the selection; close, name (40-character cap, Cyrillic fine), rotation, save; live analysis ready in 42 s; all three tabs render on the drawn field
- Reload mid-analysis restarts and completes; reload restores field, date and tab from the URL; the saved field's rotation persists
- Delete then Undo restores the field (it is not re-selected)
- Bad date, bad tab, year 1999, year 2031 and a deep path all fall back sensibly
- Phone: sidebar sheet opens and closes, field selection from the sheet closes it, drawer content scrolls, sliders drag by touch without moving the drawer, closing the drawer frees the time slider (play, drag and year select work), tapping the outline reselects, About opens over the sheet, delete and Undo work by touch

## Public-URL exposure

Safe to show judges for the demo fields, but not yet safe to leave on a public URL for weeks: one curl request kills the instance, and two requests lock every visitor out of new-field analysis for a long time. Fix first the request size cap (5 lines), then the outline span check plus a 150 s build time limit (4 lines); together they remove every single-request abuse I found. Next, show the server's own message in the panel, because a third judge drawing a field while two builds run is told the service "is not reachable" when it is only busy. The per-client limit and cache pruning are worth 10 more minutes; without them a deliberate two-connection loop can still starve other visitors and send the Planetary Computer a steady 40 concurrent calls. All backend mitigations were run on a patched copy against a fake upstream ((local path)); the frontend fix and anything specific to Cloud Run were not tested. Real upstream use was four light catalogue searches and no full analysis.

### [major] One oversized request kills the instance (no body size limit, validation errors echo the input)
- Where: backend/app/main.py:20 (no size check before the body is parsed) and main.py:24-26 (geometry: dict, declaredUse: dict accept any size)
- Reproduced: yes
- Evidence: Built the image from the Dockerfile and ran it with a 1 GiB limit (the planned --memory 1Gi): one 16 MB POST to /api/analyse with 1,000,000 invalid declaredUse entries -> container exited, OOMKilled=true, exit 137. Outside a container the same request peaked at 3.9 GB RSS, blocked the single event loop for 28 s and returned a 325 MB error body. A 3 MB body returned 64 MB and blocked 4.3 s. A 30 MB list of points peaked at 652 MB per request, 2.4 GB for three at once. No upstream call is involved, so MAX_BUILDS does not help.
- Fix: Add after main.py:20 (tested on the patched copy: 16 MB, 30 MB and chunked bodies all answer 413 in 1 ms):
@app.middleware("http")
async def small_bodies(request, call_next):
    if request.method == "POST" and not 0 < int(request.headers.get("content-length") or 0) <= 50_000:
        return JSONResponse({"detail": "The request is too large."}, 413)
    return await call_next(request)
After deploying, draw one field in the browser to confirm Cloud Run forwards Content-Length (not testable locally).

### [major] Area limit is bypassed by long thin outlines: one request triggers tens of thousands of upstream calls
- Where: backend/app/analyse.py:66-72 (validate checks hectares only); backend/app/series.py:64-76 and :126 (search pages and scene list have no cap)
- Reproduced: yes
- Evidence: validate() accepts a 2 m wide strip from 50E,45N to 85E,54N (562 ha), a 1 m strip around the world at 53N (2,685 ha) and a pole-to-pole sliver (2,829 ha). One real catalogue search for July 2024 only: the normal demo-size field matches 12 scenes in 1 tile, the strip matches 621 scenes in 46 tiles, so about 28,000 statistics calls for the full record against about 550. On the fake upstream a 28,000-scene build ran to completion (132 s with instant answers, 182 MB RSS). Two strip requests whose clients hung up after 5 s kept both build slots: a new field got 429 at 10, 30, 60 and 90 s while upstream calls continued at 40 per second.
- Fix: In analyse.py validate(), before the hectares check at line 70 (tested: both strips answer 422, a 4,900 ha square is still accepted):
xs, ys = zip(*ring)
if max(xs) - min(xs) > 0.5 or max(ys) - min(ys) > 0.3:
    raise ValueError("The outline spans more than about 30 km. Outline a single field.")

### [major] No time limit on a build, and a build outlives its client: a slow upstream holds a slot for up to 44 minutes
- Where: backend/app/main.py:58-59; backend/app/series.py:51-61 (3 tries of 60 s plus 9 s of sleeps, all inside the semaphore at :81)
- Reproduced: yes
- Evidence: Fake upstream where every statistics call hangs 70 s, 80 scenes: the request returned the 502 message only after 378 s (189 s per wave of 40 calls). A normal 550-scene field is 14 waves, about 44 minutes, far past Cloud Run's 300 s default and the planned 600 s. Cloud Run then answers with its own 504 page, the panel shows the 'not reachable' text, and Retry gets 429 because the abandoned build still holds its slot (builds were shown to continue after the client disconnects).
- Fix: main.py:58: result = await asyncio.wait_for(analyse(req.geometry, fid, declared_use=req.declaredUse), 150)
main.py:59: except (UpstreamError, httpx.HTTPError, asyncio.TimeoutError) as e:
plus import asyncio. Tested: with the hanging upstream the request answers 502 'A satellite or climate data service did not answer. Please try again in a minute.' at 150.0 s, no further upstream calls follow and the slot is free at once. This also caps any one request at roughly 3,000 upstream calls.

### [major] Every failure of a drawn field shows 'the analysis service is not reachable', hiding the server's real message
- Where: frontend/src/lib/data.ts:12 (throws status and URL, drops the body) and :36, :48, :59-66; frontend/src/components/analysis-panel.tsx:138-142
- Reproduced: yes
- Evidence: Headless browser on the built frontend with a saved drawn field. With both build slots busy the API answered 429 'The server is already building other fields. Please try again in a minute.' and the panel showed 'Live analysis is not available. Live analysis needs the analysis service, which is not reachable. The demo fields work without it.' A 0.3 ha field (the draw tool has no minimum, only MAX_HA) answered 422 'The field covers 0.3 ha; it must be between 0.5 and 5,000 ha.' and showed the same text. With MAX_BUILDS = 2 and 20 to 45 s builds, a third judge drawing a field at the same time sees this. Screenshot: (local path)
- Fix: data.ts:12: on failure read the body and throw its text: const detail = await r.json().then((b) => b.detail, () => null); throw new Error(typeof detail === "string" ? detail : ""). Keep the message in the failed state (store { id, message } instead of failedId, add message to the 'failed' variant) and in analysis-panel.tsx:141 render state.message || the current sentence. About 8 lines; not built or tested by me.

### [major] No per-visitor limit and a trivially defeated cache: a two-connection loop starves everyone and sends upstream a constant 40 concurrent calls
- Where: backend/app/main.py:47 and :54-56 (global counter only); backend/app/analyse.py:54-56 (cache key includes any declaredUse key)
- Reproduced: yes
- Evidence: A 1 m shift (5th decimal) or a junk key such as declaredUse {"1234567":"crop"} each caused a full rebuild (550 statistics calls each on the fake upstream); a shift at the 6th decimal was served from cache. Two looping clients with shifted polygons held both slots for six builds in a row; a third visitor trying a new field every 8 s got 429 five times out of five. Upstream saw 3,300 calls at a steady 40 in flight; at real latencies that is on the order of one to two million statistics calls a day from one instance, which invites throttling of the instance's address and would break live analysis for all visitors. The demo fields are static files and keep working.
- Fix: In analyse_field (add request: Request to the signature), just before _building += 1 at main.py:56:
who = (request.headers.get("x-forwarded-for") or request.client.host).split(",")[-1].strip()
mine = _recent[who] = [t for t in _recent.get(who, []) if t > time.time() - 3600]
if len(mine) >= 10:
    raise HTTPException(429, "This connection has analysed many new fields in the last hour. Please try again later.")
mine.append(time.time())
with _recent = {} at module level, and reject len(req.declaredUse) > 30. Tested locally with a forged header: builds 11 and 12 got 429, cached fields and another client still got 200, a spoofed first entry did not help. That Cloud Run puts the real client address last in X-Forwarded-For is my assumption; check once after deploy. Acceptable to skip if time is short: it needs someone deliberately targeting the URL and the instance stays up.

### [minor] Cache directory grows without limit, and on Cloud Run that directory is memory
- Where: backend/app/climate.py:40-56 (one file of about 0.63 MB per weather cell, never deleted); backend/app/main.py:66 (about 22 KB per field); Dockerfile:18 (DATA_DIR=/tmp/data)
- Reproduced: yes
- Evidence: 60 requests in 60 different weather cells on the fake upstream took 20 s and grew the cache from 1.5 MB to 40 MB (63 cell files). The catalogue has 0 scenes at 140W,30N, so an open-ocean field costs one search and one NASA POWER request yet still leaves the 0.63 MB file. Roughly 1,300 new cells fill a 1 GiB instance; it is then killed and restarted with an empty cache. Each new cell is also one 45-year NASA POWER request.
- Fix: After write_json at main.py:66 (tested with a cap of 20: 45 cells left 20 files, a pruned cell rebuilt fine):
for folder, keep in (("fields", 2000), ("climate", 100)):
    for old in sorted((K.DATA_DIR / folder).glob("*.json"), key=lambda p: p.stat().st_mtime)[:-keep]:
        old.unlink(missing_ok=True)
Acceptable as is for the demo once the per-client limit is in: the restart heals itself and presets are static.

### [minor] Interactive API docs and schema are public
- Where: backend/app/main.py:20
- Reproduced: yes
- Evidence: GET /docs, /redoc and /openapi.json answer 200 on the local server and in the built image. They expose nothing secret, only the request shape, and give anyone a form to send requests from.
- Fix: app = FastAPI(title="Field Shift API", docs_url=None, redoc_url=None, openapi_url=None). Tested: the three paths then fall back to the app's index.html. Acceptable to leave.

### [minor] Container runs as root and base images are pinned by tag, not digest
- Where: Dockerfile:2, :9, :10 (node:22-slim, python:3.12-slim, uv:0.5) and no USER line
- Reproduced: yes
- Evidence: Built the image: id inside it is uid=0(root), Config.User is empty. Contents are clean: /srv/backend holds only the six app/*.py files, pyproject.toml and uv.lock, /srv/frontend/dist holds the built site and three presets; no docs, tests, .git, CLAUDE.md, .data or local paths. Python and npm dependencies are locked by uv.lock and package-lock.json.
- Fix: Leave as is for the hackathon: Cloud Run sandboxes the container, there are no secrets in it and nothing persistent to damage. A USER line would need the start command changed and retested, which is not worth the risk before Sunday.

### Checked and working

- Path traversal through the static handler: 10 variants (../, %2e%2e, ..%2f, backslashes, //etc/passwd, %00, /.env, /.git/config) all returned the 672-byte index.html, never a file outside frontend/dist; /api/* unknown paths return a JSON 404.
- No user input reaches a file path: the field id is a SHA-256 of the validated outline, the climate file name is built from two integers, and extra body keys such as id or fid are ignored.
- 22 malformed or hostile bodies (wrong types, NaN, 1e400, booleans, nested junk, script tags, path strings, text and XML content types): all answered 422 with a readable message, no 500, no traceback in the log, no upstream URL or internal path in any error.
- CORS and headers: no Access-Control headers are sent, so another site cannot read responses or send the JSON POST from a browser; the only extra header is 'server: uvicorn'.
- Built bundle: no secrets, API keys, local paths, localhost URLs or source maps; map tiles come from keyless public services.
- Memory per build is fine: 59 MB idle, 81 MB after a 550-scene build, 182 MB peak for a 28,000-scene build; only 40 responses are in flight at once, so the 550 answers of 38 KB are never held together. The container idles at 79 MiB, so the 512 MiB default would also carry normal use.
- The global upstream cap holds: never more than 40 statistics calls in flight across concurrent builds, and a third simultaneous new field is refused with 429 in 2 ms.
- Cache hits work: the same outline, or one shifted by less than 1 m, returns in 3 ms with no upstream call.
- Upstream failure wording: when more than 10 % of scenes fail the API answers 502 with a plain sentence naming the service.
- The planned deploy flags in CLAUDE.md:183 (--max-instances 1, --memory 1Gi, --timeout 600) match the one-process design; without --max-instances 1 the build and concurrency limits would apply per instance.
- Clean-up: all servers I started on 8023, 8026, 8027 and 8029 are stopped, the test image is removed, git status is clean and backend/.data is unchanged.

## Expert judge read

Safe to show: no crash, console error or dead end in any of the 19 screens (3 fields x 2 years x 3 tabs, plus About), live analysis of a drawn field returned in 42 s, and the weather numbers match known events (2021 Kostanay drought, 2023 wet harvest, record-wet 2024). It is not yet safe in front of an agronomist: the bar "Break from wheat diseases and weeds" reads high for wheat-barley-wheat-barley, the Kostanay card says water stress is "low" beside a 45%-of-normal drought year, and no drought list contains 2012 while the millet text cites "the 2012 drought ... at Shortandy". Fix those three first (about 30 minutes, all in frontend/src/lib/rotation.ts), then the priority sliders, which change nothing visible. Scores as it stands: Impact 3, Creativity 3, Validity 4, Relevance 4, Presentation 3, total 17 of 25. It reads as rotation decision support, not a monitoring dashboard, because Strategies is the landing tab; but at 1440 px only two of the three cards fit and the third sits about two screens down. The last finding lists the five cheapest changes; server on 8024 is stopped and the repository is untouched.

### [major] Wheat-barley alternation is rated a HIGH break from wheat diseases and weeds, above the sweet clover rotation
- Where: frontend/src/lib/rotation.ts:147-157 (pestBreak); Strategies tab, water card, Fyodorov north and Tayinsha at default sliders
- Reproduced: yes
- Evidence: On screen: "Wheat, barley, wheat, barley ... Break from wheat diseases and weeds: high" next to "Sweet clover (green manure), wheat, wheat, barley ... medium". Engine values 0.70 against 0.65. Barley hosts the same root rots (common root rot, Fusarium) and carries the same grass weeds and herbicide groups as wheat, so an agronomist will call this wrong. The code only counts wheat (isWheat) and treats barley as a full break.
- Fix: Cap the bar at 0.5 when every sown crop is a cereal, e.g. first argument of Math.min becomes `sown.every((id) => crop(id).group.startsWith("cereal")) || mouldCount > 1 ? 0.5 : 0.8`. Then run `node frontend/scripts/check-rotation.ts`. Wheat-barley drops to medium and the lentil runner-up (already flagged "Close call") may take the water card, which also adds variety between fields.

### [major] "Water stress in this location's weather record is low" on a rainfed Kostanay field, beside a severe-drought line
- Where: frontend/src/lib/rotation.ts:471-475 (stressLine) and :354 (stress); Strategies tab, Fyodorov north, first two cards
- Reproduced: yes
- Evidence: Quote: "Water stress in this location's weather record is low and heat stress is moderate." Same card: "In 2021 ... May to August rain was 45% of normal ... a severe drought" and "7 of the 36 seasons ... were a drought". Climate tab, same field: normal hydrothermal coefficient 0.81 with the caption "Around 1 is enough moisture". profile.water is 0.18 (mean shortfall against the cell's own normal), so it measures variability, not how dry the place is. Tayinsha, with nearly the same climate (0.24), reads "moderate".
- Fix: Reword to say what the number is: `Rain shortfalls against this location's own normal are ${rare|occasional|frequent} and hot spells are ${...}; the normal itself is dry (hydrothermal coefficient ${normals.htc}, where about 1 is enough moisture).`

### [major] Drought lists omit 2012 everywhere, while the millet text cites "the 2012 drought ... at Shortandy"; 2020 is a drought at 91% of normal rain
- Where: frontend/src/lib/rotation.ts:284 (millet note) and :393 (drought sentence); backend/app/constants.py:82 (DROUGHT_PCTL); Shortandy west, Strategies with the drier slider at half, and Climate tab 2012 and 2020
- Reproduced: yes
- Evidence: Shortandy, drier slider at 0.5, water card shows both: "in the 2012 drought it out-yielded wheat by 0.3 t/ha at Shortandy (Barayev centre)" and "7 of the 36 seasons ... were a drought ...: 1991, 1996, 1997, 1998, 2010, 2020, 2023". Climate tab 2012: rain 82% of normal, 39 hot days against 22, coefficient 0.49, rank 10 of 36, no drought label. Climate tab 2020: "144 mm, 91% of normal" under "Drought by this area's own record" (coefficient 0.48). 2012 is the reference drought of the grain belt and is absent from all three fields' lists (Kostanay 2012 reads 101% of normal rain). The count is also fixed by definition (lowest fifth is always about 7 of 36), so it is not evidence for a card.
- Fix: Smallest: drop "in the 2012 drought" from rotation.ts:284 ("in a dry year (2012) it out-yielded wheat ...") and reword :393 to "The driest fifth of seasons since 1991 by rain set against heat (NASA POWER regional grid): ...; a May to August total can hide a dry June and July". Better but needs a preset rebuild: rank on June to July instead of May to August.

### [major] Priority sliders change nothing visible; the soil card is sweet clover on every field at every slider position
- Where: frontend/src/lib/rotation.ts:181-224 (total) and :465-470 (priorityLine); frontend/src/components/strategies-tab.tsx:139-149; Strategies tab, any field
- Reproduced: yes
- Evidence: Browser, Fyodorov north: Save water to High then Low, Build soil to High then Low, Market to High: all three cards and all bars identical. Only Market to Low changes the water card (to lentil). The one visible effect is the sentence "You gave soil a high priority, which shifted the weights behind this option." on an unchanged card. Engine sweep of 27 priority combinations per field at the recorded climate: soil card is "Sweet clover (green manure), wheat, wheat, barley" 27 of 27 times on all three fields, and on a fourth field I drew. The "Drier and hotter" slider does work: at half, cards move to millet, flax and lentil.
- Fix: Show the score the sliders already drive: add a row "Fit to your priorities" on each card from total() (compute it for the baseline too), so every slider move redraws a bar. About 30 to 45 minutes. Until then, drop "which shifted the weights behind this option" when the pick did not change.

### [major] At 1440 px only two of three cards fit; the soil option and the Side by side table are about two screens down
- Where: frontend/src/components/strategies-tab.tsx:160-203; first load at 1440 x 900
- Reproduced: yes
- Evidence: Screenshot at 1440 x 900 on first load: sidebar, map, then "Keep the current rotation" and "Climate and water-resilient shift" only. Cards are about 1,400 px tall, so the third card starts below both. Three cards fit only from about 1600 px.
- Fix: Move the "Side by side" section (lines 170-203) above the cards section (lines 160-168) so all three options and their bars are on the first screen at any width. Ten minutes. Alternative: change minmax(17rem,1fr) to minmax(14rem,1fr) at line 163 and analysis-panel.tsx:26.

### [major] Demo land use is presented as declared by "the person who knows the field", but the team assumed it
- Where: backend/presets.geojson:10, 32, 54 (note), copied to frontend/public/presets/index.json; frontend/src/components/seasons-tab.tsx:77; header of every tab and Seasons tab
- Reproduced: yes
- Evidence: Header: "Outline traced by eye on satellite imagery ... Land use for 2019 and 2023 was declared as fallow because the satellite curve alone cannot tell weedy fallow from a failed crop." Seasons tab 2019 and 2023: "Given by the person who knows the field, so it is used instead of the reading from the greenness curve." A judge who asks "declared by whom?" gets no good answer, and the two fallow years are what make the fallow rotation story fit.
- Fix: Change the notes to "For this demo we assumed fallow in 2019 and 2023; no farmer was consulted." (and likewise for the other two), hand-edit index.json in public and dist. For preset fields show "Assumed for this demo" instead of "Given by the person who knows the field".

### [minor] Shortandy and Tayinsha: "You declared wheat every year" and a declared fallow year on the same card
- Where: frontend/src/lib/rotation.ts:566-573; backend/presets.geojson:33, 55; Strategies tab, baseline card
- Reproduced: yes
- Evidence: Quote: "You declared wheat every year." then "Bare or fallow summers, taking your declared land use first ...: 1 of the 9 seasons with a clear land use (2021). That does not match a crop every year, so the declared rotation is worth checking." Both declarations ship with the demo, so the app is contradicting its own demo data.
- Fix: When the fallow year was itself declared, replace the tail with "You also gave 2021 as fallow, so wheat every year is an approximation of this field." Or set these two presets to "other".

### [minor] Tayinsha stressed year: "The regional weather record does not explain the low greenness" beside 33 hot days against 17 and 39.6 °C; MODIS disagrees silently
- Where: backend/app/analyse.py:20 (NO_WEATHER_REASON, baked into the preset JSON); frontend/src/lib/data.ts:124; Tayinsha 2021, Seasons and Climate tabs
- Reproduced: yes
- Evidence: Climate tab 2021: rain 76% of normal, hot days 33 (normal 17), hottest day 39.6 °C on 3 July, about flowering for May-sown wheat. Seasons tab, same year: Sentinel-2 "Peak greenness well below this field's normal (warning)", 75% of usual, then "2021 was among the 10 lowest of 25 cropped-looking summers" (MODIS peak 0.714 against a median of 0.735, an ordinary year). So for this field's stressed year neither NASA dataset supports the finding, and "among the 10 lowest of 25" is an odd way to say mid-table.
- Fix: Reword to "The regional weather record shows nothing unusual enough, by this app's thresholds, to name as the cause." (edit analyse.py and the three explanation strings in nk-tayinsha.json). Add one sentence when Sentinel-2 flags a warning and the MODIS rank is mid-table: "The NASA MODIS record at 250 m does not show this year as unusual; the two disagree, which is another reason for a field visit."

### [minor] Trend sentence claims "no clear trend in ... temperature" but only hot-day counts were tested
- Where: backend/app/climate.py:269 (baked into trendNote in the three preset files); Climate tab, under the rain chart
- Reproduced: yes
- Evidence: Quote: "NASA POWER shows no clear trend in growing-season rain or temperature for this grid cell (1991 to 2026). We make no trend claim." The code tests rainMayAug and hotDays30 only. Warming of mean temperature in northern Kazakhstan is well documented, and the challenge opens with "shifting temperatures", so a climate judge will push on this.
- Fix: "NASA POWER shows no clear trend in May to August rain or in the number of days at 30 °C or more for this grid cell (1991 to 2026). Mean temperature was not tested." Edit climate.py:269 and the trendNote string in the three preset JSON files.

### [minor] Soil card cites the oats rotation trial as if it supported the sweet clover pick; "ploughed in" jars in a no-plough region
- Where: frontend/src/lib/rotation.ts:334 (TRIAL_LINE, used at :634) and :314 (sweet clover benefit); Strategies tab, soil card, all fields
- Reproduced: yes
- Evidence: Card titled "Sweet clover (green manure), wheat, wheat, barley", "Evidence: Judgement", then under Why: "Oats, wheat, wheat, barley is the one rotation measured locally ... about 27% more grain per rotation hectare than the fallow rotation." A reader asks why the measured rotation is not the pick. The Barayev system is built on not ploughing, so "ploughed in the next summer" reads as foreign advice. Also on continuous-wheat fields the card says the gains are "not soil cover" and then lists "it covers the soil" as a benefit.
- Fix: Prefix line 334 with "For comparison, not this option:" or show it only when the pick is the trial rotation. Line 314: "worked into the soil, or killed and left as mulch, the next summer".

### [minor] Card credibility: sweet clover and barley are defensible picks, but cards barely differ between fields and the "cannot see" list is boilerplate
- Where: frontend/src/lib/rotation.ts:581-586, 612-617, 639-646 (gaps) and :518-539 (localReview); Strategies tab, all fields
- Reproduced: yes
- Evidence: Default picks: Fyodorov and Tayinsha both get wheat-barley-wheat-barley; Shortandy gets wheat-chickpea-wheat-barley; all three get the identical sweet clover card. Five of six shift cards show "Close call". Sweet clover (donnik) green-manure fallow is a real practice in this region, so it reads as sensible once, less so three times, and it is rated as drying the soil as much as sunflower, which the water card excludes for that reason; its "Climate fit" still ties the water card (0.84). Barley as drought escape is defensible. "What satellites cannot see" is the same four bullets per card type on every field; only the national-yield sentence varies. "Needs local review" is specific where a new crop appears (chickpea herbicide carry-over, inoculant, frost; sweet clover water use) and thin for barley: on Tayinsha it is one generic bullet, "Seed supply and a buyer within reach for each new crop." Chickpea card shows "Market access: high" beside "few buyers and little local seed".
- Fix: Make one gap bullet per card specific to the proposed crop (for sweet clover: "whether the stand established under the cover crop"; for chickpea: "September frost on this field"). The pest-break cap and the priorities row above do the rest.

### [minor] Relevance: NASA POWER carries the rotation scoring, but the lead chart is ESA and SMAP and IMERG are map overlays only
- Where: frontend/src/components/seasons-tab.tsx:222; frontend/src/lib/rotation.ts:399; backend/app/constants.py:72 (GWETROOT and EVLAND fetched, never used)
- Reproduced: yes
- Evidence: Where a judge sees NASA: sidebar subtitle "from NASA Earth data"; MODIS NDVI layer on by default with the GIBS credit; "NASA MODIS record since 2000" on Seasons; the whole Climate tab; "(NASA POWER ...)" and "(NASA MODIS ...)" in card evidence. The stress profile that picks the rotations is NASA POWER, so NASA is core, not decoration. Weak points: "Sentinel-2 detail since 2018 (ESA)" is the headline chart and source of every season finding; the water card says "Water stored deep in the soil after winter is not measured" while the map offers a NASA SMAP root-zone layer.
- Fix: Cheap: start each evidence line with its source ("Sentinel-2 (ESA):", "NASA POWER:", "NASA MODIS:"); the first line on every card, the NDVI finding, names none. Larger, about an hour with a preset rebuild: use the already-fetched root-zone wetness on 1 May as a row in the Climate table and an evidence line.

### [minor] Jargon a farmer meets with no explanation in place
- Where: Strategies cards (frontend/src/lib/rotation.ts) and Seasons and Climate tabs
- Reproduced: yes
- Evidence: Unexplained on screen: "inoculant" (lentil, pea), "sulfonylurea", "white mould (Sclerotinia)", "septoria and related spot diseases", "pulse", "green cover summed over those weeks", "rank 4 of 36 for moisture", "250 m pixels", "regional grid", "Evidence: Judgement", "Relative output (no unit)", "Climate fit", "cropped-looking summer", "Usual range (middle half of its cropped years)". The slider "Drier and hotter than the record" says "Somewhat" or "Markedly" but never how much. Explained well in place: NDVI, NDMI, hydrothermal coefficient, green manure. The glossary lacks evapotranspiration, soil-moisture anomaly and frost risk, which the challenge text names. The app is English only.
- Fix: Add four or five words in place for each: "inoculant (seed-applied bacteria)" in the lentil and pea notes as the chickpea note already does; "sulfonylurea (a common group of cereal herbicides)"; under the drier slider "far right: a quarter less May to August rain"; "rank 4 of 36 driest seasons since 1991".

### [minor] "Compare with" box is blank on each field's good year
- Where: frontend/src/components/seasons-tab.tsx:229; Seasons tab, any demo field, 2024
- Reproduced: yes
- Evidence: Opened ?date=2024-07-15&field=kostanay-fyodorov&tab=seasons: the trigger text is an empty string, because the default comparison year is the selected year and is filtered out of the list. Same on the other two fields.
- Fix: value={String(other?.year ?? "none")}

### [minor] Small number and wording mismatches a careful reader will catch
- Where: frontend/src/components/climate-tab.tsx:177; backend/app/vegetation.py:128; frontend/src/lib/data.ts:124; Climate and Seasons tabs
- Reproduced: yes
- Evidence: Fyodorov 2021: "rank 4 of 36" beside "in the lowest tenth of this area's seasons" (4 of 36 is 11%). Fyodorov 2022: titled "a little below this field's normal (watch)" with "green cover summed over those weeks was 56% of usual", worse than the 65% of the 2021 warning. Shortandy: "2023 was among the 2 lowest of 22 cropped-looking summers" while 2010 and 2012, the two reference droughts, are hatched "Fallow or bare (not ranked)" and so removed from the ranking. First autumn frost dates of 3 Oct and 23 Oct (Tayinsha 2026) look late for 51 to 54°N; the caption could say grid air temperature at 2 m, ground frost comes earlier. October to April precipitation normals of 172 to 190 mm run above gauge figures for the region; the rest (rain normals 157 to 196 mm, hydrothermal coefficient 0.66 to 0.83, 17 to 22 hot days, trial yields, the 27% trial figure) is plausible.
- Fix: climate-tab.tsx:177: "at or below the 10th (20th) percentile of the 1991 to 2020 seasons". vegetation.py:128: retitle the watch level "Peak greenness below this field's normal" or raise it one level when the season total is under 65% of usual. data.ts:124: add "Summers that read as bare, which may be failed crops, are not ranked."

### [minor] Scorecard as it stands, and the five cheapest changes that raise it
- Where: Whole app as served on port 8024 from frontend/dist
- Reproduced: yes
- Evidence: Impact 3: real regional problem and a no-login tool with live analysis, but English only, three fixed starting rotations and near-identical advice across fields. Creativity 3: declared against inferred land use, sowing-date robustness and evidence grades are distinctive; the rest is conventional. Validity 4: transparent rules, sourced trial figures and honest limits, held back by the disease bar, the water-stress wording and the drought list. Relevance 4: every challenge objective is addressed and NASA POWER drives the scoring, but field findings rest on ESA data. Presentation 3: clean and stable, but text-heavy, third card below the fold at 1440 px and sliders that look inert. Total 17 of 25; the five changes are about two hours and should lift Validity and Presentation by a point each.
- Fix: 1. Cap the disease bar for all-cereal rotations (rotation.ts:147), 10 min, Validity. 2. Reword the water-stress sentence, the drought sentence and the millet note (rotation.ts:472, :393, :284), 20 min, Validity. 3. Move "Side by side" above the cards and fix the blank compare box (strategies-tab.tsx:160-203, seasons-tab.tsx:229), 15 min, Presentation. 4. Add a "Fit to your priorities" row driven by the sliders and say what the drier slider's far end means, 45 min, Presentation and Impact. 5. Text-only honesty edits: preset notes "assumed for this demo", trend sentence, source prefix on each evidence line, "For comparison" on the trial line, 30 min including hand-editing the preset JSON, Validity and Relevance.

### Checked and working

- All 18 field, year and tab screens plus the About dialog render with no console error, page error or broken layout at 1600 px; first load at 1440 x 900 and a 390 px phone view also render cleanly.
- Live analysis of a newly drawn 334 ha polygon returned in 42 s with HTTP 200 and produced three cards; a non-polygon is refused with HTTP 422 and a plain message.
- Reads as rotation decision support: Strategies is the landing tab, the first field opens on its stressed year, and each card has Why, What this rests on, Benefits, What satellites cannot see and Needs local review.
- NASA is visible on the first screen: subtitle "from NASA Earth data", MODIS NDVI layer on by default with the GIBS credit, and NASA POWER and MODIS named in card evidence.
- The "Drier and hotter than the record" slider visibly changes both shift cards (millet, flax and lentil appear from the halfway point) and the stress sentence labels it "a what-if, not a forecast".
- Changing "Current rotation" to "Other or not sure" rewrites the baseline card and states the assumption: "this card assumes wheat every year. The comparison is only as good as that assumption."
- Weather numbers match known events: Kostanay 2021 at 45% of normal rain with 43 hot days, Shortandy 2023 severe drought followed by a wet harvest (75 mm, 235% of normal), and 2024 the wettest season of 36 in all three cells.
- Finding arithmetic checks out against the preset files: the stated percentages of usual peak (72%, 72%, 75%) match the medians of the other cropped seasons.
- Trial figures on the cards are consistent with the catalogue sources: wheat after oats 6% below wheat after fallow (20.1 against 21.4 c/ha), after lentil 12% below.
- About dialog covers uncertainty, satellite against ground measurements, a ten-term glossary and data credits, with no NASA logo anywhere.
- Strategy cards are identical for a field's stressed and good year, as they should be: they depend on the whole record, not the selected season.
- Server on port 8024 stopped; repository working tree unchanged (git status clean); scratch files only under the judge-eye scratch folder.

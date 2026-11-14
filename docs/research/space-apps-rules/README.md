# Space Apps 2026 rules and the official challenge

Research note from the design phase, 2026-11-14. Each finding is tagged: `verified-live` (a command was run), `source-read` (the cited source was read) or `memory` (unverified recall). Paths to scratch files that were not kept in the repo are historical.

## Recommendation

Keep the Kazakhstan project and the Singapore registration: no rule ties a project's geography or subject to its Local Event, and a moderator on the official forum says a single country or region is fine. Keep the three-strategy comparison as the centrepiece, even though the challenge words it as "may", because judges score Relevance on how fully the project addresses the challenge. Move the per-field analysis onto NASA products (MODIS 13Q1 from 2000 for the baseline, HLS or Landsat for field scale) and keep Sentinel-2 as the partner complement: Relevance asks for NASA data as "a core component ... rather than a superficial addition", and Global Award eligibility needs at least one NASA dataset. Plan the demo as a deck of 7 slides or fewer, or a video of 30 seconds or less; going over makes the project ineligible for Global Judging. The deadline is Sunday 15 November 23:59 Singapore time, which is 20:59 on this machine's clock (it is set to UTC+5), so submit by Sunday afternoon and resubmit as the app improves. AI tools, including an LLM at runtime, are allowed, but the idea must be the team's, the "Use of Super Intelligence (SI)" field must be filled, generated code must be acknowledged in descriptive text and metadata, and no NASA logo may appear. Of the partner offers, only the Google Cloud $300 credit is worth claiming (new accounts only); skip Meteomatics, the free domain and Azure.

## Spec

**Status.** (a) to (g) all verified live on 2026-11-14 from `spaceappschallenge.org` (page bodies come from its public GraphQL API, `pageByPath`). Unverified: Singapore's nominee quota and local pitch format; which form fields are optional; FortiGuard's rating of `*.run.app`. `report.md` was not written: the harness refused the file write, so the findings list is the long version. Raw pages and a verbatim export of the challenge are in `<scratch>/space-apps-rules/downloads/` (`field_shift_official.md`).

**(a) Challenge** `https://www.spaceappschallenge.org/2026/challenges/adapting-farms-with-nasa-data/`
- Everything is "may". "You may compare at least three rotation strategies, including the existing rotation", each with: why suggested, evidence, benefits, information gaps, risks needing local review.
- Named NASA data: SMAP, ECOSTRESS, GPM, Landsat, MODIS, NASA POWER, GRACE/GRACE-FO, SRTM. Partner: Copernicus Sentinel-2, ERA5. Soil and crop resources listed are US-only except FAO GAEZ.
- CLAUDE.md §3 paraphrases the Objectives correctly but is not the rubric. Missing: evaporation, extreme precipitation, long-term water trends, terrain; forage value, supplemental income, infiltration, local soil information; farmer-entered priorities and constraints; glossary; satellite-versus-ground note; uncertainty statement; "compare different SI or statistical approaches".

**(b) Submission**

| Item | Rule |
| --- | --- |
| Fields | Project Name; High-Level Project Summary; Link to Project Demo; Link to Final Project; Detailed Project Description; Use of Super Intelligence (SI); NASA Data; Space Agency Partner Data and Other References; 2 checkboxes |
| Demo | 7 slides or fewer (title and intro count) or video of 30 s or less; over the limit = not eligible for Global Judging; English; slides show team name, members, challenge |
| Links | public, no login; images can be pasted into the page, video and documents cannot |
| Repo | not mandated; OSI licence, or NASA applies Apache 2.0 |
| Deadline | Sun 15 Nov 23:59 SGT = 15:59 UTC = 20:59 at UTC+5 (this machine); a save after it voids eligibility |
| Team | 1 to 6, all confirmed at the same Local Event; one challenge; Team Owner switches via "Edit Details" |
| Start | no work before 14 Nov 09:00 local; first commit was 12:36 SGT |

**(c) AI ("SI")**: permitted, LLMs included. Not for "com[ing] up with your idea". Code and data "Must acknowledge SI generation in descriptive text and metadata"; generated images and video need a visible watermark; no NASA logos or mission identifiers. The SI field is not shown to judges; markers inside the project are. "Metadata" is not defined. Suggested minimum:

```
README.md                      ## Use of AI (SI) tools: what Claude Code wrote, what the runtime model writes
pyproject.toml, package.json   description: "... built with AI assistance (Claude Code)"
API response                   "narrative": {"text": "...", "generated_by": "<model id>"}
UI                             "AI-written summary" label beside any LLM text
```

**(d) Judging**: 1 to 5 on Impact, Creativity, Validity, Relevance, Presentation at every level. Local judges pick Global Nominees (3 Dec 2026), global judges pick Finalists (17 Dec), executives pick ten winners (26 Jan 2027).

**(e) Local event**: sets only the deadline time zone and the round-one judges. Singapore: virtual, SGT, waitlist on, 699 of 750 places taken.

**(f) Offers**

| Offer | Verdict |
| --- | --- |
| Google Cloud, $300 for 90 days, new accounts only | Claim. Runs to about 12 Feb 2027. Does not pay for Gemini API or partner models |
| Planetary Computer | Already used; nothing to claim |
| Meteomatics | Skip: access ends with the hackathon |
| Free domain (spaceapps.earth) | Skip: new domains risk judges' web filters |
| Azure, $200 for 30 days | Skip: expires 14 Dec |
| Copilot, Teams, Miro | Not needed |

Cloud Run: free tier 2M requests, 360,000 GB-s, 180,000 vCPU-s per month. Warm instance (1 vCPU, 512 MiB) about $0.32 per day at Tier 1. Singapore region is Tier 2.

**(g) Data**: at least one NASA dataset is required for Global Award eligibility; partner data is "highly encouraged"; list every dataset, library, text and image. Credits:
- POWER: "The data was obtained from National Aeronautics and Space Administration (NASA) Langley Research Center's Prediction Of Worldwide Energy Resources (POWER) project funded through the NASA Earth Science Division."
- GIBS: "We acknowledge the use of imagery provided by services from NASA's Global Imagery Browse Services (GIBS), part of NASA's Earth Science Data and Information System (ESDIS)."
- Sentinel: "Contains modified Copernicus Sentinel data [Year]".
- NASA-led mission data are CC0, so keeping derived per-field history is allowed.

**NASA-first sources, keyless, live-checked near Kostanay** (same Planetary Computer STAC):

| Collection | Starts | Use |
| --- | --- | --- |
| `modis-13Q1-061` (250 m, assets `250m_16_days_NDVI`, `250m_16_days_pixel_reliability`) | 2000 | long baseline and anomaly |
| `hls2-s30`, `hls2-l30` (30 m, `Fmask`) | 2020 | field scale; 2021 and 2024 both covered |
| `landsat-c2-l2` (`red`, `nir08`, `swir16`, `qa_pixel`) | 1982 | older field-scale history |

HLS band mapping (from memory, check before use): S30 NDVI `(B8A-B04)/(B8A+B04)`, NDMI `(B8A-B11)/(B8A+B11)`; L30 NDVI `(B05-B04)/(B05+B04)`, NDMI `(B05-B06)/(B05+B06)`.

GIBS toggle layers, sample tiles returned 200: `SMAP_L4_Analyzed_Root_Zone_Soil_Moisture` (Level6), `IMERG_Precipitation_Rate` (Level6), `MODIS_Terra_L3_NDVI_16Day` (Level9), `HLS_S30_Nadir_BRDF_Adjusted_Reflectance` (Level12), `BlueMarble_ShadedRelief_Bathymetry` (Level8), `Reference_Labels_15m` (Level13).

## Corrections this made to the first brief

- Section 3 title is wrong. The four points are the challenge Objectives (all worded 'may'), not the judging rubric. The rubric is Impact, Creativity, Validity, Relevance, Presentation, each scored 1 to 5 at every judging level. Add those five and test features against them.
- Section 3, last line ('The rotation comparison is what the brief scores'): judges score Relevance (addresses the challenge and uses NASA data as a core component) and give Presentation equal weight. The comparison still deserves to be the centrepiece, but the map and demo story are scored too.
- Section 3 point 3: the official text says only 'at least three rotation strategies, including the existing rotation'. 'Climate/water-resilient' and 'soil-restoring' are the team's own labels; keep them, but do not present them as official.
- Section 3 omits official items: evaporation, extreme precipitation, long-term water trends, terrain; forage value, supplemental income, infiltration, local soil information; farmer-entered priorities and constraints; a glossary of terms; a satellite-versus-ground note; a statement of model uncertainty; comparing an AI approach with a statistical one.
- Sections 5 to 7: per-field statistics rest on ESA Sentinel-2, with NASA data only for climate and background tiles. Relevance asks for NASA data as 'a core component'. Add modis-13Q1-061 (from 2000) for the baseline and hls2-s30/hls2-l30 (from 2020 on Planetary Computer) or landsat-c2-l2 for field scale; keep Sentinel-2 as the partner complement.
- Section 7 and 4: there is no soil data source, yet the challenge asks for 'local soil information'. The official soil resources are US-only; FAO GAEZ is the listed global option. Otherwise state soil as an information gap on each strategy card.
- Section 10 'demo (short video or slide deck)': the limits are a video of 30 seconds or less, or 7 slides or fewer including title and intro slides. Exceeding them makes the project ineligible for Global Judging. Slides must show team name, member names and the challenge. English only.
- Section 10 'before the Sunday deadline': it is Sunday 15 November 23:59 Singapore time (UTC+8). This machine's clock is at UTC+5, where that is 20:59. A save after the deadline voids eligibility.
- Section 9 item 4 ('48 hours'): the window is 14 November 09:00 to 15 November 23:59 SGT, 39 hours. About 34.5 hours remained at 13:15 SGT on Saturday.
- Section 10 'Declare AI use': be specific. Fill the 'Use of Super Intelligence (SI)' field; acknowledge generated code in descriptive text and metadata; label any LLM text in the app; watermark any generated image or video; no NASA logos. The site says SI, not AI.
- Section 2 forbids AI attribution lines in commits, while the rules require generated code to be acknowledged 'in descriptive text and metadata'. If commits stay clean, put the acknowledgement in the README and in package metadata. The user should decide this one.
- Section 10 credits: also list every code library, text and image used (even open source) in the 'Space Agency Partner Data and Other References' field, and identify their licences in the repo. NASA can withdraw nominations from teams that do not cite.
- Section 10 'min instances 1 during judging': judging runs until 17 December 2026 (finalists) and 26 January 2027 (winners). Budget for that span, or accept cold starts after local judging. Singapore is a Tier 2 Cloud Run region; us-central1 and europe-west4 are Tier 1.
- Section 10 LLM keys: the Google Cloud $300 credit does not pay for Gemini API in AI Studio or for partner models, so a runtime LLM needs its own funded key through the judging period, or its outputs must be cached.
- Section 1 'registered at the Singapore local event': the event has a waitlist (699 of 750 places taken). Confirm the account is a confirmed participant; waitlisted members make a team ineligible.
- Section 6 Meteomatics: dropping it is right, for a stronger reason than credentials. The offer's access ends with the hackathon, before judging.

## Risks

- Deadline misread by three hours: the machine clock is UTC+5 and the deadline is in Singapore time (20:59 on this machine, Sunday).
- A demo over 30 seconds or 7 slides makes the project ineligible for Global Judging.
- Saving the project page after the deadline voids eligibility, even if it was submitted earlier.
- NASA data judged as 'a superficial addition' if field analysis stays on ESA Sentinel-2 alone, lowering the Relevance score.
- The live app must open without login for judges for weeks (to 17 December, possibly 26 January 2027). A closed free-trial account stops Cloud Run; upstream throttling on Planetary Computer would break fresh field reads, so precomputed presets matter.
- A runtime LLM key that runs out of credit during judging leaves blank cards; the Google credit does not cover Gemini API or partner models.
- AI disclosure gap: 'metadata' is undefined in the rules and the brief bans AI lines in commits. An unlabelled LLM paragraph or an AI-generated image without a watermark breaches the stated requirement.
- Any NASA logo in the app, deck or video breaches both the Space Apps rule on generated content and NASA's brand guidelines.
- Missing references: NASA reserves the right to remove nominations or awards from teams that do not cite every resource, including open-source libraries.
- Waitlisted status at the Singapore event would make the team ineligible for awards.
- A fresh custom domain may be blocked by judges' web filters; how *.run.app is rated could not be checked.
- No local soil or crop-type data exists for Kazakhstan in the official resource list; claiming soil insight without it would hurt Validity.
- The HLS band mapping in the details is from memory and unverified; HLS on Planetary Computer starts in 2020, so it cannot supply a long baseline on its own.

## Open questions

- How many Global Nominees can the Singapore event send, and is there a live local pitch or a local deadline earlier than 23:59 SGT? Not published; ask the Local Lead on the event's Discord.
- Is the account a confirmed (not waitlisted) Singapore participant, and is the team created with Field Shift selected?
- Which project form fields are mandatory and do any have length limits? Visible only in the form after login.
- What does the organiser accept as 'metadata' for acknowledging AI-generated code? Worth asking in Space Apps Connect (github.com/nasa/spaceapps) if commit trailers stay banned.
- Should 'Link to Final Project' be the live app or the public repo? Only one URL is allowed. My suggestion is the repo, with the live link in its first README line and in the Project Details field, because GitHub is certain to pass judges' web filters.
- Is the Google Cloud account new enough for the $300 trial (never a paying user of Google Cloud, Maps Platform or Firebase)?
- Solo or team? A Local Event team of one is eligible, so nothing forces recruiting.

## Findings

- **[verified-live]** (a) VERIFIED. The official challenge text was read in full. Every objective is phrased as optional: "You may compare at least three rotation strategies, including the existing rotation. For each strategy, you may explain why it was suggested, what evidence supports it, what benefits it may offer, where information gaps exist, and any risks that would need local review by farmers or agricultural experts." The stated outcome is "a supportive tool ... [that] does not replace farmer judgment or local agricultural expertise."
  - Evidence: https://www.spaceappschallenge.org/2026/challenges/adapting-farms-with-nasa-data/ (same text in the page HTML payload and in the API response); verbatim export at docs/research/space-apps-rules/downloads/field_shift_official.md
- **[verified-live]** The site is a Next.js app whose page bodies come from a public GraphQL API (query pageByPath). The correct challenge slug is adapting-farms-with-nasa-data; /2026/challenges/field-shift-adapting-farms-with-nasa-data/ renders a 'page could not be found' body.
  - Evidence: POST https://api.spaceappschallenge.org/graphql returned ChallengePage with detailsContent (7,566 chars) and resourcesTabContent (15,550 chars); challenge list returned totalCount 14
- **[verified-live]** Objectives name these NASA datasets: "SMAP, ECOSTRESS, GPM, Landsat, MODIS, NASA POWER, GRACE and GRACE-FO, and SRTM or other NASA elevation products", and these patterns: "temperature, heat stress, rainfall, soil moisture, evaporation, frost risk, extreme precipitation, vegetation stress, and long-term water trends". Farmer priorities listed: "water use, forage value, nitrogen-fixing potential, erosion reduction, organic matter improvement, or market suitability".
  - Evidence: https://www.spaceappschallenge.org/2026/challenges/adapting-farms-with-nasa-data/ (Objectives section)
- **[verified-live]** Resources tab: NASA items are SMAP, GPM/IMERG, Landsat, MODIS, VIIRS, NASA POWER, SRTM, ECOSTRESS, NLDAS/GLDAS, GEDI. Thirteen further items are US-only (USDA Ag Data Commons, Web Soil Survey, CropScape CDL, PRISM, SSURGO/STATSGO2, NAIP, NLCD, CoCoRaHS, NWIS, AMS Market News, NASS QuickStats, OpenET, LANDFIRE). FAO GAEZ (https://gaez.fao.org) is the only global crop and soil suitability source listed. Space Agency Partner Resources are ESA Copernicus Sentinel-2 (https://dataspace.copernicus.eu) and ERA5.
  - Evidence: Resources tab of the challenge page; full list with links in downloads/field_shift_official.md
- **[verified-live]** The optional 'Potential Considerations' ("You may (but are not required to) consider the following") add: explain terms such as evapotranspiration and NDVI; clarify satellite versus ground measurements; "compare different SI or statistical approaches"; "Explain how the model interprets uncertainty and where local expertise would be needed"; harmonise datasets to a common grid; let farmers "input their own priorities or constraints, such as water availability, equipment limitations, or market preferences"; optional timelines, overlays and scenario sliders.
  - Evidence: https://www.spaceappschallenge.org/2026/challenges/adapting-farms-with-nasa-data/ (Potential Considerations)
- **[source-read]** CLAUDE.md section 3 is a fair paraphrase of the challenge Objectives but is mislabelled as the judging rubric. It misses: evaporation, extreme precipitation, long-term water trends, terrain; forage value, supplemental income, infiltration, local soil information; farmer-entered priorities; glossary; satellite-versus-ground note; uncertainty statement; comparing an AI approach with a statistical one. The labels 'climate/water-resilient' and 'soil-restoring' are the team's own, not official wording.
  - Evidence: CLAUDE.md lines 15-21 compared with downloads/field_shift_official.md
- **[verified-live]** (b) VERIFIED. Project page fields: Project Name; High-Level Project Summary; Link to Project Demo; Link to Final Project; Detailed Project Description; Use of Super Intelligence (SI); NASA Data; Space Agency Partner Data and Other References. Two checkboxes at submit: Terms and Conditions, and Confirm All Work is Original. Images (JPG, PNG, GIF up to 10 MB) can be pasted into the page; videos and documents cannot.
  - Evidence: https://www.spaceappschallenge.org/resources/project-submission-guide/ ; event API projectFields lists summary, demoLink, projectLink, details, dataReferences, projectReferences
- **[verified-live]** Demo limits: "either in the form of a 7-slide presentation (including title and introductory slides) or a 30-second or less video presentation". "Projects that exceed these limits will not be eligible for Global Judging." Slides must show team name, member names and the selected challenge. English only; a video may be spoken in another language with English subtitles. Public link with no password, permission or registration.
  - Evidence: https://www.spaceappschallenge.org/resources/project-submission-guide/ (Project Page Form Field Instructions; Tips for Creating a Project Demo)
- **[verified-live]** Deadline: submission opens Saturday 14 November 09:00 and closes Sunday 15 November 23:59 "in accordance with the time zone of your team's Local Event". The Singapore event states "Singapore Time (SGT, UTC+8)". That is 15:59 UTC, and 20:59 on this machine, whose clock is at UTC+5. About 34.5 hours remained at the time of the check.
  - Evidence: https://www.spaceappschallenge.org/resources/project-submission-guide/ ; https://www.spaceappschallenge.org/2026/local-events/singapore/ (API timezone: Singapore); local `date` output: 2026-11-14 10:15 +05
- **[verified-live]** Resubmission is allowed until the deadline and "Only your last saved submission will be reviewed by the judges". "Any projects saved or submitted past this deadline will not be eligible for judging."
  - Evidence: https://www.spaceappschallenge.org/resources/project-submission-guide/ (Submitting Your Project)
- **[verified-live]** No rule requires a code repository. The final project link can be "a website you created to showcase your project, a cloud-based hosting service or code repository". Original content must be freely available or under an OSI licence; "If you do not specify a specific OSI compliant license, NASA will distribute your original content under an Apache 2.0 license."
  - Evidence: https://www.spaceappschallenge.org/resources/project-submission-guide/ ; https://www.spaceappschallenge.org/legal/ (terms updated August 7, 2026)
- **[verified-live]** Team rules: Local Event teams need at least 1 person and at most 6; all members must be confirmed (not waitlisted) at the same Local Event; one team per person; one challenge per team. To switch challenge, "The Team Owner can do this by choosing the blue 'Edit Details' option on your team's About page." No cutoff for switching is stated.
  - Evidence: https://www.spaceappschallenge.org/resources/team-formation-guide/ ; event API teamMemberLimit: 6
- **[verified-live]** Work may not start early: "participants should NOT begin working on their project until the hackathon begins on November 14, 2026 (9:00 a.m. local time)". The repository's only commit is stamped 09:36 +05:00, which is 12:36 SGT, after the start.
  - Evidence: https://www.spaceappschallenge.org/resources/team-formation-guide/ (Choosing a Challenge); `git log` output: ea21180 2026-11-14 09:36:47 +0500
- **[verified-live]** (c) VERIFIED. AI tools are permitted, including LLMs: "The use of SI tools, such as machine learning, chatbots, image generation, and large language models, is permitted ... SI should not be used to (come up with your idea of how to solve the challenge)." Disclosure: "Images and videos: Must include a visible watermark ... Code and data: Must acknowledge SI generation in descriptive text and metadata." Generated content "may not use, contain, or modify any NASA branding or design elements (such as the NASA logos, flags, or mission identifiers)".
  - Evidence: https://www.spaceappschallenge.org/resources/project-submission-guide/ (Use of Super Intelligence (SI))
- **[verified-live]** The 2026 site says 'Super Intelligence (SI)' wherever earlier years said AI, and the form field carries that label. The FAQ attributes the wording to a 29 September 2026 U.S. Executive Order (the order itself was not checked). The FAQ adds: "Each team's project submission must include a description of how SI tools were used during the development of their project."
  - Evidence: https://www.spaceappschallenge.org/resources/participant-faqs/ ; moderator reply at https://github.com/nasa/spaceapps/discussions/2065
- **[verified-live]** The answer in the SI field is not shown to judges, but AI markers inside the project are: "This SI question is for data-collection purposes only, and your response will not be seen by the judges. However, judges will be able to see any SI-generated indicators within your project ... They will evaluate originality, intent, and execution based on the SI-assisted elements you include and identify".
  - Evidence: https://www.spaceappschallenge.org/resources/project-submission-guide/
- **[verified-live]** (d) VERIFIED. Five criteria, each scored 1 to 5 "At every level of judging": Impact, Creativity, Validity, Relevance, Presentation. Relevance: "fully and directly addresses the challenge ... meaningfully integrates NASA data, utilizing it as a core component of the proposed solution rather than a superficial addition." Validity: "grounded in scientific principles". Presentation: "Judges evaluate the demo and full project to compute this score", and teams are told to "pay equal attention" to it.
  - Evidence: https://www.spaceappschallenge.org/resources/judging-awards-guide/ (Judging Criteria)
- **[verified-live]** Judging phases: local judges recruited by the Local Lead select Global Nominees (announced 3 December 2026); global judges select Global Finalists and Honorable Mentions (17 December 2026); an executive committee from NASA and partner agencies names ten Global Winners (26 January 2027). Local awards are optional and separate. The Local Impact Award is for "the greatest potential for making a difference in their local community".
  - Evidence: https://www.spaceappschallenge.org/resources/judging-awards-guide/ (Phases 1-3)
- **[verified-live]** (e) VERIFIED. No official page restricts project geography or subject by Local Event. The Local Event affects two things only: "Project Due Date" and "Project Judging" (round one by that event's judges). A moderator on the official forum states: "The challenge description does not prescribe a mandatory global geographical scope. You can focus on a particular country, agricultural region or climate zone."
  - Evidence: https://www.spaceappschallenge.org/resources/team-formation-guide/ ; https://www.spaceappschallenge.org/legal/ ; https://github.com/nasa/spaceapps/discussions/2047
- **[verified-live]** Singapore 2026 event: hackathon days are virtual, time zone SGT, team size 1 to 6, waitlist enabled, 699 registrations against a virtual limit of 750. Its page sets no theme or regional condition. The number of teams it may nominate and any local pitch format are not published.
  - Evidence: https://www.spaceappschallenge.org/2026/local-events/singapore/ (API: isVirtual true, isWaitlist true, cachedRegistrations 699, virtualRegistrationLimit 750, availableNominations null)
- **[verified-live]** (f) VERIFIED. 2026 Global Offers: Microsoft Azure ($200 for 30 days), Microsoft Planetary Computer (no account needed), Microsoft Copilot, GitHub Copilot Free, Microsoft Teams Free, Google Cloud ($300 for 90 days), Meteomatics Weather API (1,000 queries per day), Miro (three offers), and a free domain with one year of hosting from GoDaddy Registry via Porkbun (https://www.spaceapps.earth/). All are optional.
  - Evidence: https://www.spaceappschallenge.org/2026/global-offers/
- **[verified-live]** The Meteomatics offer ends with the hackathon: "Access is active for the duration of the hackathon." Meteomatics' own page says the account is "for the duration of the Space Apps Challenge". An app that depends on it would break before judging.
  - Evidence: https://www.spaceappschallenge.org/2026/global-offers/ ; https://www.meteomatics.com/en/meteomatics-and-nasa-space-apps-challenge/
- **[verified-live]** The Google Cloud offer is the standard free trial: $300 valid for 90 days, only for accounts that have "never been a paying user of Google Cloud, Google Maps Platform, or Firebase". The credit cannot pay for Gemini API in AI Studio, nor for partner models offered as a managed API, and covers Gemini platform (Vertex AI) services only if the trial starts before 16 November 2026. When the trial closes, resources are stopped and deleted after a 30-day grace period unless the account is upgraded.
  - Evidence: https://docs.cloud.google.com/free/docs/free-cloud-features (text saved at downloads/gcp_free.txt lines 217-233, 296-307)
- **[verified-live]** Cloud Run: free tier for request-based billing is 2 million requests, 360,000 GB-seconds and 180,000 vCPU-seconds per month. An idle minimum instance costs $0.0000025 per vCPU-second and $0.0000025 per GiB-second at Tier 1, about $0.32 per day for 1 vCPU and 512 MiB. asia-southeast1 (Singapore) is Tier 2; us-central1 and europe-west4 are Tier 1.
  - Evidence: https://cloud.google.com/run/pricing (text saved at downloads/run_pricing.txt lines 176-189, 555-582); https://docs.cloud.google.com/free/docs/free-cloud-features
- **[verified-live]** (g) VERIFIED. "To be eligible for a Global Award, you must use at least one NASA data or resource." Partner data is welcome: "You are also highly encouraged to use data or resources from the 2026 Space Apps Space Agency Partners", and ESA is on the 2026 partner list. The challenge's own Resources tab lists Copernicus Sentinel-2.
  - Evidence: https://www.spaceappschallenge.org/resources/project-submission-guide/ (NASA Data; Space Agency Partner Data and Other References)
- **[verified-live]** Everything external must be listed: "Resources should include any code, text, and images (even if they are open source or freely available)". Terms: non-NASA, non-partner materials must be "freely and publicly available without restriction or, at a minimum, ... licensed as open source"; their licences "must be identified in the documentation"; NASA "reserves the right to remove nominations, awards, or winner status from teams that do not cite resources". Submissions may not include "Material that promotes commercial services or products".
  - Evidence: https://www.spaceappschallenge.org/resources/project-submission-guide/ ; https://www.spaceappschallenge.org/legal/ (Use of Third-Party Materials; Submissions)
- **[verified-live]** Credit lines read at source. POWER: "The data was obtained from National Aeronautics and Space Administration (NASA) Langley Research Center's Prediction Of Worldwide Energy Resources (POWER) project funded through the NASA Earth Science Division." GIBS: "We acknowledge the use of imagery provided by services from NASA's Global Imagery Browse Services (GIBS), part of NASA's Earth Science Data and Information System (ESDIS)." Sentinel: 'Contains modified Copernicus Sentinel data [Year]'. Earthdata: NASA-led mission data are CC0 unless marked otherwise, so storing derived time series is permitted.
  - Evidence: https://power.larc.nasa.gov/docs/referencing/ ; https://nasa-gibs.github.io/gibs-api-docs/ ; https://sentinels.copernicus.eu/documents/247904/690755/Sentinel_Data_Legal_Notice ; https://www.earthdata.nasa.gov/engage/open-data-services-software-policies/data-use-guidance
- **[source-read]** NASA's brand guidelines bar the NASA insignia and logotype from third-party websites and from use that implies endorsement. Text credits naming NASA as the data source are what the data-use guidance asks for.
  - Evidence: https://www.nasa.gov/nasa-brand-center/brand-guidelines/ (read through a fetch summary, not grepped in raw form)
- **[verified-live]** NASA-produced field-scale data is available without a key on the Planetary Computer STAC API already in the brief. For a test box near Kostanay: hls2-s30 (NASA LP DAAC, 30 m, starts 2020-01-01) had 67 items in June-August 2021, 25 under 20% cloud; hls2-l30 had 20 (9 clear); landsat-c2-l2 (NASA/USGS, starts 1982) had 21 (13 clear); modis-13Q1-061 (250 m NDVI and EVI, 16-day, starts 2000-02-18) had 15 composites. Sentinel-2 L2A had 72 (36 clear).
  - Evidence: scripts/pc_check.py against https://planetarycomputer.microsoft.com/api/stac/v1, bbox 63.55,53.15,63.65,53.22; HLS S30 assets include B04, B8A, B11, Fmask
- **[verified-live]** NASA GIBS serves keyless tiles for datasets the challenge names. Sample tiles over Kazakhstan returned HTTP 200: SMAP_L4_Analyzed_Root_Zone_Soil_Moisture (2021-07-02, Level6), IMERG_Precipitation_Rate (2021-07-02, Level6), MODIS_Terra_L3_NDVI_16Day (2021-06-26, Level9), HLS_S30_Nadir_BRDF_Adjusted_Reflectance (2021-07-02, Level12, 167 KB tile), BlueMarble_ShadedRelief_Bathymetry (Level8) and Reference_Labels_15m (Level13). The 2024-07-02 HLS tile was empty, so HLS tiles depend on the day's swath.
  - Evidence: https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml (1,330 layers); tile responses saved in downloads/tiles/
- **[source-read]** nasa.gov confirms the event dates: "a two-day global event on Saturday, Nov. 14 and Sunday, Nov. 15", with registration at spaceappschallenge.org. It says nothing on judging, AI or data rules; those live only on spaceappschallenge.org.
  - Evidence: https://science.nasa.gov/universe/nasa-welcomes-all-ages-experience-levels-for-space-apps-challenge/ (published 15 October 2026)
- **[verified-live]** The Submission Guide recommends a FortiGuard web-filter classification request for a newly created website so judges can open it. How FortiGuard rates *.run.app could not be checked: the lookup returned HTTP 403.
  - Evidence: https://www.spaceappschallenge.org/resources/project-submission-guide/ (Editing Your Project Submission Page); curl https://www.fortiguard.com/webfilter?q=run.app -> 403

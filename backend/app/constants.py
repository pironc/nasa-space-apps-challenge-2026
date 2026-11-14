"""Every threshold and tunable of the analysis, in one place.

All of them are indicative starting values: they were tuned on a handful of test squares in one
Kostanay tile and one climate cell, with no ground truth. Change them here, never inline."""
import os
from pathlib import Path

# ---- storage and limits -------------------------------------------------------------------------
DATA_DIR = Path(os.environ.get("DATA_DIR") or Path(__file__).resolve().parents[1] / ".data")  # cache root
SCHEMA = 1                      # FieldAnalysis.schema; a cached file with another value is rebuilt
USER_AGENT = "fieldshift/0.1"   # client name sent to outside services (never a person or a repository)
CONCURRENCY = 20                # one global limit on calls to the Planetary Computer, across all users
RETRIES = 3                     # tries per upstream call on HTTP 429/502/503/504 and timeouts
MAX_FAILED_SHARE = 0.10         # more than this share of scenes unanswered: report the upstream as down
MAX_BUILDS = 2                  # first-time field builds running at once before the API answers 429
FIELD_CACHE_HOURS = 12          # in season (1 May to 15 Oct) a cached field older than this is rebuilt
CLIMATE_CACHE_HOURS = 24        # a cached NASA POWER cell older than this is fetched again
MIN_VERTICES, MAX_VERTICES = 4, 200   # ring positions as sent (GeoJSON closes the ring, so 4 = a triangle)
MIN_HA, MAX_HA = 0.5, 5000.0    # accepted field size, hectares
EARTH_RADIUS_M = 6378137.0      # same sphere as @turf/area, so the server and the browser agree on hectares

# ---- Sentinel-2 series --------------------------------------------------------------------------
S2_FIRST_YEAR = 2018            # first season with dependable Sentinel-2 coverage here
SEASON_MONTHS = (5, 9)          # May to September: snow-free, covers sowing to harvest
CLEAR_SCL = (4, 5)              # scene classification classes counted as a clear view: vegetation, bare soil
SNOW_SCL = 11                   # class "snow or ice"; in summer it is nearly always bright cloud
OFFSET_BASELINE = 4.0           # processing baseline from which every band carries +1000 (reflectance offset)
MAX_SIZE = 512                  # statistics are computed on at most 512 x 512 pixels (same value, any field size)
MIN_CLEAR = 0.75                # accept a scene when at least 75 % of the field is clear ...
MAX_SNOW = 0.05                 # ... and under 5 % of it is flagged snow

# ---- dekad series (15 ten-day bins, 1 May to 30 Sep) ---------------------------------------------
D0, D1 = 12, 26                 # dekads of the year analysed: 12 = 1-10 May ... 26 = 21-30 Sep
SPIKE_DROP, SPIKE_WIN = 0.10, 20   # despike: drop a pass more than 0.10 NDVI below both neighbours within 20 days
MAX_GAP = 2                     # fill a gap by straight line across at most 2 empty dekads
BARE_NDVI = 0.25                # NDVI under this is bare ground
TILLED_NBR2 = 0.06              # bare ground with NBR2 under this is tilled soil, otherwise stubble or residue
GREEN = 0.45                    # NDVI from which a crop canopy is present
SOIL_BASE = 0.20                # NDVI of bare soil, subtracted before summing the season's growth
GREEN_PRE = 0.40                # already this green in May: grass, hay, winter crop or weeds, not a spring crop
FALLOW_MAX = 0.30               # 21 Jun-10 Aug maximum under this: the year reads as fallow
MIN_GREEN_DEKADS = 3            # fewer dekads at GREEN or more: ambiguous (weed flush or failed crop)
MIN_MID_DEKADS = 3              # fewer dekads with data in 21 Jun-10 Aug: land use unknown
MIN_SEASON_DEKADS = 5           # fewer dekads with data in the whole season: no verdict at all
ANNUAL_PRE_MAX = 0.30           # multi-year median May NDVI under this: the field is annual cropland
MIN_BASELINE_YEARS = 3          # other cropped years needed before a season is compared with them
MIN_BASELINE_PEAK = 0.35        # a usual peak under this is too low to compare against

# ---- verdicts ------------------------------------------------------------------------------------
BARE_RUN_DEKADS = 3             # 30 days in a row under BARE_NDVI inside 21 Jun-31 Aug: bare-soil finding
DEFICIT_WATCH = 0.90            # peak at or under 90 % of the usual peak: watch
DEFICIT_WARNING = (0.80, 0.65)  # warning: peak ratio at or under 0.80, or season-growth ratio at or under 0.65
DEFICIT_SEVERE = (0.65, 0.50)   # severe: peak ratio at or under 0.65, or season-growth ratio at or under 0.50
MIN_SHARED_DEKADS = 10          # dekads both curves must share before the season-growth ratio is used
PEAKED_DROP = 0.05              # in season: the peak counts as passed once NDVI is 0.05 under it, 2 dekads later
NDMI_DROP = (-0.15, -0.25)      # canopy moisture (NDMI) at peak against usual: supporting, strongly supporting
NDMI_DRY_MAX = 0.15             # ... and only when NDMI at peak is itself under this

# ---- MODIS long record (NASA MOD13Q1, 250 m, since 2000) -----------------------------------------
MODIS_FIRST_YEAR = 2000         # first MODIS Terra season
MODIS_WINDOW = ((6, 1), (8, 15))   # yearly peak over 16-day composites STARTING 1 Jun to 15 Aug (the next one is mostly September)
MODIS_MAX_RELIABILITY = 1.0     # use composites whose field-mean pixel reliability is 0 (good) to 1 (marginal)
MODIS_MIN_COMPOSITES = 3        # fewer usable composites in a summer: the year is unknown
MODIS_GAP_YEARS = (2025,)       # the Planetary Computer archive has no composites from 2025-06-26 to 2025-11-17
MODIS_FALLOW_PEAK = 0.41        # MODIS peak under this reads as fallow: FALLOW_MAX plus the 0.11 MODIS reads higher than Sentinel-2
MODIS_MIN_HA = 100.0            # 250 m pixels mix in the neighbours of smaller fields: no MODIS record under this

# ---- climate (NASA POWER daily, one grid cell) ---------------------------------------------------
POWER_PARAMS = "T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,GWETROOT,GWETTOP,EVLAND"   # one request per cell, default time standard
POWER_START_YEAR = 1981         # first year NASA POWER serves
CELL_LAT, CELL_LON = 0.5, 0.625   # grid cell size in degrees (about 55 x 42 km at 53 N)
NORMAL_YEARS = (1991, 2020)     # WMO standard normal period; every "percent of normal" refers to it
CLIMATE_FIRST_YEAR = 1991       # first season listed, tested for trend and counted in drought years
HOT_DAY = 30.0                  # a hot day: maximum temperature of 30 C or more
WET_DAY = 1.0                   # a day with under 1 mm of rain counts as dry (WMO dry-spell convention)
HTC_ACTIVE_T = 10.0             # the hydrothermal coefficient only counts days with a mean above 10 C
HTC_CLASSES = ((0.4, "very severe drought"), (0.6, "severe drought"), (0.8, "moderate drought"),
               (1.0, "mild drought"), (1.5, "adequate moisture"))   # upper edges; above the last: "excess moisture"
SOWING = (5, 15)                # assumed sowing date, 15 May; the crop stages below are counted from it
GDD = {"emergence": 140, "jointing": 620, "anthesis": 850, "maturity": 1600}   # degree days above 0 C (Miller et al. 2001)
FLOWER_HALF_WINDOW = 7          # flowering window: estimated anthesis plus and minus 7 days
HARVEST_WINDOW = ((8, 15), (9, 20))   # harvest weather is judged over 15 Aug to 20 Sep
AUTUMN_FROST_WINDOW = ((8, 1), (10, 31))   # first day at 0 C or below searched from 1 Aug to 31 Oct
RAIN_PRE_PCT = (50, 70)         # rain sowing-to-flowering at or under 50 % of normal: 2 points; 70 %: 1 point
HTC_PRE = (0.4, 0.6)            # hydrothermal coefficient sowing-to-flowering under 0.4: 2 points; under 0.6: 1
DRY_SPELL_DAYS = 15             # a dry spell this long before flowering, and in the top quarter of years: 1 point
GWET_DRY_PCTL = 20              # root-zone wetness in the driest fifth of years: 1 point
HEAT_FLOWER = (31.0, 5)         # 5 or more days at 31 C around flowering, and top quarter of years: 2 points
HEAT_SEVERE = (35.0, 2)         # 2 or more days at 35 C around flowering, or in grain fill and top quarter: 2 points
FROST_SEEDLING, FROST_FLOWER, FROST_FILL = -4.0, 0.0, -2.0   # damaging minimum temperature by stage (K-State C646)
WET_PCTL = (80, 80, 85)         # harvest rain, wet days and topsoil wetness percentiles: 1 point each
TOP_QUARTER = 75                # "top quarter of years" percentile
FLAG_AT = {"water_deficit": 3, "heat": 2, "frost": 2, "wet_harvest": 2}   # points needed to name a cause
HIGH_CONFIDENCE_EXTRA = 2       # this many points above the flag level: confidence "high" instead of "medium"
TREND_P = 0.05                  # Mann-Kendall p under this: the trend is called statistically clear

# ---- stress profile (0 to 1 each) ----------------------------------------------------------------
WATER_FULL_DEFICIT = 0.5        # a season at 50 % of normal May-Aug rain scores 1 for water stress
HEAT_RANGE = (15, 25)           # hot days: 15 scores 0, 15 + 25 = 40 scores 1
PROFILE_FROST = (-2.0, (5, 25), (9, 5))   # a frost year: -2 C or below between 25 May and 5 Sep

# ---- soil (ISRIC SoilGrids, presets only) --------------------------------------------------------
SOIL_TIMEOUT_S = 45             # the point query can take 20 s; give up after this and return no soil
SOIL_DEPTHS = {"0-5cm": 5, "5-15cm": 10, "15-30cm": 15}   # layers averaged to 0-30 cm, weighted by thickness

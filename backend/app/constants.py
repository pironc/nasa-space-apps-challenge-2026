"""Every threshold and tunable of the analysis, in one place.

All of them are indicative starting values: they were tuned on a handful of test squares in one
Kostanay tile and one climate cell, with no ground truth. Change them here, never inline."""
import os
from pathlib import Path

# ---- storage and limits -------------------------------------------------------------------------
DATA_DIR = Path(os.environ.get("DATA_DIR") or Path(__file__).resolve().parents[1] / ".data")  # cache root
SCHEMA = 1                      # FieldAnalysis.schema; a cached file with another value is rebuilt
RULES = 4                       # version of the analysis rules, part of every field's cache key: raise it when a rule changes
USER_AGENT = "fieldshift/0.1"   # client name sent to outside services (never a person or a repository)
CONCURRENCY = 40                # one global limit on calls to the Planetary Computer, across all users
RETRIES = 3                     # tries per upstream call on HTTP 429/502/503/504 and timeouts
MAX_FAILED_SHARE = 0.10         # more than this share of scenes unanswered: report the upstream as down
MAX_BUILDS = 6                  # first-time field builds running at once before the API answers 429 (CONCURRENCY still caps upstream load)
BUILD_TIMEOUT_S = 150           # one build may take this long in all; past it the API answers 502 and frees the slot
BUILDS_PER_HOUR = 20            # new fields one connection may build per hour (several people can share one address)
MAX_BODY_BYTES = 50_000         # a request body larger than this is refused unread (a 200-point outline is about 8 kB)
KEEP_FILES = {"fields": 2000, "climate": 100}   # newest cache files kept per folder (about 22 kB and 0.63 MB each)
FIELD_CACHE_HOURS = 12          # in season (1 May to 15 Oct) a cached field older than this is rebuilt
CLIMATE_CACHE_HOURS = 24        # a cached NASA POWER cell older than this is fetched again
MIN_VERTICES, MAX_VERTICES = 4, 200   # ring positions as sent (GeoJSON closes the ring, so 4 = a triangle)
MIN_HA, MAX_HA = 0.5, 5000.0    # accepted field size, hectares
KZ_BOX = (46.0, 40.0, 88.0, 56.0)   # west, south, east, north: a box around Kazakhstan; every rule here was written for its grain belt
MAX_SPAN_DEG = (0.5, 0.3)       # widest outline accepted, degrees of longitude and latitude (about 30 km): stops long thin strips
EARTH_RADIUS_M = 6378137.0      # same sphere as @turf/area, so the server and the browser agree on hectares

# ---- Sentinel-2 series --------------------------------------------------------------------------
S2_FIRST_YEAR = 2018            # first season with dependable Sentinel-2 coverage here
SEASON_MONTHS = (5, 9)          # May to September: snow-free, covers sowing to harvest
CLEAR_SCL = (4, 5)              # scene classification classes counted as a clear view: vegetation, bare soil
SNOW_SCL = 11                   # class "snow or ice"; in summer it is nearly always bright cloud
OFFSET_BASELINE = 4.0           # processing baseline from which every band carries +1000 (reflectance offset)
MASK_FILL = -9                  # value written where a pixel is not clear: outside the histogram range, so it drops out
HIST_BINS = 400                 # histogram of each index over -1 to 1 (0.005 wide bins); the field median is read from it
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
MIN_BASELINE_YEARS = 3          # other cropped years needed before a season is compared with them
MIN_BASELINE_PEAK = 0.35        # a usual peak under this is too low to compare against

# ---- verdicts (peak and season total are read over 1 June to 20 August only) ---------------------
BARE_RUN_DEKADS = 3             # 30 days in a row under BARE_NDVI (and tilled, see TILLED_NBR2): bare-soil finding
DEFICIT_WATCH = 0.90            # windowed peak at or under 90 % of the usual peak: watch
DEFICIT = ((0.65, "severe"), (0.80, "warning"), (DEFICIT_WATCH, "watch"))   # peak ratio at or under the edge
TOTAL_GATE = 0.90               # ... and only when the green cover summed over the window is under 90 % of usual
MIN_SHARED_DEKADS = 6           # window dekads (of 8) both curves must share before a season is judged
MIN_REAL_MID_DEKADS = 3         # dekads in 21 Jun-10 Aug that need a real (not interpolated) pass before a season is judged
PEAKED_DROP = 0.05              # in season: the peak counts as passed once NDVI is 0.05 under it, 2 dekads later
NDMI_DROP = 0.15                # canopy moisture (NDMI) at peak this far under usual: one supporting line, never a finding

# ---- MODIS long record (NASA MOD13Q1, 250 m, since 2000) -----------------------------------------
MODIS_FIRST_YEAR = 2000         # first MODIS Terra season
MODIS_WINDOW = ((6, 1), (8, 15))   # yearly peak over 16-day composites STARTING 1 Jun to 15 Aug (the next one is mostly September)
MODIS_MAX_RELIABILITY = 1.0     # use composites whose worst pixel reliability is 0 (good) or 1 (marginal)
MODIS_MIN_COMPOSITES = 4        # fewer usable composites (of 5) in a summer: the year is unknown
MODIS_GAP_YEARS = (2025,)       # the Planetary Computer archive has no composites from 2025-06-26 to 2025-11-17
MODIS_BARE_PEAK = 0.40          # before 2018 only (land use not known): a MODIS peak under this reads as a bare summer
                                # (FALLOW_MAX plus the 0.1 MODIS reads higher than Sentinel-2)
MODIS_USUAL = 0.90              # a MODIS peak at or above 90 % of the MODIS median: MODIS does not show the year as unusual
MODIS_MIN_HA = 150.0            # 250 m pixels mix in the neighbours of smaller fields: no MODIS record under this

# ---- climate (NASA POWER daily, one grid cell) ---------------------------------------------------
POWER_PARAMS = "T2M,T2M_MAX,T2M_MIN,PRECTOTCORR,GWETROOT,GWETTOP,EVLAND"   # one request per cell, default time standard
POWER_START_YEAR = 1981         # first year NASA POWER serves
CELL_LAT, CELL_LON = 0.5, 0.625   # grid cell size in degrees (about 55 x 42 km at 53 N)
NORMAL_YEARS = (1991, 2020)     # WMO standard normal period; every "percent of normal" refers to it
CLIMATE_FIRST_YEAR = 1991       # first season listed, tested for trend and counted in drought years
HOT_DAY = 30.0                  # a hot day: maximum temperature of 30 C or more
WET_DAY = 1.0                   # a day with under 1 mm of rain counts as dry (WMO dry-spell convention)
HTC_ACTIVE_T = 10.0             # the hydrothermal coefficient only counts days with a mean above 10 C
HTC_CLASSES = ((0.4, "very dry"), (0.6, "dry"), (0.8, "moderately dry"), (1.0, "slightly dry"), (1.5, "adequate"))
                                # moisture supply by upper edge; above the last: "wet". Never called a drought.
DROUGHT_PCTL = (20, 10)         # a drought by the cell's own history: May-Aug HTC at or under its 20th percentile; severe: 10th
SOWINGS = ((5, 10), (5, 20), (5, 30))   # every stage-dependent test runs for these sowing dates; the middle one is the default
GDD = {"emergence": 140, "jointing": 700, "anthesis": 1000, "maturity": 1850}   # degree days above 0 C from sowing; estimates, +/- 10 days
FLOWER_HALF_WINDOW = 7          # flowering window: estimated anthesis plus and minus 7 days
HARVEST_WINDOW = ((8, 15), (9, 20))   # harvest weather is judged over 15 Aug to 20 Sep
AUTUMN_FROST_WINDOW = ((8, 1), (10, 31))   # first day at 0 C or below searched from 1 Aug to 31 Oct
DRY_WINDOW_DAYS = 40            # water: rain in the driest 40-day window ...
DRY_STARTS = range(0, 31, 5)    # ... among windows starting 0, 5, ... 30 days after sowing, as a share of the normal for those dates
DRY_RATIO, DRY_PCTL = 0.40, 20  # flagged at or under 40 % of normal AND at or under the cell's own 20th percentile
HEAT_DAYS, HEAT_PCTL = 90, 90   # heat: hot days from sowing to sowing + 90 days, flagged at or above the cell's 90th percentile
                                # ("hot before the peak" uses the same percentile on the days from sowing to the end of the peak's ten-day bin)
FROST_SEEDLING, FROST_FLOWER, FROST_FILL = -4.0, 0.0, -2.0   # damaging minimum temperature by stage (K-State C646)
ROOT_WINDOW, ROOT_DRY_PCTL = ((5, 1), (6, 30)), 20   # modelled root-zone wetness, 1 May to 30 June mean: one evidence line when in the driest fifth
WET_PCTL = (80, 80, 85)         # harvest rain, wet days and topsoil wetness percentiles; two of the three flag a wet harvest
TREND_P = 0.05                  # Mann-Kendall p under this: the trend is called statistically clear

# ---- stress profile (0 to 1 each) ----------------------------------------------------------------
WATER_FULL_DEFICIT = 0.5        # a season at 50 % of normal May-Aug rain scores 1 for water stress
HEAT_RANGE = (15, 25)           # hot days: 15 scores 0, 15 + 25 = 40 scores 1
PROFILE_FROST = (-2.0, (5, 25), (9, 5))   # a frost year: -2 C or below between 25 May and 5 Sep

# ---- soil (ISRIC SoilGrids, presets only) --------------------------------------------------------
SOIL_TIMEOUT_S = 45             # the point query can take 20 s; give up after this and return no soil
SOIL_DEPTHS = {"0-5cm": 5, "5-15cm": 10, "15-30cm": 15}   # layers averaged to 0-30 cm, weighted by thickness

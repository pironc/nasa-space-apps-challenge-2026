const GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best"
const LEGENDS = "https://gibs.earthdata.nasa.gov/legends"

// GIBS REST tile order is {z}/{y}/{x}; the matrix-set name carries the native max zoom.
const gibs = (layer: string, date: string, level: number, ext: "jpg" | "png") =>
  `${GIBS}/${layer}/default/${date}/GoogleMapsCompatible_Level${level}/{z}/{y}/{x}.${ext}`

export const BASEMAP = "https://tiles.openfreemap.org/styles/positron"

export type LayerId =
  "satellite" | "ndvi" | "truecolor" | "soil" | "rain" | "scene"

export type MapLayer = {
  id: LayerId
  label: string
  source: string
  hint: string
  /** Tile URL for a date. The field image is built from a Sentinel-2 scene instead (sceneTiles). */
  tiles: (date: string) => string
  maxzoom: number
  /** Hidden from this zoom in: coarse regional layers would cover the field imagery. */
  maxView?: number
  legend?: string
  /** Plain-language reading of the colour scale. */
  scale?: string
  attribution: string
  /** First year the layer has data for. */
  since: number
  /** Changes every day (the time slider then steps day by day while playing). */
  daily?: boolean
  on: boolean
  opacity: number
}

const GIBS_CREDIT = "Imagery: NASA GIBS / ESDIS"
/** Regional layers stop here; closer in, the satellite images of the field take over. */
const REGIONAL_MAX_VIEW = 11

// Array order is draw order, bottom to top: the yearly mosaic is the base, regional NASA layers sit
// above it (and stop at field zoom), and the dated image of the selected field is on top.
export const LAYERS: MapLayer[] = [
  {
    id: "satellite",
    label: "Satellite mosaic",
    source: "Sentinel-2 cloudless, yearly",
    hint: "A cloud-free summer mosaic of the year: the base map, sharp enough to see field edges.",
    // One mosaic per year exists for 2017 to 2025.
    tiles: (d) =>
      `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-${Math.min(2025, Math.max(2017, +d.slice(0, 4)))}_3857/default/g/{z}/{y}/{x}.jpg`,
    maxzoom: 14,
    attribution:
      '<a href="https://cloudless.eox.at">EOxCloudless</a> by EOX (Contains modified Copernicus Sentinel data)',
    since: 2017,
    on: true,
    opacity: 1,
  },
  {
    id: "ndvi",
    label: "Vegetation (NDVI)",
    source: "NASA MODIS Terra, 16-day",
    hint: "Regional greenness at 250 m, hidden when zoomed in on a field. It reads higher than the field chart (Sentinel-2).",
    tiles: (d) => gibs("MODIS_Terra_L3_NDVI_16Day", snapDate(d), 9, "png"),
    maxzoom: 9,
    maxView: REGIONAL_MAX_VIEW,
    legend: `${LEGENDS}/MODIS_L3_NDVI_H.svg`,
    scale:
      "Brown is bare or dry ground (below 0.3), darker green is denser green cover (up to 1).",
    attribution: GIBS_CREDIT,
    since: 2001,
    on: true,
    opacity: 0.85,
  },
  {
    id: "truecolor",
    label: "True colour",
    source: "NASA MODIS Terra, daily",
    hint: "What the region looked like from orbit that day, clouds included (250 m).",
    tiles: (d) =>
      gibs("MODIS_Terra_CorrectedReflectance_TrueColor", d, 9, "jpg"),
    maxzoom: 9,
    maxView: REGIONAL_MAX_VIEW,
    attribution: GIBS_CREDIT,
    since: 2001,
    daily: true,
    on: false,
    opacity: 1,
  },
  {
    id: "soil",
    label: "Modelled root-zone moisture, 9 km (NASA SMAP)",
    source: "Daily model snapshot",
    hint: "Modelled soil wetness for the surrounding area (top metre, about 9 km), not your field.",
    tiles: (d) => gibs("SMAP_L4_Analyzed_Root_Zone_Soil_Moisture", d, 6, "png"),
    maxzoom: 6,
    maxView: REGIONAL_MAX_VIEW,
    legend: `${LEGENDS}/SMAP_Analyzed_Soil_Moisture_H.svg`,
    scale:
      "Orange is dry, green to blue is wet (0 to 0.7 m³ of water per m³ of soil).",
    attribution: GIBS_CREDIT,
    since: 2016,
    daily: true,
    on: false,
    opacity: 0.7,
  },
  {
    id: "rain",
    label: "Rain rate on this day (NASA GPM IMERG)",
    source: "Daily, about 10 km",
    hint: "A daily mean rain rate, not a rain total.",
    tiles: (d) => gibs("IMERG_Precipitation_Rate", d, 6, "png"),
    maxzoom: 6,
    maxView: REGIONAL_MAX_VIEW,
    legend: `${LEGENDS}/GPM_Precipitation_Rate_H.svg`,
    scale:
      "Green is light rain, red is heavy (0.1 to 53 mm per hour). Purple tones are snow.",
    attribution: GIBS_CREDIT,
    since: 2001,
    daily: true,
    on: false,
    opacity: 0.7,
  },
  {
    id: "scene",
    label: "Field image of the day",
    source: "Sentinel-2, 10 m, when clear",
    hint: "The selected field as Sentinel-2 saw it on the latest clear pass before this date. Zoom in on a field to see it.",
    tiles: () => "",
    maxzoom: 15,
    attribution:
      "Contains modified Copernicus Sentinel data, via Microsoft Planetary Computer",
    since: 2018,
    on: true,
    opacity: 1,
  },
]

/** Natural-colour tiles of one Sentinel-2 scene, rendered by the Planetary Computer (cached for an hour). */
export const sceneTiles = (item: string) =>
  "https://planetarycomputer.microsoft.com/api/data/v1/item/tiles/WebMercatorQuad/{z}/{x}/{y}@1x.png?" +
  new URLSearchParams({
    collection: "sentinel-2-l2a",
    item,
    assets: "visual",
    asset_bidx: "visual|1,2,3",
    nodata: "0",
  })

/** The sidebar's order: the field image first, then the regional layers, the base mosaic last. */
export const PANEL_ORDER = [...LAYERS].reverse()

export type LayerState = Record<LayerId, { on: boolean; opacity: number }>

export const defaultLayerState = () =>
  Object.fromEntries(
    LAYERS.map((l) => [l.id, { on: l.on, opacity: l.opacity }])
  ) as LayerState

// --- Time axis -------------------------------------------------------------
// The slider moves day by day. Each layer shows what exists for that day: the daily NASA layers
// change every day, the vegetation composite every 16 days (periods restart on 1 January), and
// the field image on each clear Sentinel-2 pass.

export const FIRST_YEAR = 2001
/** Last 16-day NDVI composite published by GIBS when this was written. */
const LAST_NDVI = "2026-10-16"
const DAY = 86_400_000
const iso = (t: number) => new Date(t).toISOString().slice(0, 10)
/** Daily NASA layers are published a day or two late. */
export const LAST_DAY = iso(Date.now() - 2 * DAY)
export const LAST_YEAR = +LAST_DAY.slice(0, 4)
export const YEARS = Array.from(
  { length: LAST_YEAR - FIRST_YEAR + 1 },
  (_, i) => LAST_YEAR - i
)

export function periodDates(year: number): string[] {
  const jan1 = Date.UTC(year, 0, 1)
  return Array.from({ length: 23 }, (_, k) => iso(jan1 + k * 16 * DAY)).filter(
    (d) => d <= LAST_NDVI
  )
}

/** Snap any ISO date to the 16-day vegetation period that contains it. */
export function snapDate(day: string): string {
  const year = Math.min(
    +LAST_NDVI.slice(0, 4),
    Math.max(FIRST_YEAR, +day.slice(0, 4))
  )
  const dates = periodDates(year)
  return dates.findLast((d) => d <= day) ?? dates[0]
}

/** Mid-July of a good harvest year: the grain belt at full canopy. */
export const DEFAULT_DATE = "2024-07-11"

/** Any input to a valid day between 1 Jan 2001 and the latest published day. */
export function clampDay(day: string | null | undefined): string {
  const t = Date.parse(day ?? "")
  if (Number.isNaN(t)) return DEFAULT_DATE
  return iso(
    Math.min(Date.parse(LAST_DAY), Math.max(Date.UTC(FIRST_YEAR, 0, 1), t))
  )
}

/** Days of a year that can be shown (the current year stops at the latest published day). */
export const daysIn = (year: number) =>
  Math.round(
    (Math.min(Date.UTC(year + 1, 0, 1), Date.parse(LAST_DAY) + DAY) -
      Date.UTC(year, 0, 1)) /
      DAY
  )
export const dayIndex = (day: string) =>
  Math.round((Date.parse(day) - Date.UTC(+day.slice(0, 4), 0, 1)) / DAY)
export const dayOf = (year: number, index: number) =>
  iso(
    Date.UTC(year, 0, 1) + Math.max(0, Math.min(index, daysIn(year) - 1)) * DAY
  )
export const addDays = (day: string, n: number) =>
  iso(Date.parse(day) + n * DAY)

export const formatDate = (day: string) =>
  new Date(day + "T00:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })

/** Run with `npm run check:data`. */
export function selfCheck() {
  const ids = LAYERS.map((l) => l.id).join()
  // the mosaic is the base; regional layers above it; the field image on top
  if (ids !== "satellite,ndvi,truecolor,soil,rain,scene")
    throw new Error(`draw order is ${ids}`)
  const on = LAYERS.filter((l) => l.on)
    .map((l) => l.id)
    .join()
  if (on !== "satellite,ndvi,scene") throw new Error(`on by default: ${on}`)
  if (
    snapDate("2021-07-20") !== "2021-07-12" ||
    snapDate("2021-01-01") !== "2021-01-01"
  )
    throw new Error("snapDate")
  if (
    dayIndex("2021-01-01") !== 0 ||
    dayOf(2021, 364) !== "2021-12-31" ||
    daysIn(2020) !== 366
  )
    throw new Error("day axis")
  if (
    clampDay("1990-05-01") !== "2001-01-01" ||
    clampDay("nonsense") !== DEFAULT_DATE
  )
    throw new Error("clampDay")
  if (!sceneTiles("X").includes("item=X") || sceneTiles("X").includes("+"))
    throw new Error("sceneTiles")
  console.log("layers self-check passed")
}

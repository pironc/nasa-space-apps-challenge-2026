const GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best"
const LEGENDS = "https://gibs.earthdata.nasa.gov/legends"

// GIBS REST tile order is {z}/{y}/{x}; the matrix-set name carries the native max zoom.
const gibs = (layer: string, date: string, level: number, ext: "jpg" | "png") =>
  `${GIBS}/${layer}/default/${date}/GoogleMapsCompatible_Level${level}/{z}/{y}/{x}.${ext}`

export const BASEMAP = "https://tiles.openfreemap.org/styles/positron"

export type LayerId = "satellite" | "truecolor" | "soil" | "rain" | "ndvi"

export type MapLayer = {
  id: LayerId
  label: string
  source: string
  hint: string
  tiles: (date: string) => string
  maxzoom: number
  legend?: string
  /** Plain-language reading of the colour scale. */
  scale?: string
  attribution: string
  /** First year the layer has data for. */
  since: number
  on: boolean
  opacity: number
}

const GIBS_CREDIT = "Imagery: NASA GIBS / ESDIS"

// Array order is draw order, bottom to top. Vegetation is on by default and nearly opaque, so it sits
// at the bottom: whatever else is switched on shows above it.
export const LAYERS: MapLayer[] = [
  {
    id: "ndvi",
    label: "Vegetation (NDVI)",
    source: "NASA MODIS Terra, 16-day",
    hint: "MODIS greenness (250 m) reads higher than the field chart (Sentinel-2).",
    tiles: (d) => gibs("MODIS_Terra_L3_NDVI_16Day", d, 9, "png"),
    maxzoom: 9,
    legend: `${LEGENDS}/MODIS_L3_NDVI_H.svg`,
    scale: "Brown is bare or dry ground (below 0.3), darker green is denser green cover (up to 1).",
    attribution: GIBS_CREDIT,
    since: 2001,
    on: true,
    opacity: 0.85,
  },
  {
    id: "satellite",
    label: "Satellite mosaic",
    source: "Sentinel-2 cloudless, yearly",
    hint: "Cloud-free summer mosaic of the year, sharp enough to see field edges.",
    // One mosaic per year exists for 2017 to 2025.
    tiles: (d) =>
      `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-${Math.min(2025, Math.max(2017, +d.slice(0, 4)))}_3857/default/g/{z}/{y}/{x}.jpg`,
    maxzoom: 14,
    attribution:
      '<a href="https://cloudless.eox.at">EOxCloudless</a> by EOX (Contains modified Copernicus Sentinel data)',
    since: 2017,
    on: false,
    opacity: 1,
  },
  {
    id: "truecolor",
    label: "True colour",
    source: "NASA MODIS Terra, daily",
    hint: "What the land looked like from orbit that day, clouds included.",
    tiles: (d) => gibs("MODIS_Terra_CorrectedReflectance_TrueColor", d, 9, "jpg"),
    maxzoom: 9,
    attribution: GIBS_CREDIT,
    since: 2001,
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
    legend: `${LEGENDS}/SMAP_Analyzed_Soil_Moisture_H.svg`,
    scale: "Orange is dry, green to blue is wet (0 to 0.7 m³ of water per m³ of soil).",
    attribution: GIBS_CREDIT,
    since: 2016,
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
    legend: `${LEGENDS}/GPM_Precipitation_Rate_H.svg`,
    scale: "Green is light rain, red is heavy (0.1 to 53 mm per hour). Purple tones are snow.",
    attribution: GIBS_CREDIT,
    since: 2001,
    on: false,
    opacity: 0.7,
  },
]

/** The sidebar's order: vegetation, the layer that is on by default, then the rest from the top of the stack down. */
export const PANEL_ORDER = [LAYERS[0], ...LAYERS.slice(1).reverse()]

export type LayerState = Record<LayerId, { on: boolean; opacity: number }>

export const defaultLayerState = () =>
  Object.fromEntries(LAYERS.map((l) => [l.id, { on: l.on, opacity: l.opacity }])) as LayerState

// --- Time axis -------------------------------------------------------------
// The 16-day NDVI composites restart on 1 January every year, so the slider
// steps through period starts within one year rather than adding 16 days.

export const FIRST_YEAR = 2001
/** Last 16-day NDVI composite published by GIBS when this was written. */
const LAST_DATE = "2026-10-16"
export const LAST_YEAR = +LAST_DATE.slice(0, 4)
export const YEARS = Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, i) => LAST_YEAR - i)

const DAY = 86_400_000

export function periodDates(year: number): string[] {
  const jan1 = Date.UTC(year, 0, 1)
  return Array.from({ length: 23 }, (_, k) => new Date(jan1 + k * 16 * DAY).toISOString().slice(0, 10)).filter(
    (d) => d <= LAST_DATE
  )
}

/** Snap any ISO date to the 16-day period that contains it. */
export function snapDate(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return DEFAULT_DATE
  const year = Math.min(LAST_YEAR, Math.max(FIRST_YEAR, new Date(t).getUTCFullYear()))
  const dates = periodDates(year)
  const clamped = new Date(Date.UTC(year, new Date(t).getUTCMonth(), new Date(t).getUTCDate())).toISOString().slice(0, 10)
  return dates.findLast((d) => d <= clamped) ?? dates[0]
}

/** Mid-July of a good harvest year: the grain belt at full canopy. */
export const DEFAULT_DATE = "2024-07-11"

export const formatDate = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })

/** Run with `npm run check:data`. */
export function selfCheck() {
  const ids = LAYERS.map((l) => l.id).join()
  // vegetation draws below every other overlay, so switching one on is always visible
  if (ids !== "ndvi,satellite,truecolor,soil,rain") throw new Error(`draw order is ${ids}`)
  const panel = PANEL_ORDER.map((l) => l.id).join()
  if (panel !== "ndvi,rain,soil,truecolor,satellite") throw new Error(`panel order is ${panel}`)
  if (LAYERS.filter((l) => l.on).map((l) => l.id).join() !== "ndvi") throw new Error("only vegetation is on by default")
  console.log("layers self-check passed")
}

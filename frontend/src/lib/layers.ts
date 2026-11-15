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
  legend?: string
  /** Plain-language reading of the colour scale. */
  scale?: string
  attribution: string
  /** First year the layer has data for. */
  since: number
  /** Changes every day. */
  daily?: boolean
  /** A composite published every 8 days: the map fades from one to the next as the days pass. */
  period?: boolean
  on: boolean
  opacity: number
}

const GIBS_CREDIT = "Imagery: NASA GIBS / ESDIS"

// Array order is draw order, bottom to top: the yearly mosaic is the base, regional NASA layers sit
// above it, and the dated Sentinel-2 image around the selected field is on top.
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
    source: "NASA MODIS Terra and Aqua, every 8 days",
    hint: "Greenness at 250 m, the best of 16 days of passes, so clouds are left out. Terra and Aqua take turns, so a new picture comes every 8 days. It reads higher than the field chart (Sentinel-2).",
    tiles: (d) => {
      const p = snapDate(d)
      return gibs(
        `MODIS_${isAqua(p) ? "Aqua" : "Terra"}_L3_NDVI_16Day`,
        p,
        9,
        "png"
      )
    },
    period: true,
    maxzoom: 9,
    legend: `${LEGENDS}/MODIS_L3_NDVI_H.svg`,
    scale:
      "Brown is bare or dry ground (below 0.3), darker green is denser green cover (up to 1).",
    attribution: GIBS_CREDIT,
    since: 2001,
    on: false,
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
    label: "Satellite image of the day",
    source: "Sentinel-2, 10 m, when clear",
    hint: "The area around the selected field as Sentinel-2 saw it, at 10 m, fading from one clear pass over the field to the next (every 2 to 5 days in the growing season). Zoom in to see it.",
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

/** The image to show on a day: one clear pass `a` at full strength, the next pass `b` over it at `t` (0 to 1). */
export type Blend = { a: string; b: string | null; t: number }

/** No fading across gaps longer than this: the ground can change too much between two passes. */
const MAX_GAP_DAYS = 30

/**
 * The passes to show on a day: the latest on or before it, faded towards the next one in proportion
 * to the days between them. Null when no pass is close enough.
 */
export function sceneBlend(dates: string[], day: string): Blend | null {
  const i = dates.findLastIndex((d) => d <= day)
  if (i < 0) return null
  const a = dates[i]
  const next = dates[i + 1] ?? null
  const span = next ? (Date.parse(next) - Date.parse(a)) / DAY : Infinity
  const since = (Date.parse(day) - Date.parse(a)) / DAY
  if (span > MAX_GAP_DAYS)
    return since <= MAX_GAP_DAYS ? { a, b: null, t: 0 } : null
  return { a, b: next, t: since / span }
}

/** The map's main view, picked on the map: the Sentinel-2 image of the day, or one NASA layer, over the yearly mosaic. */
export const VIEWS = [
  { id: "imagery", label: "Imagery", short: "Imagery", layer: null },
  { id: "vegetation", label: "Vegetation", short: "Vegetation", layer: "ndvi" },
  {
    id: "truecolor",
    label: "True colour",
    short: "Colour",
    layer: "truecolor",
  },
  { id: "soil", label: "Soil moisture", short: "Soil", layer: "soil" },
  { id: "rain", label: "Rain", short: "Rain", layer: "rain" },
] as const satisfies {
  id: string
  label: string
  /** For a phone-width map. */
  short: string
  layer: LayerId | null
}[]
const DATED: LayerId[] = ["scene", "ndvi", "truecolor", "soil", "rain"]
const viewLayer = (v: (typeof VIEWS)[number]) => v.layer ?? "scene"

/** The view the layer switches add up to, or "" when they match none (set by hand in the sidebar). */
export const viewOf = (s: LayerState) => {
  const on = DATED.filter((id) => s[id].on)
  return (
    (on.length === 1 && VIEWS.find((v) => viewLayer(v) === on[0])?.id) || ""
  )
}

/** Layer switches for a view: that one layer over the mosaic, every other dated layer off. */
export const withView = (s: LayerState, view: string): LayerState => {
  const v = VIEWS.find((v) => v.id === view)
  const next = { ...s, satellite: { ...s.satellite, on: true } }
  for (const id of DATED)
    next[id] = { ...s[id], on: !!v && id === viewLayer(v) }
  return next
}

export type LayerState = Record<LayerId, { on: boolean; opacity: number }>

/** The sidebar's order: the field image first, then the regional layers, the base mosaic last. */
export const PANEL_ORDER = [...LAYERS].reverse()

export const defaultLayerState = () =>
  Object.fromEntries(
    LAYERS.map((l) => [l.id, { on: l.on, opacity: l.opacity }])
  ) as LayerState

// --- Time axis -------------------------------------------------------------
// The slider moves day by day. Each layer shows what exists for that day: the daily NASA layers
// change every day, the vegetation composites every 8 days, and the Sentinel-2 image on each clear
// pass. MODIS vegetation composites span 16 days and restart on 1 January: Terra's start on days
// 1, 17, 33..., Aqua's (from 4 July 2002) on days 9, 25, 41..., so together a new one starts every 8 days.

export const FIRST_YEAR = 2001
/** Last vegetation composite (Aqua) published by GIBS when this was written. */
const LAST_NDVI = "2026-10-24"
const FIRST_AQUA = "2002-07-04"
const DAY = 86_400_000
const iso = (t: number) => new Date(t).toISOString().slice(0, 10)
/** Daily NASA layers are published a day or two late. */
export const LAST_DAY = iso(Date.now() - 2 * DAY)
export const LAST_YEAR = +LAST_DAY.slice(0, 4)
export const YEARS = Array.from(
  { length: LAST_YEAR - FIRST_YEAR + 1 },
  (_, i) => LAST_YEAR - i
)

/** Start dates of the year's vegetation composites, Terra and Aqua interleaved, 8 days apart. */
export function periodDates(year: number): string[] {
  const jan1 = Date.UTC(year, 0, 1)
  return Array.from({ length: 46 }, (_, k) => iso(jan1 + k * 8 * DAY)).filter(
    (d) => d <= LAST_NDVI && (!isAqua(d) || d >= FIRST_AQUA)
  )
}

/** Composites starting on days 9, 25, 41... of the year are Aqua's. */
const isAqua = (d: string) => dayIndex(d) % 16 === 8

/** Snap any ISO date to the latest vegetation composite starting on or before it. */
export function snapDate(day: string): string {
  const year = Math.min(
    +LAST_NDVI.slice(0, 4),
    Math.max(FIRST_YEAR, +day.slice(0, 4))
  )
  const dates = periodDates(year)
  return dates.findLast((d) => d <= day) ?? dates[0]
}

/** The vegetation periods around a day: the one it falls in, the next, the one after, and how far into the first it is. */
export function periodBlend(day: string) {
  const a = snapDate(day)
  const following = (p: string) => {
    const y = +p.slice(0, 4)
    return periodDates(y).find((x) => x > p) ?? `${y + 1}-01-01`
  }
  const b = following(a)
  const c = following(b)
  return {
    a,
    b,
    c,
    t: Math.min(
      1,
      (Date.parse(day) - Date.parse(a)) / (Date.parse(b) - Date.parse(a))
    ),
  }
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
  if (on !== "satellite,scene") throw new Error(`on by default: ${on}`)
  if (
    snapDate("2021-07-19") !== "2021-07-12" ||
    snapDate("2021-07-20") !== "2021-07-20" ||
    snapDate("2021-01-01") !== "2021-01-01" ||
    snapDate("2002-01-12") !== "2002-01-01" // no Aqua before July 2002
  )
    throw new Error("snapDate")
  const ndvi = LAYERS.find((l) => l.id === "ndvi")!
  if (
    !ndvi
      .tiles("2021-07-12")
      .includes("MODIS_Terra_L3_NDVI_16Day/default/2021-07-12")
  )
    throw new Error("Terra composite")
  if (
    !ndvi
      .tiles("2021-07-23")
      .includes("MODIS_Aqua_L3_NDVI_16Day/default/2021-07-20")
  )
    throw new Error("Aqua composite")
  if (
    periodDates(2021).length !== 46 ||
    periodDates(2021).at(-1) !== "2021-12-27"
  )
    throw new Error("composites per year")
  const pb = periodBlend("2021-07-24")
  if (
    pb.a !== "2021-07-20" ||
    pb.b !== "2021-07-28" ||
    pb.c !== "2021-08-05" ||
    pb.t !== 0.5
  )
    throw new Error("periodBlend")
  if (periodBlend("2021-12-29").b !== "2022-01-01")
    throw new Error("periodBlend across the year")
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
  const dates = ["2021-07-10", "2021-07-20", "2021-09-30"]
  const at = (d: string) => JSON.stringify(sceneBlend(dates, d))
  if (at("2021-07-01") !== "null") throw new Error("before the first pass")
  if (
    at("2021-07-15") !==
    JSON.stringify({ a: "2021-07-10", b: "2021-07-20", t: 0.5 })
  )
    throw new Error("halfway blend")
  if (at("2021-07-25") !== JSON.stringify({ a: "2021-07-20", b: null, t: 0 }))
    throw new Error("no blend over a long gap")
  if (at("2021-09-01") !== "null") throw new Error("too old to show")
  const base = defaultLayerState()
  if (viewOf(base) !== "imagery") throw new Error("default view")
  const rain = withView(base, "rain")
  if (viewOf(rain) !== "rain" || rain.scene.on || !rain.satellite.on)
    throw new Error("withView")
  if (viewOf({ ...rain, ndvi: { on: true, opacity: 1 } }) !== "")
    throw new Error("mixed layers match no view")
  console.log("layers self-check passed")
}

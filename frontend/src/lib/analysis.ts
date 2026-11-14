// The contract between the Python analysis (backend/) and the UI.
// The backend writes this JSON for preset fields (frontend/public/presets/<id>.json)
// and returns the same shape from POST /api/analyse for a freshly drawn field.
import type { Polygon } from "geojson"

import type { RotationId } from "@/lib/fields"

export type LandUse = "cropped" | "fallow" | "ambiguous" | "early_green" | "unknown"
export type Severity = "info" | "watch" | "warning" | "severe"

/** A finding about one finished season. Never a live notification. */
export type Verdict = {
  type: "VEG_DEFICIT" | "LOW_CANOPY_MOISTURE" | "BARE_SOIL" | "INSUFFICIENT_DATA" | "NO_BASELINE"
  severity: Severity
  /** Short plain-language headline, e.g. "Peak greenness well below this field's normal". */
  title: string
  /** One sentence carrying the numbers behind it. */
  detail: string
}

export type Season = {
  year: number
  /** 15 ten-day values, 1 May to 30 Sep: field mean of cloud-free pixels, null where no clear pass. */
  ndvi: (number | null)[]
  ndmi: (number | null)[]
  /** Accepted satellite passes per ten-day bin. */
  obs: number[]
  /** Inferred from the curve alone. Fallow and failed crop can look alike. */
  use: LandUse
  peak: number | null
  /** Index into `ndvi`. */
  peakDekad: number | null
  verdicts: Verdict[]
}

/** The field's own normal, from its other cropped years (Sentinel-2). */
export type Baseline = {
  years: number[]
  median: (number | null)[]
  p25: (number | null)[]
  p75: (number | null)[]
  peakMedian: number
}

/** NASA MODIS 250 m, June to August peak NDVI per year since 2000. Compare MODIS only with MODIS. */
export type ModisYear = { year: number; peak: number | null; use: "cropped" | "fallow" | "unknown" }

export type Cause = {
  type: "water_deficit" | "heat" | "frost" | "wet_harvest"
  confidence: "low" | "medium" | "high"
  /** Plain-language evidence lines with numbers. */
  evidence: string[]
}

export type ClimateSeason = {
  year: number
  /** mm, and percent of the 1991 to 2020 mean. */
  rainMayAug: number
  rainMayAugPct: number
  /** Preceding October to April precipitation (mostly snow), mm and percent of normal. */
  rainOctApr: number
  rainOctAprPct: number
  /** Days with maximum temperature of 30 °C or more, May to August. */
  hotDays30: number
  /** Selyaninov hydrothermal coefficient, May to August. Below 0.6 is severe drought. */
  htc: number
  htcClass: string
  tmaxPeak: number
  tmaxPeakDate: string
  longestDrySpell: number
  firstAutumnFrost: string | null
  causes: Cause[]
}

/** 0 to 1 each: how often and how hard this location is stressed, from the whole climate record. */
export type StressProfile = {
  rainMeanMm: number
  water: number
  heat: number
  frost: number
  /** Share of observed seasons that were bare or fallow. */
  bare: number
  years: [number, number]
}

export type FieldAnalysis = {
  schema: 1
  id: string
  generatedAt: string
  field: { areaHa: number; centre: [number, number] }
  /** Labels for the 15 ten-day bins, e.g. "1 May". */
  dekads: string[]
  seasons: Season[]
  baseline: Baseline | null
  modis: { years: ModisYear[]; peakMedian: number; note: string } | null
  climate: {
    /** NASA POWER grid cell centre; about 55 x 42 km, so this is regional weather. */
    cell: { lat: number; lon: number }
    normals: { rainMayAug: number; rainOctApr: number; hotDays30: number; htc: number }
    seasons: ClimateSeason[]
    /** Seasons since 1991 flagged as water deficit. */
    droughtYears: number[]
    trendNote: string
  }
  profile: StressProfile
  /** Modelled soil (ISRIC SoilGrids, 250 m). Not a field test. Presets only. */
  soil: { clayPct: number; sandPct: number; ph: number; source: string } | null
}

export type Preset = {
  id: string
  name: string
  region: string
  note: string
  rotation: RotationId
  areaHa: number
  geometry: Polygon
  /** [stressed year, good year] to open the demo on. */
  demoYears: [number, number]
}

// --- Rotation comparison (computed in the browser, see lib/rotation.ts) ------

/** Farmer priorities, 0 to 1 each. */
export type Priorities = { water: number; soil: number; income: number }

export type Indicator = {
  key: "climateFit" | "soil" | "pestBreak" | "market" | "productivity"
  label: string
  /** 0 to 1, relative. Never a yield or price forecast. */
  value: number
  level: "low" | "medium" | "high"
}

export type Strategy = {
  kind: "baseline" | "water" | "soil"
  title: string
  /** Crop ids, one per year of the rotation. */
  rotation: string[]
  /** Human-readable, e.g. "Wheat, flax, wheat, barley". */
  rotationLabel: string
  indicators: Indicator[]
  why: string[]
  evidence: string[]
  benefits: string[]
  /** What satellites cannot see. */
  gaps: string[]
  /** Risks a local farmer or agronomist must review. */
  localReview: string[]
  /** Set when the runner-up scored within a whisker: the choice is not clear-cut. */
  closeCall: string | null
}

export type StrategyInput = {
  analysis: FieldAnalysis
  declared: RotationId
  priorities: Priorities
  /** 0 = the climate as observed, 1 = markedly drier and hotter. A what-if, not a forecast. */
  drier: number
}

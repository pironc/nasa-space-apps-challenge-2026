// The contract between the Python analysis (backend/) and the UI.
// The backend writes this JSON for preset fields (frontend/public/presets/<id>.json)
// and returns the same shape from POST /api/analyse for a freshly drawn field.
import type { Polygon } from "geojson"

import type { RotationId } from "@/lib/fields"

export type LandUse = "cropped" | "fallow" | "ambiguous" | "early_green" | "unknown"
export type Severity = "info" | "watch" | "warning" | "severe"

/** A finding about one finished season. Never a live notification. */
export type Verdict = {
  /**
   * VEG_DEFICIT and BARE_SOIL are findings. LAND_USE_UNCLEAR asks the user whether a low year was a
   * failed crop or fallow (severity info, no judgement). NOTE is an explanatory line (severity info).
   */
  type: "VEG_DEFICIT" | "BARE_SOIL" | "LAND_USE_UNCLEAR" | "NOTE" | "INSUFFICIENT_DATA" | "NO_BASELINE"
  severity: Severity
  /** Short plain-language headline, e.g. "Peak greenness well below this field's normal". */
  title: string
  /** One sentence carrying the numbers behind it. */
  detail: string
}

export type Season = {
  year: number
  /** 15 ten-day values, 1 May to 30 Sep: field median of cloud-free pixels, null where no clear pass. */
  ndvi: (number | null)[]
  ndmi: (number | null)[]
  /** Accepted satellite passes per ten-day bin. */
  obs: number[]
  /** Inferred from the curve alone. Fallow and failed crop can look alike. */
  use: LandUse
  /** Land use declared by the field's owner (presets ship one where the curve is unclear). Wins over `use`. */
  declared: "crop" | "fallow" | null
  /** Highest NDVI between 1 June and 20 August. */
  peak: number | null
  /** Index into `ndvi`. */
  peakDekad: number | null
  verdicts: Verdict[]
  /**
   * How the regional weather record relates to this season's greenness, in fixed cautious wording.
   * Null when there is nothing to say (no deficit and no weather flag).
   */
  explanation: string | null
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
  /** False when the flag appears for only some plausible sowing dates: show the numbers, not a cause. */
  robust: boolean
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
  /** Selyaninov hydrothermal coefficient, May to August: rain set against heat. Around 1 is enough moisture. */
  htc: number
  /** Moisture supply class: very dry, dry, moderately dry, slightly dry, adequate, wet. */
  htcClass: string
  /** Rank among all seasons in the record, 1 = driest. */
  htcRank: number
  htcRankOf: number
  /** A drought only by this cell's own history: HTC at or below its 20th percentile (severe: 10th). */
  drought: "none" | "drought" | "severe"
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
    /** Seasons since 1991 with `drought` other than "none". */
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
  /** Year to land use, for seasons the curve cannot classify on its own. */
  declaredUse: Record<string, "crop" | "fallow">
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
  /** How well this rotation is supported: "Local rotation trial", "Each crop trialled locally; this sequence is not" or "Judgement". */
  evidenceGrade: string
  /** 0 to 1: how well this option fits the priorities the farmer set. Moves with the sliders. */
  priorityFit: number
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

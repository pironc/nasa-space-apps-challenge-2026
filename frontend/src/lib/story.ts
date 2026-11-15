// Plain sentences for the panel, and the map view that shows each one's evidence.
import type {
  ClimateSeason,
  FieldAnalysis,
  Season,
  StressProfile,
} from "./analysis.ts"
import { landUse, worstSeverity, type Declared } from "./data.ts"
import { stress } from "./rotation.ts"

const DAY = 86_400_000
const iso = (t: number) => new Date(t).toISOString().slice(0, 10)
const day = (d: string) =>
  new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })

/** First day of a ten-day bin: bins run 1, 11 and 21 of each month from 1 May. */
export const binStart = (year: number, i: number) =>
  iso(Date.UTC(year, 4 + Math.floor(i / 3), 1 + 10 * (i % 3)))

/** Findings with a judgement; a question to the user and a note are not. */
const findings = (s: Pick<Season, "verdicts">) =>
  s.verdicts.filter((v) => v.type !== "LAND_USE_UNCLEAR" && v.type !== "NOTE")

/** The season's main finding in a few words, or what stands in for one. */
export function growthWords(s: Season, answer?: Declared | null, use?: string) {
  const f = findings(s)
  const top = f.find((v) => v.severity === worstSeverity({ verdicts: f }))
  if (top) return top.title
  if (s.verdicts.some((v) => v.type === "LAND_USE_UNCLEAR") && !answer)
    return "Crop or fallow? Your answer needed"
  if (use === "Fallow") return "Left fallow, not judged"
  return s.peak == null ? "No clear peak seen" : "Grew within its usual range"
}

/** The season's weather in a few words. */
export function weatherWords(c: ClimateSeason) {
  const parts = [`rain ${c.rainMayAugPct}% of normal`]
  if (c.drought !== "none")
    parts.unshift(c.drought === "severe" ? "Severe drought" : "Drought")
  if (c.hotDays30 >= 20) parts.push(`${c.hotDays30} days at 30 °C or more`)
  const s = parts.join(", ")
  return s[0].toUpperCase() + s.slice(1)
}

/** One line per season, oldest first, for the field's timeline. */
export function timeline(
  analysis: FieldAnalysis,
  answers: Record<string, Declared>,
  demo: boolean
) {
  return analysis.seasons.map((s) => {
    const c = analysis.climate.seasons.find((x) => x.year === s.year)
    const use = landUse(s, answers[s.year], demo).label
    return {
      year: s.year,
      use,
      growth: growthWords(s, answers[s.year], use),
      weather: c ? weatherWords(c) : null,
      worst: worstSeverity({ verdicts: findings(s) }),
    }
  })
}

/** The whole record in one or two sentences. */
export function storyHeadline(
  analysis: FieldAnalysis,
  answers: Record<string, Declared>,
  demo: boolean
) {
  const rows = timeline(analysis, answers, demo)
  if (!rows.length) return "No season of this field could be read from space."
  const span = `${rows[0].year} to ${rows.at(-1)!.year}`
  const poor = rows.filter(
    (r) => r.worst && r.worst !== "info" && r.use !== "Fallow"
  )
  const fallow = rows.filter((r) => r.use === "Fallow").map((r) => r.year)
  const drought = analysis.climate.seasons
    .filter((c) => c.drought !== "none" && c.year >= rows[0].year)
    .map((c) => c.year)
  const list = (ys: number[]) => ys.join(", ")
  const parts = [
    poor.length
      ? `${poor.length} cropped ${poor.length > 1 ? "seasons" : "season"} below this field's normal (${list(poor.map((r) => r.year))})`
      : "no cropped season below this field's normal",
    fallow.length ? `${fallow.length} fallow (${list(fallow)})` : null,
    drought.length
      ? `${drought.length} drought ${drought.length > 1 ? "years" : "year"} in the regional weather (${list(drought)})`
      : "no drought year in the regional weather",
  ].filter(Boolean)
  return `${rows.length} seasons seen from space, ${span}: ${parts.join("; ")}.`
}

/** The Growth tab's sentence for one season. */
export function growthHeadline(analysis: FieldAnalysis, year: number) {
  const s = analysis.seasons.find((x) => x.year === year)
  if (!s)
    return `The field's Sentinel-2 record does not cover ${year}: pick a season from ${analysis.seasons[0]?.year ?? ""} on.`
  const usual = analysis.baseline?.peakMedian
  if (s.peak == null)
    return `${year}: clouds hid the field at its peak, so this season is not judged.`
  const when =
    s.peakDekad != null
      ? ` in the ten days from ${day(binStart(year, s.peakDekad))}`
      : ""
  const vs =
    usual != null
      ? `, against ${usual.toFixed(2)} in this field's usual cropped season`
      : ""
  return `${year}: greenness peaked at ${s.peak.toFixed(2)}${when}${vs}.`
}

/** The Weather tab's sentence for one season. */
export function weatherHeadline(analysis: FieldAnalysis, year: number) {
  const c = analysis.climate.seasons.find((x) => x.year === year)
  if (!c) return `There is no weather record for ${year}.`
  const drought =
    c.drought === "severe"
      ? " A severe drought by this area's own record."
      : c.drought === "drought"
        ? " A drought by this area's own record."
        : ""
  return `${year}: ${Math.round(c.rainMayAug)} mm of rain from May to August (${c.rainMayAugPct}% of normal) and ${c.hotDays30} days at 30 °C or more.${drought}`
}

/** The Options tab's sentence: what the rotations are scored against, in the scoring's own words. */
export function optionsHeadline(p: StressProfile, normalHtc: number) {
  const dry =
    normalHtc < 1
      ? `a normal season is already short of water (hydrothermal coefficient ${normalHtc.toFixed(2)}, where about 1 is enough)`
      : "a normal season has enough water"
  return `Scored for this place since ${p.years[0]}: ${dry}; rain shortfall against that normal is ${stress(p.water)}, heat ${stress(p.heat)}, and the field lay bare in ${Math.round(p.bare * 100)}% of seasons.`
}

export type MapFocus = {
  view: "field-ndvi" | "soil"
  date: string
  /** The field itself, or the region around it (soil moisture is about 9 km per pixel). */
  frame: "field" | "region"
  /** What the map shows, said in the panel. */
  says: string
}

/**
 * Where the map should go to show a tab's evidence for a season: field greenness on the clear pass
 * in the season's greenest ten days, or soil moisture on the season's hottest day.
 */
export function mapFocus(
  analysis: FieldAnalysis,
  year: number,
  tab: "growth" | "weather"
): MapFocus | null {
  if (tab === "weather") {
    const c = analysis.climate.seasons.find((x) => x.year === year)
    if (!c || year < 2016) return null
    return {
      view: "soil",
      date: c.tmaxPeakDate,
      frame: "region",
      says: `On the map: soil moisture around the field on ${day(c.tmaxPeakDate)}, the hottest day of ${year} (${c.tmaxPeak.toFixed(1)} °C).`,
    }
  }
  const s = analysis.seasons.find((x) => x.year === year)
  if (!s || s.peakDekad == null) return null
  const start = binStart(year, s.peakDekad)
  const end = iso(Date.parse(start) + 9 * DAY)
  const passes = (analysis.scenes ?? []).map((p) => p.date)
  const date =
    passes.find((d) => d >= start && d <= end) ??
    passes.findLast((d) => d <= end && d.startsWith(String(year)))
  if (!date) return null
  return {
    view: "field-ndvi",
    date,
    frame: "field",
    says: `On the map: field greenness on ${day(date)}, a clear pass in the season's greenest ten days.`,
  }
}

/** Run with `npm run check:data`. */
export function selfCheck() {
  if (binStart(2021, 0) !== "2021-05-01" || binStart(2021, 7) !== "2021-07-11")
    throw new Error("binStart")
  const c = {
    rainMayAugPct: 53,
    drought: "drought",
    hotDays30: 45,
  } as ClimateSeason
  if (
    weatherWords(c) !== "Drought, rain 53% of normal, 45 days at 30 °C or more"
  )
    throw new Error(`weatherWords: ${weatherWords(c)}`)
  if (
    weatherWords({ ...c, drought: "none", hotDays30: 3 }) !==
    "Rain 53% of normal"
  )
    throw new Error("weatherWords, quiet season")
  const p = {
    water: 0.18,
    heat: 0.22,
    frost: 0,
    bare: 0.22,
    years: [1981, 2026],
  }
  const o = optionsHeadline(p as StressProfile, 0.81)
  if (
    !o.includes("already short of water") ||
    !o.includes("rain shortfall against that normal is small, heat moderate") ||
    !o.includes("22%")
  )
    throw new Error(`optionsHeadline: ${o}`)
  console.log("story self-check passed")
}

// Where the analysis comes from: static preset files for demo fields, the
// analysis service for a field the user drew. Plus the few sentences the UI
// computes from that data.
import { useEffect, useState } from "react"

import type { ClimateSeason, FieldAnalysis, ModisYear, Preset, Season, Severity } from "@/lib/analysis"
import type { SavedField } from "@/lib/fields"

export type Declared = "crop" | "fallow"

/** What to tell the user when a request fails. Empty means "the service could not be reached". */
export function failureMessage(status: number, body: unknown): string {
  const detail = body && typeof body === "object" ? (body as { detail?: unknown }).detail : undefined
  // The API explains itself in `detail` (field too small, server busy, satellite service down): show that.
  if (typeof detail === "string" && detail) return detail
  return body === undefined ? "" : `The analysis service answered with an error (${status}).`
}

class LoadError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init)
  const isJson = r.headers.get("content-type")?.includes("json")
  // A static host answers unknown paths with index.html, so "not JSON" also means "not there".
  if (!r.ok || !isJson) throw new LoadError(r.status, failureMessage(r.status, isJson ? await r.json().catch(() => undefined) : undefined))
  return r.json()
}

export const loadPresets = () => json<Preset[]>(`${import.meta.env.BASE_URL}presets/index.json`)

/** One analysis per field and set of land-use answers, for the life of the page. */
const cache = new Map<string, FieldAnalysis>()
/** The newest analysis of each field, shown while a re-analysis with new answers runs. */
const latest = new Map<string, FieldAnalysis>()

/** A demo field is a fixed file; a drawn field is analysed again for each set of answers, whatever their order. */
export const analysisKey = (field: Pick<SavedField, "id" | "preset">, answers: Record<string, Declared>) =>
  field.preset ? field.id : field.id + JSON.stringify(Object.entries(answers).sort(([a], [b]) => a.localeCompare(b)))

/** The request for a drawn field: its outline, plus the land use its owner gave, when any. */
export const analyseBody = (geometry: SavedField["geometry"], answers: Record<string, Declared>) =>
  JSON.stringify(Object.keys(answers).length ? { geometry, declaredUse: answers } : { geometry })

async function load(field: SavedField, answers: Record<string, Declared>) {
  const a = field.preset
    ? await json<FieldAnalysis>(`${import.meta.env.BASE_URL}presets/${field.id}.json`)
    : await json<FieldAnalysis>("/api/analyse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: analyseBody(field.geometry, answers),
      })
  if (a.schema !== 1) throw new Error(`unknown analysis schema ${a.schema}`)
  cache.set(analysisKey(field, answers), a)
  latest.set(field.id, a)
}

type Failure = {
  /** The service's own words, or empty when it could not be reached at all. */
  message: string
  /** False when asking again cannot help, as with an outline the service refuses. */
  canRetry: boolean
  retry: () => void
}

export type AnalysisState =
  | { status: "loading" }
  /** `refresh` is set while, or after, the field is analysed again with new land-use answers; `analysis` is then the earlier one. */
  | { status: "ready"; analysis: FieldAnalysis; refresh?: "running" | Failure }
  | ({ status: "failed" } & Failure)

const NO_ANSWERS: Record<string, Declared> = {}

export function useAnalysis(field: SavedField | undefined, answers: Record<string, Declared> = NO_ANSWERS): AnalysisState {
  const [failed, setFailed] = useState<{ key: string; status: number; message: string } | null>(null)
  const [attempt, setAttempt] = useState(0) // also re-renders once the cache is filled
  const key = field && analysisKey(field, answers)

  useEffect(() => {
    if (!field || !key || cache.has(key)) return
    let live = true
    load(field, answers).then(
      () => live && setAttempt((n) => n + 1),
      (e) => live && setFailed({ key, status: e instanceof LoadError ? e.status : 0, message: e instanceof LoadError ? e.message : "" })
    )
    return () => {
      live = false
    }
    // a field's geometry never changes after it is saved, so its id and the answers are the whole key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt])

  if (!field || !key) return { status: "loading" }
  const analysis = cache.get(key)
  if (analysis) return { status: "ready", analysis }
  const failure: Failure | null =
    failed?.key === key
      ? {
          message: failed.message,
          canRetry: failed.status !== 422,
          retry: () => {
            setFailed(null)
            setAttempt((n) => n + 1)
          },
        }
      : null
  // New answers on a field already analysed: keep its earlier analysis on screen meanwhile.
  const earlier = latest.get(field.id)
  if (earlier) return { status: "ready", analysis: earlier, refresh: failure ?? "running" }
  return failure ? { status: "failed", ...failure } : { status: "loading" }
}

// --- Small readings of the data ---------------------------------------------

/** The date the map shows for "that season": mid-July, around peak canopy. */
export const midJuly = (year: number) => `${year}-07-15`

const SEVERITIES: Severity[] = ["info", "watch", "warning", "severe"]

export const worstSeverity = (season: Pick<Season, "verdicts">): Severity | null =>
  season.verdicts.reduce<Severity | null>(
    (worst, v) => (worst === null || SEVERITIES.indexOf(v.severity) > SEVERITIES.indexOf(worst) ? v.severity : worst),
    null
  )

/** Verdicts that carry a judgement. A question to the user and an explanatory note do not. */
const isFinding = (v: Season["verdicts"][number]) => v.type !== "LAND_USE_UNCLEAR" && v.type !== "NOTE"

const USE: Record<Season["use"], string> = {
  cropped: "Cropped",
  fallow: "Fallow",
  ambiguous: "Unclear",
  early_green: "Early green",
  unknown: "No data",
}

/**
 * What the land was used for, and who says so. An owner's word (answer, then file) wins over the curve.
 * On a demo field the file's land use is the team's assumption, and is labelled as one.
 */
export function landUse(season: Pick<Season, "use" | "declared">, answer?: Declared | null, demo = false) {
  const declared = answer ?? season.declared ?? null
  return declared
    ? { label: declared === "crop" ? "Crop" : "Fallow", source: answer || !demo ? ("declared" as const) : ("assumed" as const) }
    : { label: USE[season.use], source: "inferred" as const }
}

/**
 * The one word under a season chip: the highest level among findings, "question" while the
 * land use is still to be confirmed by the user, null when there is no finding.
 */
export function seasonStatus(season: Pick<Season, "verdicts">, answer?: Declared | null): Severity | "question" | "answered" | null {
  if (season.verdicts.some((v) => v.type === "LAND_USE_UNCLEAR")) return answer ? "answered" : "question"
  return worstSeverity({ verdicts: season.verdicts.filter(isFinding) }) ?? (season.verdicts.length ? "info" : null)
}

/** Where a season's peak stands among the cropped-looking summers of the NASA MODIS record. Never "worst". */
export function modisSentence(years: ModisYear[], year: number): string {
  const y = years.find((m) => m.year === year)
  if (!y || y.peak === null || y.use === "unknown") return `There is no reliable NASA MODIS reading for ${year}.`
  if (y.use === "fallow") return `${year} is marked fallow or bare in the NASA MODIS record, so it is not ranked.`
  const peak = y.peak
  const cropped = years.flatMap((m) => (m.use === "cropped" && m.peak !== null ? [m.peak] : []))
  // ties count on both sides, so a tied year is never singled out
  const low = cropped.filter((p) => p <= peak).length
  const high = cropped.filter((p) => p >= peak).length
  const [k, end] = low <= high ? [low, "lowest"] : [high, "highest"]
  // past the outer third on both sides a rank from either end says little
  const place = k === 1 ? `the ${end} of` : k > cropped.length / 3 ? "near the middle of the" : `among the ${k} ${end} of`
  return `${year} was ${place} ${cropped.length} cropped-looking summers since ${years[0].year} (250 m pixels that include neighbours).`
}

/**
 * Said when Sentinel-2 reads a season as well below normal while the MODIS peak is within a tenth of
 * its usual: the two records disagree, and the reader should know. Null otherwise.
 */
export function modisDisagreement(analysis: Pick<FieldAnalysis, "seasons" | "modis">, year: number): string | null {
  const low = analysis.seasons
    .find((s) => s.year === year)
    ?.verdicts.some((v) => v.type === "VEG_DEFICIT" && (v.severity === "warning" || v.severity === "severe"))
  const m = analysis.modis?.years.find((y) => y.year === year)
  if (!low || !analysis.modis || !m || m.use !== "cropped" || m.peak === null || m.peak < 0.9 * analysis.modis.peakMedian) return null
  return `The NASA MODIS record at 250 m does not show ${year} as unusual (peak ${m.peak.toFixed(2)} against a usual ${analysis.modis.peakMedian.toFixed(2)}), while the Sentinel-2 reading above does. The two disagree, which is another reason for a field visit.`
}

/** The first line of the Strategies tab: what the satellite record says about the selected season. */
export function seasonHeadline(seasons: Pick<Season, "year" | "verdicts">[], year: number): string {
  const tail = "Three rotation options to compare below."
  const season = seasons.find((s) => s.year === year)
  if (!season) return `${year}: no season finding, the field's Sentinel-2 record does not cover this year. ${tail}`
  const findings = season.verdicts.filter(isFinding)
  const top = findings.find((v) => v.severity === worstSeverity({ verdicts: findings }))
  if (top) return `${year}: ${top.title}${top.severity === "info" ? "" : ` (${top.severity})`}. ${tail}`
  if (season.verdicts.some((v) => v.type === "LAND_USE_UNCLEAR"))
    return `${year}: no finding yet, the satellite record cannot tell a crop from fallow this year. ${tail}`
  return `${year}: no finding from satellite greenness. ${tail}`
}

/** A season at either end of the record is said so, even when no dry-spell, heat, frost or harvest-rain flag fired. */
export function recordExtreme(
  season: Pick<ClimateSeason, "htcRank" | "htcRankOf" | "rainMayAugPct">,
  since: number
): string | null {
  const end = season.htcRank === 1 ? "Driest" : season.htcRank != null && season.htcRank === season.htcRankOf ? "Wettest" : null
  return (
    end &&
    `${end} of the ${season.htcRankOf} seasons since ${since}, by rain set against heat: May to August rain was ${season.rainMayAugPct}% of normal.`
  )
}

/** The year the "Compare with" box shows: never the selected season itself, never a year without a curve. */
export const compareYear = (compare: number | null, year: number, years: number[]): number | null =>
  compare !== null && compare !== year && years.includes(compare) ? compare : null

/** Run with `npm run check:data`. */
export function selfCheck() {
  const eq = (got: unknown, want: unknown) => {
    if (got !== want) throw new Error(`expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`)
  }
  const modis: ModisYear[] = [
    { year: 2000, peak: 0.7, use: "cropped" },
    { year: 2001, peak: 0.3, use: "fallow" },
    { year: 2002, peak: 0.5, use: "cropped" },
    { year: 2003, peak: null, use: "unknown" },
    { year: 2004, peak: 0.6, use: "cropped" },
    { year: 2005, peak: 0.8, use: "cropped" },
    { year: 2006, peak: 0.75, use: "cropped" },
  ]
  const tail = "of 5 cropped-looking summers since 2000 (250 m pixels that include neighbours)."
  eq(modisSentence(modis, 2002), `2002 was the lowest ${tail}`)
  eq(modisSentence(modis, 2004), `2004 was near the middle of the ${tail.slice(3)}`) // 2nd of 5 is no tail
  const nine: ModisYear[] = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map((peak, i) => ({ year: 2000 + i, peak, use: "cropped" }))
  eq(modisSentence(nine, 2002).startsWith("2002 was among the 3 lowest of 9 "), true)
  eq(modisSentence(nine, 2004).startsWith("2004 was near the middle of the 9 "), true)
  eq(modisSentence(nine, 2007).startsWith("2007 was among the 2 highest of 9 "), true)
  eq(modisSentence(modis, 2005), `2005 was the highest ${tail}`)
  eq(modisSentence(modis, 2001).includes("not ranked"), true) // a fallow or bare year is never ranked as a weak crop
  eq(modisSentence(modis, 2003), "There is no reliable NASA MODIS reading for 2003.")
  eq(modisSentence(modis, 1999), "There is no reliable NASA MODIS reading for 1999.")
  eq(/worst|weak|strong/.test(modis.map((m) => modisSentence(modis, m.year)).join(" ")), false)
  const season = (severities: Severity[], type = "VEG_DEFICIT") =>
    ({ verdicts: severities.map((severity) => ({ type, severity, title: "", detail: "" })) }) as unknown as Season
  eq(worstSeverity(season([])), null)
  eq(worstSeverity(season(["watch", "severe", "info"])), "severe")
  // land use: the user's answer wins over the file's declaration, which wins over the curve
  eq(JSON.stringify(landUse({ use: "ambiguous", declared: null })), '{"label":"Unclear","source":"inferred"}')
  eq(JSON.stringify(landUse({ use: "ambiguous", declared: "crop" })), '{"label":"Crop","source":"declared"}')
  eq(JSON.stringify(landUse({ use: "cropped", declared: "crop" }, "fallow")), '{"label":"Fallow","source":"declared"}')
  eq(landUse({ use: "fallow" } as Season).source, "inferred") // an older file without `declared`
  // a demo field's land use is the team's assumption, never shown as a farmer's word; a visitor's answer still is
  eq(JSON.stringify(landUse({ use: "ambiguous", declared: "fallow" }, null, true)), '{"label":"Fallow","source":"assumed"}')
  eq(landUse({ use: "ambiguous", declared: "fallow" }, "crop", true).source, "declared")
  eq(landUse({ use: "cropped", declared: null }, null, true).source, "inferred")
  // a question about land use is never shown as a level, and a note is only a note
  eq(seasonStatus(season([])), null)
  eq(seasonStatus(season(["info"], "LAND_USE_UNCLEAR")), "question")
  eq(seasonStatus(season(["info"], "LAND_USE_UNCLEAR"), "crop"), "answered")
  eq(seasonStatus(season(["info"], "NOTE")), "info")
  eq(seasonStatus(season(["info", "warning"])), "warning")
  // the API's own words reach the user; only a service that cannot be reached gets the fixed text (empty message)
  eq(failureMessage(422, { detail: "The field covers 0.4 ha; it must be between 0.5 and 5,000 ha." }), "The field covers 0.4 ha; it must be between 0.5 and 5,000 ha.")
  eq(failureMessage(429, { detail: "The server is already building other fields. Please try again in a minute." }).includes("already building"), true)
  eq(failureMessage(422, { detail: [{ msg: "bad" }] }), "The analysis service answered with an error (422).")
  eq(failureMessage(404, undefined), "")
  // land-use answers go to the API, and each set of answers is its own cached analysis
  const drawn = { id: "f1" }
  const square = { type: "Polygon" as const, coordinates: [] }
  eq(analyseBody(square, {}), '{"geometry":{"type":"Polygon","coordinates":[]}}')
  eq(JSON.parse(analyseBody(square, { 2023: "crop" })).declaredUse[2023], "crop")
  eq(analysisKey(drawn, { 2023: "crop" }) === analysisKey(drawn, {}), false)
  eq(analysisKey(drawn, { 2023: "crop" }) === analysisKey(drawn, { 2023: "fallow" }), false)
  eq(analysisKey(drawn, { 2021: "crop", 2023: "fallow" }), analysisKey(drawn, { 2023: "fallow", 2021: "crop" }))
  eq(analysisKey({ id: "p", preset: {} as Preset }, { 2023: "crop" }), "p") // a demo field is a fixed file
  // the first line of the Strategies tab states the season finding
  const titled = (year: number, verdicts: [string, Severity, string][]) =>
    ({ year, verdicts: verdicts.map(([type, severity, title]) => ({ type, severity, title, detail: "" })) }) as unknown as Season
  const record = [
    titled(2021, [["NOTE", "info", "A note"], ["VEG_DEFICIT", "warning", "Peak greenness well below this field's normal"]]),
    titled(2022, [["LAND_USE_UNCLEAR", "info", "Crop or fallow?"]]),
    titled(2024, []),
  ]
  eq(seasonHeadline(record, 2021), "2021: Peak greenness well below this field's normal (warning). Three rotation options to compare below.")
  eq(seasonHeadline(record, 2024), "2024: no finding from satellite greenness. Three rotation options to compare below.")
  eq(seasonHeadline(record, 2022).startsWith("2022: no finding yet"), true)
  eq(seasonHeadline(record, 2005).startsWith("2005: no season finding"), true)
  // the wettest and the driest season of the record are never "nothing stood out"
  eq(recordExtreme({ htcRank: 36, htcRankOf: 36, rainMayAugPct: 183 }, 1991), "Wettest of the 36 seasons since 1991, by rain set against heat: May to August rain was 183% of normal.")
  eq(recordExtreme({ htcRank: 1, htcRankOf: 36, rainMayAugPct: 40 }, 1991)?.startsWith("Driest of the 36 seasons"), true)
  eq(recordExtreme({ htcRank: 4, htcRankOf: 36, rainMayAugPct: 45 }, 1991), null)
  eq(recordExtreme({ rainMayAugPct: 45 } as ClimateSeason, 1991), null) // an older file without ranks
  // "Compare with" always has something to show: the selected season itself reads as None
  eq(compareYear(2024, 2024, [2021, 2024]), null)
  eq(compareYear(2024, 2021, [2021, 2024]), 2024)
  eq(compareYear(2010, 2021, [2021, 2024]), null)
  eq(compareYear(null, 2021, [2021, 2024]), null)
  // Sentinel-2 warning beside an ordinary MODIS year: the disagreement is said, and only then
  const veg = (peak: number, severity: Severity) => ({
    seasons: [titled(2021, [["VEG_DEFICIT", severity, "Low"]])],
    modis: { years: [{ year: 2021, peak, use: "cropped" as const }], peakMedian: 0.735, note: "" },
  })
  eq(modisDisagreement(veg(0.714, "warning"), 2021)?.includes("does not show 2021 as unusual (peak 0.71 against a usual 0.73)"), true)
  eq(modisDisagreement(veg(0.52, "warning"), 2021), null) // both low: they agree
  eq(modisDisagreement(veg(0.714, "watch"), 2021), null)
  eq(modisDisagreement(veg(0.714, "warning"), 2020), null)
  console.log("data self-check passed")
}

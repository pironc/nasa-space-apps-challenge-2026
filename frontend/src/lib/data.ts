// Where the analysis comes from: static preset files for demo fields, the
// analysis service for a field the user drew. Plus the few sentences the UI
// computes from that data.
import { useEffect, useState } from "react"

import type { FieldAnalysis, ModisYear, Preset, Season, Severity } from "@/lib/analysis"
import type { SavedField } from "@/lib/fields"

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init)
  // A static host answers unknown paths with index.html, so "not JSON" also means "not there".
  if (!r.ok || !r.headers.get("content-type")?.includes("json")) throw new Error(`${r.status} ${url}`)
  return r.json()
}

export const loadPresets = () => json<Preset[]>("/presets/index.json")

/** One analysis per field id for the life of the page. */
const cache = new Map<string, FieldAnalysis>()

async function load(field: SavedField) {
  const a = field.preset
    ? await json<FieldAnalysis>(`/presets/${field.id}.json`)
    : await json<FieldAnalysis>("/api/analyse", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ geometry: field.geometry }),
      })
  if (a.schema !== 1) throw new Error(`unknown analysis schema ${a.schema}`)
  cache.set(field.id, a)
}

export type AnalysisState =
  | { status: "loading" }
  | { status: "ready"; analysis: FieldAnalysis }
  | { status: "failed"; retry: () => void }

export function useAnalysis(field: SavedField | undefined): AnalysisState {
  const [failedId, setFailedId] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0) // also re-renders once the cache is filled
  const id = field?.id

  useEffect(() => {
    if (!field || cache.has(field.id)) return
    let live = true
    load(field).then(
      () => live && setAttempt((n) => n + 1),
      () => live && setFailedId(field.id)
    )
    return () => {
      live = false
    }
    // a field's geometry never changes after it is saved, so its id is the whole key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, attempt])

  const analysis = id ? cache.get(id) : undefined
  if (analysis) return { status: "ready", analysis }
  if (id && failedId === id)
    return {
      status: "failed",
      retry: () => {
        setFailedId(null)
        setAttempt((n) => n + 1)
      },
    }
  return { status: "loading" }
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

export type Declared = "crop" | "fallow"

const USE: Record<Season["use"], string> = {
  cropped: "Cropped",
  fallow: "Fallow",
  ambiguous: "Unclear",
  early_green: "Early green",
  unknown: "No data",
}

/** What the land was used for, and who says so. An owner's word (answer, then file) wins over the curve. */
export function landUse(season: Pick<Season, "use" | "declared">, answer?: Declared | null) {
  const declared = answer ?? season.declared ?? null
  return declared
    ? { label: declared === "crop" ? "Crop" : "Fallow", source: "declared" as const }
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
  return `${year} was ${k === 1 ? "the" : `among the ${k}`} ${end} of ${cropped.length} cropped-looking summers since ${years[0].year} (250 m pixels that include neighbours).`
}

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
  eq(modisSentence(modis, 2004), `2004 was among the 2 lowest ${tail}`)
  eq(modisSentence(modis, 2006), `2006 was among the 2 highest ${tail}`)
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
  // a question about land use is never shown as a level, and a note is only a note
  eq(seasonStatus(season([])), null)
  eq(seasonStatus(season(["info"], "LAND_USE_UNCLEAR")), "question")
  eq(seasonStatus(season(["info"], "LAND_USE_UNCLEAR"), "crop"), "answered")
  eq(seasonStatus(season(["info"], "NOTE")), "info")
  eq(seasonStatus(season(["info", "warning"])), "warning")
  console.log("data self-check passed")
}

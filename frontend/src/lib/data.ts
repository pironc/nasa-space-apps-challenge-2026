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

export const worstSeverity = (season: Season): Severity | null =>
  season.verdicts.reduce<Severity | null>(
    (worst, v) => (worst === null || SEVERITIES.indexOf(v.severity) > SEVERITIES.indexOf(worst) ? v.severity : worst),
    null
  )

export function ordinal(n: number) {
  const tens = n % 100
  const suffix = tens >= 11 && tens <= 13 ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")
  return `${n}${suffix}`
}

/** Where a season's peak stands among the cropped seasons of the NASA MODIS record. */
export function modisSentence(years: ModisYear[], year: number): string {
  const y = years.find((m) => m.year === year)
  if (!y || y.peak === null || y.use === "unknown") return `There is no reliable NASA MODIS reading for ${year}.`
  if (y.use === "fallow") return `${year} looks like a fallow year in the NASA MODIS record, so it is not ranked against cropped seasons.`
  const peak = y.peak
  const cropped = years.flatMap((m) => (m.use === "cropped" && m.peak !== null ? [m.peak] : []))
  const weaker = cropped.filter((p) => p < peak).length
  const stronger = cropped.filter((p) => p > peak).length
  const [rank, word] = weaker <= stronger ? [weaker + 1, "weakest"] : [stronger + 1, "strongest"]
  return `${year} was the ${rank === 1 ? "" : `${ordinal(rank)} `}${word} of ${cropped.length} cropped seasons since ${years[0].year} (NASA MODIS).`
}

/** Run with `npm run check:data`. */
export function selfCheck() {
  const eq = (got: unknown, want: unknown) => {
    if (got !== want) throw new Error(`expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`)
  }
  eq([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal).join(" "), "1st 2nd 3rd 4th 11th 12th 13th 21st 22nd 23rd 101st 111th")
  const modis: ModisYear[] = [
    { year: 2000, peak: 0.7, use: "cropped" },
    { year: 2001, peak: 0.3, use: "fallow" },
    { year: 2002, peak: 0.5, use: "cropped" },
    { year: 2003, peak: null, use: "unknown" },
    { year: 2004, peak: 0.6, use: "cropped" },
    { year: 2005, peak: 0.8, use: "cropped" },
    { year: 2006, peak: 0.75, use: "cropped" },
  ]
  eq(modisSentence(modis, 2002), "2002 was the weakest of 5 cropped seasons since 2000 (NASA MODIS).")
  eq(modisSentence(modis, 2004), "2004 was the 2nd weakest of 5 cropped seasons since 2000 (NASA MODIS).")
  eq(modisSentence(modis, 2006), "2006 was the 2nd strongest of 5 cropped seasons since 2000 (NASA MODIS).")
  eq(modisSentence(modis, 2005), "2005 was the strongest of 5 cropped seasons since 2000 (NASA MODIS).")
  eq(modisSentence(modis, 2001).includes("fallow"), true) // a fallow year is never ranked as a weak crop
  eq(modisSentence(modis, 2003), "There is no reliable NASA MODIS reading for 2003.")
  eq(modisSentence(modis, 1999), "There is no reliable NASA MODIS reading for 1999.")
  const season = (severities: Severity[]) =>
    ({ verdicts: severities.map((severity) => ({ type: "VEG_DEFICIT", severity, title: "", detail: "" })) }) as unknown as Season
  eq(worstSeverity(season([])), null)
  eq(worstSeverity(season(["watch", "severe", "info"])), "severe")
  console.log("data self-check passed")
}

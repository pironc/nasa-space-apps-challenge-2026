import type { Polygon } from "geojson"
import { useCallback, useState } from "react"

import type { Preset } from "@/lib/analysis"

export const ROTATIONS = {
  fwwb: "Fallow, wheat, wheat, barley",
  wwww: "Continuous wheat",
  other: "Other or not sure",
} as const

export type RotationId = keyof typeof ROTATIONS

export type SavedField = {
  id: string
  name: string
  rotation: RotationId
  areaHa: number
  geometry: Polygon
  createdAt: string
  /** Set on demo fields: shipped with the app, never stored in the browser, not deletable. */
  preset?: Preset
}

export const presetToField = (p: Preset): SavedField => ({ ...p, createdAt: "", preset: p })

// The app was called Field Shift: the key keeps that name so fields saved before the rename stay.
const KEY = "fieldshift.fields.v1"

function load(): SavedField[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]")
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return [] // private mode or corrupted entry: start empty rather than crash
  }
}

/** Saved fields live in this browser only; the server never sees names. */
export function useSavedFields() {
  const [fields, setFields] = useState<SavedField[]>(load)

  const update = useCallback((next: (prev: SavedField[]) => SavedField[]) => {
    setFields((prev) => {
      const value = next(prev)
      try {
        localStorage.setItem(KEY, JSON.stringify(value))
      } catch {
        // storage full or blocked: the field still works for this session
      }
      return value
    })
  }, [])

  return {
    fields,
    add: (f: SavedField) => update((prev) => [...prev, f]),
    patch: (id: string, change: Partial<SavedField>) => update((prev) => prev.map((f) => (f.id === id ? { ...f, ...change } : f))),
    remove: (id: string) => update((prev) => prev.filter((f) => f.id !== id)),
    restore: (f: SavedField) => update((prev) => (prev.some((p) => p.id === f.id) ? prev : [...prev, f])),
  }
}

export function bounds(geometry: Polygon): [[number, number], [number, number]] {
  const ring = geometry.coordinates[0]
  const lons = ring.map((c) => c[0])
  const lats = ring.map((c) => c[1])
  return [
    [Math.min(...lons), Math.min(...lats)],
    [Math.max(...lons), Math.max(...lats)],
  ]
}

export function centre(geometry: Polygon): [number, number] {
  const [[w, s], [e, n]] = bounds(geometry)
  return [(w + e) / 2, (s + n) / 2]
}

// two decimals under 1 ha, so an outline just under the 0.5 ha minimum does not read "0.5 ha"
export const formatHa = (ha: number) => `${ha >= 100 ? Math.round(ha).toLocaleString("en-GB") : ha.toFixed(ha < 1 ? 2 : 1)} ha`

// The analysis service accepts 0.5 to 5,000 ha: below that too few 10 m satellite pixels fall inside the outline.
export const MIN_HA = 0.5
export const MAX_HA = 5_000

/** Why an outline of this size cannot be saved, or null when it can. */
export const sizeProblem = (ha: number) =>
  ha > MAX_HA
    ? `Over ${MAX_HA.toLocaleString("en-GB")} ha. Outline a single field.`
    : ha < MIN_HA
      ? `Under ${MIN_HA} ha, too small for the satellite record to read.`
      : null

/** Run with `npm run check:data`. */
export function selfCheck() {
  // the same limits as the service, so an outline it would refuse is never saved
  const got = [0.4, 0.5, 414.6, 5000, 5001].map((ha) => sizeProblem(ha)?.split(" ")[0] ?? "ok").join()
  if (got !== "Under,ok,ok,ok,Over") throw new Error(`size limits read ${got}`)
  if (formatHa(0.46) !== "0.46 ha" || formatHa(41.46) !== "41.5 ha" || formatHa(1414.6) !== "1,415 ha") throw new Error("formatHa")
  console.log("fields self-check passed")
}

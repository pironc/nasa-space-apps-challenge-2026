import type { Polygon } from "geojson"
import { useCallback, useState } from "react"

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
}

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

export const formatHa = (ha: number) => `${ha >= 100 ? Math.round(ha).toLocaleString("en-GB") : ha.toFixed(1)} ha`

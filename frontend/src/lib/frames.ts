import { useEffect, useState } from "react"

/** Clear Sentinel-2 images of a demo field, saved as files so the map can animate them day by day. */
export type Frames = {
  bounds: [number, number, number, number]
  frames: { date: string; file: string }[]
}

/** How a day is drawn: image `a` at full strength, image `b` over it at `t` (0 to 1). */
export type Blend = { a: string; b: string | null; t: number }

const DAY = 86_400_000
/** No blending across gaps longer than this: the field can change too much between two images. */
const MAX_GAP_DAYS = 30

const cache = new Map<string, Promise<Frames | null>>()

export function frameUrl(fieldId: string, file: string) {
  return `${import.meta.env.BASE_URL}frames/${fieldId}/${file}`
}

/** The saved images of a demo field; null for drawn fields and for demo fields without saved images. */
export function useFrames(fieldId: string | null, isDemo: boolean) {
  const [frames, setFrames] = useState<{
    id: string
    value: Frames | null
  } | null>(null)
  useEffect(() => {
    if (!fieldId || !isDemo) return
    if (!cache.has(fieldId))
      cache.set(
        fieldId,
        fetch(frameUrl(fieldId, "index.json"))
          .then((r) => (r.ok ? (r.json() as Promise<Frames>) : null))
          .catch(() => null)
      )
    let live = true
    cache
      .get(fieldId)!
      .then((value) => live && setFrames({ id: fieldId, value }))
    return () => {
      live = false
    }
  }, [fieldId, isDemo])
  return frames && frames.id === fieldId ? frames.value : null
}

/**
 * The images to show on a day: the latest image on or before it, faded towards the next one in
 * proportion to the days between them. Null when no image is close enough.
 */
export function blendFor(frames: Frames["frames"], day: string): Blend | null {
  const i = frames.findLastIndex((f) => f.date <= day)
  if (i < 0) return null
  const a = frames[i].date
  const next = frames[i + 1]?.date ?? null
  const span = next ? (Date.parse(next) - Date.parse(a)) / DAY : Infinity
  if (span > MAX_GAP_DAYS)
    return (Date.parse(day) - Date.parse(a)) / DAY <= MAX_GAP_DAYS
      ? { a, b: null, t: 0 }
      : null
  return { a, b: next, t: (Date.parse(day) - Date.parse(a)) / DAY / span }
}

/** Years that have saved images. */
export const framedYears = (frames: Frames | null) =>
  new Set(frames?.frames.map((f) => +f.date.slice(0, 4)) ?? [])

/** Run with `npm run check:data`. */
export function selfCheck() {
  const f = [
    { date: "2021-07-10", file: "" },
    { date: "2021-07-20", file: "" },
    { date: "2021-09-30", file: "" },
  ]
  const at = (d: string) => JSON.stringify(blendFor(f, d))
  if (at("2021-07-01") !== "null") throw new Error("before the first image")
  if (
    at("2021-07-15") !==
    JSON.stringify({ a: "2021-07-10", b: "2021-07-20", t: 0.5 })
  )
    throw new Error("halfway blend")
  if (at("2021-07-25") !== JSON.stringify({ a: "2021-07-20", b: null, t: 0 }))
    throw new Error("no blend over a long gap")
  if (at("2021-09-01") !== "null") throw new Error("too old to show")
  console.log("frames self-check passed")
}

import type { RasterTileSource } from "maplibre-gl"
import { useEffect, useRef } from "react"
import { useMap } from "@/components/ui/map"

type Props = {
  id: string
  /** The frame to show, or null for nothing. */
  tiles: string | null
  /** Frames to load in the background (the next dates), so stepping to them is instant. */
  next?: (string | null)[]
  visible: boolean
  opacity: number
  /** Native max zoom of the tiles (deeper zooms reuse them). */
  maxzoom: number
  /** No tiles below this zoom. */
  minzoom?: number
  attribution?: string
  /** Whether the first `next` frame has finished loading, for play to wait on. */
  onReady?: (id: string, ready: boolean) => void
}

// The frame on screen, the one asked for and two loading ahead. Each slot is its own map source and layer.
const SLOTS = 4
// A layer with no frame yet still needs a URL; it is never requested while hidden.
const IDLE = "data:,"

/**
 * A raster overlay that changes date with a hard cut. The next frames load in hidden slots
 * (opacity 0 still loads tiles); a new date stays hidden until its tiles are in, while the previous
 * one stays on screen, then the two swap at once: no fade and no half-drawn frame.
 */
export function RasterLayer({
  id,
  tiles,
  next = [],
  visible,
  opacity,
  maxzoom,
  minzoom,
  attribution,
  onReady,
}: Props) {
  const { map, isLoaded } = useMap()
  const held = useRef<(string | null)[]>(Array(SLOTS).fill(null))
  /** The slot on screen. */
  const shown = useRef<number | null>(null)
  const slot = (i: number) => `${id}~${i}`

  useEffect(() => {
    if (!map || !isLoaded) return
    // Below the basemap's first label so place names stay readable.
    const firstLabel = map
      .getStyle()
      .layers.find((l) => l.type === "symbol")?.id
    for (let i = 0; i < SLOTS; i++) {
      // tileSize 256: MapLibre assumes 512 and would request one zoom level too coarse.
      map.addSource(slot(i), {
        type: "raster",
        tiles: [IDLE],
        tileSize: 256,
        maxzoom,
        minzoom,
        attribution,
      })
      map.addLayer(
        {
          id: slot(i),
          type: "raster",
          source: slot(i),
          ...(minzoom !== undefined && { minzoom }),
          layout: { visibility: "none" },
          paint: {
            "raster-fade-duration": 0,
            "raster-opacity": 0,
            "raster-opacity-transition": { duration: 0 },
          },
        },
        firstLabel
      )
    }
    held.current = Array(SLOTS).fill(null)
    shown.current = null
    return () => {
      if (!map.style) return // map already removed
      for (let i = 0; i < SLOTS; i++) {
        if (map.getLayer(slot(i))) map.removeLayer(slot(i))
        if (map.getSource(slot(i))) map.removeSource(slot(i))
      }
    }
    // frames, opacity and visibility are synced below without re-creating the sources
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, isLoaded, id])

  const wanted = [tiles, ...next]
    .filter((u, i, all): u is string => !!u && all.indexOf(u) === i)
    .slice(0, SLOTS - 1)
  const key = `${wanted.join("|")}|${visible}|${opacity}`

  useEffect(() => {
    if (!map || !isLoaded || !map.getLayer(slot(0))) return
    const cur = held.current
    // load each wanted frame into a slot, never into the one on screen
    for (const u of wanted) {
      if (cur.includes(u)) continue
      const i = cur.findIndex(
        (v, i) => i !== shown.current && (!v || !wanted.includes(v))
      )
      if (i < 0) break
      ;(map.getSource(slot(i)) as RasterTileSource).setTiles([u])
      cur[i] = u
    }
    const paint = () => {
      const a = tiles ? cur.indexOf(tiles) : -1
      const s = shown.current
      // cut to the asked frame once it has loaded; show it at once when nothing else is on screen
      if (!visible || a < 0) shown.current = null
      else if (s === null || s === a || map.isSourceLoaded(slot(a)))
        shown.current = a
      cur.forEach((u, i) => {
        const on = i === shown.current
        // visibility none stops tile requests for layers that are switched off
        const load = visible && !!u && (on || wanted.includes(u))
        map.setLayoutProperty(slot(i), "visibility", load ? "visible" : "none")
        map.setPaintProperty(slot(i), "raster-opacity", on ? opacity : 0)
      })
    }
    paint()
    const onData = () => {
      const a = tiles ? cur.indexOf(tiles) : -1
      if (
        visible &&
        a >= 0 &&
        shown.current !== a &&
        map.isSourceLoaded(slot(a))
      )
        paint()
    }
    map.on("sourcedata", onData)
    return () => {
      map.off("sourcedata", onData)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, isLoaded, key, tiles])

  // Report whether the next frame is in, so play can wait for it instead of showing a half-loaded map.
  const nextUrl = next.find((u) => u && u !== tiles) ?? null
  const report = useRef(onReady)
  useEffect(() => {
    report.current = onReady
  })
  useEffect(() => {
    if (!map || !isLoaded) return
    const check = () => {
      const i = nextUrl ? held.current.indexOf(nextUrl) : -1
      const ready =
        !visible ||
        !nextUrl ||
        (i >= 0 && !!map.getSource(slot(i)) && map.isSourceLoaded(slot(i)))
      report.current?.(id, ready)
    }
    check()
    map.on("sourcedata", check)
    map.on("idle", check)
    return () => {
      map.off("sourcedata", check)
      map.off("idle", check)
      report.current?.(id, true) // a layer that goes away must not hold play back
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, isLoaded, nextUrl, visible, id])

  return null
}

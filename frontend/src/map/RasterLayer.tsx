import type { RasterTileSource } from "maplibre-gl"
import { useEffect, useRef } from "react"
import { useMap } from "@/components/ui/map"

type Props = {
  id: string
  /** The frame to show, or null for nothing. */
  tiles: string | null
  /** A second frame faded in over the first by `blend` (0 to 1): the next period of a layer that changes every few days. */
  blendTo?: string | null
  blend?: number
  /** Frames to load in the background (the next dates), so stepping to them is instant. */
  next?: (string | null)[]
  /** Opacity changes glide over this many ms. */
  glide?: number
  visible: boolean
  opacity: number
  /** Native max zoom of the tiles (deeper zooms reuse them). */
  maxzoom: number
  /** No tiles below this zoom. */
  minzoom?: number
  /** The layer hides from this zoom in. */
  maxView?: number
  bounds?: [number, number, number, number]
  attribution?: string
  /** Whether the first `next` frame has finished loading, for play to wait on. */
  onReady?: (id: string, ready: boolean) => void
}

// One shown frame plus two loading ahead. Each slot is its own map source and layer.
const SLOTS = 3
// A layer with no frame yet still needs a URL; it is never requested while hidden.
const IDLE = "data:,"

/**
 * A raster overlay that can change date without waiting. The next frames load in hidden slots
 * (opacity 0 still loads tiles), and a step swaps which slot is shown, with no fade.
 */
export function RasterLayer({
  id,
  tiles,
  blendTo = null,
  blend = 0,
  next = [],
  glide = 0,
  visible,
  opacity,
  maxzoom,
  minzoom,
  maxView,
  bounds,
  attribution,
  onReady,
}: Props) {
  const { map, isLoaded } = useMap()
  const held = useRef<(string | null)[]>(Array(SLOTS).fill(null))
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
        ...(bounds && { bounds }),
      })
      map.addLayer(
        {
          id: slot(i),
          type: "raster",
          source: slot(i),
          ...(minzoom !== undefined && { minzoom }),
          ...(maxView !== undefined && { maxzoom: maxView }),
          layout: { visibility: "none" },
          paint: {
            "raster-fade-duration": 150,
            "raster-opacity": 0,
            "raster-opacity-transition": { duration: 0 },
          },
        },
        firstLabel
      )
    }
    held.current = Array(SLOTS).fill(null)
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

  const wanted = [tiles, blendTo, ...next]
    .filter((u, i, all): u is string => !!u && all.indexOf(u) === i)
    .slice(0, SLOTS)
  const key = `${tiles}|${blendTo}|${blend.toFixed(3)}|${wanted.join("|")}|${visible}|${opacity}|${glide}`

  useEffect(() => {
    if (!map || !isLoaded || !map.getLayer(slot(0))) return
    const cur = held.current
    const at = new Map<string, number>()
    cur.forEach((u, i) => u && wanted.includes(u) && !at.has(u) && at.set(u, i))
    const free = cur
      .map((_, i) => i)
      .filter((i) => ![...at.values()].includes(i))
    for (const u of wanted) {
      if (at.has(u)) continue
      const i = free.shift()
      if (i === undefined) break
      ;(map.getSource(slot(i)) as RasterTileSource).setTiles([u])
      cur[i] = u
      at.set(u, i)
    }
    const a = tiles ? at.get(tiles) : undefined
    const b = blendTo && blend > 0 ? at.get(blendTo) : undefined
    // A crossfade: whichever of the two frames is drawn on top carries the change.
    const strength = (i: number) => {
      if (i === a) return b !== undefined && b < a ? 1 - blend : 1
      if (i === b) return a === undefined || b > a ? blend : 1
      return 0
    }
    cur.forEach((u, i) => {
      const keep = visible && !!u && wanted.includes(u)
      // visibility none stops tile requests for layers that are switched off
      map.setLayoutProperty(slot(i), "visibility", keep ? "visible" : "none")
      map.setPaintProperty(slot(i), "raster-opacity-transition", {
        duration: glide,
        delay: 0,
      })
      map.setPaintProperty(slot(i), "raster-opacity", strength(i) * opacity)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, isLoaded, key])

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

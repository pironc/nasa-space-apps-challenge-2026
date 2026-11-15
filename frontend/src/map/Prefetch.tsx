import { useEffect, useRef } from "react"
import { useMap, type MapRef } from "@/components/ui/map"
import {
  addDays,
  LAYERS,
  periodDates,
  sceneTiles,
  type LayerState,
} from "@/lib/layers"

/** Days fetched ahead on each side of the date shown, for layers that change every day. */
const DAILY_AROUND = 10
/** Sentinel-2 images are drawn from this zoom in. */
const SCENE_MIN_ZOOM = 10
/** Passes fetched ahead, nearest first: about 3 MB each for a field-sized view. */
const SCENES_AHEAD = 12

/** Web Mercator tile x/y for a point at zoom z. */
function tileOf(lon: number, lat: number, z: number) {
  const n = 2 ** z
  const r = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180
  return {
    x: Math.max(0, Math.min(n - 1, Math.floor(((lon + 180) / 360) * n))),
    y: Math.max(
      0,
      Math.min(
        n - 1,
        Math.floor(
          ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n
        )
      )
    ),
  }
}

/** The map tiles covering what is on screen at the zoom MapLibre asks a 256 px source for. */
function visibleTiles(map: MapRef, maxzoom: number) {
  const z = Math.max(0, Math.min(maxzoom, Math.floor(map.getZoom() + 1)))
  const b = map.getBounds()
  const a = tileOf(b.getWest(), b.getNorth(), z)
  const c = tileOf(b.getEast(), b.getSouth(), z)
  const out: { z: number; x: number; y: number }[] = []
  for (let x = a.x; x <= c.x; x++)
    for (let y = a.y; y <= c.y; y++) out.push({ z, x, y })
  // MapLibre also shows the parent tiles while the right ones decode
  if (z > 0)
    for (let x = a.x >> 1; x <= c.x >> 1; x++)
      for (let y = a.y >> 1; y <= c.y >> 1; y++) out.push({ z: z - 1, x, y })
  return out.length > 40 ? [] : out // a very wide view is not worth fetching ahead
}

/**
 * Once the map has settled, asks the tile worker (public/sw.js) to fetch, for the tiles in view only,
 * the other dates the time slider is likely to visit: every vegetation composite of the year, and
 * the days around the current one for daily layers, and the year's clear Sentinel-2 passes over the
 * selected field. Moving the slider then reads tiles from the browser.
 */
export function Prefetch({
  date,
  layers,
  scenes,
}: {
  date: string
  layers: LayerState
  /** Clear passes over the selected field: date and Sentinel-2 item id. */
  scenes: { date: string; item: string }[]
}) {
  const { map, isLoaded } = useMap()
  const live = useRef({ date, layers, scenes })
  useEffect(() => {
    live.current = { date, layers, scenes }
  })

  useEffect(() => {
    if (!map || !isLoaded || !("serviceWorker" in navigator)) return
    let timer = 0
    const send = () => {
      const sw = navigator.serviceWorker.controller
      if (!sw) return
      const { date, layers, scenes } = live.current
      const zoom = map.getZoom()
      const urls: string[] = []
      const near = (p: string, q: string) =>
        Math.abs(Date.parse(p) - Date.parse(date)) -
        Math.abs(Date.parse(q) - Date.parse(date))
      const fill = (template: string, t: { z: number; x: number; y: number }) =>
        template
          .replace("{z}", String(t.z))
          .replace("{x}", String(t.x))
          .replace("{y}", String(t.y))
      if (layers.scene.on && zoom >= SCENE_MIN_ZOOM) {
        const tiles = visibleTiles(map, 15)
        const year = date.slice(0, 4)
        for (const s of scenes
          .filter((s) => s.date.startsWith(year))
          .sort((p, q) => near(p.date, q.date))
          .slice(0, SCENES_AHEAD))
          for (const t of tiles) urls.push(fill(sceneTiles(s.item), t))
      }
      for (const l of LAYERS) {
        if (!layers[l.id].on || l.id === "scene" || l.id === "satellite")
          continue
        const y = +date.slice(0, 4)
        const days = l.period
          ? // the whole year, and the periods either side of New Year that blending reaches
            [
              ...periodDates(y),
              ...periodDates(y + 1).slice(0, 2),
              ...periodDates(y - 1).slice(-1),
            ]
          : l.daily
            ? Array.from({ length: 2 * DAILY_AROUND + 1 }, (_, i) =>
                addDays(date, i - DAILY_AROUND)
              )
            : []
        const tiles = visibleTiles(map, l.maxzoom)
        // nearest dates first, so the likely next steps arrive soonest
        days.sort(near)
        for (const d of days)
          for (const t of tiles) urls.push(fill(l.tiles(d), t))
      }
      if (urls.length) sw.postMessage({ type: "prefetch", urls })
    }
    const settle = () => {
      clearTimeout(timer)
      timer = window.setTimeout(send, 600)
    }
    map.on("idle", settle)
    settle()
    return () => {
      clearTimeout(timer)
      map.off("idle", settle)
    }
  }, [map, isLoaded])

  // a new year or layer choice changes what is worth fetching
  const year = date.slice(0, 4)
  const passes = scenes.length
  const on = Object.entries(layers)
    .filter(([, v]) => v.on)
    .map(([k]) => k)
    .join()
  useEffect(() => {
    if (map && isLoaded) map.fire("idle")
  }, [map, isLoaded, year, on, passes])

  return null
}

import type { RasterTileSource } from "maplibre-gl"
import { useEffect } from "react"
import { useMap } from "@/components/ui/map"

type Props = {
  id: string
  tiles: string
  visible: boolean
  opacity: number
  maxzoom: number
  attribution?: string
}

/** A raster tile overlay whose URL can change (time slider) without a blank frame. */
export function RasterLayer({ id, tiles, visible, opacity, maxzoom, attribution }: Props) {
  const { map, isLoaded } = useMap()

  useEffect(() => {
    if (!map || !isLoaded) return
    // tileSize 256: MapLibre assumes 512 and would request one zoom level too coarse.
    map.addSource(id, { type: "raster", tiles: [tiles], tileSize: 256, maxzoom, attribution })
    // Below the basemap's first label so place names stay readable.
    const firstLabel = map.getStyle().layers.find((l) => l.type === "symbol")?.id
    map.addLayer(
      { id, type: "raster", source: id, layout: { visibility: "none" }, paint: { "raster-fade-duration": 300 } },
      firstLabel
    )
    return () => {
      if (!map.style) return // map already removed
      if (map.getLayer(id)) map.removeLayer(id)
      if (map.getSource(id)) map.removeSource(id)
    }
    // tiles, opacity and visibility are synced below without re-creating the source
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, isLoaded, id])

  useEffect(() => {
    if (!map || !isLoaded || !map.getLayer(id)) return
    map.setPaintProperty(id, "raster-opacity", opacity)
    // visibility none also stops tile requests for layers that are switched off
    map.setLayoutProperty(id, "visibility", visible ? "visible" : "none")
  }, [map, isLoaded, id, opacity, visible])

  useEffect(() => {
    if (!map || !isLoaded) return
    // setTiles keeps the old tiles on screen until the new date has loaded
    ;(map.getSource(id) as RasterTileSource | undefined)?.setTiles([tiles])
  }, [map, isLoaded, id, tiles])

  return null
}

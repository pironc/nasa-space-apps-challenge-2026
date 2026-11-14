import area from "@turf/area"
import type { Feature, Polygon } from "geojson"
import { useEffect, useRef, useState } from "react"
import {
  TerraDraw,
  TerraDrawPolygonMode,
  TerraDrawSelectMode,
  ValidateMaxAreaSquareMeters,
  ValidateNotSelfIntersecting,
} from "terra-draw"
import { TerraDrawMapLibreGLAdapter } from "terra-draw-maplibre-gl-adapter"
import { useMap } from "@/components/ui/map"

export const MAX_HA = 5_000

const hectares = (f: Feature<Polygon>) => area(f) / 10_000

type Shape = { polygon: Polygon; ha: number }

const isOutline = (f: { geometry: { type: string }; properties: Record<string, unknown> }) =>
  f.geometry.type === "Polygon" && !f.properties.midPoint && !f.properties.selectionPoint

/**
 * Draw one field outline. `shape` follows the polygon live, including while its
 * corners are dragged after closing, so the caller always saves what is on screen.
 */
export function useFieldDraw() {
  const { map, isLoaded } = useMap()
  const drawRef = useRef<TerraDraw | null>(null)
  const [shape, setShape] = useState<Shape | null>(null)
  const [closed, setClosed] = useState(false)

  useEffect(() => {
    if (!map || !isLoaded) return
    const draw = new TerraDraw({
      adapter: new TerraDrawMapLibreGLAdapter({ map }),
      modes: [
        new TerraDrawPolygonMode({
          validation: (f, ctx) => {
            if (ctx.updateType !== "finish" && ctx.updateType !== "commit") return { valid: true }
            const simple = ValidateNotSelfIntersecting(f)
            return simple.valid ? ValidateMaxAreaSquareMeters(f, MAX_HA * 10_000) : simple
          },
        }),
        new TerraDrawSelectMode({
          flags: {
            polygon: { feature: { draggable: true, coordinates: { midpoints: true, draggable: true, deletable: true } } },
          },
        }),
      ],
    })
    draw.start()
    draw.on("change", () => {
      const f = draw.getSnapshot().find(isOutline) as Feature<Polygon> | undefined
      setShape(f && f.geometry.coordinates[0].length >= 4 ? { polygon: f.geometry, ha: hectares(f) } : null)
    })
    draw.on("finish", (id) => {
      // Closed: switch to select mode so corners can still be adjusted before saving.
      if (draw.getMode() !== "polygon") return
      draw.setMode("select")
      draw.selectFeature(id)
      setClosed(true)
    })
    drawRef.current = draw
    return () => {
      if (map.style) draw.stop()
      drawRef.current = null
    }
  }, [map, isLoaded])

  return {
    shape,
    closed,
    start: () => {
      drawRef.current?.clear()
      setShape(null)
      setClosed(false)
      drawRef.current?.setMode("polygon")
    },
    stop: () => {
      drawRef.current?.clear()
      drawRef.current?.setMode("static")
      setShape(null)
      setClosed(false)
    },
  }
}

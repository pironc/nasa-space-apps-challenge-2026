import area from '@turf/area'
import type { Feature, Polygon } from 'geojson'
import { useEffect, useRef, useState } from 'react'
import { TerraDraw, TerraDrawPolygonMode, TerraDrawSelectMode, ValidateMaxAreaSquareMeters, ValidateNotSelfIntersecting } from 'terra-draw'
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter'
import { useMap } from '@/components/ui/map'

const MAX_M2 = 5_000 * 10_000 // 5,000 ha cap from the brief

export const hectares = (f: Feature<Polygon>) => area(f) / 10_000

export function useFieldDraw(onFinish: (f: Feature<Polygon>, ha: number) => void) {
  const { map, isLoaded } = useMap()
  const drawRef = useRef<TerraDraw | null>(null)
  const [liveHa, setLiveHa] = useState<number | null>(null)
  const cb = useRef(onFinish)
  cb.current = onFinish

  useEffect(() => {
    if (!map || !isLoaded) return
    const draw = new TerraDraw({
      adapter: new TerraDrawMapLibreGLAdapter({ map }),
      modes: [
        new TerraDrawPolygonMode({
          validation: (f, ctx) => {
            if (ctx.updateType !== 'finish' && ctx.updateType !== 'commit') return { valid: true }
            const simple = ValidateNotSelfIntersecting(f)
            return simple.valid ? ValidateMaxAreaSquareMeters(f, MAX_M2) : simple
          },
        }),
        new TerraDrawSelectMode({
          flags: { polygon: { feature: { draggable: true, coordinates: { midpoints: true, draggable: true, deletable: true } } } },
        }),
      ],
    })
    draw.start()
    draw.on('change', () => {
      const poly = draw.getSnapshot().find((f) => f.geometry.type === 'Polygon' && !f.properties.midPoint && !f.properties.selectionPoint)
      setLiveHa(poly ? hectares(poly as Feature<Polygon>) : null)
    })
    draw.on('finish', (id) => {
      const f = draw.getSnapshotFeature(id)
      if (f?.geometry.type === 'Polygon') cb.current(f as Feature<Polygon>, hectares(f as Feature<Polygon>))
    })
    drawRef.current = draw
    return () => {
      if (map.style) draw.stop()
      drawRef.current = null
    }
  }, [map, isLoaded])

  return {
    liveHa,
    setMode: (m: 'polygon' | 'select' | 'static') => drawRef.current?.setMode(m),
    clear: () => drawRef.current?.clear(),
    exportGeoJSON: () => ({ type: 'FeatureCollection' as const, features: drawRef.current?.getSnapshot() ?? [] }),
  }
}

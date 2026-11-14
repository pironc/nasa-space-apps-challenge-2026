import type { RasterTileSource } from 'maplibre-gl'
import { useEffect } from 'react'
import { useMap } from '@/components/ui/map'

type Props = {
  id: string
  tiles: string
  visible?: boolean
  opacity?: number
  maxzoom?: number
  bounds?: [number, number, number, number]
  attribution?: string
  beforeId?: string
}

export function RasterLayer({ id, tiles, visible = true, opacity = 1, maxzoom = 22, bounds, attribution, beforeId }: Props) {
  const { map, isLoaded } = useMap()

  useEffect(() => {
    if (!map || !isLoaded) return
    map.addSource(id, { type: 'raster', tiles: [tiles], tileSize: 256, maxzoom, attribution, ...(bounds && { bounds }) })
    map.addLayer({ id, type: 'raster', source: id, paint: { 'raster-fade-duration': 300 } }, beforeId && map.getLayer(beforeId) ? beforeId : undefined)
    return () => {
      if (!map.style) return // map already removed or style swapped
      if (map.getLayer(id)) map.removeLayer(id)
      if (map.getSource(id)) map.removeSource(id)
    }
    // tiles/opacity/visible are synced below without re-creating the source
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, isLoaded, id])

  useEffect(() => {
    if (!map || !isLoaded) return
    ;(map.getSource(id) as RasterTileSource | undefined)?.setTiles([tiles]) // old tiles stay until new ones arrive
  }, [map, isLoaded, id, tiles])

  useEffect(() => {
    if (!map || !isLoaded || !map.getLayer(id)) return
    map.setPaintProperty(id, 'raster-opacity', opacity)
    map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
  }, [map, isLoaded, id, opacity, visible])

  return null
}

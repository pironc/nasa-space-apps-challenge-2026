import type { Feature, FeatureCollection, Polygon } from 'geojson'
import type { ExpressionSpecification } from 'maplibre-gl'
import { Pause, Pencil, Play, SquareDashedMousePointer, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Map, MapControls, MapGeoJSON, useMap } from '@/components/ui/map'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { RasterLayer } from '@/map/RasterLayer'
import { BASEMAPS, eoxUrl, gibsUrl, pcNdviUrl } from '@/map/sources'
import { useFieldDraw } from '@/map/useFieldDraw'

const STATUS_COLOR: ExpressionSpecification = ['match', ['get', 'status'], 'alert', '#dc2626', 'watch', '#f59e0b', '#16a34a']
const DAY = 86_400_000
const START = Date.UTC(2021, 4, 1)
const iso = (d: number) => new Date(START + d * DAY).toISOString().slice(0, 10)

type FieldProps = { id: string; name: string; status: 'ok' | 'watch' | 'alert' }

function FieldLabels({ data }: { data: FeatureCollection<Polygon, FieldProps> }) {
  const { map, isLoaded } = useMap()
  useEffect(() => {
    if (!map || !isLoaded) return
    map.addSource('field-labels', { type: 'geojson', data })
    map.addLayer({
      id: 'field-labels',
      type: 'symbol',
      source: 'field-labels',
      layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 12 },
      paint: { 'text-halo-color': '#fff', 'text-halo-width': 1.5 },
    })
    return () => {
      if (!map.style) return
      map.removeLayer('field-labels')
      map.removeSource('field-labels')
    }
  }, [map, isLoaded, data])
  return null
}

function Expose() {
  const { map } = useMap()
  useEffect(() => {
    ;(window as unknown as { __map: unknown }).__map = map
  }, [map])
  return null
}

function DrawToolbar({ onSave }: { onSave: (f: Feature<Polygon>, ha: number) => void }) {
  const draw = useFieldDraw(onSave)
  return (
    <div className="absolute top-3 left-3 flex items-center gap-1 rounded-lg border bg-background p-1 shadow-sm">
      <Button size="icon" variant="ghost" aria-label="Draw field" onClick={() => draw.setMode('polygon')}><Pencil /></Button>
      <Button size="icon" variant="ghost" aria-label="Edit field" onClick={() => draw.setMode('select')}><SquareDashedMousePointer /></Button>
      <Button size="icon" variant="ghost" aria-label="Delete drawing" onClick={draw.clear}><Trash2 /></Button>
      {draw.liveHa !== null && <span className="px-2 text-sm tabular-nums">{draw.liveHa.toFixed(1)} ha</span>}
    </div>
  )
}

export default function App() {
  const [day, setDay] = useState(75)
  const [playing, setPlaying] = useState(false)
  const [ndviOn, setNdviOn] = useState(true)
  const [opacity, setOpacity] = useState(0.8)
  const [fields, setFields] = useState<FeatureCollection<Polygon, FieldProps>>({ type: 'FeatureCollection', features: [] })
  const date = iso(day)

  useEffect(() => {
    if (!playing) return
    const t = setInterval(() => setDay((d) => (d + 16) % 153), 1200)
    return () => clearInterval(t)
  }, [playing])

  return (
    <div className="relative h-dvh w-full">
      <Map center={[63.6, 53.2]} zoom={7} styles={BASEMAPS}>
        <RasterLayer id="sat" tiles={eoxUrl(2021)} maxzoom={14} attribution="Sentinel-2 cloudless by EOX (Contains modified Copernicus Sentinel data 2021)" />
        <RasterLayer id="truecolor" tiles={gibsUrl('MODIS_Terra_CorrectedReflectance_TrueColor', date, 9, 'jpg')} maxzoom={9} attribution="NASA GIBS" />
        <RasterLayer id="ndvi" tiles={gibsUrl('MODIS_Terra_L3_NDVI_16Day', date, 9, 'png')} maxzoom={9} visible={ndviOn} opacity={opacity} />
        <RasterLayer id="s2-ndvi" tiles={pcNdviUrl('S2A_MSIL2A_20210722T064631_R020_T41UNV_20210722T160824')} bounds={[63.1085896, 53.1498599, 64.6803359, 54.1442652]} />
        <MapGeoJSON data={fields} promoteId="id" interactive fillPaint={{ 'fill-color': STATUS_COLOR, 'fill-opacity': 0.35 }} linePaint={{ 'line-color': STATUS_COLOR, 'line-width': 2 }} onClick={(e) => console.log(e.feature.properties.name)} />
        <FieldLabels data={fields} />
        <Expose />
        <MapControls position="bottom-right" showZoom showLocate />
        <DrawToolbar
          onSave={(f, ha) =>
            setFields((fc) => ({ ...fc, features: [...fc.features, { ...f, properties: { id: crypto.randomUUID(), name: `Field ${fc.features.length + 1} (${ha.toFixed(0)} ha)`, status: 'watch' } }] }))
          }
        />
      </Map>
      <div className="absolute inset-x-3 bottom-3 mx-auto flex max-w-xl items-center gap-3 rounded-lg border bg-background p-3 shadow-sm">
        <Button size="icon" variant="outline" aria-label={playing ? 'Pause' : 'Play'} onClick={() => setPlaying((p) => !p)}>{playing ? <Pause /> : <Play />}</Button>
        <Slider min={0} max={152} step={1} value={[day]} onValueChange={(v) => setDay(Array.isArray(v) ? v[0] : v)} />
        <span className="w-24 shrink-0 text-sm tabular-nums" data-testid="date">{date}</span>
        <Switch checked={ndviOn} onCheckedChange={setNdviOn} aria-label="NDVI layer" />
        <Slider className="w-24" min={0} max={1} step={0.05} value={[opacity]} onValueChange={(v) => setOpacity(Array.isArray(v) ? v[0] : v)} />
      </div>
    </div>
  )
}

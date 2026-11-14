import type { Feature, FeatureCollection, Point, Polygon } from "geojson"
import { PencilLineIcon } from "lucide-react"
import type { FillLayerSpecification, LineLayerSpecification } from "maplibre-gl"
import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Map, MapControls, MapGeoJSON, useMap } from "@/components/ui/map"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { bounds, centre, formatHa, MAX_HA, ROTATIONS, sizeProblem, type RotationId, type SavedField } from "@/lib/fields"
import { BASEMAP, LAYERS, type LayerState } from "@/lib/layers"
import { RasterLayer } from "@/map/RasterLayer"
import { useFieldDraw } from "@/map/useFieldDraw"

// The one accent. Reds, oranges, yellows and greens belong to the data underneath.
const ACCENT = "#256abf"
const FILL: FillLayerSpecification["paint"] = { "fill-color": ACCENT, "fill-opacity": ["case", ["get", "selected"], 0.22, 0.06] }
const LINE: LineLayerSpecification["paint"] = { "line-color": ACCENT, "line-width": ["case", ["get", "selected"], 3, 1.5] }

type FieldProps = { id: string; name: string; selected: boolean }

function FieldLabels({ data }: { data: FeatureCollection<Polygon, FieldProps> }) {
  const { map, isLoaded } = useMap()
  useEffect(() => {
    if (!map || !isLoaded) return
    // One point per field: a label on the polygon itself is repeated in every map tile it crosses.
    const points: FeatureCollection<Point, FieldProps> = {
      type: "FeatureCollection",
      features: data.features.map((f) => ({ ...f, geometry: { type: "Point", coordinates: centre(f.geometry) } })),
    }
    map.addSource("field-labels", { type: "geojson", data: points })
    map.addLayer({
      id: "field-labels",
      type: "symbol",
      source: "field-labels",
      // Noto Sans Regular is the font the OpenFreeMap styles ship
      layout: { "text-field": ["get", "name"], "text-font": ["Noto Sans Regular"], "text-size": 13 },
      paint: { "text-color": "#0b1f3a", "text-halo-color": "#fff", "text-halo-width": 2, "text-halo-blur": 0 },
    })
    return () => {
      if (!map.style) return
      map.removeLayer("field-labels")
      map.removeSource("field-labels")
    }
  }, [map, isLoaded, data])
  return null
}

/** What surrounds the map: a narrow or wide panel beside it, or (on a phone) a drawer over its lower part. */
type Layout = "narrow" | "wide" | "drawer"

/** Brings the selected field into view, also on first load from a shared link and when the map changes size. */
function FitToField({ field, layout }: { field: SavedField | undefined; layout: Layout }) {
  const { map, isLoaded } = useMap()
  const id = field?.id
  useEffect(() => {
    if (!map || !isLoaded || !field) return
    map.resize() // the panel has just changed width: measure the map now rather than after the fit
    const { clientWidth: w, clientHeight: h } = map.getContainer()
    // On a phone the drawer covers the lower 80% of the map, so the field goes in the strip left above it.
    // Beside a wide panel the map is narrow: keep the padding to a fifth of it.
    const padding = layout === "drawer" ? { top: 56, bottom: Math.round(h * 0.8) + 12, left: 24, right: 24 } : Math.min(96, Math.round(w / 5))
    map.fitBounds(bounds(field.geometry), { padding, maxZoom: 13, duration: 600 })
    // refit when the selection or the layout changes, not when the field object does
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, isLoaded, id, layout])
  return null
}

type NewField = Pick<SavedField, "name" | "rotation" | "areaHa" | "geometry">

function DrawToolbar({ onStart, onSave }: { onStart: () => void; onSave: (f: NewField) => void }) {
  const draw = useFieldDraw()
  const [active, setActive] = useState(false)
  const [name, setName] = useState("")
  const [rotation, setRotation] = useState<RotationId>("wwww")
  const problem = draw.shape && sizeProblem(draw.shape.ha)
  // an outline being drawn starts small, so only "too large" is said before it is closed
  const tooLarge = !!draw.shape && draw.shape.ha > MAX_HA

  const cancel = () => {
    draw.stop()
    setActive(false)
    setName("")
  }

  return (
    <div className="absolute top-3 left-3 z-10 flex max-w-[calc(100%-4.5rem)] items-start gap-2 font-sans text-sm">
      <SidebarTrigger variant="outline" className="size-8 bg-background shadow-sm" />
      {!active ? (
        <Button
          variant="outline"
          className="bg-background shadow-sm"
          onClick={() => {
            onStart()
            draw.start()
            setActive(true)
          }}
        >
          <PencilLineIcon data-icon="inline-start" />
          Draw field
        </Button>
      ) : !draw.closed ? (
        <div className="flex items-center gap-3 rounded-lg border bg-background py-1.5 pr-1.5 pl-3 text-sm shadow-sm">
          <span className={tooLarge ? "text-destructive" : "text-muted-foreground"}>
            {tooLarge ? problem : "Click each corner of the field, then the first corner again to close it."}
          </span>
          {draw.shape && <span className="font-medium tabular-nums">{formatHa(draw.shape.ha)}</span>}
          <Button size="sm" variant="ghost" onClick={cancel}>
            Cancel
          </Button>
        </div>
      ) : (
        <form
          className="flex w-72 flex-col gap-3 rounded-lg border bg-background p-3 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault()
            if (!draw.shape || problem) return
            onSave({ name: name.trim() || "Unnamed field", rotation, areaHa: draw.shape.ha, geometry: draw.shape.polygon })
            cancel()
          }}
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-medium">New field</span>
            {draw.shape && (
              <span className={problem ? "text-sm text-destructive tabular-nums" : "text-sm text-muted-foreground tabular-nums"}>
                {formatHa(draw.shape.ha)}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="field-name">Name</Label>
            <Input id="field-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="North block" autoFocus maxLength={40} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="field-rotation">Current rotation</Label>
            <Select value={rotation} onValueChange={(v) => setRotation(v as RotationId)}>
              <SelectTrigger id="field-rotation" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ROTATIONS).map(([id, label]) => (
                  <SelectItem key={id} value={id}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Satellites cannot tell which crop is sown, so this comes from you.</p>
          </div>
          {problem ? (
            <p aria-live="polite" className="text-xs text-destructive">
              {problem} Drag a corner on the map to change the outline; it cannot be saved at this size.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Drag a corner on the map to adjust the outline.</p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={cancel}>
              Discard
            </Button>
            <Button type="submit" disabled={!!problem}>
              Save field
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}

type Props = {
  date: string
  layers: LayerState
  fields: SavedField[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  layout: Layout
  onSave: (f: NewField) => void
}

export function FieldMap({ date, layers, fields, selectedId, onSelect, layout, onSave }: Props) {
  const year = +date.slice(0, 4)

  const data = useMemo<FeatureCollection<Polygon, FieldProps>>(
    () => ({
      type: "FeatureCollection",
      features: fields.map(
        (f): Feature<Polygon, FieldProps> => ({
          type: "Feature",
          geometry: f.geometry,
          properties: { id: f.id, name: f.name, selected: f.id === selectedId },
        })
      ),
    }),
    [fields, selectedId]
  )

  return (
    <Map
      theme="light"
      styles={{ light: BASEMAP, dark: BASEMAP }}
      center={[66.5, 52.6]}
      zoom={5}
      minZoom={2}
      maxZoom={16}
      attributionControl={{ compact: true }}
    >
      {LAYERS.map((l) => (
        <RasterLayer
          key={l.id}
          id={l.id}
          tiles={l.tiles(date)}
          visible={layers[l.id].on && year >= l.since}
          opacity={layers[l.id].opacity}
          maxzoom={l.maxzoom}
          attribution={l.attribution}
        />
      ))}
      <MapGeoJSON data={data} promoteId="id" interactive fillPaint={FILL} linePaint={LINE} onClick={(e) => onSelect(e.feature.properties.id)} />
      <FieldLabels data={data} />
      <FitToField field={fields.find((f) => f.id === selectedId)} layout={layout} />
      <MapControls position="top-right" />
      {/* On a phone the drawer leaves too little map to draw on: starting an outline closes it. */}
      <DrawToolbar onStart={() => layout === "drawer" && onSelect(null)} onSave={onSave} />
    </Map>
  )
}

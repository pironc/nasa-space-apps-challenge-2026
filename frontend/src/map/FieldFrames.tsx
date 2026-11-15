import { useEffect } from "react"
import { useMap } from "@/components/ui/map"
import { frameUrl, type Blend, type Frames } from "@/lib/frames"

type Props = {
  fieldId: string
  frames: Frames
  /** Only this year's images are put on the map. */
  year: number
  blend: Blend | null
  visible: boolean
  opacity: number
  /** Opacity changes glide over this many ms, so stepping day by day reads as motion. */
  glide: number
}

/**
 * The saved images of one field for one year, each a single picture on the map. All of them load up
 * front (they are small local files), so the animation only changes opacities: the day's image at full
 * strength and the next image fading in over it.
 */
export function FieldFrames({
  fieldId,
  frames,
  year,
  blend,
  visible,
  opacity,
  glide,
}: Props) {
  const { map, isLoaded } = useMap()
  const list = frames.frames.filter((f) => f.date.startsWith(String(year)))
  const key = `${fieldId}:${year}`
  const ids = list.map((f) => `frame-${fieldId}-${f.date}`)

  useEffect(() => {
    if (!map || !isLoaded) return
    const [w, s, e, n] = frames.bounds
    const firstLabel = map
      .getStyle()
      .layers.find((l) => l.type === "symbol")?.id
    list.forEach((f, i) => {
      map.addSource(ids[i], {
        type: "image",
        url: frameUrl(fieldId, f.file),
        coordinates: [
          [w, n],
          [e, n],
          [e, s],
          [w, s],
        ],
      })
      // later images sit above earlier ones, so the next image can fade in over the current one
      map.addLayer(
        {
          id: ids[i],
          type: "raster",
          source: ids[i],
          paint: { "raster-opacity": 0, "raster-fade-duration": 0 },
        },
        firstLabel
      )
    })
    return () => {
      if (!map.style) return
      ids.forEach((id) => {
        if (map.getLayer(id)) map.removeLayer(id)
        if (map.getSource(id)) map.removeSource(id)
      })
    }
    // one set of layers per field and year
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, isLoaded, key])

  useEffect(() => {
    if (!map || !isLoaded) return
    list.forEach((f, i) => {
      if (!map.getLayer(ids[i])) return
      const strength =
        !visible || !blend
          ? 0
          : f.date === blend.a
            ? 1
            : f.date === blend.b
              ? blend.t
              : 0
      map.setPaintProperty(ids[i], "raster-opacity-transition", {
        duration: glide,
        delay: 0,
      })
      map.setPaintProperty(ids[i], "raster-opacity", strength * opacity)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    map,
    isLoaded,
    key,
    blend?.a,
    blend?.b,
    blend?.t,
    visible,
    opacity,
    glide,
  ])

  return null
}

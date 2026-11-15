import { LAYERS, VIEWS } from "@/lib/layers"

/** How to read the layer the map shows: its colour scale and one line of words. */
export function MapKey({ view }: { view: string }) {
  const id = VIEWS.find((v) => v.id === view)?.layer
  const layer = LAYERS.find((l) => l.id === id)
  if (!layer) return null
  return (
    <div className="flex max-w-[26rem] flex-col gap-1 px-2 pb-1">
      {layer.ramp && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
          <span>0</span>
          <div className="flex h-2.5 flex-1 overflow-hidden rounded-sm border">
            {layer.ramp.map((c) => (
              <span key={c} className="flex-1" style={{ background: c }} />
            ))}
          </div>
          <span>0.9</span>
        </div>
      )}
      {layer.legend && (
        <img
          src={layer.legend}
          alt=""
          className="hidden h-auto w-full max-w-72 rounded-sm bg-white @md:block"
          loading="lazy"
        />
      )}
      {/* on a phone the map is small: the colour bar stays, the words wait for a wider screen */}
      <p className="hidden text-xs text-pretty text-muted-foreground @md:block">
        {layer.key}
      </p>
    </div>
  )
}

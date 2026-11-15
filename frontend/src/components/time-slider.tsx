import { PauseIcon, PlayIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import {
  dayIndex,
  dayOf,
  daysIn,
  formatDate,
  snapDate,
  YEARS,
} from "@/lib/layers"

// Play waits for the next frame to finish loading, so the map never shows a half-drawn day,
// but is never stuck longer than this on a slow tile server.
const MAX_WAIT_MS = 4000
const QUARTERS = [
  ["Jan", 0],
  ["Apr", 90],
  ["Jul", 181],
  ["Oct", 273],
] as const

const formatDay = (d: string) =>
  new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })

type Props = {
  date: string
  onChange: (date: string) => void
  /** The date play moves to next. */
  step: (date: string) => string
  /** Shortest time per play step. */
  stepMs: number
  /** The next frame of every visible layer has loaded. */
  ready: boolean
  /** The live field image shown: its date, null when none is clear enough, undefined when not applicable. */
  scene: { date: string } | null | undefined
  /** Saved field images blended for the day (demo years): which two, and how far between them. */
  blend?: { a: string; b: string | null; t: number } | null
  /** Clear Sentinel-2 passes over the selected field, drawn as ticks on the track. */
  sceneDates: string[]
  /** The vegetation layer is on, so its 16-day period is worth naming. */
  vegetation: boolean
}

/** Moves through one year day by day; each layer shows what exists for that day. */
export function TimeSlider({
  date,
  onChange,
  step,
  stepMs,
  ready,
  scene,
  blend,
  sceneDates,
  vegetation,
}: Props) {
  const year = +date.slice(0, 4)
  const days = daysIn(year)
  const index = dayIndex(date)
  // While dragging, the label follows every move and the map follows a few times a second.
  const [draft, setDraft] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const shown = draft === null ? date : dayOf(year, draft)

  const live = useRef({ date, ready, step, onChange, stepMs })
  useEffect(() => {
    live.current = { date, ready, step, onChange, stepMs }
  })
  const since = useRef(0)
  const lastDrag = useRef(0)
  useEffect(() => {
    since.current = performance.now()
  }, [date])
  useEffect(() => {
    if (!playing) return
    const t = setInterval(() => {
      const waited = performance.now() - since.current
      const { date, ready, step, onChange, stepMs } = live.current
      if (waited >= stepMs && (ready || waited > MAX_WAIT_MS))
        onChange(step(date))
    }, 30)
    return () => clearInterval(t)
  }, [playing])

  const ticks = sceneDates.filter((d) => d.startsWith(String(year)))

  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-background/95 p-4 shadow-md">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="icon"
          variant="outline"
          aria-pressed={playing}
          aria-label={playing ? "Pause" : "Play through the year"}
          onClick={() => setPlaying((p) => !p)}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </Button>
        <div className="flex min-w-[8.5rem] flex-1 flex-col gap-1 leading-tight">
          <div className="text-sm font-medium tabular-nums">
            {formatDate(shown)}
          </div>
          {blend !== undefined && (
            <div className="text-xs text-pretty text-muted-foreground tabular-nums">
              {!blend
                ? "No clear field image in the 30 days before"
                : blend.b && blend.t > 0
                  ? `Field image: ${formatDay(blend.a)}, fading into ${formatDay(blend.b)} (Sentinel-2)`
                  : `Field image from ${formatDay(blend.a)} (Sentinel-2)`}
            </div>
          )}
          {scene !== undefined && (
            <div className="text-xs text-pretty text-muted-foreground tabular-nums">
              {scene
                ? scene.date === shown
                  ? "Field image from this day (Sentinel-2)"
                  : `Field image from ${formatDate(scene.date)} (Sentinel-2)`
                : "No clear field image in the 30 days before"}
            </div>
          )}
          {vegetation && (
            <div className="text-xs text-pretty text-muted-foreground tabular-nums">
              Vegetation: 16-day period from {formatDate(snapDate(shown))}
            </div>
          )}
        </div>
        <Select
          value={String(year)}
          onValueChange={(y) => onChange(dayOf(+y, index))}
        >
          <SelectTrigger
            aria-label="Year"
            className="ml-auto w-24 tabular-nums"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {YEARS.map((y) => (
              <SelectItem key={y} value={String(y)} className="tabular-nums">
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        {/* one tick per clear Sentinel-2 pass over the field this year */}
        {ticks.length > 0 && (
          <div className="relative h-1.5" aria-hidden>
            {ticks.map((d) => (
              <span
                key={d}
                className="absolute top-0 h-1.5 w-px bg-foreground/50"
                style={{ left: `${(dayIndex(d) / (days - 1)) * 100}%` }}
              />
            ))}
          </div>
        )}
        <Slider
          aria-label="Date within the year"
          min={0}
          max={days - 1}
          step={1}
          value={[draft ?? index]}
          onValueChange={([v]) => {
            setDraft(v)
            // the map follows the drag, at most every 100 ms
            const now = performance.now()
            if (now - lastDrag.current > 100) {
              lastDrag.current = now
              onChange(dayOf(year, v))
            }
          }}
          onValueCommit={([v]) => {
            setDraft(null)
            onChange(dayOf(year, v))
          }}
        />
      </div>
      <div className="relative h-4 text-xs text-muted-foreground" aria-hidden>
        {QUARTERS.filter(([, d]) => d < days).map(([m, d]) => (
          <span
            key={m}
            className="absolute"
            style={{ left: `${(d / (days - 1)) * 100}%` }}
          >
            {m}
          </span>
        ))}
      </div>
      {ticks.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Ticks: days a satellite saw the field clearly.
        </p>
      )}
    </div>
  )
}

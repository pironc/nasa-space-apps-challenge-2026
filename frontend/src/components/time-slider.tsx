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
  addDays,
  clampDay,
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

const STEP_KEYS: Record<string, 1 | -1> = {
  ArrowRight: 1,
  ArrowUp: 1,
  PageUp: 1,
  ArrowLeft: -1,
  ArrowDown: -1,
  PageDown: -1,
}

const formatDay = (d: string) =>
  new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })

type Props = {
  date: string
  onChange: (date: string) => void
  /** A day moved to a day with data: back to the latest before it, or forward (dir 1). */
  snap: (date: string, dir?: -1 | 0 | 1) => string
  /** The date play moves to next. */
  step: (date: string) => string
  /** Shortest time per play step. */
  stepMs: number
  /** The next frame of every visible layer has loaded. */
  ready: boolean
  /** The Sentinel-2 pass shown: null when none is recent enough, undefined when the layer is not shown. */
  pass?: { date: string } | null
  /** The days with data this year, drawn as ticks on the track; empty when every day has data. */
  ticks: string[]
  /** The vegetation layer is on, so its composite is worth naming. */
  vegetation: boolean
}

/** Moves through one year, stopping only on days the layers shown have data for. */
export function TimeSlider({
  date,
  onChange,
  snap,
  step,
  stepMs,
  ready,
  pass,
  ticks,
  vegetation,
}: Props) {
  const year = +date.slice(0, 4)
  const days = daysIn(year)
  const index = dayIndex(date)
  const [playing, setPlaying] = useState(false)
  const shown = date

  const live = useRef({ date, ready, step, onChange, stepMs })
  useEffect(() => {
    live.current = { date, ready, step, onChange, stepMs }
  })
  const since = useRef(0)
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
          {/* only when another layer's day is shown: otherwise the date is the image's own */}
          {pass !== undefined && pass?.date !== shown && (
            <div className="text-xs text-pretty text-muted-foreground tabular-nums">
              {pass
                ? `Field image from ${formatDay(pass.date)} (Sentinel-2)`
                : "No clear field image in the 30 days before"}
            </div>
          )}
          {vegetation && (
            <div className="text-xs text-pretty text-muted-foreground tabular-nums">
              Regional NDVI: best of the 16 days from{" "}
              {formatDate(snapDate(shown))}
            </div>
          )}
        </div>
        <Select
          value={String(year)}
          onValueChange={(y) => onChange(snap(dayOf(+y, index)))}
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
        {/* one tick per day with data this year */}
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
          value={[index]}
          // dragging shows the latest image at or before the pointer
          onValueChange={([v]) => onChange(snap(dayOf(year, v)))}
          // arrow and page keys go to the next or previous day with data, never past the year
          onKeyDown={(e) => {
            const dir = STEP_KEYS[e.key]
            if (!dir) return
            e.preventDefault()
            const n = addDays(date, dir)
            if (n.startsWith(String(year)) && clampDay(n) === n)
              onChange(snap(n, dir))
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
          The slider stops only on days with an image: the ticks.
        </p>
      )}
    </div>
  )
}

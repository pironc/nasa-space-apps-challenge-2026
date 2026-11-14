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

// Play waits for the next frame to finish loading, so the map never shows a half-drawn date,
// but never faster than this and never stuck longer than the cap on a slow tile server.
const MIN_STEP_MS = 650
const MAX_WAIT_MS = 6000
const QUARTERS = [
  ["Jan", 0],
  ["Apr", 90],
  ["Jul", 181],
  ["Oct", 273],
] as const

type Props = {
  date: string
  onChange: (date: string) => void
  /** The date play moves to next (the next day, period or field image, depending on the layers on). */
  step: (date: string) => string
  /** The next frame of every visible layer has loaded. */
  ready: boolean
  /** The field image shown: its date, null when none is clear enough, undefined when not applicable. */
  scene: { date: string } | null | undefined
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
  ready,
  scene,
  sceneDates,
  vegetation,
}: Props) {
  const year = +date.slice(0, 4)
  const days = daysIn(year)
  const index = dayIndex(date)
  // While dragging only the label follows; tiles load on release.
  const [draft, setDraft] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const shown = draft === null ? date : dayOf(year, draft)

  const live = useRef({ date, ready, step, onChange })
  useEffect(() => {
    live.current = { date, ready, step, onChange }
  })
  const since = useRef(0)
  useEffect(() => {
    since.current = performance.now()
  }, [date])
  useEffect(() => {
    if (!playing) return
    const t = setInterval(() => {
      const waited = performance.now() - since.current
      const { date, ready, step, onChange } = live.current
      if (waited >= MIN_STEP_MS && (ready || waited > MAX_WAIT_MS))
        onChange(step(date))
    }, 100)
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
          onValueChange={([v]) => setDraft(v)}
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

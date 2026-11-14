import { PauseIcon, PlayIcon } from "lucide-react"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { formatDate, periodDates, YEARS } from "@/lib/layers"

const DAY = 86_400_000

type Props = { date: string; onChange: (date: string) => void }

/** Steps through the 16-day satellite periods of one year. */
export function TimeSlider({ date, onChange }: Props) {
  const year = +date.slice(0, 4)
  const dates = periodDates(year)
  const index = Math.max(0, dates.indexOf(date))
  // While dragging only the label follows; tiles load on release.
  const [draft, setDraft] = useState<number | null>(null)
  const [playing, setPlaying] = useState(false)
  const shown = dates[draft ?? index]
  const periodEnd = new Date(Date.parse(shown) + 15 * DAY)
    .toISOString()
    .slice(0, 10)

  useEffect(() => {
    if (!playing) return
    // 2.5 s per step: about the time a full screen of dated tiles takes to arrive
    const t = setInterval(
      () => onChange(dates[(index + 1) % dates.length]),
      2500
    )
    return () => clearInterval(t)
  }, [playing, index, dates, onChange])

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
          <div className="text-xs text-pretty text-muted-foreground tabular-nums">
            16-day period to {formatDate(periodEnd)}
          </div>
        </div>
        <Select
          value={String(year)}
          onValueChange={(y) => {
            const next = periodDates(+y)
            onChange(next[Math.min(index, next.length - 1)])
          }}
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
      <Slider
        aria-label="Date within the year"
        min={0}
        max={dates.length - 1}
        step={1}
        value={[draft ?? index]}
        onValueChange={([v]) => setDraft(v)}
        onValueCommit={([v]) => {
          setDraft(null)
          onChange(dates[v])
        }}
      />
      {/* quarter marks only line up when the year has all 23 periods */}
      <div
        className={`flex justify-between px-0.5 text-xs text-muted-foreground ${dates.length === 23 ? "" : "invisible"}`}
        aria-hidden
      >
        <span>Jan</span>
        <span>Apr</span>
        <span>Jul</span>
        <span>Oct</span>
        <span>Dec</span>
      </div>
    </div>
  )
}

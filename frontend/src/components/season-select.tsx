import { MapPinIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { MapFocus } from "@/lib/story"

/** The season a tab talks about; the map follows it. */
export function SeasonSelect({
  years,
  year,
  onYear,
}: {
  years: number[]
  year: number
  onYear: (year: number) => void
}) {
  const list = [...years].sort((a, b) => b - a)
  return (
    <Select value={String(year)} onValueChange={(v) => onYear(+v)}>
      <SelectTrigger
        aria-label="Season"
        size="sm"
        className="w-24 shrink-0 tabular-nums"
      >
        <SelectValue placeholder={String(year)} />
      </SelectTrigger>
      <SelectContent>
        {list.map((y) => (
          <SelectItem key={y} value={String(y)} className="tabular-nums">
            {y}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/** Says what the map shows for this season, and takes the map back there. */
export function FocusButton({
  focus,
  onFocus,
}: {
  focus: MapFocus | null
  onFocus: (focus: MapFocus) => void
}) {
  if (!focus) return null
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-auto justify-start gap-2 px-2 py-1.5 text-left text-xs font-normal whitespace-normal text-muted-foreground"
      onClick={() => onFocus(focus)}
    >
      <MapPinIcon data-icon="inline-start" className="text-primary" />
      {focus.says}
    </Button>
  )
}

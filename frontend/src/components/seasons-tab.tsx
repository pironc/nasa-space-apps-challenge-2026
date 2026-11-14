import { CircleCheckIcon, EyeIcon, InfoIcon, OctagonAlertIcon, TriangleAlertIcon, type LucideIcon } from "lucide-react"
import { useState } from "react"
import { Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ReferenceArea, XAxis, YAxis } from "recharts"

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { FieldAnalysis, LandUse, Severity } from "@/lib/analysis"
import { modisSentence, worstSeverity } from "@/lib/data"
import { FIRST_YEAR } from "@/lib/layers"

const USE: Record<LandUse, string> = {
  cropped: "Cropped",
  fallow: "Fallow",
  ambiguous: "Unclear",
  early_green: "Early green",
  unknown: "No data",
}

// Status colour sits on the icon only; the word next to it carries the same meaning.
const STATUS: Record<Severity | "none", { icon: LucideIcon; label: string; tone: string }> = {
  none: { icon: CircleCheckIcon, label: "No flags", tone: "text-status-good" },
  info: { icon: InfoIcon, label: "Note", tone: "text-muted-foreground" },
  watch: { icon: EyeIcon, label: "Watch", tone: "text-status-watch" },
  warning: { icon: TriangleAlertIcon, label: "Warning", tone: "text-status-warning" },
  severe: { icon: OctagonAlertIcon, label: "Severe", tone: "text-status-severe" },
}

function Status({ severity, className }: { severity: Severity | null; className?: string }) {
  const s = STATUS[severity ?? "none"]
  return <s.icon aria-label={s.label} className={`size-3.5 shrink-0 ${s.tone} ${className ?? ""}`} />
}

/** A legend entry: the mark carries the colour, the text stays in text ink. */
export function Key({ swatch, children }: { swatch: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden className={`inline-block shrink-0 ${swatch}`} />
      {children}
    </span>
  )
}

const ndviConfig = {
  band: { label: "Usual range" },
  median: { label: "Field's normal", color: "var(--muted-foreground)" },
  cmp: { label: "Comparison", color: "var(--chart-2)" },
  sel: { label: "Selected", color: "var(--chart-1)" },
} satisfies ChartConfig

const modisConfig = { peak: { label: "Peak greenness (NDVI)" } } satisfies ChartConfig

const HATCH = "repeating-linear-gradient(135deg,var(--muted-foreground) 0 1.5px,transparent 1.5px 4px)"

type Props = {
  analysis: FieldAnalysis
  year: number
  onYear: (year: number) => void
  /** The good demo year of a preset: the comparison a first visit opens on. */
  defaultCompare?: number
}

export function SeasonsTab({ analysis, year, onYear, defaultCompare }: Props) {
  const [compare, setCompare] = useState<number | null>(defaultCompare ?? null)
  const { seasons, baseline, modis, dekads } = analysis
  const season = seasons.find((s) => s.year === year)
  const other = compare === year ? undefined : seasons.find((s) => s.year === compare)
  const span = seasons.length ? `${seasons[0].year} to ${seasons.at(-1)!.year}` : ""

  const rows = dekads.map((dekad, i) => ({
    dekad,
    sel: season?.ndvi[i] ?? null,
    cmp: other?.ndvi[i] ?? null,
    median: baseline?.median[i] ?? null,
    band: baseline && baseline.p25[i] !== null && baseline.p75[i] !== null ? [baseline.p25[i], baseline.p75[i]] : null,
  }))

  return (
    <div className="flex flex-col gap-5">
      <ToggleGroup
        type="single"
        variant="outline"
        spacing={1}
        aria-label="Season"
        value={String(year)}
        onValueChange={(v) => v && onYear(+v)}
        className="grid w-full grid-cols-3 @xl:grid-cols-5 @3xl:grid-cols-9"
      >
        {seasons.map((s) => {
          const worst = worstSeverity(s)
          return (
            <ToggleGroupItem
              key={s.year}
              value={String(s.year)}
              className="h-auto flex-col items-start gap-0.5 px-2 py-1.5 text-left font-normal data-[state=on]:border-primary data-[state=on]:bg-primary/10"
            >
              <span className="text-sm font-medium tabular-nums">{s.year}</span>
              <span className="text-xs text-muted-foreground">{USE[s.use]}</span>
              <span className="flex items-center gap-1 text-xs">
                <Status severity={worst} />
                {STATUS[worst ?? "none"].label}
              </span>
            </ToggleGroupItem>
          )
        })}
      </ToggleGroup>

      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-sm font-medium">Sentinel-2 detail since 2018 (ESA)</h3>
            <p className="text-xs text-muted-foreground">Greenness (NDVI, 0 to 1) through the season, in ten-day steps</p>
          </div>
          <div className={season ? "flex items-center gap-2" : "hidden"}>
            <Label htmlFor="compare-year" className="text-xs font-normal text-muted-foreground">
              Compare with
            </Label>
            <Select value={String(compare ?? "none")} onValueChange={(v) => setCompare(v === "none" ? null : +v)}>
              <SelectTrigger id="compare-year" size="sm" className="w-24 tabular-nums">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {seasons
                  .filter((s) => s.year !== year)
                  .map((s) => (
                    <SelectItem key={s.year} value={String(s.year)} className="tabular-nums">
                      {s.year}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {season ? (
          <>
            <ChartContainer config={ndviConfig} className="aspect-auto h-52 w-full">
              <ComposedChart accessibilityLayer data={rows} margin={{ left: 0, right: 8, top: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="dekad"
                  ticks={dekads.filter((d) => d.startsWith("1 "))}
                  tickFormatter={(d: string) => d.slice(2)}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} width={36} tickLine={false} axisLine={false} className="tabular-nums" />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      indicator="line"
                      labelFormatter={(label) => `Ten days from ${label}`}
                      formatter={(value, name, item) => (
                        <>
                          <span aria-hidden className="w-1 shrink-0 rounded-[2px]" style={{ background: item.color }} />
                          <span className="flex-1 text-muted-foreground">
                            {name === "sel" ? year : name === "cmp" ? compare : ndviConfig[name as "median"].label}
                          </span>
                          <span className="font-medium text-foreground tabular-nums">{Number(value).toFixed(2)}</span>
                        </>
                      )}
                    />
                  }
                />
                <Area dataKey="band" stroke="none" fill="var(--muted-foreground)" fillOpacity={0.14} isAnimationActive={false} tooltipType="none" />
                <Line dataKey="median" stroke="var(--color-median)" strokeWidth={1.5} dot={false} activeDot={false} isAnimationActive={false} />
                {other && <Line dataKey="cmp" stroke="var(--color-cmp)" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />}
                <Line dataKey="sel" stroke="var(--color-sel)" strokeWidth={2} dot={{ r: 2 }} isAnimationActive={false} />
              </ComposedChart>
            </ChartContainer>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums">
              <Key swatch="h-0.5 w-4 rounded-full bg-chart-1">{year}</Key>
              {other && <Key swatch="h-0.5 w-4 rounded-full bg-chart-2">{other.year}</Key>}
              {baseline && (
                <>
                  <Key swatch="h-px w-4 bg-muted-foreground">This field's normal</Key>
                  <Key swatch="size-2.5 rounded-[2px] bg-muted-foreground/20">Usual range (middle half of its cropped years)</Key>
                </>
              )}
            </div>
            {!baseline && (
              <p className="text-xs text-muted-foreground">There are not enough cropped seasons yet to draw this field's own normal.</p>
            )}

            <ul className="flex flex-col gap-2.5">
              <li className="flex gap-2">
                <InfoIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <div>
                  <div className="font-medium">Land use in {year}: {USE[season.use].toLowerCase()} (inferred)</div>
                  <div className="text-xs text-pretty text-muted-foreground">
                    Read from the shape of the greenness curve alone. A fallow year and a failed crop can look alike, so check it against what
                    you know of the field.
                  </div>
                </div>
              </li>
              {season.verdicts.map((v) => (
                <li key={v.type} className="flex gap-2">
                  <Status severity={v.severity} className="mt-0.5" />
                  <div>
                    <div className="font-medium">
                      {v.title} <span className="font-normal text-muted-foreground">({STATUS[v.severity].label.toLowerCase()})</span>
                    </div>
                    <div className="text-xs text-pretty text-muted-foreground">{v.detail}</div>
                  </div>
                </li>
              ))}
              {season.verdicts.length === 0 && (
                <li className="flex gap-2">
                  <Status severity={null} className="mt-0.5" />
                  <div className="font-medium">Nothing flagged for {year}</div>
                </li>
              )}
            </ul>
          </>
        ) : (
          <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            Sentinel-2 detail for this field covers {span}. Pick one of those seasons above, or read {year} in the NASA MODIS record below.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <div>
          <h3 className="text-sm font-medium">NASA MODIS record since 2000</h3>
          <p className="text-xs text-muted-foreground">Peak summer greenness (NDVI) each year, at 250 m detail</p>
        </div>
        {modis ? (
          <>
            <p className="text-pretty">{modisSentence(modis.years, year)}</p>
            <ChartContainer config={modisConfig} className="aspect-auto h-32 w-full">
              <BarChart
                accessibilityLayer
                data={modis.years}
                margin={{ left: 0, right: 8, top: 4, bottom: 0 }}
                barCategoryGap={2}
                onClick={(s) => s.activeLabel && +s.activeLabel >= FIRST_YEAR && onYear(+s.activeLabel)}
              >
                <defs>
                  <pattern id="fallow-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="1.5" height="4" fill="var(--muted-foreground)" />
                  </pattern>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="year" ticks={modis.years.map((m) => m.year).filter((y) => y % 5 === 0)} tickLine={false} axisLine={false} className="tabular-nums" />
                <YAxis domain={[0, 1]} ticks={[0, 0.5, 1]} width={30} tickLine={false} axisLine={false} className="tabular-nums" />
                <ReferenceArea x1={year} x2={year} fill="var(--chart-1)" fillOpacity={0.12} stroke="none" />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      hideIndicator
                      labelFormatter={(_, payload) => {
                        const m = payload[0]?.payload
                        return m ? `${m.year}${m.use === "fallow" ? ", fallow (inferred)" : ""}` : null
                      }}
                      formatter={(value) => (
                        <>
                          <span className="flex-1 text-muted-foreground">Peak greenness (NDVI)</span>
                          <span className="font-medium text-foreground tabular-nums">{Number(value).toFixed(2)}</span>
                        </>
                      )}
                    />
                  }
                />
                <Bar dataKey="peak" radius={[2, 2, 0, 0]} isAnimationActive={false} className="cursor-pointer">
                  {modis.years.map((m) => (
                    <Cell
                      key={m.year}
                      fill={m.use === "fallow" ? "url(#fallow-hatch)" : m.year === year ? "var(--chart-1)" : "var(--muted-foreground)"}
                      fillOpacity={m.use === "fallow" || m.year === year ? 1 : 0.45}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <Key swatch="size-2.5 rounded-[2px] bg-chart-1">{year}</Key>
              <Key swatch="size-2.5 rounded-[2px] bg-muted-foreground/45">Cropped year</Key>
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="inline-block size-2.5 shrink-0 rounded-[2px]" style={{ background: HATCH }} />
                Fallow year (inferred)
              </span>
              <span>Empty: no reliable reading</span>
            </div>
            <p className="text-xs text-pretty text-muted-foreground">{modis.note}</p>
          </>
        ) : (
          <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            The NASA MODIS record is not available for this field. Its 250 m pixels are too coarse to read fields under about 100 ha.
          </p>
        )}
      </section>
    </div>
  )
}

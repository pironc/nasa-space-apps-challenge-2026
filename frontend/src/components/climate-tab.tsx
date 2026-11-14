import { Bar, BarChart, CartesianGrid, Cell, LabelList, ReferenceLine, XAxis, YAxis } from "recharts"

import { Key } from "@/components/seasons-tab"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { Cause, FieldAnalysis } from "@/lib/analysis"
import { FIRST_YEAR } from "@/lib/layers"

// Names of what the regional record shows. Whether it explains the field is said under "Weather and this field".
const SIGNAL: Record<Cause["type"], string> = {
  water_deficit: "Unusually dry spell",
  heat: "Unusual heat",
  frost: "Frost in the regional record",
  wet_harvest: "Rain at harvest",
}

const DROUGHT = { drought: "Drought by this area's own record", severe: "Severe drought by this area's own record" }

const mm = (v: number) => `${Math.round(v)} mm`
const dayMonth = (iso: string) => new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })

const Sub = ({ children }: { children: React.ReactNode }) => <div className="text-xs text-muted-foreground">{children}</div>

const Evidence = ({ lines }: { lines: string[] }) => (
  <ul className="flex list-disc flex-col gap-0.5 pl-4 text-xs text-pretty text-muted-foreground">
    {lines.map((e) => (
      <li key={e}>{e}</li>
    ))}
  </ul>
)

const rainConfig = { rainMayAug: { label: "May to August rain (mm)" } } satisfies ChartConfig

/** A small mark above the bars of the seasons listed in `climate.droughtYears`. */
function DroughtMark({ x = 0, y = 0, width = 0, value }: { x?: number | string; y?: number | string; width?: number | string; value?: unknown }) {
  if (!value) return null
  const cx = +x + +width / 2
  return <path d={`M${cx - 3.5} ${+y - 9}h7l-3.5 6z`} fill="var(--foreground)" />
}

type Props = {
  analysis: FieldAnalysis
  year: number
  onYear: (year: number) => void
}

export function ClimateTab({ analysis, year, onYear }: Props) {
  const { climate } = analysis
  const { normals } = climate
  const season = climate.seasons.find((s) => s.year === year)
  const selectable = climate.seasons.filter((s) => s.year >= FIRST_YEAR).reverse()
  const veg = analysis.seasons.find((s) => s.year === year)
  // A file without the newer fields gets no drought label and no named signal, only its numbers.
  const droughtLabel = season && DROUGHT[season.drought as keyof typeof DROUGHT]
  const robust = season?.causes.filter((c) => c.robust === true) ?? []
  const sowingDependent = season?.causes.filter((c) => c.robust !== true).flatMap((c) => c.evidence) ?? []
  const drought = new Set(climate.droughtYears)
  const rows = climate.seasons.map((s) => ({ ...s, marked: drought.has(s.year) }))
  const rainTop = Math.ceil(Math.max(normals.rainMayAug, ...rows.map((r) => r.rainMayAug)) / 100) * 100

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium">The {year} season against the 1991 to 2020 normal</h3>
          <div className="flex items-center gap-2">
            <Label htmlFor="climate-year" className="sr-only">
              Season
            </Label>
            <Select value={String(year)} onValueChange={(v) => onYear(+v)}>
              <SelectTrigger id="climate-year" size="sm" className="w-24 tabular-nums">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {selectable.map((s) => (
                  <SelectItem key={s.year} value={String(s.year)} className="tabular-nums">
                    {s.year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {season ? (
          <Table className="table-fixed">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-8 w-[46%] pl-0">Measure</TableHead>
                <TableHead className="h-8 text-right tabular-nums">{year}</TableHead>
                <TableHead className="h-8 w-[22%] pr-0 text-right">Normal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="tabular-nums [&_td]:py-1.5 [&_td]:align-top [&_td]:whitespace-normal [&_td:first-child]:pl-0 [&_td:last-child]:pr-0 [&_td:last-child]:text-muted-foreground [&_td:not(:first-child)]:text-right [&_tr:hover]:bg-transparent">
              <TableRow>
                <TableCell>
                  Rain
                  <Sub>May to August</Sub>
                </TableCell>
                <TableCell>
                  {mm(season.rainMayAug)}
                  <Sub>{season.rainMayAugPct}% of normal</Sub>
                </TableCell>
                <TableCell>{mm(normals.rainMayAug)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  Snow and rain
                  <Sub>October to April before the season</Sub>
                </TableCell>
                <TableCell>
                  {mm(season.rainOctApr)}
                  <Sub>{season.rainOctAprPct}% of normal</Sub>
                </TableCell>
                <TableCell>{mm(normals.rainOctApr)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  Hot days
                  <Sub>30 °C or more, May to August</Sub>
                </TableCell>
                <TableCell>{season.hotDays30}</TableCell>
                <TableCell>{Math.round(normals.hotDays30)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>
                  Hydrothermal coefficient
                  <Sub>Rain set against heat. Around 1 is enough moisture.</Sub>
                </TableCell>
                <TableCell>
                  {season.htc.toFixed(2)}
                  <Sub>{season.htcClass}</Sub>
                  {season.htcRank != null && (
                    <Sub>
                      rank {season.htcRank} of {season.htcRankOf} <span className="whitespace-nowrap">(1 = driest)</span>
                    </Sub>
                  )}
                </TableCell>
                <TableCell>{normals.htc.toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>Hottest day</TableCell>
                <TableCell>
                  {season.tmaxPeak.toFixed(1)} °C
                  <Sub>{dayMonth(season.tmaxPeakDate)}</Sub>
                </TableCell>
                <TableCell />
              </TableRow>
              <TableRow>
                <TableCell>Longest dry spell</TableCell>
                <TableCell>{season.longestDrySpell} days</TableCell>
                <TableCell />
              </TableRow>
              <TableRow>
                <TableCell>First autumn frost</TableCell>
                <TableCell>
                  {season.firstAutumnFrost ? dayMonth(season.firstAutumnFrost) : "None in the regional record"}
                  <Sub>Frost pockets are not visible</Sub>
                </TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        ) : (
          <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">There is no weather record for {year} in this analysis.</p>
        )}
      </section>

      {season && (
        <section className="flex flex-col gap-3">
          <h3 className="text-sm font-medium">What stood out in the regional weather of {year}</h3>
          {droughtLabel && (
            <div>
              <div className="font-medium">{droughtLabel}</div>
              <Sub>
                Its hydrothermal coefficient is in the lowest {season.drought === "severe" ? "tenth" : "fifth"} of this area's seasons. Dry
                seasons are normal here, so only these are called a drought.
              </Sub>
            </div>
          )}
          {robust.length > 0 && (
            <ul className="flex flex-col gap-3">
              {robust.map((c) => (
                <li key={c.type} className="flex flex-col gap-1">
                  <span className="font-medium">{SIGNAL[c.type]}</span>
                  <Evidence lines={c.evidence} />
                </li>
              ))}
            </ul>
          )}
          {sowingDependent.length > 0 && (
            <div className="flex flex-col gap-1">
              <h4 className="font-medium">Depends on the sowing date</h4>
              <Sub>These numbers change with the sowing date assumed, so they are listed without a reading.</Sub>
              <Evidence lines={sowingDependent} />
            </div>
          )}
          {!droughtLabel && season.causes.length === 0 && (
            <p className="text-pretty text-muted-foreground">Nothing stood out in the regional weather record of {year}.</p>
          )}
          {veg?.explanation && (
            <div className="flex flex-col gap-1 border-t pt-2.5">
              <h4 className="text-xs font-medium text-muted-foreground">Weather and this field</h4>
              <p className="text-pretty">{veg.explanation}</p>
            </div>
          )}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <div>
          <h3 className="text-sm font-medium">May to August rain, every season since {climate.seasons[0]?.year}</h3>
          <p className="text-xs text-muted-foreground">Millimetres, with the 1991 to 2020 normal as the line</p>
        </div>
        <ChartContainer config={rainConfig} className="aspect-auto h-44 w-full">
          <BarChart
            accessibilityLayer
            data={rows}
            margin={{ left: 0, right: 8, top: 12, bottom: 0 }}
            barCategoryGap={2}
            onClick={(s) => s.activeLabel && +s.activeLabel >= FIRST_YEAR && onYear(+s.activeLabel)}
          >
            <CartesianGrid vertical={false} />
            <XAxis dataKey="year" ticks={rows.map((r) => r.year).filter((y) => y % 5 === 0)} tickLine={false} axisLine={false} className="tabular-nums" />
            <YAxis
              domain={[0, rainTop]}
              ticks={Array.from({ length: rainTop / 100 + 1 }, (_, i) => i * 100)}
              width={30}
              tickLine={false}
              axisLine={false}
              className="tabular-nums"
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  hideIndicator
                  labelFormatter={(_, payload) => {
                    const r = payload[0]?.payload
                    return r ? `${r.year}${r.marked ? ", drought by this area's own record" : ""}` : null
                  }}
                  formatter={(value) => (
                    <>
                      <span className="flex-1 text-muted-foreground">Rain, May to August</span>
                      <span className="font-medium text-foreground tabular-nums">{mm(Number(value))}</span>
                    </>
                  )}
                />
              }
            />
            <Bar dataKey="rainMayAug" radius={[2, 2, 0, 0]} isAnimationActive={false} className="cursor-pointer">
              {rows.map((r) => (
                <Cell key={r.year} fill={r.year === year ? "var(--chart-1)" : "var(--muted-foreground)"} fillOpacity={r.year === year ? 1 : 0.45} />
              ))}
              <LabelList dataKey="marked" content={DroughtMark} />
            </Bar>
            <ReferenceLine y={normals.rainMayAug} stroke="var(--foreground)" strokeOpacity={0.6} />
          </BarChart>
        </ChartContainer>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums">
          <Key swatch="size-2.5 rounded-[2px] bg-chart-1">{year}</Key>
          <Key swatch="h-px w-4 bg-foreground/60">Normal, {mm(normals.rainMayAug)}</Key>
          <span className="flex items-center gap-1.5">
            <svg aria-hidden viewBox="0 0 7 6" className="h-1.5 w-[7px] shrink-0 fill-foreground">
              <path d="M0 0h7l-3.5 6z" />
            </svg>
            Drought by this area's own record: {climate.droughtYears.length} of {climate.seasons.length} seasons
          </span>
        </div>
        <p className="text-pretty">{climate.trendNote}</p>
      </section>

      <p className="text-xs text-muted-foreground">
        Regional estimate for a grid cell of about 50 km (NASA POWER). Not a measurement on this field.
      </p>
    </div>
  )
}

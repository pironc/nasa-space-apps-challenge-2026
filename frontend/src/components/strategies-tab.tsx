import { EyeOffIcon, ScaleIcon, UserCheckIcon } from "lucide-react"
import { useMemo, type ReactNode } from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { FieldAnalysis, Indicator, Priorities, Strategy } from "@/lib/analysis"
import type { RotationId } from "@/lib/fields"
import { compareStrategies, cropLabel } from "@/lib/rotation"

const PRIORITIES: { key: keyof Priorities; label: string }[] = [
  { key: "water", label: "Save water" },
  { key: "soil", label: "Build soil" },
  { key: "income", label: "Market and output" },
]

const weight = (v: number) => (v < 0.34 ? "Low" : v < 0.67 ? "Medium" : "High")
const whatIf = (v: number) => (v === 0 ? "As recorded" : v < 0.5 ? "Somewhat" : "Markedly")

function Dial({ id, label, word, value, onChange }: { id: string; label: string; word?: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {word && <span className="text-xs text-muted-foreground">{word}</span>}
      </div>
      <Slider id={id} aria-label={label} min={0} max={1} step={0.05} value={[value]} onValueChange={([v]) => onChange(v)} />
    </div>
  )
}

/** One hue for every bar: the level word carries the reading, the bar the relative size. */
function Meter({ indicator }: { indicator: Indicator }) {
  return (
    <div
      role="meter"
      aria-label={indicator.label}
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={indicator.value}
      aria-valuetext={indicator.level}
      className="h-1.5 overflow-hidden rounded-full bg-chart-1/15"
    >
      <div className="h-full rounded-full bg-chart-1" style={{ width: `${Math.round(indicator.value * 100)}%` }} />
    </div>
  )
}

function Points({ title, icon, items }: { title: string; icon?: ReactNode; items: string[] }) {
  if (items.length === 0) return null
  return (
    <section className="flex flex-col gap-1">
      <h4 className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground [&>svg]:size-3.5">
        {icon}
        {title}
      </h4>
      <ul className="flex list-disc flex-col gap-1 pl-4 text-[0.8125rem] leading-snug marker:text-muted-foreground">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  )
}

function StrategyCard({ strategy }: { strategy: Strategy }) {
  return (
    <Card size="sm" className="@container/strategy">
      <CardHeader>
        <CardTitle>{strategy.title}</CardTitle>
        <CardDescription>{strategy.rotationLabel}</CardDescription>
        {strategy.evidenceGrade && (
          <p className="text-xs text-muted-foreground">
            Evidence: <span className="text-foreground">{strategy.evidenceGrade}</span>
          </p>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ol className="grid grid-cols-2 gap-1 @xs/strategy:grid-cols-4">
          {strategy.rotation.map((id, i) => (
            <li key={i} className="rounded-md border px-2 py-1 leading-tight">
              <div className="text-[0.6875rem] text-muted-foreground">Year {i + 1}</div>
              <div className="text-xs font-medium">{cropLabel(id)}</div>
            </li>
          ))}
        </ol>
        <div className="flex flex-col gap-2">
          {strategy.indicators.map((ind) => (
            <div key={ind.key} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span>{ind.label}</span>
                <span className="text-muted-foreground">{ind.level}</span>
              </div>
              <Meter indicator={ind} />
            </div>
          ))}
        </div>
        {strategy.closeCall && (
          <p className="flex gap-2 rounded-md bg-muted px-2.5 py-2 text-xs">
            <ScaleIcon className="mt-px size-3.5 shrink-0 text-muted-foreground" />
            <span>
              <span className="font-medium">Close call. </span>
              {strategy.closeCall}
            </span>
          </p>
        )}
        <Points title="Why" items={strategy.why} />
        <Points title="What this rests on" items={strategy.evidence} />
        <Points title="Benefits" items={strategy.benefits} />
        {/* The product's promise: these two are on every card, never hidden. */}
        <div className="flex flex-col gap-3 border-t pt-3">
          <Points title="What satellites cannot see" icon={<EyeOffIcon />} items={strategy.gaps} />
          <Points title="Needs local review" icon={<UserCheckIcon />} items={strategy.localReview} />
        </div>
      </CardContent>
    </Card>
  )
}

type Props = {
  analysis: FieldAnalysis
  declared: RotationId
  priorities: Priorities
  onPriorities: (p: Priorities) => void
  drier: number
  onDrier: (v: number) => void
}

export function StrategiesTab({ analysis, declared, priorities, onPriorities, drier, onDrier }: Props) {
  const strategies = useMemo(() => compareStrategies({ analysis, declared, priorities, drier }), [analysis, declared, priorities, drier])

  return (
    <div className="flex flex-col gap-4">
      <section className="grid gap-3 @2xl:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-3 rounded-xl border p-3">
          <h3 className="text-sm font-medium">What matters to you</h3>
          <div className="grid gap-x-6 gap-y-3 @xl:grid-cols-3">
            {PRIORITIES.map(({ key, label }) => (
              <Dial
                key={key}
                id={`priority-${key}`}
                label={label}
                word={weight(priorities[key])}
                value={priorities[key]}
                onChange={(v) => onPriorities({ ...priorities, [key]: v })}
              />
            ))}
          </div>
        </div>
        <div className="flex flex-col justify-between gap-3 rounded-xl border border-dashed bg-muted/50 p-3">
          <Dial id="what-if-drier" label="Drier and hotter than the record" value={drier} onChange={onDrier} />
          <p className="flex justify-between gap-2 text-xs text-muted-foreground">
            <span>A what-if, not a forecast</span>
            <span>{whatIf(drier)}</span>
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Options to discuss with your agronomist</h3>
        {/* as many cards across as fit at 17rem each: three in the full-width panel, two when the map needs the room */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(17rem,1fr))] gap-3">
          {strategies.map((s, i) => (
            <StrategyCard key={i} strategy={s} />
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">Side by side</h3>
        <Table className="table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-auto w-[28%] py-2 pl-0 align-bottom whitespace-normal">Indicator</TableHead>
              {strategies.map((s, i) => (
                <TableHead key={i} className="h-auto py-2 align-bottom leading-tight whitespace-normal">
                  {s.title}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {strategies[0]?.indicators.map((row, i) => (
              <TableRow key={row.key} className="hover:bg-transparent">
                <TableCell className="pl-0 text-xs whitespace-normal">{row.label}</TableCell>
                {strategies.map((s, k) => (
                  <TableCell key={k}>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs">{s.indicators[i].level}</span>
                      <Meter indicator={s.indicators[i]} />
                    </div>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-xs text-pretty text-muted-foreground">
          Bars compare the options with each other. They are relative scores, not yield or price forecasts, and they rest on a draft crop
          catalogue that no local agronomist has reviewed (dated 2026-11-14). The choice stays with you and your agronomist.
        </p>
      </section>
    </div>
  )
}

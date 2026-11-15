import { RainRecord } from "@/components/climate-tab"
import { ModisRecord, Status } from "@/components/seasons-tab"
import type { FieldAnalysis } from "@/lib/analysis"
import { seasonStatus, type Declared } from "@/lib/data"
import { storyHeadline, timeline } from "@/lib/story"

type Props = {
  analysis: FieldAnalysis
  year: number
  onYear: (year: number) => void
  answers: Record<string, Declared>
  demo: boolean
}

/** Every season of the field at a glance: what grew, how it grew, and what the weather did. */
export function StoryTab({ analysis, year, onYear, answers, demo }: Props) {
  const rows = timeline(analysis, answers, demo).reverse()
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm font-medium text-pretty">
        {storyHeadline(analysis, answers, demo)}
      </p>

      <section className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-medium">Season by season</h3>
          <p className="text-xs text-pretty text-muted-foreground">
            Pick a season to see it on the map. Growth and Weather give the
            detail behind each line.
          </p>
        </div>
        <ul className="flex flex-col gap-1">
          {rows.map((r) => {
            const season = analysis.seasons.find((s) => s.year === r.year)!
            const status = seasonStatus(season, answers[r.year]) ?? "none"
            return (
              <li key={r.year}>
                <button
                  type="button"
                  aria-pressed={r.year === year}
                  onClick={() => onYear(r.year)}
                  className="grid w-full grid-cols-[3rem_1fr] gap-x-2 rounded-lg border border-transparent px-2 py-1.5 text-left transition-colors outline-none hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-pressed:border-primary aria-pressed:bg-primary/10"
                >
                  <span className="text-sm font-medium tabular-nums">
                    {r.year}
                  </span>
                  <span className="flex min-w-0 items-start gap-1.5 text-sm">
                    <Status severity={status} className="mt-0.5" />
                    <span className="text-pretty">
                      <span className="text-muted-foreground">{r.use}:</span>{" "}
                      {r.growth}
                    </span>
                  </span>
                  {r.weather && (
                    <span className="col-start-2 pl-5 text-xs text-pretty text-muted-foreground">
                      {r.weather}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-4 border-t pt-4">
        <h3 className="text-sm font-medium">The longer record</h3>
        <ModisRecord analysis={analysis} year={year} onYear={onYear} />
        <RainRecord analysis={analysis} year={year} onYear={onYear} />
      </section>
    </div>
  )
}

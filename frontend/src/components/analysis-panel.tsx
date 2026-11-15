import { MousePointerClickIcon, UnplugIcon } from "lucide-react"
import { lazy, Suspense, useState } from "react"

// The chart library is only needed on these two tabs: load it when one is opened.
const ClimateTab = lazy(() =>
  import("@/components/climate-tab").then((m) => ({ default: m.ClimateTab }))
)
const SeasonsTab = lazy(() =>
  import("@/components/seasons-tab").then((m) => ({ default: m.SeasonsTab }))
)
const StoryTab = lazy(() =>
  import("@/components/story-tab").then((m) => ({ default: m.StoryTab }))
)
import { StrategiesTab } from "@/components/strategies-tab"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { AnalysisState, Declared } from "@/lib/data"
import { formatHa, type RotationId, type SavedField } from "@/lib/fields"
import { DEFAULT_PRIORITIES } from "@/lib/rotation"
import type { MapFocus } from "@/lib/story"

/** In the order of the story: what happened, how the field grew, the weather, what to do. */
export const TABS = ["story", "growth", "weather", "options"] as const
export type TabId = (typeof TABS)[number]

/** Placeholders in the shape of what is about to appear, so nothing jumps when it does. */
function TabSkeleton({ tab }: { tab: TabId }) {
  if (tab === "options")
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-24 rounded-xl" />
        <div className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-96 rounded-xl" />
          ))}
        </div>
      </div>
    )
  if (tab === "growth" || tab === "story")
    return (
      <div className="flex flex-col gap-5">
        <div className="grid grid-cols-3 gap-1 @xl:grid-cols-5 @3xl:grid-cols-9">
          {Array.from({ length: 9 }, (_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-52" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-32" />
      </div>
    )
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-6" />
        ))}
      </div>
      <Skeleton className="h-16" />
      <Skeleton className="h-44" />
    </div>
  )
}

type Props = {
  field: SavedField | undefined
  state: AnalysisState
  tab: TabId
  onTabChange: (tab: TabId) => void
  /** The season the map date falls in: one selection shared by the map and the panel. */
  year: number
  onYear: (year: number) => void
  onRotation: (rotation: RotationId) => void
  /** Moves the map to the evidence a tab talks about. */
  onFocus: (focus: MapFocus) => void
  /** Land use the user gave for this field in this session, by year. */
  answers: Record<string, Declared>
  onDeclare: (year: number, use: Declared | null) => void
}

export function AnalysisPanel({
  field,
  state,
  tab,
  onTabChange,
  year,
  onYear,
  onRotation,
  onFocus,
  answers,
  onDeclare,
}: Props) {
  // The farmer's priorities belong to the person, not the field: they survive tab and field changes.
  const [priorities, setPriorities] = useState(DEFAULT_PRIORITIES)
  const [drier, setDrier] = useState(0)
  // The comparison year of each field, kept here so it survives a change of tab.
  const [compare, setCompare] = useState<Record<string, number | null>>({})

  if (!field) {
    return (
      <Empty className="h-full">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MousePointerClickIcon />
          </EmptyMedia>
          <EmptyTitle>Select a field</EmptyTitle>
          <EmptyDescription>
            Pick a demo field or one of your own, or click an outline on the
            map, to see how it has fared.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    // The tab strip comes first and keeps its width and its place at the right edge, so it does not move
    // under the pointer when the panel changes width between tabs.
    <Tabs
      value={tab}
      onValueChange={(v) => onTabChange(v as TabId)}
      className="@container h-full [scrollbar-gutter:stable] gap-4 overflow-y-auto p-4"
    >
      {state.status !== "failed" && (
        <TabsList className="w-full shrink-0 md:ml-auto md:w-96 md:max-w-full">
          <TabsTrigger value="story">Story</TabsTrigger>
          <TabsTrigger value="growth">Growth</TabsTrigger>
          <TabsTrigger value="weather">Weather</TabsTrigger>
          <TabsTrigger value="options">Options</TabsTrigger>
        </TabsList>
      )}
      <header>
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-lg leading-tight font-semibold tracking-tight text-balance [overflow-wrap:anywhere]">
            {field.name}
          </h2>
          <p className="text-sm text-muted-foreground tabular-nums">
            {field.preset && `${field.preset.region} · `}
            {formatHa(field.areaHa)}
          </p>
          {field.preset?.note && (
            <p className="text-xs text-pretty text-muted-foreground">
              {field.preset.note}
            </p>
          )}
        </div>
      </header>

      {state.status === "failed" ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UnplugIcon />
            </EmptyMedia>
            <EmptyTitle className="text-sm">
              {field.preset
                ? "This demo field did not load"
                : state.message
                  ? "This field was not analysed"
                  : "Live analysis is not available"}
            </EmptyTitle>
            <EmptyDescription className="text-xs">
              {field.preset
                ? "Its data file could not be read. Check the connection and try again."
                : // the service's own words when it answered; the fixed text only when it could not be reached
                  state.message ||
                  "Live analysis needs the analysis service, which is not reachable. The demo fields work without it."}
            </EmptyDescription>
          </EmptyHeader>
          {state.canRetry && (
            <EmptyContent>
              <Button variant="outline" size="sm" onClick={state.retry}>
                Retry
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : state.status === "loading" ? (
        <div
          role="status"
          aria-label="Loading the analysis"
          className="flex flex-col gap-3"
        >
          {!field.preset && (
            <p className="text-xs text-pretty text-muted-foreground">
              Reading every season of satellite passes over this field. A field
              seen for the first time takes about 30 to 45 seconds.
            </p>
          )}
          <TabSkeleton tab={tab} />
        </div>
      ) : (
        <>
          <TabsContent value="story">
            <Suspense fallback={<TabSkeleton tab="story" />}>
              <StoryTab
                analysis={state.analysis}
                year={year}
                onYear={onYear}
                answers={answers}
                demo={!!field.preset}
              />
            </Suspense>
          </TabsContent>
          <TabsContent value="options">
            <StrategiesTab
              analysis={state.analysis}
              onRotation={onRotation}
              declared={field.rotation}
              priorities={priorities}
              onPriorities={setPriorities}
              drier={drier}
              onDrier={setDrier}
            />
          </TabsContent>
          <TabsContent value="growth">
            <Suspense fallback={<TabSkeleton tab="growth" />}>
              <SeasonsTab
                analysis={state.analysis}
                year={year}
                onYear={onYear}
                compare={
                  field.id in compare
                    ? compare[field.id]
                    : (field.preset?.demoYears[1] ?? null)
                }
                onCompare={(y) =>
                  setCompare((prev) => ({ ...prev, [field.id]: y }))
                }
                answers={answers}
                onDeclare={onDeclare}
                demo={!!field.preset}
                refresh={state.refresh}
                onFocus={onFocus}
              />
            </Suspense>
          </TabsContent>
          <TabsContent value="weather">
            <Suspense fallback={<TabSkeleton tab="weather" />}>
              <ClimateTab
                analysis={state.analysis}
                year={year}
                onYear={onYear}
                onFocus={onFocus}
              />
            </Suspense>
          </TabsContent>
        </>
      )}
    </Tabs>
  )
}

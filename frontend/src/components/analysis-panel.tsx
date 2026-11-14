import { ChartLineIcon, CloudSunIcon, MousePointerClickIcon, SproutIcon } from "lucide-react"
import type { ReactNode } from "react"

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { centre, formatHa, ROTATIONS, type SavedField } from "@/lib/fields"

export const TABS = ["overview", "climate", "strategies"] as const
export type TabId = (typeof TABS)[number]

function Pending({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle className="text-sm">{title}</EmptyTitle>
        <EmptyDescription className="text-xs">{children}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

type Props = { field: SavedField | undefined; tab: TabId; onTabChange: (tab: TabId) => void }

export function AnalysisPanel({ field, tab, onTabChange }: Props) {
  if (!field) {
    return (
      <Empty className="h-full">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MousePointerClickIcon />
          </EmptyMedia>
          <EmptyTitle>Select a field</EmptyTitle>
          <EmptyDescription>Pick one from My fields or click its outline on the map to see how it has fared.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  const [lon, lat] = centre(field.geometry)

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <header className="flex flex-col gap-3">
        <h2 className="text-lg leading-tight font-semibold tracking-tight text-balance">{field.name}</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Area</dt>
          <dd className="tabular-nums">{formatHa(field.areaHa)}</dd>
          <dt className="text-muted-foreground">Rotation</dt>
          <dd>{ROTATIONS[field.rotation]}</dd>
          <dt className="text-muted-foreground">Centre</dt>
          <dd className="tabular-nums">
            {lat.toFixed(3)}° N, {lon.toFixed(3)}° E
          </dd>
        </dl>
      </header>
      <Tabs value={tab} onValueChange={(v) => onTabChange(v as TabId)} className="min-h-0 flex-1">
        <TabsList className="w-full">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="climate">Climate</TabsTrigger>
          <TabsTrigger value="strategies">Strategies</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <Pending icon={<ChartLineIcon />} title="Vegetation history is not connected yet">
            This tab will chart the field's greenness and moisture for every season since 2018 and flag the years that fell short.
          </Pending>
        </TabsContent>
        <TabsContent value="climate">
          <Pending icon={<CloudSunIcon />} title="Climate record is not connected yet">
            This tab will set each season's rain, heat and frost against the 30-year normal from NASA POWER.
          </Pending>
        </TabsContent>
        <TabsContent value="strategies">
          <Pending icon={<SproutIcon />} title="Rotation comparison is not connected yet">
            This tab will compare your current rotation with a water-resilient and a soil-restoring alternative.
          </Pending>
        </TabsContent>
      </Tabs>
    </div>
  )
}

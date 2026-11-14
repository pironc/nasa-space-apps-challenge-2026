import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"

import { AnalysisPanel, TABS, type TabId } from "@/components/analysis-panel"
import { AppSidebar } from "@/components/app-sidebar"
import { FieldMap } from "@/components/field-map"
import { TimeSlider } from "@/components/time-slider"
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { useIsMobile } from "@/hooks/use-mobile"
import { useSavedFields, type SavedField } from "@/lib/fields"
import { DEFAULT_DATE, defaultLayerState, snapDate, type LayerId, type LayerState } from "@/lib/layers"

const query = new URLSearchParams(location.search)
const initialTab = TABS.find((t) => t === query.get("tab")) ?? "overview"

export function App() {
  const isMobile = useIsMobile()
  const { fields, add, remove, restore } = useSavedFields()
  const [date, setDate] = useState(() => snapDate(query.get("date") ?? DEFAULT_DATE))
  const [selectedId, setSelectedId] = useState<string | null>(query.get("field"))
  const [tab, setTab] = useState<TabId>(initialTab)
  const [layers, setLayers] = useState<LayerState>(defaultLayerState)
  const selected = fields.find((f) => f.id === selectedId)

  // Selection, date and tab live in the URL so a view can be shared or reloaded.
  useEffect(() => {
    const q = new URLSearchParams({ date })
    if (selected) q.set("field", selected.id)
    if (tab !== "overview") q.set("tab", tab)
    history.replaceState(null, "", `?${q}`)
  }, [date, selected, tab])

  const onLayerChange = useCallback(
    (id: LayerId, patch: Partial<LayerState[LayerId]>) => setLayers((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } })),
    []
  )

  const onDelete = (field: SavedField) => {
    remove(field.id)
    if (selectedId === field.id) setSelectedId(null)
    toast(`Deleted ${field.name}`, { action: { label: "Undo", onClick: () => restore(field) } })
  }

  const panel = <AnalysisPanel field={selected} tab={tab} onTabChange={setTab} />

  return (
    <SidebarProvider>
      <AppSidebar
        year={+date.slice(0, 4)}
        layers={layers}
        onLayerChange={onLayerChange}
        fields={fields}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onDelete={onDelete}
      />
      <SidebarInset className="h-dvh flex-row overflow-hidden">
        {/* isolate: keeps the map's own stacking below dialogs, sheets and toasts */}
        <div className="relative isolate min-w-0 flex-1">
          <FieldMap
            date={date}
            layers={layers}
            fields={fields}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onSave={(f) => {
              const field = { ...f, id: crypto.randomUUID(), createdAt: new Date().toISOString() }
              add(field)
              setSelectedId(field.id)
            }}
          />
          <div className="absolute inset-x-3 bottom-10 z-10 mx-auto max-w-md">
            <TimeSlider date={date} onChange={setDate} />
          </div>
        </div>
        {!isMobile && <aside className="w-88 shrink-0 border-l bg-background">{panel}</aside>}
      </SidebarInset>
      {isMobile && (
        <Drawer modal={false} open={!!selected} onOpenChange={(open) => !open && setSelectedId(null)}>
          <DrawerContent className="max-h-[80dvh]">
            <DrawerTitle className="sr-only">{selected?.name}</DrawerTitle>
            <DrawerDescription className="sr-only">Field analysis</DrawerDescription>
            {panel}
          </DrawerContent>
        </Drawer>
      )}
      <Toaster position="top-center" />
    </SidebarProvider>
  )
}

export default App

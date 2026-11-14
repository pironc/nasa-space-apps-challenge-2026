import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { AnalysisPanel, TABS, type TabId } from "@/components/analysis-panel"
import { AppSidebar } from "@/components/app-sidebar"
import { FieldMap } from "@/components/field-map"
import { TimeSlider } from "@/components/time-slider"
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { useIsMobile } from "@/hooks/use-mobile"
import { loadPresets, midJuly, useAnalysis, type Declared } from "@/lib/data"
import { presetToField, useSavedFields, type RotationId, type SavedField } from "@/lib/fields"
import { DEFAULT_DATE, defaultLayerState, snapDate, type LayerId, type LayerState } from "@/lib/layers"

const query = new URLSearchParams(location.search)
const initialTab = TABS.find((t) => t === query.get("tab")) ?? "strategies"
const NO_ANSWERS = {}

export function App() {
  const isMobile = useIsMobile()
  const { fields: saved, add, patch, remove, restore } = useSavedFields()
  const [presets, setPresets] = useState<SavedField[]>([])
  const [date, setDate] = useState(() => snapDate(query.get("date") ?? DEFAULT_DATE))
  const [selectedId, setSelectedId] = useState<string | null>(query.get("field"))
  const [tab, setTab] = useState<TabId>(initialTab)
  const [layers, setLayers] = useState<LayerState>(defaultLayerState)
  // "Crop or fallow?" answers, per field then year. This visit only: a re-analysis with them needs the service.
  const [answers, setAnswers] = useState<Record<string, Record<string, Declared>>>({})
  const fields = useMemo(() => [...presets, ...saved], [presets, saved])
  const selected = fields.find((f) => f.id === selectedId)
  const analysis = useAnalysis(selected)
  const year = +date.slice(0, 4)

  useEffect(() => {
    loadPresets().then(
      (list) => {
        setPresets(list.map(presetToField))
        // A first visit lands on a finished analysis: the first demo field in its stressed year.
        if (list[0] && !query.has("field")) {
          setSelectedId(list[0].id)
          if (!query.has("date")) setDate(snapDate(midJuly(list[0].demoYears[0])))
        }
      },
      () => toast("The demo fields could not be loaded.")
    )
  }, [])

  // Selection, date and tab live in the URL so a view can be shared or reloaded.
  useEffect(() => {
    const q = new URLSearchParams({ date })
    if (selectedId) q.set("field", selectedId)
    if (tab !== "strategies") q.set("tab", tab)
    history.replaceState(null, "", `?${q}`)
  }, [date, selectedId, tab])

  const onLayerChange = useCallback(
    (id: LayerId, patch: Partial<LayerState[LayerId]>) => setLayers((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } })),
    []
  )

  const onDelete = (field: SavedField) => {
    remove(field.id)
    if (selectedId === field.id) setSelectedId(null)
    toast(`Deleted ${field.name}`, { action: { label: "Undo", onClick: () => restore(field) } })
  }

  // A saved field remembers its rotation; a demo field takes the change for this visit only.
  const onRotation = (rotation: RotationId) => {
    if (!selected) return
    if (selected.preset) setPresets((prev) => prev.map((p) => (p.id === selected.id ? { ...p, rotation } : p)))
    else patch(selected.id, { rotation })
  }

  const panel = (
    <AnalysisPanel
      field={selected}
      state={analysis}
      tab={tab}
      onTabChange={setTab}
      year={year}
      onYear={(y) => setDate(snapDate(midJuly(y)))}
      onRotation={onRotation}
      answers={(selectedId && answers[selectedId]) || NO_ANSWERS}
      onDeclare={(y, use) =>
        selectedId &&
        setAnswers((prev) => {
          const next = { ...prev[selectedId] }
          if (use) next[y] = use
          else delete next[y]
          return { ...prev, [selectedId]: next }
        })
      }
    />
  )
  // Strategy cards side by side need room; the other tabs read better narrow. The wide panel gives way
  // (down to two cards across) before the map gets narrower than 420 px. Below 1280 px the panel stays narrow.
  const wide = !!selected && tab === "strategies" && analysis.status !== "failed"

  return (
    <SidebarProvider>
      <AppSidebar
        year={year}
        layers={layers}
        onLayerChange={onLayerChange}
        presets={presets}
        fields={saved}
        obtained={analysis.status === "ready" ? analysis.analysis.generatedAt : undefined}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onDelete={onDelete}
      />
      <SidebarInset className="h-dvh flex-row overflow-hidden">
        {/* isolate: keeps the map's own stacking below dialogs, sheets and toasts */}
        <div className="@container relative isolate min-w-0 flex-1 xl:min-w-[420px]">
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
          {/* on a narrow map the attribution wraps onto two lines: leave it room */}
          <div className="absolute inset-x-3 bottom-16 z-10 mx-auto max-w-md @2xl:bottom-10">
            <TimeSlider date={date} onChange={setDate} />
          </div>
        </div>
        {!isMobile && <aside className={`w-88 shrink-0 border-l bg-background ${wide ? "xl:w-[56rem] xl:min-w-88 xl:shrink" : ""}`}>{panel}</aside>}
      </SidebarInset>
      {/* Mounted only while a field is selected: vaul's non-modal mode frees the page behind the
          drawer once, on mount, so a drawer that opens later would leave the map untouchable. */}
      {isMobile && selected && (
        <Drawer modal={false} open onOpenChange={(open) => !open && setSelectedId(null)}>
          <DrawerContent className="max-h-[80dvh]">
            <DrawerTitle className="sr-only">{selected.name}</DrawerTitle>
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

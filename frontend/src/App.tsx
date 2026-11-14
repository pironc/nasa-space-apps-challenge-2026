import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { AnalysisPanel, TABS, type TabId } from "@/components/analysis-panel"
import { AppSidebar } from "@/components/app-sidebar"
import { FieldMap } from "@/components/field-map"
import { TimeSlider } from "@/components/time-slider"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { useIsMobile } from "@/hooks/use-mobile"
import { loadPresets, midJuly, useAnalysis, type Declared } from "@/lib/data"
import {
  presetToField,
  useSavedFields,
  type RotationId,
  type SavedField,
} from "@/lib/fields"
import {
  DEFAULT_DATE,
  defaultLayerState,
  snapDate,
  type LayerId,
  type LayerState,
} from "@/lib/layers"

const query = new URLSearchParams(location.search)
const tabOf = (q: URLSearchParams) =>
  TABS.find((t) => t === q.get("tab")) ?? "strategies"
const NO_ANSWERS = {}

export function App() {
  const isMobile = useIsMobile()
  const { fields: saved, add, patch, remove, restore } = useSavedFields()
  const [presets, setPresets] = useState<SavedField[]>([])
  const [date, setDate] = useState(() =>
    snapDate(query.get("date") ?? DEFAULT_DATE)
  )
  const [selectedId, setSelectedId] = useState<string | null>(
    query.get("field")
  )
  const [tab, setTab] = useState<TabId>(() => tabOf(query))
  const [layers, setLayers] = useState<LayerState>(defaultLayerState)
  // "Crop or fallow?" answers, per field then year, for this visit. A drawn field is analysed again with them.
  const [answers, setAnswers] = useState<
    Record<string, Record<string, Declared>>
  >({})
  const fields = useMemo(() => [...presets, ...saved], [presets, saved])
  const selected = fields.find((f) => f.id === selectedId)
  const fieldAnswers = (selectedId && answers[selectedId]) || NO_ANSWERS
  const analysis = useAnalysis(selected, fieldAnswers)
  const year = +date.slice(0, 4)

  // A demo field opens on its stressed year, the season its story is about.
  const select = (id: string | null) => {
    if (id === selectedId) return
    setSelectedId(id)
    const demo = presets.find((p) => p.id === id)?.preset
    if (demo) setDate(snapDate(midJuly(demo.demoYears[0])))
  }

  useEffect(() => {
    loadPresets().then(
      (list) => {
        setPresets(list.map(presetToField))
        // A link to a field drawn in another browser cannot open here: say so and show a demo field.
        const asked = query.get("field")
        const unknown =
          asked !== null &&
          !list.some((p) => p.id === asked) &&
          !saved.some((f) => f.id === asked)
        if (unknown) {
          toast(
            "That field is saved only in the browser that drew it. Showing a demo field instead."
          )
          history.replaceState(null, "", location.pathname) // so Back does not return to the dead link
        }
        // A first visit lands on a finished analysis: the first demo field in its stressed year.
        if (list[0] && (asked === null || unknown)) {
          setSelectedId(list[0].id)
          if (!query.has("date") || unknown)
            setDate(snapDate(midJuly(list[0].demoYears[0])))
        }
      },
      () => toast("The demo fields could not be loaded.")
    )
    // `saved` is read once, as it was on load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Selection, date and tab live in the URL so a view can be shared or reloaded.
  // Going from one field to another adds a history entry, so Back returns to the previous field.
  useEffect(() => {
    const q = new URLSearchParams({ date })
    if (selectedId) q.set("field", selectedId)
    if (tab !== "strategies") q.set("tab", tab)
    const shown = new URLSearchParams(location.search).get("field")
    history[shown && shown !== selectedId ? "pushState" : "replaceState"](
      null,
      "",
      `?${q}`
    )
  }, [date, selectedId, tab])

  useEffect(() => {
    const onPop = () => {
      const q = new URLSearchParams(location.search)
      setSelectedId(q.get("field"))
      setDate(snapDate(q.get("date") ?? DEFAULT_DATE))
      setTab(tabOf(q))
    }
    addEventListener("popstate", onPop)
    return () => removeEventListener("popstate", onPop)
  }, [])

  const onLayerChange = useCallback(
    (id: LayerId, patch: Partial<LayerState[LayerId]>) =>
      setLayers((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } })),
    []
  )

  const onDelete = (field: SavedField) => {
    remove(field.id)
    if (selectedId === field.id) setSelectedId(null)
    toast(`Deleted ${field.name}`, {
      action: { label: "Undo", onClick: () => restore(field) },
    })
  }

  // A saved field remembers its rotation; a demo field takes the change for this visit only.
  const onRotation = (rotation: RotationId) => {
    if (!selected) return
    if (selected.preset)
      setPresets((prev) =>
        prev.map((p) => (p.id === selected.id ? { ...p, rotation } : p))
      )
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
      answers={fieldAnswers}
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
  const wide =
    !!selected && tab === "strategies" && analysis.status !== "failed"
  const drawer = isMobile && !!selected

  return (
    // Under 1100 px the sidebar, the map and the panel do not fit side by side: start with the sidebar closed.
    <SidebarProvider defaultOpen={window.innerWidth >= 1100}>
      <AppSidebar
        year={year}
        layers={layers}
        onLayerChange={onLayerChange}
        presets={presets}
        fields={saved}
        obtained={
          analysis.status === "ready"
            ? analysis.analysis.generatedAt
            : undefined
        }
        selectedId={selectedId}
        onSelect={select}
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
            onSelect={select}
            // the map changes width with the panel, and on a phone the drawer covers most of it
            layout={drawer ? "drawer" : wide ? "wide" : "narrow"}
            onSave={(f) => {
              const field = {
                ...f,
                id: crypto.randomUUID(),
                createdAt: new Date().toISOString(),
              }
              add(field)
              setSelectedId(field.id)
            }}
          />
          {/* on a narrow map the attribution wraps onto two lines: leave it room */}
          <div
            className={`absolute inset-x-3 z-10 mx-auto max-w-md ${drawer ? "bottom-[calc(50dvh+0.75rem)]" : "bottom-16 @2xl:bottom-10"}`}
          >
            <TimeSlider date={date} onChange={setDate} />
          </div>
        </div>
        {!isMobile && (
          <aside
            aria-label="Field analysis"
            className={`w-88 min-w-[280px] shrink border-l bg-background ${wide ? "xl:w-[56rem] xl:min-w-88" : ""}`}
          >
            {panel}
          </aside>
        )}
      </SidebarInset>
      {/* Mounted only while a field is selected: vaul's non-modal mode frees the page behind the
          drawer once, on mount, so a drawer that opens later would leave the map untouchable. */}
      {drawer && selected && (
        <Drawer
          modal={false}
          open
          onOpenChange={(open) => !open && setSelectedId(null)}
        >
          <DrawerContent className="data-[vaul-drawer-direction=bottom]:max-h-[50dvh]">
            <DrawerTitle className="sr-only">{selected.name}</DrawerTitle>
            <DrawerDescription className="sr-only">
              Field analysis
            </DrawerDescription>
            {panel}
          </DrawerContent>
        </Drawer>
      )}
      <Toaster position="top-center" />
    </SidebarProvider>
  )
}

export default App

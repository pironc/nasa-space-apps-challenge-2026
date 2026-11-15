import {
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  Columns3Icon,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { AnalysisPanel, TABS, type TabId } from "@/components/analysis-panel"
import { AppSidebar } from "@/components/app-sidebar"
import { FieldMap } from "@/components/field-map"
import { Button } from "@/components/ui/button"
import { TimeSlider } from "@/components/time-slider"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
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
  addDays,
  clampDay,
  DEFAULT_DATE,
  defaultLayerState,
  scenePass,
  viewOf,
  VIEWS,
  withView,
  type LayerId,
  type LayerState,
} from "@/lib/layers"

/** One play step: a day of the season every this many ms, once that day's images have loaded. */
const STEP_MS = 180

const query = new URLSearchParams(location.search)
const tabOf = (q: URLSearchParams) =>
  TABS.find((t) => t === q.get("tab")) ?? "strategies"
const NO_ANSWERS = {}

export function App() {
  const isMobile = useIsMobile()
  const { fields: saved, add, patch, remove, restore } = useSavedFields()
  const [presets, setPresets] = useState<SavedField[]>([])
  const [date, setDate] = useState(() =>
    clampDay(query.get("date") ?? DEFAULT_DATE)
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
  // The map comes first: the analysis panel is narrow unless asked wider, and can be hidden.
  const [panelMode, setPanelMode] = useState<"narrow" | "wide" | "hidden">(
    "narrow"
  )

  // Clear Sentinel-2 passes over the selected field: the map fades from one to the next, day by day.
  const scenes = useMemo(
    () => (analysis.status === "ready" ? (analysis.analysis.scenes ?? []) : []),
    [analysis]
  )
  const sceneDates = useMemo(() => scenes.map((s) => s.date), [scenes])
  const passOn = useMemo(
    () => Object.fromEntries(scenes.map((s) => [s.date, s])),
    [scenes]
  )
  // Play moves one day at a time and loops within the year.
  const step = useCallback((d: string) => {
    const n = addDays(d, 1)
    return n.startsWith(d.slice(0, 4)) && clampDay(n) === n
      ? n
      : `${d.slice(0, 4)}-01-01`
  }, [])
  const nextDates = useMemo(() => {
    const a = step(date)
    return [a, step(a)]
  }, [date, step])
  const showScene =
    !!selected && (layers.scene.on || layers.greenness.on) && year >= 2018
  const pass = showScene ? scenePass(sceneDates, date) : undefined
  // Play waits until the next frame of every visible layer has loaded.
  const [readyById, setReadyById] = useState<Record<string, boolean>>({})
  const onReady = useCallback(
    (id: string, ready: boolean) =>
      setReadyById((prev) =>
        prev[id] === ready ? prev : { ...prev, [id]: ready }
      ),
    []
  )
  const ready = Object.values(readyById).every(Boolean)

  // A demo field opens on its stressed year, the season its story is about.
  const select = (id: string | null) => {
    if (id === selectedId) return
    setSelectedId(id)
    const demo = presets.find((p) => p.id === id)?.preset
    if (demo) setDate(clampDay(midJuly(demo.demoYears[0])))
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
            setDate(clampDay(midJuly(list[0].demoYears[0])))
        }
      },
      () => toast("The demo fields could not be loaded.")
    )
    // `saved` is read once, as it was on load
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Selection, date and tab live in the URL so a view can be shared or reloaded.
  // Going from one field to another adds a history entry, so Back returns to the previous field.
  // Written once the date stops moving: browsers throttle history updates (Safari allows about 100
  // per 30 s), and scrubbing day by day would hit that limit.
  useEffect(() => {
    const t = setTimeout(() => {
      const q = new URLSearchParams({ date })
      if (selectedId) q.set("field", selectedId)
      if (tab !== "strategies") q.set("tab", tab)
      const shown = new URLSearchParams(location.search).get("field")
      history[shown && shown !== selectedId ? "pushState" : "replaceState"](
        null,
        "",
        `?${q}`
      )
    }, 300)
    return () => clearTimeout(t)
  }, [date, selectedId, tab])

  useEffect(() => {
    const onPop = () => {
      const q = new URLSearchParams(location.search)
      setSelectedId(q.get("field"))
      setDate(clampDay(q.get("date") ?? DEFAULT_DATE))
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
      onYear={(y) => setDate(clampDay(midJuly(y)))}
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
  // Wide only when asked, for comparing the three strategy cards side by side.
  const wide =
    panelMode === "wide" && tab === "strategies" && analysis.status !== "failed"
  const hidden = panelMode === "hidden"
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
            nextDates={nextDates}
            scene={
              pass
                ? {
                    now: passOn[pass.date],
                    next: pass.next ? passOn[pass.next] : null,
                  }
                : null
            }
            scenes={scenes}
            onReady={onReady}
            layers={layers}
            fields={fields}
            selectedId={selectedId}
            onSelect={select}
            // the map changes width with the panel, and on a phone the drawer covers most of it
            layout={
              drawer ? "drawer" : hidden ? "full" : wide ? "wide" : "narrow"
            }
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
            className={`absolute inset-x-3 z-10 mx-auto max-w-md ${drawer ? "bottom-[calc(50dvh+0.75rem)]" : "bottom-16"}`}
          >
            {/* What the map shows: one choice, the same switches as in the sidebar */}
            <ToggleGroup
              type="single"
              aria-label="Map layer"
              value={viewOf(layers)}
              onValueChange={(v) => v && setLayers((s) => withView(s, v))}
              spacing={1}
              className="mx-auto mb-2 w-fit max-w-full overflow-x-auto rounded-xl border bg-background/95 p-1 shadow-md"
            >
              {VIEWS.map((v) => (
                <ToggleGroupItem
                  key={v.id}
                  value={v.id}
                  aria-label={v.label}
                  className="px-2 transition-colors data-[state=on]:bg-primary data-[state=on]:text-primary-foreground @md:px-2.5 pointer-coarse:h-10"
                >
                  <span className="@md:hidden">{v.short}</span>
                  <span className="hidden @md:inline">{v.label}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <TimeSlider
              date={date}
              onChange={setDate}
              step={step}
              stepMs={STEP_MS}
              ready={ready}
              pass={pass}
              sceneDates={showScene ? sceneDates : []}
              vegetation={layers.ndvi.on}
            />
          </div>
          {/* Panel controls under the zoom buttons, out of the way of the drawing toolbar. */}
          {!isMobile && selected && (
            <div className="absolute top-[4.75rem] right-2 z-10 flex flex-col gap-2 font-sans">
              <Button
                variant="outline"
                size="icon"
                className="bg-background shadow-sm"
                aria-label={
                  hidden ? "Show the analysis panel" : "Hide the analysis panel"
                }
                title={
                  hidden ? "Show the analysis panel" : "Hide the analysis panel"
                }
                onClick={() => setPanelMode(hidden ? "narrow" : "hidden")}
              >
                {hidden ? <PanelRightOpenIcon /> : <PanelRightCloseIcon />}
              </Button>
              {!hidden && tab === "strategies" && (
                <Button
                  variant="outline"
                  size="icon"
                  className="bg-background shadow-sm"
                  aria-pressed={wide}
                  aria-label="Compare the three options side by side"
                  title="Compare the three options side by side"
                  onClick={() => setPanelMode(wide ? "narrow" : "wide")}
                >
                  <Columns3Icon />
                </Button>
              )}
            </div>
          )}
        </div>
        {!isMobile && !hidden && (
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

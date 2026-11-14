import { MapPinnedIcon, Trash2Icon } from "lucide-react"

import { AboutDialog } from "@/components/about-dialog"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Label } from "@/components/ui/label"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { formatHa, type SavedField } from "@/lib/fields"
import { PANEL_ORDER, type LayerId, type LayerState } from "@/lib/layers"

type Props = {
  year: number
  layers: LayerState
  onLayerChange: (id: LayerId, patch: Partial<LayerState[LayerId]>) => void
  presets: SavedField[]
  fields: SavedField[]
  /** ISO date the open field's analysis was built. */
  obtained?: string
  selectedId: string | null
  onSelect: (id: string) => void
  onDelete: (field: SavedField) => void
}

export function AppSidebar({
  year,
  layers,
  onLayerChange,
  presets,
  fields,
  obtained,
  selectedId,
  onSelect,
  onDelete,
}: Props) {
  const { setOpenMobile } = useSidebar()
  const rows = (list: SavedField[], deletable: boolean) => (
    <SidebarMenu>
      {list.map((f) => (
        <SidebarMenuItem key={f.id}>
          <SidebarMenuButton
            isActive={f.id === selectedId}
            onClick={() => {
              onSelect(f.id)
              setOpenMobile(false) // on a phone the sidebar is a sheet covering the map
            }}
            className="h-auto py-1.5"
          >
            <div className="flex min-w-0 flex-col gap-1 leading-tight">
              <span className="truncate font-medium">{f.name}</span>
              <span className="truncate text-xs text-muted-foreground tabular-nums">
                {f.preset && `${f.preset.region} · `}
                {formatHa(f.areaHa)}
              </span>
            </div>
          </SidebarMenuButton>
          {deletable && (
            <SidebarMenuAction
              showOnHover
              aria-label={`Delete ${f.name}`}
              onClick={() => onDelete(f)}
            >
              <Trash2Icon />
            </SidebarMenuAction>
          )}
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  )
  return (
    <Sidebar>
      {/* a named region, so the fields, layers and notes are reachable as one landmark */}
      <nav
        aria-label="Fields and map layers"
        className="flex min-h-0 flex-1 flex-col"
      >
        <SidebarHeader className="px-4 pt-4 pb-2">
          <h1 className="text-xl leading-tight font-semibold">
            Field Shift
          </h1>
          <p className="text-xs text-muted-foreground">
            Season findings and rotation options, from NASA Earth data
          </p>
        </SidebarHeader>
        <SidebarContent>
          {presets.length > 0 && (
            <SidebarGroup>
              <SidebarGroupLabel>Demo fields</SidebarGroupLabel>
              <SidebarGroupContent>{rows(presets, false)}</SidebarGroupContent>
            </SidebarGroup>
          )}
          <SidebarGroup>
            <SidebarGroupLabel>My fields</SidebarGroupLabel>
            <SidebarGroupContent>
              {fields.length === 0 ? (
                <Empty className="gap-3 border border-dashed p-4 md:p-4">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <MapPinnedIcon />
                    </EmptyMedia>
                    <EmptyTitle className="text-sm">No fields yet</EmptyTitle>
                    <EmptyDescription className="text-xs">
                      Use{" "}
                      <span className="font-medium text-foreground">
                        Draw field
                      </span>{" "}
                      on the map to outline one. It is saved in this browser.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                rows(fields, true)
              )}
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>Map layers</SidebarGroupLabel>
            <SidebarGroupContent className="flex flex-col gap-1 px-2">
              {PANEL_ORDER.map((l) => {
                const state = layers[l.id]
                const missing = year < l.since
                return (
                  <div
                    key={l.id}
                    className="flex flex-col gap-2 rounded-md py-1.5"
                  >
                    <div className="flex items-start gap-2.5">
                      <Switch
                        id={`layer-${l.id}`}
                        className="mt-0.5"
                        checked={state.on}
                        onCheckedChange={(on) => onLayerChange(l.id, { on })}
                      />
                      <div className="flex min-w-0 flex-1 flex-col gap-1 leading-tight">
                        <Label
                          htmlFor={`layer-${l.id}`}
                          className="text-sm font-medium"
                        >
                          {l.label}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {missing ? `No data before ${l.since}` : l.source}
                        </p>
                      </div>
                    </div>
                    {state.on && !missing && (
                      <div className="flex flex-col gap-2">
                        <p className="pl-[2.625rem] text-xs text-muted-foreground">
                          {l.hint}
                        </p>
                        <div className="flex items-center gap-2 pl-[2.625rem]">
                          <span className="text-xs text-muted-foreground">
                            Opacity
                          </span>
                          <Slider
                            aria-label={`${l.label} opacity`}
                            min={0.1}
                            max={1}
                            step={0.05}
                            value={[state.opacity]}
                            onValueChange={([opacity]) =>
                              onLayerChange(l.id, { opacity })
                            }
                          />
                        </div>
                        {l.legend && (
                          <figure className="flex flex-col gap-1">
                            <img
                              src={l.legend}
                              alt=""
                              className="h-auto w-full rounded-sm border bg-white"
                              loading="lazy"
                            />
                            <figcaption className="text-xs text-muted-foreground">
                              {l.scale}
                            </figcaption>
                          </figure>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="gap-3 px-4 pb-4">
          <AboutDialog year={year} obtained={obtained} />
          <p className="text-xs text-muted-foreground">
            Decision support only. Check any change with a local agronomist.
          </p>
        </SidebarFooter>
      </nav>
    </Sidebar>
  )
}

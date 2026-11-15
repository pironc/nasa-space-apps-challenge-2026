import { MapPinnedIcon, Trash2Icon } from "lucide-react"

import { AboutDialog } from "@/components/about-dialog"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
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
import { formatHa, type SavedField } from "@/lib/fields"

type Props = {
  year: number
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
          <h1 className="text-base font-semibold tracking-tight">
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

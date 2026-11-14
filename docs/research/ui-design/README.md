# UI kit, design workflow and layout

Research note from the design phase, 2026-11-14. Each finding is tagged: `verified-live` (a command was run), `source-read` (the cited source was read) or `memory` (unverified recall). Paths to scratch files that were not kept in the repo are historical.

## Recommendation

Use shadcn/ui (CLI 4.23.0) on Radix with the Nova preset; one command scaffolds Vite 8, React 19.3, TypeScript 6 and Tailwind 4.3, and all the components this app needs were installed and built in a throwaway project. The current shadcn Button does move on click (a 1px drop, in every current style), so delete that one class, switch the button to colour-only pressed states, and add a grep check to the build so it cannot come back. Do not use a global CSS override for this: it would break Leaflet markers and polygon drawing. For design skills, use impeccable in its dashboard ("Operate") mode for the shell, dataviz before any chart, and break-ui once the first slice works; leave hallmark, animate and review-animations out of the app, because three of the installed skills explicitly tell Claude to scale buttons to 0.97 on press. Lay the app out map-first: layers and saved fields in a left sidebar (a slide-in sheet on phones), the time slider floating at the bottom of the map, and a right-hand analysis panel (a bottom drawer on phones) that widens when the three strategy cards are shown. Keep the chrome neutral with one blue accent, and reserve red, orange, yellow and green for the NDVI ramp and alert status. The long report file was not saved: the harness refused the write, so this output is the full record.

## Spec

**Report file: not written.** The Write call for `report.md` was refused by the harness ("Subagents should return findings as text"), so `report_path` is omitted. Evidence that does exist on disk: `docs/research/ui-design/scaffold/app-radix/` (generated sources, fixed `src/components/ui/button.tsx`, `src/NdviChart.tsx`), `.../ui-design/downloads/` (docs, registry JSON), `.../ui-design/scripts/contrast.mjs`. Nothing was checked in a browser.

### 1. Setup (repo root; Node `^20.19.0 || >=22.12.0`)
```bash
npx shadcn@4.23.0 init -t vite -b radix -p nova -n frontend --no-monorepo --no-rtl --pointer -y
rm -rf frontend/.git     # the CLI runs git init + commit in the new folder
cd frontend
npx shadcn@4.23.0 add sidebar switch slider toggle toggle-group badge tabs chart card table sonner dialog alert-dialog sheet drawer skeleton command tooltip popover scroll-area separator collapsible select label input empty item spinner progress alert dropdown-menu kbd field -y
# src/components/ui/sonner.tsx: import { useTheme } from "@/components/theme-provider"
npm uninstall next-themes
```
The CLI now asks for a base library (`base | radix | aria`, Base UI is the default) and a preset (`nova, vega, maia, lyra, mira, luma, sera, rhea`). Pick **radix** (builds clean; `base-nova` fails `tsc -b` on an unused import in `scroll-area.tsx`) and **nova** (compact, 14px, Geist with Cyrillic). Installed: react 19.3.1, vite 8.3.8, tailwindcss 4.3.5, radix-ui 1.8.1, recharts 3.8.0, sonner 2.0.8, vaul 1.1.2, cmdk 1.1.1, lucide-react 1.72.0, `cn` 0.5.2.

### 2. Components
| Need | Use | Gotcha |
|---|---|---|
| Shell | `sidebar`, `collapsible="offcanvas"` | Sheet under 768px; Cmd/Ctrl+B; call `map.invalidateSize()` from a ResizeObserver |
| Layers | `switch`, `slider`, `collapsible` | Legends are hosted: `gibs.earthdata.nasa.gov/legends/MODIS_L3_NDVI_H.svg`, PC `/api/data/v1/legend/colormap/{name}` |
| Time slider | `slider` + `button aria-pressed` + `toggle-group` | Slide over an index of valid dates (16-day NDVI restarts each 1 Jan); label on `onValueChange`, tiles on `onValueCommit` |
| Field list | `SidebarMenu*`, `SidebarMenuBadge`, `empty` | Icon + label for status |
| Analysis | `<aside>` desktop, `drawer` phone (`modal={false}`), `tabs`, `chart`, `table` | `ChartContainer className="aspect-auto h-56 w-full"`; `isAnimationActive={false}` |
| Strategies | `card` x3, `accordion`, `table` | `@container` + `@3xl:grid-cols-3` |
| Overlays | `dialog`, `alert-dialog`, `sonner`, `command` | Wrap the map in `relative isolate` (Leaflet z-index 400–1000 vs `z-50`); delete the template's bare `d` theme hotkey |

Blocks: `sidebar-15` (left + right) and `sidebar-07` are the references; install none. `dashboard-01` adds 4 dnd-kit packages, `@tanstack/react-table` and `zod`.

### 3. Pressed state
Generated Button base contains `transition-all ... active:not-aria-[haspopup]:translate-y-px`. Fix in `button.tsx`:
- delete `active:not-aria-[haspopup]:translate-y-px`
- `transition-all` → `transition-colors active:transition-none`
- default `active:bg-primary/65 aria-pressed:bg-primary/65`; outline and ghost `active:bg-foreground/10 aria-pressed:bg-foreground/10`; destructive `active:bg-destructive/30`

Selectors: `active:` momentary; `aria-pressed:` latched Button (play); `data-[state=on]:` Toggle/ToggleGroup (generated `bg-muted` is too faint); `data-active:` Tabs; `data-checked:` Switch. Gate:
```json
"check:press": "! grep -rnE \"active:[^ \\\"']*(scale|translate|rotate|skew)\" src",
"check:press:css": "! grep -oE \":active[^{}]*\\{[^}]*(translate|scale|rotate|transform)[^}]*\\}\" dist/assets/*.css"
```
Never pass `--overwrite` to `shadcn add` afterwards.

### 4. Skills, in order
1. Three rules in the project CLAUDE.md (press, reserved hues, shadcn first).
2. `impeccable init` → `shape` (Operate mode), timeboxed 20 min; it writes `PRODUCT.md`, `DESIGN.md`, `.impeccable/`.
3. `dataviz` before the first chart.
4. `break-ui` on field list and strategy cards.
5. `impeccable adapt` (390px) → `polish`.
Skip for the app: `hallmark`, `animate`, `review-animations`; `animation-performance` only if playback stutters; `artifact-design` only for a published pitch page.

### 5. Layout
```
┌─────────────────────────────────────────────────────────────────────────┐
│ [≡] Field Shift    [Search ⌘K]                  (!) 3 alerts    [◐]     │
├──────────────┬─────────────────────────────────┬────────────────────────┤
│ LAYERS       │ [draw]                   [+][−] │ Karabalyk N · 412 ha   │
│ (•) True col │                                 │ ▲ NDVI low ▲ bare soil │
│ [x] NDVI 16d │            M A P                │ [Overview|Climate|     │
│   opacity ─● │                                 │  Strategies]           │
│   legend     │      ▢ selected field           │ chart, diagnosis stats │
│ MY FIELDS    │ ┌─────────────────────────────┐ │                        │
│ Karabalyk ▲2 │ │[▶] 12 Jul 2021 ├────●────┤  │ │ Strategies: panel goes │
│ Shortandy ✓  │ │[2021][2024]  May … Sep      │ │ 60vw, 3 cards side by  │
│ [+ Draw]     │ └─────────────────────────────┘ │ side + table           │
└──────────────┴─────────────────────────────────┴────────────────────────┘
Phone: full-screen map; [≡] opens layers + fields as a Sheet; time slider
pinned above the bottom edge; tapping a field opens a bottom Drawer.
```
Alerts appear on field rows, in a header popover, and at the top of the panel. State in the URL via `URLSearchParams` (`?field=&date=&tab=`).

### 6. Colour and theme
- Template `ThemeProvider` (`.dark` class, default system); design light first; never invert map tiles.
- Neutral chrome. `--primary`: light `#256abf` (white text 5.39:1), dark `#3987e5` (`#171717` text 4.93:1).
- Selected field: 5px white under 3px blue (blue vs ramp red 1.10:1, green 1.19:1).
- Status, fixed, icon + label: `#0ca30c`, `#fab219`, `#ec835a`, `#d03b3b`; never as map fills.
- Charts: `--chart-1:#2a78d6; --chart-2:#eb6834; --chart-3:#1baf7a` (dark `#3987e5; #d95926; #199e70`). Selected year blue, comparison year orange, multi-year range a grey band. One y-axis per chart; strategy comparison as a table with one-hue bars.

## Corrections this made to the first brief

- Section 6, frontend stack: add shadcn/ui (CLI 4.23.0, base Radix, preset Nova) and note the versions it brings: React 19.3.1, Vite 8, TypeScript 6, Tailwind 4 through `@tailwindcss/vite` with no tailwind.config file, Recharts 3.8.0 via the shadcn chart component, plus sonner, vaul and cmdk. react-leaflet 5.0.0 requires React 19 and Leaflet 1.9.
- Section 10, 'Node 20+': Vite 8.3.8 needs Node ^20.19.0 or >=22.12.0, so plain Node 20.0 is not enough.
- Add a UI rules section: no transform, translate or scale on press (colour change only, enforced by a grep in the build); red, orange, yellow and green are reserved for the NDVI ramp and alert status; shadcn components before custom ones. Without this the installed animation skills add a 0.97 press scale.
- Section 2, git: note that `shadcn init` creates its own git repository and an 'initial commit' inside the new frontend folder; delete `frontend/.git` before staging.
- Section 7, field NDVI tiles: `colormap_name=rdylgn` is a red-green diverging ramp used for a magnitude, differs from the tan-to-green GIBS NDVI ramp shown at regional zoom, and is hard for red-green colour-blind viewers. Record the alternatives (`ylgn`, `viridis`) and the two ready-made legend URLs (GIBS `legends/MODIS_L3_NDVI_H.svg`, Planetary Computer `/api/data/v1/legend/colormap/{name}`).
- Section 5, time slider: state that 16-day NDVI dates restart on 1 January each year, so the slider steps through a generated list of valid dates rather than adding 16 days continuously.

## Risks

- Nothing was looked at in a browser. Pressed colours, the blue accent, the drawer over the map and the wireframe proportions were checked by build and compiled CSS only.
- The long report was not saved to disk because the harness refused the file write; this structured output is the only record besides the scratch scaffold and downloads.
- Any later `shadcn add` (especially a block) can overwrite the fixed button.tsx and bring the 1px press movement back; the grep gate in the build is what catches it.
- emil-design-eng, animate and review-animations will add or demand `scale(0.97)` on press unless the project CLAUDE.md states the rule; hallmark defaults to a 1px drop.
- A global CSS rule that resets transforms on `:active` would break Leaflet marker positioning and Geoman vertex dragging, and shift the sidebar rail.
- Without `relative isolate` on the map wrapper, Leaflet controls (z-index 1000) are expected to paint over shadcn dialogs, sheets and popovers (z-50). Derived from the two stylesheets, not observed.
- `shadcn init -n frontend` is expected to leave a nested `frontend/.git` with its own commit; staging it unnoticed would add an embedded repository instead of the files.
- impeccable's init and direction steps cost time, write PRODUCT.md, DESIGN.md and .impeccable/ into the repo, and its dashboard guidance argues against a grey-plus-one-accent shell; the palette rule has to be pinned in its brief.
- Alert status colours share hues with the red-yellow-green NDVI ramp; a red alert mark on a red patch of map disappears, so alerts on the map need an icon with a white halo.
- Nova controls are 32px high and the slider thumb hit area is 28px; small for phones unless enlarged with `pointer-coarse:`.
- Bundle with Recharts is 635 kB (190 kB gzip) in one chunk; acceptable for the demo, slower on a phone on mobile data.
- Port 8080 on this machine is held by a long-running preview server from another project, which will clash with a local Cloud Run style container on its default port.

## Open questions

- Radix or Base UI? Base UI is the shadcn default and what the installed pick-ui-library skill names; Radix built clean and keeps the familiar `asChild` pattern. I recommend Radix for the weekend.
- Does the no-scale rule cover only click feedback, or also the 95% zoom when dialogs, popovers and menus open and the sliding switch thumb? Removing those is a few class deletions.
- Keep `rdylgn` for field NDVI (familiar, shows drought as red) or switch to `ylgn` or `viridis` (readable for red-green colour-blind viewers and closer to the NASA GIBS ramp)? It is one query parameter.
- Run impeccable's init and shape steps (about 20 minutes, writes files into the repo) or build directly from the wireframe?
- Should `--primary` be the blue accent everywhere, or stay near-black with blue used only for selection and focus?
- Is the all-fields overview table (one row per saved field) wanted in the first pass, or only the per-field panel?
- Default theme: follow the system setting, or force light for projector and daylight use?

## Findings

- **[verified-live]** shadcn CLI latest is 4.23.0 (modified 2026-10-27); `init` takes `-t vite`, `-b base|radix|aria`, `-p <preset>`, `--pointer`; `--defaults` means `--template=next --preset=base-nova`.
  - Evidence: `npm view shadcn version dist-tags time.modified` and `npx shadcn@latest init --help` output
- **[verified-live]** The command `npx shadcn@latest init -t vite -b radix -p nova -n <name> --no-monorepo --no-rtl --pointer -y` runs without prompts and yields style `radix-nova`, React 19.3.1, Vite 8.3.8, TypeScript 6.0.3, Tailwind 4.3.5, radix-ui 1.8.1, cn 0.5.2, lucide-react 1.72.0; `npm run build` passes after adding 40 components.
  - Evidence: Scratch run (47 s); `components.json`, `package.json` and build output in docs/research/ui-design/scaffold/app-radix
- **[verified-live]** The Base UI variant (`-b base -p nova`) fails the template's own build out of the box.
  - Evidence: `src/components/ui/scroll-area.tsx(1,1): error TS6133: 'React' is declared but its value is never read.` from `tsc -b` in scaffold/app-base
- **[source-read]** The official Vite install page documents three routes (shadcn/create, `npx shadcn@latest init -t vite`, manual with `npm install tailwindcss @tailwindcss/vite`), and Base UI became the default in July 2026.
  - Evidence: https://ui.shadcn.com/docs/installation/vite.md and https://ui.shadcn.com/docs/changelog (entry 'July 2026 Base UI as the Default')
- **[source-read]** The CLI runs `git init`, `git add -A`, `git commit -m "feat: initial commit"` in every new project folder with no check for a parent repo.
  - Evidence: `async function ia({projectPath:e}){try{await execa("git",["init"],{cwd:e}),...` in node_modules/shadcn/dist/index.js; `git log` in the scratch scaffold shows `820150c feat: initial commit`
- **[verified-live]** The current shadcn Button moves on press: its base class contains `active:not-aria-[haspopup]:translate-y-px` together with `transition-all`. No `active:scale-*` exists.
  - Evidence: scaffold/app-radix/src/components/ui/button.tsx line 7; compiled rule `.active\:not-aria-\[haspopup\]\:translate-y-px:active:not([aria-haspopup]){--tw-translate-y:1px;translate:var(--tw-translate-x) var(--tw-translate-y)}`
- **[verified-live]** That press translate is in the Button of all eight current styles (nova, vega, maia, lyra, mira, luma, sera, rhea) and in base-nova, base-vega, aria-nova; only legacy new-york-v4 lacks it.
  - Evidence: https://ui.shadcn.com/r/styles/<style>/button.json for each style, parsed in scratch
- **[verified-live]** Among 41 generated components only button.tsx has a transform on `:active`; sidebar uses `active:bg-sidebar-accent`, slider `active:ring-3`. sonner, cmdk, vaul, react-resizable-panels, tw-animate-css, Leaflet 1.9.4 and Leaflet-Geoman 2.20.6 have no `:active` rule that moves anything.
  - Evidence: grep over scaffold/app-radix/src/components/ui and over package CSS/JS; downloads/leaflet.css, downloads/geoman.css
- **[verified-live]** The colour-only press fix compiles, and both grep gates fail before the fix (exit 1) and pass after it (exit 0). Compiled order is hover < active < aria-pressed < data-[state=on], so pressed states win over hover.
  - Evidence: Build of modified scaffold; rule offsets 41995 / 47135 / 59970 / 69460 in dist CSS; `.active\:bg-primary\/65:active{background-color:color-mix(in oklab, var(--primary) 65%, transparent)}`
- **[verified-live]** A later `shadcn add` of a block wants to overwrite the customised button.tsx.
  - Evidence: `npx shadcn@latest add sidebar-07 --dry-run` → `~ src/components/ui/button.tsx overwrite`, '5 files will be overwritten'
- **[source-read]** A global `:active { transform/translate: none }` override is unsafe: SidebarRail is a button positioned with `-translate-x-1/2`, and Leaflet positions markers and Geoman handles by transform.
  - Evidence: scaffold/app-radix/src/components/ui/sidebar.tsx line 291 (`ltr:-translate-x-1/2`); Leaflet marker positioning and `role="button"` on markers is recalled, not re-read
- **[verified-live]** The shadcn Chart component is still built on Recharts, now v3; the registry pins `recharts@3.8.0`, whose peers allow React ^19. With React 19.3.1 npm installed react-is 19.3.1 automatically, no override needed, and a ComposedChart with range band, two lines and a reference line builds.
  - Evidence: https://ui.shadcn.com/docs/components/chart.md ('The chart component now uses Recharts v3'); https://ui.shadcn.com/r/styles/radix-nova/chart.json dependencies; `npm ls react-is`; scaffold/app-radix/src/NdviChart.tsx build
- **[verified-live]** Generated sonner.tsx imports `useTheme` from next-themes although the Vite template ships its own ThemeProvider; switching the import to `@/components/theme-provider` type-checks and leaves no next-themes import.
  - Evidence: scaffold/app-radix/src/components/ui/sonner.tsx line 1; `npx tsc -b` exit 0 after the change
- **[verified-live]** Registry blocks available: sidebar-01 to sidebar-16 and dashboard-01. dashboard-01 depends on @dnd-kit/core, /modifiers, /sortable, /utilities, @tanstack/react-table and zod.
  - Evidence: `npx shadcn@latest search @shadcn -q sidebar`; https://ui.shadcn.com/r/styles/radix-nova/dashboard-01.json
- **[source-read]** shadcn Sidebar renders as a Sheet below 768px, has a Cmd/Ctrl+B shortcut and stores its state in a cookie; Leaflet panes use z-index 200–800 and controls 1000 while shadcn overlays use z-50.
  - Evidence: scaffold/app-radix/src/components/ui/sidebar.tsx lines 32, 85, 181–183; src/hooks/use-mobile.ts (`MOBILE_BREAKPOINT = 768`); https://unpkg.com/leaflet@1.9.4/dist/leaflet.css lines 107–141
- **[source-read]** Three installed skills instruct a scale on press: emil-design-eng ('Add `transform: scale(0.97)` on `:active`'), animate (`.button:active { transform: scale(0.97); }`), review-animations ('Button press feedback. `transform: scale(0.97)` on `:active` ... Applies to any pressable element').
  - Evidence: ~/.claude/skills/emil-design-eng/SKILL.md lines 47, 201, 213; ~/.claude/skills/animate/RECIPES.md lines 18–19; ~/.claude/skills/review-animations/STANDARDS.md line 59
- **[source-read]** hallmark moves buttons on press by default (`.btn:active { transform: translateY(1px); }`) but its states table allows 'A 1px drop or one step darker'; it is scoped to websites and new pages and brings its own tokens.css and lint.
  - Evidence: ~/.claude/skills/hallmark/references/patterns.md line 10; references/microinteractions.md lines 19–23; references/interaction-and-states.md line 12; SKILL.md description
- **[source-read]** impeccable has a dashboard mode ('Operate: ... Scanability, consistency, native expectations, and the real usage scene outrank expression'), contains no press-scale advice, writes PRODUCT.md and DESIGN.md, and requires a concept roll on a new visual world.
  - Evidence: ~/.claude/skills/impeccable/SKILL.md lines 37, 49–50; reference/operate.md; reference/new-work.md line 48; grep of reference/*.md for :active/scale/press
- **[verified-live]** dataviz and artifact-design have no on-disk SKILL.md in ~/.claude; dataviz references sit in the Claude Code bundled-skills folder and artifact-design is served by the Artifact tool. Neither conflicts with the press preference; artifact-design applies only to pages published as Artifacts.
  - Evidence: (bundled skill files); both loaded through the Skill tool; `find` over ~/.claude/plugins found no match
- **[verified-live]** dataviz chart colours validate on shadcn's card surfaces: blue+orange pass all checks in both modes; the first three slots pass all-pairs in both modes, with aqua at 2.82:1 on white (labels or table view required).
  - Evidence: `node validate_palette.js "#2a78d6,#eb6834,#1baf7a" --mode light --surface "#ffffff" --pairs all` → CVD worst ΔE 9.2, contrast WARN 2.82; dark `#171717` → all PASS
- **[verified-live]** Blue accent contrast: white on #256abf is 5.39:1, white on #2a78d6 is 4.42:1, #171717 on #3987e5 is 4.93:1; blue #2a78d6 against RdYlGn red is 1.10:1 and against its green 1.19:1, so a map outline needs a white casing.
  - Evidence: docs/research/ui-design/scripts/contrast.mjs output
- **[verified-live]** Ready-made legends exist for both NDVI layers, and the Planetary Computer tile API accepts 260 colormap names including ylgn, greens, viridis and cividis. The GIBS NDVI ramp is tan-to-green, not red-yellow-green.
  - Evidence: https://gibs.earthdata.nasa.gov/legends/MODIS_L3_NDVI_H.svg (200); https://planetarycomputer.microsoft.com/api/data/v1/legend/colormap/rdylgn (200, PNG 387x11); enum in https://planetarycomputer.microsoft.com/api/data/v1/openapi.json; https://gibs.earthdata.nasa.gov/colormaps/v1.3/MODIS_L3_NDVI.xml samples #ddc9bc → #0a6900
- **[verified-live]** GIBS 16-day NDVI dates restart on 1 January each year, so the slider must step through a list of valid dates.
  - Evidence: WMTSCapabilities.xml, layer MODIS_Terra_L3_NDVI_16Day: `2024-01-01/2024-12-18/P16D`, `2025-01-01/2025-12-19/P16D`, `2026-01-01/2026-10-16/P16D`
- **[verified-live]** Vite 8.3.8 requires Node `^20.19.0 || >=22.12.0`; react-leaflet 5.0.0 requires React ^19 and Leaflet ^1.9; Leaflet latest stable is 1.9.4.
  - Evidence: `npm view vite@8.3.8 engines`, `npm view react-leaflet version peerDependencies`, `npm view leaflet version dist-tags`
- **[verified-live]** Tailwind 4.3.5 supports the `pointer-coarse:` variant, usable to enlarge 32px Nova controls on touch screens.
  - Evidence: Probe component built in scratch → `@media (pointer:coarse){.pointer-coarse\:h-11{height:calc(var(--spacing) * 11)}`

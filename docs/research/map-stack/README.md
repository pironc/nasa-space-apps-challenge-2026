# Map library choice

Research note from the design phase, 2026-11-14. Each finding is tagged: `verified-live` (a command was run), `source-read` (the cited source was read) or `memory` (unverified recall). Paths to scratch files that were not kept in the repo are historical.

## Recommendation

Use MapLibre GL JS 6 through the mapcn shadcn component, with terra-draw for drawing and @turf/area for hectares, and drop react-leaflet, Leaflet and Leaflet-Geoman from the brief. The brief's reason for dropping MapLibre (it "needs a keyed tile provider") is wrong: OpenFreeMap serves keyless vector basemaps with no request limit, and EOX Sentinel-2 cloudless gives a keyless satellite layer for non-commercial use. MapLibre changes a layer's date in place without blanking it, whereas Leaflet removes every tile on each slider step. mapcn gives shadcn-styled controls, popups and a GeoJSON layer; it ships no raster layer and no drawing, which cost 44 and 58 lines in the proof. I built this exact set in a throwaway Vite project: type-check and build pass, and in a headless browser the basemap, satellite layer, two dated GIBS layers, the Planetary Computer Sentinel-2 overlay and a drawn 718 ha field all rendered with no console errors. Build the layer panel and the time slider from shadcn Switch, Slider and Button over one config array, because every existing MapLibre plugin for them brings its own unstyled UI. Not tested: a real phone, touch drawing, and mapcn's light/dark style swap with custom layers attached.

## Spec

## Package set (built and run together)

| Package | Version | Licence |
| --- | --- | --- |
| `maplibre-gl` | 6.18.0 | BSD-3 |
| `@mapcn/map` (shadcn registry item, copies `src/components/ui/map.tsx`) | registry | MIT |
| `terra-draw` + `terra-draw-maplibre-gl-adapter` | 1.39.0 + 1.5.0 | MIT |
| `@turf/area` | 7.4.0 | MIT |
| dev: `tailwindcss`, `@tailwindcss/vite`, `@types/geojson` | 4.3.5 | MIT |

shadcn components: `button slider switch toggle-group` (later `card sheet`). Not installed: leaflet, react-leaflet, geoman, react-map-gl, deck.gl.

```bash
npm create vite@latest frontend -- --template react-ts --no-interactive
npm i -D tailwindcss @tailwindcss/vite @types/geojson   # add tailwindcss() + '@' alias in vite.config.ts, "paths" in both tsconfigs
npx shadcn@latest init -d -y
npx shadcn@latest add @mapcn/map slider switch toggle-group -y   # installs maplibre-gl@^6
npm i terra-draw@1.39.0 terra-draw-maplibre-gl-adapter@1.5.0 @turf/area@7.4.0
```

## Worker (first import in `main.tsx`)

```ts
import { setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
setWorkerUrl(workerUrl)
```

## Raster date layers

Working 44-line component: `proof/src/map/RasterLayer.tsx`. Core calls:

```ts
map.addSource(id, { type: 'raster', tiles: [url], tileSize: 256, maxzoom, attribution, bounds })
map.addLayer({ id, type: 'raster', source: id }, firstSymbolLayerId)   // labels stay on top
map.getSource(id).setTiles([newUrl])                                   // date change, no blank frame
map.setPaintProperty(id, 'raster-opacity', o)
map.setLayoutProperty(id, 'visibility', on ? 'visible' : 'none')
```

```ts
const gibsUrl = (layer, date, ext) =>
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.${ext}`
// 16-day NDVI: snap client-side, dated GIBS tiles are no-store
const jan1 = Date.UTC(d.getUTCFullYear(), 0, 1), doy0 = Math.floor((d - jan1) / 864e5)
const periodStart = new Date(jan1 + Math.floor(doy0 / 16) * 16 * 864e5)
```

- GIBS MODIS layers: `maxzoom: 9` (HTTP 400 beyond), `.jpg` true colour, `.png` NDVI.
- Planetary Computer: build the query with `URLSearchParams` (`+` must become `%2B`), pass the item bbox as `bounds`, about 2 s per tile, field zoom only.
- Satellite: `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-${year}_3857/default/g/{z}/{y}/{x}.jpg`, `maxzoom: 14`.
- Basemap: `<Map styles={{ light: 'https://tiles.openfreemap.org/styles/positron', dark: 'https://tiles.openfreemap.org/styles/dark' }}>`.
- The map imagery needs no local archive: every date since 2000 is in the URL.

## Drawing (58-line hook: `proof/src/map/useFieldDraw.ts`)

```ts
const draw = new TerraDraw({ adapter: new TerraDrawMapLibreGLAdapter({ map }), modes: [
  new TerraDrawPolygonMode({ validation: (f, c) => c.updateType !== 'finish' ? { valid: true }
    : ValidateMaxAreaSquareMeters(f, 5_000 * 10_000) }),
  new TerraDrawSelectMode({ flags: { polygon: { feature: { draggable: true,
    coordinates: { midpoints: true, draggable: true, deletable: true } } } } }) ] })
draw.start(); draw.setMode('polygon' /* or 'select' */)
draw.on('finish', (id) => save(draw.getSnapshotFeature(id)))   // GeoJSON; hectares = area(f) / 10_000
draw.removeFeatures([id])                                       // after saving, or to delete
```

Toolbar: three shadcn icon buttons (draw, edit, delete) plus the live hectare readout.

## Saved fields

```tsx
const STATUS: ExpressionSpecification = ['match', ['get', 'status'], 'alert', '#dc2626', 'watch', '#f59e0b', '#16a34a']
<MapGeoJSON data={fields} promoteId="id" interactive onClick={(e) => select(e.feature.properties.id)}
  fillPaint={{ 'fill-color': STATUS, 'fill-opacity': 0.35 }} linePaint={{ 'line-color': STATUS, 'line-width': 2 }} />
```

Labels: one `symbol` layer, `'text-field': ['get', 'name']`, `'text-font': ['Noto Sans Regular']`.

## Layer panel, legend, time slider

- One `LAYERS` config array; per row a `Switch`, an opacity `Slider` and `<img src={legend}>`. `Card` on desktop, `Sheet` on phone.
- Legends: `https://gibs.earthdata.nasa.gov/legends/MODIS_L3_NDVI_H.png`, `https://planetarycomputer.microsoft.com/api/data/v1/legend/colormap/rdylgn`.
- Map/Satellite `ToggleGroup` toggles a raster layer. Do not swap styles: a swap tears down custom layers and terra-draw.
- Time slider: `Slider` + play/pause `Button` + `setInterval` (about 15 lines). Slide over frame dates (16-day period starts, May to September) with a year toggle (2021 | 2024).
- Debounce drags by 150 ms. Play interval 2 s or advance on `map.once('idle')`.
- Optional cross-fade with preload: two layers per product, load the next date at `raster-opacity: 0`, swap on `idle`.

## Pitfalls

1. mapcn defaults to CARTO, which now needs a key: always pass `styles`.
2. `tileSize: 256` on every raster source (MapLibre defaults to 512).
3. `visibility: none` stops tile loading; opacity 0 does not.
4. Add custom layers in an effect keyed on mapcn's `isLoaded`; pass a fixed `theme` to avoid style swaps.
5. Set `attribution` on each source; MapLibre merges them.
6. Zoom in before drawing: terra-draw closes a polygon when a click lands near an existing vertex.
7. For "no press animation", delete `active:not-aria-[haspopup]:translate-y-px` and `transition-all` from shadcn's `button.tsx`.

## Where things are

- Proof: `docs/research/map-stack/proof` (`src/App.tsx`, `src/map/`).
- Screenshots: `.../map-stack/shots/`. Scripts: `.../map-stack/scripts/`. Log: `.../map-stack/smoke.log`.
- No `report.md` was written: the harness refused report files from this agent, so the long version is this output plus the proof source.
- The project repository was not touched and no server is left running.

## Corrections this made to the first brief

- Section 6: replace 'Leaflet (react-leaflet) with Leaflet-Geoman for drawing' with 'MapLibre GL JS 6 through mapcn (npx shadcn@latest add @mapcn/map), terra-draw, @turf/area', and add shadcn/ui to the frontend stack.
- Section 6: remove 'MapLibre (needs a keyed tile provider)' from the dropped list. OpenFreeMap is keyless and unlimited.
- Section 7, Planetary Computer template: '(B08+B04)' must be sent as '(B08%2BB04)'. A raw '+' returns HTTP 400 'Unsupported band math expression'. Add: pass the item bbox as the source bounds, expect about 2 s per tile.
- Section 7, GIBS: 'MODIS_Terra_NDVI_8Day only covers the current year' is now 2025-02-12 to 2026-11-12. Add: native max zoom 9 for both MODIS layers (HTTP 400 beyond), 16-day NDVI dates snap to the period start, NDVI data currently ends 2026-10-16, dated tiles are no-store, ready legend images exist under https://gibs.earthdata.nasa.gov/legends/.
- Section 10: 'OpenStreetMap tiles are keyless' is true, but the default basemap should be OpenFreeMap. OSM's tile policy gives no SLA and allows blocking without notice.
- Section 10 credits: add 'OpenFreeMap © OpenMapTiles, data from OpenStreetMap' and 'EOxCloudless https://cloudless.eox.at by EOX IT Services GmbH (Contains modified Copernicus Sentinel data <year>)'.
- Section 5 or 8: note that shadcn's default Button has a 1 px press nudge (active:translate-y-px) to remove, since the user wants a pressed state with no movement.

## Risks

- Tile latency sets the pace of the slider: one date step is about 24 tiles per GIBS layer and took 1.9 to 2.7 s to settle on a good connection. On venue Wi-Fi, play mode may look slow; keep the three presets on a few fixed dates for the demo.
- Dated GIBS tiles are sent with cache-control: no-store, so revisiting a date downloads it again. The browser cache will not help replays.
- Planetary Computer renders tiles on demand at about 2 s each and its public rate limits are unknown. Restrict that overlay to one item at field zoom.
- OpenFreeMap has no SLA. Keep the style URL in one constant so the basemap can be switched to OSM raster or GIBS Blue Marble in one line.
- EOX Sentinel-2 cloudless is free for non-commercial use only (CC BY-NC-SA 4.0). Fine for the hackathon, not for a later commercial product.
- Phone behaviour is untested. MapLibre 6 requires WebGL2, and four stacked raster layers plus touch drawing were only exercised in a desktop-sized headless browser with software rendering.
- mapcn is a 2,763-line vendored file less than a year old on a MapLibre major released in July 2026. It compiled and ran cleanly here, but its light/dark style swap with custom layers and terra-draw attached was not exercised.
- terra-draw is headless: the toolbar, the 'name it and declare the rotation' dialog and the removal of the temporary drawing after saving are app code (about 60 lines in the proof).

## Open questions

- Is the non-commercial EOX licence acceptable for the public demo? If not, the satellite layer falls back to GIBS Blue Marble (zoom 8) plus the dated layers, or to Esri World Imagery with a free ArcGIS key.
- Light map only, or light and dark? A fixed theme removes the style-swap pitfall entirely.
- Headless terra-draw with three shadcn buttons (recommended), or the ready-made control @watergis/maplibre-gl-terradraw 1.17.0, which has the default MapLibre look?
- Should the satellite basemap year follow the slider year (EOX has one mosaic per year, 2016 to 2025)? It is one prop, and makes 2021 versus 2024 visible at field zoom.
- The task asked for a report.md in the scratch folder; the harness blocked report files from this agent. Say so if the long version should be written to disk by the parent instead.

## Findings

- **[verified-live]** Latest versions and dates: maplibre-gl 6.18.0 (2026-11-11, BSD-3-Clause; 6.0.0 shipped 2026-07-22), terra-draw 1.39.0 (2026-10-28, MIT), terra-draw-maplibre-gl-adapter 1.5.0 (2026-10-06, peer maplibre-gl >=4), @turf/area 7.4.0 (2026-08-03), @vis.gl/react-maplibre 8.1.3 (2026-09-02, peers react >=16.3, maplibre-gl >=4), react-leaflet 5.0.0 (2024-12-14, peer react ^19, leaflet ^1.9), leaflet 1.9.4 (2023-05-18; 2.0.0-beta.4 exists), @geoman-io/leaflet-geoman-free 2.20.6 (2026-11-04), deck.gl 9.4.1 (2026-10-28).
  - Evidence: npm view via docs/research/map-stack/scripts/npmdate.mjs
- **[verified-live]** The chosen set type-checks and builds on React 19.3.1, Vite 8.3.8, TypeScript 7.0.2, Tailwind 4.3.5, shadcn CLI 4.23.0. tsc -b exits 0; vite build takes about 0.3 s and emits index.js 1,556 kB (436 kB gzip) plus a separate 519 kB MapLibre worker.
  - Evidence: docs/research/map-stack/proof (npx tsc -b; npx vite build)
- **[verified-live]** The chosen set runs: in headless Chromium, OpenFreeMap positron, EOX s2cloudless-2021, GIBS MODIS true colour, GIBS MODIS NDVI 16-day and the Planetary Computer Sentinel-2 NDVI item overlay rendered together with 0 console errors; the MapLibre worker loaded from the local bundle; all tiles loaded 6.1 s after navigation.
  - Evidence: docs/research/map-stack/smoke.log and shots/small-3-date-change-settled.jpg
- **[verified-live]** A date change through RasterTileSource.setTiles() does not blank the layer: the screenshot 60 ms after the change still shows full imagery, and the new date settled after 1.9 to 2.7 s (about 24 tiles per GIBS layer at 1280x800).
  - Evidence: shots/small-2-date-change-plus-60ms.jpg vs small-3-date-change-settled.jpg; maplibre-gl-js v6.18.0 src/source/raster_tile_source.ts (setTiles calls load(true)); changelog 4.3.0 PR #4072 adds cross-fade between raster source updates
- **[verified-live]** In MapLibre a raster layer with raster-opacity 0 still fetches tiles (24 fetched for a new date), while visibility none fetches none. Opacity 0 is therefore the way to preload the next frame.
  - Evidence: scripts/preload.mjs output: 'opacity 0: NDVI tiles fetched = 24', 'visibility none: = 0'
- **[source-read]** Leaflet blanks the layer on every date change: react-leaflet's TileLayer calls layer.setUrl(url) on a changed url prop, setUrl calls redraw(), and redraw() calls _removeAllTiles().
  - Evidence: proof/node_modules/react-leaflet/lib/TileLayer.js; proof/node_modules/leaflet/src/layer/tile/TileLayer.js:130 and GridLayer.js:228
- **[verified-live]** terra-draw works on MapLibre 6.18 at runtime: a triangle drawn at zoom 11 fired 'finish' and was saved as 'Field 1 (718 ha)' with a rendered label; a 200,048 ha triangle was refused by the built-in ValidateMaxAreaSquareMeters at a 5,000 ha cap.
  - Evidence: smoke.log ('toolbar text 718.3 ha', saved fields); shots/small-4-after-draw.jpg; proof/src/map/useFieldDraw.ts
- **[verified-live]** mapcn exists and is maintained: shadcn registry at https://mapcn.dev/r/{name}.json, install with `npx shadcn@latest add @mapcn/map`; GitHub AnmolSaini16/mapcn has 12,388 stars, MIT, created 2025-12-28, last push 2026-11-09; the shadcn registry directory rates it healthy (98.4). The npm package named 'mapcn' is a 219-byte placeholder.
  - Evidence: https://mapcn.dev/r/map.json, https://mapcn.dev/llms.txt, https://api.github.com/repos/AnmolSaini16/mapcn, https://ui.shadcn.com/r/registries.json, npm view mapcn
- **[source-read]** mapcn ships Map, useMap, MapControls, MapMarker, MarkerContent, MarkerPopup, MarkerTooltip, MarkerLabel, MapPopup, MapRoute, RouteProgress, RouteMarker, MapArc, MapGeoJSON (fill and line with data-driven paint, hover state, onClick) and MapClusterLayer. It ships no raster source component, no drawing, no layer switcher and no time slider; useMap() exposes the raw MapLibre map. Dependencies: maplibre-gl@^6 and lucide-react.
  - Evidence: downloads/mapcn_map.tsx (2,763 lines, read from https://mapcn.dev/r/map.json)
- **[source-read]** mapcn's default basemap is keyless CARTO, and falls back to loading the MapLibre worker from unpkg at runtime unless a worker URL is already set.
  - Evidence: downloads/mapcn_map.tsx lines 29-51 (setWorkerUrl to unpkg.com; defaultStyles basemaps.cartocdn.com)
- **[verified-live]** CARTO basemaps now require an API key. A keyless raster tile came back with an 'API KEY REQUIRED carto.com/basemaps/apikey' watermark.
  - Evidence: downloads/tiles/carto_raster.png (viewed); https://raw.githubusercontent.com/CartoDB/basemap-styles/master/README.md ('An API key is required to use CARTO basemaps')
- **[verified-live]** OpenFreeMap is keyless with no request limit, allows commercial use, requires attribution and offers no SLA. Styles positron, dark and liberty return 200 with access-control-allow-origin: * and all ship the 'Noto Sans Regular' font.
  - Evidence: https://openfreemap.org/ ('no registration, no user database, no API keys', 'no limits on the number of map views or requests'); curl of https://tiles.openfreemap.org/styles/{positron,dark,liberty}
- **[verified-live]** EOX Sentinel-2 cloudless is keyless at https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-{year}_3857/default/g/{z}/{y}/{x}.jpg for 2017 to 2025 (2016 is s2cloudless_3857), 256 px, CORS echoes the origin, zoom 18 answered. Free for non-commercial use under CC BY-NC-SA 4.0; commercial use needs an EOX licence; a fixed attribution string is required.
  - Evidence: https://tiles.maps.eox.at/wmts/1.0.0/WMTSCapabilities.xml; https://cloudless.eox.at/documentation/license; curl probes
- **[source-read]** OpenStreetMap's tile policy requires visible attribution and a valid Referer, forbids prefetching and bulk download, gives no SLA and says access may be blocked without notice.
  - Evidence: https://operations.osmfoundation.org/policies/tiles/
- **[verified-live]** Esri World Imagery answers without a key (256 px, zoom up to 23, CORS *) but is 'licensed under the Esri Master License Agreement'. I found no Esri statement permitting keyless use in a third-party app. One of three requests reset after 92 s.
  - Evidence: https://www.arcgis.com/sharing/rest/content/items/10df2279f9684e4a9f6a7f08febac2a9?f=json (licenseInfo); curl probes of server.arcgisonline.com
- **[verified-live]** GIBS layer limits: MODIS_Terra_CorrectedReflectance_TrueColor (jpeg, daily from 2000-02-24) and MODIS_Terra_L3_NDVI_16Day (png, 2000-03-05 to 2026-10-16) are both GoogleMapsCompatible_Level9, native max zoom 9, 256 px tiles. SMAP_L4_Analyzed_Root_Zone_Soil_Moisture and IMERG_Precipitation_Rate are Level6, MODIS_Terra_Land_Surface_Temp_Day is Level7, BlueMarble_ShadedRelief_Bathymetry is Level8, HLS_S30/HLS_L30 are Level12.
  - Evidence: https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml parsed by scripts/gibs_layers.py
- **[verified-live]** GIBS behaviour: zoom beyond the native level returns HTTP 400 (z10 on a Level9 layer); a date with no data returns 404; every response carries access-control-allow-origin: *; dated tiles carry cache-control: no-store; latency was 0.45 to 1.1 s per tile.
  - Evidence: curl probes saved in downloads/tiles/*.hdr
- **[verified-live]** GIBS snaps 16-day NDVI dates to the period start, and the period start is 1 January plus 16 x floor(dayOfYear0 / 16) days, including leap years. Tiles for 2021-07-12, -15 and -27 are byte-identical and 2021-07-28 differs; the formula matched live tiles for four further dates.
  - Evidence: md5 of downloads/tiles/ndvi_*.png; scripts/ndvi_period.mjs (asserts pass, 'ok')
- **[verified-live]** GIBS HLS 30 m layers are sparse by date (days without an overpass return a 1 kB empty PNG) and two of sixteen requests returned a transient HTTP 500 that succeeded on retry.
  - Evidence: curl loop over 2021-07-13..18 and 2024-07-15..16 for HLS_S30 and HLS_L30
- **[verified-live]** GIBS and Planetary Computer both serve ready legend images: https://gibs.earthdata.nasa.gov/legends/MODIS_L3_NDVI_H.png (420x95, labelled 0.0 to 1.0) and https://planetarycomputer.microsoft.com/api/data/v1/legend/colormap/rdylgn (387x11, unlabelled).
  - Evidence: LegendURL entries in the GIBS capabilities; downloads/tiles/MODIS_L3_NDVI_H.png (viewed); curl of the Planetary Computer legend endpoint
- **[verified-live]** The Planetary Computer tile template in the brief fails as written: a raw '+' in the expression returns HTTP 400 'Unsupported band math expression'. With %2B it returns a 256x256 RGBA PNG with CORS * in about 2 s per tile. Tiles outside the item footprint return 404, and @2x returns JPEG unless format=png is added.
  - Evidence: curl probes with item S2A_MSIL2A_20210722T064631_R020_T41UNV_20210722T160824; downloads/tiles/pc_ndvi_1x.png (viewed)
- **[verified-live]** MapLibre GL JS 6 is ESM-only, has no default export, requires WebGL2, and under Vite needs setWorkerUrl with `maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url`.
  - Evidence: https://raw.githubusercontent.com/maplibre/maplibre-gl-js/main/docs/guides/v5-to-v6-migration-guide.md and docs/index.md (Vite tab); confirmed by the proof build and run
- **[verified-live]** The runner-up, @vis.gl/react-maplibre 8.1.3, type-checks against maplibre-gl 6.18 and React 19.3.1, and turns a changed `tiles` prop on <Source> into source.setTiles(). It was not run in a browser.
  - Evidence: proof/src/alt/ReactMaplibreAlt.tsx (tsc exit 0); proof/node_modules/@vis.gl/react-maplibre/dist/components/source.js:56
- **[verified-live]** react-leaflet 5.0.0 with Leaflet 1.9.4 and Leaflet-Geoman free 2.20.6 type-checks on React 19.3.1. react-leaflet is licensed Hippocratic-2.1, which is not an OSI-approved licence. It was not run in a browser.
  - Evidence: proof/src/alt/LeafletAlt.tsx (tsc exit 0); npm view react-leaflet license
- **[verified-live]** Other shadcn-registry map components are not usable here: @shadcn-map (Leaflet, react-leaflet, leaflet-draw) answers HTTP 402 DEPLOYMENT_DISABLED and is marked degraded; every @terrae item depends on mapbox-gl; @amap and @shadcnmaps are not web-mercator tile maps.
  - Evidence: https://ui.shadcn.com/r/registries.json; curl https://shadcn-map.vercel.app/r/map.json (402); https://www.terrae.dev/registry.json
- **[memory]** Existing layer-control and time-slider plugins exist but bring their own DOM and CSS: maplibre-gl-layer-control 0.18.3 (2026-10-29), maplibre-gl-opacity 1.8.0 (2025-01-19), @watergis/maplibre-gl-legend 3.0.0 (2026-11-03, legends from vector style symbols), maplibre-gl-time-slider 1.8.7 (2026-09-04, peers on maplibre-gl-raster), maplibre-gl-temporal-control 1.2.0 (2024-12-29). @mapcomponents/react-maplibre 1.8.20 is MUI-based with 36 dependencies.
  - Evidence: npm view via scripts/npmdate.mjs; what each plugin's UI looks like is from recall, not inspected
- **[verified-live]** shadcn's current default Button (style base-nova) includes `active:not-aria-[haspopup]:translate-y-px` and `transition-all`, a 1 px press nudge. mapcn's control buttons use `transition-colors` only.
  - Evidence: proof/src/components/ui/button.tsx line 6; downloads/mapcn_map.tsx ControlButton
- **[memory]** Leaflet pitfalls under Vite: leaflet.css must be imported, the container needs an explicit height, and default marker icons break unless L.Icon.Default.mergeOptions is given imported asset URLs.
  - Evidence: Recall only; not reproduced because Leaflet is not the recommended stack

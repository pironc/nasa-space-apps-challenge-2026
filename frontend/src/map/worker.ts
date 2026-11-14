// MapLibre v6 is ESM-only: under a bundler the worker URL must be set once, before any map is created.
import { setWorkerUrl } from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'

setWorkerUrl(workerUrl)

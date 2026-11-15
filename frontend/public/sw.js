// Keeps map tiles in the browser so moving the time slider back and forth is instant: NASA GIBS
// layers (marked "no-store", so the normal browser cache never keeps them) and Sentinel-2 images
// rendered by the Planetary Computer (about 2 s each the first time). It stores the tiles the map
// shows, and the tiles the page asks it to fetch ahead (the dates around the one shown, for the area
// in view only).
const CACHE = "gibs-tiles-v1"
const SOURCES = [
  "https://gibs.earthdata.nasa.gov/wmts/",
  "https://planetarycomputer.microsoft.com/api/data/v1/item/tiles/",
]
const ours = (url) => SOURCES.some((s) => url.startsWith(s))
const AHEAD = 6 // tiles fetched ahead at once

self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()))

async function cached(url) {
  const cache = await caches.open(CACHE)
  const hit = await cache.match(url)
  if (hit) return hit
  const res = await fetch(url, { mode: "cors" })
  // 404: outside the image's footprint. Kept too, so it is not asked for again.
  if (res.ok || res.status === 404) await cache.put(url, res.clone())
  return res
}

self.addEventListener("fetch", (e) => {
  if (e.request.method === "GET" && ours(e.request.url)) e.respondWith(cached(e.request.url))
})

// Fetch-ahead queue: the newest request replaces the old one, since the view or date has moved on.
let queue = []
let running = 0
async function pump() {
  while (running < AHEAD && queue.length) {
    const url = queue.shift()
    running++
    caches
      .open(CACHE)
      .then((c) => c.match(url))
      .then((hit) => hit || cached(url))
      .catch(() => {})
      .finally(() => {
        running--
        pump()
      })
  }
}
self.addEventListener("message", (e) => {
  if (e.data?.type !== "prefetch" || !Array.isArray(e.data.urls)) return
  queue = e.data.urls.filter((u) => typeof u === "string" && ours(u)).slice(0, 800)
  pump()
})

// Keeps NASA GIBS map tiles in the browser so moving the time slider back and forth is instant.
// GIBS marks its dated tiles "no-store", so the normal browser cache never keeps them; this worker
// stores the tiles the map shows, and the tiles the page asks it to fetch ahead (the dates around
// the one shown, for the area in view only).
const CACHE = "gibs-tiles-v1"
const GIBS = "https://gibs.earthdata.nasa.gov/wmts/"
const AHEAD = 6 // tiles fetched ahead at once

self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()))

async function cached(url) {
  const cache = await caches.open(CACHE)
  const hit = await cache.match(url)
  if (hit) return hit
  const res = await fetch(url, { mode: "cors" })
  if (res.ok) await cache.put(url, res.clone())
  return res
}

self.addEventListener("fetch", (e) => {
  if (e.request.method === "GET" && e.request.url.startsWith(GIBS)) e.respondWith(cached(e.request.url))
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
  queue = e.data.urls.filter((u) => typeof u === "string" && u.startsWith(GIBS)).slice(0, 800)
  pump()
})

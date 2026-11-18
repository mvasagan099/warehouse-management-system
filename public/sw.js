/* Service worker: makes the app open with no signal. It caches the app shell and the hashed build files only.
   It never caches API answers, signed file links or anything from Supabase: data always comes live, or from the phone's own offline queue. */
const VERSION = 'wms-v2'
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/favicon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return                  // Supabase, Razorpay, Sentry: never touched

  // page loads: network first, the cached shell when there is no connection
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(VERSION).then((c) => c.put('/', copy)); return res }).catch(() => caches.match('/').then((r) => r || Response.error())))
    return
  }
  // hashed build files never change: cache first
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)) } return res })))
  }
})

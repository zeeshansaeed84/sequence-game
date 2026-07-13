// sw.js — minimal offline-cache service worker for Sequence.
//
// This app is a single HTML file, so the "app shell" being cached is
// literally just that one document — no separate JS/CSS bundle to manage.
//
// Strategy: network-first, cache-as-fallback. Every successful load (while
// online) refreshes the cached copy, so the offline fallback is always as
// current as your last successful visit. When the network is unreachable —
// e.g. opening the home-screen icon in airplane mode — this is what stands
// between the game actually loading and iOS's own "can't connect" system
// error page taking over instead.
//
// Deliberately narrow scope: only intercepts NAVIGATION requests (loading
// the page itself). Firebase calls, the Firebase SDK script, and anything
// else are left completely alone — those already fail/succeed based on
// real connectivity, and the app's own JS already handles that gracefully
// (see fbInit(), the offline stats queue, etc.). This service worker's only
// job is making sure the document itself can load with zero connectivity.
//
// Bump CACHE_NAME (v1 -> v2 -> ...) only if this file's OWN caching logic
// changes in a way that needs old cached entries cleared out — NOT needed
// for ordinary game updates, since network-first already keeps the cached
// copy fresh on every successful online visit.
const CACHE_NAME = 'sequence-cache-v1';
const APP_SHELL_URL = './index.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(['./', APP_SHELL_URL]))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return; // leave everything else alone

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(APP_SHELL_URL, copy));
        return response;
      })
      // Network failed (no connectivity at all) — serve whatever we cached
      // during the last successful visit, regardless of the exact URL/query
      // params requested (e.g. a shared ?watch=CODE spectate link falls
      // back to the plain app shell — correct behavior, since spectating
      // requires a live connection anyway and couldn't have worked offline
      // either way).
      .catch(() => caches.match(APP_SHELL_URL))
  );
});

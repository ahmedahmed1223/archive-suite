/**
 * Archive Suite Service Worker
 * Strategy:
 * - App shell (HTML/JS/CSS): Cache-first, update in background
 * - API calls (/api/*): Network-only (never cache auth/data)
 * - Static assets: Stale-while-revalidate
 */
const CACHE_NAME = "archive-suite-v1";
const OFFLINE_PAGE = "/offline.html";

const PRECACHE = [
  "/",
  "/offline.html",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE).catch(() => {}))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Web Push (§20.2) ─────────────────────────────────────────────────────────
// Payload shape (JSON from archive-server webPushService):
//   { title, body, url, tag, type }
// `tag` groups similar alerts so the OS replaces instead of stacking them.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: event.data ? event.data.text() : "إشعار جديد" };
  }
  const title = data.title || "Archive Suite";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      tag: data.tag || data.type || "archive",
      renotify: false,
      dir: "rtl",
      lang: "ar",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      // Focus an existing app window when one is open; otherwise open a new one.
      for (const client of windows) {
        if ("focus" in client) {
          client.navigate(url).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never cache API calls — always go to network
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: "أنت غير متصل بالإنترنت" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    return;
  }

  // HTML navigation: Cache-first with network fallback to offline page
  if (request.mode === "navigate") {
    event.respondWith(
      caches.match(request).then(cached =>
        cached || fetch(request).then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        }).catch(() => caches.match(OFFLINE_PAGE))
      )
    );
    return;
  }

  // Other requests: stale-while-revalidate
  event.respondWith(
    caches.match(request).then(cached => {
      const networkFetch = fetch(request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      });
      return cached || networkFetch;
    })
  );
});

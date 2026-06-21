/**
 * Archive Suite Service Worker — v3
 *
 * Strategies:
 * - App shell (HTML): Cache-first with background update
 * - API GET: Network-first with cache fallback (3-minute TTL)
 * - API mutations (POST/PUT/PATCH/DELETE): Network-first; queued via
 *   BackgroundSync when offline, replayed on reconnect
 * - Fonts / icons: CacheFirst (long-lived)
 * - JS/CSS/images: StaleWhileRevalidate
 * - Push notifications: handled (§20.2)
 * - Periodic Background Sync: triggers API re-validation
 */

const CACHE_VERSION = "v3";
const CACHE_SHELL   = `archive-shell-${CACHE_VERSION}`;
const CACHE_ASSETS  = `archive-assets-${CACHE_VERSION}`;
const CACHE_API_GET = `archive-api-get-${CACHE_VERSION}`;
const OFFLINE_PAGE  = "/offline.html";

const BG_SYNC_TAG     = "archive-write-sync";
const SYNC_STORE_NAME = "archive-bg-sync";

// These caches from older SW versions will be cleaned up on activate.
const KNOWN_CACHES = new Set([CACHE_SHELL, CACHE_ASSETS, CACHE_API_GET, SYNC_STORE_NAME]);

// API GET responses are revalidated after this many ms.
const API_TTL_MS = 3 * 60 * 1000; // 3 minutes

// ── Precache (app shell) ──────────────────────────────────────────────────────

const PRECACHE = ["/", "/offline.html"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_SHELL).then((cache) =>
      cache.addAll(PRECACHE).catch(() => {})
    )
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !KNOWN_CACHES.has(k))
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── BackgroundSync helpers ────────────────────────────────────────────────────

/**
 * Persist a failed mutation request to the sync cache so we can replay it
 * after connectivity returns. Uses Cache API as a lightweight queue.
 */
async function enqueueForSync(request) {
  try {
    const body = await request.clone().text();
    const entry = {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body,
      ts: Date.now(),
    };
    const queue = await caches.open(SYNC_STORE_NAME);
    const key = `${entry.method}:${entry.url}:${entry.ts}`;
    await queue.put(
      new Request(key),
      new Response(JSON.stringify(entry), {
        headers: { "Content-Type": "application/json" },
      })
    );
  } catch {
    // Enqueue failure is non-fatal.
  }
}

async function replayQueue() {
  const queue = await caches.open(SYNC_STORE_NAME);
  const keys = await queue.keys();
  await Promise.allSettled(
    keys.map(async (key) => {
      const response = await queue.match(key);
      if (!response) return;
      let entry;
      try {
        entry = await response.json();
      } catch {
        await queue.delete(key);
        return;
      }
      const req = new Request(entry.url, {
        method: entry.method,
        headers: entry.headers,
        body: entry.body || undefined,
        credentials: "include",
      });
      const result = await fetch(req);
      if (result.ok) {
        await queue.delete(key);
      }
    })
  );
}

self.addEventListener("sync", (event) => {
  if (event.tag === BG_SYNC_TAG) {
    event.waitUntil(replayQueue());
  }
});

// Periodic Background Sync — re-validates cached API GET responses.
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "archive-periodic-sync") {
    event.waitUntil(
      caches.open(CACHE_API_GET).then(async (cache) => {
        const keys = await cache.keys();
        await Promise.allSettled(
          keys.map(async (req) => {
            try {
              const fresh = await fetch(req.clone(), { credentials: "include" });
              if (fresh.ok) await cache.put(req, fresh);
            } catch { /* offline — skip */ }
          })
        );
      })
    );
  }
});

// ── Push notifications (§20.2) ───────────────────────────────────────────────

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
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windows) => {
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

// ── Fetch handler ─────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. API mutations → Network-first; enqueue for BackgroundSync on failure.
  if (
    url.pathname.startsWith("/api/") &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(request.method)
  ) {
    event.respondWith(
      fetch(request.clone()).catch(async () => {
        await enqueueForSync(request.clone());
        if ("sync" in self.registration) {
          try {
            await self.registration.sync.register(BG_SYNC_TAG);
          } catch { /* registration may fail on some browsers */ }
        }
        return new Response(
          JSON.stringify({ error: "أنت غير متصل — سيُعاد إرسال الطلب عند اتصالك." }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" },
          }
        );
      })
    );
    return;
  }

  // 2. API GET → Network-first with short-TTL cache fallback.
  if (url.pathname.startsWith("/api/") && request.method === "GET") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_API_GET);
        try {
          const networkResponse = await fetch(request.clone());
          if (networkResponse.ok) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        } catch {
          const cached = await cache.match(request);
          if (cached) return cached;
          return new Response(
            JSON.stringify({ error: "أنت غير متصل بالإنترنت" }),
            { status: 503, headers: { "Content-Type": "application/json" } }
          );
        }
      })()
    );
    return;
  }

  // 3. Fonts & icons → CacheFirst (practically immutable).
  if (
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/fonts/") ||
    request.destination === "font"
  ) {
    event.respondWith(
      caches.open(CACHE_ASSETS).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const networkResponse = await fetch(request.clone());
          if (networkResponse.ok) cache.put(request, networkResponse.clone());
          return networkResponse;
        } catch {
          return new Response("", { status: 503 });
        }
      })
    );
    return;
  }

  // 4. HTML navigation → Cache-first, fallback to offline page.
  if (request.mode === "navigate") {
    event.respondWith(
      caches.open(CACHE_SHELL).then(async (cache) => {
        const cached = await cache.match(request);
        try {
          const networkResponse = await fetch(request.clone());
          if (networkResponse.ok) cache.put(request, networkResponse.clone());
          return networkResponse;
        } catch {
          return (
            cached ||
            (await caches.match(OFFLINE_PAGE)) ||
            new Response("Offline", { status: 503 })
          );
        }
      })
    );
    return;
  }

  // 5. JS/CSS/images → StaleWhileRevalidate.
  event.respondWith(
    caches.open(CACHE_ASSETS).then(async (cache) => {
      const cached = await cache.match(request);
      const networkFetch = fetch(request.clone())
        .then((networkResponse) => {
          if (networkResponse.ok) cache.put(request, networkResponse.clone());
          return networkResponse;
        })
        .catch(() => null);
      // Return cached immediately; update cache in background.
      if (cached) {
        networkFetch.catch(() => {});
        return cached;
      }
      return (await networkFetch) || new Response("", { status: 503 });
    })
  );
});

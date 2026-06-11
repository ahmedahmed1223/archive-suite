// pushService.js — browser side of Web Push (§20.2).
// Talks to archive-server's /api/push/* endpoints and the PushManager API.
// All server calls carry the cloud JWT (Bearer) like the rest of the app.

import { getCloudToken } from "../bootstrap/cloudSession.js";

/** Convert a base64url VAPID key into the Uint8Array PushManager expects. */
export function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

function authHeaders({ storage } = {}) {
  const token = getCloudToken({ storage });
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** True when this browser can do Web Push at all. */
export function isPushSupported(scope = globalThis) {
  return Boolean(scope.navigator?.serviceWorker) && "PushManager" in scope && "Notification" in scope;
}

/**
 * Full subscribe flow: permission → VAPID key → PushManager.subscribe →
 * POST /api/push/subscribe. Throws Error with a user-facing Arabic message.
 *
 * @param {object} [opts]
 * @param {string} [opts.baseUrl]
 * @param {typeof fetch} [opts.fetchImpl] - injectable for tests
 * @param {object} [opts.registration] - injectable ServiceWorkerRegistration
 * @param {object} [opts.notification] - injectable Notification API
 * @param {object} [opts.storage]
 * @returns {Promise<{subscribed: boolean}>}
 */
export async function subscribeToPush({ baseUrl = "", fetchImpl, registration, notification, storage } = {}) {
  const doFetch = fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
  if (!doFetch) throw new Error("لا يوجد منفّذ fetch.");
  const notif = notification || (typeof Notification !== "undefined" ? Notification : null);
  if (!notif) throw new Error("هذا المتصفح لا يدعم الإشعارات.");

  const permission = await notif.requestPermission();
  if (permission !== "granted") throw new Error("لم يُمنح إذن الإشعارات.");

  const reg = registration || (await navigator.serviceWorker.ready);
  const base = String(baseUrl || "").replace(/\/+$/, "");

  const keyRes = await doFetch(`${base}/api/push/vapid-public-key`, { headers: authHeaders({ storage }) });
  const keyJson = await keyRes.json().catch(() => ({}));
  if (!keyRes.ok || !keyJson?.key) {
    throw new Error(keyJson?.error || "Web Push غير مهيأ على الخادم.");
  }

  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(keyJson.key),
  });

  const saveRes = await doFetch(`${base}/api/push/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders({ storage }) },
    body: JSON.stringify({ subscription: subscription.toJSON ? subscription.toJSON() : subscription }),
  });
  const saveJson = await saveRes.json().catch(() => ({}));
  if (!saveRes.ok || !saveJson?.ok) {
    throw new Error(saveJson?.error || "فشل حفظ اشتراك الإشعارات.");
  }
  return { subscribed: true };
}

/**
 * Unsubscribe this browser and tell the server to drop the endpoint.
 * Safe to call when there is no active subscription.
 */
export async function unsubscribeFromPush({ baseUrl = "", fetchImpl, registration, storage } = {}) {
  const doFetch = fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
  if (!doFetch) throw new Error("لا يوجد منفّذ fetch.");
  const reg = registration || (await navigator.serviceWorker.ready);
  const subscription = await reg.pushManager.getSubscription();
  if (!subscription) return { subscribed: false };

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe().catch(() => {});

  const base = String(baseUrl || "").replace(/\/+$/, "");
  await doFetch(`${base}/api/push/unsubscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders({ storage }) },
    body: JSON.stringify({ endpoint }),
  }).catch(() => {});
  return { subscribed: false };
}

/** Current subscription state for settings UI toggles. */
export async function getPushSubscriptionState({ registration } = {}) {
  if (!isPushSupported()) return { supported: false, subscribed: false };
  try {
    const reg = registration || (await navigator.serviceWorker.ready);
    const subscription = await reg.pushManager.getSubscription();
    return { supported: true, subscribed: Boolean(subscription) };
  } catch {
    return { supported: true, subscribed: false };
  }
}

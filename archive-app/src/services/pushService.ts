import { getCloudToken } from "../bootstrap/cloudSession.js";

interface StorageLike {
  getItem(key: string): string | null;
}

interface FetchLike {
  (input: string, init?: RequestInit): Promise<ResponseLike>;
}

interface ResponseLike {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

interface NotificationLike {
  requestPermission(): Promise<NotificationPermission>;
}

interface PushSubscriptionLike {
  endpoint: string;
  toJSON?: () => unknown;
  unsubscribe?: () => Promise<boolean> | Promise<void>;
}

interface PushManagerLike {
  subscribe(options: PushSubscriptionOptionsInit): Promise<PushSubscriptionLike>;
  getSubscription(): Promise<PushSubscriptionLike | null>;
}

interface ServiceWorkerRegistrationLike {
  pushManager: PushManagerLike;
}

interface PushScopeLike {
  navigator?: { serviceWorker?: unknown };
  PushManager?: unknown;
  Notification?: unknown;
}

/** Convert a base64url VAPID key into the Uint8Array PushManager expects. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

function authHeaders({ storage }: { storage?: StorageLike } = {}): Record<string, string> {
  type CloudTokenOptions = NonNullable<Parameters<typeof getCloudToken>[0]>;
  type CloudTokenStorage = CloudTokenOptions["storage"];
  const token = getCloudToken({ storage: storage as CloudTokenStorage });
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** True when this browser can do Web Push at all. */
export function isPushSupported(scope: PushScopeLike = globalThis as unknown as PushScopeLike): boolean {
  return Boolean(scope.navigator?.serviceWorker) && "PushManager" in scope && "Notification" in scope;
}

export async function subscribeToPush({
  baseUrl = "",
  fetchImpl,
  registration,
  notification,
  storage
}: {
  baseUrl?: string;
  fetchImpl?: FetchLike;
  registration?: ServiceWorkerRegistrationLike;
  notification?: NotificationLike;
  storage?: StorageLike;
} = {}): Promise<{ subscribed: boolean }> {
  const doFetch = fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
  if (!doFetch) throw new Error("لا يوجد منفّذ fetch.");
  const notif = notification || (typeof Notification !== "undefined" ? Notification : null);
  if (!notif) throw new Error("هذا المتصفح لا يدعم الإشعارات.");

  const permission = await notif.requestPermission();
  if (permission !== "granted") throw new Error("لم يُمنح إذن الإشعارات.");

  const reg = registration || (await navigator.serviceWorker.ready);
  const base = String(baseUrl || "").replace(/\/+$/, "");

  const keyRes = await doFetch(`${base}/api/push/vapid-public-key`, { headers: authHeaders({ storage }) });
  const keyJson = (await keyRes.json().catch(() => ({}))) as { key?: string; error?: string };
  if (!keyRes.ok || !keyJson?.key) {
    throw new Error(keyJson?.error || "Web Push غير مهيأ على الخادم.");
  }

  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(keyJson.key) as unknown as BufferSource
  });

  const saveRes = await doFetch(`${base}/api/push/subscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders({ storage }) },
    body: JSON.stringify({ subscription: subscription.toJSON ? subscription.toJSON() : subscription })
  });
  const saveJson = (await saveRes.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  if (!saveRes.ok || !saveJson?.ok) {
    throw new Error(saveJson?.error || "فشل حفظ اشتراك الإشعارات.");
  }
  return { subscribed: true };
}

export async function unsubscribeFromPush({
  baseUrl = "",
  fetchImpl,
  registration,
  storage
}: {
  baseUrl?: string;
  fetchImpl?: FetchLike;
  registration?: ServiceWorkerRegistrationLike;
  storage?: StorageLike;
} = {}): Promise<{ subscribed: boolean }> {
  const doFetch = fetchImpl || (typeof fetch !== "undefined" ? fetch.bind(globalThis) : null);
  if (!doFetch) throw new Error("لا يوجد منفّذ fetch.");
  const reg = registration || (await navigator.serviceWorker.ready);
  const subscription = await reg.pushManager.getSubscription();
  if (!subscription) return { subscribed: false };

  const endpoint = subscription.endpoint;
  if (subscription.unsubscribe) {
    await subscription.unsubscribe().catch(() => {});
  }

  const base = String(baseUrl || "").replace(/\/+$/, "");
  await doFetch(`${base}/api/push/unsubscribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders({ storage }) },
    body: JSON.stringify({ endpoint })
  }).catch(() => {});
  return { subscribed: false };
}

/** Current subscription state for settings UI toggles. */
export async function getPushSubscriptionState({
  registration
}: {
  registration?: ServiceWorkerRegistrationLike;
} = {}): Promise<{ supported: boolean; subscribed: boolean }> {
  if (!isPushSupported()) return { supported: false, subscribed: false };
  try {
    const reg = registration || (await navigator.serviceWorker.ready);
    const subscription = await reg.pushManager.getSubscription();
    return { supported: true, subscribed: Boolean(subscription) };
  } catch {
    return { supported: true, subscribed: false };
  }
}

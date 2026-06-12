// pushManager.js — local (foreground/background) browser notifications via the
// Notification API (§14.2). This is distinct from services/pushService.js, which
// handles *server* Web Push subscription. Here we surface notifications the app
// already generated so the user is alerted even when the tab is not focused.
//
// Every function takes injectable dependencies so the module is testable without
// a real browser (no jsdom Notification needed).

/** @typedef {{ permission: string, requestPermission: Function }} NotificationApi */

/** Resolve the Notification constructor from a scope, or null when absent. */
function resolveNotification(scope) {
  const root = scope || (typeof globalThis !== "undefined" ? globalThis : undefined);
  return root && typeof root.Notification !== "undefined" ? root.Notification : null;
}

/** Resolve the document from a scope, or null when absent (SSR/tests). */
function resolveDocument(scope) {
  const root = scope || (typeof globalThis !== "undefined" ? globalThis : undefined);
  return root && typeof root.document !== "undefined" ? root.document : null;
}

/** True when this environment can show local browser notifications at all. */
export function isBrowserNotificationSupported({ scope } = {}) {
  return Boolean(resolveNotification(scope));
}

/**
 * Current permission state: "granted" | "denied" | "default" | "unsupported".
 */
export function getNotificationPermission({ scope } = {}) {
  const Notif = resolveNotification(scope);
  if (!Notif) return "unsupported";
  return Notif.permission || "default";
}

/**
 * Ask the user for permission. Returns the resulting permission string.
 * Never throws — an unsupported environment resolves to "unsupported".
 *
 * @param {{ scope?: object }} [deps]
 * @returns {Promise<string>}
 */
export async function requestNotificationPermission({ scope } = {}) {
  const Notif = resolveNotification(scope);
  if (!Notif) return "unsupported";
  if (Notif.permission === "granted" || Notif.permission === "denied") {
    return Notif.permission;
  }
  try {
    const result = await Notif.requestPermission();
    return result || "default";
  } catch {
    return "default";
  }
}

/**
 * Show a local browser notification. Returns the Notification instance, or null
 * when it could not be shown (unsupported / permission not granted / error).
 *
 * @param {string} title
 * @param {{ body?: string, tag?: string, icon?: string, data?: any, renotify?: boolean, silent?: boolean, onClick?: Function }} [options]
 * @param {{ scope?: object }} [deps]
 * @returns {Notification|null}
 */
export function showBrowserNotification(title, options = {}, { scope } = {}) {
  const Notif = resolveNotification(scope);
  if (!Notif || Notif.permission !== "granted") return null;
  try {
    const notification = new Notif(String(title || ""), {
      body: options.body ? String(options.body) : undefined,
      tag: options.tag || undefined,
      icon: options.icon || undefined,
      data: options.data,
      renotify: options.renotify || undefined,
      silent: options.silent || undefined,
    });
    if (typeof options.onClick === "function") {
      notification.onclick = options.onClick;
    }
    return notification;
  } catch {
    return null;
  }
}

const ALERT_TYPES = new Set(["success", "warning", "error"]);

/**
 * Decide whether an app-level notification deserves a browser notification.
 * Default policy: alert when the tab is hidden, OR when forced. Plain "info"
 * toasts are skipped unless forced — they are low-signal and noisy.
 *
 * @param {{ type?: string, category?: string }} appNotification
 * @param {{ scope?: object, force?: boolean }} [deps]
 * @returns {boolean}
 */
export function shouldAlertBrowser(appNotification = {}, { scope, force = false } = {}) {
  if (getNotificationPermission({ scope }) !== "granted") return false;
  if (force) return true;
  const doc = resolveDocument(scope);
  const hidden = doc ? doc.visibilityState === "hidden" || doc.hidden === true : false;
  if (!hidden) return false;
  const type = appNotification.type || "info";
  return ALERT_TYPES.has(type);
}

/**
 * Bridge an app notification to a browser notification when policy allows.
 * Returns the Notification instance or null. Deduped per app notification id
 * via the `tag` so repeated progress updates collapse onto one OS notification.
 *
 * @param {{ id?: string, title?: string, message?: string, type?: string, category?: string }} appNotification
 * @param {{ scope?: object, force?: boolean, icon?: string, onClick?: Function }} [deps]
 * @returns {Notification|null}
 */
export function notifyForAppNotification(appNotification = {}, deps = {}) {
  const { scope, force = false, icon, onClick } = deps;
  if (!shouldAlertBrowser(appNotification, { scope, force })) return null;
  return showBrowserNotification(
    appNotification.title || "إشعار جديد",
    {
      body: appNotification.message || "",
      tag: appNotification.id ? `archive-${appNotification.id}` : undefined,
      icon,
      data: { id: appNotification.id, category: appNotification.category },
      onClick,
    },
    { scope }
  );
}

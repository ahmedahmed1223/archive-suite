function resolveNotification(scope: any) {
  const root = scope || (typeof globalThis !== "undefined" ? globalThis : undefined);
  return root && typeof root.Notification !== "undefined" ? root.Notification : null;
}

function resolveDocument(scope: any) {
  const root = scope || (typeof globalThis !== "undefined" ? globalThis : undefined);
  return root && typeof root.document !== "undefined" ? root.document : null;
}

export function isBrowserNotificationSupported({ scope }: any = {}): boolean {
  return Boolean(resolveNotification(scope));
}

export function getNotificationPermission({ scope }: any = {}): string {
  const Notif = resolveNotification(scope);
  if (!Notif) return "unsupported";
  return Notif.permission || "default";
}

export async function requestNotificationPermission({ scope }: any = {}): Promise<string> {
  const Notif = resolveNotification(scope);
  if (!Notif) return "unsupported";
  if (Notif.permission === "granted" || Notif.permission === "denied") return Notif.permission;
  try {
    const result = await Notif.requestPermission();
    return result || "default";
  } catch {
    return "default";
  }
}

export function showBrowserNotification(title: any, options: any = {}, { scope }: any = {}): any {
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

export function shouldAlertBrowser(appNotification: any = {}, { scope, force = false }: any = {}): boolean {
  if (getNotificationPermission({ scope }) !== "granted") return false;
  if (force) return true;
  const doc = resolveDocument(scope);
  const hidden = doc ? doc.visibilityState === "hidden" || doc.hidden === true : false;
  if (!hidden) return false;
  const type = appNotification.type || "info";
  return ALERT_TYPES.has(type);
}

export function notifyForAppNotification(appNotification: any = {}, deps: any = {}): any {
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

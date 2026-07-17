import { useEffect, useState, useCallback, useRef } from "react";
import { useAuthSession } from "@/lib/auth-session";

export interface Notification {
  id: number;
  user_id: string;
  type: "ingest_complete" | "backup_result" | "share_event" | "restore_result";
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
  updated_at: string;
}

// Notification types that represent a long-running background task finishing
// (V1-725/B19). share_event is a social/collaboration event, not a task
// completion, so it is intentionally excluded.
const COMPLETION_NOTIFICATION_TYPES: ReadonlySet<Notification["type"]> = new Set([
  "ingest_complete",
  "backup_result",
  "restore_result",
]);

// Pure diff: which notifications in `next` are both new (not present in
// `previous` by id) and represent a completed background task. Exported for
// unit testing.
export function getNewCompletionNotifications(
  previous: Notification[],
  next: Notification[]
): Notification[] {
  const previousIds = new Set(previous.map((n) => n.id));
  return next.filter((n) => !previousIds.has(n.id) && COMPLETION_NOTIFICATION_TYPES.has(n.type));
}

// ponytail: module-level single-flash state — fine for one tab/one active
// flash at a time; a multi-tab-aware version isn't needed here.
let titleFlashTimer: ReturnType<typeof setInterval> | null = null;
let titleFlashStop: (() => void) | null = null;
const TITLE_FLASH_INTERVAL_MS = 1000;
const TITLE_FLASH_DURATION_MS = 6000;

function flashDocumentTitle(alertText: string): void {
  if (typeof document === "undefined" || document.hasFocus()) return;
  titleFlashStop?.(); // reset any flash already in progress

  const originalTitle = document.title;
  let showingAlert = false;

  titleFlashTimer = setInterval(() => {
    showingAlert = !showingAlert;
    document.title = showingAlert ? alertText : originalTitle;
  }, TITLE_FLASH_INTERVAL_MS);

  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") stop();
  };

  function stop() {
    if (titleFlashTimer) clearInterval(titleFlashTimer);
    titleFlashTimer = null;
    titleFlashStop = null;
    document.title = originalTitle;
    window.removeEventListener("focus", stop);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  }

  titleFlashStop = stop;
  setTimeout(stop, TITLE_FLASH_DURATION_MS);
  window.addEventListener("focus", stop);
  document.addEventListener("visibilitychange", onVisibilityChange);
}

// Opt-in gesture: request browser notification permission. Must be called
// from a user-initiated event handler (e.g. a settings toggle click), never
// automatically on mount. Uses globalThis.Notification to avoid colliding
// with the `Notification` interface declared above.
export async function requestTaskCompletionAlertPermission(): Promise<NotificationPermission | "unsupported"> {
  if (typeof window === "undefined" || typeof globalThis.Notification === "undefined") {
    return "unsupported";
  }
  return globalThis.Notification.requestPermission();
}

export function isTaskCompletionAlertPermissionGranted(): boolean {
  return typeof window !== "undefined" &&
    typeof globalThis.Notification !== "undefined" &&
    globalThis.Notification.permission === "granted";
}

function notifyTaskCompletion(notification: Notification): void {
  if (typeof window === "undefined") return;

  if (isTaskCompletionAlertPermissionGranted()) {
    new globalThis.Notification(notification.title, { body: notification.message });
  }

  // Flashing a focused tab's title is noise, not signal — only when hidden.
  if (!document.hasFocus()) {
    flashDocumentTitle(`🔔 ${notification.title}`);
  }
}

export interface NotificationsResponse {
  ok: boolean;
  notifications: Notification[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

export function notificationRequestHeaders(accessToken?: string): HeadersInit {
  return accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
}

export function useNotifications() {
  const { accessToken } = useAuthSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Tracks notifications across polls so we can diff for newly-arrived task
  // completions. Starts as `null` so the first load (existing history) never
  // fires alerts — only notifications that arrive after mount do.
  const previousNotificationsRef = useRef<Notification[] | null>(null);

  const fetchNotifications = useCallback(async (page = 1, limit = 20) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/v1/notifications?page=${page}&limit=${limit}`, {
        headers: notificationRequestHeaders(accessToken),
      });
      if (!response.ok) {
        throw new Error("تعذر تحميل الإشعارات.");
      }
      const data: NotificationsResponse = await response.json();

      if (!data.ok) {
        throw new Error("تعذر تحميل الإشعارات.");
      }

      if (previousNotificationsRef.current) {
        getNewCompletionNotifications(previousNotificationsRef.current, data.notifications)
          .forEach(notifyTaskCompletion);
      }
      previousNotificationsRef.current = data.notifications;

      setNotifications(data.notifications);
      setUnreadCount(data.notifications.filter((n) => !n.is_read).length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل الإشعارات.");
    } finally {
      setIsLoading(false);
    }
  }, [accessToken]);

  const markAsRead = useCallback(async (id: number) => {
    try {
      const response = await fetch(`/api/v1/notifications/${id}/read`, {
        method: "POST",
        headers: notificationRequestHeaders(accessToken),
      });
      const data = await response.json();

      if (!data.ok) {
        throw new Error("تعذر تعليم الإشعار كمقروء.");
      }

      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تعليم الإشعار كمقروء.");
    }
  }, [accessToken]);

  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch("/api/v1/notifications/mark-all-read", {
        method: "POST",
        headers: notificationRequestHeaders(accessToken),
      });
      const data = await response.json();

      if (!data.ok) {
        throw new Error("تعذر تعليم الإشعارات كمقروءة.");
      }

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تعليم الإشعارات كمقروءة.");
    }
  }, [accessToken]);

  const deleteNotification = useCallback(async (id: number) => {
    try {
      const response = await fetch(`/api/v1/notifications/${id}`, {
        method: "DELETE",
        headers: notificationRequestHeaders(accessToken),
      });
      const data = await response.json();

      if (!data.ok) {
        throw new Error("تعذر حذف الإشعار.");
      }

      setNotifications((prev) => {
        const wasUnread = prev.find((n) => n.id === id)?.is_read === false;
        if (wasUnread) {
          setUnreadCount((c) => Math.max(0, c - 1));
        }
        return prev.filter((n) => n.id !== id);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر حذف الإشعار.");
    }
  }, [accessToken]);

  useEffect(() => {
    fetchNotifications();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(() => {
      fetchNotifications();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchNotifications]);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  };
}

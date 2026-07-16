import { useEffect, useState, useCallback } from "react";
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

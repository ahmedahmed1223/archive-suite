"use client";

import { Bell, BellRing, X, Trash2 } from "lucide-react";
import {
  useNotifications,
  requestTaskCompletionAlertPermission,
  isTaskCompletionAlertPermissionGranted,
  type Notification,
} from "@/lib/use-notifications";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";

export function NotificationsBadge() {
  const { unreadCount, isLoading } = useNotifications();

  if (isLoading || unreadCount === 0) return null;

  return (
    <span className="notification-badge" aria-label={`${unreadCount} إشعارات جديدة`}>
      {unreadCount}
    </span>
  );
}

function NotificationItem({ notification, onRead, onDelete }: {
  notification: Notification;
  onRead: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  return (
    <div
      className="notification-item"
      data-read={notification.is_read}
    >
      <button
        type="button"
        className="notification-item__content"
        onClick={() => !notification.is_read && onRead(notification.id)}
      >
        <div className="notification-item__header">
          <h4 className="notification-item__title">{notification.title}</h4>
          {!notification.is_read && (
            <span className="notification-item__unread-indicator" aria-hidden="true">●</span>
          )}
        </div>
        <p className="notification-item__message">{notification.message}</p>
        <time className="notification-item__time">
          {new Date(notification.created_at).toLocaleString("ar-SA", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </time>
      </button>
      <button
        type="button"
        className="notification-item__delete"
        onClick={() => onDelete(notification.id)}
        aria-label="حذف الإشعار"
        title="حذف"
      >
        <Trash2 size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

export function NotificationsPanel() {
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [alertsGranted, setAlertsGranted] = useState(false);
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setAlertsGranted(isTaskCompletionAlertPermissionGranted());
  }, [isOpen]);

  const handleEnableAlerts = useCallback(async () => {
    await requestTaskCompletionAlertPermission();
    setAlertsGranted(isTaskCompletionAlertPermissionGranted());
  }, []);

  const closePanel = useCallback((returnFocus = true) => {
    setIsOpen(false);
    if (returnFocus) {
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        closePanel();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePanel();
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closePanel, isOpen]);

  return (
    <div className="notifications-panel-container">
      <button
        type="button"
        className="notifications-trigger icon-action"
        onClick={() => setIsOpen((current) => !current)}
        aria-label="فتح الإشعارات"
        aria-expanded={isOpen}
        aria-controls={panelId}
        title="الإشعارات"
        ref={triggerRef}
      >
        <Bell aria-hidden="true" size={18} strokeWidth={2} />
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div
          className="notifications-panel"
          id={panelId}
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          aria-labelledby={`${panelId}-title`}
        >
          <div className="notifications-panel__header">
            <h2 id={`${panelId}-title`}>الإشعارات</h2>
            <button
              type="button"
              onClick={() => closePanel()}
              aria-label="إغلاق"
            >
              <X size={20} />
            </button>
          </div>

          <div className="notifications-panel__toolbar">
            {!alertsGranted && (
              <button
                type="button"
                className="notifications-panel__mark-all-read notifications-panel__enable-alerts"
                onClick={handleEnableAlerts}
                style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}
              >
                <BellRing size={14} aria-hidden="true" />
                تفعيل تنبيهات المتصفح
              </button>
            )}
            {unreadCount > 0 && (
              <button
                type="button"
                className="notifications-panel__mark-all-read"
                onClick={markAllAsRead}
              >
                وضّح الكل كمقروء
              </button>
            )}
          </div>

          <div className="notifications-panel__list">
            {isLoading ? (
              <Skeleton className="notifications-panel__loading" label="جاري تحميل الإشعارات..." />
            ) : notifications.length === 0 ? (
              <div className="notifications-panel__empty">لا توجد إشعارات</div>
            ) : (
              notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onRead={markAsRead}
                  onDelete={deleteNotification}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

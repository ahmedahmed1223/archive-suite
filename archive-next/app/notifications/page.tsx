"use client";

import { useNotifications, type Notification } from "@/lib/use-notifications";
import { useState } from "react";
import { Trash2, CheckCircle2, Info, Package } from "lucide-react";
import Link from "next/link";
import { redactAdminSecrets } from "@/lib/admin-action-summary";
import { Skeleton } from "@/components/ui/Skeleton";

const typeIcons = {
  ingest_complete: Package,
  backup_result: CheckCircle2,
  share_event: Info,
  restore_result: CheckCircle2,
} as const;

const typeLabels = {
  ingest_complete: "الإدراج",
  backup_result: "النسخ الاحتياطي",
  share_event: "المشاركة",
  restore_result: "الاستعادة",
} as const;

function NotificationCard({ notification, onRead, onDelete }: {
  notification: Notification;
  onRead: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const Icon = typeIcons[notification.type];
  const label = typeLabels[notification.type];

  return (
    <article className="notification-card" data-read={notification.is_read}>
      <div className="notification-card__icon">
        <Icon size={24} aria-hidden="true" />
      </div>
      <div className="notification-card__content">
        <div className="notification-card__header">
          <div>
            <h3 className="notification-card__title">{notification.title}</h3>
            <span className="notification-card__type">{label}</span>
          </div>
          {!notification.is_read && (
            <button
              type="button"
              className="notification-card__mark-read"
              onClick={() => onRead(notification.id)}
              aria-label="وضّح كمقروء"
            >
              وضّح
            </button>
          )}
        </div>
        <p className="notification-card__message">{redactAdminSecrets(notification.message)}</p>
        <time className="notification-card__time">
          {new Date(notification.created_at).toLocaleString("ar-SA", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </time>
      </div>
      <button
        type="button"
        className="notification-card__delete"
        onClick={() => onDelete(notification.id)}
        aria-label="حذف"
      >
        <Trash2 size={18} aria-hidden="true" />
      </button>
    </article>
  );
}

export default function NotificationsPage() {
  const { notifications, unreadCount, isLoading, error, fetchNotifications, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const filteredNotifications = filter === "unread"
    ? notifications.filter((n) => !n.is_read)
    : notifications;

  return (
    <main className="notifications-page">
      <header className="notifications-page__header">
        <div>
          <h1>الإشعارات</h1>
          {unreadCount > 0 && (
            <p className="notifications-page__subtitle">
              لديك {unreadCount} إشعارات جديدة
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            className="notifications-page__mark-all-read"
            onClick={markAllAsRead}
          >
            وضّح الكل كمقروء
          </button>
        )}
      </header>

      <div className="notifications-page__filters">
        <button
          type="button"
          className="filter-button"
          data-active={filter === "all"}
          onClick={() => setFilter("all")}
        >
          جميع الإشعارات
        </button>
        <button
          type="button"
          className="filter-button"
          data-active={filter === "unread"}
          onClick={() => setFilter("unread")}
        >
          غير مقروءة ({unreadCount})
        </button>
      </div>

      <div className="notifications-page__content">
        {error ? (
          <div className="state-banner state-banner-error" role="alert">
            <strong>تعذر إكمال طلب الإشعارات</strong>
            <span className="helper-text">{redactAdminSecrets(error)} — تحقق من الاتصال ثم أعد المحاولة.</span>
            <div><button className="button button-secondary button-sm" type="button" onClick={() => void fetchNotifications()}>إعادة المحاولة</button></div>
          </div>
        ) : null}

        {isLoading && notifications.length === 0 ? (
          <Skeleton className="notifications-page__loading" label="جاري تحميل الإشعارات..." />
        ) : !isLoading && !error && filteredNotifications.length === 0 ? (
          <div className="notifications-page__empty">
            <Info size={48} aria-hidden="true" />
            <p>
              {filter === "unread" ? "لا توجد إشعارات جديدة" : "لا توجد إشعارات"}
            </p>
            <Link href="/archive" className="button button--primary">
              العودة إلى الأرشيف
            </Link>
          </div>
        ) : (
          <div className="notifications-page__list">
            {filteredNotifications.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                onRead={markAsRead}
                onDelete={deleteNotification}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

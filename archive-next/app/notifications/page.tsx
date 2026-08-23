"use client";

import { useNotifications, type Notification } from "@/lib/use-notifications";
import { useState } from "react";
import { Trash2, CheckCircle2, Info, Package, AtSign } from "lucide-react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import PageToolbar from "@/components/PageToolbar";
import { redactAdminSecrets } from "@/lib/admin-action-summary";
import { Skeleton } from "@/components/ui/Skeleton";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useLocale } from "@/lib/i18n/LocaleProvider";

const typeIcons = {
  ingest_complete: Package,
  backup_result: CheckCircle2,
  share_event: Info,
  restore_result: CheckCircle2,
  mention: AtSign,
} as const;

function NotificationCard({ notification, onRead, onDelete, locale, copy }: {
  notification: Notification;
  onRead: (id: number) => void;
  onDelete: (id: number) => void;
  locale: "ar" | "en";
  copy: ReturnType<typeof useLocale>["t"]["pages"]["notifications"];
}) {
  const Icon = typeIcons[notification.type];
  const label = copy.types[notification.type];

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
              aria-label={copy.markRead}
            >
              {copy.markRead}
            </button>
          )}
        </div>
        <p className="notification-card__message">{redactAdminSecrets(notification.message)}</p>
        <time className="notification-card__time">
          {new Date(notification.created_at).toLocaleString(locale === "en" ? "en-US" : "ar-SA", {
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
        aria-label={copy.delete}
      >
        <Trash2 size={18} aria-hidden="true" />
      </button>
    </article>
  );
}

export default function NotificationsPage() {
  const { locale, t } = useLocale();
  const copy = t.pages.notifications;
  const { notifications, unreadCount, isLoading, error, fetchNotifications, markAsRead, markAllAsRead, deleteNotification } = useNotifications(locale);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const dialog = useConfirmDialog();

  const filteredNotifications = filter === "unread"
    ? notifications.filter((n) => !n.is_read)
    : notifications;

  // V14-AUDIT-029: deleting a notification is irreversible — confirm first.
  const confirmDelete = async (id: number) => {
    const confirmed = await dialog.confirm({
      title: copy.deleteConfirmTitle,
      message: copy.deleteConfirmMessage,
      confirmLabel: copy.deleteConfirmLabel,
      destructive: true,
    });
    if (!confirmed) return;
    await deleteNotification(id);
  };

  return (
    <AppShell subtitle={t.pageTitles.notifications} contentClassName="notifications-page">
      <PageToolbar
        title={copy.title}
        description={unreadCount > 0 ? copy.unreadCount.replace("{count}", String(unreadCount)) : undefined}
        actions={unreadCount > 0 ? (
          <button
            type="button"
            className="button button-primary"
            onClick={markAllAsRead}
          >
            {copy.allRead}
          </button>
        ) : undefined}
      />

      <div className="notifications-page__filters">
        <button
          type="button"
          className="filter-button"
          data-active={filter === "all"}
          onClick={() => setFilter("all")}
        >
          {copy.all}
        </button>
        <button
          type="button"
          className="filter-button"
          data-active={filter === "unread"}
          onClick={() => setFilter("unread")}
        >
          {copy.unreadOnly} ({unreadCount})
        </button>
      </div>

      <div className="notifications-page__content">
        {error ? (
          <div className="state-banner state-banner-error" role="alert">
            <strong>{copy.error}</strong>
            <span className="helper-text">{redactAdminSecrets(error)} — {copy.errorHelp}</span>
            <div><button className="button button-secondary button-sm" type="button" onClick={() => void fetchNotifications()}>{copy.retry}</button></div>
          </div>
        ) : null}

        {isLoading && notifications.length === 0 ? (
          <Skeleton className="notifications-page__loading" label={copy.loading} />
        ) : !isLoading && !error && filteredNotifications.length === 0 ? (
          <div className="notifications-page__empty">
            <Info size={48} aria-hidden="true" />
            <p>
              {filter === "unread" ? copy.noUnread : copy.empty}
            </p>
            <Link href="/archive" className="button button-primary">
              {copy.back}
            </Link>
          </div>
        ) : (
          <div className="notifications-page__list">
            {filteredNotifications.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                onRead={markAsRead}
                onDelete={(id) => void confirmDelete(id)}
                locale={locale}
                copy={copy}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

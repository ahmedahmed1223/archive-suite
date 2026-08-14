"use client";

import { ArrowDown, ArrowUp, Bell, Clock3, Hourglass, Inbox as InboxIcon, ListChecks, ListOrdered, ShoppingBasket, Star } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import EmptyState from "@/components/EmptyState";
import { useAuthSession } from "@/lib/auth-session";
import { createArchiveApiClient, type InboxItem } from "@/lib/archive-api";
import { useNotifications } from "@/lib/use-notifications";
import { listFavorites, type Favorite } from "@/lib/favorites";
import { clearRecent, listRecent, type RecentItem } from "@/lib/recent-items";
import { listDueLater, removeLater, type LaterEntry } from "@/lib/later-list";
import { clearBasket, listBasket, removeFromBasket, type WorkBasketEntry } from "@/lib/work-basket";
import { clearQueue, listQueue, moveInQueue, removeFromQueue, type QueueEntry } from "@/lib/personal-queue";
import { clearRecentSearches } from "@/lib/recent-searches";
import { isContextRecordingEnabled, setContextRecording } from "@/lib/personal-context";
import { formatDate } from "@/lib/record-utils";
import { getWorkLists, RIGHTS_WARNING_WINDOW_DAYS } from "@/lib/work-lists";
import { Skeleton } from "@/components/ui/Skeleton";

const PANEL_ITEM_LIMIT = 6;

const todayLabel = (locale: "ar" | "en") =>
  new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(new Date());

export default function DailyPage() {
  const { locale, t } = useLocale();
  const copy = t.pages.daily;
  const api = useMemo(() => createArchiveApiClient(), []);
  const auth = useAuthSession();
  const { notifications, isLoading: notificationsLoading } = useNotifications(locale);
  const workLists = useMemo(() => getWorkLists(locale), [locale]);
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const [inboxLoading, setInboxLoading] = useState(true);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [dueLater, setDueLater] = useState<LaterEntry[]>([]);
  const [basket, setBasket] = useState<WorkBasketEntry[]>([]);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [recording, setRecording] = useState(true);
  const [contextStatus, setContextStatus] = useState("");
  // The records endpoint is cursor-paginated without a total, so archive-wide
  // work-list counts remain on /archive; this is only the expiring-rights count.
  const [expiringRightsCount, setExpiringRightsCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadInbox() {
      const response = await api.inboxItems();
      if (!cancelled && response.ok) setInboxItems(response.items);
      if (!cancelled) setInboxLoading(false);
    }
    void loadInbox();
    return () => {
      cancelled = true;
    };
  }, [api]);

  useEffect(() => {
    let cancelled = false;
    async function loadExpiringRights() {
      const response = await api.expiringRights({ days: RIGHTS_WARNING_WINDOW_DAYS });
      if (!cancelled && response.ok) setExpiringRightsCount(response.records.length);
    }
    void loadExpiringRights();
    return () => {
      cancelled = true;
    };
  }, [api]);

  useEffect(() => {
    setFavorites(listFavorites());
    setRecent(listRecent());
    setDueLater(listDueLater());
    setBasket(listBasket());
    setQueue(listQueue());
    setRecording(isContextRecordingEnabled());
  }, []);

  function handleRemoveLater(id: string) {
    removeLater(id);
    setDueLater(listDueLater());
  }

  function handleRemoveBasketItem(id: string) {
    removeFromBasket(id);
    setBasket(listBasket());
  }

  function handleClearBasket() {
    clearBasket();
    setBasket([]);
  }

  function handleRemoveQueueItem(id: string) {
    removeFromQueue(id);
    setQueue(listQueue());
  }

  function handleMoveQueueItem(id: string, direction: -1 | 1) {
    moveInQueue(id, direction);
    setQueue(listQueue());
  }

  function handleClearQueue() {
    clearQueue();
    setQueue([]);
  }

  function handleRecordingChange(enabled: boolean) {
    setContextRecording(enabled);
    setRecording(enabled);
    setContextStatus(enabled ? copy.contextRecordingEnabled : copy.contextRecordingDisabled);
  }

  function handleClearRecent() {
    clearRecent();
    setRecent([]);
    setContextStatus(copy.recentCleared);
  }

  function handleClearSearches() {
    clearRecentSearches();
    setContextStatus(copy.searchesCleared);
  }

  const pendingInbox = useMemo(
    () => inboxItems.filter((item) => item.status === "new" || item.status === "triage"),
    [inboxItems]
  );
  const unreadNotifications = useMemo(() => notifications.filter((notification) => !notification.is_read), [notifications]);

  const displayName = auth.user?.name || auth.user?.email || "";

  return (
    <AppShell subtitle={t.pageTitles.daily}>
      <header className="dashboard-greeting">
        <div className="dashboard-greeting__intro">
          <h1>{displayName ? copy.greetingName.replace("{name}", displayName) : copy.greeting}</h1>
          <p>{todayLabel(locale)}</p>
        </div>
      </header>

      <div className="record-grid">
        <section className="panel" aria-label={copy.workListsAriaLabel}>
          <header className="dashboard-recent__header">
            <h2>
              <ListChecks aria-hidden="true" size={18} strokeWidth={2} />
              <span>{copy.workListsAriaLabel}</span>
            </h2>
          </header>
          <ul className="dashboard-recent__list">
            {workLists.map((workList) => {
              const workListCopy = workList.id === "incomplete"
                ? copy.workLists.incomplete
                : workList.id === "drafts"
                  ? copy.workLists.drafts
                  : workList.id === "awaiting-review"
                    ? copy.workLists.awaitingReview
                    : copy.workLists.expiringRights;
              return (
              <li key={workList.id}>
                <Link className="dashboard-recent__item" href={workList.href}>
                  <span className="dashboard-recent__title">
                    {workListCopy.label}
                    {workList.id === "expiring-rights" && expiringRightsCount !== null ? (
                      <span className="badge">{expiringRightsCount}</span>
                    ) : null}
                  </span>
                  <span className="dashboard-recent__meta">{workList.id === "expiring-rights" ? workListCopy.description.replace("{days}", String(RIGHTS_WARNING_WINDOW_DAYS)) : workListCopy.description}</span>
                </Link>
              </li>
              );
            })}
          </ul>
        </section>

        <section className="panel" aria-label={copy.needsAttentionAriaLabel}>
          <header className="dashboard-recent__header">
            <h2>
              <InboxIcon aria-hidden="true" size={18} strokeWidth={2} />
              <span>{copy.needsAttention}</span>
            </h2>
            <Link className="dashboard-recent__all" href="/inbox">{copy.openInbox}</Link>
          </header>
          {inboxLoading ? (
            <Skeleton label={copy.loadingInbox} />
          ) : pendingInbox.length === 0 ? (
            <EmptyState icon={<InboxIcon aria-hidden="true" />} title={copy.inboxEmptyTitle} description={copy.inboxEmptyDescription} />
          ) : (
            <ul className="dashboard-recent__list">
              {pendingInbox.slice(0, PANEL_ITEM_LIMIT).map((item) => (
                <li key={item.id}>
                  <Link className="dashboard-recent__item" href="/inbox">
                    <span className="dashboard-recent__title">{item.title}</span>
                    {item.createdAt ? <span className="dashboard-recent__meta">{formatDate(item.createdAt, "-", locale)}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel" aria-label={copy.unreadNotificationsAriaLabel}>
          <header className="dashboard-recent__header">
            <h2>
              <Bell aria-hidden="true" size={18} strokeWidth={2} />
              <span>{copy.unreadNotifications}</span>
            </h2>
            <Link className="dashboard-recent__all" href="/notifications">{copy.viewAll}</Link>
          </header>
          {notificationsLoading ? (
            <Skeleton label={copy.loadingNotifications} />
          ) : unreadNotifications.length === 0 ? (
            <EmptyState icon={<Bell aria-hidden="true" />} title={copy.notificationsEmptyTitle} description={copy.notificationsEmptyDescription} />
          ) : (
            <ul className="dashboard-recent__list">
              {unreadNotifications.slice(0, PANEL_ITEM_LIMIT).map((notification) => (
                <li key={notification.id}>
                  <Link className="dashboard-recent__item" href="/notifications">
                    <span className="dashboard-recent__title">{notification.title}</span>
                    <span className="dashboard-recent__meta">{formatDate(notification.created_at, "-", locale)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel" aria-label={copy.favoritesAriaLabel}>
          <header className="dashboard-recent__header">
            <h2>
              <Star aria-hidden="true" size={18} strokeWidth={2} />
              <span>{copy.favorites}</span>
            </h2>
            <Link className="dashboard-recent__all" href="/favorites">{copy.viewAll}</Link>
          </header>
          {favorites.length === 0 ? (
            <EmptyState icon={<Star aria-hidden="true" />} title={copy.favoritesEmptyTitle} description={copy.favoritesEmptyDescription} />
          ) : (
            <ul className="dashboard-recent__list">
              {favorites.slice(0, PANEL_ITEM_LIMIT).map((favorite) => (
                <li key={favorite.id}>
                  <Link className="dashboard-recent__item" href={`/archive/${encodeURIComponent(favorite.id)}`}>
                    <span className="dashboard-recent__title">{favorite.title || favorite.id}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel" aria-label={copy.laterAriaLabel}>
          <header className="dashboard-recent__header">
            <h2>
              <Hourglass aria-hidden="true" size={18} strokeWidth={2} />
              <span>{copy.later}</span>
            </h2>
          </header>
          {dueLater.length === 0 ? (
            <EmptyState icon={<Hourglass aria-hidden="true" />} title={copy.laterEmptyTitle} description={copy.laterEmptyDescription} />
          ) : (
            <ul className="dashboard-recent__list">
              {dueLater.slice(0, PANEL_ITEM_LIMIT).map((entry) => (
                <li key={entry.id}>
                  <Link className="dashboard-recent__item" href={`/archive/${encodeURIComponent(entry.id)}`}>
                    <span className="dashboard-recent__title">{entry.title || entry.id}</span>
                    <span className="dashboard-recent__meta">{entry.reason}</span>
                  </Link>
                  <button type="button" className="button button-secondary button-sm" onClick={() => handleRemoveLater(entry.id)}>
                    {copy.remove}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel" aria-label={copy.basketAriaLabel}>
          <header className="dashboard-recent__header">
            <h2>
              <ShoppingBasket aria-hidden="true" size={18} strokeWidth={2} />
              <span>{copy.basket}</span>
            </h2>
            {basket.length > 0 ? (
              <button type="button" className="button button-secondary button-sm" onClick={handleClearBasket}>
                {copy.clearBasket}
              </button>
            ) : null}
          </header>
          {basket.length === 0 ? (
            <EmptyState icon={<ShoppingBasket aria-hidden="true" />} title={copy.basketEmptyTitle} description={copy.basketEmptyDescription} />
          ) : (
            <ul className="dashboard-recent__list">
              {basket.slice(0, PANEL_ITEM_LIMIT).map((entry) => (
                <li key={entry.id}>
                  <Link className="dashboard-recent__item" href={`/archive/${encodeURIComponent(entry.id)}`}>
                    <span className="dashboard-recent__title">{entry.title || entry.id}</span>
                  </Link>
                  <button type="button" className="button button-secondary button-sm" onClick={() => handleRemoveBasketItem(entry.id)}>
                    {copy.remove}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel" aria-label={copy.queueAriaLabel}>
          <header className="dashboard-recent__header">
            <h2>
              <ListOrdered aria-hidden="true" size={18} strokeWidth={2} />
              <span>{copy.queue}</span>
            </h2>
            {queue.length > 0 ? (
              <button type="button" className="button button-secondary button-sm" onClick={handleClearQueue}>
                {copy.clearQueue}
              </button>
            ) : null}
          </header>
          {queue.length === 0 ? (
            <EmptyState icon={<ListOrdered aria-hidden="true" />} title={copy.queueEmptyTitle} description={copy.queueEmptyDescription} />
          ) : (
            <ul className="dashboard-recent__list">
              {queue.map((entry, index) => (
                <li key={entry.id}>
                  <Link className="dashboard-recent__item" href={`/archive/${encodeURIComponent(entry.id)}`}>
                    <span className="dashboard-recent__title">{entry.title || entry.id}</span>
                  </Link>
                  <button
                    type="button"
                    className="button button-secondary button-sm"
                    onClick={() => handleMoveQueueItem(entry.id, -1)}
                    disabled={index === 0}
                    title={copy.moveUp}
                  >
                    <ArrowUp aria-hidden="true" size={14} />
                  </button>
                  <button
                    type="button"
                    className="button button-secondary button-sm"
                    onClick={() => handleMoveQueueItem(entry.id, 1)}
                    disabled={index === queue.length - 1}
                    title={copy.moveDown}
                  >
                    <ArrowDown aria-hidden="true" size={14} />
                  </button>
                  <button type="button" className="button button-secondary button-sm" onClick={() => handleRemoveQueueItem(entry.id)}>
                    {copy.remove}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel" aria-label={copy.recentAriaLabel}>
          <header className="dashboard-recent__header">
            <h2>
              <Clock3 aria-hidden="true" size={18} strokeWidth={2} />
              <span>{copy.recent}</span>
            </h2>
            {recent.length > 0 ? (
              <button type="button" className="button button-secondary button-sm" onClick={handleClearRecent}>
                {copy.clearRecent}
              </button>
            ) : null}
          </header>
          {recent.length === 0 ? (
            <EmptyState icon={<Clock3 aria-hidden="true" />} title={copy.recentEmptyTitle} description={copy.recentEmptyDescription} />
          ) : (
            <ul className="dashboard-recent__list">
              {recent.slice(0, PANEL_ITEM_LIMIT).map((item) => (
                <li key={item.id}>
                  <Link className="dashboard-recent__item" href={`/archive/${encodeURIComponent(item.id)}`}>
                    <span className="dashboard-recent__title">{item.title || item.id}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <div className="stack section-divider">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={recording}
                onChange={(event) => handleRecordingChange(event.target.checked)}
              />
              <span>{copy.contextRecordingLabel}</span>
            </label>
            <p className="helper-text">
              {copy.contextRecordingDescription}
            </p>
            <div className="button-row">
              <button type="button" className="button button-secondary button-sm" onClick={handleClearSearches}>
                {copy.clearRecentSearches}
              </button>
            </div>
            <p className="form-status" role="status">
              {contextStatus}
            </p>
          </div>
        </section>
      </div>
    </AppShell>
  );
}

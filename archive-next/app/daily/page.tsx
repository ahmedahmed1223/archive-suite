"use client";

import { Bell, Clock3, Inbox as InboxIcon, Star } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import { useAuthSession } from "@/lib/auth-session";
import { createArchiveApiClient, type InboxItem } from "@/lib/archive-api";
import { useNotifications } from "@/lib/use-notifications";
import { listFavorites, type Favorite } from "@/lib/favorites";
import { listRecent, type RecentItem } from "@/lib/recent-items";
import { formatDate } from "@/lib/record-utils";
import { Skeleton } from "@/components/ui/Skeleton";

const PANEL_ITEM_LIMIT = 6;

const todayLabel = () =>
  new Intl.DateTimeFormat("ar", { weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(new Date());

export default function DailyPage() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const auth = useAuthSession();
  const { notifications, isLoading: notificationsLoading } = useNotifications();
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const [inboxLoading, setInboxLoading] = useState(true);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [recent, setRecent] = useState<RecentItem[]>([]);

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
    setFavorites(listFavorites());
    setRecent(listRecent());
  }, []);

  const pendingInbox = useMemo(
    () => inboxItems.filter((item) => item.status === "new" || item.status === "triage"),
    [inboxItems]
  );
  const unreadNotifications = useMemo(() => notifications.filter((notification) => !notification.is_read), [notifications]);

  const displayName = auth.user?.name || auth.user?.email || "";

  return (
    <AppShell subtitle="يومي">
      <header className="dashboard-greeting">
        <div className="dashboard-greeting__intro">
          <h1>{displayName ? `يومك، ${displayName}` : "يومك"}</h1>
          <p>{todayLabel()}</p>
        </div>
      </header>

      <div className="record-grid">
        <section className="panel" aria-label="بحاجة لانتباه">
          <header className="dashboard-recent__header">
            <h2>
              <InboxIcon aria-hidden="true" size={18} strokeWidth={2} />
              <span>بحاجة لانتباه</span>
            </h2>
            <Link className="dashboard-recent__all" href="/inbox">فتح الوارد</Link>
          </header>
          {inboxLoading ? (
            <Skeleton label="جار تحميل الوارد..." />
          ) : pendingInbox.length === 0 ? (
            <EmptyState icon={<InboxIcon aria-hidden="true" />} title="لا شيء بانتظارك" description="الوارد فارغ من العناصر غير المفروزة." />
          ) : (
            <ul className="dashboard-recent__list">
              {pendingInbox.slice(0, PANEL_ITEM_LIMIT).map((item) => (
                <li key={item.id}>
                  <Link className="dashboard-recent__item" href="/inbox">
                    <span className="dashboard-recent__title">{item.title}</span>
                    {item.createdAt ? <span className="dashboard-recent__meta">{formatDate(item.createdAt)}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel" aria-label="إشعارات غير مقروءة">
          <header className="dashboard-recent__header">
            <h2>
              <Bell aria-hidden="true" size={18} strokeWidth={2} />
              <span>إشعارات غير مقروءة</span>
            </h2>
            <Link className="dashboard-recent__all" href="/notifications">عرض الكل</Link>
          </header>
          {notificationsLoading ? (
            <Skeleton label="جار تحميل الإشعارات..." />
          ) : unreadNotifications.length === 0 ? (
            <EmptyState icon={<Bell aria-hidden="true" />} title="لا إشعارات جديدة" description="كل شيء مقروء." />
          ) : (
            <ul className="dashboard-recent__list">
              {unreadNotifications.slice(0, PANEL_ITEM_LIMIT).map((notification) => (
                <li key={notification.id}>
                  <Link className="dashboard-recent__item" href="/notifications">
                    <span className="dashboard-recent__title">{notification.title}</span>
                    <span className="dashboard-recent__meta">{formatDate(notification.created_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel" aria-label="المفضلة">
          <header className="dashboard-recent__header">
            <h2>
              <Star aria-hidden="true" size={18} strokeWidth={2} />
              <span>المفضلة</span>
            </h2>
            <Link className="dashboard-recent__all" href="/favorites">عرض الكل</Link>
          </header>
          {favorites.length === 0 ? (
            <EmptyState icon={<Star aria-hidden="true" />} title="لا مفضلات بعد" description="ثبّت السجلات المهمة للوصول السريع." />
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

        <section className="panel" aria-label="آخر ما شاهدت">
          <header className="dashboard-recent__header">
            <h2>
              <Clock3 aria-hidden="true" size={18} strokeWidth={2} />
              <span>آخر ما شاهدت</span>
            </h2>
          </header>
          {recent.length === 0 ? (
            <EmptyState icon={<Clock3 aria-hidden="true" />} title="لم تشاهد شيئاً بعد" description="ستظهر هنا آخر السجلات التي فتحتها." />
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
        </section>
      </div>
    </AppShell>
  );
}

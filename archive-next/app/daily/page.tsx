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
import { RIGHTS_WARNING_WINDOW_DAYS, WORK_LISTS } from "@/lib/work-lists";
import { Skeleton } from "@/components/ui/Skeleton";

const PANEL_ITEM_LIMIT = 6;

const todayLabel = () =>
  new Intl.DateTimeFormat("ar", { weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(new Date());

export default function DailyPage() {
  const { t } = useLocale();
  const api = useMemo(() => createArchiveApiClient(), []);
  const auth = useAuthSession();
  const { notifications, isLoading: notificationsLoading } = useNotifications();
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const [inboxLoading, setInboxLoading] = useState(true);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [dueLater, setDueLater] = useState<LaterEntry[]>([]);
  const [basket, setBasket] = useState<WorkBasketEntry[]>([]);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [recording, setRecording] = useState(true);
  const [contextStatus, setContextStatus] = useState("");
  // ponytail: عدّاد الحقوق فقط — نقطة `records` مقسّمة بمؤشر بلا إجمالي،
  // فعدّ قوائم الأرشيف يتطلب المرور على كل الصفحات؛ تُعرض الأعداد في /archive نفسها.
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
    setContextStatus(enabled ? "سيُسجَّل السياق الشخصي على هذا المتصفح." : "توقّف تسجيل السياق الشخصي على هذا المتصفح.");
  }

  function handleClearRecent() {
    clearRecent();
    setRecent([]);
    setContextStatus("مُسح سجل آخر ما شاهدت.");
  }

  function handleClearSearches() {
    clearRecentSearches();
    setContextStatus("مُسحت عمليات البحث الأخيرة.");
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
          <h1>{displayName ? `يومك، ${displayName}` : "يومك"}</h1>
          <p>{todayLabel()}</p>
        </div>
      </header>

      <div className="record-grid">
        <section className="panel" aria-label="قوائم العمل">
          <header className="dashboard-recent__header">
            <h2>
              <ListChecks aria-hidden="true" size={18} strokeWidth={2} />
              <span>قوائم العمل</span>
            </h2>
          </header>
          <ul className="dashboard-recent__list">
            {WORK_LISTS.map((workList) => (
              <li key={workList.id}>
                <Link className="dashboard-recent__item" href={workList.href}>
                  <span className="dashboard-recent__title">
                    {workList.label}
                    {workList.id === "expiring-rights" && expiringRightsCount !== null ? (
                      <span className="badge">{expiringRightsCount}</span>
                    ) : null}
                  </span>
                  <span className="dashboard-recent__meta">{workList.description}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

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

        <section className="panel" aria-label="لاحقًا">
          <header className="dashboard-recent__header">
            <h2>
              <Hourglass aria-hidden="true" size={18} strokeWidth={2} />
              <span>لاحقًا</span>
            </h2>
          </header>
          {dueLater.length === 0 ? (
            <EmptyState icon={<Hourglass aria-hidden="true" />} title="لا مواد مؤجَّلة مستحقة" description="المواد المؤجَّلة تظهر هنا عند بلوغ موعد مراجعتها." />
          ) : (
            <ul className="dashboard-recent__list">
              {dueLater.slice(0, PANEL_ITEM_LIMIT).map((entry) => (
                <li key={entry.id}>
                  <Link className="dashboard-recent__item" href={`/archive/${encodeURIComponent(entry.id)}`}>
                    <span className="dashboard-recent__title">{entry.title || entry.id}</span>
                    <span className="dashboard-recent__meta">{entry.reason}</span>
                  </Link>
                  <button type="button" className="button button-secondary button-sm" onClick={() => handleRemoveLater(entry.id)}>
                    إزالة
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel" aria-label="سلة العمل">
          <header className="dashboard-recent__header">
            <h2>
              <ShoppingBasket aria-hidden="true" size={18} strokeWidth={2} />
              <span>سلة العمل</span>
            </h2>
            {basket.length > 0 ? (
              <button type="button" className="button button-secondary button-sm" onClick={handleClearBasket}>
                تفريغ السلة
              </button>
            ) : null}
          </header>
          {basket.length === 0 ? (
            <EmptyState icon={<ShoppingBasket aria-hidden="true" />} title="السلة فارغة" description="أضف سجلات من صفحة المادة لجمعها هنا قبل مراجعتها لاحقًا." />
          ) : (
            <ul className="dashboard-recent__list">
              {basket.slice(0, PANEL_ITEM_LIMIT).map((entry) => (
                <li key={entry.id}>
                  <Link className="dashboard-recent__item" href={`/archive/${encodeURIComponent(entry.id)}`}>
                    <span className="dashboard-recent__title">{entry.title || entry.id}</span>
                  </Link>
                  <button type="button" className="button button-secondary button-sm" onClick={() => handleRemoveBasketItem(entry.id)}>
                    إزالة
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel" aria-label="طابور التجهيز الشخصي">
          <header className="dashboard-recent__header">
            <h2>
              <ListOrdered aria-hidden="true" size={18} strokeWidth={2} />
              <span>طابور التجهيز الشخصي</span>
            </h2>
            {queue.length > 0 ? (
              <button type="button" className="button button-secondary button-sm" onClick={handleClearQueue}>
                تفريغ الطابور
              </button>
            ) : null}
          </header>
          {queue.length === 0 ? (
            <EmptyState icon={<ListOrdered aria-hidden="true" />} title="الطابور فارغ" description="رتّب السجلات التي تنوي معالجتها لاحقًا بترتيبك الشخصي." />
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
                    title="تحريك للأعلى"
                  >
                    <ArrowUp aria-hidden="true" size={14} />
                  </button>
                  <button
                    type="button"
                    className="button button-secondary button-sm"
                    onClick={() => handleMoveQueueItem(entry.id, 1)}
                    disabled={index === queue.length - 1}
                    title="تحريك للأسفل"
                  >
                    <ArrowDown aria-hidden="true" size={14} />
                  </button>
                  <button type="button" className="button button-secondary button-sm" onClick={() => handleRemoveQueueItem(entry.id)}>
                    إزالة
                  </button>
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
            {recent.length > 0 ? (
              <button type="button" className="button button-secondary button-sm" onClick={handleClearRecent}>
                مسح السجل
              </button>
            ) : null}
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
          <div className="stack section-divider">
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={recording}
                onChange={(event) => handleRecordingChange(event.target.checked)}
              />
              <span>تسجيل السياق الشخصي (آخر ما شاهدت وعمليات البحث الأخيرة)</span>
            </label>
            <p className="helper-text">
              يُحفظ هذا السياق في هذا المتصفح وحده ولا يُشارك مع بقية المستخدمين.
            </p>
            <div className="button-row">
              <button type="button" className="button button-secondary button-sm" onClick={handleClearSearches}>
                مسح عمليات البحث الأخيرة
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

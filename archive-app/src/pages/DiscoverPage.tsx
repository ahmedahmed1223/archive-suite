import {
  Activity,
  ArchiveRestore,
  Clock3,
  Compass,
  Eye,
  Shuffle,
  Sparkles,
  TrendingUp
} from "lucide-react";
import * as React from "react";

import { StatusBadge as ArchiveStatusBadge } from "../components/archive/StatusBadge.jsx";
import { MotionPage, UXStateBlock } from "../components/ui/index.js";
import { buildDiscoverySections, getDiscoveryStats } from "../features/discover/discoveryEngine.js";
import { useAppStore } from "../stores/index.js";
import { formatDateTime, formatNumber } from "../utils/formatting.js";

const SECTION_ICONS = {
  explore: Sparkles,
  trending: TrendingUp,
  random: Shuffle,
  active: Activity,
  forgotten: ArchiveRestore
};

const TONE_BADGES = {
  primary: "badge-primary",
  secondary: "badge-secondary",
  accent: "badge-accent",
  info: "badge-info",
  warning: "badge-warning"
};

function getItemKindLabel(item: any) {
  return item.subtype || item.type || item.mediaType || "مادة";
}

function getItemDateLabel(item: any, numberSystem: any) {
  const value = item.lastViewedAt || item.updatedAt || item.createdAt;
  return value ? formatDateTime(value, numberSystem) : "بدون تاريخ";
}

function DiscoveryCard({ item, numberSystem, onOpen }: any) {
  return (
    <article className="card card-border bg-base-100 text-base-content shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="card-body gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="card-title line-clamp-2 text-base leading-7">
              {item.title || item.name || "مادة بلا عنوان"}
            </h3>
            <p className="mt-1 line-clamp-2 text-sm text-base-content/70">
              {item.notes || item.description || item.path || "لا توجد ملاحظات مختصرة لهذه المادة بعد."}
            </p>
          </div>
          <ArchiveStatusBadge item={item} compact />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="badge badge-soft badge-sm">{getItemKindLabel(item)}</span>
          <span className="badge badge-outline badge-sm">{item.discoveryReason}</span>
          {item.isFavorite ? <span className="badge badge-warning badge-sm">مفضلة</span> : null}
        </div>

        <div className="grid gap-2 text-xs text-base-content/70 sm:grid-cols-2">
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
            {getItemDateLabel(item, numberSystem)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" aria-hidden="true" />
            {formatNumber(item.discovery?.weeklyActivity || 0, numberSystem)} نشاط أسبوعي
          </span>
        </div>

        <div className="card-actions justify-end">
          <button type="button" className="btn btn-sm btn-outline" onClick={() => onOpen(item)}>
            <Eye className="h-4 w-4" aria-hidden="true" />
            فتح
          </button>
        </div>
      </div>
    </article>
  );
}

export default function DiscoverPage() {
  const {
    auditLogs = [],
    markItemViewed,
    setCurrentPage,
    setSelectedItemId,
    settings = {},
    videoItems = []
  } = useAppStore();
  const numberSystem = settings.numberSystem || "latn";

  const sections = React.useMemo(() => buildDiscoverySections({
    videoItems,
    auditLogs,
    now: new Date(),
    limit: 8,
    seed: "archive-discover"
  }), [auditLogs, videoItems]);
  const stats = React.useMemo(() => getDiscoveryStats({ videoItems, sections }), [sections, videoItems]);
  const [activeSectionId, setActiveSectionId] = React.useState("explore");
  const activeSection = sections.find((section: any) => section.id === activeSectionId) || sections[0];
  const ActiveIcon = (SECTION_ICONS as any)[activeSection?.id] || Compass;

  const openItem = React.useCallback((item: any) => {
    if (!item?.id) return;
    setSelectedItemId?.(item.id);
    markItemViewed?.(item.id);
    setCurrentPage?.("detail");
  }, [markItemViewed, setCurrentPage, setSelectedItemId]);

  return (
    <MotionPage className="space-y-5 p-4 sm:p-6">
      <section className="hero overflow-hidden rounded-2xl border border-base-300 bg-base-200 text-base-content">
        <div className="hero-content w-full flex-col items-stretch gap-5 p-5 text-right lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-base-100 px-3 py-1 text-xs text-base-content/70">
              <Compass className="h-4 w-4" aria-hidden="true" />
              رحلة اكتشاف المحتوى
            </div>
            <h1 className="text-2xl font-bold leading-10 sm:text-3xl">الاكتشاف</h1>
            <p className="mt-2 text-sm leading-7 text-base-content/70 sm:text-base">
              مسارات سريعة لإحياء المواد التي لم تصل إليها بالبحث: حديث، رائج، عشوائي، نشط، ومنسي.
            </p>
          </div>

          <div className="stats stats-vertical w-full bg-base-100 shadow-sm sm:stats-horizontal lg:w-auto">
            <div className="stat min-w-32">
              <div className="stat-title">مواد نشطة</div>
              <div className="stat-value text-xl">{formatNumber(stats.activeCount, numberSystem)}</div>
              <div className="stat-desc">غير محذوفة</div>
            </div>
            <div className="stat min-w-32">
              <div className="stat-title">ظهرت هنا</div>
              <div className="stat-value text-xl">{formatNumber(stats.surfacedCount, numberSystem)}</div>
              <div className="stat-desc">عبر {formatNumber(stats.sectionCount, numberSystem)} مسارات</div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4" aria-labelledby="discover-sections-title">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 id="discover-sections-title" className="text-lg font-bold">مسارات الاكتشاف</h2>
            <p className="mt-1 text-sm text-base-content/70">{activeSection.description}</p>
          </div>
          <div role="tablist" className="tabs tabs-box w-full overflow-x-auto bg-base-200 p-1 lg:w-auto">
            {sections.map((section: any) => {
              const Icon = (SECTION_ICONS as any)[section.id] || Sparkles;
              const active = section.id === activeSection.id;
              return (
                <button
                  key={section.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`tab gap-2 whitespace-nowrap ${active ? "tab-active" : ""}`}
                  onClick={() => setActiveSectionId(section.id)}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {section.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className={`badge badge-soft ${(TONE_BADGES as any)[activeSection.tone] || "badge-neutral"}`}>
            <ActiveIcon className="h-3.5 w-3.5" aria-hidden="true" />
            {activeSection.label}
          </span>
          <span className="badge badge-outline">
            {formatNumber(activeSection.items.length, numberSystem)} عناصر
          </span>
        </div>

        {activeSection.items.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {activeSection.items.map((item: any) => (
              <DiscoveryCard key={`${activeSection.id}-${item.id}`} item={item} numberSystem={numberSystem} onOpen={openItem} />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-base-300 bg-base-100">
            <UXStateBlock
              title="لا توجد مواد كافية للاكتشاف"
              description="أضف مواد جديدة أو افتح بعض العناصر حتى تظهر مسارات الرائج والأكثر نشاطاً."
              actionLabel="فتح الأرشيف"
              onAction={() => setCurrentPage?.("archive")}
            />
          </div>
        )}
      </section>
    </MotionPage>
  );
}

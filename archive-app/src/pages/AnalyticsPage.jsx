import * as React from "react";
import { motion } from "framer-motion";
import { BarChart3, ExternalLink, Hash, Layers, Copy, HeartPulse } from "lucide-react";

import { PageHero } from "../components/ui/V1Primitives.jsx";
import { Surface, Badge, EmptyState } from "../components/ui/index.js";
import { useAppStore } from "../stores/index.js";
import { formatDateTime, formatNumber } from "../utils/formatting.js";
import { buildArchiveAnalytics } from "../features/analytics/analyticsSelectors.js";

const MONO = "font-[family-name:var(--va-font-mono)] tabular-nums";

/* ── Mono-numeral metric card (bento tile) ── */
function StatCard({ icon, label, value, hint }) {
  return (
    <Surface elevation={1} padding="p-[var(--va-pad-card)]" className="flex flex-col">
      <div className="flex items-center gap-2 text-[var(--va-text-muted)]">
        <span className="va-accent-text">{icon}</span>
        <span className="text-xs font-semibold">{label}</span>
      </div>
      <p className={`mt-2 text-2xl font-bold text-[var(--va-text)] ${MONO}`}>{value}</p>
      {hint ? <p className={`mt-1 text-xs text-[var(--va-text-muted)] ${MONO}`}>{hint}</p> : null}
    </Surface>
  );
}

function GrowthChart({ growth }) {
  return (
    <Surface elevation={1} padding="p-[var(--va-pad-card)]">
      <div
        className="flex items-end gap-1.5 overflow-x-auto pb-2"
        style={{ minHeight: "10rem" }}
        role="list"
        aria-label="النمو الشهري للأرشيف"
      >
        {growth.series.map((bucket) => {
          const heightPct = growth.maxCount
            ? Math.max(4, Math.round((bucket.count / growth.maxCount) * 100))
            : 0;
          return (
            <div
              key={bucket.key}
              role="listitem"
              title={`${bucket.label} — ${bucket.count}`}
              className="flex min-w-[2.25rem] shrink-0 flex-col items-center gap-1"
            >
              <span className={`text-[10px] font-semibold text-[var(--va-text-2)] ${MONO}`}>
                {formatNumber(bucket.count)}
              </span>
              <span
                className="flex w-7 flex-col-reverse overflow-hidden rounded-[var(--va-radius-sm)]"
                style={{ height: `${heightPct}%`, minHeight: "0.5rem" }}
              >
                <span className="block bg-emerald-500" style={{ flexGrow: 1 }} />
              </span>
              <span className={`max-w-[3.5rem] truncate text-[9px] text-[var(--va-text-muted)] ${MONO}`}>
                {bucket.label}
              </span>
            </div>
          );
        })}
      </div>
    </Surface>
  );
}

function ListPanel({ title, icon, children }) {
  return (
    <Surface elevation={1} padding="p-[var(--va-pad-card)]" as="section">
      <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-[var(--va-text)]">
        <span className="va-accent-text">{icon}</span>
        {title}
      </h2>
      {children}
    </Surface>
  );
}

export function AnalyticsPage() {
  const {
    videoItems = [],
    folders = [],
    virtualCollections = [],
    contentTypes = [],
    setCurrentPage,
    setSelectedItemId,
  } = useAppStore();

  const analytics = React.useMemo(
    () => buildArchiveAnalytics(videoItems, folders, virtualCollections),
    [videoItems, folders, virtualCollections]
  );

  const typeName = React.useCallback(
    (type) => contentTypes.find((entry) => entry.id === type)?.name || type,
    [contentTypes]
  );

  const openItem = (item) => {
    setSelectedItemId?.(item.id);
    setCurrentPage?.("detail");
  };

  const { growth, tags, uncategorized, duplicates, types, health } = analytics;
  const isEmpty = health.total === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="va-page-shell space-y-6 p-4 sm:p-6"
      dir="rtl"
    >
      <PageHero
        icon={<BarChart3 className="h-6 w-6 va-accent-text" />}
        title="تحليلات الأرشيف"
        description="لوحة شخصية تكشف نمو الأرشيف وصحته وأنماط استخدامه — النمو الشهري، أكثر الوسوم، العناصر غير المصنفة، والمكررات المحتملة."
      />

      {isEmpty ? (
        <EmptyState
          icon={<BarChart3 className="h-12 w-12" />}
          title="لا بيانات للتحليل بعد"
          description="أضف عناصر إلى الأرشيف وستظهر هنا رؤى عن نموه وصحته وأنماط استخدامه."
        />
      ) : (
        <>
          {/* Bento metric grid */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              icon={<Layers className="h-4 w-4" />}
              label="إجمالي العناصر"
              value={formatNumber(health.total)}
            />
            <StatCard
              icon={<HeartPulse className="h-4 w-4" />}
              label="موسومة"
              value={`${formatNumber(health.taggedPct)}٪`}
              hint={`${formatNumber(health.tagged)} عنصر`}
            />
            <StatCard
              icon={<Layers className="h-4 w-4" />}
              label="ضمن مجموعة"
              value={`${formatNumber(health.inCollectionPct)}٪`}
              hint={`${formatNumber(health.inCollection)} عنصر`}
            />
            <StatCard
              icon={<Hash className="h-4 w-4" />}
              label="غير مصنفة"
              value={formatNumber(health.uncategorized)}
              hint={`${formatNumber(health.uncategorizedPct)}٪ من الأرشيف`}
            />
          </section>

          <div className="space-y-2">
            <h2 className="flex items-center gap-2 text-base font-bold text-[var(--va-text)]">
              <BarChart3 className="h-4 w-4 va-accent-text" />
              {`النمو الشهري (${formatNumber(growth.total)})`}
            </h2>
            <GrowthChart growth={growth} />
          </div>

          {types.length > 0 ? (
            <section className="flex flex-wrap gap-2">
              {types.map(({ type, count }) => (
                <Badge key={type} tone="neutral">
                  {`${typeName(type)} (${formatNumber(count)})`}
                </Badge>
              ))}
            </section>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <ListPanel
              title={`أكثر الوسوم (${formatNumber(tags.length)})`}
              icon={<Hash className="h-4 w-4" />}
            >
              {tags.length === 0 ? (
                <p className="text-sm text-[var(--va-text-muted)]">لا وسوم بعد.</p>
              ) : (
                <ul className="space-y-1.5">
                  {tags.map(({ tag, count }) => (
                    <li
                      key={tag}
                      className="flex items-center justify-between gap-2 rounded-[var(--va-radius-md)] border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] px-3 py-1.5 text-sm"
                    >
                      <span className="truncate text-[var(--va-text-2)]" dir="auto">
                        {tag}
                      </span>
                      <span className={`shrink-0 text-xs font-semibold text-[var(--va-text-muted)] ${MONO}`}>
                        {formatNumber(count)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </ListPanel>

            <ListPanel
              title={`عناصر غير مصنفة (${formatNumber(uncategorized.count)})`}
              icon={<Layers className="h-4 w-4" />}
            >
              {uncategorized.count === 0 ? (
                <p className="text-sm text-[var(--va-text-muted)]">كل العناصر مصنفة 🎉</p>
              ) : (
                <div className="space-y-2">
                  {uncategorized.items.slice(0, 50).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openItem(item)}
                      className="flex w-full items-center justify-between gap-2 rounded-[var(--va-radius-md)] border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] p-2.5 text-right transition-colors hover:border-emerald-500/30"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--va-text)]" dir="auto">
                          {item.title || "بدون عنوان"}
                        </p>
                        <p className={`text-xs text-[var(--va-text-muted)] ${MONO}`}>
                          {item.createdAt ? formatDateTime(item.createdAt) : ""}
                        </p>
                      </div>
                      <ExternalLink className="h-4 w-4 shrink-0 text-[var(--va-text-muted)]" />
                    </button>
                  ))}
                </div>
              )}
            </ListPanel>
          </div>

          <ListPanel
            title={`مجموعات مكررة محتملة (${formatNumber(duplicates.length)})`}
            icon={<Copy className="h-4 w-4" />}
          >
            {duplicates.length === 0 ? (
              <p className="text-sm text-[var(--va-text-muted)]">لا مكررات واضحة بحسب العنوان.</p>
            ) : (
              <div className="space-y-3">
                {duplicates.slice(0, 20).map((group) => (
                  <div
                    key={group.key}
                    className="rounded-[var(--va-radius-lg)] border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] p-3"
                  >
                    <p className="mb-2 flex items-center text-xs font-semibold text-[var(--va-highlight)]">
                      {`${formatNumber(group.items.length)} عناصر متشابهة`}
                    </p>
                    <div className="space-y-1.5">
                      {group.items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => openItem(item)}
                          className="flex w-full items-center justify-between gap-2 rounded-[var(--va-radius-md)] border border-[var(--va-border-soft)] bg-[var(--va-surface)] px-2.5 py-1.5 text-right transition-colors hover:border-emerald-500/30"
                        >
                          <span className="truncate text-sm text-[var(--va-text-2)]" dir="auto">
                            {item.title || "بدون عنوان"}
                          </span>
                          <ExternalLink className="h-4 w-4 shrink-0 text-[var(--va-text-muted)]" />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ListPanel>
        </>
      )}
    </motion.div>
  );
}

AnalyticsPage.pageId = "analytics";
AnalyticsPage.migrationStatus = "native";

export default AnalyticsPage;

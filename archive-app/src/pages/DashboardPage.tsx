import { useAppStore } from "../stores/index.js";
import { writeAppRoute } from "../services/router/index.js";
import {
  Activity,
  AlertTriangle,
  Archive,
  BarChart3,
  Bookmark,
  CheckCircle2,
  Clock3,
  Database,
  Eye,
  FileText,
  HardDrive,
  LayoutGrid,
  RotateCcw,
  Save,
  Search,
  Settings2,
  Shield,
  Sparkles,
  Tags,
  Upload,
  Users,
  Video,
  Wand2,
  X
} from "lucide-react";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";

import {
  CommandPanel,
  MotionPage,
  QuickActionGrid,
  ReportStrip,
  ResultPreview,
  RiskActionPanel,
  SectionToolbar,
  UXEmptyState
} from "../components/ui/V1Primitives.jsx";
import { KbdHint } from "../components/common/Kbd.jsx";
import { ArchiveImprovementSuggestions } from "../components/recommendations/ArchiveImprovementSuggestions.jsx";
import { SuggestionsPanel } from "../components/suggestions/SuggestionsPanel.jsx";
import { buildSuggestions } from "../features/suggestions/suggestionEngine.js";
import { buildDiscoverySections } from "../features/discover/discoveryEngine.js";
import {
  createDashboardStats,
  getDailyFocusItems,
  getDashboardDemoItemIds
} from "../features/dashboard/viewModel.js";
import { getArchiveImprovementSuggestions } from "../features/archive/relatedItems.js";
import {
  filterDismissedRecommendations,
  getRecommendationFeedback,
  setRecommendationFeedback
} from "../features/recommendations/recommendationFeedback.js";
import {
  normalizeDashboardLayout,
  resetDashboardLayout,
  setPanelHidden,
  setPanelAutoHeight,
  hasDashboardLayoutDraftChanges
} from "../features/dashboard/dashboardLayoutModel.js";
import { DashboardGrid } from "../features/dashboard/DashboardGrid.jsx";
import { appConfirm } from "../components/common/ConfirmDialog.js";
import { createArchiveRouteParams } from "../features/archive/viewModel.js";
import { createSearchRouteParams } from "../features/search/viewModel.js";
import { SavedViewsBar } from "../features/archive/SavedViewsBar.jsx";
import {
  getSavedViews,
  removeSavedView
} from "../features/archive/savedViews.js";
import { resolveBackendChoice } from "../bootstrap/backendChoice.js";
import { formatDateTime, formatNumber } from "../utils/formatting.js";
import { SessionRestoreBanner } from "../components/autosave/SessionRestoreBanner.jsx";

const DASHBOARD_PANEL_TITLES = {
  hero: "مركز التحكم",
  reportStrip: "المؤشرات",
  dailyFocus: "أولويات اليوم",
  operations: "إجراءات العمليات",
  savedViews: "عروض محفوظة",
  recommendations: "اقتراحات التحسين",
  usageSuggestions: "تحسين الاستخدام",
  distribution: "توزيع المحتوى",
  orgMetrics: "مؤشرات تنظيمية",
  recentItems: "آخر المواد",
  todaysDigest: "اكتشاف اليوم",
  recentActivity: "آخر نشاط"
};
const DASHBOARD_PANEL_IDS = Object.keys(DASHBOARD_PANEL_TITLES);

function getItemTimestamp(item: any = {}) {
  return item.lastViewedAt || item.updatedAt || item.createdAt || "";
}

function getTypeDistribution(videoItems: any = [], contentTypes: any = []) {
  const counts = new Map();
  videoItems.filter((item: any) => !item.isDeleted).forEach((item: any) => {
    counts.set(item.type || "unknown", (counts.get(item.type || "unknown") || 0) + 1);
  });
  return contentTypes
    .map((type: any) => ({
      id: type.id,
      label: type.name || type.nameEn || "نوع",
      count: counts.get(type.id) || 0,
      color: type.color || "#13c8b3"
    }))
    .filter((item: any) => item.count > 0)
    .sort((a: any, b: any) => b.count - a.count)
    .slice(0, 5);
}

function StatusRow({ label, value, status = "neutral", icon }: any) {
  // Stacked layout (label on top, value below) so the 4-up status strip in the
  // dashboard hero stays readable in narrow cells without truncating labels.
  const tone = status === "ok"
    ? "va-accent-text-on-soft"
    : status === "warning"
      ? "text-amber-200"
      : "text-[var(--va-text-2)]";
  return jsxs("div", {
    className: "flex min-w-0 flex-col gap-1 rounded-xl border border-[var(--va-border-soft)] bg-[var(--va-surface)] px-3 py-2",
    children: [
      jsxs("span", {
        className: "flex min-w-0 items-center gap-1.5 text-[11px] text-[var(--va-text-muted)]",
        children: [
          icon,
          jsx("span", { className: "truncate", children: label })
        ]
      }),
      jsx("span", { className: `truncate text-xs font-semibold ${tone}`, title: typeof value === "string" ? value : undefined, children: value })
    ]
  });
}

function DistributionBars({ items = [], total = 0 }: any) {
  if (!items.length) {
    return jsx("p", { className: "rounded-xl border border-dashed border-[var(--va-border-soft)] p-4 text-sm leading-6 text-[var(--va-text-muted)]", children: "لم تتشكل خريطة توزيع بعد. ستظهر الأنواع الأكثر استخدامًا هنا بعد إضافة المواد." });
  }
  return jsx("div", {
    className: "space-y-3",
    children: items.map((item: any) => {
      const percent = total ? Math.max(4, Math.round((item.count / total) * 100)) : 4;
      return jsxs("div", {
        children: [
          jsxs("div", {
            className: "mb-1 flex items-center justify-between gap-3 text-xs",
            children: [
              jsx("span", { className: "truncate text-[var(--va-text-2)]", children: item.label }),
              jsx("span", { className: "va-number-badge text-[var(--va-text-muted)]", children: formatNumber(item.count) })
            ]
          }),
          jsx("div", {
            className: "h-2 overflow-hidden rounded-full bg-[var(--va-surface-2)]",
            children: jsx("div", {
              className: "h-full rounded-full",
              style: {
                width: `${percent}%`,
                background: `linear-gradient(90deg, ${item.color}, color-mix(in srgb, ${item.color} 55%, #32d5ff))`
              }
            })
          })
        ]
      }, item.id);
    })
  });
}

function RecentSearchButton({ term, onClick }: any) {
  // DaisyUI `btn btn-sm btn-ghost` over the custom chip surface (§1881 Phase 12)
  return jsxs("button", {
    type: "button",
    onClick,
    className: "btn btn-sm btn-ghost inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[var(--va-border-soft)] bg-[var(--va-surface)] px-2.5 py-1 text-xs font-normal text-[var(--va-text-2)] transition-colors hover:border-emerald-500/30 hover:text-emerald-100",
    children: [
      jsx(Search, { className: "h-3.5 w-3.5 opacity-70" }),
      jsx("span", { className: "max-w-[11rem] truncate", children: term })
    ]
  });
}

const dailyFocusIcons = {
  add: Video,
  import: Upload,
  review: AlertTriangle,
  backup: HardDrive,
  health: CheckCircle2,
  recent: Clock3,
  security: Shield,
  archive: Archive
};

const dailyFocusActionLabels = {
  add: "إضافة",
  import: "استيراد",
  review: "مراجعة",
  backup: "نسخ",
  health: "فحص",
  recent: "فتح",
  security: "تأمين",
  archive: "فتح"
};

const dailyFocusToneClasses = {
  emerald: "va-accent-border va-accent-bg-soft va-accent-text-on-soft",
  cyan: "border-cyan-500/20 bg-cyan-500/10 text-cyan-200",
  amber: "border-amber-500/20 bg-amber-500/10 text-amber-200",
  violet: "border-violet-500/20 bg-violet-500/10 text-violet-200",
  slate: "border-[var(--va-border-soft)] bg-[var(--va-surface-2)] text-[var(--va-text-2)]"
};

function DailyFocusPanel({ items = [], onAction }: any) {
  if (!items.length) return null;

  return jsx(CommandPanel, {
    title: "أولويات اليوم",
    description: "خطوات مباشرة حسب حالة الأرشيف الآن.",
    icon: jsx(CheckCircle2, { className: "h-5 w-5 va-accent-text" }),
    children: jsx("div", {
      className: "grid gap-2 lg:grid-cols-2",
      children: items.map((item: any) => {
        const Icon = (dailyFocusIcons as any)[item.action] || CheckCircle2;
        const toneClass = (dailyFocusToneClasses as any)[item.tone] || dailyFocusToneClasses.slate;
        return jsxs("button", {
          type: "button",
          onClick: () => onAction?.(item),
          className: "va-action-card group flex min-h-[5.25rem] w-full items-start gap-3 rounded-xl border border-[var(--va-border-soft)] bg-[var(--va-surface)] p-3 text-right transition-colors hover:border-emerald-500/25 hover:bg-[var(--va-surface-2)]",
          children: [
            jsx("span", {
              className: `flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${toneClass}`,
              children: jsx(Icon, { className: "h-5 w-5" })
            }),
            jsxs("span", {
              className: "min-w-0 flex-1",
              children: [
                jsxs("span", {
                  className: "flex flex-wrap items-center gap-2",
                  children: [
                    jsx("span", { className: "text-sm font-bold text-[var(--va-text)]", children: item.title }),
                    item.metric && jsx("span", { className: "va-number-badge text-[11px] text-[var(--va-text-2)]", children: item.metric })
                  ]
                }),
                jsx("span", { className: "mt-1 block text-xs leading-5 text-[var(--va-text-muted)]", children: item.detail })
              ]
            }),
            jsx("span", {
              className: "shrink-0 self-center rounded-lg border border-[var(--va-border-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--va-text-2)] transition-colors group-hover:text-emerald-100",
              children: (dailyFocusActionLabels as any)[item.action] || "فتح"
            })
          ]
        }, item.id);
      })
    })
  });
}

function formatClockTime(date: any) {
  return new Intl.DateTimeFormat("ar-EG-u-nu-arab", { hour: "2-digit", minute: "2-digit", hour12: true }).format(date);
}

function formatClockDate(date: any) {
  // Gregorian weekday + day + month for the primary line.
  return new Intl.DateTimeFormat("ar-EG-u-nu-arab", { weekday: "long", day: "numeric", month: "long" }).format(date);
}

function formatClockHijri(date: any) {
  // Compact Hijri (day + month only) for the secondary line; the year is
  // implied by the visible Gregorian date so it would waste pixels here.
  try {
    return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", { day: "numeric", month: "long" }).format(date);
  } catch {
    return "";
  }
}

function LiveClockBadge() {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    // Re-render on the next minute boundary; ticking every second wakes the
    // dashboard 60x more often than the displayed precision (HH:MM) needs.
    let timeoutId = 0;
    const schedule = (current: any) => {
      const msToNextMinute = (60 - current.getSeconds()) * 1000 - current.getMilliseconds();
      timeoutId = window.setTimeout(() => {
        const next = new Date();
        setNow(next);
        schedule(next);
      }, Math.max(1000, msToNextMinute));
    };
    schedule(new Date());
    return () => window.clearTimeout(timeoutId);
  }, []);
  const gregorian = formatClockDate(now);
  const hijri = formatClockHijri(now);
  return jsxs("div", {
    className: "flex items-center gap-2 rounded-xl border border-[var(--va-border-soft)] bg-white/[0.035] px-3 py-1.5 text-[var(--va-text-2)]",
    role: "status",
    "aria-label": hijri
      ? `الوقت ${formatClockTime(now)} — ${gregorian} — ${hijri} هـ`
      : `الوقت ${formatClockTime(now)} — التاريخ ${gregorian}`,
    children: [
      jsx(Clock3, { className: "h-4 w-4 va-accent-text", "aria-hidden": "true" }),
      jsxs("div", {
        className: "flex flex-col leading-tight",
        children: [
          jsx("span", { className: "text-sm font-semibold tabular-nums text-[var(--va-text)]", children: formatClockTime(now) }),
          jsx("span", { className: "text-[10px] text-[var(--va-text-muted)]", children: gregorian }),
          hijri && jsx("span", { className: "text-[10px] text-[var(--va-text-muted)] opacity-80", "aria-hidden": "true", children: `${hijri} هـ` })
        ]
      })
    ]
  });
}

export function DashboardPage() {
  const {
    videoItems = [],
    contentTypes = [],
    virtualCollections = [],
    hierarchicalTags = [],
    auditLogs = [],
    users = [],
    settings = {},
    connectionStatus = {},
    sqliteError,
    isPasswordSet,
    recentSearches = [],
    setCurrentPage,
    setSelectedItemId,
    setSearchQuery,
    setFilterType,
    setFilterSubtype,
    setViewMode,
    updateSettings,
    runSystemHealthCheck,
    markItemViewed,
    showToast,
    loadSessionsFromStorage,
    deleteSession
  } = useAppStore();
  const [commandQuery, setCommandQuery] = React.useState("");
  const [recommendationFeedback, setRecommendationFeedbackState] = React.useState(() => getRecommendationFeedback());
  const [restorableSession, setRestorableSession] = React.useState(null);

  React.useEffect(() => {
    loadSessionsFromStorage?.().then((sessions: any) => {
      const candidate = (sessions || [])
        .filter((s: any) => s.page && s.page !== "dashboard")
        .sort((a: any, b: any) => +new Date(b.updatedAt || 0) - +new Date(a.updatedAt || 0))[0] || null;
      setRestorableSession(candidate);
    }).catch(() => {});
  }, [loadSessionsFromStorage]);

  function handleSessionRestore(session: any) {
    setRestorableSession(null);
    deleteSession?.(session.page);
    setCurrentPage(session.page);
    if (session.filters) {
      if (session.filters.type) setFilterType?.(session.filters.type);
      if (session.filters.subtype) setFilterSubtype?.(session.filters.subtype);
      if (session.filters.query) setSearchQuery?.(session.filters.query);
      if (session.filters.viewMode) setViewMode?.(session.filters.viewMode);
    }
  }

  function handleSessionDismiss() {
    if (restorableSession) deleteSession?.((restorableSession as any).page);
    setRestorableSession(null);
  }

  const stats = React.useMemo(() => createDashboardStats({
    videoItems,
    contentTypes,
    virtualCollections,
    hierarchicalTags
  }), [videoItems, contentTypes, virtualCollections, hierarchicalTags]);

  const activeItems = React.useMemo(() => videoItems.filter((item: any) => !item.isDeleted), [videoItems]);
  const recentItems = React.useMemo(() => activeItems
    .slice()
    .sort((a: any, b: any) => new Date(getItemTimestamp(b) || 0).getTime() - new Date(getItemTimestamp(a) || 0).getTime())
    .slice(0, 6), [activeItems]);
  const dailyFocusItems = React.useMemo(() => getDailyFocusItems({
    stats,
    settings,
    recentItems,
    isPasswordSet,
    sqliteError
  }), [isPasswordSet, recentItems, settings, sqliteError, stats]);
  const distribution = React.useMemo(() => getTypeDistribution(videoItems, contentTypes), [contentTypes, videoItems]);
  const todaysDigestItems = React.useMemo(() => {
    const sections = buildDiscoverySections({
      videoItems,
      auditLogs,
      limit: 3,
      seed: `digest:${new Date().toISOString().slice(0, 10)}`
    });
    const forgotten = sections.find((section: any) => section.id === "forgotten");
    return (forgotten?.items || []).slice(0, 3);
  }, [auditLogs, videoItems]);
  const dashboardSuggestions = React.useMemo(
    () => filterDismissedRecommendations(getArchiveImprovementSuggestions(videoItems, { contentTypes, limit: 4 }), recommendationFeedback),
    [contentTypes, recommendationFeedback, videoItems]
  );
  const dismissedSuggestions = settings.ui?.dismissedSuggestions || [];
  const usageSuggestions = React.useMemo(
    () => buildSuggestions({ videoItems, virtualCollections, contentTypes }, { dismissed: dismissedSuggestions }),
    [contentTypes, dismissedSuggestions, videoItems, virtualCollections]
  );
  const demoIds = React.useMemo(() => getDashboardDemoItemIds(videoItems), [videoItems]);
  const dismissedBanners = settings.ui?.dismissedBanners || [];
  const demoBannerDismissed = dismissedBanners.includes("demo");
  const savedViews = React.useMemo(() => getSavedViews(settings), [settings]);
  const activeUsers = users.filter((user: any) => user.isActive !== false).length;
  const latestAudit = auditLogs.slice().sort((a: any, b: any) => new Date(b.timestamp || b.createdAt || 0).getTime() - new Date(a.timestamp || a.createdAt || 0).getTime())[0];
  const lastBackup = settings.lastBackupAt ? formatDateTime(settings.lastBackupAt) : "لا توجد نسخة";
  const lastHealth = settings.systemHealth?.lastCheckAt ? formatDateTime(settings.systemHealth.lastCheckAt) : "لم يتم الفحص";
  const backendChoice = React.useMemo(() => resolveBackendChoice(), []);
  const storageStatus = React.useMemo(() => {
    if (sqliteError) return { value: "تحقق التخزين", status: "warning" };
    if (backendChoice.backend !== "local") {
      const engine = connectionStatus.engine || backendChoice.backend;
      const isOffline = connectionStatus.state === "offline" || connectionStatus.state === "reconnecting";
      const label = /postgres|sql/i.test(engine) ? "Postgres SQL" : String(engine || backendChoice.backend);
      return { value: label, status: isOffline ? "warning" : "ok" };
    }
    return { value: "IndexedDB محلي", status: "ok" };
  }, [backendChoice.backend, connectionStatus.engine, connectionStatus.state, sqliteError]);

  const goTo = (page: any) => {
    setSelectedItemId(null);
    setCurrentPage(page);
  };

  const openItem = (item: any) => {
    setSelectedItemId(item.id);
    markItemViewed?.(item.id);
    setCurrentPage("detail");
  };

  const dismissBanner = (bannerId: any) => {
    const next = Array.from(new Set([...dismissedBanners, bannerId]));
    updateSettings?.({ ui: { ...(settings.ui || {}), dismissedBanners: next } });
  };

  const openDataTab = async (tab: any) => {
    await updateSettings?.({ ui: { ...(settings.ui || {}), lastDataCenterTab: tab } });
    goTo("backup");
    window.dispatchEvent(new CustomEvent("videoarchive:data-tab", { detail: { tab } }));
  };

  const runHealth = async () => {
    const report = await runSystemHealthCheck?.();
    if (report) showToast?.("اكتمل فحص النظام", report.status === "ok" ? "success" : "warning");
  };

  const openSecuritySettings = () => {
    updateSettings?.({ ui: { ...(settings.ui || {}), lastSettingsTab: "security" } });
    goTo("settings");
  };

  const openSearchFor = (query: any = commandQuery) => {
    const normalizedQuery = String(query || "").trim();
    setSearchQuery?.(normalizedQuery);
    const params = createSearchRouteParams({ query: normalizedQuery, viewMode: "list", itemSize: "compact" });
    writeAppRoute("search", { params }, settings, false);
    goTo("search");
  };

  const openArchiveFor = (query: any = commandQuery) => {
    const normalizedQuery = String(query || "").trim();
    setSearchQuery?.(normalizedQuery);
    setFilterType?.("all");
    setFilterSubtype?.("all");
    setViewMode?.("details");
    const params = createArchiveRouteParams({
      searchQuery: normalizedQuery,
      filterType: "all",
      filterSubtype: "all",
      showFavoritesOnly: false,
      itemSize: "compact",
      viewMode: "details"
    });
    writeAppRoute("archive", { params }, settings, false);
    goTo("archive");
  };

  const applySavedView = (view: any) => {
    if (!view?.filters) return;
    const filters = view.filters;
    setSearchQuery?.(filters.query || "");
    setFilterType?.(filters.type || "all");
    setFilterSubtype?.(filters.subtype || "all");
    setViewMode?.(filters.viewMode || "grid");
    const params = createArchiveRouteParams({
      searchQuery: filters.query || "",
      filterType: filters.type || "all",
      filterSubtype: filters.subtype || "all",
      showFavoritesOnly: !!filters.favoritesOnly,
      showDeleted: !!filters.showDeleted,
      itemSize: filters.itemSize || "compact",
      viewMode: filters.viewMode || "grid"
    });
    writeAppRoute("archive", { params }, settings, false);
    goTo("archive");
  };

  const removeView = async (viewId: any) => {
    const nextList = removeSavedView(settings, viewId);
    await updateSettings?.({ ui: { ...(settings.ui || {}), savedArchiveViews: nextList } });
  };

  const handleDailyFocusAction = (item: any) => {
    switch (item?.action) {
      case "add":
        goTo("add");
        break;
      case "import":
        openDataTab("import");
        break;
      case "review":
        openArchiveFor("");
        break;
      case "backup":
        openDataTab("backup");
        break;
      case "health":
        runHealth();
        break;
      case "recent":
        if (recentItems[0]) openItem(recentItems[0]);
        else openArchiveFor("");
        break;
      case "security":
        openSecuritySettings();
        break;
      default:
        openArchiveFor("");
        break;
    }
  };

  const handleDashboardSuggestion = (suggestion: any) => {
    if (suggestion.action === "types") goTo("types");
    else openArchiveFor("");
  };
  const handleDashboardSuggestionFeedback = (suggestion: any, value: any) => {
    setRecommendationFeedbackState(setRecommendationFeedback(suggestion.key || suggestion.id, value));
    if (value === "dismissed") showToast?.("تم إخفاء الاقتراح", "success");
  };

  const handleUsageSuggestionAction = (suggestion: any) => {
    goTo(suggestion?.actionPage || "archive");
  };
  const dismissUsageSuggestion = (suggestion: any) => {
    if (!suggestion?.id) return;
    const next = Array.from(new Set([...dismissedSuggestions, suggestion.id]));
    updateSettings?.({ ui: { ...(settings.ui || {}), dismissedSuggestions: next } });
    showToast?.("تم إخفاء الاقتراح", "success");
  };

  const reportItems = [
    { id: "total", label: "إجمالي المواد", value: formatNumber(stats.total), animateTo: stats.total, format: formatNumber, hint: "نشطة داخل الأرشيف", icon: jsx(Video, { className: "h-4 w-4" }), tone: "emerald" },
    { id: "review", label: "تحتاج مراجعة", value: formatNumber(stats.needsReview), animateTo: stats.needsReview, format: formatNumber, hint: `${formatNumber(stats.completenessAverage)}% اكتمال`, icon: jsx(AlertTriangle, { className: "h-4 w-4" }), tone: stats.needsReview ? "amber" : "emerald" },
    { id: "week", label: "نشاط 7 أيام", value: formatNumber(stats.recentActivity), animateTo: stats.recentActivity, format: formatNumber, hint: `${formatNumber(stats.addedThisWeek)} إضافة جديدة`, icon: jsx(Activity, { className: "h-4 w-4" }), tone: "cyan" },
    { id: "users", label: "المستخدمون", value: formatNumber(activeUsers), animateTo: activeUsers, format: formatNumber, hint: `${formatNumber(stats.types)} أنواع و${formatNumber(stats.collections)} مجموعات`, icon: jsx(Users, { className: "h-4 w-4" }), tone: "violet" }
  ];

  const quickActions = [
    { id: "add", label: "إضافة فيديو", detail: "إنشاء مادة أرشيفية جديدة", icon: jsx(Video, { className: "h-5 w-5" }), onClick: () => goTo("add"), tone: "emerald" },
    { id: "archive", label: "فتح الأرشيف", detail: "جدول/شبكة ومعاينة مباشرة", icon: jsx(Archive, { className: "h-5 w-5" }), onClick: () => openArchiveFor(""), tone: "cyan" },
    { id: "reports", label: "التقارير", detail: "مراجعة التوزيع والنشاط", icon: jsx(BarChart3, { className: "h-5 w-5" }), onClick: () => goTo("reports"), tone: "amber" },
    { id: "transfer", label: "نقل ونسخ", detail: "حزم نقل ونسخ احتياطي", icon: jsx(HardDrive, { className: "h-5 w-5" }), onClick: () => openDataTab("transfer"), tone: "violet" },
    { id: "import", label: "استيراد ملف", detail: "معاينة قبل الدمج", icon: jsx(Upload, { className: "h-5 w-5" }), onClick: () => openDataTab("import"), tone: "slate" },
    { id: "ai", label: "تفريغ/ذكاء", detail: "الوصول لأدوات التفريغ", icon: jsx(Wand2, { className: "h-5 w-5" }), onClick: () => goTo("transcriber"), tone: "cyan" }
  ];

  const savedDashboardLayout = React.useMemo(
    () => normalizeDashboardLayout(settings.ui?.dashboardLayout, DASHBOARD_PANEL_IDS),
    [settings.ui?.dashboardLayout]
  );
  const [dashEditing, setDashEditing] = React.useState(false);
  const [workingLayout, setWorkingLayout] = React.useState<any>(null);
  React.useEffect(() => { if (!dashEditing) setWorkingLayout(savedDashboardLayout); }, [savedDashboardLayout, dashEditing]);
  const activeDashLayout = workingLayout || savedDashboardLayout;
  const dashPrefersReducedMotion = settings.ui?.motionLevel === "off" || settings.ui?.motionLevel === "reduced";

  const startDashEditing = () => { setWorkingLayout(savedDashboardLayout); setDashEditing(true); };
  const cancelDashEditing = async () => {
    if (workingLayout && hasDashboardLayoutDraftChanges(workingLayout, savedDashboardLayout)) {
      const ok = await appConfirm("لديك تغييرات غير محفوظة على تخطيط اللوحة. تجاهلها؟", { title: "إلغاء التخصيص", kind: "danger", confirmLabel: "تجاهل" });
      if (!ok) return;
    }
    setWorkingLayout(savedDashboardLayout);
    setDashEditing(false);
  };
  const saveDashEditing = async () => {
    await updateSettings({ ui: { ...(settings.ui || {}), dashboardLayout: activeDashLayout } });
    setDashEditing(false);
    showToast?.("تم حفظ تخطيط اللوحة", "success");
  };
  const resetDashLayout = async () => {
    const ok = await appConfirm("استعادة التخطيط الافتراضي للوحة؟", { title: "استعادة الافتراضي", confirmLabel: "استعادة" });
    if (ok) setWorkingLayout(resetDashboardLayout(DASHBOARD_PANEL_IDS));
  };
  const toggleDashHidden = (id: any) => setWorkingLayout((l: any) => { const base = l || savedDashboardLayout; return setPanelHidden(base, id, !base.items[id]?.hidden); });
  const toggleDashAuto = (id: any) => setWorkingLayout((l: any) => { const base = l || savedDashboardLayout; return setPanelAutoHeight(base, id, !(base.items[id]?.autoHeight !== false)); });
  const hiddenDashPanels = DASHBOARD_PANEL_IDS.filter((id: any) => activeDashLayout.items[id]?.hidden);

  return jsxs(MotionPage, {
    className: "space-y-2 p-4 sm:p-5 xl:p-6",
    children: [
      jsx(SessionRestoreBanner, {
        session: restorableSession,
        onRestore: handleSessionRestore,
        onDismiss: handleSessionDismiss
      }),
      // View mode: just a small "customize" button in the corner, no wrapper panel.
      // Edit mode: full toolbar with save/cancel/reset and any hidden-panel chips.
      !dashEditing && jsx("div", {
        className: "flex justify-end",
        children: jsx("button", { type: "button", onClick: startDashEditing, title: "تخصيص ترتيب لوحة التحكم", "aria-label": "تخصيص ترتيب لوحة التحكم", className: "btn btn-ghost btn-sm h-8 w-8", children: jsx(Settings2, { className: "h-4 w-4 va-accent-text" }) })
      }, "dash-customize-btn"),
      dashEditing && jsxs("div", {
        className: "flex flex-wrap items-center justify-between gap-3 rounded-2xl border va-accent-border va-accent-bg/[0.04] px-4 py-2.5",
        children: [
          jsxs("div", {
            className: "flex flex-wrap items-center gap-2",
            children: [
              jsxs("button", { type: "button", onClick: saveDashEditing, className: "btn btn-sm btn-primary gap-2", children: [jsx(Save, { className: "h-4 w-4" }), "حفظ"] }, "save"),
              jsxs("button", { type: "button", onClick: cancelDashEditing, className: "btn btn-sm btn-ghost inline-flex min-h-9 items-center gap-2 rounded-xl border border-[var(--va-border-soft)] px-3 py-1.5 text-sm font-normal text-[var(--va-text-2)] hover:bg-[var(--va-surface-2)]", children: [jsx(X, { className: "h-4 w-4" }), "إلغاء"] }, "cancel"),
              jsxs("button", { type: "button", onClick: resetDashLayout, className: "btn btn-sm btn-ghost inline-flex min-h-9 items-center gap-2 rounded-xl border border-[var(--va-border-soft)] px-3 py-1.5 text-sm font-normal text-[var(--va-text-2)] hover:bg-[var(--va-surface-2)]", children: [jsx(RotateCcw, { className: "h-4 w-4" }), "استعادة الافتراضي"] }, "reset")
            ]
          }),
          hiddenDashPanels.length === 0
            ? jsx("span", { className: "text-xs text-[var(--va-text-muted)]", children: "اسحب رأس اللوحة لإعادة الترتيب · اسحب الحافة للتحجيم" }, "hint")
            : jsxs("div", { className: "flex flex-wrap items-center gap-1.5", children: [
                jsx("span", { className: "text-xs text-[var(--va-text-muted)]", children: "إظهار:" }),
                ...hiddenDashPanels.map((id: any) => jsxs("button", { type: "button", onClick: () => toggleDashHidden(id), className: "btn btn-xs btn-ghost inline-flex min-h-8 items-center gap-1.5 rounded-lg border va-accent-border va-accent-bg-soft px-2.5 py-1 text-xs font-semibold va-accent-text-on-soft", children: [jsx(Eye, { className: "h-3.5 w-3.5" }), (DASHBOARD_PANEL_TITLES as any)[id] || id] }, id))
              ] }, "hidden-list")
        ]
      }, "dash-toolbar"),
      jsx(DashboardGrid, {
        titles: DASHBOARD_PANEL_TITLES,
        layout: activeDashLayout,
        editing: dashEditing,
        onChange: setWorkingLayout,
        onToggleHidden: toggleDashHidden,
        onToggleAuto: toggleDashAuto,
        prefersReducedMotion: dashPrefersReducedMotion,
        children: [
      jsxs(CommandPanel, {
        highlight: true,
        className: "va-command-center-hero",
        children: [
          jsxs("div", {
            className: "grid gap-4",
            children: [
              jsxs("div", {
                className: "min-w-0",
                children: [
                  jsxs("div", {
                    className: "flex flex-wrap items-start justify-between gap-4",
                    children: [
                      jsxs("div", {
                        className: "min-w-0",
                        children: [
                          jsxs("h2", {
                            className: "flex items-center gap-2.5 text-xl font-bold text-[var(--va-text)] sm:text-2xl",
                            children: [
                              jsx("span", { className: "flex h-9 w-9 items-center justify-center rounded-xl border va-accent-border va-accent-bg-soft va-accent-text-on-soft", children: jsx(Shield, { className: "h-5 w-5" }) }),
                              "مركز التحكم"
                            ]
                          }),
                          jsx("p", {
                            className: "mt-1 max-w-3xl text-xs leading-6 text-[var(--va-text-2)]",
                            children: "واجهة عمليات واحدة تجمع التقارير المختصرة، البحث، جاهزية النظام، والوصول السريع لكل مسارات الأرشيف."
                          })
                        ]
                      }),
                      jsxs("div", {
                        className: "flex flex-wrap items-center gap-2",
                        children: [
                          jsx(LiveClockBadge, {}),
                          jsxs("button", {
                            type: "button",
                            onClick: () => goTo("add"),
                            className: "btn btn-sm btn-primary gap-2",
                            title: "إضافة فيديو — اختصار A",
                            children: [
                              jsx(Video, { className: "h-4 w-4" }),
                              "إضافة فيديو",
                              jsx(KbdHint, { keys: ["A"], className: "opacity-80" })
                            ]
                          })
                        ]
                      })
                    ]
                  }),
                  jsxs("form", {
                    className: "mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]",
                    role: "search",
                    onSubmit: (event: any) => {
                      event.preventDefault();
                      openSearchFor();
                    },
                    children: [
                      jsxs("label", {
                        className: "relative block min-w-0",
                        children: [
                          jsx("span", { className: "sr-only", children: "بحث في الأرشيف" }),
                          jsx(Search, { className: "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--va-text-muted)]" }),
                          jsx("input", {
                            value: commandQuery,
                            onChange: (event: any) => setCommandQuery(event.target.value),
                            placeholder: "ابحث عن عنوان، وسم، مسار، أو ملاحظة...",
                            className: "input input-bordered va-command-search-input min-h-11 w-full rounded-xl border py-2 pe-4 ps-3 pr-10 text-sm outline-none"
                          })
                        ]
                      }),
                      jsxs("button", {
                        type: "submit",
                        className: "btn btn-primary gap-2",
                        children: [jsx(Search, { className: "h-4 w-4" }), "بحث"]
                      }),
                      jsxs("button", {
                        type: "button",
                        onClick: () => openArchiveFor(),
                        className: "btn btn-ghost gap-2",
                        children: [jsx(Archive, { className: "h-4 w-4" }), "في الأرشيف"]
                      })
                    ]
                  }),
                  recentSearches.length > 0 && jsx("div", {
                    className: "mt-3 flex flex-wrap gap-1.5",
                    children: recentSearches.slice(0, 6).map((term: any) => jsx(RecentSearchButton, {
                      term,
                      onClick: () => {
                        setCommandQuery(term);
                        openSearchFor(term);
                      }
                    }, term))
                  })
                ]
              }),
              jsxs("div", {
                className: "grid grid-cols-2 gap-2 sm:grid-cols-4",
                children: [
                  jsx(StatusRow, { label: "التخزين", value: storageStatus.value, status: storageStatus.status, icon: jsx(Database, { className: "h-4 w-4 text-[var(--va-text-muted)]" }) }, "storage"),
                  jsx(StatusRow, { label: "آخر نسخة", value: lastBackup, status: settings.lastBackupAt ? "ok" : "warning", icon: jsx(HardDrive, { className: "h-4 w-4 text-[var(--va-text-muted)]" }) }, "backup"),
                  jsx(StatusRow, { label: "آخر فحص", value: lastHealth, status: settings.systemHealth?.lastCheckAt ? "ok" : "neutral", icon: jsx(CheckCircle2, { className: "h-4 w-4 text-[var(--va-text-muted)]" }) }, "health"),
                  jsx(StatusRow, { label: "اكتمال البيانات", value: `${formatNumber(stats.completenessAverage)}%`, status: stats.needsReview ? "warning" : "ok", icon: jsx(FileText, { className: "h-4 w-4 text-[var(--va-text-muted)]" }) }, "complete")
                ]
              })
            ]
          }),
          demoIds.length > 0 && !demoBannerDismissed && jsxs(RiskActionPanel, {
            className: "mt-4",
            icon: jsx(AlertTriangle, { className: "h-5 w-5" }),
            title: "توجد عناصر تجريبية",
            description: `راجع ${formatNumber(demoIds.length)} عناصر تجريبية قبل الاستخدام الفعلي.`,
            actions: jsxs("div", {
              className: "flex gap-2",
              children: [
                jsx("button", { type: "button", onClick: () => goTo("archive"), className: "btn btn-ghost btn-xs", children: "فتح الأرشيف" }),
                jsx("button", { type: "button", onClick: () => dismissBanner("demo"), className: "btn btn-ghost btn-xs btn-square inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--va-border-soft)] text-[var(--va-text-2)] hover:bg-[var(--va-surface-2)]", "aria-label": "إخفاء التنبيه", children: jsx(X, { className: "h-4 w-4" }) })
              ]
            })
          }, "demo-banner"),
          settings.ui?.onboardingSecurityMode === "quick" && !isPasswordSet && jsx(RiskActionPanel, {
            className: "mt-4",
            icon: jsx(Shield, { className: "h-5 w-5" }),
            title: "الحماية مؤجلة",
            description: "يفضل تعيين كلمة مرور المدير قبل استخدام التطبيق يوميًا.",
            actions: jsx("button", {
              type: "button",
              onClick: openSecuritySettings,
              className: "btn btn-ghost btn-xs",
              children: "فتح الأمان"
            })
          }, "security-banner")
        ]
      }, "hero"),

      jsx(ReportStrip, { items: reportItems }, "reportStrip"),

      dailyFocusItems.length > 0 && jsx(DailyFocusPanel, { items: dailyFocusItems, onAction: handleDailyFocusAction }, "dailyFocus"),

      jsx(CommandPanel, {
        title: "إجراءات العمليات",
        description: "المهام الأكثر استخدامًا في اليوم الواحد.",
        icon: jsx(Sparkles, { className: "h-5 w-5 va-accent-text" }),
        children: jsx(QuickActionGrid, { actions: quickActions, className: "lg:grid-cols-3 xl:grid-cols-2" })
      }, "operations"),

      savedViews.length > 0 && jsx(CommandPanel, {
        title: "عروض محفوظة",
        description: "افتح تركيبات الفلاتر المتكررة من المركز مباشرة.",
        icon: jsx(Bookmark, { className: "h-5 w-5 va-accent-text" }),
        actions: jsx("button", { type: "button", onClick: () => goTo("search"), className: "text-sm va-accent-text hover:text-emerald-200", children: "إدارة من البحث" }),
        children: jsx(SavedViewsBar, { views: savedViews, onApply: applySavedView, onRemove: removeView })
      }, "savedViews"),

      dashboardSuggestions.length > 0 && jsx(ArchiveImprovementSuggestions, {
        title: "اقتراحات تحسين الأرشيف",
        suggestions: dashboardSuggestions,
        onAction: handleDashboardSuggestion,
        onFeedback: handleDashboardSuggestionFeedback
      }, "recommendations"),

      usageSuggestions.length > 0 && jsx(SuggestionsPanel, {
        suggestions: usageSuggestions,
        onAction: handleUsageSuggestionAction,
        onDismiss: dismissUsageSuggestion
      }, "usageSuggestions"),

      jsx(CommandPanel, {
        title: "توزيع المحتوى",
        description: "أكثر الأنواع حضورًا في الأرشيف.",
        icon: jsx(BarChart3, { className: "h-5 w-5 text-cyan-300" }),
        actions: jsx("button", { type: "button", onClick: () => goTo("reports"), className: "text-sm va-accent-text hover:text-emerald-200", children: "فتح التقارير" }),
        children: jsx(DistributionBars, { items: distribution, total: stats.total })
      }, "distribution"),

      jsx(CommandPanel, {
        title: "مؤشرات تنظيمية",
        icon: jsx(Tags, { className: "h-5 w-5 text-cyan-300" }),
        children: jsxs("div", {
          className: "grid grid-cols-2 gap-2 text-sm",
          children: [
            jsx(StatusRow, { label: "الأنواع", value: formatNumber(stats.types), icon: jsx(Tags, { className: "h-4 w-4 text-[var(--va-text-muted)]" }) }, "types"),
            jsx(StatusRow, { label: "المجموعات", value: formatNumber(stats.collections), icon: jsx(Database, { className: "h-4 w-4 text-[var(--va-text-muted)]" }) }, "collections"),
            jsx(StatusRow, { label: "الوسوم", value: formatNumber(stats.tags), icon: jsx(Tags, { className: "h-4 w-4 text-[var(--va-text-muted)]" }) }, "tags"),
            jsx(StatusRow, { label: "المفضلة", value: formatNumber(stats.favorites), icon: jsx(Bookmark, { className: "h-4 w-4 text-[var(--va-text-muted)]" }) }, "favorites")
          ]
        })
      }, "orgMetrics"),

      jsx(CommandPanel, {
        title: "آخر المواد",
        description: "اختصار عملي للرجوع إلى أحدث العناصر أو الأكثر قربًا من عملك.",
        icon: jsx(Clock3, { className: "h-5 w-5 va-accent-text" }),
        actions: jsx("button", { type: "button", onClick: () => goTo("archive"), className: "text-sm va-accent-text hover:text-emerald-200", children: "فتح الأرشيف" }),
        children: recentItems.length === 0 ? jsx(UXEmptyState, {
          icon: jsx(Video, { className: "h-7 w-7" }),
          title: "لا توجد مواد بعد",
          description: "أضف فيديو أو استورد ملف نقل، وستتحول هذه المساحة إلى قائمة تشغيل يومية.",
          actions: jsx("button", { type: "button", onClick: () => goTo("add"), className: "btn btn-sm btn-primary", children: "إضافة فيديو" })
        }) : jsx("div", {
          className: "grid gap-2 lg:grid-cols-2",
          children: recentItems.map((item: any) => jsx(ResultPreview, {
            title: item.title || "بدون عنوان",
            meta: getItemTimestamp(item) ? formatDateTime(getItemTimestamp(item)) : "لا يوجد وقت مسجل",
            icon: jsx(Video, { className: "h-4 w-4" }),
            onClick: () => openItem(item)
          }, item.id))
        })
      }, "recentItems"),

      todaysDigestItems.length > 0 && jsx(CommandPanel, {
        title: "اكتشاف اليوم",
        description: "مواد بعيدة عن المراجعة تستحق نظرة سريعة اليوم.",
        icon: jsx(Sparkles, { className: "h-5 w-5 va-accent-text" }),
        actions: jsx("button", { type: "button", onClick: () => goTo("discover"), className: "text-sm va-accent-text hover:text-emerald-200", children: "افتح الاستكشاف" }),
        children: jsx("div", {
          className: "grid gap-2 lg:grid-cols-2",
          children: todaysDigestItems.map((item: any) => jsx(ResultPreview, {
            title: item.title || "بدون عنوان",
            meta: item.discoveryReason || "مادة منسية",
            icon: jsx(Sparkles, { className: "h-4 w-4" }),
            onClick: () => openItem(item)
          }, item.id))
        })
      }, "todaysDigest"),

      jsx(CommandPanel, {
        title: "آخر نشاط",
        description: latestAudit ? "أحدث عملية مسجلة في النظام." : "لا توجد سجلات نشاط بعد.",
        icon: jsx(Activity, { className: "h-5 w-5 text-cyan-300" }),
        children: latestAudit ? jsx(ResultPreview, {
          title: latestAudit.action || "نشاط",
          meta: latestAudit.timestamp || latestAudit.createdAt ? formatDateTime(latestAudit.timestamp || latestAudit.createdAt) : "وقت غير مسجل",
          icon: jsx(FileText, { className: "h-4 w-4" }),
          actions: jsx("button", { type: "button", onClick: () => goTo("history"), className: "text-xs va-accent-text hover:text-emerald-200", children: "السجل" })
        }) : jsx("p", { className: "rounded-xl border border-dashed border-[var(--va-border-soft)] p-4 text-sm leading-6 text-[var(--va-text-muted)]", children: "ستظهر عمليات الإنشاء والتعديل والحذف هنا بعد بدء العمل." })
      }, "recentActivity")
        ]
      })
    ]
  });
}

DashboardPage.pageId = "dashboard";
DashboardPage.pageTitle = "مركز التحكم";
DashboardPage.migrationStatus = "native";

export default DashboardPage;

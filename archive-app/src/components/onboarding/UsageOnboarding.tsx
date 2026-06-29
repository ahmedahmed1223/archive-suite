import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Compass,
  X
} from "lucide-react";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";

import { useAppStore } from "../../stores/index.js";
import {
  computeUsageProgress,
  computeUsageSteps,
  getUsageOnboardingDismissPatch,
  isUsageOnboardingDismissed,
  shouldShowUsageOnboarding
} from "../../features/onboarding/usageOnboarding.js";

// Count distinct, non-empty tags across non-deleted items. Tags live on each
// item rather than a dedicated store, so the count is derived here.
function countDistinctTags(videoItems: any = []) {
  const seen = new Set();
  for (const item of videoItems) {
    if (item?.isDeleted) continue;
    for (const tag of Array.isArray(item?.tags) ? item.tags : []) {
      const normalized = String(tag || "").trim();
      if (normalized) seen.add(normalized);
    }
  }
  return seen.size;
}

/**
 * First-run usage onboarding (§1483).
 *
 * Rendered inside the empty archive state to guide a brand-new user through
 * their first three concrete actions: add an item, create a folder, add
 * tags. Each step links to the relevant page. The panel is dismissible and
 * tracks completion of each step from live counts; the parent persists the
 * dismissal so it never reappears once the user dismisses it or has items.
 *
 * Pure step/progress logic lives in features/onboarding/usageOnboarding.js
 * and is unit-tested there — this component is presentation + wiring only.
 */
function StepRow({ step, index, onNavigate }: any) {
  const StatusIcon = step.done ? CheckCircle2 : Circle;
  const statusClass = step.done ? "va-accent-text" : step.active ? "text-white" : "text-gray-500";
  const rowClass = step.active
    ? "border-[var(--va-action)]/40 va-accent-bg-soft"
    : "border-white/10 va-surface-subtle";
  return jsxs("li", {
    className: `flex items-center gap-3 rounded-xl border p-3 text-right ${rowClass}`,
    children: [
      jsx("span", {
        className: `mt-0.5 shrink-0 ${statusClass}`,
        "aria-hidden": "true",
        children: jsx(StatusIcon, { className: "h-5 w-5" })
      }),
      jsxs("div", {
        className: "min-w-0 flex-1",
        children: [
          jsxs("p", {
            className: `text-sm font-semibold ${step.done ? "text-gray-400 line-through" : "text-white"}`,
            children: [`${index + 1}. `, step.title]
          }),
          jsx("p", { className: "mt-0.5 text-xs leading-5 text-gray-400", children: step.description })
        ]
      }),
      !step.done && jsxs("button", {
        type: "button",
        onClick: () => onNavigate?.(step.pageId),
        className: "shrink-0 inline-flex items-center gap-1 rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-gray-100 hover:bg-white/5 hover:text-white",
        children: [step.cta, jsx(ArrowLeft, { className: "h-3.5 w-3.5" })]
      })
    ]
  }, step.id);
}

export function UsageOnboarding({
  itemCount = 0,
  folderCount = 0,
  tagCount = 0,
  onNavigate,
  onDismiss
}: any) {
  const steps = React.useMemo(
    () => computeUsageSteps({ itemCount, folderCount, tagCount }) as any[],
    [itemCount, folderCount, tagCount]
  );
  const progress = computeUsageProgress(steps as never[]);
  const doneCount = steps.filter((step: any) => step.done).length;

  return jsxs("section", {
    className: "va-card relative rounded-2xl border va-accent-border va-accent-bg-soft p-5 text-right",
    dir: "rtl",
    role: "region",
    "aria-label": "دليل البداية: أضف ونظّم أول عنصر",
    children: [
      jsx("button", {
        type: "button",
        onClick: onDismiss,
        className: "absolute left-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-white/10 hover:text-white",
        "aria-label": "إخفاء دليل البداية",
        children: jsx(X, { className: "h-4 w-4" })
      }),
      jsxs("div", {
        className: "flex items-start gap-3",
        children: [
          jsx("div", {
            className: "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl theme-panel theme-muted va-accent-text",
            children: jsx(Compass, { className: "h-6 w-6" })
          }),
          jsxs("div", {
            className: "min-w-0",
            children: [
              jsx("h2", { className: "text-base font-bold text-white", children: "لنبدأ أرشيفك الأول" }),
              jsx("p", { className: "mt-1 text-sm leading-6 text-gray-300", children: "ثلاث خطوات قصيرة لإضافة أول عنصر وتنظيمه. أكمل ما تريد الآن وتابع البقية لاحقاً." })
            ]
          })
        ]
      }),
      jsxs("div", {
        className: "mt-4",
        children: [
          jsxs("div", {
            className: "mb-1.5 flex items-center justify-between text-xs text-gray-400",
            children: [
              jsxs("span", { children: [doneCount, " من ", steps.length, " مكتملة"] }),
              jsxs("span", { children: [progress, "%"] })
            ]
          }),
          jsx("div", {
            className: "h-1.5 overflow-hidden rounded-full bg-white/10",
            role: "progressbar",
            "aria-valuenow": progress,
            "aria-valuemin": 0,
            "aria-valuemax": 100,
            children: jsx("div", {
              className: "h-full rounded-full bg-[var(--va-action)] transition-all",
              style: { width: `${progress}%` }
            })
          })
        ]
      }),
      jsx("ul", {
        className: "mt-4 space-y-2",
        children: steps.map((step: any, index: any) => jsx(StepRow, { step, index, onNavigate }, step.id))
      })
    ]
  });
}

UsageOnboarding.displayName = "UsageOnboarding";
UsageOnboarding.componentId = "usage-onboarding";
UsageOnboarding.migrationStatus = "native";

/**
 * Store-connected wrapper that decides whether to show the usage onboarding,
 * derives live counts, navigates to the relevant page, and persists dismissal
 * through `settings.ui.usageOnboardingDismissed` via `updateSettings`.
 *
 * Returns null when the archive already has items or the user dismissed it, so
 * callers can render it unconditionally inside the empty state.
 */
export function UsageOnboardingPanel() {
  const {
    videoItems = [],
    folders = [],
    settings = {},
    setCurrentPage,
    updateSettings
  } = useAppStore();

  const itemCount = videoItems.filter((item: any) => !item?.isDeleted).length;
  const folderCount = folders.length;
  const tagCount = countDistinctTags(videoItems);
  const dismissed = isUsageOnboardingDismissed(settings);

  const handleDismiss = React.useCallback(() => {
    updateSettings?.(getUsageOnboardingDismissPatch());
  }, [updateSettings]);

  const handleNavigate = React.useCallback((pageId: any) => {
    if (pageId) setCurrentPage?.(pageId);
  }, [setCurrentPage]);

  if (!shouldShowUsageOnboarding({ itemCount, dismissed, enabled: settings.ui?.usageOnboardingEnabled === true })) return null;

  return jsx(UsageOnboarding, {
    itemCount,
    folderCount,
    tagCount,
    onNavigate: handleNavigate,
    onDismiss: handleDismiss
  });
}

UsageOnboardingPanel.displayName = "UsageOnboardingPanel";

export default UsageOnboarding;

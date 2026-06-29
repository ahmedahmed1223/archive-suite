import {
  Lightbulb,
  X
} from "lucide-react";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";

import { writeAppRoute } from "../../services/router/index.js";
import { useAppStore } from "../../stores/index.js";
import {
  getDismissTipPatch,
  getDismissedTips,
  getTipsForPage,
  shouldShowTip
} from "../../features/guide/contextualTips.js";

/**
 * Minimal, non-intrusive contextual tip surface (§1152).
 *
 * Shows one short, dismissible hint for the current page (derived from the
 * pageManifest `meta.hint`) with a link into the matching help section. Once
 * dismissed it never reappears for that page (persisted in
 * `settings.ui.tipsDismissed`). Returns null when there is no tip or it was
 * already dismissed, so callers can render it unconditionally near a page
 * header.
 *
 * Pure tip/dismissal logic lives in `features/guide/contextualTips.js` and is
 * unit-tested there — this component is presentation + wiring only.
 */
export function ContextualTip({ pageId }: any) {
  const {
    settings = {},
    setCurrentPage,
    setSelectedItemId,
    updateSettings
  } = useAppStore();

  const tips = React.useMemo(() => getTipsForPage(pageId), [pageId]);
  const dismissed = getDismissedTips(settings);
  const tip = tips.find((candidate: any) => shouldShowTip(candidate.id, dismissed));

  const handleDismiss = React.useCallback(() => {
    if (!tip) return;
    updateSettings?.(getDismissTipPatch(tip.id, useAppStore.getState().settings || {}));
  }, [tip, updateSettings]);

  const handleOpenHelp = React.useCallback(() => {
    if (!tip) return;
    setSelectedItemId?.(null);
    if (typeof window !== "undefined") (window as any).__videoArchiveApplyingHistory = true;
    setCurrentPage?.("help");
    if (typeof window !== "undefined") (window as any).__videoArchiveApplyingHistory = false;
    writeAppRoute("help", { section: tip.helpSection || "getting-started" }, settings, false);
  }, [setCurrentPage, setSelectedItemId, settings, tip]);

  if (!tip) return null;

  return jsxs("div", {
    // Responsive surface:
    //  - gap/padding scale with viewport so narrow phones don't waste room
    //  - text-start (logical) + dir="rtl" keep alignment correct in RTL
    //  - max-w-prose caps reading width on very wide screens
    className: "va-card-subtle mt-3 flex max-w-prose items-start gap-2 rounded-xl border va-accent-border va-accent-bg-soft p-2.5 text-start sm:gap-3 sm:p-3",
    dir: "rtl",
    role: "note",
    "aria-label": "تلميح سياقي",
    children: [
      jsx("span", {
        className: "mt-0.5 shrink-0 text-amber-300",
        "aria-hidden": "true",
        children: jsx(Lightbulb, { className: "h-4 w-4" })
      }),
      jsxs("div", {
        className: "min-w-0 flex-1",
        children: [
          // break-words stops long URL-like or compound Arabic tokens from
          // pushing the card wider than its container on narrow screens.
          jsx("p", { className: "va-bidi-text text-sm leading-6 text-gray-200 break-words", dir: "rtl", children: tip.body }),
          jsx("button", {
            type: "button",
            onClick: handleOpenHelp,
            className: "va-accent-text mt-1 inline-flex min-h-9 items-center text-xs font-medium hover:underline focus-visible:outline-none focus-visible:underline",
            children: "اعرف المزيد في المساعدة"
          })
        ]
      }),
      // Touch-comfortable dismiss target: ≥36px on mobile, slightly tighter
      // 32px on sm+ to keep desktop densities tidy.
      jsx("button", {
        type: "button",
        onClick: handleDismiss,
        className: "shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 sm:h-8 sm:w-8",
        "aria-label": "إخفاء التلميح",
        children: jsx(X, { className: "h-4 w-4 sm:h-3.5 sm:w-3.5" })
      })
    ]
  });
}

ContextualTip.displayName = "ContextualTip";
ContextualTip.componentId = "contextual-tip";
ContextualTip.migrationStatus = "native";

export default ContextualTip;

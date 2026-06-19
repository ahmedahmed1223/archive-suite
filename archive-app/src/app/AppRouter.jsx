/**
 * AppRouter - resolves the current page from PAGE_COMPONENTS and renders it.
 *
 * Responsibilities:
 *   - Read currentPage from the app store
 *   - Look up the matching lazy component from PAGE_COMPONENTS
 *   - Render the sidebar + main content layout
 *   - Handle page transition animation via framer-motion
 *   - Wrap the page in a Suspense boundary (all pages are already React.lazy)
 *
 * Layout structure (RTL):
 *   AppSidebar | <main> PageContextBar + <Suspense> PageComponent </Suspense>
 */
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { motion } from "framer-motion";
import { useAppStore } from "../stores/index.js";
import { useTheme } from "../theme/useTheme.js";
import { PAGE_COMPONENTS } from "./pageRegistry.js";
import { getPageContextMeta } from "./pageMeta.js";
import { DashboardSkeleton } from "./shell/ShellParts.jsx";
import { ErrorBoundary } from "../components/common/ErrorBoundary.jsx";
import { OfflineBanner } from "../components/offline/OfflineBanner.jsx";
import { applyCustomDaisyTheme, getStoredCustomDaisyTheme } from "../features/theme/customDaisyTheme.js";
import { applyDaisyTheme, storeDaisyTheme } from "../features/theme/daisyThemes.js";
import { THEME_MODE, getStoredSchedule, resolveScheduledTheme, systemPrefersDark } from "../features/theme/themeSchedule.js";
import {
  PageContextBar as AppPageContextBar,
  Sidebar as AppSidebar,
} from "../components/navigation/index.js";
import { MobileShell } from "../components/layout/MobileShell.jsx";
import { CopilotPanel } from "../components/copilot/CopilotPanel.jsx";
import { Bot } from "lucide-react";

export function AppRouter() {
  const currentPage = useAppStore((s) => s.currentPage);
  const settings = useAppStore((s) => s.settings);
  const copilotOpen = useAppStore((s) => s.copilotOpen);
  const toggleCopilot = useAppStore((s) => s.toggleCopilot);
  // useTheme() is invoked for its theme-resolution side effects; the resolved
  // value no longer drives a hardcoded background (the shell now uses --va-bg).
  useTheme();

  const PageComponent =
    PAGE_COMPONENTS[currentPage] || PAGE_COMPONENTS.dashboard;
  const currentPageTitle =
    getPageContextMeta(currentPage)?.title || "أرشيف الفيديو";
  const daisyTheme = settings.ui?.daisyTheme || "business";
  const customDaisyTheme = settings.ui?.customDaisyTheme;

  React.useEffect(() => {
    const schedule = getStoredSchedule();
    const themeToApply = schedule.mode === THEME_MODE.AUTO
      ? resolveScheduledTheme(schedule, systemPrefersDark())
      : daisyTheme;
    applyDaisyTheme(themeToApply);
    storeDaisyTheme(daisyTheme);
    applyCustomDaisyTheme(customDaisyTheme || getStoredCustomDaisyTheme());
  }, [daisyTheme, customDaisyTheme]);

  return jsxs("div", {
    dir: "rtl",
    // Token-driven shell background works in both themes; resolvedTheme retained
    // for downstream theme wiring but no longer drives a hardcoded hex.
    className: "va-app-shell flex min-h-screen text-right bg-[var(--va-bg)] text-[var(--va-text)]",
    "data-density":
      settings.ui?.visualDensity === "compact" ? "compact" : "comfortable",
    "data-accent": settings.accentColor || "teal",
    "data-font-scale": settings.ui?.fontScale || "normal",
    "data-motion": settings.ui?.motionLevel || "full",
    "data-card-style": settings.ui?.cardStyle || "filled",
    "data-daisy-theme": daisyTheme,
    children: [
      jsx(OfflineBanner, {}),
      jsx("a", {
        href: "#main-content",
        className: "va-skip-link",
        children: "تخطي إلى المحتوى الرئيسي",
      }),
      jsx(AppSidebar, {}),
      jsx(MobileShell, {
        children: jsx("main", {
        id: "main-content",
        tabIndex: -1,
        dir: "rtl",
        className:
          "flex-1 min-w-0 overflow-y-auto overflow-x-hidden max-h-screen text-right pt-16 pb-[calc(56px+env(safe-area-inset-bottom,0px))] md:pt-0 md:pb-0",
        role: "main",
        children: jsx(ErrorBoundary, {
          children: jsxs(
            motion.div,
            {
              initial: { opacity: 0, y: 8 },
              animate: { opacity: 1, y: 0 },
              exit: { opacity: 0, y: -8 },
              transition: { duration: 0.2 },
              className: "min-h-screen",
              children: [
                jsx("h1", {
                  className: "sr-only",
                  children: currentPageTitle,
                }),
                jsx(AppPageContextBar, { currentPage, currentPageTitle }),
                jsx(React.Suspense, {
                  fallback: jsx(DashboardSkeleton, { compact: true }),
                  children: jsx(PageComponent, {}),
                }),
              ],
            },
            currentPage
          ),
        }),
      }),
      }),
      jsx(CopilotPanel, {}),
      !copilotOpen &&
        jsx("button", {
          type: "button",
          onClick: toggleCopilot,
          "aria-label": "فتح المساعد الذكي",
          title: "المساعد الذكي",
          className:
            "va-copilot-fab fixed bottom-[calc(64px+env(safe-area-inset-bottom,0px))] left-4 z-[65] inline-flex h-12 w-12 items-center justify-center rounded-[var(--va-radius-full)] bg-emerald-500 text-[var(--va-text-inverse)] shadow-[var(--va-elev-popover)] transition-colors hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/55 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--va-bg)] md:bottom-6",
          children: jsx(Bot, { className: "h-5 w-5" }),
        }),
    ],
  });
}

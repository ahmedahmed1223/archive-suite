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
import { Bot, Compass } from "lucide-react";

function PageLoadingFallback({ title }) {
  return (
    <div
      dir="rtl"
      role="status"
      aria-live="polite"
      aria-label={`تحميل ${title || "الصفحة"}`}
      className="space-y-4 p-4 sm:p-6"
    >
      <div className="rounded-[var(--va-radius-xl)] border border-[var(--va-border-soft)] bg-[var(--va-elevated)] p-5 shadow-[var(--va-elev-1)]">
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 animate-pulse rounded-[var(--va-radius-md)] bg-[var(--va-surface-2)]" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[var(--va-text)]">تحميل {title || "الصفحة"}</p>
            <div className="mt-2 h-2 w-48 max-w-full overflow-hidden rounded-full bg-[var(--va-surface-2)]">
              <span className="block h-full w-2/5 animate-pulse rounded-full bg-emerald-500/60" />
            </div>
          </div>
        </div>
      </div>
      <DashboardSkeleton compact />
    </div>
  );
}

/**
 * Token-styled fallback shown when currentPage does not resolve to a known
 * page. Replaces the silent dashboard fallback so an unknown route is
 * communicated instead of masquerading as the dashboard.
 */
function UnknownPageScreen({ onBackToDashboard }) {
  return jsx("div", {
    dir: "rtl",
    role: "alert",
    className:
      "flex min-h-[60vh] flex-col items-center justify-center gap-5 p-6 text-center",
    children: jsxs("div", {
      className:
        "w-full max-w-md rounded-[var(--va-radius-xl)] border border-[var(--va-border-soft)] bg-[var(--va-elevated)] p-8 shadow-[var(--va-elev-2)]",
      children: [
        jsx("span", {
          className:
            "mx-auto flex h-14 w-14 items-center justify-center rounded-[var(--va-radius-lg)] border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] text-[var(--va-text-muted)]",
          children: jsx(Compass, { className: "h-7 w-7" }),
        }),
        jsx("h2", {
          className: "mt-5 text-xl font-bold text-[var(--va-text)]",
          children: "الصفحة غير موجودة",
        }),
        jsx("p", {
          className: "mt-2 text-sm leading-7 text-[var(--va-text-muted)]",
          children:
            "تعذر العثور على هذه الصفحة. قد يكون الرابط قديمًا أو غير صحيح.",
        }),
        jsx("button", {
          type: "button",
          onClick: onBackToDashboard,
          className:
            "mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-[var(--va-radius-md)] border border-transparent bg-emerald-500 px-5 text-sm font-medium text-[var(--va-text-inverse)] transition-colors hover:bg-emerald-600 active:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/55 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--va-elevated)]",
          children: "العودة إلى مركز التحكم",
        }),
      ],
    }),
  });
}

export function AppRouter() {
  const currentPage = useAppStore((s) => s.currentPage);
  const settings = useAppStore((s) => s.settings);
  const copilotOpen = useAppStore((s) => s.copilotOpen);
  const toggleCopilot = useAppStore((s) => s.toggleCopilot);
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);
  const mainRef = React.useRef(null);
  // useTheme() is invoked for its theme-resolution side effects; the resolved
  // value no longer drives a hardcoded background (the shell now uses --va-bg).
  useTheme();

  const isKnownPage = Boolean(PAGE_COMPONENTS[currentPage]);
  const PageComponent = PAGE_COMPONENTS[currentPage] || PAGE_COMPONENTS.dashboard;
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

  React.useEffect(() => {
    mainRef.current?.focus?.({ preventScroll: true });
  }, [currentPage]);

  return jsxs("div", {
    dir: "rtl",
    // Token-driven shell background works in both themes; resolvedTheme retained
    // for downstream theme wiring but no longer drives a hardcoded hex.
    className: "va-app-shell flex min-h-screen text-start bg-[var(--va-bg)] text-[var(--va-text)]",
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
        ref: mainRef,
        id: "main-content",
        tabIndex: -1,
        dir: "rtl",
        className:
          "flex-1 min-w-0 overflow-y-auto overflow-x-hidden max-h-screen text-start pt-16 pb-[calc(56px+env(safe-area-inset-bottom,0px))] md:pt-0 md:pb-0",
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
                currentPage !== "projects"
                  ? jsx(AppPageContextBar, { currentPage, currentPageTitle })
                  : null,
                isKnownPage
                  ? jsx(React.Suspense, {
                      fallback: jsx(PageLoadingFallback, { title: currentPageTitle }),
                      children: jsx(PageComponent, {}),
                    })
                  : jsx(UnknownPageScreen, {
                      onBackToDashboard: () => setCurrentPage?.("dashboard"),
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

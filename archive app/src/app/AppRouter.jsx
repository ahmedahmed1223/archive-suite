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
import { OfflineBanner } from "../components/common/OfflineBanner.jsx";
import {
  PageContextBar as AppPageContextBar,
  Sidebar as AppSidebar,
} from "../components/navigation/index.js";
import { BottomTabBar } from "../components/layout/BottomTabBar.jsx";

export function AppRouter() {
  const currentPage = useAppStore((s) => s.currentPage);
  const settings = useAppStore((s) => s.settings);
  const { resolvedTheme } = useTheme();

  const PageComponent =
    PAGE_COMPONENTS[currentPage] || PAGE_COMPONENTS.dashboard;
  const currentPageTitle =
    getPageContextMeta(currentPage)?.title || "أرشيف الفيديو";

  return jsxs("div", {
    dir: "rtl",
    className: `va-app-shell flex min-h-screen text-right ${
      resolvedTheme === "dark" ? "bg-gray-950" : "bg-white"
    }`,
    "data-density":
      settings.ui?.visualDensity === "compact" ? "compact" : "comfortable",
    "data-accent": settings.accentColor || "teal",
    "data-font-scale": settings.ui?.fontScale || "normal",
    "data-motion": settings.ui?.motionLevel || "full",
    "data-card-style": settings.ui?.cardStyle || "filled",
    children: [
      jsx(OfflineBanner, {}),
      jsx("a", {
        href: "#main-content",
        className: "va-skip-link",
        children: "تخطي إلى المحتوى الرئيسي",
      }),
      jsx(AppSidebar, {}),
      jsx(BottomTabBar, {}),
      jsx("main", {
        id: "main-content",
        tabIndex: -1,
        dir: "rtl",
        className:
          "flex-1 min-w-0 overflow-y-auto overflow-x-hidden max-h-screen text-right pt-0 sm:pt-16 pb-[calc(56px+env(safe-area-inset-bottom,0px))] md:pt-0 md:pb-0",
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
    ],
  });
}

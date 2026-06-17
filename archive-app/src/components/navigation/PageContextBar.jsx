import {
  writeAppRoute
} from "../../services/router/index.js";
import {
  useAppStore
} from "../../stores/index.js";
import {
  ArrowRight,
  Archive,
  CirclePlus,
  CircleQuestionMark,
  Download,
  HardDrive,
  LayoutGrid,
  MoreHorizontal,
  Search,
  Upload
} from "lucide-react";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";

import { ContextMenu } from "../common/ContextMenu.jsx";
import { ContextualTip } from "../guide/ContextualTip.jsx";
import { getPageContextBarModel } from "./viewModel.js";
import { ServerStatusBadge } from "../../features/server-status/ServerStatusBadge.jsx";
import { Breadcrumb } from "./Breadcrumb.jsx";
import { useBreadcrumbs } from "../../hooks/useBreadcrumbs.js";


function ContextButton({ children, onClick, variant = "secondary", className = "", ariaLabel }) {
  const classes = variant === "primary"
    ? "bg-primary text-primary-content"
    : "va-secondary-button border-white/10 text-gray-300 hover:bg-white/5 hover:text-white";

  return jsx("button", {
    type: "button",
    onClick,
    "aria-label": ariaLabel,
    className: `inline-flex min-h-9 items-center justify-center gap-2 whitespace-nowrap rounded-xl border px-3 py-1.5 text-sm font-medium transition-colors ${classes} ${className}`,
    children
  });
}

export function PageContextBar({ currentPage, currentPageTitle }) {
  const {
    setCurrentPage,
    setSelectedItemId,
    settings,
    updateSettings,
    videoItems,
    sqliteError
  } = useAppStore();
  const [overflowMenu, setOverflowMenu] = React.useState(null);
  const meta = getPageContextBarModel(currentPage, currentPageTitle);
  const activeCount = videoItems.filter((item) => !item.isDeleted).length;
  const breadcrumbs = useBreadcrumbs(currentPage);

  const navigateToCrumb = (crumb) => {
    setSelectedItemId(null);
    setCurrentPage(crumb.id);
  };

  const goToPage = (page) => {
    setSelectedItemId(null);
    setCurrentPage(page);
  };

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
      return;
    }
    goToPage("dashboard");
  };

  const openHelp = () => {
    setSelectedItemId(null);
    if (typeof window !== "undefined") window.__videoArchiveApplyingHistory = true;
    setCurrentPage("help");
    if (typeof window !== "undefined") window.__videoArchiveApplyingHistory = false;
    writeAppRoute("help", { section: meta.helpSection || "getting-started" }, settings, false);
  };

  const openArchiveImport = () => {
    const params = new URLSearchParams([["import", "1"]]);
    setSelectedItemId(null);
    if (typeof window !== "undefined") window.__videoArchiveApplyingHistory = true;
    setCurrentPage("archive");
    if (typeof window !== "undefined") window.__videoArchiveApplyingHistory = false;
    writeAppRoute("archive", { params }, settings, false);
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent("videoarchive:archive-import-open"));
      }, 0);
    }
  };

  const openDataTab = async (tab) => {
    await updateSettings?.({ ui: { ...(settings.ui || {}), lastDataCenterTab: tab } });
    goToPage("backup");
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("videoarchive:data-tab", { detail: { tab } }));
    }
  };

  const primaryAction = (() => {
    if (["archive", "dashboard", "search"].includes(currentPage)) {
      return { label: "إضافة فيديو", Icon: CirclePlus, onClick: () => goToPage("add") };
    }
    if (currentPage === "backup") {
      return { label: "نقل لجهاز آخر", Icon: Download, onClick: () => openDataTab("transfer") };
    }
    if (currentPage === "add" || currentPage === "detail") {
      return { label: "فتح الأرشيف", Icon: Archive, onClick: () => goToPage("archive") };
    }
    if (currentPage === "help") {
      return { label: "مركز التحكم", Icon: LayoutGrid, onClick: () => goToPage("dashboard") };
    }
    return { label: "فتح الأرشيف", Icon: Archive, onClick: () => goToPage("archive") };
  })();

  const secondaryActions = [
    currentPage !== "dashboard" && { label: "رجوع", Icon: ArrowRight, onClick: goBack },
    currentPage !== "archive" && { label: "الأرشيف", Icon: Archive, onClick: () => goToPage("archive") },
    currentPage === "archive" && { label: "استيراد ملفات", Icon: Upload, onClick: openArchiveImport },
    currentPage !== "search" && { label: "بحث", Icon: Search, onClick: () => goToPage("search") },
    currentPage !== "backup" && { label: "نقل ونسخ", Icon: HardDrive, onClick: () => openDataTab("transfer") }
  ].filter(Boolean);
  const desktopSecondaryActions = secondaryActions.slice(0, 3);
  const overflowActions = [
    ...secondaryActions,
    { label: "مساعدة", Icon: CircleQuestionMark, onClick: openHelp }
  ];

  const openOverflowMenu = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setOverflowMenu({
      x: rect.left,
      y: rect.bottom + 8,
      title: "إجراءات الصفحة",
      heading: meta.title || currentPageTitle,
      items: overflowActions.map((action) => ({
        id: action.label,
        label: action.label,
        icon: action.Icon,
        onSelect: action.onClick
      }))
    });
  };

  return jsx("header", {
    className: "va-context-bar",
    role: "banner",
    dir: "rtl",
    children: jsxs(React.Fragment, {
      children: [
        // DaisyUI navbar for semantic structure; va-context-bar custom styles intact
        jsxs("div", {
          className: "navbar va-context-bar-inner !min-h-0 !p-0",
          style: { padding: "0.85rem var(--va-page-gutter)", gap: "1rem" },
          children: [
            // navbar-start = title area (RTL: visual right side)
            jsxs("div", {
              className: "navbar-start va-context-title min-w-0 flex-1 !block",
              children: [
                jsxs("div", {
                  className: "mb-1 flex flex-wrap items-center gap-2 text-xs text-gray-500",
                  children: [
                    breadcrumbs.length > 1
                      ? jsx(Breadcrumb, { crumbs: breadcrumbs, onNavigate: navigateToCrumb })
                      : jsx("span", { className: "truncate", children: meta.breadcrumb }),
                    jsx("span", {
                      className: "va-number-badge rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-gray-400",
                      children: `${activeCount} عنصر`
                    }),
                    sqliteError ? jsx("span", {
                      className: "rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-200",
                      children: "تحقق التخزين"
                    }) : jsx(ServerStatusBadge, {})
                  ]
                }),
                jsx("h2", { className: "truncate text-lg font-bold text-white sm:text-xl", children: meta.title || currentPageTitle }),
                meta.hint && jsx("p", { className: "mt-1 line-clamp-2 text-sm leading-relaxed text-gray-400", children: meta.hint }),
                jsx(ContextualTip, { pageId: currentPage })
              ]
            }),
            // navbar-end = action buttons (RTL: visual left side) — hidden on mobile
            jsxs("div", {
              className: "navbar-end hidden flex-wrap justify-end gap-2 md:flex",
              children: [
                jsxs(ContextButton, {
                  variant: "primary",
                  onClick: primaryAction.onClick,
                  children: [jsx(primaryAction.Icon, { className: "h-4 w-4" }), primaryAction.label]
                }, "primary"),
                desktopSecondaryActions.map((action) => jsxs(ContextButton, {
                  onClick: action.onClick,
                  children: [jsx(action.Icon, { className: "h-4 w-4" }), action.label]
                }, action.label)),
                jsxs(ContextButton, {
                  onClick: openHelp,
                  children: [
                    jsx(CircleQuestionMark, { className: "h-4 w-4" }),
                    "مساعدة"
                  ]
                }, "help")
              ]
            }),
            // Mobile: primary action + overflow — visible only on small screens
            jsxs("div", {
              className: "navbar-end flex shrink-0 items-center gap-2 md:hidden",
              children: [
                jsxs(ContextButton, {
                  variant: "primary",
                  onClick: primaryAction.onClick,
                  className: "min-w-0 flex-1 px-3",
                  children: [jsx(primaryAction.Icon, { className: "h-4 w-4 shrink-0" }), jsx("span", { className: "truncate", children: primaryAction.label })]
                }, "mobile-primary"),
                jsx(ContextButton, {
                  onClick: openOverflowMenu,
                  ariaLabel: "المزيد من إجراءات الصفحة",
                  className: "w-11 px-0",
                  children: jsx(MoreHorizontal, { className: "h-4 w-4" })
                }, "mobile-overflow")
              ]
            })
          ]
        }),
        jsx(ContextMenu, { menu: overflowMenu, onClose: () => setOverflowMenu(null) })
      ]
    })
  });
}

PageContextBar.displayName = "PageContextBar";
PageContextBar.componentId = "page-context-bar";
PageContextBar.migrationStatus = "native";

export default PageContextBar;

import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { motion } from "framer-motion";
import { LayoutGrid, ExternalLink } from "lucide-react";

import { PageHero } from "../components/ui/V1Primitives.jsx";
import { EmptyState } from "../components/common/EmptyState.jsx";
import { useAppStore } from "../stores/index.js";
import { formatNumber } from "../utils/formatting.js";
import { buildKanbanColumns, moveItemStatus } from "../features/views/kanbanModel.js";
import { getAvailableTransitions } from "../features/archive/itemStatus.js";

// Column accent classes keyed by the STATE_META color from itemStatus.js.
const COLUMN_ACCENT = {
  gray: "border-gray-500/30",
  blue: "border-blue-500/30",
  amber: "border-amber-500/30",
  emerald: "border-emerald-500/30",
  green: "border-green-500/30",
  zinc: "border-zinc-500/30",
};

function ItemCard({ item, transitions, onOpen, onMove }) {
  return jsxs("div", {
    className: "rounded-xl border border-white/10 bg-gray-950/40 p-2.5 hover:border-white/20",
    children: [
      jsxs("button", {
        type: "button",
        onClick: () => onOpen(item),
        className: "flex w-full items-start justify-between gap-2 text-right",
        children: [
          jsx("p", { className: "min-w-0 truncate text-sm font-semibold text-white", dir: "auto", children: item.title || "بدون عنوان" }),
          jsx(ExternalLink, { className: "mt-0.5 h-4 w-4 shrink-0 text-gray-500" })
        ]
      }),
      transitions.length > 0 ? jsxs("label", {
        className: "mt-2 flex items-center gap-1.5 text-[11px] text-gray-500",
        children: [
          "نقل إلى:",
          jsxs("select", {
            value: "",
            onChange: (event) => { if (event.target.value) onMove(item, event.target.value); },
            "aria-label": `نقل ${item.title || "العنصر"} إلى حالة أخرى`,
            className: "rounded-lg border border-white/10 bg-gray-900 px-2 py-1 text-xs text-gray-200",
            children: [
              jsx("option", { value: "", children: "—" }),
              ...transitions.map((option) => jsx("option", { value: option.to, children: option.label }, option.to))
            ]
          })
        ]
      }) : null
    ]
  });
}

export function KanbanPage() {
  const {
    videoItems = [],
    currentUser = null,
    setCurrentPage,
    setSelectedItemId,
    updateVideoItem,
    showToast
  } = useAppStore();

  const role = currentUser?.role || "viewer";
  const columns = React.useMemo(() => buildKanbanColumns(videoItems), [videoItems]);
  const total = React.useMemo(
    () => columns.reduce((sum, column) => sum + column.items.length, 0),
    [columns]
  );

  const openItem = React.useCallback((item) => {
    setSelectedItemId?.(item.id);
    setCurrentPage?.("detail");
  }, [setSelectedItemId, setCurrentPage]);

  const moveItem = React.useCallback(async (item, status) => {
    try {
      await updateVideoItem?.(moveItemStatus(item, status));
    } catch (error) {
      showToast?.(error?.message || "تعذّر تغيير حالة العنصر.", "error");
    }
  }, [updateVideoItem, showToast]);

  return jsxs(motion.div, {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.2 },
    className: "va-page-shell space-y-6 p-4 sm:p-6",
    dir: "rtl",
    children: [
      jsx(PageHero, {
        icon: jsx(LayoutGrid, { className: "h-6 w-6 va-accent-text" }),
        title: "لوحة الحالة",
        description: "عناصر الأرشيف موزّعة على أعمدة حسب حالة سير العمل — انقر بطاقة لفتح تفاصيلها أو انقلها لحالة أخرى."
      }),
      total === 0 ? jsx("div", {
        className: "va-card rounded-2xl border border-dashed border-white/10 bg-gray-900/35",
        children: jsx(EmptyState, {
          icon: jsx(LayoutGrid, { className: "h-16 w-16" }),
          title: "لا عناصر بعد",
          description: "أضف عناصر إلى الأرشيف وستظهر هنا موزّعة على أعمدة الحالة."
        })
      }) : jsx("section", {
        className: "flex gap-3 overflow-x-auto pb-2",
        role: "list",
        "aria-label": "أعمدة الحالة",
        children: columns.map((column) => jsxs("div", {
          role: "listitem",
          className: `flex min-w-[15rem] max-w-[18rem] shrink-0 flex-col rounded-2xl border ${COLUMN_ACCENT[column.color] || COLUMN_ACCENT.gray} bg-gray-900/40 p-3`,
          children: [
            jsxs("header", { className: "mb-3 flex items-center justify-between", children: [
              jsx("h2", { className: "text-sm font-bold text-white", children: column.label }),
              jsx("span", { className: "rounded-full bg-white/5 px-2 py-0.5 text-xs text-gray-400", children: formatNumber(column.items.length) })
            ] }),
            column.items.length === 0 ? jsx("p", {
              className: "rounded-xl border border-dashed border-white/10 px-3 py-6 text-center text-xs text-gray-600",
              children: "لا عناصر"
            }) : jsx("div", {
              className: "space-y-2",
              children: column.items.slice(0, 200).map((item) => jsx(ItemCard, {
                item,
                transitions: getAvailableTransitions(item, role),
                onOpen: openItem,
                onMove: moveItem
              }, item.id))
            })
          ]
        }, column.status))
      })
    ]
  });
}

KanbanPage.pageId = "kanban";
KanbanPage.migrationStatus = "native";

export default KanbanPage;

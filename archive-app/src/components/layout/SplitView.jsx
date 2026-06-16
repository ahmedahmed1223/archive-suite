/**
 * SplitView — VS-Code-style resizable multi-pane layout (§17.5).
 *
 * - Up to 3 panes, each showing a different page
 * - Drag handles to resize (min 15% per pane)
 * - Persists layout to localStorage via usePaneLayout
 * - Collapses to single pane on mobile (hidden on small viewports)
 *
 * Usage:
 *   <SplitView initialPage="archive" />
 */
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { X, Plus, ChevronDown } from "lucide-react";
import { usePaneLayout } from "../../hooks/usePaneLayout.js";
import { PAGE_COMPONENTS } from "../../app/pageRegistry.js";
import { getPageContextMeta } from "../../app/pageMeta.js";

const HANDLE_WIDTH_PX = 6;

export function SplitView({ initialPage = "archive" }) {
  const { panes, openPane, closePane, setPage, resize } = usePaneLayout(initialPage);

  return jsx("div", {
    className: "flex h-full w-full overflow-hidden",
    children: panes.map((pane, idx) =>
      jsxs(React.Fragment, {
        key: pane.id,
        children: [
          jsx(PaneFrame, {
            pane,
            canClose:     panes.length > 1,
            canAddMore:   panes.length < 3 && idx === panes.length - 1,
            onClose:      () => closePane(pane.id),
            onOpenSplit:  (pageId) => openPane(pageId),
            onChangePage: (pageId) => setPage(pane.id, pageId),
          }),
          idx < panes.length - 1 && jsx(ResizeHandle, {
            paneId:   pane.id,
            onResize: (deltaPct) => resize(pane.id, deltaPct),
          }),
        ],
      })
    ),
  });
}

// ── PaneFrame ─────────────────────────────────────────────────────────────────

function PaneFrame({ pane, canClose, canAddMore, onClose, onOpenSplit, onChangePage }) {
  const pageMeta = getPageContextMeta(pane.pageId) || {};
  const PageComp = PAGE_COMPONENTS[pane.pageId] || PAGE_COMPONENTS.dashboard;

  return jsx("div", {
    className: "flex flex-col min-w-0 overflow-hidden",
    style: { flexBasis: `${pane.sizePct}%`, flexShrink: 0, flexGrow: 0 },
    children: jsxs("div", {
      className: "flex flex-col h-full",
      children: [
        jsxs("div", {
          className: "flex items-center gap-2 px-3 py-1.5 border-b border-base-300 bg-base-200 min-h-[36px]",
          children: [
            jsx(PagePicker, {
              currentPageId: pane.pageId,
              onSelect:      onChangePage,
            }),
            jsx("span", {
              className: "text-xs text-base-content/60 truncate flex-1",
              children: pageMeta.title || pane.pageId,
            }),
            canAddMore && jsx("button", {
              type: "button",
              className: "btn btn-ghost btn-xs",
              title: "فتح صفحة جانبية",
              onClick: () => onOpenSplit(pane.pageId),
              children: jsx(Plus, { className: "h-3.5 w-3.5" }),
            }),
            canClose && jsx("button", {
              type: "button",
              className: "btn btn-ghost btn-xs",
              title: "إغلاق هذا الجزء",
              onClick: onClose,
              children: jsx(X, { className: "h-3.5 w-3.5" }),
            }),
          ],
        }),
        jsx("div", {
          className: "flex-1 overflow-y-auto overflow-x-hidden",
          children: jsx(React.Suspense, {
            fallback: jsx("div", { className: "skeleton h-full w-full rounded-none" }),
            children: jsx(PageComp, {}),
          }),
        }),
      ],
    }),
  });
}

// ── PagePicker ────────────────────────────────────────────────────────────────

const PICKABLE_PAGES = [
  { id: "archive",   label: "الأرشيف" },
  { id: "dashboard", label: "الرئيسية" },
  { id: "search",    label: "البحث" },
  { id: "discover",  label: "اكتشف" },
];

function PagePicker({ currentPageId, onSelect }) {
  return jsxs("details", {
    className: "dropdown",
    children: [
      jsx("summary", {
        className: "btn btn-ghost btn-xs gap-1 min-w-0",
        children: jsx(ChevronDown, { className: "h-3 w-3 opacity-60" }),
      }),
      jsx("ul", {
        className: "dropdown-content menu menu-xs bg-base-200 rounded-box shadow-lg z-50 w-36",
        children: PICKABLE_PAGES.map(({ id, label }) =>
          jsx("li", {
            key: id,
            children: jsx("a", {
              className: id === currentPageId ? "active" : "",
              onClick: (e) => {
                e.currentTarget.closest("details")?.removeAttribute("open");
                onSelect(id);
              },
              children: label,
            }),
          })
        ),
      }),
    ],
  });
}

// ── ResizeHandle ──────────────────────────────────────────────────────────────

function ResizeHandle({ onResize }) {
  const dragging   = React.useRef(false);
  const startX     = React.useRef(0);
  const containerW = React.useRef(1);

  function onPointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current   = true;
    startX.current     = e.clientX;
    containerW.current = e.currentTarget.closest(".flex")?.offsetWidth || window.innerWidth;
  }

  function onPointerMove(e) {
    if (!dragging.current) return;
    const dx       = e.clientX - startX.current;
    startX.current = e.clientX;
    onResize((dx / containerW.current) * 100);
  }

  function onPointerUp(e) {
    e.currentTarget.releasePointerCapture(e.pointerId);
    dragging.current = false;
  }

  return jsx("div", {
    role: "separator",
    "aria-orientation": "vertical",
    tabIndex: 0,
    className: [
      "flex-shrink-0 cursor-col-resize select-none touch-none",
      "bg-base-300 hover:bg-primary/40 active:bg-primary/60 transition-colors",
    ].join(" "),
    style: { width: `${HANDLE_WIDTH_PX}px` },
    onPointerDown,
    onPointerMove,
    onPointerUp,
  });
}

export default SplitView;

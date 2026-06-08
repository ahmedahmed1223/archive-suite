import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { Workflow, ZoomIn, ZoomOut, Maximize2, Search, X } from "lucide-react";

import { useAppStore } from "../stores/index.js";
import { MotionPage, PageHero } from "../components/ui/V1Primitives.jsx";
import { EmptyState } from "../components/common/EmptyState.jsx";
import { formatNumber } from "../utils/formatting.js";

const MAX_NODES = 60;
const SIZE = 1000;
const CENTER = SIZE / 2;
const RADIUS = SIZE / 2 - 80;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;

function normalizeTag(tag) {
  return String(tag || "").trim().toLowerCase();
}

/**
 * Build a relationship graph: nodes = active items (capped, filtered by type
 * if provided), edges connect items sharing tags (and a bonus for same type).
 * Weight = shared tags x2 + same-type. Degree drives node size. Circular
 * layout — no force simulation, no d3/recharts (bundle discipline).
 */
function buildGraph(videoItems, typeById, { typeFilter = "all" } = {}) {
  const active = videoItems.filter((item) => !item.isDeleted);
  const filtered = typeFilter === "all" ? active : active.filter((item) => item.type === typeFilter);
  const items = filtered.slice(0, MAX_NODES);
  const tagSets = items.map((item) => new Set((item.tags || []).map(normalizeTag).filter(Boolean)));
  const degree = new Map();
  const edges = [];
  for (let a = 0; a < items.length; a += 1) {
    if (!tagSets[a].size) continue;
    for (let b = a + 1; b < items.length; b += 1) {
      let shared = 0;
      tagSets[b].forEach((tag) => { if (tagSets[a].has(tag)) shared += 1; });
      if (shared <= 0) continue;
      const sameType = Boolean(items[a].type) && items[a].type === items[b].type;
      edges.push({ a, b, shared, weight: shared * 2 + (sameType ? 1 : 0) });
      degree.set(a, (degree.get(a) || 0) + 1);
      degree.set(b, (degree.get(b) || 0) + 1);
    }
  }
  const count = items.length || 1;
  const nodes = items.map((item, index) => {
    const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
    const deg = degree.get(index) || 0;
    return {
      index,
      item,
      x: CENTER + RADIUS * Math.cos(angle),
      y: CENTER + RADIUS * Math.sin(angle),
      degree: deg,
      r: 10 + Math.min(18, deg * 2.5),
      color: typeById.get(item.type)?.color || "#6366f1"
    };
  });
  const maxWeight = edges.reduce((max, edge) => Math.max(max, edge.weight), 1);
  return { nodes, edges, maxWeight, total: items.length, truncated: filtered.length > MAX_NODES };
}

function GraphToolbar({ zoom, onZoomIn, onZoomOut, onReset, typeFilter, onTypeFilter, search, onSearch, types, statsLabel, truncatedLabel }) {
  return jsxs("div", {
    className: "mb-3 flex flex-wrap items-center justify-between gap-2",
    children: [
      jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
        jsxs("label", { className: "va-surface-muted inline-flex min-h-8 items-center gap-2 rounded-lg border px-2.5 py-1 text-xs text-gray-300", children: [
          jsx(Search, { className: "h-3.5 w-3.5 text-gray-500" }),
          jsx("input", {
            value: search,
            onChange: (event) => onSearch(event.target.value),
            placeholder: "ابحث بالعنوان...",
            "aria-label": "بحث في عقد الشبكة",
            className: "min-w-[10rem] bg-transparent text-xs text-white placeholder:text-gray-600 outline-none"
          }),
          search ? jsx("button", { type: "button", onClick: () => onSearch(""), "aria-label": "مسح البحث", className: "text-gray-500 hover:text-white", children: jsx(X, { className: "h-3.5 w-3.5" }) }) : null
        ] }),
        jsxs("select", {
          value: typeFilter,
          onChange: (event) => onTypeFilter(event.target.value),
          "aria-label": "تصفية حسب النوع",
          className: "va-surface-muted min-h-8 rounded-lg border px-2 py-1 text-xs text-gray-300 outline-none",
          children: [
            jsx("option", { value: "all", children: "كل الأنواع" }, "all"),
            ...types.map((type) => jsx("option", { value: type.id, children: type.name || type.nameEn || "نوع" }, type.id))
          ]
        }),
        jsx("span", { className: "text-xs text-gray-500", children: statsLabel }),
        truncatedLabel ? jsx("span", { className: "text-xs text-gray-600", children: truncatedLabel }) : null
      ] }),
      jsxs("div", { className: "va-control-surface inline-flex min-h-8 overflow-hidden va-surface-muted rounded-lg border p-0.5", role: "group", "aria-label": "تكبير وتصغير", children: [
        jsx("button", { type: "button", onClick: onZoomOut, title: "تصغير", "aria-label": "تصغير", className: "inline-flex h-7 w-8 items-center justify-center rounded-md text-gray-300 hover:bg-white/5 hover:text-white", children: jsx(ZoomOut, { className: "h-3.5 w-3.5" }) }),
        jsx("span", { className: "inline-flex min-w-[3rem] items-center justify-center px-1 text-xs font-mono text-gray-300", children: `${Math.round(zoom * 100)}%` }),
        jsx("button", { type: "button", onClick: onZoomIn, title: "تكبير", "aria-label": "تكبير", className: "inline-flex h-7 w-8 items-center justify-center rounded-md text-gray-300 hover:bg-white/5 hover:text-white", children: jsx(ZoomIn, { className: "h-3.5 w-3.5" }) }),
        jsx("button", { type: "button", onClick: onReset, title: "إعادة الضبط", "aria-label": "إعادة الضبط", className: "inline-flex h-7 w-8 items-center justify-center rounded-md text-gray-300 hover:bg-white/5 hover:text-white", children: jsx(Maximize2, { className: "h-3.5 w-3.5" }) })
      ] })
    ]
  });
}

export function GraphViewPage() {
  const { videoItems = [], contentTypes = [], setSelectedItemId, setCurrentPage } = useAppStore();
  const [hovered, setHovered] = React.useState(null);
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const dragRef = React.useRef(null);

  const typeById = React.useMemo(() => new Map(contentTypes.map((type) => [type.id, type])), [contentTypes]);
  const graph = React.useMemo(() => buildGraph(videoItems, typeById, { typeFilter }), [videoItems, typeById, typeFilter]);

  const normalizedSearch = search.trim().toLowerCase();
  const searchMatchIndices = React.useMemo(() => {
    if (!normalizedSearch) return null;
    const matches = new Set();
    graph.nodes.forEach((node) => {
      if ((node.item.title || "").toLowerCase().includes(normalizedSearch)) matches.add(node.index);
    });
    return matches;
  }, [normalizedSearch, graph.nodes]);

  const connectedToHovered = React.useMemo(() => {
    if (hovered === null) return null;
    const set = new Set([hovered]);
    graph.edges.forEach((edge) => {
      if (edge.a === hovered) set.add(edge.b);
      if (edge.b === hovered) set.add(edge.a);
    });
    return set;
  }, [hovered, graph.edges]);

  const open = (item) => {
    setSelectedItemId?.(item.id);
    setCurrentPage?.("detail");
  };

  const zoomIn = () => setZoom((z) => Math.min(MAX_ZOOM, Number((z + 0.25).toFixed(2))));
  const zoomOut = () => setZoom((z) => Math.max(MIN_ZOOM, Number((z - 0.25).toFixed(2))));
  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  // Drag-to-pan
  const handlePointerDown = (event) => {
    if (event.target.closest("[data-graph-node]")) return; // let node click work
    dragRef.current = { startX: event.clientX, startY: event.clientY, panX: pan.x, panY: pan.y };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const handlePointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    setPan({ x: drag.panX + (event.clientX - drag.startX), y: drag.panY + (event.clientY - drag.startY) });
  };
  const handlePointerUp = () => { dragRef.current = null; };

  // Wheel zoom (anchored at center; simpler & predictable than pointer-anchored)
  const handleWheel = (event) => {
    if (!event.ctrlKey && !event.metaKey) return; // require ctrl/cmd so page scroll still works
    event.preventDefault();
    setZoom((z) => {
      const next = z + (event.deltaY < 0 ? 0.15 : -0.15);
      return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(next.toFixed(2))));
    });
  };

  const hoveredNode = hovered !== null ? graph.nodes[hovered] : null;

  return jsxs(MotionPage, {
    className: "space-y-4 p-4 sm:p-6",
    children: [
      jsx(PageHero, {
        icon: jsx(Workflow, { className: "h-6 w-6 va-accent-text" }),
        title: "خريطة العلاقات",
        description: "اسحب للتمرير · Ctrl+عجلة للتكبير · انقر عقدة لفتح التفاصيل."
      }),
      graph.edges.length === 0 ? jsx("div", { className: "va-card rounded-2xl border border-dashed border-white/10 bg-gray-950/35", children: jsx(EmptyState, {
        type: "archive",
        title: "لا توجد روابط لعرضها",
        description: typeFilter === "all" ? "أضف وسوماً مشتركة بين المواد لتظهر شبكة العلاقات هنا." : "لا توجد روابط ضمن هذا النوع. جرّب نوعاً آخر أو «كل الأنواع»."
      }) }) : jsxs("section", {
        className: "va-card rounded-2xl va-surface-muted border p-4 text-right",
        children: [
          jsx(GraphToolbar, {
            zoom, onZoomIn: zoomIn, onZoomOut: zoomOut, onReset: resetView,
            typeFilter, onTypeFilter: setTypeFilter,
            search, onSearch: setSearch,
            types: contentTypes,
            statsLabel: `${formatNumber(graph.total)} مادة · ${formatNumber(graph.edges.length)} صلة`,
            truncatedLabel: graph.truncated ? `· أول ${formatNumber(MAX_NODES)} للوضوح` : ""
          }),
          jsxs("div", {
            className: "grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]",
            children: [
              jsx("div", {
                className: "overflow-hidden rounded-xl bg-gray-950/30",
                onWheel: handleWheel,
                children: jsx("div", {
                  className: "relative h-[60vh] min-h-[420px] w-full select-none",
                  onPointerDown: handlePointerDown,
                  onPointerMove: handlePointerMove,
                  onPointerUp: handlePointerUp,
                  onPointerCancel: handlePointerUp,
                  style: { cursor: dragRef.current ? "grabbing" : "grab", touchAction: "none" },
                  children: jsxs("svg", {
                    viewBox: `0 0 ${SIZE} ${SIZE}`,
                    className: "h-full w-full",
                    role: "img",
                    "aria-label": "شبكة علاقات المواد",
                    children: [
                      jsx("g", { transform: `translate(${pan.x}, ${pan.y}) scale(${zoom})`, children: jsxs("g", { children: [
                        jsx("g", { children: graph.edges.map((edge, i) => {
                          const from = graph.nodes[edge.a];
                          const to = graph.nodes[edge.b];
                          const active = connectedToHovered && (connectedToHovered.has(edge.a) && connectedToHovered.has(edge.b) && (edge.a === hovered || edge.b === hovered));
                          const dim = connectedToHovered && !active;
                          return jsx("line", {
                            x1: from.x, y1: from.y, x2: to.x, y2: to.y,
                            stroke: active ? "#34d399" : "#64748b",
                            strokeWidth: 0.6 + (edge.weight / graph.maxWeight) * 3,
                            strokeOpacity: dim ? 0.05 : active ? 0.7 : 0.18
                          }, `e${i}`);
                        }) }),
                        jsx("g", { children: graph.nodes.map((node) => {
                          const dimByHover = connectedToHovered && !connectedToHovered.has(node.index);
                          const isSearchHit = searchMatchIndices && searchMatchIndices.has(node.index);
                          const dimBySearch = searchMatchIndices && !isSearchHit;
                          const dim = dimByHover || dimBySearch;
                          return jsxs("g", {
                            transform: `translate(${node.x}, ${node.y})`,
                            "data-graph-node": "true",
                            style: { cursor: "pointer", opacity: dim ? 0.18 : 1 },
                            onMouseEnter: () => setHovered(node.index),
                            onMouseLeave: () => setHovered((current) => current === node.index ? null : current),
                            onClick: () => open(node.item),
                            children: [
                              isSearchHit ? jsx("circle", { r: node.r + 4, fill: "none", stroke: "#fbbf24", strokeWidth: 2 }) : null,
                              jsx("circle", { r: node.r, fill: node.color, fillOpacity: 0.85, stroke: "#0a0a0f", strokeWidth: 2 }),
                              (hovered === node.index || isSearchHit || node.degree >= 3) ? jsx("text", {
                                y: node.r + 16,
                                textAnchor: "middle",
                                fill: "#cbd5e1",
                                fontSize: 16,
                                children: (node.item.title || "بدون عنوان").slice(0, 18)
                              }) : null
                            ]
                          }, node.item.id);
                        }) })
                      ] }) })
                    ]
                  })
                })
              }),
              // Side panel: details for hovered/focused node
              jsx("aside", {
                className: "va-surface-subtle rounded-xl border p-3 text-xs",
                "aria-label": "تفاصيل العقدة",
                children: hoveredNode ? jsxs("div", { className: "space-y-2", children: [
                  jsx("p", { className: "text-[10px] font-semibold uppercase tracking-wide text-gray-500", children: "عقدة محددة" }),
                  jsx("p", { className: "text-sm font-bold text-white", dir: "auto", children: hoveredNode.item.title || "بدون عنوان" }),
                  jsxs("p", { className: "text-gray-400", children: ["النوع: ", typeById.get(hoveredNode.item.type)?.name || "غير محدد"] }),
                  jsxs("p", { className: "text-gray-400", children: ["الصلات: ", formatNumber(hoveredNode.degree)] }),
                  hoveredNode.item.tags?.length ? jsxs("div", { children: [
                    jsx("p", { className: "mb-1 text-[10px] uppercase tracking-wide text-gray-500", children: "وسوم" }),
                    jsx("div", { className: "flex flex-wrap gap-1", children: hoveredNode.item.tags.slice(0, 8).map((tag) => jsx("span", { className: "rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-gray-300", children: tag }, tag)) })
                  ] }) : null,
                  jsx("button", { type: "button", onClick: () => open(hoveredNode.item), className: "va-primary-button mt-2 inline-flex min-h-8 w-full items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold text-white", children: "فتح التفاصيل" })
                ] }) : jsx("p", { className: "text-gray-500", children: "مرّر فوق عقدة لرؤية تفاصيلها هنا، أو ابحث للتحديد." })
              })
            ]
          })
        ]
      })
    ]
  });
}

GraphViewPage.pageId = "graph";
GraphViewPage.migrationStatus = "native";

export default GraphViewPage;

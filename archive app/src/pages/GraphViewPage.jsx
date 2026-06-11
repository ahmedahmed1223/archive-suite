import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { Workflow, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

import { useAppStore } from "../stores/index.js";
import { MotionPage, PageHero } from "../components/ui/V1Primitives.jsx";
import { EmptyState } from "../components/common/EmptyState.jsx";
import { formatNumber } from "../utils/formatting.js";
import { DOCUMENT_TYPE_LABELS } from "../services/documentTypes.js";
import { buildGraphModel, toCytoscapeElements, GRAPH_MAX_NODES } from "../features/graph/buildGraphModel.js";

const ZOOM_STEP = 1.25;
const COSE_NODE_LIMIT = 250; // beyond this, cose gets sluggish — fall back to concentric
const LOAD_MORE_STEP = GRAPH_MAX_NODES;

function createLayoutOptions(nodeCount) {
  if (nodeCount <= COSE_NODE_LIMIT) {
    return { name: "cose", animate: false, padding: 40, nodeRepulsion: () => 8000, idealEdgeLength: () => 110 };
  }
  return { name: "concentric", animate: false, padding: 40, minNodeSpacing: 24, concentric: (node) => node.degree(), levelWidth: () => 2 };
}

function createStylesheet() {
  return [
    {
      selector: "node",
      style: {
        "background-color": "data(color)",
        "background-opacity": 0.9,
        "border-width": 2,
        "border-color": "#0a0a0f",
        width: "mapData(degree, 0, 10, 18, 46)",
        height: "mapData(degree, 0, 10, 18, 46)",
        label: "data(label)",
        color: "#cbd5e1",
        "font-size": 11,
        "text-valign": "bottom",
        "text-margin-y": 6,
        "text-wrap": "ellipsis",
        "text-max-width": 120
      }
    },
    {
      selector: "edge",
      style: {
        "curve-style": "haystack",
        "line-color": "#64748b",
        opacity: 0.35,
        width: "mapData(weight, 1, 6, 1, 5)"
      }
    },
    { selector: "node:selected", style: { "border-color": "#34d399", "border-width": 3, color: "#ffffff" } },
    { selector: ".cy-highlighted", style: { "line-color": "#34d399", opacity: 0.9 } }
  ];
}

function GraphToolbar({ typeFilter, onTypeFilter, tagFilter, onTagFilter, typeOptions, tagOptions, statsLabel, onZoomIn, onZoomOut, onFit }) {
  return jsxs("div", {
    className: "mb-3 flex flex-wrap items-center justify-between gap-2",
    children: [
      jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
        jsxs("select", {
          value: typeFilter,
          onChange: (event) => onTypeFilter(event.target.value),
          "aria-label": "تصفية حسب نوع المستند",
          className: "va-surface-muted min-h-8 rounded-lg border px-2 py-1 text-xs text-gray-300 outline-none",
          children: [
            jsx("option", { value: "all", children: "كل الأنواع" }, "all"),
            ...typeOptions.map((option) => jsx("option", {
              value: option.key,
              children: `${DOCUMENT_TYPE_LABELS[option.key] || option.key} (${formatNumber(option.count)})`
            }, option.key))
          ]
        }),
        jsxs("select", {
          value: tagFilter,
          onChange: (event) => onTagFilter(event.target.value),
          "aria-label": "تصفية حسب الوسم",
          className: "va-surface-muted min-h-8 max-w-[14rem] rounded-lg border px-2 py-1 text-xs text-gray-300 outline-none",
          children: [
            jsx("option", { value: "", children: "كل الوسوم" }, "all"),
            ...tagOptions.map((option) => jsx("option", {
              value: option.key,
              children: `${option.label} (${formatNumber(option.count)})`
            }, option.key))
          ]
        }),
        jsx("span", { className: "text-xs text-gray-500", children: statsLabel })
      ] }),
      jsxs("div", { className: "va-control-surface va-surface-muted inline-flex min-h-8 overflow-hidden rounded-lg border p-0.5", role: "group", "aria-label": "تكبير وتصغير", children: [
        jsx("button", { type: "button", onClick: onZoomOut, title: "تصغير", "aria-label": "تصغير", className: "inline-flex h-7 w-8 items-center justify-center rounded-md text-gray-300 hover:bg-white/5 hover:text-white", children: jsx(ZoomOut, { className: "h-3.5 w-3.5" }) }),
        jsx("button", { type: "button", onClick: onZoomIn, title: "تكبير", "aria-label": "تكبير", className: "inline-flex h-7 w-8 items-center justify-center rounded-md text-gray-300 hover:bg-white/5 hover:text-white", children: jsx(ZoomIn, { className: "h-3.5 w-3.5" }) }),
        jsx("button", { type: "button", onClick: onFit, title: "احتواء الكل", "aria-label": "احتواء الكل", className: "inline-flex h-7 w-8 items-center justify-center rounded-md text-gray-300 hover:bg-white/5 hover:text-white", children: jsx(Maximize2, { className: "h-3.5 w-3.5" }) })
      ] })
    ]
  });
}

function SelectedNodePanel({ node, typeLabel, onOpen }) {
  if (!node) {
    return jsx("p", { className: "text-gray-500", children: "انقر عقدة لرؤية تفاصيلها هنا. انقرها مرة أخرى لفتح صفحة التفاصيل." });
  }
  return jsxs("div", { className: "space-y-2", children: [
    jsx("p", { className: "text-[10px] font-semibold uppercase tracking-wide text-gray-500", children: "عقدة محددة" }),
    jsx("p", { className: "text-sm font-bold text-white", dir: "auto", children: node.label }),
    jsxs("p", { className: "text-gray-400", children: ["النوع: ", typeLabel] }),
    jsxs("p", { className: "text-gray-400", children: ["الصلات: ", formatNumber(node.degree)] }),
    node.tags.length ? jsxs("div", { children: [
      jsx("p", { className: "mb-1 text-[10px] uppercase tracking-wide text-gray-500", children: "وسوم" }),
      jsx("div", { className: "flex flex-wrap gap-1", children: node.tags.slice(0, 8).map((tag) => jsx("span", { className: "rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-gray-300", children: tag }, tag)) })
    ] }) : null,
    jsx("button", { type: "button", onClick: onOpen, className: "va-primary-button mt-2 inline-flex min-h-8 w-full items-center justify-center rounded-lg px-3 py-1.5 text-xs font-semibold text-white", children: "فتح التفاصيل" })
  ] });
}

export function GraphViewPage() {
  const { videoItems = [], hierarchicalTags = [], virtualCollections = [], setSelectedItemId, setCurrentPage } = useAppStore();
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [tagFilter, setTagFilter] = React.useState("");
  const [maxNodes, setMaxNodes] = React.useState(GRAPH_MAX_NODES);
  const [selectedId, setSelectedId] = React.useState(null);
  const [graphError, setGraphError] = React.useState("");

  const containerRef = React.useRef(null);
  const cyRef = React.useRef(null);

  const model = React.useMemo(
    () => buildGraphModel(
      { videoItems, hierarchicalTags, collections: virtualCollections },
      { typeFilter, tagFilter, maxNodes }
    ),
    [videoItems, hierarchicalTags, virtualCollections, typeFilter, tagFilter, maxNodes]
  );
  const nodeById = React.useMemo(() => new Map(model.nodes.map((node) => [node.id, node])), [model.nodes]);
  const selectedNode = selectedId ? nodeById.get(selectedId) || null : null;

  const open = React.useCallback((itemId) => {
    setSelectedItemId?.(itemId);
    setCurrentPage?.("detail");
  }, [setSelectedItemId, setCurrentPage]);
  const openRef = React.useRef(open);
  openRef.current = open;

  const hasGraph = model.nodes.length > 0 && model.edges.length > 0;

  // Mount/refresh cytoscape — the library is imported lazily so it stays out
  // of the main bundle (page itself is already lazy via pageRegistry).
  React.useEffect(() => {
    if (!hasGraph || !containerRef.current) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { default: cytoscape } = await import("cytoscape");
        if (cancelled || !containerRef.current) return;
        cyRef.current?.destroy();
        const cy = cytoscape({
          container: containerRef.current,
          elements: toCytoscapeElements(model),
          style: createStylesheet(),
          layout: createLayoutOptions(model.nodes.length),
          minZoom: 0.1,
          maxZoom: 4,
          wheelSensitivity: 0.2,
          pixelRatio: 1
        });
        cy.on("tap", "node", (event) => {
          const id = event.target.id();
          setSelectedId((current) => {
            if (current === id) {
              openRef.current(id); // second tap opens detail page
              return current;
            }
            event.target.connectedEdges().addClass("cy-highlighted");
            return id;
          });
        });
        cy.on("tap", (event) => {
          if (event.target === cy) {
            cy.edges().removeClass("cy-highlighted");
            setSelectedId(null);
          }
        });
        cyRef.current = cy;
        setGraphError("");
      } catch (error) {
        if (!cancelled) setGraphError(error?.message || "تعذّر تحميل محرك الرسم.");
      }
    })();
    return () => {
      cancelled = true;
      cyRef.current?.destroy();
      cyRef.current = null;
    };
  }, [model, hasGraph]);

  const zoomBy = (factor) => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.zoom({ level: cy.zoom() * factor, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
  };

  const emptyDescription = model.nodes.length === 0
    ? (typeFilter !== "all" || tagFilter ? "لا توجد مواد مطابقة للفلاتر الحالية. جرّب «كل الأنواع» أو «كل الوسوم»." : "أضف مواد إلى الأرشيف أولاً لتظهر هنا.")
    : "لا توجد وسوم مشتركة بعد — تظهر الروابط عندما تتشارك المواد وسوماً أو تنتمي لنفس المجموعة. أضف وسوماً مشتركة أو انقل المواد إلى مجموعات.";

  return jsxs(MotionPage, {
    className: "space-y-4 p-4 sm:p-6",
    children: [
      jsx(PageHero, {
        icon: jsx(Workflow, { className: "h-6 w-6 va-accent-text" }),
        title: "خريطة العلاقات",
        description: "اسحب للتمرير · عجلة الفأرة للتكبير · انقر عقدة للتحديد ومرة أخرى لفتح التفاصيل."
      }),
      graphError ? jsx("div", { className: "va-card rounded-2xl border border-red-500/30 bg-red-950/20 p-4 text-sm text-red-300", role: "alert", children: graphError }) : null,
      !hasGraph ? jsx("div", { className: "va-card rounded-2xl border border-dashed border-white/10 bg-gray-950/35", children: jsx(EmptyState, {
        type: "archive",
        title: "لا توجد روابط لعرضها",
        description: emptyDescription
      }) }) : jsxs("section", {
        className: "va-card rounded-2xl va-surface-muted border p-4 text-right",
        children: [
          jsx(GraphToolbar, {
            typeFilter, onTypeFilter: setTypeFilter,
            tagFilter, onTagFilter: setTagFilter,
            typeOptions: model.typeOptions,
            tagOptions: model.tagOptions,
            statsLabel: `${formatNumber(model.nodes.length)} مادة · ${formatNumber(model.edges.length)} صلة`,
            onZoomIn: () => zoomBy(ZOOM_STEP),
            onZoomOut: () => zoomBy(1 / ZOOM_STEP),
            onFit: () => cyRef.current?.fit(undefined, 40)
          }),
          model.truncated ? jsxs("div", { className: "mb-3 flex flex-wrap items-center gap-2 text-xs text-gray-400", children: [
            jsx("span", { children: `يُعرض ${formatNumber(model.nodes.length)} من ${formatNumber(model.totalEligible)} مادة للحفاظ على الأداء — استخدم الفلاتر لتضييق النتائج.` }),
            jsx("button", {
              type: "button",
              onClick: () => setMaxNodes((current) => current + LOAD_MORE_STEP),
              className: "va-surface-muted rounded-lg border px-2.5 py-1 text-xs text-gray-200 hover:bg-white/5",
              children: "تحميل المزيد"
            })
          ] }) : null,
          jsxs("div", {
            className: "grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]",
            children: [
              jsx("div", {
                ref: containerRef,
                dir: "ltr", // cytoscape canvas coordinates — labels render Arabic text correctly
                className: "h-[60vh] min-h-[420px] w-full overflow-hidden rounded-xl bg-gray-950/30",
                role: "img",
                "aria-label": "شبكة علاقات المواد"
              }),
              jsx("aside", {
                className: "va-surface-subtle rounded-xl border p-3 text-xs",
                "aria-label": "تفاصيل العقدة",
                children: jsx(SelectedNodePanel, {
                  node: selectedNode,
                  typeLabel: selectedNode ? (DOCUMENT_TYPE_LABELS[selectedNode.documentType] || selectedNode.documentType) : "",
                  onOpen: () => selectedNode && open(selectedNode.id)
                })
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

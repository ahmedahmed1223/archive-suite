import * as React from "react";
import {
  BookOpen,
  Database,
  FileType,
  FolderOpen,
  GitBranch,
  Layers3,
  Maximize2,
  RotateCcw,
  Search,
  Tags,
  Workflow,
  ZoomIn,
  ZoomOut
} from "lucide-react";

import { useAppStore } from "../stores/index.js";
import { MotionPage, PageHero } from "../components/ui/V1Primitives.jsx";
import { EmptyState } from "../components/common/EmptyState.jsx";
import { formatNumber } from "../utils/formatting.js";
import { DOCUMENT_TYPE_LABELS } from "../services/documentTypes.js";
import {
  buildGraphModel,
  EXPANDED_NODE_KINDS,
  GRAPH_MAX_NODES,
  NODE_KIND_META,
  toCytoscapeElements
} from "../features/graph/buildGraphModel.js";

const ZOOM_STEP = 1.25;
const COSE_NODE_LIMIT = 250;
const LOAD_MORE_STEP = GRAPH_MAX_NODES;

const KIND_ICONS = {
  item: Database,
  documentType: FileType,
  contentType: Layers3,
  tag: Tags,
  collection: FolderOpen,
  vocabulary: BookOpen,
  folder: FolderOpen
};

const LAYOUT_OPTIONS = [
  { id: "auto", label: "تلقائي" },
  { id: "cose", label: "عضوي" },
  { id: "concentric", label: "حلقات" },
  { id: "circle", label: "دائرة" }
];

function createLayoutOptions(nodeCount, requestedLayout = "auto") {
  const layout = requestedLayout === "auto"
    ? (nodeCount <= COSE_NODE_LIMIT ? "cose" : "concentric")
    : requestedLayout;
  if (layout === "circle") return { name: "circle", animate: false, padding: 46 };
  if (layout === "concentric") {
    return {
      name: "concentric",
      animate: false,
      padding: 48,
      minNodeSpacing: 24,
      concentric: (node) => node.degree() + (node.data("kind") === "item" ? 0.5 : 0),
      levelWidth: () => 2
    };
  }
  return {
    name: "cose",
    animate: false,
    padding: 48,
    nodeRepulsion: () => 9000,
    idealEdgeLength: (edge) => (edge.data("edgeKind") === "manual" ? 130 : 105)
  };
}

function createStylesheet() {
  return [
    {
      selector: "node",
      style: {
        "background-color": "data(color)",
        "background-opacity": 0.94,
        "border-width": 2,
        "border-color": "#0a0a0f",
        width: "mapData(degree, 0, 14, 22, 56)",
        height: "mapData(degree, 0, 14, 22, 56)",
        label: "data(label)",
        color: "#d1d5db",
        "font-size": 11,
        "text-valign": "bottom",
        "text-margin-y": 7,
        "text-wrap": "ellipsis",
        "text-max-width": 132,
        "text-outline-color": "#020617",
        "text-outline-width": 2
      }
    },
    {
      selector: 'node[kind != "item"]',
      style: {
        shape: "round-rectangle",
        width: "mapData(degree, 0, 14, 34, 68)",
        height: "mapData(degree, 0, 14, 20, 38)",
        "border-color": "#334155"
      }
    },
    {
      selector: "edge",
      style: {
        "curve-style": "haystack",
        "line-color": "#64748b",
        opacity: 0.32,
        width: "mapData(weight, 1, 6, 1, 5)"
      }
    },
    {
      selector: 'edge[edgeKind = "manual"]',
      style: {
        "curve-style": "bezier",
        "line-color": "#34d399",
        "target-arrow-color": "#34d399",
        "target-arrow-shape": "triangle",
        opacity: 0.86,
        width: 2.6,
        label: "data(label)",
        color: "#bbf7d0",
        "font-size": 9,
        "text-rotation": "autorotate",
        "text-background-color": "#020617",
        "text-background-opacity": 0.78,
        "text-background-padding": 2
      }
    },
    {
      selector: 'edge[edgeKind = "tag"], edge[edgeKind = "collection"], edge[edgeKind = "folder"], edge[edgeKind = "vocabulary"], edge[edgeKind = "contentType"], edge[edgeKind = "documentType"]',
      style: {
        "curve-style": "bezier",
        "line-style": "dashed",
        "line-color": "#94a3b8",
        opacity: 0.42,
        width: 1.4
      }
    },
    { selector: "node:selected", style: { "border-color": "#34d399", "border-width": 3, color: "#ffffff" } },
    { selector: ".cy-highlighted", style: { "line-color": "#34d399", opacity: 0.92, width: 3 } },
    { selector: ".cy-dimmed", style: { opacity: 0.12 } }
  ];
}

function GraphMetric({ label, value }) {
  return (
    <div className="rounded-[var(--va-radius-lg)] border border-[var(--va-border-soft)] bg-[var(--va-surface)] px-3 py-2">
      <p className="text-[11px] text-[var(--va-text-muted)]">{label}</p>
      <p className="mt-0.5 text-lg font-bold text-[var(--va-text)]">{value}</p>
    </div>
  );
}

function NodeKindToggle({ kind, active, count, onToggle }) {
  const Icon = KIND_ICONS[kind] || Workflow;
  const meta = NODE_KIND_META[kind] || { label: kind, color: "#94a3b8" };
  return (
    <button
      type="button"
      onClick={() => onToggle(kind)}
      aria-pressed={active}
      className={`inline-flex min-h-9 items-center gap-2 rounded-[var(--va-radius-md)] border px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/55 ${
        active
          ? "border-emerald-500/35 bg-emerald-500/12 text-emerald-100"
          : "border-[var(--va-border-soft)] bg-[var(--va-surface)] text-[var(--va-text-2)] hover:bg-[var(--va-surface-2)]"
      }`}
    >
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: meta.color }} />
      <Icon className="h-3.5 w-3.5" />
      <span>{meta.label}</span>
      <span className="font-mono text-[10px] opacity-70">{formatNumber(count || 0)}</span>
    </button>
  );
}

function GraphToolbar({
  typeFilter,
  onTypeFilter,
  tagFilter,
  onTagFilter,
  typeOptions,
  tagOptions,
  layoutMode,
  onLayoutMode,
  onZoomIn,
  onZoomOut,
  onFit,
  onReset,
  nodeKinds,
  onToggleKind,
  kindCounts,
  statsLabel
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={typeFilter}
            onChange={(event) => onTypeFilter(event.target.value)}
            aria-label="تصفية حسب نوع الملف"
            className="va-surface-muted min-h-9 rounded-[var(--va-radius-md)] border border-[var(--va-border-soft)] px-2 py-1 text-xs text-[var(--va-text)] outline-none"
          >
            <option value="all">كل أنواع الملفات</option>
            {typeOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {DOCUMENT_TYPE_LABELS[option.key] || option.key} ({formatNumber(option.count)})
              </option>
            ))}
          </select>
          <select
            value={tagFilter}
            onChange={(event) => onTagFilter(event.target.value)}
            aria-label="تصفية حسب الوسم"
            className="va-surface-muted min-h-9 max-w-[14rem] rounded-[var(--va-radius-md)] border border-[var(--va-border-soft)] px-2 py-1 text-xs text-[var(--va-text)] outline-none"
          >
            <option value="">كل الوسوم</option>
            {tagOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label} ({formatNumber(option.count)})
              </option>
            ))}
          </select>
          <select
            value={layoutMode}
            onChange={(event) => onLayoutMode(event.target.value)}
            aria-label="نمط تخطيط الخريطة"
            className="va-surface-muted min-h-9 rounded-[var(--va-radius-md)] border border-[var(--va-border-soft)] px-2 py-1 text-xs text-[var(--va-text)] outline-none"
          >
            {LAYOUT_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
          <span className="text-xs text-[var(--va-text-muted)]">{statsLabel}</span>
        </div>
        <div className="va-control-surface va-surface-muted inline-flex min-h-9 overflow-hidden rounded-[var(--va-radius-md)] border border-[var(--va-border-soft)] p-0.5" role="group" aria-label="أدوات عرض الخريطة">
          <button type="button" onClick={onZoomOut} title="تصغير" aria-label="تصغير" className="inline-flex h-8 w-9 items-center justify-center rounded-[var(--va-radius-sm)] text-[var(--va-text-2)] hover:bg-[var(--va-surface-2)] hover:text-[var(--va-text)]">
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={onZoomIn} title="تكبير" aria-label="تكبير" className="inline-flex h-8 w-9 items-center justify-center rounded-[var(--va-radius-sm)] text-[var(--va-text-2)] hover:bg-[var(--va-surface-2)] hover:text-[var(--va-text)]">
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={onFit} title="احتواء الكل" aria-label="احتواء الكل" className="inline-flex h-8 w-9 items-center justify-center rounded-[var(--va-radius-sm)] text-[var(--va-text-2)] hover:bg-[var(--va-surface-2)] hover:text-[var(--va-text)]">
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={onReset} title="إعادة ترتيب" aria-label="إعادة ترتيب" className="inline-flex h-8 w-9 items-center justify-center rounded-[var(--va-radius-sm)] text-[var(--va-text-2)] hover:bg-[var(--va-surface-2)] hover:text-[var(--va-text)]">
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2" aria-label="طبقات الخريطة">
        {EXPANDED_NODE_KINDS.map((kind) => (
          <NodeKindToggle
            key={kind}
            kind={kind}
            active={nodeKinds.includes(kind)}
            count={kindCounts[kind] || 0}
            onToggle={onToggleKind}
          />
        ))}
      </div>
    </div>
  );
}

function GraphSearchPanel({ query, onQuery, matchCount, onClear }) {
  return (
    <div className="rounded-[var(--va-radius-lg)] border border-[var(--va-border-soft)] bg-[var(--va-surface)] p-3">
      <label className="flex items-center gap-2 rounded-[var(--va-radius-md)] border border-[var(--va-border-soft)] bg-[var(--va-bg)] px-3 py-2">
        <Search className="h-4 w-4 text-[var(--va-text-muted)]" />
        <input
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          className="min-h-8 flex-1 bg-transparent text-right text-sm text-[var(--va-text)] outline-none placeholder:text-[var(--va-text-muted)]"
          placeholder="بحث داخل العقد"
          aria-label="بحث داخل عقد الخريطة"
        />
        {query ? (
          <button type="button" onClick={onClear} className="rounded-[var(--va-radius-sm)] px-2 py-1 text-xs text-[var(--va-text-2)] hover:bg-[var(--va-surface-2)]">
            مسح
          </button>
        ) : null}
      </label>
      <p className="mt-2 text-xs text-[var(--va-text-muted)]">{query ? `${formatNumber(matchCount)} عقدة مطابقة` : "ابحث بعنوان مادة أو وسم أو مجموعة أو مصطلح."}</p>
    </div>
  );
}

function SelectedNodePanel({ node, onOpen }) {
  if (!node) {
    return (
      <p className="text-sm leading-7 text-[var(--va-text-muted)]">
        حدّد عقدة لعرض تفاصيلها. العقد المربعة تمثل كيانات تنظيمية، والدائرية تمثل مواد الأرشيف.
      </p>
    );
  }
  const kindMeta = NODE_KIND_META[node.kind] || NODE_KIND_META.item;
  const TypeIcon = KIND_ICONS[node.kind] || Workflow;
  const canOpen = node.kind === "item" || ["collection", "contentType", "tag", "vocabulary", "folder"].includes(node.kind);
  const typeLabel = node.kind === "item"
    ? (DOCUMENT_TYPE_LABELS[node.documentType] || node.documentType)
    : kindMeta.label;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-[var(--va-radius-md)] border border-[var(--va-border-soft)]" style={{ color: node.color }}>
          <TypeIcon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-[var(--va-text)]" dir="auto">{node.label}</p>
          <p className="text-xs text-[var(--va-text-muted)]">{typeLabel}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <GraphMetric label="الصلات" value={formatNumber(node.degree || 0)} />
        <GraphMetric label="العناصر" value={formatNumber(node.count || (node.kind === "item" ? 1 : 0))} />
      </div>
      {node.tags?.length ? (
        <div>
          <p className="mb-1 text-[11px] text-[var(--va-text-muted)]">وسوم المادة</p>
          <div className="flex flex-wrap gap-1">
            {node.tags.slice(0, 10).map((tag) => (
              <span key={tag} className="rounded-full border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] px-2 py-0.5 text-[10px] text-[var(--va-text-2)]">{tag}</span>
            ))}
          </div>
        </div>
      ) : null}
      {canOpen ? (
        <button type="button" onClick={() => onOpen(node)} className="btn btn-primary btn-sm w-full">
          فتح القسم المرتبط
        </button>
      ) : null}
    </div>
  );
}

function normalizeSearch(value) {
  return String(value || "").trim().toLowerCase();
}

export function GraphViewPage() {
  const {
    videoItems = [],
    hierarchicalTags = [],
    virtualCollections = [],
    itemRelations = [],
    contentTypes = [],
    vocabulary = [],
    folders = [],
    setSelectedItemId,
    setCurrentPage
  } = useAppStore();
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [tagFilter, setTagFilter] = React.useState("");
  const [maxNodes, setMaxNodes] = React.useState(GRAPH_MAX_NODES);
  const [selectedId, setSelectedId] = React.useState(null);
  const [graphError, setGraphError] = React.useState("");
  const [layoutMode, setLayoutMode] = React.useState("auto");
  const [nodeKinds, setNodeKinds] = React.useState(EXPANDED_NODE_KINDS);
  const [query, setQuery] = React.useState("");

  const containerRef = React.useRef(null);
  const cyRef = React.useRef(null);

  const model = React.useMemo(
    () => buildGraphModel(
      {
        videoItems,
        hierarchicalTags,
        collections: virtualCollections,
        itemRelations,
        contentTypes,
        vocabulary,
        folders
      },
      { typeFilter, tagFilter, maxNodes, nodeKinds }
    ),
    [videoItems, hierarchicalTags, virtualCollections, itemRelations, contentTypes, vocabulary, folders, typeFilter, tagFilter, maxNodes, nodeKinds]
  );
  const nodeById = React.useMemo(() => new Map(model.nodes.map((node) => [node.id, node])), [model.nodes]);
  const selectedNode = selectedId ? nodeById.get(selectedId) || null : null;

  const openNode = React.useCallback((node) => {
    if (!node) return;
    if (node.kind === "item") {
      setSelectedItemId?.(node.id);
      setCurrentPage?.("detail");
      return;
    }
    const targetPage = {
      collection: "collections",
      contentType: "types",
      tag: "htags",
      vocabulary: "vocabulary",
      folder: node.entity?.scope === "types" ? "types" : node.entity?.scope === "vocabulary" ? "vocabulary" : node.entity?.scope === "tags" ? "htags" : "collections"
    }[node.kind];
    if (targetPage) {
      setSelectedItemId?.(null);
      setCurrentPage?.(targetPage);
    }
  }, [setCurrentPage, setSelectedItemId]);
  const openRef = React.useRef(openNode);
  openRef.current = openNode;

  const hasGraph = model.nodes.length > 0;
  const normalizedQuery = normalizeSearch(query);
  const queryMatchIds = React.useMemo(() => {
    if (!normalizedQuery) return new Set();
    return new Set(model.nodes
      .filter((node) => normalizeSearch(`${node.label} ${node.kind} ${node.documentType}`).includes(normalizedQuery))
      .map((node) => node.id));
  }, [model.nodes, normalizedQuery]);

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
          layout: createLayoutOptions(model.nodes.length, layoutMode),
          minZoom: 0.1,
          maxZoom: 4,
          wheelSensitivity: 0.2,
          pixelRatio: 1
        });
        cy.on("tap", "node", (event) => {
          const id = event.target.id();
          setSelectedId((current) => {
            cy.elements().removeClass("cy-highlighted");
            event.target.connectedEdges().addClass("cy-highlighted");
            if (current === id) {
              openRef.current(nodeById.get(id));
              return current;
            }
            return id;
          });
        });
        cy.on("tap", (event) => {
          if (event.target === cy) {
            cy.elements().removeClass("cy-highlighted");
            setSelectedId(null);
          }
        });
        cyRef.current = cy;
        setGraphError("");
      } catch (error) {
        if (!cancelled) setGraphError(error?.message || "تعذر تحميل محرك الرسم.");
      }
    })();
    return () => {
      cancelled = true;
      cyRef.current?.destroy();
      cyRef.current = null;
    };
  }, [model, hasGraph, layoutMode, nodeById]);

  React.useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.elements().removeClass("cy-dimmed");
    if (!normalizedQuery) return;
    cy.elements().addClass("cy-dimmed");
    queryMatchIds.forEach((id) => {
      const node = cy.getElementById(id);
      node.removeClass("cy-dimmed");
      node.connectedEdges().removeClass("cy-dimmed");
      node.connectedEdges().connectedNodes().removeClass("cy-dimmed");
    });
  }, [normalizedQuery, queryMatchIds]);

  const toggleKind = (kind) => {
    setSelectedId(null);
    setNodeKinds((current) => {
      if (kind === "item") return current.includes("item") ? current : ["item", ...current];
      const next = current.includes(kind) ? current.filter((item) => item !== kind) : [...current, kind];
      return next.includes("item") ? next : ["item", ...next];
    });
  };

  const rerunLayout = () => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.layout(createLayoutOptions(model.nodes.length, layoutMode)).run();
    cy.fit(undefined, 48);
  };

  const zoomBy = (factor) => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.zoom({ level: cy.zoom() * factor, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
  };

  const emptyDescription = model.nodes.length === 0
    ? (typeFilter !== "all" || tagFilter ? "لا توجد مواد مطابقة للفلاتر الحالية. جرّب «كل أنواع الملفات» أو «كل الوسوم»." : "أضف مواد إلى الأرشيف أولاً لتظهر هنا.")
    : "لا توجد روابط كافية بعد. أضف وسوماً أو مجموعات أو علاقات يدوية لرؤية شبكة أوضح.";

  return (
    <MotionPage className="space-y-4 p-4 sm:p-6">
      <PageHero
        icon={<Workflow className="h-6 w-6 va-accent-text" />}
        title="خريطة العلاقات"
        description="خريطة تفاعلية تربط مواد الأرشيف بالأنواع والوسوم والمجموعات والمصطلحات والمجلدات."
      />

      {graphError ? (
        <div className="rounded-[var(--va-radius-lg)] border border-[color-mix(in_oklab,var(--va-status-danger)_40%,transparent)] bg-[color-mix(in_oklab,var(--va-status-danger)_12%,transparent)] p-4 text-sm text-[var(--va-status-danger)]" role="alert">
          {graphError}
        </div>
      ) : null}

      {!hasGraph ? (
        <div className="va-card rounded-[var(--va-radius-xl)] border border-dashed border-[var(--va-border-soft)] bg-[var(--va-surface)]">
          <EmptyState type="archive" title="لا توجد خريطة لعرضها" description={emptyDescription} />
        </div>
      ) : (
        <section className="rounded-[var(--va-radius-xl)] border border-[var(--va-border-soft)] bg-[var(--va-elevated)] p-4 text-right shadow-[var(--va-elev-1)]">
          <GraphToolbar
            typeFilter={typeFilter}
            onTypeFilter={setTypeFilter}
            tagFilter={tagFilter}
            onTagFilter={setTagFilter}
            typeOptions={model.typeOptions}
            tagOptions={model.tagOptions}
            layoutMode={layoutMode}
            onLayoutMode={setLayoutMode}
            nodeKinds={nodeKinds}
            onToggleKind={toggleKind}
            kindCounts={model.kindCounts || {}}
            statsLabel={`${formatNumber(model.nodes.length)} عقدة · ${formatNumber(model.edges.length)} صلة`}
            onZoomIn={() => zoomBy(ZOOM_STEP)}
            onZoomOut={() => zoomBy(1 / ZOOM_STEP)}
            onFit={() => cyRef.current?.fit(undefined, 48)}
            onReset={rerunLayout}
          />

          {(model.truncated || model.entityTruncated) ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[var(--va-radius-md)] border border-[var(--va-border-soft)] bg-[var(--va-surface)] px-3 py-2 text-xs text-[var(--va-text-2)]">
              <span>
                يعرض النظام {formatNumber(model.nodes.length)} عقدة من {formatNumber(model.totalEligible)} مادة مؤهلة مع حد للكيانات للحفاظ على الأداء.
              </span>
              {model.truncated ? (
                <button
                  type="button"
                  onClick={() => setMaxNodes((current) => current + LOAD_MORE_STEP)}
                  className="rounded-[var(--va-radius-sm)] border border-[var(--va-border-soft)] px-2.5 py-1 text-xs text-[var(--va-text)] hover:bg-[var(--va-surface-2)]"
                >
                  تحميل المزيد
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 grid gap-3 xl:grid-cols-[18rem_minmax(0,1fr)_20rem]">
            <aside className="space-y-3 xl:order-1">
              <GraphSearchPanel
                query={query}
                onQuery={setQuery}
                matchCount={queryMatchIds.size}
                onClear={() => setQuery("")}
              />
              <div className="grid grid-cols-2 gap-2">
                <GraphMetric label="العقد" value={formatNumber(model.nodes.length)} />
                <GraphMetric label="الروابط" value={formatNumber(model.edges.length)} />
                <GraphMetric label="المواد" value={formatNumber(model.kindCounts?.item || 0)} />
                <GraphMetric label="طبقات" value={formatNumber(nodeKinds.length)} />
              </div>
            </aside>

            <div
              ref={containerRef}
              dir="ltr"
              className="h-[64vh] min-h-[440px] w-full overflow-hidden rounded-[var(--va-radius-lg)] border border-[var(--va-border-soft)] bg-[var(--va-bg)] xl:order-2"
              role="img"
              aria-label="شبكة علاقات المواد والكيانات"
            />

            <aside className="rounded-[var(--va-radius-lg)] border border-[var(--va-border-soft)] bg-[var(--va-surface)] p-3 text-xs xl:order-3" aria-label="تفاصيل العقدة">
              <SelectedNodePanel node={selectedNode} onOpen={openNode} />
              <div className="mt-4 border-t border-[var(--va-border-soft)] pt-3">
                <p className="mb-2 text-[11px] font-semibold text-[var(--va-text-muted)]">أسطورة الطبقات</p>
                <div className="space-y-1.5">
                  {EXPANDED_NODE_KINDS.map((kind) => {
                    const meta = NODE_KIND_META[kind];
                    return (
                      <div key={kind} className="flex items-center justify-between gap-2 text-[11px] text-[var(--va-text-2)]">
                        <span className="inline-flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: meta.color }} />
                          {meta.label}
                        </span>
                        <span className="font-mono">{formatNumber(model.kindCounts?.[kind] || 0)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </aside>
          </div>
        </section>
      )}
    </MotionPage>
  );
}

GraphViewPage.pageId = "graph";
GraphViewPage.migrationStatus = "native";

export default GraphViewPage;

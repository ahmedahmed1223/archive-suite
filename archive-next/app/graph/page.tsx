"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Filter, GitBranch, Link2, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import AppShell from "@/components/AppShell";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { useCapability } from "@/components/RoleGate";
import {
  createArchiveApiClient,
  type RelationGraphEdge,
  type RelationGraphNode,
  type RelationGraphPayload,
  type RelationTypeKey,
  type RelationTypeOption
} from "@/lib/archive-api";
import "./graph.css";
import { Skeleton } from "@/components/ui/Skeleton";
import { buildGraphLenses, GRAPH_LENS_STORAGE_KEY, resolveGraphLens } from "@/lib/graph-lenses";

type GraphState =
  | { status: "loading" }
  | { status: "ready"; graph: RelationGraphPayload }
  | { status: "error"; message: string };

const GRAPH_WIDTH = 960;
const GRAPH_HEIGHT = 560;
const DEFAULT_RELATION_TYPE: RelationTypeKey = "related_to";

function normalize(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function edgeSummary(edge: RelationGraphEdge) {
  if (edge.kind === "manual") {
    return edge.note || edge.label;
  }

  if (edge.kind === "shared-tag" && edge.sharedTags?.length) {
    return edge.sharedTags.join("، ");
  }

  if (edge.kind === "same-type" && edge.sharedType) {
    return edge.sharedType;
  }

  return edge.label;
}

function nodeDate(node: RelationGraphNode, locale: string, unavailableDate: string) {
  const value = node.record?.updatedAt || node.record?.createdAt;
  if (!value) return unavailableDate;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US");
}

function useGraphLayout(nodes: RelationGraphNode[], edges: RelationGraphEdge[], layoutMode: string) {
  return useMemo(() => {
    if (!nodes.length) return new Map<string, { x: number; y: number }>();

    const sorted = [...nodes].sort((left, right) => (right.degree - left.degree) || left.label.localeCompare(right.label, "ar"));
    const centerX = GRAPH_WIDTH / 2;
    const centerY = GRAPH_HEIGHT / 2;
    const positions = new Map<string, { x: number; y: number }>();
    const edgeDegree = new Map<string, number>();

    for (const edge of edges) {
      edgeDegree.set(edge.source, (edgeDegree.get(edge.source) || 0) + edge.weight);
      edgeDegree.set(edge.target, (edgeDegree.get(edge.target) || 0) + edge.weight);
    }

    sorted.forEach((node, index) => {
      if (index === 0 && sorted.length > 2 && layoutMode !== "circle") {
        positions.set(node.id, { x: centerX, y: centerY });
        return;
      }

      const count = Math.max(1, sorted.length - (layoutMode === "circle" ? 0 : 1));
      const adjustedIndex = layoutMode === "circle" ? index : index - 1;
      const angle = ((adjustedIndex / count) * Math.PI * 2) - Math.PI / 2;
      const degree = edgeDegree.get(node.id) || node.degree || 1;
      const ringOffset = layoutMode === "concentric" ? (adjustedIndex % 3) * 62 : 0;
      const organicOffset = layoutMode === "organic" || layoutMode === "auto" ? Math.sin(index * 1.7) * 36 : 0;
      const radius = Math.max(150, Math.min(250, 250 - degree * 7)) + ringOffset + organicOffset;
      positions.set(node.id, {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius
      });
    });

    return positions;
  }, [edges, layoutMode, nodes]);
}

function GraphCanvas({
  nodes,
  edges,
  selectedId,
  searchQuery,
  layoutMode,
  onSelect
}: Readonly<{
  nodes: RelationGraphNode[];
  edges: RelationGraphEdge[];
  selectedId: string;
  searchQuery: string;
  layoutMode: string;
  onSelect: (id: string) => void;
}>) {
  const { t } = useLocale();
  const copy = t.pages.graph;
  const positions = useGraphLayout(nodes, edges, layoutMode);
  const nodeIds = useMemo(() => new Set(nodes.map((node) => node.id)), [nodes]);
  const normalizedQuery = normalize(searchQuery);
  const matchedIds = useMemo(() => {
    if (!normalizedQuery) return new Set<string>();
    return new Set(
      nodes
        .filter((node) => normalize(`${node.label} ${node.type} ${node.tags.join(" ")}`).includes(normalizedQuery))
        .map((node) => node.id)
    );
  }, [nodes, normalizedQuery]);

  const visibleEdges = edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));

  return (
    <div className="graph-canvas-shell" dir="ltr">
      <svg className="graph-canvas" viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`} role="img" aria-label={copy.canvasAriaLabel}>
        <defs>
          <marker id="graph-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M 0 0 L 8 4 L 0 8 z" fill="currentColor" />
          </marker>
        </defs>
        <g className="graph-edges">
          {visibleEdges.map((edge) => {
            const source = positions.get(edge.source);
            const target = positions.get(edge.target);
            if (!source || !target) return null;
            const isDimmed = normalizedQuery && !matchedIds.has(edge.source) && !matchedIds.has(edge.target);
            const isSelected = selectedId && (edge.source === selectedId || edge.target === selectedId);
            const midX = (source.x + target.x) / 2;
            const midY = (source.y + target.y) / 2;

            return (
              <g key={edge.id} className="graph-edge-group">
                <line
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  className="graph-edge"
                  data-kind={edge.kind}
                  data-dimmed={Boolean(isDimmed)}
                  data-selected={Boolean(isSelected)}
                  markerEnd={edge.kind === "manual" ? "url(#graph-arrow)" : undefined}
                />
                {(edge.kind === "manual" || isSelected) ? (
                  <text x={midX} y={midY - 8} className="graph-edge-label" textAnchor="middle">
                    {edge.label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
        <g className="graph-nodes">
          {nodes.map((node) => {
            const point = positions.get(node.id);
            if (!point) return null;
            const selected = node.id === selectedId;
            const matched = !normalizedQuery || matchedIds.has(node.id);
            const radius = Math.max(18, Math.min(34, 18 + node.degree * 2));

            return (
              <g
                key={node.id}
                className="graph-node"
                data-selected={selected}
                data-dimmed={!matched}
                transform={`translate(${point.x} ${point.y})`}
              >
                <circle
                  r={radius}
                  tabIndex={0}
                  role="button"
                  aria-label={node.label}
                  onClick={() => onSelect(node.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(node.id);
                    }
                  }}
                />
                <text y={radius + 18} textAnchor="middle">{node.label}</text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

function NodePanel({
  node,
  relatedEdges,
  onDelete,
  canEdit
}: Readonly<{
  node: RelationGraphNode | null;
  relatedEdges: RelationGraphEdge[];
  onDelete: (edge: RelationGraphEdge) => void;
  canEdit: boolean;
}>) {
  const { locale, t } = useLocale();
  const copy = t.pages.graph.nodePanel;
  if (!node) {
    return (
      <article className="panel panel-compact">
        <h2>{copy.emptyTitle}</h2>
        <p className="helper-text">{copy.emptyDescription}</p>
      </article>
    );
  }

  return (
    <article className="panel panel-compact graph-side-panel">
      <div className="panel-title-row">
        <div>
          <span className="badge">{node.type || copy.record}</span>
          <h2>{node.label}</h2>
        </div>
        <span className="badge">{copy.connections.replace("{count}", String(node.degree))}</span>
      </div>
      <div className="kv-grid">
        <div className="kv-item">
          <strong>{copy.identifier}</strong>
          <span className="wrap-anywhere">{node.id}</span>
        </div>
        <div className="kv-item">
          <strong>{copy.lastUpdated}</strong>
          <span>{nodeDate(node, locale, t.pages.graph.unavailableDate)}</span>
        </div>
      </div>
      {node.tags.length ? (
        <div className="tags">
          {node.tags.slice(0, 8).map((tag) => (
            <span key={tag} className="tag">{tag}</span>
          ))}
        </div>
      ) : null}
      <a className="button button-primary" href={`/archive/${encodeURIComponent(node.id)}`}>
        {copy.openRecord}
      </a>
      <div className="section-divider">
        <strong>{copy.nearbyLinks}</strong>
        {relatedEdges.length ? (
          <ul className="graph-relation-list">
            {relatedEdges.slice(0, 8).map((edge) => (
              <li key={edge.id}>
                <span>
                  <b>{edge.label}</b>
                  <small>{edgeSummary(edge)}</small>
                </span>
                {canEdit && edge.kind === "manual" && edge.relationId ? (
                  <button type="button" className="icon-action" aria-label={copy.deleteRelation} onClick={() => onDelete(edge)}>
                    <Trash2 aria-hidden="true" size={16} />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="helper-text">{copy.noVisibleLinks}</p>
        )}
      </div>
    </article>
  );
}

function RelationForm({
  nodes,
  relationTypes,
  selectedId,
  onCreate
}: Readonly<{
  nodes: RelationGraphNode[];
  relationTypes: RelationTypeOption[];
  selectedId: string;
  onCreate: (payload: { sourceId: string; targetId: string; type: RelationTypeKey; note?: string }) => Promise<void>;
}>) {
  const { t } = useLocale();
  const copy = t.pages.graph.relationForm;
  const [sourceId, setSourceId] = useState(selectedId);
  const [targetId, setTargetId] = useState("");
  const [type, setType] = useState<RelationTypeKey>(DEFAULT_RELATION_TYPE);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (selectedId) setSourceId(selectedId);
  }, [selectedId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");

    if (!sourceId || !targetId) {
      setStatus(copy.sourceTargetRequired);
      return;
    }

    if (sourceId === targetId) {
      setStatus(copy.selfRelation);
      return;
    }

    try {
      await onCreate({ sourceId, targetId, type, note: note.trim() || undefined });
      setTargetId("");
      setNote("");
      setStatus(copy.saved);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : copy.saveFailed);
    }
  }

  return (
    <form className="panel panel-compact auth-form graph-relation-form" onSubmit={handleSubmit}>
      <div className="panel-title-row">
        <h2>{copy.title}</h2>
        <Plus aria-hidden="true" size={18} className="text-accent" />
      </div>
      <label>
        {copy.from}
        <select value={sourceId} onChange={(event) => setSourceId(event.target.value)}>
          <option value="">{copy.sourcePlaceholder}</option>
          {nodes.map((node) => (
            <option key={node.id} value={node.id}>{node.label}</option>
          ))}
        </select>
      </label>
      <label>
        {copy.type}
        <select value={type} onChange={(event) => setType(event.target.value as RelationTypeKey)}>
          {relationTypes.map((option) => (
            <option key={option.key} value={option.key}>{option.label}</option>
          ))}
        </select>
      </label>
      <label>
        {copy.to}
        <select value={targetId} onChange={(event) => setTargetId(event.target.value)}>
          <option value="">{copy.targetPlaceholder}</option>
          {nodes.filter((node) => node.id !== sourceId).map((node) => (
            <option key={node.id} value={node.id}>{node.label}</option>
          ))}
        </select>
      </label>
      <label>
        {copy.note}
        <input value={note} onChange={(event) => setNote(event.target.value)} placeholder={copy.notePlaceholder} />
      </label>
      <button type="submit" className="button button-primary">
        {copy.save}
      </button>
      {status ? <p className="form-status">{status}</p> : null}
    </form>
  );
}

export default function GraphPage() {
  const { locale, t } = useLocale();
  const copy = t.pages.graph;
  const api = useMemo(() => createArchiveApiClient(), []);
  const canEditRelations = useCapability("records.edit");
  const [state, setState] = useState<GraphState>({ status: "loading" });
  const [selectedId, setSelectedId] = useState("");
  const [focusId, setFocusId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [graphLens, setGraphLens] = useState("all");
  const [tagFilter, setTagFilter] = useState("");
  const [layoutMode, setLayoutMode] = useState("auto");
  const [limit, setLimit] = useState(120);

  useEffect(() => {
    const recordId = new URLSearchParams(window.location.search).get("recordId");
    if (recordId) {
      setFocusId(recordId);
      setSelectedId(recordId);
    }
  }, []);

  const loadGraph = useCallback(async () => {
    setState({ status: "loading" });
    try {
      const response = await api.relationGraph({ recordId: focusId || undefined, limit });
      if (!response.ok) {
        setState({ status: "error", message: response.error || copy.errors.load });
        return;
      }
      setState({ status: "ready", graph: response });
      if (response.stats.focusId) {
        setSelectedId(response.stats.focusId);
      }
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : copy.errors.load });
    }
  }, [api, copy.errors.load, focusId, limit]);

  useEffect(() => {
    void loadGraph();
  }, [loadGraph]);

  const graph = state.status === "ready" ? state.graph : null;
  const allNodes = useMemo(() => graph?.nodes ?? [], [graph]);
  const allEdges = useMemo(() => graph?.edges ?? [], [graph]);

  const graphLenses = useMemo(() => buildGraphLenses(allNodes, locale), [allNodes, locale]);

  useEffect(() => {
    setGraphLens(resolveGraphLens(window.localStorage.getItem(GRAPH_LENS_STORAGE_KEY), graphLenses));
  }, [graphLenses]);

  const selectGraphLens = (lensId: string) => {
    setGraphLens(lensId);
    window.localStorage.setItem(GRAPH_LENS_STORAGE_KEY, lensId);
  };

  const tagOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const node of allNodes) {
      for (const tag of node.tags) {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      }
    }
    return [...counts.entries()]
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ar"));
  }, [allNodes]);

  const visibleNodes = useMemo(() => {
    return allNodes.filter((node) => {
      if (graphLens !== "all" && (node.type || "record") !== graphLens) return false;
      if (tagFilter && !node.tags.includes(tagFilter)) return false;
      return true;
    });
  }, [allNodes, graphLens, tagFilter]);

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);
  const visibleEdges = useMemo(
    () => allEdges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)),
    [allEdges, visibleNodeIds]
  );
  const selectedNode = allNodes.find((node) => node.id === selectedId) ?? null;
  const relatedEdges = visibleEdges.filter((edge) => edge.source === selectedId || edge.target === selectedId);

  const createRelation = async (payload: { sourceId: string; targetId: string; type: RelationTypeKey; note?: string }) => {
    const response = await api.createRelation(payload);
    if (!response.ok) {
      throw new Error(response.error || copy.errors.save);
    }
    setSelectedId(payload.sourceId);
    await loadGraph();
  };

  const deleteRelation = async (edge: RelationGraphEdge) => {
    if (!edge.relationId) return;
    const response = await api.deleteRelation(edge.relationId);
    if (!response.ok) {
      setState({ status: "error", message: response.error || copy.errors.delete });
      return;
    }
    await loadGraph();
  };

  return (
    <AppShell subtitle={t.pageTitles.relationshipMap} navLabel={t.pageTitles.relationships} tipsPage="graph">
      <PageToolbar
        eyebrow={<span className="badge">{copy.toolbar.eyebrow}</span>}
        title={copy.toolbar.title}
        description={copy.toolbar.description}
        meta={graph ? (
          <>
            <span className="badge">{copy.toolbar.nodes.replace("{count}", String(graph.stats.nodeCount))}</span>
            <span className="badge">{copy.toolbar.connections.replace("{count}", String(graph.stats.edgeCount))}</span>
            <span className="badge">{copy.toolbar.manual.replace("{count}", String(graph.stats.manualEdgeCount))}</span>
            <span className="badge">{copy.toolbar.inferred.replace("{count}", String(graph.stats.inferredEdgeCount))}</span>
          </>
        ) : null}
        actions={(
          <button type="button" className="button button-primary" onClick={() => void loadGraph()}>
            <RefreshCw aria-hidden="true" size={16} />
            {copy.toolbar.refresh}
          </button>
        )}
      >
        <div className="search-form graph-toolbar" role="search">
          <label className="graph-toolbar-field">
            <Search aria-hidden="true" size={16} />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="search-input"
              placeholder={copy.toolbar.searchPlaceholder}
              aria-label={copy.toolbar.searchAriaLabel}
            />
          </label>
          <label>
            <Link2 aria-hidden="true" size={16} />
            <select aria-label={copy.toolbar.tagFilterAriaLabel} value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
              <option value="">{copy.toolbar.allTags}</option>
              {tagOptions.map(([tag, count]) => (
                <option key={tag} value={tag}>{tag} ({count})</option>
              ))}
            </select>
          </label>
          <label>
            <GitBranch aria-hidden="true" size={16} />
            <select aria-label={copy.toolbar.layoutAriaLabel} value={layoutMode} onChange={(event) => setLayoutMode(event.target.value)}>
              <option value="auto">{copy.toolbar.layoutAuto}</option>
              <option value="organic">{copy.toolbar.layoutOrganic}</option>
              <option value="concentric">{copy.toolbar.layoutConcentric}</option>
              <option value="circle">{copy.toolbar.layoutCircle}</option>
            </select>
          </label>
        </div>
      </PageToolbar>

      {graphLenses.length > 1 ? (
        <div className="graph-lenses" role="group" aria-label={copy.lenses.ariaLabel}>
          <Filter aria-hidden="true" size={17} />
          {graphLenses.map((lens) => (
            <button
              className="badge graph-lens"
              data-active={graphLens === lens.id}
              type="button"
              aria-pressed={graphLens === lens.id}
              key={lens.id}
              onClick={() => selectGraphLens(lens.id)}
            >
              {lens.label} <span aria-label={copy.lenses.recordCount.replace("{count}", String(lens.count))}>{lens.count}</span>
            </button>
          ))}
        </div>
      ) : null}

      {state.status === "loading" ? (
        <section className="page-section" role="status" aria-live="polite">
          <div className="panel panel-compact">
            <Skeleton label={copy.loading} />
          </div>
        </section>
      ) : null}

      {state.status === "error" ? (
        <section className="page-section">
          <div className="state-banner state-banner-error" role="alert">
            <strong>{copy.loadErrorTitle}</strong>
            <span className="helper-text">{state.message}</span>
          </div>
        </section>
      ) : null}

      {graph && allNodes.length === 0 ? (
        <section className="page-section">
          <EmptyState
            title={copy.emptyGraph.title}
            description={copy.emptyGraph.description}
            actions={<a className="button button-primary" href="/uploads">{copy.emptyGraph.addRecord}</a>}
          />
        </section>
      ) : null}

      {graph && allNodes.length > 0 ? (
        <section className="graph-workspace" aria-label={copy.workspace.ariaLabel}>
          <div className="graph-main-panel">
            <div className="toolbar-row">
              <div className="button-row">
                <button type="button" className="badge" data-active={!focusId} onClick={() => setFocusId("")}>{copy.workspace.allNetwork}</button>
                {selectedId ? (
                  <button type="button" className="badge" data-active={focusId === selectedId} onClick={() => setFocusId(selectedId)}>
                    {copy.workspace.focusSelected}
                  </button>
                ) : null}
                <button type="button" className="badge" onClick={() => setLimit((value) => Math.min(200, value + 40))}>
                  {copy.workspace.loadMore}
                </button>
              </div>
              <span className="helper-text">{copy.workspace.filteredNodes.replace("{count}", String(visibleNodes.length))}</span>
            </div>
            {visibleNodes.length ? (
              <GraphCanvas
                nodes={visibleNodes}
                edges={visibleEdges}
                selectedId={selectedId}
                searchQuery={searchQuery}
                layoutMode={layoutMode}
                onSelect={setSelectedId}
              />
            ) : (
              <EmptyState
                title={copy.workspace.noMatchingNodes}
                description={copy.workspace.noMatchingNodesDescription}
              />
            )}
          </div>

          <aside className="graph-sidebar">
            <NodePanel node={selectedNode} relatedEdges={relatedEdges} onDelete={deleteRelation} canEdit={canEditRelations} />
            {canEditRelations ? (
              <RelationForm
                nodes={allNodes}
                relationTypes={graph.relationTypes}
                selectedId={selectedId}
                onCreate={createRelation}
              />
            ) : (
              <p className="helper-text">{copy.workspace.cannotCreate}</p>
            )}
          </aside>
        </section>
      ) : null}
    </AppShell>
  );
}

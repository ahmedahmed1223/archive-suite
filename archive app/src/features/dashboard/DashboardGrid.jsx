import * as React from "react";
import { Responsive as ResponsiveGridLayout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { GripVertical, EyeOff, MoveVertical, Lock } from "lucide-react";

import {
  toGridLayout,
  applyGridChange
} from "./dashboardLayoutModel.js";

const ROW_HEIGHT = 8;
const MARGIN = [12, 8];
const BREAKPOINTS = { lg: 1024, md: 768, xs: 0 };
const COLS = { lg: 12, md: 8, xs: 1 };
const DRAG_CANCEL_SELECTOR = ".va-dashboard-drag-cancel, button, a, input, textarea, select, label, [role='button'], [role='link'], [contenteditable='true']";

// Convert a measured pixel height into a whole number of grid rows.
function pxToRows(px) {
  return Math.max(2, Math.ceil((px + MARGIN[1]) / (ROW_HEIGHT + MARGIN[1])));
}

function stopGridDragStart(event) {
  event.stopPropagation();
}

/**
 * One grid cell: optional edit toolbar (drag handle + auto/manual height toggle
 * + hide), and the panel content. When auto-height is on, a ResizeObserver
 * reports the content height back so the parent can size the cell to fit.
 */
function GridPanel({ id, title, editing, autoHeight, onMeasure, onToggleHidden, onToggleAuto, children }) {
  const contentRef = React.useRef(null);

  React.useEffect(() => {
    if (!autoHeight) return undefined;
    const el = contentRef.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    // scrollHeight gives the natural content height even when the flex cell
    // clamps it; add room for the edit toolbar so content is not clipped.
    const report = () => onMeasure(id, pxToRows(el.scrollHeight + (editing ? 40 : 0)));
    const ro = new ResizeObserver(report);
    ro.observe(el);
    report();
    return () => ro.disconnect();
  }, [id, autoHeight, onMeasure, editing]);

  return (
    <div className={`va-dashboard-grid-item flex h-full flex-col ${editing ? "va-dashboard-grid-item-editing" : ""}`}>
      {editing && (
        <div className="va-panel-toolbar flex items-center justify-between gap-2 rounded-t-2xl border-b border-white/10 bg-white/[0.04] px-3 py-1.5">
          <span className="va-panel-drag flex min-w-0 cursor-move items-center gap-1.5 text-xs font-semibold text-gray-300" title="اسحب لإعادة الترتيب">
            <GripVertical className="h-4 w-4 shrink-0 text-gray-500" />
            <span className="truncate">{title}</span>
          </span>
          <span
            className="va-dashboard-drag-cancel flex shrink-0 items-center gap-1"
            onMouseDownCapture={stopGridDragStart}
            onPointerDownCapture={stopGridDragStart}
            onTouchStartCapture={stopGridDragStart}
          >
            <button
              type="button"
              onClick={() => onToggleAuto(id)}
              aria-pressed={autoHeight}
              title={autoHeight ? "الارتفاع تلقائي — اضغط للتثبيت اليدوي" : "ارتفاع يدوي — اضغط للتلقائي"}
              aria-label={autoHeight ? "تبديل إلى ارتفاع يدوي" : "تبديل إلى ارتفاع تلقائي"}
              className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border ${autoHeight ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-white/10 text-gray-400 hover:bg-white/5"}`}
            >
              {autoHeight ? <MoveVertical className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={() => onToggleHidden(id)}
              title="إخفاء اللوحة"
              aria-label={`إخفاء لوحة ${title}`}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-gray-400 hover:bg-red-500/10 hover:text-red-200"
            >
              <EyeOff className="h-3.5 w-3.5" />
            </button>
          </span>
        </div>
      )}
      <div
        ref={contentRef}
        className="va-dashboard-drag-cancel min-h-0 flex-1"
        onMouseDownCapture={stopGridDragStart}
        onPointerDownCapture={stopGridDragStart}
        onTouchStartCapture={stopGridDragStart}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Customizable dashboard grid. `children` is a flat array of panel elements,
 * each created with a `key` equal to its panel id (falsy entries are ignored,
 * so conditional panels can be passed inline). `titles` maps id -> label for
 * the edit toolbar. `layout` is the normalized layout object; `onChange(next)`
 * fires for any drag/resize/auto-height/hide change.
 */
export function DashboardGrid({ children, titles = {}, layout, editing = false, onChange, onToggleHidden, onToggleAuto, prefersReducedMotion = false }) {
  const nodes = (Array.isArray(children) ? children : [children]).filter(Boolean);
  const nodeById = {};
  for (const node of nodes) { if (node && node.key != null) nodeById[node.key] = node; }
  const availableIds = Object.keys(nodeById);
  const layoutRef = React.useRef(layout);
  layoutRef.current = layout;

  // Measured content heights (id -> rows), kept LOCAL so settings hydration /
  // layout resets never clobber them and they never feed back into the saved
  // layout (which would loop). Applied at render only, for auto-height panels.
  const [measured, setMeasured] = React.useState({});
  const baseGrid = toGridLayout(layout, availableIds);
  const gridLayout = baseGrid.map((n) => {
    const it = layout.items[n.i];
    return (it && it.autoHeight !== false && measured[n.i]) ? { ...n, h: measured[n.i] } : n;
  });

  // This RGL build dropped the WidthProvider HOC, so measure the container
  // width ourselves and feed it to ResponsiveGridLayout.
  const wrapRef = React.useRef(null);
  const [width, setWidth] = React.useState(0);
  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") {
      if (el) setWidth(el.clientWidth);
      return undefined;
    }
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Auto-height: update a panel's row count only when it actually changed,
  // which prevents an onLayoutChange feedback loop.
  const handleMeasure = React.useCallback((id, rows) => {
    setMeasured((prev) => (prev[id] === rows ? prev : { ...prev, [id]: rows }));
  }, []);

  const handleLayoutChange = React.useCallback((nextRgl) => {
    if (!editing) return;
    const next = applyGridChange(layoutRef.current, nextRgl);
    // applyGridChange preserves auto-height h; only commit if something moved.
    const a = JSON.stringify(toGridLayout(layoutRef.current, availableIds).map((n) => [n.i, n.x, n.y, n.w]));
    const b = JSON.stringify(nextRgl.map((n) => [n.i, n.x, n.y, n.w]));
    if (a !== b) onChange(next);
  }, [editing, onChange, availableIds]);

  return (
    <div ref={wrapRef} className="va-dashboard-grid-wrap">
    {width > 0 && (
    <ResponsiveGridLayout
      className={`va-dashboard-grid ${editing ? "va-dashboard-grid-editing" : ""}`}
      width={width}
      layouts={{ lg: gridLayout, md: gridLayout, xs: gridLayout }}
      breakpoints={BREAKPOINTS}
      cols={COLS}
      rowHeight={ROW_HEIGHT}
      margin={MARGIN}
      isDraggable={editing}
      isResizable={editing}
      isBounded={true}
      draggableHandle=".va-panel-drag"
      draggableCancel={DRAG_CANCEL_SELECTOR}
      compactType="vertical"
      useCSSTransforms={!prefersReducedMotion}
      onLayoutChange={handleLayoutChange}
      onResizeStop={handleLayoutChange}
      onDragStop={handleLayoutChange}
    >
      {gridLayout.map((node) => {
        const id = node.i;
        const item = layout.items[id] || {};
        return (
          <div key={id}>
            <GridPanel
              id={id}
              title={titles[id] || id}
              editing={editing}
              autoHeight={item.autoHeight !== false}
              onMeasure={handleMeasure}
              onToggleHidden={onToggleHidden}
              onToggleAuto={onToggleAuto}
            >
              {nodeById[id]}
            </GridPanel>
          </div>
        );
      })}
    </ResponsiveGridLayout>
    )}
    </div>
  );
}

export default DashboardGrid;

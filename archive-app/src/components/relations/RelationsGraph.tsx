import * as React from "react";
import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

function toElements(nodes: any = [], edges: any = [], centerId: any = null) {
  const elements = [];
  for (const node of nodes) {
    elements.push({
      group: "nodes",
      data: {
        id: node.id,
        label: node.label || node.id,
        isCenter: node.id === centerId
      }
    });
  }
  for (const edge of edges) {
    if (!edge.source || !edge.target) continue;
    elements.push({
      group: "edges",
      data: {
        id: edge.id || `${edge.source}-${edge.target}-${edge.type}`,
        source: edge.source,
        target: edge.target,
        label: edge.label || edge.type || ""
      }
    });
  }
  return elements;
}

function createStylesheet() {
  return [
    {
      selector: "node",
      style: {
        "background-color": "#374151",
        "border-color": "#4b5563",
        "border-width": 1,
        color: "#d1d5db",
        "font-size": 11,
        label: "data(label)",
        "text-valign": "bottom",
        "text-margin-y": 4,
        "text-wrap": "ellipsis",
        "text-max-width": 80,
        width: 28,
        height: 28
      }
    },
    {
      selector: "node[?isCenter]",
      style: {
        "background-color": "#10b981",
        "border-color": "#34d399",
        "border-width": 2,
        color: "#ffffff",
        width: 36,
        height: 36
      }
    },
    {
      selector: "node:selected",
      style: {
        "background-color": "#3b82f6",
        "border-color": "#60a5fa",
        "border-width": 2,
        color: "#ffffff"
      }
    },
    {
      selector: "edge",
      style: {
        "line-color": "#374151",
        "target-arrow-color": "#374151",
        "target-arrow-shape": "triangle",
        "curve-style": "bezier",
        width: 1.5,
        label: "data(label)",
        "font-size": 9,
        color: "#6b7280",
        "text-rotation": "autorotate"
      }
    }
  ];
}

/**
 * RelationsGraph — embeddable cytoscape graph for item relations.
 *
 * @param {object} props
 * @param {{ nodes: object[], edges: object[] }} props.graph
 * @param {string} [props.centerId]  - id of the focal item (highlighted)
 * @param {(id: string) => void} [props.onNodeClick]
 * @param {string} [props.className]
 */
export function RelationsGraph({ graph, centerId, onNodeClick, className = "" }: any) {
  const containerRef = React.useRef(null);
  const cyRef = React.useRef<any>(null);
  const [error, setError] = React.useState("");

  const nodes = graph?.nodes || [];
  const edges = graph?.edges || [];
  const hasGraph = nodes.length > 0;

  React.useEffect(() => {
    if (!hasGraph || !containerRef.current) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { default: cytoscape } = await import("cytoscape");
        if (cancelled || !containerRef.current) return;
        (cyRef.current as any)?.destroy();
        const cy = cytoscape({
          container: containerRef.current,
          elements: toElements(nodes, edges, centerId) as any,
          style: createStylesheet() as any,
          layout: {
            name: nodes.length <= 6 ? "circle" : "cose",
            animate: false,
            padding: 20,
            nodeRepulsion: () => 4500,
            idealEdgeLength: () => 80,
            nodeOverlap: 20
          },
          minZoom: 0.3,
          maxZoom: 3,
          wheelSensitivity: 0.15,
          pixelRatio: 1
        });
        cy.on("tap", "node", (event: any) => {
          const id = event.target.id();
          onNodeClick?.(id);
        });
        cyRef.current = cy;
        setError("");
      } catch (err: any) {
        if (!cancelled) setError(err?.message || "تعذّر تحميل الرسم البياني");
      }
    })();
    return () => {
      cancelled = true;
      (cyRef.current as any)?.destroy();
      cyRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasGraph, nodes.length, edges.length, centerId]);

  const zoomBy = (factor: any) => {
    const cy = cyRef.current;
    if (!cy) return;
    (cy as any).zoom({ level: (cy as any).zoom() * factor, renderedPosition: { x: (cy as any).width() / 2, y: (cy as any).height() / 2 } });
  };

  const fitAll = () => (cyRef.current as any)?.fit(undefined, 20);

  if (!hasGraph) {
    return (
      <div className={`flex items-center justify-center rounded-xl border border-dashed border-white/10 bg-gray-950/30 p-6 text-xs text-gray-500 ${className}`}>
        لا توجد علاقات لعرضها
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-xl border border-white/10 bg-gray-950/30 ${className}`}>
      {error && (
        <div className="absolute inset-x-0 top-0 z-10 rounded-t-xl bg-red-950/80 px-3 py-2 text-xs text-red-300" role="alert">
          {error}
        </div>
      )}
      <div ref={containerRef} className="h-64 w-full" aria-label="رسم العلاقات التفاعلي" />
      {/* Zoom controls */}
      <div className="absolute bottom-3 left-3 flex flex-col gap-1">
        <button type="button" onClick={() => zoomBy(1.3)} aria-label="تكبير"
          className="rounded-lg border border-white/10 bg-gray-900/80 p-1.5 text-gray-400 backdrop-blur-sm hover:bg-gray-800/80 hover:text-white">
          <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button type="button" onClick={() => zoomBy(0.75)} aria-label="تصغير"
          className="rounded-lg border border-white/10 bg-gray-900/80 p-1.5 text-gray-400 backdrop-blur-sm hover:bg-gray-800/80 hover:text-white">
          <ZoomOut className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button type="button" onClick={fitAll} aria-label="ملاءمة الكل"
          className="rounded-lg border border-white/10 bg-gray-900/80 p-1.5 text-gray-400 backdrop-blur-sm hover:bg-gray-800/80 hover:text-white">
          <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

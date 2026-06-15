import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";

import {
  buildClipLayout,
  moveClip,
  totalDuration
} from "../../features/montage/timelineModel.js";
import { peaksToBars, placeholderPeaks } from "../../features/montage/waveform.js";

/**
 * TimelineTrack — visual montage timeline (§793).
 *
 * Renders the project's rough cuts as proportional blocks on a horizontal track
 * with a time ruler and a per-clip waveform strip. Supports selecting a clip and
 * dragging it left/right to reorder (wired through the pure `moveClip`, persisted
 * by the caller via `onMoveClip`). Failure-safe: with no clips it shows a hint;
 * with no decoded audio it draws a deterministic placeholder waveform.
 *
 * Pure logic lives in features/montage/*; this file is rendering + DOM events
 * only, matching the jsx/jsxs runtime used across the projects page.
 */

const TRACK_HEIGHT = 64;
const WAVE_HEIGHT = 28;
const WAVE_BUCKETS = 28;
const RULER_STEP_PX = 80;

function formatTick(sec) {
  const s = Math.max(0, Math.round(sec));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

/** SVG waveform for one clip block. Uses decoded peaks when present. */
function ClipWaveform({ clip, widthPx, peaks }) {
  const series = peaks && peaks.length ? peaks : placeholderPeaks(clip, WAVE_BUCKETS);
  const bars = peaksToBars(series, WAVE_HEIGHT);
  const count = bars.length || 1;
  const barWidth = Math.max(1, widthPx / count - 1);
  return jsx("svg", {
    width: "100%",
    height: WAVE_HEIGHT,
    viewBox: `0 0 ${Math.max(1, widthPx)} ${WAVE_HEIGHT}`,
    preserveAspectRatio: "none",
    "aria-hidden": "true",
    className: "block",
    children: bars.map((h, i) => jsx("rect", {
      x: (i / count) * widthPx,
      y: (WAVE_HEIGHT - h) / 2,
      width: barWidth,
      height: h,
      rx: 1,
      className: "fill-emerald-300/50"
    }, i))
  });
}

/** A ruler with minute:second ticks across the timeline width. */
function Ruler({ widthPx, pxPerSecond }) {
  const ticks = [];
  for (let x = 0; x <= widthPx; x += RULER_STEP_PX) {
    ticks.push(jsxs("div", {
      className: "absolute top-0 flex h-full flex-col items-start",
      style: { right: x },
      children: [
        jsx("span", { className: "h-2 w-px bg-white/15" }),
        jsx("span", { className: "mt-0.5 text-[10px] tabular-nums text-gray-500", children: formatTick(x / pxPerSecond) })
      ]
    }, x));
  }
  return jsx("div", { className: "relative mb-1 h-6 w-full", style: { minWidth: widthPx }, children: ticks });
}

export function TimelineTrack({
  clips = [],
  selectedId = null,
  onSelect,
  onMoveClip,
  pxPerSecond = 12,
  peaksByClipId = null
}) {
  const trackRef = React.useRef(null);
  const dragRef = React.useRef(null);
  const [dragId, setDragId] = React.useState(null);

  const layout = React.useMemo(
    () => buildClipLayout(clips, { pxPerSecond }),
    [clips, pxPerSecond]
  );
  const totalSec = totalDuration(clips);
  const widthPx = Math.max(240, totalSec * pxPerSecond);

  const handlePointerUp = React.useCallback(
    (event) => {
      const drag = dragRef.current;
      dragRef.current = null;
      setDragId(null);
      if (!drag || !trackRef.current || typeof onMoveClip !== "function") return;
      const rect = trackRef.current.getBoundingClientRect();
      // RTL track: distance from the right edge maps to timeline seconds.
      const offsetPx = Math.max(0, rect.right - event.clientX);
      const dropSec = offsetPx / pxPerSecond;
      const next = moveClip(clips, drag.id, dropSec);
      onMoveClip(next);
    },
    [clips, onMoveClip, pxPerSecond]
  );

  React.useEffect(() => {
    if (!dragId) return undefined;
    const onUp = (e) => handlePointerUp(e);
    window.addEventListener("pointerup", onUp);
    return () => window.removeEventListener("pointerup", onUp);
  }, [dragId, handlePointerUp]);

  const startDrag = (clip) => (event) => {
    event.stopPropagation();
    dragRef.current = { id: clip.id };
    setDragId(clip.id);
    onSelect?.(clip.id);
  };

  if (!layout.length) {
    return jsx("div", {
      className: "rounded-xl border border-dashed border-white/10 bg-gray-950/30 p-6 text-center text-sm text-gray-500",
      children: "الخطّ الزمني المرئي فارغ — أضف قصاصة لعرضها هنا."
    });
  }

  return jsxs("div", {
    className: "rounded-xl border border-white/10 bg-gray-950/40 p-3",
    children: [
      jsxs("div", { className: "mb-2 flex items-center justify-between text-xs text-gray-500", children: [
        jsx("span", { children: "محرر مرئي — اسحب القصاصة لإعادة ترتيبها" }),
        jsx("span", { className: "tabular-nums", children: formatTick(totalSec) })
      ] }),
      jsx("div", {
        className: "overflow-x-auto pb-1",
        dir: "rtl",
        children: jsxs("div", {
          ref: trackRef,
          className: "relative",
          style: { width: widthPx, minWidth: widthPx },
          children: [
            jsx(Ruler, { widthPx, pxPerSecond }),
            jsx("div", {
              className: "relative",
              style: { height: TRACK_HEIGHT },
              children: layout.map((clip) => {
                const selected = clip.id === selectedId;
                const dragging = clip.id === dragId;
                const peaks = peaksByClipId ? peaksByClipId[clip.id] : null;
                return jsxs("button", {
                  type: "button",
                  onPointerDown: startDrag(clip),
                  onClick: () => onSelect?.(clip.id),
                  "aria-label": `قصاصة ${clip.label || clip.itemId} — المدة ${formatTick(clip.durationSec)}`,
                  "aria-pressed": selected,
                  className: [
                    "absolute top-0 flex h-full flex-col overflow-hidden rounded-lg border text-right transition-colors",
                    selected ? "va-accent-border va-accent-bg-soft" : "border-white/15 bg-gray-900/70 hover:border-white/30",
                    dragging ? "opacity-70 ring-2 ring-emerald-400/40" : ""
                  ].join(" "),
                  style: {
                    right: clip.startPx,
                    width: Math.max(28, clip.widthPx),
                    cursor: "grab",
                    touchAction: "none"
                  },
                  children: [
                    jsx("span", {
                      className: "truncate px-2 pt-1 text-[11px] font-semibold text-white",
                      children: clip.label || clip.itemId || "قصاصة"
                    }),
                    jsx("div", { className: "mt-auto px-1 pb-1", children: jsx(ClipWaveform, { clip, widthPx: Math.max(28, clip.widthPx), peaks }) })
                  ]
                }, clip.id);
              })
            })
          ]
        })
      })
    ]
  });
}

export default TimelineTrack;

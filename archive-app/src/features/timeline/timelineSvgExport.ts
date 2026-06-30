/**
 * Pure SVG export for the Timeline horizontal axis view.
 * No DOM, no React — takes lane/bucket data and returns a standalone SVG string.
 */

import type { TimelineLanesResult } from "./timelineSelectors.js";

// ponytail: manual XML escaping — only 5 chars need escaping in SVG text nodes, no dep needed
function esc(text: string): string {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface SvgOptions {
  /** Exported-at timestamp label (ISO string) */
  exportedAt?: string;
}

const LANE_HEIGHT = 120;
const BUCKET_W = 100;
const BUCKET_GAP = 20;
const MARGIN = { top: 56, right: 24, bottom: 32, left: 160 };
const COLORS = [
  "#10b981", "#3b82f6", "#8b5cf6", "#f59e0b",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#ef4444", "#6b7280"
];

function laneColor(index: number): string {
  return COLORS[index % COLORS.length];
}

/**
 * Build a standalone SVG string representing the current timeline view.
 * Returns an empty string when there are no lanes.
 */
export function buildTimelineSvg(
  lanesResult: TimelineLanesResult,
  options: SvgOptions = {}
): string {
  const { lanes } = lanesResult;
  if (!lanes.length) return "";

  // Collect all unique bucket keys (the shared x-axis)
  const allBucketKeys = [...new Set(
    lanes.flatMap((lane) => lane.buckets.map((b) => b.key))
  )].sort();

  const bucketCount = allBucketKeys.length;
  const colW = BUCKET_W + BUCKET_GAP;
  const contentW = bucketCount * colW + BUCKET_GAP;
  const width = MARGIN.left + contentW + MARGIN.right;
  const height = MARGIN.top + lanes.length * LANE_HEIGHT + MARGIN.bottom;

  const lines: string[] = [];

  lines.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="الخط الزمني">`
  );

  // Background
  lines.push(`<rect width="${width}" height="${height}" fill="#0f172a"/>`);

  // Title
  const title = esc("الخط الزمني" + (options.exportedAt ? " · " + options.exportedAt.slice(0, 10) : ""));
  lines.push(
    `<text x="${MARGIN.left}" y="30" font-family="system-ui,sans-serif" font-size="16" font-weight="bold" fill="#f1f5f9">${title}</text>`
  );

  // X-axis bucket labels
  allBucketKeys.forEach((key, i) => {
    const cx = MARGIN.left + i * colW + colW / 2;
    lines.push(
      `<text x="${cx}" y="${MARGIN.top - 8}" font-family="system-ui,sans-serif" font-size="10" fill="#94a3b8" text-anchor="middle">${esc(key)}</text>`
    );
    // Vertical grid line
    lines.push(
      `<line x1="${cx}" y1="${MARGIN.top - 4}" x2="${cx}" y2="${height - MARGIN.bottom}" stroke="#1e293b" stroke-width="1"/>`
    );
  });

  // Lane rows
  lanes.forEach((lane, laneIndex) => {
    const color = laneColor(laneIndex);
    const rowY = MARGIN.top + laneIndex * LANE_HEIGHT;
    const centerY = rowY + LANE_HEIGHT / 2;

    // Lane label (right side, since RTL, but SVG left-positions from MARGIN.left)
    lines.push(
      `<text x="${MARGIN.left - 8}" y="${centerY + 5}" font-family="system-ui,sans-serif" font-size="12" fill="${color}" text-anchor="end" font-weight="600">${esc(lane.label)}</text>`
    );

    // Row separator
    lines.push(
      `<line x1="${MARGIN.left}" y1="${rowY}" x2="${MARGIN.left + contentW}" y2="${rowY}" stroke="#1e293b" stroke-width="1"/>`
    );

    // Baseline connector
    if (lane.buckets.length > 1) {
      const firstI = allBucketKeys.indexOf(lane.buckets[0].key);
      const lastI = allBucketKeys.indexOf(lane.buckets[lane.buckets.length - 1].key);
      if (firstI >= 0 && lastI >= 0) {
        const x1 = MARGIN.left + firstI * colW + colW / 2;
        const x2 = MARGIN.left + lastI * colW + colW / 2;
        lines.push(
          `<line x1="${x1}" y1="${centerY}" x2="${x2}" y2="${centerY}" stroke="${color}44" stroke-width="2"/>`
        );
      }
    }

    // Buckets
    lane.buckets.forEach((bucket) => {
      const i = allBucketKeys.indexOf(bucket.key);
      if (i < 0) return;
      const cx = MARGIN.left + i * colW + colW / 2;
      const maxR = 28;
      const minR = 10;
      const r = lane.maxCount > 0
        ? minR + Math.round(((bucket.count / lane.maxCount) * (maxR - minR)))
        : minR;

      lines.push(
        `<circle cx="${cx}" cy="${centerY}" r="${r}" fill="${color}99" stroke="${color}" stroke-width="1.5"/>`
      );
      lines.push(
        `<text x="${cx}" y="${centerY + 4}" font-family="system-ui,sans-serif" font-size="10" fill="#f1f5f9" text-anchor="middle" font-weight="bold">${esc(String(bucket.count))}</text>`
      );
      // Bucket label below
      lines.push(
        `<text x="${cx}" y="${centerY + r + 14}" font-family="system-ui,sans-serif" font-size="9" fill="#94a3b8" text-anchor="middle">${esc(bucket.label)}</text>`
      );
    });
  });

  lines.push("</svg>");
  return lines.join("\n");
}

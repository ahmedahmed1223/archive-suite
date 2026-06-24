// Broadcast container detection and metadata extraction for the ingest pipeline.
// Detects MXF/XDCAM/MPEG-TS files on ingest and extracts broadcast metadata via ffprobe.
// Returns null gracefully on failure — never crashes the ingest sweep.

import { extname } from "node:path";
import { probeBroadcastMetadata } from "./broadcastPlan.js";

// File extensions that indicate a broadcast container.
const BROADCAST_EXTENSIONS = new Set([".mxf", ".xdcam", ".mts", ".m2ts", ".op1a"]);

/**
 * Returns true if the file path has a broadcast container extension.
 *
 * @param {string} filePath
 * @returns {boolean}
 */
export function isBroadcastFile(filePath) {
  if (!filePath || typeof filePath !== "string") return false;
  return BROADCAST_EXTENSIONS.has(extname(filePath).toLowerCase());
}

/**
 * Extract broadcast metadata from a file (MXF / XDCAM / MPEG-TS etc.).
 * Returns null if the file is not a broadcast container OR if ffprobe fails.
 * Never throws — failures are swallowed so ingest is not disrupted.
 *
 * @param {string} filePath
 * @param {{ runFfprobe?: Function }} [options]  injectable runner for testing
 * @returns {Promise<import("./broadcastPlan.js").BroadcastMetadata & { extractedAt: string } | null>}
 */
export async function extractBroadcastMetadata(filePath, options = {}) {
  if (!isBroadcastFile(filePath)) return null;

  try {
    const probeOpts = {};
    if (options.runFfprobe) probeOpts.runFfprobe = options.runFfprobe;

    const meta = await probeBroadcastMetadata(filePath, probeOpts);
    if (!meta) return null;

    return { ...meta, extractedAt: new Date().toISOString() };
  } catch {
    // Graceful degradation — ffprobe absent or file unreadable.
    return null;
  }
}

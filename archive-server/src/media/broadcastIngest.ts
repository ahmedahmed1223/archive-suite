// Broadcast container detection and metadata extraction for the ingest pipeline.
// Detects MXF/XDCAM/MPEG-TS files on ingest and extracts broadcast metadata via ffprobe.
// Returns null gracefully on failure — never crashes the ingest sweep.

import { extname } from "node:path";
import { probeBroadcastMetadata } from "./broadcastPlan.js";

// File extensions that indicate a broadcast container.
const BROADCAST_EXTENSIONS = new Set([".mxf", ".xdcam", ".mts", ".m2ts", ".op1a"]);

export function isBroadcastFile(filePath: string): boolean {
  if (!filePath || typeof filePath !== "string") return false;
  return BROADCAST_EXTENSIONS.has(extname(filePath).toLowerCase());
}

export async function extractBroadcastMetadata(
  filePath: string,
  options: { runFfprobe?: (cmd: string, args: string[], opts: { timeoutMs?: number }) => Promise<{ stdout: string; stderr: string }> } = {}
): Promise<BroadcastMetadata & { extractedAt: string } | null> {
  if (!isBroadcastFile(filePath)) return null;

  try {
    const probeOpts: { runFfprobe?: (cmd: string, args: string[], opts: { timeoutMs?: number }) => Promise<{ stdout: string; stderr: string }> } = {};
    if (options.runFfprobe) probeOpts.runFfprobe = options.runFfprobe;

    const meta = await probeBroadcastMetadata(filePath, probeOpts);
    if (!meta) return null;

    return { ...meta, extractedAt: new Date().toISOString() };
  } catch {
    // Graceful degradation — ffprobe absent or file unreadable.
    return null;
  }
}

export interface BroadcastMetadata {
  timecode: string | null;
  reelName: string | null;
  durationSec: number | null;
  width: number | null;
  height: number | null;
  codec: string | null;
  frameRate: number | null;
}

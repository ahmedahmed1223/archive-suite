// Projects / Montage — pure logic + localStorage persistence.
// Ported from legacy archive-app/src/features/projects/viewModel.ts (buildEdl,
// secondsToTimecode, rough-cut ops) and exportClient.ts (safeFileName).
// Pure functions only (no DOM) except the storage helpers, so the EDL/JSON
// export formatting stays unit-testable.
// ponytail: single-track port; legacy multi-track/filters/transitions dropped —
// re-port from archive-app/src/features/montage if timeline effects return.

export interface MontageClip {
  id: string;
  itemId: string;
  title: string;
  inSec: number;
  outSec: number;
  order: number;
}

export interface MontageProject {
  id: string;
  name: string;
  description: string;
  fps: number;
  clips: MontageClip[];
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_FPS = 25;

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function toNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function createProject(name: string, description = ""): MontageProject {
  const now = new Date().toISOString();
  return {
    id: uid("project"),
    name: name.trim(),
    description: description.trim(),
    fps: DEFAULT_FPS,
    clips: [],
    createdAt: now,
    updatedAt: now
  };
}

export function isValidClip(clip: MontageClip): boolean {
  return Boolean(clip.itemId) && toNum(clip.inSec) < toNum(clip.outSec);
}

export function clipDuration(clip: MontageClip): number {
  return Math.max(0, toNum(clip.outSec) - toNum(clip.inSec));
}

export function orderedClips(project: MontageProject): MontageClip[] {
  return [...project.clips].sort((a, b) => a.order - b.order);
}

export function projectDuration(project: MontageProject): number {
  return orderedClips(project).filter(isValidClip).reduce((sum, clip) => sum + clipDuration(clip), 0);
}

export function addClip(
  project: MontageProject,
  partial: { itemId: string; title: string; inSec: number; outSec: number }
): MontageProject {
  const clip: MontageClip = {
    id: uid("cut"),
    itemId: partial.itemId,
    title: partial.title.trim(),
    inSec: toNum(partial.inSec),
    outSec: toNum(partial.outSec),
    order: project.clips.length
  };
  return { ...project, clips: [...project.clips, clip], updatedAt: new Date().toISOString() };
}

export function removeClip(project: MontageProject, clipId: string): MontageProject {
  const clips = project.clips.filter((clip) => clip.id !== clipId).map((clip, order) => ({ ...clip, order }));
  return { ...project, clips, updatedAt: new Date().toISOString() };
}

export function updateClip(
  project: MontageProject,
  clipId: string,
  patch: Partial<Pick<MontageClip, "title" | "inSec" | "outSec">>
): MontageProject {
  const clips = project.clips.map((clip) => (clip.id === clipId ? { ...clip, ...patch } : clip));
  return { ...project, clips, updatedAt: new Date().toISOString() };
}

/** Move a clip to a new index in the timeline order. */
export function reorderClip(project: MontageProject, clipId: string, toIndex: number): MontageProject {
  const clips = orderedClips(project);
  const from = clips.findIndex((clip) => clip.id === clipId);
  if (from < 0) return project;
  const clamped = Math.max(0, Math.min(toIndex, clips.length - 1));
  const next = [...clips];
  const [moved] = next.splice(from, 1);
  next.splice(clamped, 0, moved);
  return {
    ...project,
    clips: next.map((clip, order) => ({ ...clip, order })),
    updatedAt: new Date().toISOString()
  };
}

// ── export formatting ────────────────────────────────────────────────────────

function pad2(n: number): string {
  return String(Math.floor(n)).padStart(2, "0");
}

/** Seconds → CMX3600 timecode HH:MM:SS:FF at the given fps. */
export function secondsToTimecode(seconds: number, fps = DEFAULT_FPS): string {
  const total = Math.max(0, toNum(seconds));
  const whole = Math.floor(total);
  const frames = Math.round((total - whole) * fps);
  const carry = frames >= fps ? 1 : 0;
  const f = frames >= fps ? 0 : frames;
  const s = whole + carry;
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}:${pad2(f)}`;
}

export interface TimelineExport {
  project: { id: string; name: string };
  fps: number;
  totalDuration: number;
  clips: Array<{
    id: string;
    itemId: string;
    title: string;
    sourceIn: number;
    sourceOut: number;
    timelineStart: number;
    duration: number;
  }>;
  version: string;
}

/** Structured timeline (NLE interchange JSON) for the valid clips, in order. */
export function buildTimelineJson(project: MontageProject): TimelineExport {
  let start = 0;
  const clips = orderedClips(project)
    .filter(isValidClip)
    .map((clip) => {
      const duration = clipDuration(clip);
      const entry = {
        id: clip.id,
        itemId: clip.itemId,
        title: clip.title || clip.itemId,
        sourceIn: clip.inSec,
        sourceOut: clip.outSec,
        timelineStart: start,
        duration
      };
      start += duration;
      return entry;
    });
  return {
    project: { id: project.id, name: project.name },
    fps: project.fps || DEFAULT_FPS,
    totalDuration: start,
    clips,
    version: "1.0"
  };
}

/**
 * CMX3600 EDL string (importable into DaVinci Resolve / Premiere).
 * Sequential record timecodes; source in/out from each clip.
 */
export function buildEdl(project: MontageProject): string {
  const fps = project.fps || DEFAULT_FPS;
  const timeline = buildTimelineJson(project);
  const lines = [`TITLE: ${project.name || "Untitled"}`, "FCM: NON-DROP FRAME"];
  let record = 0;
  timeline.clips.forEach((clip, i) => {
    const num = String(i + 1).padStart(3, "0");
    const srcIn = secondsToTimecode(clip.sourceIn, fps);
    const srcOut = secondsToTimecode(clip.sourceOut, fps);
    const recIn = secondsToTimecode(record, fps);
    record += clip.duration;
    const recOut = secondsToTimecode(record, fps);
    const reel = (clip.itemId || `CLIP${i + 1}`).replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase() || `CLIP${i + 1}`;
    lines.push(`${num}  ${reel} V     C        ${srcIn} ${srcOut} ${recIn} ${recOut}`);
    if (clip.title) lines.push(`* FROM CLIP NAME: ${clip.title}`);
  });
  return lines.join("\n");
}

/** Safe filename fragment from a project name (mirrors legacy exportClient). */
export function safeFileName(name: string, fallback = "export"): string {
  const clean = String(name || "").trim().replace(/[^\w؀-ۿ.-]+/g, "_").replace(/^_+|_+$/g, "");
  return clean || fallback;
}

export interface MontageExportClip {
  path: string;
  disk?: string;
  inSec: number;
  outSec: number;
}

export interface MontageClipResolutionFailure {
  clip: MontageClip;
  reason: string;
}

export interface MontageClipResolutionResult {
  clips: MontageExportClip[];
  failures: MontageClipResolutionFailure[];
}

/**
 * Resolves each montage clip's `itemId` (an archive record ID) to the record's
 * real stored file path via `resolveSourcePath`, instead of submitting the
 * record ID itself as an ffmpeg input path. Clips whose record has no
 * resolvable file path are reported as failures rather than silently dropped
 * or silently submitted with a broken path.
 */
export function resolveMontageClipPaths(
  clips: MontageClip[],
  resolveSourcePath: (itemId: string) => { sourcePath: string; disk?: string } | null
): MontageClipResolutionResult {
  const resolved: MontageExportClip[] = [];
  const failures: MontageClipResolutionFailure[] = [];

  for (const clip of clips) {
    const source = resolveSourcePath(clip.itemId);
    if (!source) {
      failures.push({ clip, reason: "no-source-path" });
      continue;
    }
    resolved.push({
      path: source.sourcePath,
      ...(source.disk ? { disk: source.disk } : {}),
      inSec: clip.inSec,
      outSec: clip.outSec
    });
  }

  return { clips: resolved, failures };
}

// ── localStorage persistence (same pattern as lib/favorites.ts) ─────────────

const STORAGE_KEY = "masar.montage-projects";

export function listProjects(): MontageProject[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as MontageProject[]) : [];
  } catch {
    return [];
  }
}

function setStorage(projects: MontageProject[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch {
    // Silent fail on storage quota exceeded or other errors
  }
}

export function saveProject(project: MontageProject): MontageProject[] {
  const projects = listProjects();
  const index = projects.findIndex((p) => p.id === project.id);
  const next = index >= 0
    ? projects.map((p) => (p.id === project.id ? project : p))
    : [project, ...projects];
  setStorage(next);
  return next;
}

export function deleteProject(id: string): MontageProject[] {
  const next = listProjects().filter((p) => p.id !== id);
  setStorage(next);
  return next;
}

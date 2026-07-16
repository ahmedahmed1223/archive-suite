// Projects / Montage — pure logic + persistent storage via Laravel API.
// Extended from single-track to multi-track with markers, comments, and transitions.
// ponytail: timeline persists in Laravel; client JSON serialization for export/import.

export interface MontageTrack {
  id: string;
  type: 'video' | 'audio' | 'overlay' | 'title';
  name: string;
  order: number;
  locked?: boolean;
  magnetic?: boolean;
}

export interface MontageClip {
  id: string;
  itemId: string;
  title: string;
  trackId: string;
  timelineStartSec: number;
  inSec: number;
  outSec: number;
}

export interface MontageMarker {
  id: string;
  timeSec: number;
  label: string;
  color?: string;
}

export interface MontageComment {
  id: string;
  clipId: string;
  text: string;
  createdAt: string;
}

export interface MontageTransition {
  id: string;
  fromClipId: string;
  toClipId: string;
  type: 'cut' | 'fade';
  durationSec: number;
}

export interface MontageProject {
  id: string;
  name: string;
  description: string;
  fps: number;
  tracks: MontageTrack[];
  clips: MontageClip[];
  markers: MontageMarker[];
  comments: MontageComment[];
  transitions: MontageTransition[];
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
    tracks: [
      { id: uid("track"), type: "video", name: "Video", order: 0, magnetic: true },
      { id: uid("track"), type: "audio", name: "Audio", order: 1 }
    ],
    clips: [],
    markers: [],
    comments: [],
    transitions: [],
    createdAt: now,
    updatedAt: now
  };
}

export function isValidClip(clip: MontageClip): boolean {
  return Boolean(clip.itemId && clip.trackId) && toNum(clip.inSec) < toNum(clip.outSec);
}

export function clipDuration(clip: MontageClip): number {
  return Math.max(0, toNum(clip.outSec) - toNum(clip.inSec));
}

export function clipsByTrack(project: MontageProject, trackId: string): MontageClip[] {
  return project.clips
    .filter((c) => c.trackId === trackId)
    .sort((a, b) => a.timelineStartSec - b.timelineStartSec);
}

export function allClipsOrdered(project: MontageProject): MontageClip[] {
  return [...project.clips].sort((a, b) => a.timelineStartSec - b.timelineStartSec);
}

export function projectDuration(project: MontageProject): number {
  let maxEnd = 0;
  for (const clip of project.clips) {
    if (isValidClip(clip)) {
      maxEnd = Math.max(maxEnd, clip.timelineStartSec + clipDuration(clip));
    }
  }
  return maxEnd;
}

export function addClip(
  project: MontageProject,
  partial: { itemId: string; title: string; trackId: string; inSec: number; outSec: number; timelineStartSec?: number }
): MontageProject {
  const duration = toNum(partial.outSec) - toNum(partial.inSec);
  const timelineStart = partial.timelineStartSec ?? projectDuration(project);
  const clip: MontageClip = {
    id: uid("cut"),
    itemId: partial.itemId,
    title: partial.title.trim(),
    trackId: partial.trackId,
    timelineStartSec: timelineStart,
    inSec: toNum(partial.inSec),
    outSec: toNum(partial.outSec)
  };
  return { ...project, clips: [...project.clips, clip], updatedAt: new Date().toISOString() };
}

export function removeClip(project: MontageProject, clipId: string): MontageProject {
  const clips = project.clips.filter((clip) => clip.id !== clipId);
  const comments = project.comments.filter((c) => c.clipId !== clipId);
  const transitions = project.transitions.filter((t) => t.fromClipId !== clipId && t.toClipId !== clipId);
  return {
    ...project,
    clips,
    comments,
    transitions,
    updatedAt: new Date().toISOString()
  };
}

export function updateClip(
  project: MontageProject,
  clipId: string,
  patch: Partial<Pick<MontageClip, "title" | "inSec" | "outSec" | "timelineStartSec">>
): MontageProject {
  const clips = project.clips.map((clip) => (clip.id === clipId ? { ...clip, ...patch } : clip));
  return { ...project, clips, updatedAt: new Date().toISOString() };
}

export function orderedClips(project: MontageProject): MontageClip[] {
  return allClipsOrdered(project);
}

export function reorderClip(
  project: MontageProject,
  clipId: string,
  newIndex: number
): MontageProject {
  const orderedList = allClipsOrdered(project);
  const currentIndex = orderedList.findIndex((c) => c.id === clipId);

  if (currentIndex === -1) return project;

  const targetIndex = Math.max(0, Math.min(newIndex, orderedList.length - 1));
  if (currentIndex === targetIndex) return project;

  const clip = orderedList[currentIndex];
  const adjacentClip = orderedList[targetIndex];

  // Move to the timeline position of the target clip
  const updatedClip: MontageClip = {
    ...clip,
    timelineStartSec: adjacentClip.timelineStartSec
  };

  const clips = project.clips.map((c) => (c.id === clipId ? updatedClip : c));
  return { ...project, clips, updatedAt: new Date().toISOString() };
}

export function addMarker(project: MontageProject, timeSec: number, label: string, color?: string): MontageProject {
  const marker: MontageMarker = { id: uid("marker"), timeSec: toNum(timeSec), label: label.trim(), color };
  return { ...project, markers: [...project.markers, marker], updatedAt: new Date().toISOString() };
}

export function removeMarker(project: MontageProject, markerId: string): MontageProject {
  return {
    ...project,
    markers: project.markers.filter((m) => m.id !== markerId),
    updatedAt: new Date().toISOString()
  };
}

export function addComment(project: MontageProject, clipId: string, text: string): MontageProject {
  const comment: MontageComment = { id: uid("comment"), clipId, text: text.trim(), createdAt: new Date().toISOString() };
  return { ...project, comments: [...project.comments, comment], updatedAt: new Date().toISOString() };
}

export function removeComment(project: MontageProject, commentId: string): MontageProject {
  return {
    ...project,
    comments: project.comments.filter((c) => c.id !== commentId),
    updatedAt: new Date().toISOString()
  };
}

export function addTransition(
  project: MontageProject,
  fromClipId: string,
  toClipId: string,
  type: 'cut' | 'fade',
  durationSec = 0.5
): MontageProject {
  const transition: MontageTransition = {
    id: uid("transition"),
    fromClipId,
    toClipId,
    type,
    durationSec: Math.max(0, toNum(durationSec))
  };
  return { ...project, transitions: [...project.transitions, transition], updatedAt: new Date().toISOString() };
}

export function removeTransition(project: MontageProject, transitionId: string): MontageProject {
  return {
    ...project,
    transitions: project.transitions.filter((t) => t.id !== transitionId),
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
  tracks: Array<{ id: string; type: string; name: string; order: number }>;
  clips: Array<{
    id: string;
    itemId: string;
    title: string;
    trackId: string;
    sourceIn: number;
    sourceOut: number;
    timelineStart: number;
    duration: number;
  }>;
  transitions: Array<{
    id: string;
    fromClipId: string;
    toClipId: string;
    type: string;
    durationSec: number;
  }>;
  version: string;
}

/** Structured timeline (NLE interchange JSON) for all valid clips with transitions. */
export function buildTimelineJson(project: MontageProject): TimelineExport {
  const clips = allClipsOrdered(project)
    .filter(isValidClip)
    .map((clip) => ({
      id: clip.id,
      itemId: clip.itemId,
      title: clip.title || clip.itemId,
      trackId: clip.trackId,
      sourceIn: clip.inSec,
      sourceOut: clip.outSec,
      timelineStart: clip.timelineStartSec,
      duration: clipDuration(clip)
    }));

  return {
    project: { id: project.id, name: project.name },
    fps: project.fps || DEFAULT_FPS,
    totalDuration: projectDuration(project),
    tracks: project.tracks,
    clips,
    transitions: project.transitions,
    version: "2.0"
  };
}

/**
 * CMX3600 EDL string (importable into DaVinci Resolve / Premiere).
 * Sequential record timecodes per video track; includes transition markers.
 */
export function buildEdl(project: MontageProject): string {
  const fps = project.fps || DEFAULT_FPS;
  const videoTrack = project.tracks.find((t) => t.type === "video");
  const videoClips = videoTrack ? clipsByTrack(project, videoTrack.id).filter(isValidClip) : [];

  const lines = [`TITLE: ${project.name || "Untitled"}`, "FCM: NON-DROP FRAME"];
  let record = 0;

  videoClips.forEach((clip, i) => {
    const num = String(i + 1).padStart(3, "0");
    const srcIn = secondsToTimecode(clip.inSec, fps);
    const srcOut = secondsToTimecode(clip.outSec, fps);
    const recIn = secondsToTimecode(record, fps);
    const duration = clipDuration(clip);
    record += duration;
    const recOut = secondsToTimecode(record, fps);
    const reel = (clip.itemId || `CLIP${i + 1}`).replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase() || `CLIP${i + 1}`;

    const transition = project.transitions.find((t) => t.fromClipId === clip.id);
    const editMode = transition?.type === "fade" ? "F" : "C";
    lines.push(`${num}  ${reel} V     ${editMode}        ${srcIn} ${srcOut} ${recIn} ${recOut}`);
    if (clip.title) lines.push(`* FROM CLIP NAME: ${clip.title}`);
  });

  return lines.join("\n");
}

// ── NLE interchange: Premiere (xmeml) and FCPXML ─────────────────────────────
// V1-715: both formats are frame-based, not second-based. Every timing crosses
// through secondsToFrames so an NLE never receives a fractional frame.

/** Seconds → whole frames at the sequence rate. Negative input clamps to 0. */
export function secondsToFrames(seconds: number, fps = DEFAULT_FPS): number {
  const rate = fps > 0 ? fps : DEFAULT_FPS;
  return Math.round(toNum(seconds) * rate);
}

/** Escapes the five XML metacharacters. Arabic and other text pass through. */
function escapeXml(value: unknown): string {
  return String(value ?? "").replace(/[<>&'"]/g, (char) =>
    ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[char] as string
  );
}

function exportableClips(project: MontageProject, trackId: string): MontageClip[] {
  return clipsByTrack(project, trackId).filter(isValidClip);
}

/**
 * Final Cut Pro 7 XML (xmeml v5) — the format Premiere Pro imports.
 * Clips whose in/out are invalid are dropped rather than emitted broken.
 */
export function buildPremiereXml(project: MontageProject): string {
  const fps = project.fps || DEFAULT_FPS;
  const rate = `<rate><timebase>${fps}</timebase><ntsc>FALSE</ntsc></rate>`;

  const renderTrack = (trackId: string): string => {
    const clips = exportableClips(project, trackId);
    if (!clips.length) return "";
    const items = clips.map((clip) => {
      const start = secondsToFrames(clip.timelineStartSec, fps);
      const frames = secondsToFrames(clipDuration(clip), fps);
      return [
        `          <clipitem id="${escapeXml(clip.id)}">`,
        `            <name>${escapeXml(clip.title || clip.itemId)}</name>`,
        `            <duration>${frames}</duration>`,
        `            ${rate}`,
        `            <start>${start}</start>`,
        `            <end>${start + frames}</end>`,
        `            <in>${secondsToFrames(clip.inSec, fps)}</in>`,
        `            <out>${secondsToFrames(clip.outSec, fps)}</out>`,
        `            <file id="file_${escapeXml(clip.itemId)}"><name>${escapeXml(clip.itemId)}</name></file>`,
        `          </clipitem>`,
      ].join("\n");
    });
    return [`        <track>`, ...items, `        </track>`].join("\n");
  };

  const tracksOfKind = (kinds: MontageTrack["type"][]): string =>
    [...project.tracks]
      .sort((a, b) => a.order - b.order)
      .filter((track) => kinds.includes(track.type))
      .map((track) => renderTrack(track.id))
      .filter(Boolean)
      .join("\n");

  const video = tracksOfKind(["video", "overlay", "title"]);
  const audio = tracksOfKind(["audio"]);
  const media = [
    video ? [`      <video>`, video, `      </video>`].join("\n") : "",
    audio ? [`      <audio>`, audio, `      </audio>`].join("\n") : "",
  ].filter(Boolean).join("\n");

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<!DOCTYPE xmeml>`,
    `<xmeml version="5">`,
    `  <sequence id="${escapeXml(project.id)}">`,
    `    <name>${escapeXml(project.name || "Untitled")}</name>`,
    `    <duration>${secondsToFrames(projectDuration(project), fps)}</duration>`,
    `    ${rate}`,
    `    <media>`,
    media,
    `    </media>`,
    `  </sequence>`,
    `</xmeml>`,
  ].filter((line) => line !== "").join("\n");
}

/**
 * FCPXML v1.9 (Final Cut Pro X). Times are rational frame-aligned seconds
 * (`<frames>/<fps>s`); each distinct source record becomes one asset resource
 * referenced by every clip that uses it.
 */
export function buildFcpXml(project: MontageProject): string {
  const fps = project.fps || DEFAULT_FPS;
  const t = (seconds: number): string => `${secondsToFrames(seconds, fps)}/${fps}s`;

  const clips = allClipsOrdered(project).filter(isValidClip);

  // One resource per distinct record, in first-use order — a record reused on
  // several clips must not be declared twice.
  const assetIds = new Map<string, string>();
  for (const clip of clips) {
    if (!assetIds.has(clip.itemId)) assetIds.set(clip.itemId, `r${assetIds.size + 1}`);
  }

  const assets = [...assetIds.entries()].map(
    ([itemId, id]) => `    <asset id="${id}" name="${escapeXml(itemId)}" start="0s" hasVideo="1" hasAudio="1"/>`
  );

  const spineItems = clips.map((clip) =>
    `          <asset-clip ref="${assetIds.get(clip.itemId)}" name="${escapeXml(clip.title || clip.itemId)}"` +
    ` offset="${t(clip.timelineStartSec)}" start="${t(clip.inSec)}" duration="${t(clipDuration(clip))}"/>`
  );
  const spine = spineItems.length ? [`        <spine>`, ...spineItems, `        </spine>`].join("\n") : `        <spine></spine>`;

  const name = escapeXml(project.name || "Untitled");
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<!DOCTYPE fcpxml>`,
    `<fcpxml version="1.9">`,
    `  <resources>`,
    `    <format id="r0" name="FFVideoFormat${fps}p" frameDuration="1/${fps}s"/>`,
    ...assets,
    `  </resources>`,
    `  <library>`,
    `    <event name="${name}">`,
    `      <project name="${name}">`,
    `        <sequence format="r0" duration="${t(projectDuration(project))}">`,
    spine,
    `        </sequence>`,
    `      </project>`,
    `    </event>`,
    `  </library>`,
    `</fcpxml>`,
  ].join("\n");
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

// ── API persistence (with localStorage fallback) ──────────────────────────

const STORAGE_KEY = "masar.montage-projects";

export async function listProjects(): Promise<MontageProject[]> {
  try {
    const response = await fetch("/api/v1/montage-projects", { method: "GET" });
    if (response.ok) {
      const data = await response.json();
      return data.projects || [];
    }
  } catch {
    // API unavailable, fall back to localStorage
  }
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as MontageProject[]) : [];
  } catch {
    return [];
  }
}

export async function getProject(id: string): Promise<MontageProject | null> {
  try {
    const response = await fetch(`/api/v1/montage-projects/${id}`, { method: "GET" });
    if (response.ok) {
      const data = await response.json();
      return data.project || null;
    }
  } catch {
    // Fall back to localStorage
  }
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const projects = stored ? (JSON.parse(stored) as MontageProject[]) : [];
    return projects.find((p) => p.id === id) || null;
  } catch {
    return null;
  }
}

export async function saveProject(project: MontageProject): Promise<MontageProject> {
  try {
    const isNew = !project.id || project.id.startsWith("project_");
    const response = await fetch(
      isNew ? "/api/v1/montage-projects" : `/api/v1/montage-projects/${project.id}`,
      {
        method: isNew ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(project)
      }
    );
    if (response.ok) {
      const data = await response.json();
      return data.project || project;
    }
  } catch {
    // Fall back to localStorage
  }
  if (typeof window !== "undefined") {
    try {
      const projects = (await listProjects()) as MontageProject[];
      const index = projects.findIndex((p) => p.id === project.id);
      const next = index >= 0
        ? projects.map((p) => (p.id === project.id ? project : p))
        : [project, ...projects];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage errors
    }
  }
  return project;
}

export async function deleteProject(id: string): Promise<void> {
  try {
    await fetch(`/api/v1/montage-projects/${id}`, { method: "DELETE" });
  } catch {
    // Fall back to localStorage
  }
  if (typeof window !== "undefined") {
    try {
      const projects = (await listProjects()) as MontageProject[];
      const next = projects.filter((p) => p.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage errors
    }
  }
}

import { normalizeArabicSearchText } from "../../utils/formatting.js";
import { normalizeClipFilters as normalizeFilterStack } from "../montage/filterRegistry.js";
import { normalizeMultiTrackProject } from "../montage/multiTrackModel.js";

// G5 — Projects / montage workflow (data + logic layer, storage-agnostic).
//
// A project groups archive video items into an ordered editing workspace with
// notes and "rough cuts" — clips defined by in/out points on a source item.
// Pure functions only (no DOM/store), so they run identically offline (SPA)
// and cloud, and are fully unit-testable. The UI page + `projects` store slice
// are a separate task; this is the foundation + the NLE export.

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function toNum(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export const PROJECT_TASK_STATUSES = ["todo", "doing", "review", "done"];
export const MONTAGE_REVIEW_STATUSES = ["raw", "selected", "needs_review", "approved"];
export const DEFAULT_TIMELINE_SETTINGS = Object.freeze({
  fps: 25,
  resolution: "1920x1080",
  aspectRatio: "16:9"
});
export const MONTAGE_TRANSITIONS = ["cut", "fade", "dissolve", "wipeleft", "wiperight"];
export const MONTAGE_LOOKS = ["none", "cinematic", "news", "warm", "mono"];

function trimString(value) {
  return String(value || "").trim();
}

function normalizeReviewStatus(status) {
  return MONTAGE_REVIEW_STATUSES.includes(status) ? status : "raw";
}

function normalizeVolumeDb(value) {
  if (value === undefined || value === null || value === "") return 0;
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(-60, Math.min(12, n));
}

function clampNumber(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

export function normalizeClipTransition(value = {}) {
  const type = MONTAGE_TRANSITIONS.includes(value.type) ? value.type : "cut";
  return {
    type,
    durationSec: type === "cut" ? 0 : clampNumber(value.durationSec, 0.5, 0.1, 5)
  };
}

export function normalizeClipFilters(value = {}) {
  return {
    look: MONTAGE_LOOKS.includes(value.look) ? value.look : "none",
    brightness: clampNumber(value.brightness, 0, -1, 1),
    contrast: clampNumber(value.contrast, 1, 0, 3),
    saturation: clampNumber(value.saturation, 1, 0, 3)
  };
}

export function normalizeClipTransform(value = {}) {
  return {
    scale: clampNumber(value.scale, 1, 0.1, 5),
    x: clampNumber(value.x, 0, -2000, 2000),
    y: clampNumber(value.y, 0, -2000, 2000),
    rotation: clampNumber(value.rotation, 0, -180, 180),
    opacity: clampNumber(value.opacity, 1, 0, 1)
  };
}

function normalizeClipAudio(value = {}, fallbackVolumeDb = 0) {
  return {
    volumeDb: normalizeVolumeDb(value.volumeDb ?? fallbackVolumeDb),
    pan: clampNumber(value.pan, 0, -1, 1),
    muted: Boolean(value.muted),
    fadeInSec: clampNumber(value.fadeInSec, 0, 0, 30),
    fadeOutSec: clampNumber(value.fadeOutSec, 0, 0, 30)
  };
}

function normalizeClipKeyframes(value = []) {
  return (Array.isArray(value) ? value : [])
    .filter((keyframe) => keyframe && trimString(keyframe.property))
    .map((keyframe, index) => ({
      id: trimString(keyframe.id) || `keyframe-${index + 1}`,
      property: trimString(keyframe.property),
      timeSec: toNum(keyframe.timeSec),
      value: keyframe.value,
      easing: trimString(keyframe.easing) || "linear"
    }))
    .sort((a, b) => a.timeSec - b.timeSec);
}

export function normalizeTimelineSettings(settings = {}) {
  const fps = Number(settings.fps);
  const resolution = trimString(settings.resolution) || DEFAULT_TIMELINE_SETTINGS.resolution;
  const aspectRatio = trimString(settings.aspectRatio) || DEFAULT_TIMELINE_SETTINGS.aspectRatio;
  return {
    fps: Number.isFinite(fps) && fps > 0 ? fps : DEFAULT_TIMELINE_SETTINGS.fps,
    resolution,
    aspectRatio
  };
}

function normalizeTaskStatus(status) {
  return PROJECT_TASK_STATUSES.includes(status) ? status : "todo";
}

/** A rough cut = a clip on the timeline referencing one source item. */
export function createRoughCutValue(partial = {}) {
  const inSec = toNum(partial.inSec);
  let outSec = toNum(partial.outSec);
  if (outSec <= inSec) outSec = inSec; // clamped; isValidRoughCut flags zero-length
  const value = {
    id: partial.id || uid("cut"),
    itemId: String(partial.itemId || ""),
    inSec,
    outSec,
    label: String(partial.label || "").trim(),
    order: Number.isInteger(partial.order) ? partial.order : 0,
    notes: trimString(partial.notes),
    color: trimString(partial.color),
    trackId: trimString(partial.trackId) || "v1",
    locked: Boolean(partial.locked),
    reviewStatus: normalizeReviewStatus(partial.reviewStatus),
    volumeDb: normalizeVolumeDb(partial.volumeDb),
    transition: normalizeClipTransition(partial.transition),
    filters: normalizeClipFilters(partial.filters),
    transform: normalizeClipTransform(partial.transform)
  };
  if (Number.isFinite(Number(partial.timelineStartSec)) && Number(partial.timelineStartSec) >= 0) {
    value.timelineStartSec = Number(partial.timelineStartSec);
  }
  if (partial.linkedGroupId) value.linkedGroupId = trimString(partial.linkedGroupId);
  if (partial.blendMode) value.blendMode = trimString(partial.blendMode) || "normal";
  if (partial.opacity !== undefined) value.opacity = clampNumber(partial.opacity, 1, 0, 1);
  const stackInput = Array.isArray(partial.filterStack)
    ? partial.filterStack
    : Array.isArray(partial.filters) ? partial.filters : null;
  if (stackInput) value.filterStack = normalizeFilterStack(stackInput);
  if (partial.audio && typeof partial.audio === "object") {
    value.audio = normalizeClipAudio(partial.audio, value.volumeDb);
  }
  if (Array.isArray(partial.keyframes)) value.keyframes = normalizeClipKeyframes(partial.keyframes);
  if (partial.mediaType || partial.trackType) value.mediaType = trimString(partial.mediaType || partial.trackType);
  return value;
}

export function createProjectTaskValue(partial = {}) {
  const now = new Date().toISOString();
  return {
    id: partial.id || uid("task"),
    title: String(partial.title || "").trim(),
    status: normalizeTaskStatus(partial.status),
    itemId: String(partial.itemId || ""),
    assigneeId: String(partial.assigneeId || ""),
    notes: String(partial.notes || ""),
    order: Number.isInteger(partial.order) ? partial.order : 0,
    createdAt: partial.createdAt || now,
    updatedAt: partial.updatedAt || now
  };
}

export function createTemporalCommentValue(partial = {}) {
  const body = trimString(partial.body);
  if (!body) return null;
  return {
    id: partial.id || uid("comment"),
    clipId: String(partial.clipId || ""),
    itemId: String(partial.itemId || ""),
    atSec: toNum(partial.atSec),
    body,
    authorId: String(partial.authorId || ""),
    status: partial.status === "resolved" ? "resolved" : "open",
    createdAt: partial.createdAt || new Date().toISOString()
  };
}

/** A rough cut is usable only if it points at an item and has positive length. */
export function isValidRoughCut(cut) {
  return Boolean(cut?.itemId) && toNum(cut.inSec) < toNum(cut.outSec);
}

export function roughCutDuration(cut) {
  return Math.max(0, toNum(cut?.outSec) - toNum(cut?.inSec));
}

export function createProjectValue(partial = {}) {
  const now = new Date().toISOString();
  const project = {
    id: partial.id || uid("project"),
    name: String(partial.name || "").trim(),
    description: String(partial.description || "").trim(),
    itemIds: Array.isArray(partial.itemIds) ? [...new Set(partial.itemIds.map(String))] : [],
    roughCuts: Array.isArray(partial.roughCuts) ? partial.roughCuts.map(createRoughCutValue) : [],
    tasks: Array.isArray(partial.tasks) ? partial.tasks.map(createProjectTaskValue) : [],
    markers: Array.isArray(partial.markers) ? partial.markers.map(createProjectMarkerValue).filter(Boolean) : [],
    comments: Array.isArray(partial.comments) ? partial.comments.map(createTemporalCommentValue).filter(Boolean) : [],
    timelineSettings: normalizeTimelineSettings(partial.timelineSettings),
    notes: String(partial.notes || ""),
    status: partial.status === "archived" ? "archived" : "active",
    createdAt: partial.createdAt || now,
    updatedAt: now
  };
  if (Array.isArray(partial.timelineTracks)) {
    project.timelineTracks = normalizeMultiTrackProject({ timelineTracks: partial.timelineTracks }).timelineTracks;
  }
  if (partial.timelinePreferences && typeof partial.timelinePreferences === "object") {
    project.timelinePreferences = normalizeMultiTrackProject({
      timelinePreferences: partial.timelinePreferences
    }).timelinePreferences;
  }
  return project;
}

export function createProjectMarkerValue(partial = {}) {
  const atSec = toNum(partial.atSec);
  const label = trimString(partial.label);
  if (!label && !partial.id) return null;
  const marker = {
    id: partial.id || uid("marker"),
    atSec,
    label
  };
  const color = trimString(partial.color);
  if (color) marker.color = color;
  return marker;
}

function sortedMarkers(markers = []) {
  return markers
    .map(createProjectMarkerValue)
    .filter(Boolean)
    .sort((a, b) => a.atSec - b.atSec);
}

export function addProjectMarker(project, markerPartial = {}) {
  const marker = createProjectMarkerValue(markerPartial);
  if (!marker) return project;
  return {
    ...project,
    markers: sortedMarkers([...(project.markers || []), marker]),
    updatedAt: new Date().toISOString()
  };
}

export function addTemporalComment(project, commentPartial = {}) {
  const comment = createTemporalCommentValue(commentPartial);
  if (!comment) return project;
  return {
    ...project,
    comments: [...(project.comments || []), comment],
    updatedAt: new Date().toISOString()
  };
}

export function getProjectCommentsForClip(project, clipId) {
  return (project?.comments || [])
    .filter((comment) => comment.clipId === clipId)
    .sort((a, b) => a.atSec - b.atSec);
}

export function getFilteredProjects(projects = [], query = "", { includeArchived = false } = {}) {
  const q = normalizeArabicSearchText(query);
  return [...projects]
    .filter((p) => (includeArchived || p.status !== "archived"))
    .filter((p) => !q || [p.name, p.description, p.notes].some((v) => normalizeArabicSearchText(v).includes(q)))
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
}

/** Append a rough cut at the end of the timeline. Returns a new project. */
export function addRoughCut(project, cutPartial) {
  const cut = createRoughCutValue({ ...cutPartial, order: project.roughCuts.length });
  const itemIds = cut.itemId && !project.itemIds.includes(cut.itemId)
    ? [...project.itemIds, cut.itemId]
    : project.itemIds;
  return { ...project, itemIds, roughCuts: [...project.roughCuts, cut], updatedAt: new Date().toISOString() };
}

export function removeRoughCut(project, cutId) {
  const roughCuts = project.roughCuts.filter((c) => c.id !== cutId).map((c, i) => ({ ...c, order: i }));
  return { ...project, roughCuts, updatedAt: new Date().toISOString() };
}

export function splitRoughCut(project, cutId, atSec) {
  const cuts = getOrderedRoughCuts(project);
  const index = cuts.findIndex((clip) => clip.id === cutId);
  if (index < 0) return project;
  const clip = cuts[index];
  if (clip.locked) return project;
  const splitAt = clampNumber(atSec, clip.inSec, clip.inSec, clip.outSec);
  if (splitAt <= clip.inSec || splitAt >= clip.outSec) return project;
  const first = createRoughCutValue({ ...clip, outSec: splitAt, label: clip.label || "" });
  const second = createRoughCutValue({
    ...clip,
    id: uid("cut"),
    inSec: splitAt,
    outSec: clip.outSec,
    label: clip.label ? `${clip.label} B` : "",
    order: clip.order + 1
  });
  const next = [...cuts.slice(0, index), first, second, ...cuts.slice(index + 1)]
    .map((item, order) => ({ ...item, order }));
  return { ...project, roughCuts: next, updatedAt: new Date().toISOString() };
}

export function duplicateRoughCut(project, cutId) {
  const cuts = getOrderedRoughCuts(project);
  const index = cuts.findIndex((clip) => clip.id === cutId);
  if (index < 0) return project;
  const copy = createRoughCutValue({ ...cuts[index], id: uid("cut"), label: cuts[index].label ? `${cuts[index].label} نسخة` : "", order: index + 1 });
  const next = [...cuts.slice(0, index + 1), copy, ...cuts.slice(index + 1)]
    .map((item, order) => ({ ...item, order }));
  return { ...project, roughCuts: next, updatedAt: new Date().toISOString() };
}

export function buildMontagePresetClipPatch(preset) {
  if (preset === "cinematic") return { filters: { look: "cinematic", brightness: -0.03, contrast: 1.12, saturation: 0.95 } };
  if (preset === "news") return { filters: { look: "news", brightness: 0.04, contrast: 1.06, saturation: 1.08 } };
  if (preset === "warm") return { filters: { look: "warm", brightness: 0.03, contrast: 1.04, saturation: 1.15 } };
  if (preset === "mono") return { filters: { look: "mono", brightness: 0, contrast: 1.1, saturation: 0 } };
  return {
    transition: { type: "cut", durationSec: 0 },
    filters: { look: "none", brightness: 0, contrast: 1, saturation: 1 },
    transform: { scale: 1, x: 0, y: 0, rotation: 0, opacity: 1 }
  };
}

/** Move a rough cut to a new index (reorders the timeline). */
export function reorderRoughCut(project, cutId, toIndex) {
  const cuts = [...project.roughCuts].sort((a, b) => a.order - b.order);
  const from = cuts.findIndex((c) => c.id === cutId);
  if (from < 0) return project;
  const clamped = Math.max(0, Math.min(toIndex, cuts.length - 1));
  const [moved] = cuts.splice(from, 1);
  cuts.splice(clamped, 0, moved);
  return { ...project, roughCuts: cuts.map((c, i) => ({ ...c, order: i })), updatedAt: new Date().toISOString() };
}

/** Ordered rough cuts (defensive copy, sorted by order). */
export function getOrderedRoughCuts(project) {
  return [...(project?.roughCuts || [])].sort((a, b) => a.order - b.order);
}

export function getProjectTasksByStatus(project) {
  const grouped = Object.fromEntries(PROJECT_TASK_STATUSES.map((status) => [status, []]));
  for (const task of project?.tasks || []) {
    grouped[normalizeTaskStatus(task.status)].push(task);
  }
  for (const status of PROJECT_TASK_STATUSES) {
    grouped[status] = grouped[status].sort((a, b) => (a.order || 0) - (b.order || 0));
  }
  return grouped;
}

export function addProjectTask(project, taskPartial = {}) {
  const status = normalizeTaskStatus(taskPartial.status);
  const order = (project.tasks || []).filter((task) => normalizeTaskStatus(task.status) === status).length;
  const task = createProjectTaskValue({ ...taskPartial, status, order });
  const itemIds = task.itemId && !project.itemIds.includes(task.itemId)
    ? [...project.itemIds, task.itemId]
    : project.itemIds;
  return { ...project, itemIds, tasks: [...(project.tasks || []), task], updatedAt: new Date().toISOString() };
}

export function moveProjectTask(project, taskId, nextStatus) {
  const status = normalizeTaskStatus(nextStatus);
  const tasks = (project.tasks || []).map((task) => {
    if (task.id !== taskId) return task;
    const order = (project.tasks || []).filter((item) => item.id !== taskId && normalizeTaskStatus(item.status) === status).length;
    return createProjectTaskValue({ ...task, status, order, updatedAt: new Date().toISOString() });
  });
  return { ...project, tasks, updatedAt: new Date().toISOString() };
}

export function removeProjectTask(project, taskId) {
  return {
    ...project,
    tasks: (project.tasks || []).filter((task) => task.id !== taskId),
    updatedAt: new Date().toISOString()
  };
}

/** Total timeline duration in seconds (sum of valid rough-cut lengths). */
export function getProjectDuration(project) {
  return getOrderedRoughCuts(project).filter(isValidRoughCut).reduce((sum, c) => sum + roughCutDuration(c), 0);
}

/**
 * Build a structured timeline (NLE interchange JSON). Each clip carries its
 * source item, in/out on the source, and its position on the project timeline.
 * Backend-agnostic; the UI or a server exporter can turn this into MP4/FCPXML.
 */
export function buildProjectTimeline(project, itemsById = new Map()) {
  const normalizedProject = normalizeMultiTrackProject(project);
  let totalDuration = 0;
  const clips = normalizedProject.roughCuts.filter(isValidRoughCut).map((cut) => {
    const item = itemsById.get?.(cut.itemId) || null;
    const duration = roughCutDuration(cut);
    const timelineStart = toNum(cut.timelineStartSec);
    const clip = {
      id: cut.id,
      itemId: cut.itemId,
      title: cut.label || item?.title || cut.itemId,
      source: item?.path || item?.metadata?.localFile?.relativePath || "",
      sourceIn: cut.inSec,
      sourceOut: cut.outSec,
      timelineStart,
      startSec: timelineStart,
      duration,
      notes: cut.notes || "",
      color: cut.color || "",
      trackId: cut.trackId || "v1",
      locked: Boolean(cut.locked),
      reviewStatus: normalizeReviewStatus(cut.reviewStatus),
      volumeDb: normalizeVolumeDb(cut.volumeDb),
      transition: normalizeClipTransition(cut.transition),
      filters: normalizeClipFilters(cut.filters),
      filterStack: normalizeFilterStack(cut.filterStack || (Array.isArray(cut.filters) ? cut.filters : [])),
      transform: normalizeClipTransform(cut.transform),
      opacity: cut.opacity === undefined ? normalizeClipTransform(cut.transform).opacity : clampNumber(cut.opacity, 1, 0, 1),
      blendMode: trimString(cut.blendMode) || "normal",
      linkedGroupId: trimString(cut.linkedGroupId) || null,
      audio: normalizeClipAudio(cut.audio, cut.volumeDb),
      keyframes: normalizeClipKeyframes(cut.keyframes)
    };
    totalDuration = Math.max(totalDuration, timelineStart + duration);
    return clip;
  });
  const settings = normalizeTimelineSettings(project.timelineSettings);
  const primaryVideoTrackId = normalizedProject.timelineTracks.find((track) => track.type === "video")?.id || "v1";
  const edlWarnings = [];
  const omittedTrackClips = clips.filter((clip) => clip.trackId !== primaryVideoTrackId).length;
  if (omittedTrackClips) {
    edlWarnings.push({ code: "edl-omits-secondary-tracks", count: omittedTrackClips });
  }
  if (clips.some((clip) => clip.filterStack.length || clip.keyframes.length || clip.blendMode !== "normal")) {
    edlWarnings.push({ code: "edl-omits-effects" });
  }
  return {
    project: { id: project.id, name: project.name },
    fps: settings.fps,
    settings,
    tracks: normalizedProject.timelineTracks,
    preferences: normalizedProject.timelinePreferences,
    markers: sortedMarkers(project.markers || []),
    totalDuration,
    clips,
    edlWarnings,
    version: "1.0"
  };
}

function pad2(n) { return String(Math.floor(n)).padStart(2, "0"); }

/** Seconds → CMX3600 timecode HH:MM:SS:FF at the given fps. */
export function secondsToTimecode(seconds, fps = 25) {
  const total = Math.max(0, toNum(seconds));
  const whole = Math.floor(total);
  const frames = Math.round((total - whole) * fps);
  // carry frames overflow (e.g. 24.99 @25 → next second)
  const carry = frames >= fps ? 1 : 0;
  const f = frames >= fps ? 0 : frames;
  const s = whole + carry;
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}:${pad2(f)}`;
}

/**
 * Build a CMX3600 EDL string (importable into DaVinci Resolve / Premiere).
 * Sequential record timecodes; source in/out from each rough cut.
 */
export function buildEdl(project, itemsById = new Map(), { fps = 25 } = {}) {
  const timeline = buildProjectTimeline(project, itemsById);
  const primaryVideoTrackId = timeline.tracks.find((track) => track.type === "video")?.id || "v1";
  const clips = timeline.clips.filter((clip) => clip.trackId === primaryVideoTrackId);
  const lines = [`TITLE: ${project.name || "Untitled"}`, "FCM: NON-DROP FRAME"];
  for (const warning of timeline.edlWarnings) lines.push(`* WARNING: ${warning.code}`);
  let record = 0;
  clips.forEach((clip, i) => {
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

export function getProjectSummary(projects = [], items = []) {
  const active = projects.filter((p) => p.status !== "archived");
  const totalCuts = active.reduce((n, p) => n + (p.roughCuts?.length || 0), 0);
  return {
    total: active.length,
    archived: projects.length - active.length,
    totalRoughCuts: totalCuts,
    totalSeconds: active.reduce((n, p) => n + getProjectDuration(p), 0)
  };
}

function itemSourcePath(item = {}) {
  return item.path || item.filePath || item.url || item.metadata?.localFile?.path || item.metadata?.localFile?.relativePath || "";
}

export function buildProjectDeliveryPackage(project, itemsById = new Map()) {
  const timeline = buildProjectTimeline(project, itemsById);
  const sourceIds = [...new Set(timeline.clips.map((clip) => clip.itemId).filter(Boolean))];
  const sources = sourceIds.map((id) => {
    const item = itemsById.get?.(id) || {};
    const readiness = buildMediaReadiness(item);
    return {
      id,
      title: item.title || id,
      source: itemSourcePath(item),
      readinessStatus: readiness.status,
      missing: readiness.missing
    };
  });
  return {
    version: "delivery-package/v1",
    generatedAt: new Date().toISOString(),
    project: {
      id: project.id,
      name: project.name || "Untitled",
      description: project.description || ""
    },
    timeline,
    sources,
    markers: sortedMarkers(project.markers || []),
    comments: [...(project.comments || [])]
  };
}

export function buildProductionBoardSummary(projects = [], items = []) {
  const itemsById = new Map((items || []).map((item) => [item.id, item]));
  const active = (projects || []).filter((project) => project.status !== "archived");
  const projectItemIds = new Set();
  let openTasks = 0;
  let approvedClips = 0;
  let unresolvedComments = 0;
  let deliverableProjects = 0;

  for (const project of active) {
    openTasks += (project.tasks || []).filter((task) => task.status !== "done").length;
    approvedClips += (project.roughCuts || []).filter((clip) => clip.reviewStatus === "approved").length;
    unresolvedComments += (project.comments || []).filter((comment) => comment.status !== "resolved").length;
    if (getProjectDuration(project) > 0 && (project.roughCuts || []).some((clip) => clip.reviewStatus === "approved")) {
      deliverableProjects += 1;
    }
    for (const itemId of project.itemIds || []) projectItemIds.add(itemId);
    for (const clip of project.roughCuts || []) if (clip.itemId) projectItemIds.add(clip.itemId);
  }

  const mediaWarnings = [...projectItemIds]
    .map((id) => itemsById.get(id))
    .filter(Boolean)
    .map((item) => buildMediaReadiness(item))
    .filter((readiness) => readiness.status !== "ready").length;

  return {
    activeProjects: active.length,
    openTasks,
    approvedClips,
    unresolvedComments,
    deliverableProjects,
    mediaWarnings
  };
}

const READINESS_CHECKS = [
  { id: "source", label: "ملف المصدر" },
  { id: "thumbnail", label: "صورة مصغّرة" },
  { id: "audio", label: "مسار صوت" },
  { id: "transcription", label: "تفريغ" },
  { id: "web", label: "نسخة ويب" }
];

export function buildMediaReadiness(item = {}) {
  const media = item.metadata?.media || {};
  const hasSource = Boolean(item.path || item.filePath || item.url || media.sourceKey || item.metadata?.localFile?.relativePath);
  const hasThumbnail = Boolean(media.thumbnailKey);
  const hasAudio = Boolean(media.audioKey);
  const hasTranscription = Boolean(media.transcription || (Array.isArray(media.segments) && media.segments.length));
  const hasWeb = Boolean(media.derivedKey || (Array.isArray(media.derivedFiles) && media.derivedFiles.length));
  const values = { source: hasSource, thumbnail: hasThumbnail, audio: hasAudio, transcription: hasTranscription, web: hasWeb };
  const missing = READINESS_CHECKS.filter((check) => !values[check.id]);
  const score = READINESS_CHECKS.length - missing.length;
  return {
    score,
    total: READINESS_CHECKS.length,
    status: !hasSource ? "blocked" : missing.length ? "warning" : "ready",
    missing
  };
}

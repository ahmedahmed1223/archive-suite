import { normalizeArabicSearchText } from "../../utils/formatting.js";

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

function normalizeTaskStatus(status) {
  return PROJECT_TASK_STATUSES.includes(status) ? status : "todo";
}

/** A rough cut = a clip on the timeline referencing one source item. */
export function createRoughCutValue(partial = {}) {
  const inSec = toNum(partial.inSec);
  let outSec = toNum(partial.outSec);
  if (outSec <= inSec) outSec = inSec; // clamped; isValidRoughCut flags zero-length
  return {
    id: partial.id || uid("cut"),
    itemId: String(partial.itemId || ""),
    inSec,
    outSec,
    label: String(partial.label || "").trim(),
    order: Number.isInteger(partial.order) ? partial.order : 0
  };
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

/** A rough cut is usable only if it points at an item and has positive length. */
export function isValidRoughCut(cut) {
  return Boolean(cut?.itemId) && toNum(cut.inSec) < toNum(cut.outSec);
}

export function roughCutDuration(cut) {
  return Math.max(0, toNum(cut?.outSec) - toNum(cut?.inSec));
}

export function createProjectValue(partial = {}) {
  const now = new Date().toISOString();
  return {
    id: partial.id || uid("project"),
    name: String(partial.name || "").trim(),
    description: String(partial.description || "").trim(),
    itemIds: Array.isArray(partial.itemIds) ? [...new Set(partial.itemIds.map(String))] : [],
    roughCuts: Array.isArray(partial.roughCuts) ? partial.roughCuts.map(createRoughCutValue) : [],
    tasks: Array.isArray(partial.tasks) ? partial.tasks.map(createProjectTaskValue) : [],
    notes: String(partial.notes || ""),
    status: partial.status === "archived" ? "archived" : "active",
    createdAt: partial.createdAt || now,
    updatedAt: now
  };
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
  let timelineStart = 0;
  const clips = getOrderedRoughCuts(project).filter(isValidRoughCut).map((cut) => {
    const item = itemsById.get?.(cut.itemId) || null;
    const duration = roughCutDuration(cut);
    const clip = {
      id: cut.id,
      itemId: cut.itemId,
      title: cut.label || item?.title || cut.itemId,
      source: item?.path || item?.metadata?.localFile?.relativePath || "",
      sourceIn: cut.inSec,
      sourceOut: cut.outSec,
      timelineStart,
      duration
    };
    timelineStart += duration;
    return clip;
  });
  return {
    project: { id: project.id, name: project.name },
    fps: null,
    totalDuration: timelineStart,
    clips,
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

import { buildErrorReport } from "./errorReportBuilder.js";

export interface ErrorLogEntry {
  id: string;
  timestamp: string;
  name: string;
  message: string;
  stack: string;
  page: string;
  operation: string;
  targetId: string | null;
  targetType: string | null;
  severity: string;
  suggestion: string;
  recoverable: boolean;
  device: Record<string, unknown>;
  count?: number;
  firstSeen?: string;
  lastSeen?: string;
  __fp?: string;
}

export interface ErrorFilters {
  severity?: string;
  page?: string;
  query?: string;
}

const STORAGE_KEY = "archive.errorLog.v1";
const MAX_ENTRIES = 200;

let entries: ErrorLogEntry[] = [];
let cachedSnapshot: ErrorLogEntry[] | null = null;
const listeners = new Set<(snapshot: ErrorLogEntry[]) => void>();

function defaultStorage() {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

function fingerprint(report: Pick<ErrorLogEntry, "name" | "message" | "operation" | "page" | "severity">) {
  return [report.name || "Error", report.message || "", report.operation || "", report.page || "", report.severity || "error"]
    .join("\u0001")
    .toLowerCase();
}

function getSnapshot() {
  if (!cachedSnapshot) cachedSnapshot = Object.freeze(entries.slice()) as ErrorLogEntry[];
  return cachedSnapshot;
}

function notify() {
  const snapshot = getSnapshot();
  for (const listener of listeners) {
    try {
      listener(snapshot);
    } catch {
      /* never let a listener break logging */
    }
  }
}

function invalidate() {
  cachedSnapshot = null;
}

function persist(storage: Storage | null) {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* non-fatal */
  }
}

export function loadErrorLog(storage = defaultStorage()) {
  if (!storage) return getSnapshot();
  try {
    const raw = storage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    entries = Array.isArray(parsed) ? parsed.slice(0, MAX_ENTRIES) : [];
  } catch {
    entries = [];
  }
  invalidate();
  notify();
  return getSnapshot();
}

export function recordError(errorOrReport: unknown, context: Record<string, unknown> = {}, storage = defaultStorage()) {
  const report =
    errorOrReport && typeof errorOrReport === "object" && "id" in errorOrReport && "timestamp" in errorOrReport
      ? (errorOrReport as ErrorLogEntry)
      : (buildErrorReport(errorOrReport, context) as ErrorLogEntry);

  const enriched: ErrorLogEntry = {
    ...report,
    count: 1,
    firstSeen: report.timestamp,
    lastSeen: report.timestamp
  };

  const fp = fingerprint(enriched);
  const existingIndex = entries.findIndex((entry) => entry.__fp === fp || fingerprint(entry) === fp);
  if (existingIndex !== -1) {
    const existing = entries[existingIndex];
    const merged: ErrorLogEntry = {
      ...enriched,
      id: existing.id,
      __fp: fp,
      firstSeen: existing.firstSeen || existing.timestamp,
      lastSeen: enriched.lastSeen,
      count: (existing.count || 1) + 1
    };
    entries = [merged, ...entries.filter((_, i) => i !== existingIndex)].slice(0, MAX_ENTRIES);
    persist(storage);
    invalidate();
    notify();
    return merged;
  }

  entries = [{ ...enriched, __fp: fp }, ...entries].slice(0, MAX_ENTRIES);
  persist(storage);
  invalidate();
  notify();
  return enriched;
}

export function listErrors() {
  return getSnapshot();
}

export function removeError(id: string, storage = defaultStorage()) {
  const before = entries.length;
  entries = entries.filter((entry) => entry.id !== id);
  if (entries.length !== before) {
    persist(storage);
    invalidate();
    notify();
    return true;
  }
  return false;
}

export function clearErrorLog(storage = defaultStorage()) {
  entries = [];
  persist(storage);
  invalidate();
  notify();
}

export function countBySeverity(list = entries) {
  const source = Array.isArray(list) ? list : entries;
  const counts: Record<"critical" | "error" | "warning" | "info", number> = { critical: 0, error: 0, warning: 0, info: 0 };
  for (const entry of source) {
    const key = counts[entry.severity as keyof typeof counts] !== undefined ? (entry.severity as keyof typeof counts) : "error";
    counts[key] += 1;
  }
  return counts;
}

export function filterErrors(list: unknown, filters: ErrorFilters = {}) {
  const source = Array.isArray(list) ? (list as ErrorLogEntry[]) : entries;
  const query = (filters.query || "").trim().toLowerCase();
  return source.filter((entry) => {
    if (filters.severity && entry.severity !== filters.severity) return false;
    if (filters.page && entry.page !== filters.page) return false;
    if (query) {
      const haystack = `${entry.message} ${entry.operation} ${entry.page}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

export function subscribeErrorLog(listener: unknown) {
  if (typeof listener !== "function") return () => {};
  listeners.add(listener as (snapshot: ErrorLogEntry[]) => void);
  return () => listeners.delete(listener as (snapshot: ErrorLogEntry[]) => void);
}

export function __resetErrorLogForTests() {
  entries = [];
  invalidate();
  listeners.clear();
}

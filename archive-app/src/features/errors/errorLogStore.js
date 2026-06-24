import { buildErrorReport } from "./errorReportBuilder.js";

/**
 * Central error log (§1281).
 *
 * A small subscribable store that keeps the most recent error reports, persists
 * them across reloads, and powers the filterable ErrorLogPage. Kept independent
 * of the main app store so any layer (utils, slices, components) can record an
 * error without a store handle.
 *
 * Repeated errors are grouped: a stable fingerprint (name + message +
 * operation + page) collapses identical reports into a single entry with a
 * `count` and `lastSeen` instead of flooding the log with N copies — this is
 * the "error grouping" gap flagged in the per-page UX backlog. The snapshot
 * handed to useSyncExternalStore is cached so React 19's "getSnapshot should be
 * cached" warning never fires and re-renders only happen when the list really
 * changes.
 */

const STORAGE_KEY = "archive.errorLog.v1";
const MAX_ENTRIES = 200;

let entries = [];
let cachedSnapshot = null;
const listeners = new Set();

function defaultStorage() {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** A stable key used to collapse repeats of the same logical error. */
function fingerprint(report) {
  return [
    report.name || "Error",
    report.message || "",
    report.operation || "",
    report.page || "",
    report.severity || "error"
  ].join("\u0001").toLowerCase();
}

function getSnapshot() {
  if (!cachedSnapshot) cachedSnapshot = Object.freeze(entries.slice());
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

function persist(storage) {
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

/**
 * Records an error. Accepts a pre-built report, or (error, context) which it
 * normalizes via buildErrorReport. Repeated errors (same fingerprint) increment
 * an existing entry's `count`, refresh its `lastSeen`, and bubble it back to the
 * top instead of appending a duplicate. Returns the stored report.
 */
export function recordError(errorOrReport, context = {}, storage = defaultStorage()) {
  const report = errorOrReport && errorOrReport.id && errorOrReport.timestamp
    ? errorOrReport
    : buildErrorReport(errorOrReport, context);

  // Enrich grouping/sorting metadata so dedup is stable across reloads.
  const enriched = {
    ...report,
    count: 1,
    firstSeen: report.timestamp,
    lastSeen: report.timestamp
  };

  const fp = fingerprint(enriched);
  const existingIndex = entries.findIndex((entry) => entry.__fp === fp || fingerprint(entry) === fp);
  if (existingIndex !== -1) {
    const existing = entries[existingIndex];
    const merged = {
      ...enriched,
      id: existing.id,
      __fp: fp,
      // keep the earliest occurrence, bump the repeat counter + latest time.
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

export function removeError(id, storage = defaultStorage()) {
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

/**
 * Counts reports per severity. Used by ErrorLogPage to badge the filter chips.
 */
export function countBySeverity(list = entries) {
  const source = Array.isArray(list) ? list : entries;
  const counts = { critical: 0, error: 0, warning: 0, info: 0 };
  for (const entry of source) {
    const key = counts[entry.severity] !== undefined ? entry.severity : "error";
    counts[key] += 1;
  }
  return counts;
}

/**
 * Filters reports by { severity, page, query }.
 */
export function filterErrors(list, filters = {}) {
  const source = Array.isArray(list) ? list : entries;
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

export function subscribeErrorLog(listener) {
  if (typeof listener !== "function") return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function __resetErrorLogForTests() {
  entries = [];
  invalidate();
  listeners.clear();
}

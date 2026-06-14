import { buildErrorReport } from "./errorReportBuilder.js";

/**
 * Central error log (§1281).
 *
 * A small subscribable store that keeps the most recent error reports, persists
 * them across reloads, and powers the filterable ErrorLogPage. Kept independent
 * of the main app store so any layer (utils, slices, components) can record an
 * error without a store handle.
 */

const STORAGE_KEY = "archive.errorLog.v1";
const MAX_ENTRIES = 200;

let entries = [];
const listeners = new Set();

function defaultStorage() {
  try {
    return typeof window !== "undefined" && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

function notify() {
  const snapshot = listErrors();
  for (const listener of listeners) {
    try {
      listener(snapshot);
    } catch {
      /* never let a listener break logging */
    }
  }
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
  if (!storage) return entries;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    entries = Array.isArray(parsed) ? parsed.slice(0, MAX_ENTRIES) : [];
  } catch {
    entries = [];
  }
  notify();
  return entries;
}

/**
 * Records an error. Accepts a pre-built report, or (error, context) which it
 * normalizes via buildErrorReport. Returns the stored report.
 */
export function recordError(errorOrReport, context = {}, storage = defaultStorage()) {
  const report = errorOrReport && errorOrReport.id && errorOrReport.timestamp
    ? errorOrReport
    : buildErrorReport(errorOrReport, context);
  entries = [report, ...entries].slice(0, MAX_ENTRIES);
  persist(storage);
  notify();
  return report;
}

export function listErrors() {
  return [...entries];
}

export function removeError(id, storage = defaultStorage()) {
  const before = entries.length;
  entries = entries.filter((entry) => entry.id !== id);
  if (entries.length !== before) {
    persist(storage);
    notify();
    return true;
  }
  return false;
}

export function clearErrorLog(storage = defaultStorage()) {
  entries = [];
  persist(storage);
  notify();
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
  listeners.clear();
}

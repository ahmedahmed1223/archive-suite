"use client";

export type ClientErrorSeverity = "error" | "warning" | "info";

export interface ClientErrorLogEntry {
  id: string;
  name: string;
  message: string;
  page: string;
  severity: ClientErrorSeverity;
  source: "window-error" | "unhandled-rejection" | "manual";
  count: number;
  firstSeenAt: string;
  lastSeenAt: string;
  stack?: string;
}

const STORAGE_KEY = "archive-next:error-log";
const MAX_ENTRIES = 100;

function nowIso() {
  return new Date().toISOString();
}

function readRaw(): ClientErrorLogEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRaw(entries: ClientErrorLogEntry[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  window.dispatchEvent(new CustomEvent("archive-next:error-log-updated"));
}

function fingerprint(entry: Pick<ClientErrorLogEntry, "name" | "message" | "page" | "source">) {
  return `${entry.source}:${entry.page}:${entry.name}:${entry.message}`;
}

export function listClientErrors() {
  return readRaw();
}

export function clearClientErrors() {
  writeRaw([]);
}

export function recordClientError(
  report: Pick<ClientErrorLogEntry, "name" | "message" | "page" | "source"> &
    Partial<Pick<ClientErrorLogEntry, "severity" | "stack">>
) {
  const entries = readRaw();
  const key = fingerprint(report);
  const existingIndex = entries.findIndex((entry) => fingerprint(entry) === key);
  const timestamp = nowIso();

  if (existingIndex >= 0) {
    const existing = entries[existingIndex];
    entries.splice(existingIndex, 1);
    writeRaw([
      {
        ...existing,
        count: existing.count + 1,
        lastSeenAt: timestamp,
        stack: report.stack || existing.stack
      },
      ...entries
    ]);
    return;
  }

  writeRaw([
    {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      name: report.name || "Error",
      message: report.message || "Unknown client error",
      page: report.page || "/",
      severity: report.severity || "error",
      source: report.source,
      count: 1,
      firstSeenAt: timestamp,
      lastSeenAt: timestamp,
      stack: report.stack
    },
    ...entries
  ]);
}

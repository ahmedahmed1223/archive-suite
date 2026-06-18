import fs from "node:fs";
import os from "node:os";

const DEFAULT_MODE = process.env.CONTROL_AGENT_MODE || "read-only";
const DEFAULT_LOG_LIMIT = 100;

function finite(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function percent(used, total) {
  const u = finite(used);
  const t = finite(total);
  if (u === null || t === null || t <= 0) return null;
  return Math.max(0, Math.min(100, (u / t) * 100));
}

function safeDiskUsage(path = process.cwd()) {
  try {
    if (typeof fs.statfsSync !== "function") return null;
    const stat = fs.statfsSync(path);
    const total = Number(stat.blocks) * Number(stat.bsize);
    const free = Number(stat.bfree) * Number(stat.bsize);
    if (!Number.isFinite(total) || !Number.isFinite(free) || total <= 0) return null;
    return { used: total - free, total };
  } catch {
    return null;
  }
}

function redactLogLine(line) {
  return String(line ?? "")
    .replace(/\b(token|secret|password|api[_-]?key)=\S+/gi, "$1=***")
    .replace(/\b(Bearer)\s+[A-Za-z0-9._~+/-]+=*/gi, "$1 ***");
}

function normalizeService(service, index) {
  const id = String(service?.id || service?.name || `service-${index}`);
  return {
    id,
    name: String(service?.name || service?.id || id),
    status: String(service?.status || "unknown"),
    detail: service?.detail ? String(service.detail) : ""
  };
}

export function createControlAgent({
  mode = DEFAULT_MODE,
  now = () => new Date(),
  platform = os.platform,
  uptime = os.uptime,
  loadavg = os.loadavg,
  cpus = os.cpus,
  totalmem = os.totalmem,
  freemem = os.freemem,
  diskUsage = () => safeDiskUsage(process.env.FILE_STORE_DIR || process.cwd()),
  services = null,
  readLogs = null
} = {}) {
  async function status() {
    const cpuCount = Math.max(1, cpus()?.length || 1);
    const load = loadavg?.() || [];
    const cpuLoad = finite(load[0]);
    const totalMemory = finite(totalmem?.());
    const freeMemory = finite(freemem?.());
    const disk = diskUsage?.();
    const defaultServices = [
      { id: "archive-api", name: "Archive API", status: "running", detail: "Node HTTP server" }
    ];

    return {
      ok: true,
      mode,
      readOnly: true,
      platform: platform?.() || "unknown",
      checkedAt: now().toISOString(),
      uptimeSec: Math.max(0, Math.floor(finite(uptime?.()) ?? 0)),
      metrics: {
        cpu: cpuLoad === null ? {} : { percent: Math.min(100, Math.max(0, (cpuLoad / cpuCount) * 100)), load1: cpuLoad },
        memory: totalMemory === null || freeMemory === null
          ? {}
          : { used: totalMemory - freeMemory, total: totalMemory, percent: percent(totalMemory - freeMemory, totalMemory) },
        disk: disk ? { ...disk, percent: percent(disk.used, disk.total) } : {}
      },
      services: (Array.isArray(services) ? services : defaultServices).map(normalizeService)
    };
  }

  async function logs({ service = "archive-api", limit = DEFAULT_LOG_LIMIT } = {}) {
    const safeLimit = Math.min(Math.max(Number(limit) || DEFAULT_LOG_LIMIT, 1), 500);
    const rawLines = typeof readLogs === "function" ? await readLogs({ service, limit: safeLimit }) : [];
    const lines = (Array.isArray(rawLines) ? rawLines : [])
      .slice(-safeLimit)
      .map((entry) => {
        if (entry && typeof entry === "object") {
          return {
            ts: entry.ts || now().toISOString(),
            service: String(entry.service || service),
            line: redactLogLine(entry.line ?? entry.message ?? "")
          };
        }
        return { ts: now().toISOString(), service: String(service), line: redactLogLine(entry) };
      });
    return { ok: true, service: String(service), limit: safeLimit, lines };
  }

  async function unsupportedAction(action) {
    return {
      ok: false,
      action: String(action),
      error: "System control actions are disabled in this safe read-only slice."
    };
  }

  return { status, logs, unsupportedAction };
}

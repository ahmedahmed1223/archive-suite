import fs from "node:fs";
import os from "node:os";
import { spawn } from "node:child_process";
import { config } from "../config/env.js";

const DEFAULT_MODE = config.controlAgentMode;
const DEFAULT_LOG_LIMIT = 100;
const CONTROL_ACTIONS = new Set(["start", "stop", "restart", "apply-config"]);

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
    detail: service?.detail ? String(service.detail) : "",
    actions: Array.isArray(service?.actions)
      ? service.actions.filter((action) => CONTROL_ACTIONS.has(action))
      : Array.from(CONTROL_ACTIONS),
    dockerService: service?.dockerService ? String(service.dockerService) : "",
    systemdUnit: service?.systemdUnit ? String(service.systemdUnit) : "",
    windowsService: service?.windowsService ? String(service.windowsService) : "",
    composeFile: service?.composeFile ? String(service.composeFile) : ""
  };
}

function parseServices(raw) {
  if (Array.isArray(raw)) return raw;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function defaultExecutor({ command, args = [], timeoutMs = 30_000 }) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { shell: false, windowsHide: true });
    const stdout = [];
    const stderr = [];
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      resolve({ code: 124, stdout: "", stderr: "Command timed out." });
    }, timeoutMs);
    child.stdout?.on("data", (chunk) => stdout.push(chunk));
    child.stderr?.on("data", (chunk) => stderr.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ code: 1, stdout: "", stderr: error?.message || "Command failed." });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        code: Number.isFinite(code) ? code : 1,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8")
      });
    });
  });
}

function enabledFromEnv(value) {
  return ["1", "true", "yes", "enabled"].includes(String(value || "").toLowerCase());
}

function buildCommand({ action, mode, service }) {
  const normalizedAction = action === "apply-config" ? "restart" : action;
  if (mode === "docker") {
    const target = service.dockerService || service.id;
    const composeFile = service.composeFile || config.composeFile;
    return { command: "docker", args: ["compose", "-f", composeFile, normalizedAction, target] };
  }
  if (mode === "linux-native") {
    const target = service.systemdUnit || service.id;
    const systemctlAction = action === "apply-config" ? "reload-or-restart" : normalizedAction;
    return { command: "systemctl", args: [systemctlAction, target] };
  }
  if (mode === "windows-native") {
    const target = service.windowsService || service.id;
    const powershellAction = {
      start: "Start-Service",
      stop: "Stop-Service",
      restart: "Restart-Service",
      "apply-config": "Restart-Service"
    }[action];
    return {
      command: "powershell.exe",
      args: [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        `${powershellAction} -Name ([string]$args[0])`,
        target
      ]
    };
  }
  return null;
}

export function createControlAgent({
  mode = DEFAULT_MODE,
  actionsEnabled = enabledFromEnv(config.controlAgentActions),
  now = () => new Date(),
  platform = os.platform,
  uptime = os.uptime,
  loadavg = os.loadavg,
  cpus = os.cpus,
  totalmem = os.totalmem,
  freemem = os.freemem,
  diskUsage = () => safeDiskUsage(config.fileStoreDir || process.cwd()),
  services = parseServices(JSON.stringify(config.controlAgentServices)),
  readLogs = null,
  executor = defaultExecutor
} = {}) {
  const configuredServices = Array.isArray(services) ? services.map(normalizeService) : null;

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
      actionsEnabled: Boolean(actionsEnabled),
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
      services: (configuredServices || defaultServices.map(normalizeService)).map((svc) => ({
        id: svc.id,
        name: svc.name,
        status: svc.status,
        detail: svc.detail,
        actions: actionsEnabled ? svc.actions : []
      }))
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
      statusCode: 501,
      errorCode: "disabled",
      error: "System control actions are disabled in this safe read-only slice."
    };
  }

  async function runAction(action, { service: serviceId = "archive-api" } = {}) {
    if (!CONTROL_ACTIONS.has(action)) {
      return { ok: false, action, statusCode: 404, errorCode: "unknown_action", error: "Unknown control action." };
    }
    if (!actionsEnabled) return unsupportedAction(action);
    const service = (configuredServices || []).find((svc) => svc.id === serviceId || svc.name === serviceId);
    if (!service) {
      return { ok: false, action, service: serviceId, statusCode: 400, errorCode: "unknown_service", error: "Unknown control service." };
    }
    if (!service.actions.includes(action)) {
      return { ok: false, action, service: service.id, statusCode: 403, errorCode: "action_not_allowed", error: "Action is not allowed for this service." };
    }
    const command = buildCommand({ action, mode, service });
    if (!command) return unsupportedAction(action);
    const result = await executor({ ...command, action, service, mode });
    const ok = result.code === 0;
    return {
      ok,
      action,
      service: service.id,
      mode,
      statusCode: ok ? 200 : 500,
      code: result.code,
      stdout: redactLogLine(result.stdout || "").trim(),
      stderr: redactLogLine(result.stderr || "").trim(),
      error: ok ? undefined : "Control command failed."
    };
  }

  return { status, logs, unsupportedAction, runAction };
}

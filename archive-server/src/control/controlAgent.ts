import fs from "node:fs";
import os from "node:os";
import { spawn } from "node:child_process";
import { config } from "../config/env.js";

const DEFAULT_MODE = config.controlAgentMode;
const DEFAULT_LOG_LIMIT = 100;
const CONTROL_ACTIONS = new Set(["start", "stop", "restart", "apply-config"]);

interface ControlAgentOptions {
  mode?: string;
  actionsEnabled?: boolean;
  now?: () => Date;
  platform?: () => string;
  uptime?: () => number;
  loadavg?: () => number[];
  cpus?: () => { model: string }[];
  totalmem?: () => number;
  freemem?: () => number;
  diskUsage?: () => { used: number; total: number } | null;
  services?: unknown;
  readLogs?: ((opts: { service: string; limit: number }) => Promise<unknown[]>) | null;
  executor?: (opts: ExecutorInput) => Promise<ExecutorResult>;
}

interface ExecutorInput {
  command: string;
  args?: string[];
  timeoutMs?: number;
  action?: string;
  service?: unknown;
  mode?: string;
}

interface ExecutorResult {
  code: number;
  stdout: string;
  stderr: string;
}

interface MetricsData {
  cpu?: { percent?: number; load1?: number };
  memory?: { used: number; total: number; percent?: number };
  disk?: { used: number; total: number; percent?: number };
}

function finite(value: unknown): number | null {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function percent(used: unknown, total: unknown): number | null {
  const u = finite(used);
  const t = finite(total);
  if (u === null || t === null || t <= 0) return null;
  return Math.max(0, Math.min(100, (u / t) * 100));
}

function safeDiskUsage(path = process.cwd()): { used: number; total: number } | null {
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

function redactLogLine(line: unknown): string {
  return String(line ?? "")
    .replace(/\b(token|secret|password|api[_-]?key)=\S+/gi, "$1=***")
    .replace(/\b(Bearer)\s+[A-Za-z0-9._~+/-]+=*/gi, "$1 ***");
}

interface NormalizedService {
  id: string;
  name: string;
  status: string;
  detail: string;
  actions: string[];
  dockerService: string;
  systemdUnit: string;
  windowsService: string;
  composeFile: string;
}

function normalizeService(service: unknown, index: number): NormalizedService {
  const s = service as any;
  const id = String(s?.id || s?.name || `service-${index}`);
  return {
    id,
    name: String(s?.name || s?.id || id),
    status: String(s?.status || "unknown"),
    detail: s?.detail ? String(s.detail) : "",
    actions: Array.isArray(s?.actions)
      ? (s.actions as unknown[]).filter((action: unknown) => CONTROL_ACTIONS.has(String(action))).map(String) as any
      : Array.from(CONTROL_ACTIONS),
    dockerService: s?.dockerService ? String(s.dockerService) : "",
    systemdUnit: s?.systemdUnit ? String(s.systemdUnit) : "",
    windowsService: s?.windowsService ? String(s.windowsService) : "",
    composeFile: s?.composeFile ? String(s.composeFile) : ""
  };
}

function parseServices(raw: unknown): unknown[] | null {
  if (Array.isArray(raw)) return raw;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function defaultExecutor({ command, args = [], timeoutMs = 30_000 }: ExecutorInput): Promise<ExecutorResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { shell: false, windowsHide: true });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      resolve({ code: 124, stdout: "", stderr: "Command timed out." });
    }, timeoutMs);
    child.stdout?.on("data", (chunk) => stdout.push(chunk));
    child.stderr?.on("data", (chunk) => stderr.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ code: 1, stdout: "", stderr: (error as any)?.message || "Command failed." });
    });
    child.on("close", (code: number | null) => {
      clearTimeout(timer);
      resolve({
        code: code !== null && Number.isFinite(code) ? code : 1,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8")
      });
    });
  });
}

function enabledFromEnv(value: unknown): boolean {
  return ["1", "true", "yes", "enabled"].includes(String(value || "").toLowerCase());
}

function buildCommand({ action, mode, service }: { action: string; mode: string; service: NormalizedService }): { command: string; args: string[] } | null {
  const normalizedAction = action === "apply-config" ? "restart" : action;
  if (mode === "docker") {
    const target = (service as any).dockerService || service.id;
    const composeFile = (service as any).composeFile || config.composeFile;
    return { command: "docker", args: ["compose", "-f", composeFile, normalizedAction, target] };
  }
  if (mode === "linux-native") {
    const target = (service as any).systemdUnit || service.id;
    const systemctlAction = action === "apply-config" ? "reload-or-restart" : normalizedAction;
    return { command: "systemctl", args: [systemctlAction, target] };
  }
  if (mode === "windows-native") {
    const target = (service as any).windowsService || service.id;
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

export function createControlAgent(options: ControlAgentOptions = {}) {
  const mode = options.mode || DEFAULT_MODE;
  const actionsEnabled = options.actionsEnabled || enabledFromEnv(config.controlAgentActions);
  const now = options.now || (() => new Date());
  const platform = options.platform || os.platform;
  const uptime = options.uptime || os.uptime;
  const loadavg = options.loadavg || os.loadavg;
  const cpus = options.cpus || os.cpus;
  const totalmem = options.totalmem || os.totalmem;
  const freemem = options.freemem || os.freemem;
  const diskUsage = options.diskUsage || (() => safeDiskUsage(config.fileStoreDir || process.cwd()));
  const services = options.services || parseServices(JSON.stringify(config.controlAgentServices));
  const readLogs = options.readLogs;
  const executor = options.executor || defaultExecutor;

  const configuredServices: NormalizedService[] | null = Array.isArray(services) ? (services as any[]).map(normalizeService) : null;

  async function status() {
    const cpuCount = Math.max(1, (cpus?.() || []).length || 1);
    const load = loadavg?.() || [];
    const cpuLoad = finite(load[0]);
    const totalMemory = finite(totalmem?.());
    const freeMemory = finite(freemem?.());
    const disk = diskUsage?.();
    const defaultServices = [
      { id: "archive-api", name: "Archive API", status: "running", detail: "Node HTTP server" }
    ];

    const metrics: MetricsData = {
      cpu: cpuLoad === null ? undefined : { percent: Math.min(100, Math.max(0, (cpuLoad / cpuCount) * 100)), load1: cpuLoad },
      memory: totalMemory === null || freeMemory === null
        ? undefined
        : { used: totalMemory - freeMemory, total: totalMemory, percent: percent(totalMemory - freeMemory, totalMemory) || undefined },
      disk: disk ? { ...disk, percent: percent(disk.used, disk.total) || undefined } : undefined
    };

    return {
      ok: true,
      mode,
      readOnly: true,
      actionsEnabled: Boolean(actionsEnabled),
      platform: platform?.() || "unknown",
      checkedAt: now().toISOString(),
      uptimeSec: Math.max(0, Math.floor(finite(uptime?.()) ?? 0)),
      metrics,
      services: (configuredServices || (defaultServices as any[]).map(normalizeService)).map((svc) => ({
        id: svc.id,
        name: svc.name,
        status: svc.status,
        detail: svc.detail,
        actions: actionsEnabled ? svc.actions : []
      }))
    };
  }

  async function logs({ service = "archive-api", limit = DEFAULT_LOG_LIMIT } = {}): Promise<{ ok: boolean; service: string; limit: number; lines: unknown[] }> {
    const safeLimit = Math.min(Math.max(Number(limit) || DEFAULT_LOG_LIMIT, 1), 500);
    const rawLines = typeof readLogs === "function" ? await readLogs({ service, limit: safeLimit }) : [];
    const lines = (Array.isArray(rawLines) ? rawLines : [])
      .slice(-safeLimit)
      .map((entry: unknown) => {
        const e = entry as any;
        if (e && typeof e === "object") {
          return {
            ts: e.ts || now().toISOString(),
            service: String(e.service || service),
            line: redactLogLine(e.line ?? e.message ?? "")
          };
        }
        return { ts: now().toISOString(), service: String(service), line: redactLogLine(entry) };
      });
    return { ok: true, service: String(service), limit: safeLimit, lines };
  }

  async function unsupportedAction(action: string): Promise<{ ok: boolean; action: string; statusCode: number; errorCode: string; error: string }> {
    return {
      ok: false,
      action: String(action),
      statusCode: 501,
      errorCode: "disabled",
      error: "System control actions are disabled in this safe read-only slice."
    };
  }

  async function runAction(action: string, { service: serviceId = "archive-api" } = {}): Promise<unknown> {
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

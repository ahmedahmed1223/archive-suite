import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function countTaskCheckboxes(source) {
  const lines = String(source).split(/\r?\n/);
  return {
    open: lines.filter((line) => /^\s*- \[ \]/.test(line)).length,
    completed: lines.filter((line) => /^\s*- \[[xX]\]/.test(line)).length,
  };
}

function defaultRun(command, args) {
  return spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
  });
}

function successfulText(result) {
  return result?.status === 0 ? String(result.stdout ?? "").trim() : null;
}

export function collectAgentStatus({
  root = ROOT,
  run = defaultRun,
  read = (file) => readFileSync(file, "utf8"),
  exists = existsSync,
} = {}) {
  const pnpmInvocation = process.platform === "win32"
    ? ["cmd.exe", ["/d", "/s", "/c", "pnpm", "--version"]]
    : ["pnpm", ["--version"]];
  const pnpm = successfulText(run(...pnpmInvocation));
  const gitStatus = successfulText(run("git", ["-c", `safe.directory=${root.replaceAll("\\", "/")}`, "status", "--short"]));
  const dockerVersion = successfulText(run("docker", ["version", "--format", "{{.Server.Version}}"]));
  const taskFile = path.join(root, "TASKS.md");
  const tasks = exists(taskFile) ? countTaskCheckboxes(read(taskFile)) : { open: null, completed: null };

  return {
    runtime: { node: process.version, pnpm },
    repository: {
      clean: gitStatus === null ? null : gitStatus.length === 0,
      changedFiles: gitStatus === null || gitStatus.length === 0 ? 0 : gitStatus.split(/\r?\n/).length,
    },
    tasks,
    contract: {
      openapi: exists(path.join(root, "docs", "api", "archive-contract.openapi.json")),
    },
    docker: {
      available: dockerVersion !== null,
      version: dockerVersion,
    },
  };
}

export function formatAgentStatus(status) {
  const clean = status.repository.clean === null ? "unknown" : status.repository.clean ? "clean" : `dirty (${status.repository.changedFiles})`;
  return [
    `Node: ${status.runtime.node}`,
    `pnpm: ${status.runtime.pnpm ?? "unavailable"}`,
    `Git: ${clean}`,
    `Tasks: ${status.tasks.open ?? "unknown"} open, ${status.tasks.completed ?? "unknown"} completed in TASKS.md`,
    `OpenAPI: ${status.contract.openapi ? "present" : "missing"}`,
    `Docker: ${status.docker.available ? status.docker.version : "unavailable"}`,
  ].join("\n");
}

function main() {
  const status = collectAgentStatus();
  process.stdout.write(process.argv.includes("--json") ? `${JSON.stringify(status, null, 2)}\n` : `${formatAgentStatus(status)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();

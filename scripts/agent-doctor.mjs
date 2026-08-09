import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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
  exists = existsSync,
} = {}) {
  const pnpmInvocation = process.platform === "win32"
    ? ["cmd.exe", ["/d", "/s", "/c", "pnpm", "--version"]]
    : ["pnpm", ["--version"]];
  const pnpm = successfulText(run(...pnpmInvocation));
  const gitStatus = successfulText(run("git", ["-c", `safe.directory=${root.replaceAll("\\", "/")}`, "status", "--short"]));
  const dockerCliVersion = successfulText(run("docker", ["--version"]));
  const dockerServerVersion = successfulText(run("docker", ["info", "--format", "{{.ServerVersion}}"]));
  return {
    runtime: { node: process.version, pnpm },
    repository: {
      clean: gitStatus === null ? null : gitStatus.length === 0,
      changedFiles: gitStatus === null || gitStatus.length === 0 ? 0 : gitStatus.split(/\r?\n/).length,
    },
    contract: {
      openapi: exists(path.join(root, "docs", "api", "archive-contract.openapi.json")),
    },
    docker: {
      installed: dockerCliVersion !== null,
      cliVersion: dockerCliVersion,
      daemonAvailable: dockerServerVersion !== null,
      serverVersion: dockerServerVersion,
      deploymentOutput: "primary",
    },
  };
}

export function formatAgentStatus(status) {
  const clean = status.repository.clean === null ? "unknown" : status.repository.clean ? "clean" : `dirty (${status.repository.changedFiles})`;
  return [
    `Node: ${status.runtime.node}`,
    `pnpm: ${status.runtime.pnpm ?? "unavailable"}`,
    `Git: ${clean}`,
    `OpenAPI: ${status.contract.openapi ? "present" : "missing"}`,
    `Docker CLI: ${status.docker.installed ? status.docker.cliVersion : "not installed"}`,
    `Docker daemon: ${status.docker.daemonAvailable ? status.docker.serverVersion : "not available"}`,
    "Docker deployment output: primary",
  ].join("\n");
}

function main() {
  const status = collectAgentStatus();
  process.stdout.write(process.argv.includes("--json") ? `${JSON.stringify(status, null, 2)}\n` : `${formatAgentStatus(status)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();

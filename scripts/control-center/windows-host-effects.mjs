// V1-210B host-effects layer: the REAL Windows commands behind the injected
// seams of createWindowsNativeRuntimeAdapter. Everything funnels through one
// injectable runner so unit tests record commands instead of touching the
// host; the default runner is spawnSync. Requires a staged install root
// (services\<id>.exe = pinned WinSW copy, per the package manifest).
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { WINDOWS_SERVICES, renderServiceDefinition } from "./windows-services.mjs";

const HTTP_RULE = "archive-http";

function defaultRun(args) {
  const result = spawnSync(args[0], args.slice(1), { stdio: "pipe", encoding: "utf8" });
  return { status: result.status ?? 1, stdout: result.stdout, stderr: result.stderr };
}

function defaultWriteFile(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

export function createWindowsHostEffects({ installRoot, services = WINDOWS_SERVICES, run = defaultRun, writeFile = defaultWriteFile, readLogTail } = {}) {
  if (typeof installRoot !== "string" || !installRoot.trim()) throw new Error("Windows host effects require an install root.");
  const servicesDir = join(installRoot, "services");
  const exeFor = (id) => join(servicesDir, `${id}.exe`);
  const firstFailure = (results) => results.find((result) => (result?.status ?? 1) !== 0) ?? { status: 0 };

  const serviceControl = {
    install(service) {
      writeFile(join(servicesDir, `${service.id}.xml`), renderServiceDefinition(service));
      return run([exeFor(service.id), "install"]);
    },
    remove: (id) => run([exeFor(id), "uninstall"]),
    start: (id) => run([exeFor(id), "start"]),
    stop: (id) => run([exeFor(id), "stop"]),
    restart: (id) => run([exeFor(id), "restart"]),
    query: (id) => run([exeFor(id), "status"]),
  };

  // Install-root ACLs for the per-service virtual accounts: read/execute on
  // the tree, modify only on storage and logs.
  const applyAcls = () => firstFailure(services.flatMap((service) => [
    run(["icacls", installRoot, "/grant", `NT SERVICE\\${service.id}:(OI)(CI)RX`]),
    run(["icacls", join(installRoot, "storage"), "/grant", `NT SERVICE\\${service.id}:(OI)(CI)M`]),
    run(["icacls", join(installRoot, "logs"), "/grant", `NT SERVICE\\${service.id}:(OI)(CI)M`]),
  ]));

  // Only archive-http accepts inbound traffic; every other service is
  // loopback-only by construction.
  const applyFirewallRules = () => run(["netsh", "advfirewall", "firewall", "add", "rule", `name=${HTTP_RULE}`, "dir=in", "action=allow", "protocol=TCP", "localport=443"]);
  const removeFirewallRules = () => run(["netsh", "advfirewall", "firewall", "delete", "rule", `name=${HTTP_RULE}`]);

  const logs = () => {
    try {
      const read = readLogTail || (() => readdirSync(servicesDir)
        .filter((name) => name.endsWith(".out.log"))
        .map((name) => `── ${name} ──\n${readFileSync(join(servicesDir, name), "utf8").split("\n").slice(-50).join("\n")}`)
        .join("\n"));
      return { status: 0, stdout: read() };
    } catch { return { status: 1 }; }
  };

  const exec = (args) => run([join(installRoot, "runtime", "php", "php.exe"), join(installRoot, "app", "laravel", "artisan"), ...args]);

  return { serviceControl, applyAcls, applyFirewallRules, removeFirewallRules, logs, exec };
}

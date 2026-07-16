// V1-211B host-effects layer: the REAL Linux commands behind the injected
// seams of createLinuxNativeRuntimeAdapter — systemd units, install-root
// ownership for the non-interactive service user, and logrotate. The runner
// and file writer are injectable so unit tests record commands; defaults use
// spawnSync/fs. Firewall stays optional per the platform contract and is not
// provided here — an operator opts in by injecting applyFirewallRules.
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { LINUX_SERVICES, LINUX_SERVICE_USER, renderSystemdUnit } from "./linux-services.mjs";

const UNIT_DIR = "/etc/systemd/system";
const LOGROTATE_PATH = "/etc/logrotate.d/archive-suite";

function defaultRun(args) {
  const result = spawnSync(args[0], args.slice(1), { stdio: "pipe", encoding: "utf8" });
  return { status: result.status ?? 1, stdout: result.stdout, stderr: result.stderr };
}

function defaultWriteFile(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf8");
}

export function createLinuxHostEffects({ installRoot = LINUX_SERVICE_USER.home, services = LINUX_SERVICES, run = defaultRun, writeFile = defaultWriteFile } = {}) {
  const firstFailure = (results) => results.find((result) => (result?.status ?? 1) !== 0) ?? { status: 0 };

  const serviceControl = {
    install(service) {
      writeFile(join(UNIT_DIR, service.unit), renderSystemdUnit(service));
      return firstFailure([run(["systemctl", "daemon-reload"]), run(["systemctl", "enable", service.id])]);
    },
    remove: (id) => firstFailure([
      run(["systemctl", "disable", id]),
      run(["rm", "-f", join(UNIT_DIR, `${id}.service`)]),
      run(["systemctl", "daemon-reload"]),
    ]),
    start: (id) => run(["systemctl", "start", id]),
    stop: (id) => run(["systemctl", "stop", id]),
    restart: (id) => run(["systemctl", "restart", id]),
    query: (id) => run(["systemctl", "status", "--no-pager", id]),
  };

  const applyOwnership = () => run(["chown", "-R", `${LINUX_SERVICE_USER.name}:${LINUX_SERVICE_USER.name}`, installRoot]);

  const applyLogrotate = () => {
    try {
      writeFile(LOGROTATE_PATH, [
        `${join(installRoot, "logs")}/*.log {`,
        "  weekly",
        "  rotate 8",
        "  compress",
        "  missingok",
        "  notifempty",
        `  su ${LINUX_SERVICE_USER.name} ${LINUX_SERVICE_USER.name}`,
        "}",
        "",
      ].join("\n"));
      return { status: 0 };
    } catch { return { status: 1 }; }
  };

  const logs = () => run(["journalctl", "--no-pager", "-n", "200", ...services.flatMap((service) => ["-u", service.id])]);

  const exec = (args) => run([join(installRoot, "runtime", "php", "bin", "php"), join(installRoot, "app", "laravel", "artisan"), ...args]);

  return { serviceControl, applyOwnership, applyLogrotate, logs, exec };
}

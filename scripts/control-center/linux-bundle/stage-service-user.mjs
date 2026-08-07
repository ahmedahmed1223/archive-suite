// The non-interactive system account linux-host-effects.mjs's applyOwnership
// and serviceControl assume already exists (LINUX_SERVICE_USER). This module
// creates it idempotently -- getent's exit code (2 = "not found") is the
// standard POSIX way to check for an existing passwd/group entry.
import { spawnSync } from "node:child_process";
import { LINUX_SERVICE_USER } from "../linux-services.mjs";

function defaultRun(args) {
  const result = spawnSync(args[0], args.slice(1), { stdio: "pipe", encoding: "utf8" });
  return { status: result.status ?? 1, stdout: result.stdout, stderr: result.stderr };
}

export function ensureServiceUser({ run = defaultRun, user = LINUX_SERVICE_USER } = {}) {
  const check = run(["getent", "passwd", user.name]);
  if (check.status === 0) return { ok: true, created: false };

  const groupResult = run(["groupadd", "--system", user.name]);
  if (groupResult.status !== 0) return { ok: false, created: false };

  const userResult = run(["useradd", "--system", "--gid", user.name, "--home-dir", user.home, "--shell", user.shell, "--no-create-home", user.name]);
  return { ok: userResult.status === 0, created: userResult.status === 0 };
}

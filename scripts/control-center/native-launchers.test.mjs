import assert from "node:assert/strict";
import test from "node:test";
import { renderLinuxLauncher, renderWindowsLauncher } from "./native-launchers.mjs";

test("renders a Windows installer that invokes only the bundled runtime", () => {
  const script = renderWindowsLauncher({ command: "install" });
  assert.match(script, /%ROOT%runtime\\node\\node\.exe/);
  assert.match(script, /scripts\\control-center\.mjs" install %\*/);
  assert.match(script, /scripts\\control-center\.mjs" wizard/);
  assert.doesNotMatch(script, /powershell -Command|cmd \/c/);
});

test("renders a Linux manager that forwards supported lifecycle commands", () => {
  const script = renderLinuxLauncher({ command: "manage" });
  assert.match(script, /^#!\/usr\/bin\/env sh/m);
  assert.match(script, /runtime\/node\/bin\/node/);
  assert.match(script, /scripts\/control-center\.mjs" "\$@"/);
});

test("rejects launcher commands outside the Native lifecycle", () => {
  assert.throws(() => renderWindowsLauncher({ command: "shell" }), /unsupported/);
  assert.throws(() => renderLinuxLauncher({ command: "restore-all" }), /unsupported/);
});

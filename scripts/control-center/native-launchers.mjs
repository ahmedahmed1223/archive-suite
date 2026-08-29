const COMMANDS = new Set(["install", "manage"]);

function commandFor(command) {
  if (!COMMANDS.has(command)) throw new Error("unsupported Native launcher command.");
  return command;
}

export function renderWindowsLauncher({ command } = {}) {
  const selected = commandFor(command);
  const args = selected === "install" ? "install %*" : "%*";
  return `@echo off\r\nsetlocal EnableExtensions\r\nset "ROOT=%~dp0"\r\n"%ROOT%runtime\\node\\node.exe" "%ROOT%scripts\\control-center.mjs" ${args}\r\nexit /b %ERRORLEVEL%\r\n`;
}

export function renderLinuxLauncher({ command } = {}) {
  const selected = commandFor(command);
  const args = selected === "install" ? "install \"$@\"" : "\"$@\"";
  return `#!/usr/bin/env sh\nset -eu\nROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)\nexec "$ROOT/runtime/node/bin/node" "$ROOT/scripts/control-center.mjs" ${args}\n`;
}

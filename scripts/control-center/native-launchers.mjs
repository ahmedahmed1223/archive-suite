const COMMANDS = new Set(["install", "manage"]);

function commandFor(command) {
  if (!COMMANDS.has(command)) throw new Error("unsupported Native launcher command.");
  return command;
}

export function renderWindowsLauncher({ command } = {}) {
  const selected = commandFor(command);
  const args = selected === "install"
    ? `if "%~1"=="" ("%ROOT%runtime\\node\\node.exe" "%ROOT%scripts\\control-center.mjs" wizard) else ("%ROOT%runtime\\node\\node.exe" "%ROOT%scripts\\control-center.mjs" install %*)`
    : `"%ROOT%runtime\\node\\node.exe" "%ROOT%scripts\\control-center.mjs" %*`;
  return `@echo off\r\nsetlocal EnableExtensions\r\nset "ROOT=%~dp0"\r\n${args}\r\nexit /b %ERRORLEVEL%\r\n`;
}

export function renderLinuxLauncher({ command } = {}) {
  const selected = commandFor(command);
  const args = selected === "install"
    ? `if [ "$#" -eq 0 ]; then set -- wizard; else set -- install "$@"; fi\nexec "$ROOT/runtime/node/bin/node" "$ROOT/scripts/control-center.mjs" "$@"`
    : `exec "$ROOT/runtime/node/bin/node" "$ROOT/scripts/control-center.mjs" "$@"`;
  return `#!/usr/bin/env sh\nset -eu\nROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)\n${args}\n`;
}

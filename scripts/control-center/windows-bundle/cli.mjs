// Thin CLI wrapper around assembleWindowsBundle for `pnpm run
// bundle:windows-native -- --out <dir>`. Wires the real archive-laravel
// composer install and @archive/next pnpm build as buildLaravel/buildNext.
import { spawnSync } from "node:child_process";
import { createCli } from "../cli.mjs";
import { assembleWindowsBundle as defaultAssembleWindowsBundle } from "./assemble.mjs";

function defaultRunCommand(command, args, options) {
  return spawnSync(command, args, { stdio: "inherit", shell: true, ...options });
}

function runAndCheck(runCommand, command, args, options, label) {
  const result = runCommand(command, args, options);
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}: ${result.stderr ?? ""}`);
  }
  return result;
}

export async function runBundleCli(argv, {
  assembleWindowsBundle = defaultAssembleWindowsBundle,
  runCommand = defaultRunCommand,
} = {}) {
  const { flagValue } = createCli(argv);
  const outDir = flagValue("out");
  if (!outDir) throw new Error("runBundleCli requires --out=<directory>.");

  const buildLaravel = async () => {
    runAndCheck(runCommand, "composer", ["install", "--no-dev", "--working-dir=archive-laravel"], {}, "composer install");
  };
  const buildNext = async () => {
    runAndCheck(runCommand, "pnpm", ["--filter", "@archive/next", "build"], {}, "pnpm build");
  };

  return assembleWindowsBundle({ outDir, buildLaravel, buildNext });
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  runBundleCli(process.argv).then(
    (result) => { console.log(`Bundle assembled: ${result.shasumsPath}`); },
    (error) => { console.error(error.message); process.exit(1); }
  );
}

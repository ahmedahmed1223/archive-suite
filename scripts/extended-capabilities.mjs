import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { preflight } from "./acceptance/extended-capabilities.mjs";

const args = process.argv.slice(2);
const outputIndex = args.indexOf("--output");
const envIndex = args.indexOf("--env-file");
const output = outputIndex >= 0 ? args[outputIndex + 1] : undefined;
const envFile = envIndex >= 0 ? args[envIndex + 1] : undefined;
if ((outputIndex >= 0 && !output) || (envIndex >= 0 && !envFile) || args.some((arg, index) => arg.startsWith("--") && !["--output", "--env-file"].includes(arg) && index !== outputIndex + 1 && index !== envIndex + 1)) {
  throw new Error("usage: extended-capabilities.mjs [--env-file path] [--output path]");
}
const commandExists = (command) => spawnSync(command, ["--version"], { stdio: "ignore", windowsHide: true }).status === 0;
const manifest = preflight({ envFile, commandExists });
const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
if (output) writeFileSync(resolve(output), serialized, { encoding: "utf8", mode: 0o600, flag: "wx" });
else process.stdout.write(serialized);

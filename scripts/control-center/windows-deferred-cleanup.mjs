#!/usr/bin/env node
import { removeOwnedPathsWithRetries } from "./uninstall.mjs";

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const value = (name) => process.argv.find((argument) => argument.startsWith(`--${name}=`))?.slice(name.length + 3);
const parentPid = Number(value("parent-pid"));
const paths = process.argv.filter((argument) => argument.startsWith("--path=")).map((argument) => argument.slice(7));

if (!Number.isInteger(parentPid) || parentPid <= 0 || paths.length === 0) process.exit(2);

for (let attempt = 0; attempt < 240; attempt += 1) {
  try { process.kill(parentPid, 0); }
  catch { break; }
  await delay(250);
}

try {
  await removeOwnedPathsWithRetries(paths);
} catch {
  process.exitCode = 1;
}

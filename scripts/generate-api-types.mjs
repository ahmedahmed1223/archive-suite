import { fileURLToPath, pathToFileURL } from "node:url";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import openapiTS, { astToString } from "openapi-typescript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTRACT_PATH = path.join(ROOT, "docs/api/archive-contract.openapi.json");
const GENERATED_PATH = path.join(ROOT, "archive-next/lib/generated/archive-api.ts");
const HEADER = "// Generated from docs/api/archive-contract.openapi.json by pnpm api:generate. Do not edit.\n";

export async function generateApiTypes({ outputPath = GENERATED_PATH } = {}) {
  const ast = await openapiTS(pathToFileURL(CONTRACT_PATH), { alphabetize: true, defaultNonNullable: false });
  const content = HEADER + astToString(ast);
  await writeFile(outputPath, content, "utf8");
  return content;
}

export async function verifyGeneratedApiTypes({ outputPath = GENERATED_PATH } = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "archive-api-types-"));
  try {
    const candidatePath = path.join(directory, "archive-api.ts");
    const expected = await generateApiTypes({ outputPath: candidatePath });
    const actual = await readFile(outputPath, "utf8").catch(() => "");
    return { ok: actual === expected, expectedBytes: Buffer.byteLength(expected), actualBytes: Buffer.byteLength(actual) };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function main() {
  const mode = process.argv[2] ?? "generate";
  if (mode === "generate") {
    await generateApiTypes();
    console.log("ok - generated TypeScript API contract");
    return;
  }
  if (mode === "verify") {
    const result = await verifyGeneratedApiTypes();
    if (!result.ok) {
      console.error(`Generated API types are stale (${result.actualBytes} bytes; expected ${result.expectedBytes}). Run pnpm api:generate.`);
      process.exitCode = 1;
      return;
    }
    console.log("ok - generated TypeScript API contract is current");
    return;
  }
  throw new Error(`Unknown mode: ${mode}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}

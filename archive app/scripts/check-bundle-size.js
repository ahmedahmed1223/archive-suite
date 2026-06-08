#!/usr/bin/env node
/**
 * Bundle size check — warns if output files exceed limits.
 * Run: node scripts/check-bundle-size.js
 */
import { readdirSync, statSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, "../dist");

const LIMITS_MB = {
  ".html": 12,   // singlefile build can be large
  ".js":   2,
  ".css":  0.5,
};

if (!existsSync(distDir)) {
  console.log("dist/ not found — run `pnpm build` first.");
  process.exit(0);
}

let ok = true, totalBytes = 0;
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) { walk(p); continue; }
    totalBytes += st.size;
    const limit = LIMITS_MB[extname(name)];
    if (limit && st.size > limit * 1024 * 1024) {
      console.warn(`⚠  ${name}: ${(st.size/1048576).toFixed(2)}MB > limit ${limit}MB`);
      ok = false;
    }
  }
}
walk(distDir);
console.log(`📦 Total: ${(totalBytes/1048576).toFixed(2)}MB`);
process.exit(ok ? 0 : 1);

import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../../config/env.js";

function fail(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

function resolveKey(rootDir, key) {
  const clean = String(key || "").replace(/^\/+/, "");
  if (!clean || clean.includes("\0")) fail("Invalid file key.");
  const root = path.resolve(rootDir);
  const target = path.resolve(root, clean);
  if (target !== root && !target.startsWith(root + path.sep)) fail("Invalid file key.");
  return { clean, target };
}

async function blobToBuffer(blob) {
  if (Buffer.isBuffer(blob)) return blob;
  if (blob instanceof Uint8Array) return Buffer.from(blob);
  if (typeof blob === "string") return Buffer.from(blob);
  if (blob && typeof blob.arrayBuffer === "function") return Buffer.from(await blob.arrayBuffer());
  return Buffer.alloc(0);
}

async function walk(dir, root, output = []) {
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return output;
  }
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(absolute, root, output);
    } else if (entry.isFile()) {
      output.push(path.relative(root, absolute).split(path.sep).join("/"));
    }
  }
  return output;
}

export function createDiskFileStore({ rootDir = config.fileStoreDir } = {}) {
  const root = path.resolve(rootDir);
  return {
    describe() {
      return { kind: "disk", label: "Disk", rootDir: root, configured: true, auth: "none" };
    },
    async putBlob(key, blob) {
      const { clean, target } = resolveKey(root, key);
      const bytes = await blobToBuffer(blob);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, bytes);
      return { key: clean, url: `/api/files/${encodeURIComponent(clean)}` };
    },
    async getBlob(key) {
      const { target } = resolveKey(root, key);
      try {
        return await readFile(target);
      } catch {
        return null;
      }
    },
    async getUrl(key) {
      const { clean, target } = resolveKey(root, key);
      try {
        await readFile(target);
        return `/api/files/${encodeURIComponent(clean)}`;
      } catch {
        return null;
      }
    },
    async remove(key) {
      const { target } = resolveKey(root, key);
      await rm(target, { force: true });
    },
    async list(prefix = "") {
      const cleanPrefix = String(prefix || "");
      const files = await walk(root, root);
      return files.filter((key) => key.startsWith(cleanPrefix));
    }
  };
}

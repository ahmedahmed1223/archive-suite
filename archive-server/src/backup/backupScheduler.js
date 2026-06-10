import { createWriteStream, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { createLogger } from "../logger.js";
import { writeBackupChecksum, encryptBackupFile } from "./backupCrypto.js";

const log = createLogger("backup");

export const BACKUP_DIR = process.env.BACKUP_DIR || "backups";
export const BACKUP_INTERVAL_MS = parseInt(process.env.BACKUP_INTERVAL_HOURS || "24", 10) * 3_600_000;

// Re-export so callers don't need to import backupCrypto directly.
export { verifyBackupChecksum } from "./backupCrypto.js";
export { decryptBackupFile } from "./backupCrypto.js";

let schedulerTimer = null;

export function startBackupScheduler(provider) {
  if (!process.env.BACKUP_ENABLED) {
    log.debug("Backup scheduler disabled (set BACKUP_ENABLED=true).");
    return;
  }
  mkdirSync(BACKUP_DIR, { recursive: true });
  log.info({ intervalHours: BACKUP_INTERVAL_MS / 3_600_000 }, "Backup scheduler started.");
  runBackup(provider).catch(err => log.error({ err }, "Startup backup failed."));
  schedulerTimer = setInterval(() => {
    runBackup(provider).catch(err => log.error({ err }, "Scheduled backup failed."));
  }, BACKUP_INTERVAL_MS);
  schedulerTimer?.unref?.();
}

export function stopBackupScheduler() {
  if (schedulerTimer) { clearInterval(schedulerTimer); schedulerTimer = null; }
}

export async function runBackup(provider) {
  const stamp    = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `backup-${stamp}.json.gz`;
  const filepath = join(BACKUP_DIR, filename);
  const t0       = Date.now();
  const encKey   = process.env.BACKUP_ENCRYPTION_KEY;

  log.info({ filename, encrypted: !!encKey }, "Backup started.");
  try {
    const snapshot = await provider.snapshot();
    await pipeline(Readable.from([JSON.stringify(snapshot)]), createGzip({ level: 9 }), createWriteStream(filepath));

    let storedPath = filepath;
    let storedName = filename;

    // Optionally encrypt the backup file when BACKUP_ENCRYPTION_KEY is set.
    // The .enc file replaces the plaintext on disk; the plaintext is removed.
    if (encKey) {
      const { encPath } = encryptBackupFile(filepath, encKey);
      // Remove the plaintext after successful encryption.
      try { unlinkSync(filepath); } catch { /* ignore — already written enc */ }
      storedPath = encPath;
      storedName = `${filename}.enc`;
      log.info({ encFile: storedName }, "Backup encrypted.");
    }

    // Compute and write SHA-256 checksum over the final stored artifact.
    const { hex: checksum } = writeBackupChecksum(storedPath);
    const { size } = statSync(storedPath);

    log.info({ filename: storedName, sizeBytes: size, checksum, ms: Date.now() - t0 }, "Backup done.");
    await applyRetention();
    return { filename: storedName, sizeBytes: size, checksum, completedAt: new Date().toISOString() };
  } catch (err) {
    log.error({ err, filename }, "Backup failed.");
    // Clean up any partially-written files.
    try { unlinkSync(filepath); } catch { /* ignore */ }
    try { unlinkSync(`${filepath}.enc`); } catch { /* ignore */ }
    throw err;
  }
}

export function listBackups() {
  try {
    mkdirSync(BACKUP_DIR, { recursive: true });
    return readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith("backup-") && (f.endsWith(".json.gz") || f.endsWith(".json.gz.enc")))
      .map(filename => {
        const fp = join(BACKUP_DIR, filename);
        const st = statSync(fp);
        return {
          filename,
          sizeBytes: st.size,
          createdAt: st.birthtime.toISOString(),
          encrypted: filename.endsWith(".enc"),
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch { return []; }
}

async function applyRetention() {
  const keepDays  = parseInt(process.env.BACKUP_RETENTION_DAYS   || "7",  10);
  const keepWeeks = parseInt(process.env.BACKUP_RETENTION_WEEKS  || "4",  10);
  const keepMonths= parseInt(process.env.BACKUP_RETENTION_MONTHS || "3",  10);
  const backups = listBackups();
  const now = Date.now();
  const keep = new Set();
  const weekSeen = new Set(), monthSeen = new Set();

  for (const b of backups) {
    const ts = new Date(b.createdAt).getTime();
    const ageDays = (now - ts) / 86_400_000;
    if (ageDays <= keepDays) { keep.add(b.filename); continue; }
    const d = new Date(ts);
    const wk = `${d.getFullYear()}-${Math.ceil((d.getMonth() * 30 + d.getDate()) / 7)}`;
    const mo = `${d.getFullYear()}-${d.getMonth()}`;
    if (ageDays <= keepWeeks * 7 && !weekSeen.has(wk)) { weekSeen.add(wk); keep.add(b.filename); continue; }
    if (ageDays <= keepMonths * 30 && !monthSeen.has(mo)) { monthSeen.add(mo); keep.add(b.filename); }
  }

  let deleted = 0;
  for (const b of backups) {
    if (!keep.has(b.filename)) {
      const fp = join(BACKUP_DIR, b.filename);
      try { unlinkSync(fp); deleted++; } catch { /* ignore */ }
      // Remove the associated checksum file if present.
      try { unlinkSync(`${fp}.sha256`); } catch { /* ignore */ }
    }
  }
  if (deleted) log.info({ deleted }, "Old backups pruned.");
}

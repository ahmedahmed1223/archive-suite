import { createWriteStream, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { createLogger } from "../logger.js";

const log = createLogger("backup");

export const BACKUP_DIR = process.env.BACKUP_DIR || "backups";
export const BACKUP_INTERVAL_MS = parseInt(process.env.BACKUP_INTERVAL_HOURS || "24", 10) * 3_600_000;

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
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `backup-${stamp}.json.gz`;
  const filepath = join(BACKUP_DIR, filename);
  const t0 = Date.now();
  log.info({ filename }, "Backup started.");
  try {
    const snapshot = await provider.snapshot();
    await pipeline(Readable.from([JSON.stringify(snapshot)]), createGzip({ level: 9 }), createWriteStream(filepath));
    const { size } = statSync(filepath);
    log.info({ filename, sizeBytes: size, ms: Date.now() - t0 }, "Backup done.");
    await applyRetention();
    return { filename, sizeBytes: size, completedAt: new Date().toISOString() };
  } catch (err) {
    log.error({ err, filename }, "Backup failed.");
    try { unlinkSync(filepath); } catch { /* ignore */ }
    throw err;
  }
}

export function listBackups() {
  try {
    mkdirSync(BACKUP_DIR, { recursive: true });
    return readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith("backup-") && f.endsWith(".json.gz"))
      .map(filename => {
        const fp = join(BACKUP_DIR, filename);
        const st = statSync(fp);
        return { filename, sizeBytes: st.size, createdAt: st.birthtime.toISOString() };
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
      try { unlinkSync(join(BACKUP_DIR, b.filename)); deleted++; } catch { /* ignore */ }
    }
  }
  if (deleted) log.info({ deleted }, "Old backups pruned.");
}

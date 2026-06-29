import { createWriteStream, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { createGzip, gunzipSync } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { createLogger } from "../logger.js";
import { writeBackupChecksum, encryptBackupFile, verifyBackupChecksum, decryptBackupFile } from "./backupCrypto.js";
import { config } from "../config/env.js";

const log = createLogger("backup");

export const BACKUP_DIR = config.backupDir;
export const BACKUP_INTERVAL_MS = (config.backupIntervalHours ?? 24) * 3_600_000;

// Re-export so callers don't need to import backupCrypto directly.
export { verifyBackupChecksum, decryptBackupFile };

interface SnapshotProvider {
  snapshot(): Promise<Record<string, unknown>>;
  replaceAll(snapshot: Record<string, unknown>): Promise<Record<string, number>>;
}

interface SchedulerOptions {
  onFailure?: (err: Error) => void;
}

interface BackupResult {
  filename: string;
  sizeBytes: number;
  checksum: string;
  completedAt: string;
}

interface RestoreBackupOptions {
  passphrase?: string;
  dir?: string;
  stores?: string[] | null;
}

interface RestoreResult {
  filename: string;
  counts: Record<string, number>;
  checksum: string;
  restoredAt: string;
}

interface BackupInfo {
  filename: string;
  sizeBytes: number;
  createdAt: string;
  encrypted: boolean;
}

interface PreviewResult {
  filename: string;
  stores: Record<string, number>;
}

let schedulerTimer: NodeJS.Timeout | null = null;

export function startBackupScheduler(provider: SnapshotProvider, { onFailure }: SchedulerOptions = {}): void {
  if (!config.backupEnabled) {
    log.debug("Backup scheduler disabled (set BACKUP_ENABLED=true).");
    return;
  }
  mkdirSync(BACKUP_DIR, { recursive: true });
  log.info({ intervalHours: BACKUP_INTERVAL_MS / 3_600_000 }, "Backup scheduler started.");
  const handleError = (err: Error) => {
    log.error({ err }, "Backup failed.");
    onFailure?.(err);
  };
  runBackup(provider).catch(handleError);
  schedulerTimer = setInterval(() => {
    runBackup(provider).catch(handleError);
  }, BACKUP_INTERVAL_MS);
  schedulerTimer?.unref?.();
}

export function stopBackupScheduler(): void {
  if (schedulerTimer) { clearInterval(schedulerTimer); schedulerTimer = null; }
}

export async function runBackup(provider: SnapshotProvider): Promise<BackupResult> {
  const stamp    = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `backup-${stamp}.json.gz`;
  const filepath = join(BACKUP_DIR, filename);
  const t0       = Date.now();
  const encKey   = config.backupEncryptionKey;

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

// Restore a stored backup into the live provider via replaceAll().
// Pipeline: filename sanity → SHA-256 checksum verify → decrypt (.enc) →
// gunzip → JSON.parse → provider.replaceAll(snapshot).
// Errors carry statusCode so the HTTP layer can map them cleanly.
export async function restoreBackup(provider: SnapshotProvider, filename: string, { passphrase = "", dir = BACKUP_DIR, stores = null }: RestoreBackupOptions = {}): Promise<RestoreResult> {
  // Strict allow-list: only names runBackup itself produces. Blocks path
  // traversal and anything else living in BACKUP_DIR.
  if (typeof filename !== "string" || !/^backup-[\w.-]+\.json\.gz(\.enc)?$/.test(filename) || filename.includes("..")) {
    const err = new Error("اسم ملف النسخة الاحتياطية غير صالح.");
    (err as any).statusCode = 400;
    throw err;
  }
  const filePath = join(dir, filename);

  // Integrity first — refuse to restore anything that fails its checksum.
  let integrity;
  try {
    integrity = verifyBackupChecksum(filePath);
  } catch (e) {
    const err = new Error(`تعذر التحقق من سلامة النسخة (.sha256 مفقود أو تالف): ${e instanceof Error ? e.message : String(e)}`);
    (err as any).statusCode = 409;
    throw err;
  }
  if (!integrity.ok) {
    const err = new Error("فشل التحقق من سلامة النسخة الاحتياطية (checksum غير مطابق) — لن تتم الاستعادة.");
    (err as any).statusCode = 409;
    throw err;
  }

  // Decrypt if needed, else read the gz directly.
  let gzData;
  if (filename.endsWith(".enc")) {
    if (!passphrase) {
      const err = new Error("هذه النسخة مشفّرة — كلمة مرور التشفير مطلوبة.");
      (err as any).statusCode = 400;
      throw err;
    }
    try {
      gzData = decryptBackupFile(filePath, passphrase);
    } catch (e) {
      const err = new Error("فشل فك التشفير — كلمة المرور غير صحيحة أو الملف تالف.");
      (err as any).statusCode = 400;
      throw err;
    }
  } else {
    gzData = readFileSync(filePath);
  }

  let snapshot;
  try {
    snapshot = JSON.parse(gunzipSync(gzData).toString("utf8"));
  } catch (e) {
    const err = new Error(`تعذر قراءة محتوى النسخة الاحتياطية: ${e instanceof Error ? e.message : String(e)}`);
    (err as any).statusCode = 422;
    throw err;
  }
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    const err = new Error("محتوى النسخة الاحتياطية ليس snapshot صالحاً.");
    (err as any).statusCode = 422;
    throw err;
  }

  // Filter snapshot to requested stores for partial restore.
  let restorePayload: Record<string, unknown> = snapshot;
  if (Array.isArray(stores) && stores.length > 0) {
    restorePayload = {};
    for (const key of stores) {
      restorePayload[key] = Array.isArray(snapshot[key]) ? snapshot[key] : [];
    }
  }

  log.info({ filename, stores: stores ?? "all" }, "Backup restore started.");
  const counts = await provider.replaceAll(restorePayload);
  log.info({ filename, counts }, "Backup restore completed.");
  return { filename, counts, checksum: integrity.actual, restoredAt: new Date().toISOString() };
}

// previewBackup — parse a backup file and return per-store record counts without
// modifying any live data. For encrypted backups the passphrase is required.
export async function previewBackup(filename: string, { passphrase = "", dir = BACKUP_DIR }: { passphrase?: string; dir?: string } = {}): Promise<PreviewResult> {
  if (typeof filename !== "string" || !/^backup-[\w.-]+\.json\.gz(\.enc)?$/.test(filename) || filename.includes("..")) {
    const err = new Error("اسم ملف النسخة الاحتياطية غير صالح.");
    (err as any).statusCode = 400;
    throw err;
  }
  const filePath = join(dir, filename);

  let gzData;
  if (filename.endsWith(".enc")) {
    if (!passphrase) {
      const err = new Error("هذه النسخة مشفّرة — أدخل كلمة مرور التشفير لمعاينتها.");
      (err as any).statusCode = 400;
      throw err;
    }
    try {
      gzData = decryptBackupFile(filePath, passphrase);
    } catch {
      const err = new Error("فشل فك التشفير — كلمة المرور غير صحيحة أو الملف تالف.");
      (err as any).statusCode = 400;
      throw err;
    }
  } else {
    gzData = readFileSync(filePath);
  }

  let snapshot;
  try {
    snapshot = JSON.parse(gunzipSync(gzData).toString("utf8"));
  } catch (e) {
    const err = new Error(`تعذر قراءة محتوى النسخة الاحتياطية: ${e instanceof Error ? e.message : String(e)}`);
    (err as any).statusCode = 422;
    throw err;
  }
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    const err = new Error("محتوى النسخة الاحتياطية ليس snapshot صالحاً.");
    (err as any).statusCode = 422;
    throw err;
  }

  const stores: Record<string, number> = {};
  for (const [key, val] of Object.entries(snapshot)) {
    stores[key] = Array.isArray(val) ? val.length : typeof val === "object" && val !== null ? 1 : 0;
  }
  return { filename, stores };
}

export function listBackups(): BackupInfo[] {
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

async function applyRetention(): Promise<void> {
  const keepDays   = config.backupRetentionDays ?? 7;
  const keepWeeks  = config.backupRetentionWeeks ?? 4;
  const keepMonths = config.backupRetentionMonths ?? 12;
  const backups = listBackups();
  const now = Date.now();
  const keep = new Set<string>();
  const weekSeen = new Set<string>(), monthSeen = new Set<string>();

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

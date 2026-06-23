/**
 * Centralized environment-variable config for archive-server.
 *
 * This module is the single source of truth for every env var the server
 * reads. It is evaluated once at module-load time (after dotenv has populated
 * process.env in src/index.js) and exports a frozen `config` object.
 *
 * Conventions:
 *   - Required vars that are absent throw at startup with a clear message.
 *   - Optional vars fall back to a documented default.
 *   - Vars that were duplicated across files appear here exactly once.
 *   - CONTROL_AGENT_ACTIONS_ENABLED is merged into CONTROL_AGENT_ACTIONS
 *     (both still accepted; CONTROL_AGENT_ACTIONS wins).
 *   - OPENAI_API_KEY falls back to AI_API_KEY for the embedding service.
 *
 * DO NOT add `process.env` reads anywhere else in archive-server/src/ —
 * import `config` from this module instead.
 */

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function str(value, fallback = "") {
  const v = String(value ?? "").trim();
  return v !== "" ? v : fallback;
}

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n === n ? n : fallback;
}

function bool(value, fallback = false) {
  const v = String(value ?? "").trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(v)) return true;
  if (["0", "false", "no", "off"].includes(v)) return false;
  return fallback;
}

/** Parse a JSON string; return fallback on any error. */
function json(value, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

// ---------------------------------------------------------------------------
// Build config object from process.env
// ---------------------------------------------------------------------------

const e = process.env;

export const config = Object.freeze({

  // ── Core ────────────────────────────────────────────────────────────────
  nodeEnv:           str(e.NODE_ENV, "development"),
  port:              num(e.API_PORT, 8787),
  corsOrigin:        str(e.API_CORS_ORIGIN, ""),
  backend:           str(e.BACKEND, "pocketbase"),
  appVersion:        str(e.npm_package_version ?? e.APP_VERSION, "0.0.0"),
  appBaseUrl:        str(e.APP_BASE_URL, ""),
  logLevel:          str(e.LOG_LEVEL, e.NODE_ENV === "production" ? "info" : "debug"),
  trustProxy:        e.TRUST_PROXY !== "0",   // true unless explicitly disabled
  isPublicDeploy:    bool(e.ARCHIVE_PUBLIC_DEPLOY, e.NODE_ENV === "production"),
  ffmpegPath:        str(e.FFMPEG_PATH, "ffmpeg"),

  // ── Auth ─────────────────────────────────────────────────────────────────
  jwtAuthSecret:         str(e.JWT_AUTH_SECRET, ""),
  jwtShareSecret:        str(e.JWT_SHARE_SECRET, ""),
  oauthStateSecret:      str(e.OAUTH_STATE_SECRET, ""),
  jwtSecret:             str(e.JWT_SECRET, ""),          // legacy fallback
  jwtTtlSec:             num(e.JWT_TTL_SEC, 12 * 60 * 60),
  refreshExpiresInSec:   num(e.REFRESH_EXPIRES_IN_SEC, 30 * 24 * 60 * 60),
  adminUsername:         str(e.ADMIN_USERNAME, "admin"),
  adminPassword:         str(e.ADMIN_PASSWORD, ""),
  totpIssuer:            str(e.TOTP_ISSUER, "Archive Suite"),

  // ── VAPID / Web Push ──────────────────────────────────────────────────────
  vapidPublicKey:   str(e.VAPID_PUBLIC_KEY, ""),
  vapidPrivateKey:  str(e.VAPID_PRIVATE_KEY, ""),
  vapidSubject:     str(e.VAPID_SUBJECT, "mailto:admin@example.com"),

  // ── Rate limiting ─────────────────────────────────────────────────────────
  rateLimitRpcMax:   num(e.RATE_LIMIT_RPC_MAX,   600),
  rateLimitLoginMax: num(e.RATE_LIMIT_LOGIN_MAX,  10),
  rateLimitWindowMs: num(e.RATE_LIMIT_WINDOW_MS,  60_000),

  // ── File storage ──────────────────────────────────────────────────────────
  fileStore:    str(e.FILE_STORE, "disk"),
  fileStoreDir: str(e.FILE_STORE_DIR, ".archive-files"),
  storageDir:   str(e.STORAGE_DIR, ""),   // legacy override used by mp4/chunkedUpload

  // ── Redis ─────────────────────────────────────────────────────────────────
  redisUrl: str(e.REDIS_URL, ""),

  // ── AI / LLM ─────────────────────────────────────────────────────────────
  aiProvider:         str(e.AI_PROVIDER, ""),
  aiApiKey:           str(e.AI_API_KEY, ""),
  aiModel:            str(e.AI_MODEL, ""),
  aiBaseUrl:          str(e.AI_BASE_URL, ""),
  aiImpl:             str(e.AI_IMPL, "sdk"),
  embeddingModel:     str(e.EMBEDDING_MODEL, "text-embedding-3-small"),
  // OPENAI_API_KEY is only used for embeddings; falls back to AI_API_KEY.
  openaiApiKey:       str(e.OPENAI_API_KEY ?? e.AI_API_KEY, ""),

  // ── Transcription ─────────────────────────────────────────────────────────
  transcribeProvider: str(e.TRANSCRIBE_PROVIDER, ""),
  transcribeApiKey:   str(e.TRANSCRIBE_API_KEY, ""),
  transcribeModel:    str(e.TRANSCRIBE_MODEL, ""),
  transcribeBaseUrl:  str(e.TRANSCRIBE_BASE_URL, "http://whisper:8000/v1"),

  // ── SMTP / email ──────────────────────────────────────────────────────────
  smtpHost:    str(e.SMTP_HOST, ""),
  smtpPort:    num(e.SMTP_PORT, 587),
  smtpSecure:  e.SMTP_SECURE === "true",
  smtpUser:    str(e.SMTP_USER, ""),
  smtpPass:    str(e.SMTP_PASS, ""),
  smtpFrom:    str(e.SMTP_FROM, "Archive Suite <noreply@example.com>"),

  // ── Sentry ────────────────────────────────────────────────────────────────
  sentryDsn: str(e.SENTRY_DSN, ""),

  // ── OCR service ───────────────────────────────────────────────────────────
  ocrServiceUrl:  str(e.OCR_SERVICE_URL, ""),
  maxOcrBytes:    num(e.MAX_OCR_BYTES,  20 * 1024 * 1024),

  // ── PocketBase ────────────────────────────────────────────────────────────
  pocketbaseUrl: str(e.POCKETBASE_URL, "http://127.0.0.1:8090"),

  // ── Backups ───────────────────────────────────────────────────────────────
  backupEnabled:         bool(e.BACKUP_ENABLED, false),
  backupDir:             str(e.BACKUP_DIR, "backups"),
  backupIntervalHours:   num(e.BACKUP_INTERVAL_HOURS, 24),
  backupRetentionDays:   num(e.BACKUP_RETENTION_DAYS, 7),
  backupRetentionWeeks:  num(e.BACKUP_RETENTION_WEEKS, 4),
  backupRetentionMonths: num(e.BACKUP_RETENTION_MONTHS, 3),
  backupEncryptionKey:   str(e.BACKUP_ENCRYPTION_KEY, ""),

  // ── Backup replication (enterprise off-site / S3 cross-region) ────────────
  backup: Object.freeze({
    replication: Object.freeze({
      enabled:       bool(e.BACKUP_REPLICATION_ENABLED, false),
      bucket:        str(e.BACKUP_REPLICATION_BUCKET, ""),
      region:        str(e.BACKUP_REPLICATION_REGION, "us-east-1"),
      prefix:        str(e.BACKUP_REPLICATION_PREFIX, "backups"),
      // 32-byte AES-256-GCM key as 64 hex chars; leave empty to skip encryption
      encryptionKey: str(e.BACKUP_REPLICATION_ENCRYPTION_KEY, ""),
    }),
  }),

  // ── Workflow ──────────────────────────────────────────────────────────────
  workflowDueRemindersEnabled: bool(e.WORKFLOW_DUE_REMINDERS_ENABLED, false),
  workflowDueCheckHours:       num(e.WORKFLOW_DUE_CHECK_HOURS, 1),

  // ── Control agent ─────────────────────────────────────────────────────────
  // CONTROL_AGENT_ACTIONS_ENABLED is the old name; CONTROL_AGENT_ACTIONS wins.
  controlAgentMode:     str(e.CONTROL_AGENT_MODE, "read-only"),
  controlAgentActions:  str(e.CONTROL_AGENT_ACTIONS ?? e.CONTROL_AGENT_ACTIONS_ENABLED, ""),
  controlAgentServices: json(e.CONTROL_AGENT_SERVICES, []),
  composeFile:          str(e.COMPOSE_FILE, "docker-compose.yml"),

  // ── Public API ────────────────────────────────────────────────────────────
  publicApiStores: str(
    e.PUBLIC_API_STORES,
    "video_items,media_items,document_items,audio_items,image_items"
  ),
  shareExpiryDays: num(e.SHARE_EXPIRY_DAYS, 30),

  // ── Export / PDF ──────────────────────────────────────────────────────────
  pdfFontPath: str(e.ARCHIVE_PDF_FONT_PATH, ""),

  // ── Media jobs ────────────────────────────────────────────────────────────
  mediaJobConcurrency: num(e.MEDIA_JOB_CONCURRENCY, 1),

  // ── Record limits ─────────────────────────────────────────────────────────
  maxRecordBytes: num(e.MAX_RECORD_BYTES, 10 * 1024 * 1024),

  // ── Server config path ────────────────────────────────────────────────────
  serverConfigPath: str(e.SERVER_CONFIG_PATH, "config/server-config.json"),

  // ── Dropbox OAuth redirect (used in OAuth flow only) ──────────────────────
  dropboxRedirectUri: str(e.DROPBOX_REDIRECT_URI, ""),
});

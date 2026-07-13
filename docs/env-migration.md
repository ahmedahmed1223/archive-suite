# Environment Variable Migration — 69 → 25

This document maps every env var that existed before the §22.9 consolidation
to its new location or disposition. The server still reads all the old names
from process.env — nothing is broken. The new `.env.example` lists only the
25 vars that operators actually need to set.

## Merged / renamed

| Old name | New name / location | Notes |
|---|---|---|
| `CONTROL_AGENT_ACTIONS_ENABLED` | `CONTROL_AGENT_ACTIONS` | Both accepted; `CONTROL_AGENT_ACTIONS` wins |
| `OPENAI_API_KEY` | `OPENAI_API_KEY` (kept) | Falls back to `AI_API_KEY` if absent |

## Demoted to constants (smart defaults in env.js — no operator action needed)

| Var | Default | Controlled by |
|---|---|---|
| `JWT_TTL_SEC` | `43200` (12 h) | `config.jwtTtlSec` |
| `REFRESH_EXPIRES_IN_SEC` | `2592000` (30 d) | `config.refreshExpiresInSec` |
| `TOTP_ISSUER` | `"Archive Suite"` | `config.totpIssuer` |
| `VAPID_SUBJECT` | `"mailto:admin@example.com"` | `config.vapidSubject` |
| `RATE_LIMIT_RPC_MAX` | `600` | `config.rateLimitRpcMax` |
| `RATE_LIMIT_LOGIN_MAX` | `10` | `config.rateLimitLoginMax` |
| `RATE_LIMIT_WINDOW_MS` | `60000` | `config.rateLimitWindowMs` |
| `TRUST_PROXY` | `true` (unless `"0"`) | `config.trustProxy` |
| `FILE_STORE` | `"disk"` | `config.fileStore` |
| `STORAGE_DIR` | `""` | `config.storageDir` |
| `FFMPEG_PATH` | `"ffmpeg"` | `config.ffmpegPath` |
| `AI_IMPL` | `"sdk"` | `config.aiImpl` |
| `AI_MODEL` | `""` | `config.aiModel` |
| `AI_BASE_URL` | `""` | `config.aiBaseUrl` |
| `TRANSCRIBE_PROVIDER` | `""` | `config.transcribeProvider` |
| `TRANSCRIBE_API_KEY` | `""` | `config.transcribeApiKey` |
| `TRANSCRIBE_MODEL` | `""` | `config.transcribeModel` |
| `TRANSCRIBE_BASE_URL` | `"http://whisper:8000/v1"` | `config.transcribeBaseUrl` |
| `EMBEDDING_MODEL` | `"text-embedding-3-small"` | `config.embeddingModel` |
| `SMTP_PORT` | `587` | `config.smtpPort` |
| `SMTP_SECURE` | `false` | `config.smtpSecure` |
| `SMTP_FROM` | `"Archive Suite <noreply@example.com>"` | `config.smtpFrom` |
| `SHARE_EXPIRY_DAYS` | `30` | `config.shareExpiryDays` |
| `PUBLIC_API_STORES` | all content stores | `config.publicApiStores` |
| `MEDIA_JOB_CONCURRENCY` | `1` | `config.mediaJobConcurrency` |
| `MAX_RECORD_BYTES` | `10485760` (10 MB) | `config.maxRecordBytes` |
| `MAX_OCR_BYTES` | `20971520` (20 MB) | `config.maxOcrBytes` |
| `BACKUP_INTERVAL_HOURS` | `24` | `config.backupIntervalHours` |
| `BACKUP_RETENTION_DAYS` | `7` | `config.backupRetentionDays` |
| `BACKUP_RETENTION_WEEKS` | `4` | `config.backupRetentionWeeks` |
| `BACKUP_RETENTION_MONTHS` | `3` | `config.backupRetentionMonths` |
| `WORKFLOW_DUE_CHECK_HOURS` | `1` | `config.workflowDueCheckHours` |
| `CONTROL_AGENT_MODE` | `"read-only"` | `config.controlAgentMode` |
| `CONTROL_AGENT_SERVICES` | `[]` | `config.controlAgentServices` |
| `COMPOSE_FILE` | `"docker-compose.yml"` | `config.composeFile` |
| `SERVER_CONFIG_PATH` | `"config/server-config.json"` | `config.serverConfigPath` |
| `DROPBOX_REDIRECT_URI` | derived from request origin | `config.dropboxRedirectUri` |
| `APP_VERSION` | `npm_package_version` | `config.appVersion` |
| `ARCHIVE_PDF_FONT_PATH` | `""` (auto-detected) | `config.pdfFontPath` |
| `ARCHIVE_PUBLIC_DEPLOY` | derived from NODE_ENV | `config.isPublicDeploy` |

## Kept verbatim (operator must set these)

`BACKEND`, `API_PORT`, `NODE_ENV`, `APP_BASE_URL`,
`DATABASE_URL`,
`JWT_AUTH_SECRET`, `JWT_SHARE_SECRET`, `OAUTH_STATE_SECRET`, `JWT_SECRET`,
`ADMIN_USERNAME`, `ADMIN_PASSWORD`,
`FILE_STORE`, `FILE_STORE_DIR`,
`S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_ENDPOINT`,
`AI_PROVIDER`, `AI_API_KEY`, `OPENAI_API_KEY`,
`BACKUP_ENABLED`, `BACKUP_DIR`, `BACKUP_ENCRYPTION_KEY`,
`SENTRY_DSN`, `REDIS_URL`

## Vars only used in Docker Compose (not read by Node server)

`DOMAIN`, `ACME_EMAIL`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`,
`API_CORS_ORIGIN`, `DOCKER_FILE_STORE_DIR`,
`PGADMIN_EMAIL`, `PGADMIN_PASSWORD`, `GRAFANA_PASSWORD`,
`OCR_LANG`, `OCR_USE_GPU`, `OCR_MAX_FILE_MB`, `REDIS_PASSWORD`

// Server entry point — wires the configured backend through @archive/core,
// then starts the RPC API the SPA's cloud-http adapter talks to.
//
// BACKEND=pocketbase → proxies to a PocketBase instance (POCKETBASE_URL).
// BACKEND=postgres   → instantiates a Prisma client with PostgreSQL.
// BACKEND=sqlserver  → instantiates the same Prisma-backed storage surface
//                      after DATABASE_PROVIDER=sqlserver generation; the
//                      runtime image still needs the matching Prisma driver.
//
// Run with: node src/index.js  (Dockerfile.server CMD)

// Load .env BEFORE any other imports — most config (BACKEND, DATABASE_URL,
// auth secrets, AI keys) is read at module evaluation time. Docker passes
// --env-file so it's already populated there, but `pnpm server` on the host
// has no .env loader otherwise and silently falls back to BACKEND=pocketbase.
// Errors are ignored: an absent .env is valid (env may come from the shell).
try { await import("dotenv/config"); } catch {}

// Sentry must be initialised before any other imports so it can instrument
// the full module graph. It is a no-op when SENTRY_DSN is not set.
import { initSentry } from "./monitoring/sentryService.js";
await initSentry();

import { getStorageProvider } from "@archive/core";

import { registerCloudProviders } from "./bootstrap/registerCloudProviders.js";
import { startApiServer } from "./api/server.js";
import { createEventBus } from "./api/eventBus.js";
import { loginUser, seedAdminIfMissing } from "./auth/authService.js";
import { resolveAuthSigningSecret } from "./auth/authConfig.js";
import { resolveServerConfig } from "./config/serverConfig.js";
import { assertProductionSecrets } from "./config/productionGuard.js";
import { logger } from "./logger.js";
import { startBackupScheduler, stopBackupScheduler } from "./backup/backupScheduler.js";
import { startDueDateScheduler, stopDueDateScheduler } from "./workflow/dueDateScheduler.js";
import { sendPushToUser } from "./notifications/webPushService.js";
import { createVersionRetentionService } from "./versions/versionRetentionService.js";
import { createRetentionScheduler } from "./retention/retentionScheduler.js";
import { initMetrics } from "./monitoring/metrics.js";
import { initRedis, closeRedis, isRedisAvailable } from "./cache/redisCache.js";
import { startPresenceServer } from "./collaboration/presenceServer.js";
import { tryCreateRedisMediaJobStore } from "./media/redisMediaJobStore.js";
import { createInMemoryMediaJobStore } from "./media/mediaJobs.js";
import { config } from "./config/env.js";

const BACKEND = config.backend;
const PORT = config.port;
const CORS_ORIGIN = config.corsOrigin;
const AUTH_SECRET = resolveAuthSigningSecret(process.env);
const TOKEN_TTL_SEC = config.jwtTtlSec;

interface HealthStatus {
  redis: {
    configured: boolean;
    ok: boolean | null;
    cache: string;
    mediaJobs: string;
  };
  pgvector?: {
    ok: boolean;
    version: string | null;
    error?: string;
  };
}

async function buildExtraHealth({ prisma, mediaJobStore }: any): Promise<HealthStatus> {
  const redisConfigured = Boolean(config.redisUrl);
  const health: HealthStatus = {
    redis: {
      configured: redisConfigured,
      ok: redisConfigured ? isRedisAvailable() : null,
      cache: redisConfigured ? (isRedisAvailable() ? "connected" : "unavailable") : "disabled",
      mediaJobs: config.redisUrl ? "redis" : "memory"
    }
  };
  if (prisma) {
    try {
      const rows = await prisma.$queryRawUnsafe("select extversion from pg_extension where extname='vector'");
      const version = Array.isArray(rows) ? rows[0]?.extversion : null;
      health.pgvector = { ok: Boolean(version), version: version || null };
    } catch (error: unknown) {
      health.pgvector = { ok: false, version: null, error: (error as any)?.message || "pgvector check failed" };
    }
  }
  if (mediaJobStore?.backend) {
    health.redis.mediaJobs = mediaJobStore.backend;
  }
  return health;
}

async function buildPrismaClient() {
  // Lazy, dynamic imports so the pocketbase path never loads Prisma (and the
  // image stays slim when Postgres isn't used). Prisma 7 ships a generated
  // client + mandatory driver adapter.
  const { PrismaClient } = await import("../src/generated/prisma/client.js");
  // Effective connection comes from the server-config layer: a persisted config
  // file (set via the in-app admin DB settings) overrides env, which overrides
  // the POSTGRES_* defaults. Applied on boot.
  const { databaseUrl, databaseEngine, databaseSource, databaseTarget } = resolveServerConfig();
  if (!databaseUrl) {
    throw new Error("BACKEND=postgres requires a database URL (DATABASE_URL/POSTGRES_* or a saved server config).");
  }
  logger.info({ databaseTarget, databaseEngine, databaseSource }, "DB target resolved");
  if (databaseEngine !== "postgresql") {
    throw new Error(
      `DATABASE_PROVIDER=${databaseEngine} is saved, but this runtime image only bundles the PostgreSQL Prisma adapter. ` +
      "Install/wire the matching Prisma driver adapter, run migrations, then restart."
    );
  }
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const poolConfig = {
    connectionString: databaseUrl,
    max: 20,                    // maximum number of pooled connections
    idleTimeoutMillis: 30_000,  // close idle connections after 30 s
    connectionTimeoutMillis: 5_000 // throw if a new connection takes > 5 s
  };
  logger.debug(
    { poolMax: poolConfig.max, idleTimeoutMs: poolConfig.idleTimeoutMillis, connectionTimeoutMs: poolConfig.connectionTimeoutMillis },
    "pg pool config"
  );
  const adapter = new PrismaPg(poolConfig);
  return new PrismaClient({ adapter });
}

async function main() {
  assertProductionSecrets(process.env);

  // Initialise Prometheus metrics early so all subsequent startup activity
  // (DB open, seed, etc.) is covered. Gracefully degrades if prom-client is absent.
  await initMetrics();

  // Initialise optional Redis cache. No-op when REDIS_URL is absent — the app
  // runs perfectly without it; Redis only adds a caching layer on top.
  await initRedis();

  let registration: any;
  let prisma: any = null;
  let stopVersionRetention: (() => void) | null = null;
  let stopRetentionScheduler: (() => void) | null = null;

  if (BACKEND === "postgres" || BACKEND === "sqlserver") {
    prisma = await buildPrismaClient();
    registration = registerCloudProviders({ backend: BACKEND, prisma });
    // Surface connection problems early with a clear message.
    await registration.provider.open();
    logger.info({ backend: BACKEND }, "Prisma SQL backend ready.");
    const versionRetention = createVersionRetentionService(prisma, logger);
    stopVersionRetention = versionRetention.scheduleHourly();
    const retentionScheduler = createRetentionScheduler({ prisma, files: registration.files, logger });
    stopRetentionScheduler = retentionScheduler.start();
  } else if (BACKEND === "pocketbase") {
    registration = registerCloudProviders({
      backend: "pocketbase",
      url: config.pocketbaseUrl
    });
    logger.info("PocketBase backend ready.");
  } else {
    throw new Error(`Unknown BACKEND "${BACKEND}" — expected "postgres", "sqlserver", or "pocketbase".`);
  }

  // Workflow due-date reminders (no-op when WORKFLOW_DUE_REMINDERS_ENABLED is unset).
  startDueDateScheduler(getStorageProvider() as any, prisma, sendPushToUser);

  // Start scheduled backups (no-op when BACKUP_ENABLED is unset).
  // On failure, push a system alert to all admin users (fire-and-forget).
  startBackupScheduler(getStorageProvider() as any, {
    onFailure: async (err: any) => {
      if (!prisma?.user) return;
      try {
        const admins = await prisma.user.findMany({ where: { role: "admin" }, select: { id: true } });
        for (const { id } of admins) {
          sendPushToUser({
            prisma,
            userId: id,
            type: "system",
            title: "فشل النسخ الاحتياطي",
            body: err?.message || "حدث خطأ أثناء إنشاء النسخة الاحتياطية.",
            tag: "backup-failure"
          });
        }
      } catch { /* don't block on notification errors */ }
    }
  });

  // Auth wiring. The dedicated JWT_AUTH_SECRET is preferred; JWT_SECRET is a
  // backward-compatible fallback. The same effective secret signs login
  // tokens and verifies protected API requests.
  // /api/auth/login issues one (verified against the users store). Optionally
  // seed a first admin from env so a fresh deploy has a login.
  let login: ((body: any) => Promise<any>) | undefined;
  if (AUTH_SECRET) {
    const provider = getStorageProvider();
    const seed = await seedAdminIfMissing({
      provider,
      username: config.adminUsername,
      password: config.adminPassword
    });
    if (seed.seeded) {
      logger.info({ username: seed.username }, "Seeded first admin from env.");
    }
    login = (body: any) => loginUser(body, { provider, secret: AUTH_SECRET, expiresInSec: TOKEN_TTL_SEC, totpToken: body?.totpToken });
    logger.info("Auth ENABLED — /api/rpc requires a Bearer token.");
  } else {
    logger.warn(
      "JWT_AUTH_SECRET/JWT_SECRET is not set — the RPC API is UNAUTHENTICATED. " +
      "Set an auth secret (and ADMIN_USERNAME/ADMIN_PASSWORD) before exposing this server publicly."
    );
  }

  // Media job store: Redis-persisted when REDIS_URL is set, otherwise in-memory.
  // The Redis store survives server restarts and supports cross-session tracking.
  const mediaJobStore =
    (await tryCreateRedisMediaJobStore()) ?? createInMemoryMediaJobStore();
  logger.info(
    { backend: config.redisUrl ? "redis" : "memory" },
    "Media job store initialised."
  );

  const server = startApiServer({
    port: PORT,
    backend: registration.backend,
    corsOrigin: CORS_ORIGIN,
    authSecret: AUTH_SECRET,
    login,
    prisma,
    rateLimit: {
      rpcMax: config.rateLimitRpcMax,
      loginMax: config.rateLimitLoginMax,
      windowMs: config.rateLimitWindowMs
    },
    // Realtime fan-out: pushes broadcast to SSE clients on /api/sync/events.
    eventBus: createEventBus(),
    mediaJobStore,
    extraHealth: () => buildExtraHealth({ prisma, mediaJobStore }),
  });

  // Attach WebSocket presence server to the same HTTP server instance.
  // The ws library hooks into the http upgrade event — no port change needed.
  startPresenceServer(server);

  // Graceful shutdown: drain in-flight connections before exiting so Docker
  // stop and Kubernetes pod evictions don't hard-kill active requests.
  let isShuttingDown = false;

  async function shutdown(signal: string) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info({ signal }, "Received signal, draining connections...");

    // Stop schedulers before draining HTTP.
    stopBackupScheduler();
    stopDueDateScheduler();
    stopVersionRetention?.();
    stopRetentionScheduler?.();

    // Stop accepting new connections; wait for in-flight requests to finish.
    server.close(async () => {
      logger.info("HTTP server closed.");

      // Disconnect Prisma when using the Postgres backend.
      if (prisma) {
        await prisma.$disconnect().catch(() => {});
        logger.info("Prisma disconnected.");
      }

      // Close Redis connection gracefully (no-op when Redis was not enabled).
      await closeRedis();

      logger.info("Shutdown complete.");
      process.exit(0);
    });

    // Force-exit after 10 s if draining hangs (e.g. stalled SSE clients).
    setTimeout(() => {
      logger.error("Force-exit after shutdown timeout.");
      process.exit(1);
    }, 10_000).unref();
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT",  () => shutdown("SIGINT"));
}

main().catch((error: unknown) => {
  logger.error({ err: error }, "Fatal startup error");
  process.exit(1);
});

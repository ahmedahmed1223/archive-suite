// Server entry point — wires the configured backend through @archive/core,
// then starts the RPC API the SPA's cloud-http adapter talks to.
//
// BACKEND=pocketbase → proxies to a PocketBase instance (POCKETBASE_URL).
// BACKEND=postgres   → instantiates a Prisma client. PostgreSQL uses the pg
//                      driver adapter bundled today; other Prisma engines are
//                      persisted/configured by admin UI and need their matching
//                      deployment adapter before boot.
//
// Run with: node src/index.js  (Dockerfile.server CMD)

// Sentry must be initialised before any other imports so it can instrument
// the full module graph. It is a no-op when SENTRY_DSN is not set.
import { initSentry } from "./monitoring/sentryService.js";
await initSentry();

import { getStorageProvider } from "@archive/core";

import { registerCloudProviders } from "./bootstrap/registerCloudProviders.js";
import { startApiServer } from "./api/server.js";
import { createEventBus } from "./api/eventBus.js";
import { loginUser, seedAdminIfMissing } from "./auth/authService.js";
import { resolveServerConfig } from "./config/serverConfig.js";
import { assertProductionSecrets } from "./config/productionGuard.js";
import { logger } from "./logger.js";
import { startBackupScheduler, stopBackupScheduler } from "./backup/backupScheduler.js";
import { createVersionRetentionService } from "./versions/versionRetentionService.js";
import { initMetrics } from "./monitoring/metrics.js";
import { initRedis, closeRedis, isRedisAvailable } from "./cache/redisCache.js";
import { startPresenceServer } from "./collaboration/presenceServer.js";
import { tryCreateRedisMediaJobStore } from "./media/redisMediaJobStore.js";
import { createInMemoryMediaJobStore } from "./media/mediaJobs.js";

const BACKEND = process.env.BACKEND || "pocketbase";
const PORT = Number(process.env.API_PORT || 8787);
const CORS_ORIGIN = process.env.API_CORS_ORIGIN || "";
const JWT_SECRET = process.env.JWT_SECRET || "";
const TOKEN_TTL_SEC = Number(process.env.JWT_TTL_SEC || 12 * 60 * 60);

async function buildExtraHealth({ prisma, mediaJobStore }) {
  const redisConfigured = Boolean(process.env.REDIS_URL);
  const health = {
    redis: {
      configured: redisConfigured,
      ok: redisConfigured ? isRedisAvailable() : null,
      cache: redisConfigured ? (isRedisAvailable() ? "connected" : "unavailable") : "disabled",
      mediaJobs: process.env.REDIS_URL ? "redis" : "memory"
    }
  };
  if (prisma) {
    try {
      const rows = await prisma.$queryRawUnsafe("select extversion from pg_extension where extname='vector'");
      const version = Array.isArray(rows) ? rows[0]?.extversion : null;
      health.pgvector = { ok: Boolean(version), version: version || null };
    } catch (error) {
      health.pgvector = { ok: false, error: error?.message || "pgvector check failed" };
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

  let registration;
  let prisma = null;
  let stopVersionRetention = null;

  if (BACKEND === "postgres") {
    prisma = await buildPrismaClient();
    registration = registerCloudProviders({ backend: "postgres", prisma });
    // Surface connection problems early with a clear message.
    await registration.provider.open();
    logger.info("Postgres backend ready.");
    const versionRetention = createVersionRetentionService(prisma, logger);
    stopVersionRetention = versionRetention.scheduleHourly();
  } else if (BACKEND === "pocketbase") {
    registration = registerCloudProviders({
      backend: "pocketbase",
      url: process.env.POCKETBASE_URL || "http://127.0.0.1:8090"
    });
    logger.info("PocketBase backend ready.");
  } else {
    throw new Error(`Unknown BACKEND "${BACKEND}" — expected "postgres" or "pocketbase".`);
  }

  // Start scheduled backups (no-op when BACKUP_ENABLED is unset).
  startBackupScheduler(getStorageProvider());

  // Auth wiring. When JWT_SECRET is set, /api/rpc requires a Bearer token and
  // /api/auth/login issues one (verified against the users store). Optionally
  // seed a first admin from env so a fresh deploy has a login.
  let login;
  if (JWT_SECRET) {
    const provider = getStorageProvider();
    const seed = await seedAdminIfMissing({
      provider,
      username: process.env.ADMIN_USERNAME,
      password: process.env.ADMIN_PASSWORD
    });
    if (seed.seeded) {
      logger.info({ username: seed.username }, "Seeded first admin from env.");
    }
    login = (body) => loginUser(body, { provider, secret: JWT_SECRET, expiresInSec: TOKEN_TTL_SEC, totpToken: body?.totpToken });
    logger.info("Auth ENABLED — /api/rpc requires a Bearer token.");
  } else {
    logger.warn(
      "JWT_SECRET is not set — the RPC API is UNAUTHENTICATED. " +
      "Set JWT_SECRET (and ADMIN_USERNAME/ADMIN_PASSWORD) before exposing this server publicly."
    );
  }

  // Media job store: Redis-persisted when REDIS_URL is set, otherwise in-memory.
  // The Redis store survives server restarts and supports cross-session tracking.
  const mediaJobStore =
    (await tryCreateRedisMediaJobStore()) ?? createInMemoryMediaJobStore();
  logger.info(
    { backend: process.env.REDIS_URL ? "redis" : "memory" },
    "Media job store initialised."
  );

  const server = startApiServer({
    port: PORT,
    backend: registration.backend,
    corsOrigin: CORS_ORIGIN,
    authSecret: JWT_SECRET,
    login,
    prisma,
    rateLimit: {
      rpcMax: Number(process.env.RATE_LIMIT_RPC_MAX || 600),
      loginMax: Number(process.env.RATE_LIMIT_LOGIN_MAX || 10),
      windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000)
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

  async function shutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info({ signal }, "Received signal, draining connections...");

    // Stop the backup scheduler before draining HTTP.
    stopBackupScheduler();
    stopVersionRetention?.();

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

main().catch((error) => {
  logger.error({ err: error }, "Fatal startup error");
  process.exit(1);
});

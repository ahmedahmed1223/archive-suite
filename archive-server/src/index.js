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

import { getStorageProvider } from "@archive/core";

import { registerCloudProviders } from "./bootstrap/registerCloudProviders.js";
import { startApiServer } from "./api/server.js";
import { createEventBus } from "./api/eventBus.js";
import { loginUser, seedAdminIfMissing } from "./auth/authService.js";
import { resolveServerConfig } from "./config/serverConfig.js";
import { assertProductionSecrets } from "./config/productionGuard.js";

const BACKEND = process.env.BACKEND || "pocketbase";
const PORT = Number(process.env.API_PORT || 8787);
const CORS_ORIGIN = process.env.API_CORS_ORIGIN || "";
const JWT_SECRET = process.env.JWT_SECRET || "";
const TOKEN_TTL_SEC = Number(process.env.JWT_TTL_SEC || 12 * 60 * 60);

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
  console.info(`[archive] DB target: ${databaseTarget} / ${databaseEngine} (source: ${databaseSource})`);
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
  // eslint-disable-next-line no-console
  console.log(
    `[archive-api] pg pool config — max: ${poolConfig.max}, ` +
    `idleTimeout: ${poolConfig.idleTimeoutMillis}ms, ` +
    `connectionTimeout: ${poolConfig.connectionTimeoutMillis}ms`
  );
  const adapter = new PrismaPg(poolConfig);
  return new PrismaClient({ adapter });
}

async function main() {
  assertProductionSecrets(process.env);

  let registration;

  if (BACKEND === "postgres") {
    const prisma = await buildPrismaClient();
    registration = registerCloudProviders({ backend: "postgres", prisma });
    // Surface connection problems early with a clear message.
    await registration.provider.open();
    // eslint-disable-next-line no-console
    console.log("[archive-api] Postgres backend ready.");
  } else if (BACKEND === "pocketbase") {
    registration = registerCloudProviders({
      backend: "pocketbase",
      url: process.env.POCKETBASE_URL || "http://127.0.0.1:8090"
    });
    // eslint-disable-next-line no-console
    console.log("[archive-api] PocketBase backend ready.");
  } else {
    throw new Error(`Unknown BACKEND "${BACKEND}" — expected "postgres" or "pocketbase".`);
  }

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
      // eslint-disable-next-line no-console
      console.log(`[archive-api] Seeded first admin "${seed.username}" from env.`);
    }
    login = (body) => loginUser(body, { provider, secret: JWT_SECRET, expiresInSec: TOKEN_TTL_SEC });
    // eslint-disable-next-line no-console
    console.log("[archive-api] Auth ENABLED — /api/rpc requires a Bearer token.");
  } else {
    // eslint-disable-next-line no-console
    console.warn(
      "[archive-api] ⚠️  JWT_SECRET is not set — the RPC API is UNAUTHENTICATED. " +
      "Set JWT_SECRET (and ADMIN_USERNAME/ADMIN_PASSWORD) before exposing this server publicly."
    );
  }

  startApiServer({
    port: PORT,
    backend: registration.backend,
    corsOrigin: CORS_ORIGIN,
    authSecret: JWT_SECRET,
    login,
    rateLimit: {
      rpcMax: Number(process.env.RATE_LIMIT_RPC_MAX || 600),
      loginMax: Number(process.env.RATE_LIMIT_LOGIN_MAX || 10),
      windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000)
    },
    // Realtime fan-out: pushes broadcast to SSE clients on /api/sync/events.
    eventBus: createEventBus()
  });
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("[archive-api] Fatal startup error:", error?.message || error);
  process.exit(1);
});

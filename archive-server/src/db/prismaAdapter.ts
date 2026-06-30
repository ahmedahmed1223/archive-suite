import {
  buildDatabaseUrl,
  normalizeDatabaseEngine,
  parseDatabaseUrl,
} from "../config/secrets.js";

type DebugLogger = {
  debug?: (payload: unknown, message?: string) => void;
};

export const POSTGRES_POOL_CONFIG = Object.freeze({
  max: 20,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

function normalizeSqlServerConnectionString(databaseUrl: string): string {
  const parts = parseDatabaseUrl(databaseUrl, "sqlserver");
  return parts ? buildDatabaseUrl(parts) : databaseUrl;
}

export async function createPrismaDriverAdapter({
  databaseEngine,
  databaseUrl,
  logger,
}: {
  databaseEngine: string;
  databaseUrl: string;
  logger?: DebugLogger;
}) {
  const engine = normalizeDatabaseEngine(databaseEngine);

  if (engine === "postgresql") {
    const { PrismaPg } = await import("@prisma/adapter-pg");
    const poolConfig = {
      connectionString: databaseUrl,
      ...POSTGRES_POOL_CONFIG,
    };
    logger?.debug?.(
      {
        poolMax: poolConfig.max,
        idleTimeoutMs: poolConfig.idleTimeoutMillis,
        connectionTimeoutMs: poolConfig.connectionTimeoutMillis,
      },
      "pg pool config"
    );
    return new PrismaPg(poolConfig);
  }

  if (engine === "sqlserver") {
    const { PrismaMssql } = await import("@prisma/adapter-mssql");
    return new PrismaMssql(normalizeSqlServerConnectionString(databaseUrl));
  }

  throw new Error(
    `DATABASE_PROVIDER=${engine} is saved, but this runtime image only supports PostgreSQL and SQL Server Prisma adapters. ` +
      "Install/wire the matching Prisma driver adapter, run migrations, then restart."
  );
}

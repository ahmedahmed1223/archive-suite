const NATIVE_PLATFORMS = new Set(["windows-native", "linux-native"]);
const STEP_CODES = Object.freeze({
  installPostgres: "MANAGED_POSTGRES_INSTALL_FAILED",
  installPgvector: "MANAGED_PGVECTOR_INSTALL_FAILED",
  createArchiveRoles: "MANAGED_DATABASE_ROLES_FAILED",
  installRedisCompatible: "MANAGED_REDIS_INSTALL_FAILED",
  installPgAdmin: "MANAGED_PGADMIN_INSTALL_FAILED",
});

function fail(code, message, nextActions = []) {
  return { ok: false, code, message, details: {}, nextActions };
}

function requireFunction(value, name) {
  if (typeof value !== "function") throw new Error(`Managed data provisioner requires ${name}.`);
  return value;
}

function successful(result) {
  return result?.status === 0;
}

function healthy(result) {
  return result?.ok === true;
}

export function createManagedDataProvisioner({ platform, effects, probes, secrets } = {}) {
  if (!NATIVE_PLATFORMS.has(platform)) throw new Error("Managed data provisioner requires a Native platform.");
  if (!effects || !probes || !secrets) throw new Error("Managed data provisioner requires effects, probes, and secrets.");
  for (const name of ["postgres", "pgvector", "redis"]) requireFunction(probes[name], `probes.${name}`);
  for (const name of ["dbOwnerPassword", "dbAppPassword", "redisPassword"]) {
    if (typeof secrets[name] !== "string" || !secrets[name]) throw new Error(`Managed data provisioner requires ${name}.`);
  }

  return async function provision(plan = {}) {
    const postgresKind = plan?.postgres?.kind;
    const redisKind = plan?.redis?.kind;
    const redisEnabled = plan?.redis?.enabled === true || ["managed", "external"].includes(redisKind);
    if (!["managed", "external"].includes(postgresKind) || (redisEnabled && !["managed", "external"].includes(redisKind))) {
      return fail("DATA_PLAN_INVALID", "Managed data provisioning requires PostgreSQL plus either a Redis mode or an explicit disabled Redis choice.", ["Choose managed or external PostgreSQL, then choose managed, external, or disabled Redis."]);
    }

    const request = { platform, postgres: plan.postgres, redis: plan.redis, pgAdmin: plan.pgAdmin === true, secrets };
    const requiredSteps = [];
    if (postgresKind === "managed") requiredSteps.push("installPostgres", "installPgvector", "createArchiveRoles");
    if (redisEnabled && redisKind === "managed") requiredSteps.push("installRedisCompatible");
    if (plan.pgAdmin === true) requiredSteps.push("installPgAdmin");
    for (const name of requiredSteps) {
      const operation = requireFunction(effects[name], `effects.${name}`);
      if (!successful(await operation(request))) {
        return fail(STEP_CODES[name], "Managed data setup did not complete.", ["Review the protected installer logs and retry the setup operation."]);
      }
    }

    if (!healthy(await probes.postgres())) return fail("POSTGRES_UNHEALTHY", "PostgreSQL did not pass its functional probe.", ["Verify PostgreSQL and retry setup."]);
    if (!healthy(await probes.pgvector())) return fail("PGVECTOR_UNHEALTHY", "The pgvector extension did not pass its functional probe.", ["Install or repair pgvector, then retry setup."]);
    if (redisEnabled && !healthy(await probes.redis())) return fail("REDIS_UNHEALTHY", "The Redis-compatible service did not pass its functional probe.", ["Verify the cache service and retry setup."]);

    return {
      ok: true,
      code: "MANAGED_DATA_READY",
      message: "Native data services are installed and verified.",
      details: {},
      ownership: [
        { id: "postgres", ownership: postgresKind === "managed" ? "managed-owned" : "external" },
        { id: "redis", ownership: !redisEnabled ? "disabled" : redisKind === "managed" ? "managed-owned" : "external" },
      ],
      nextActions: [],
    };
  };
}

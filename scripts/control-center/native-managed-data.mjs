const NATIVE_PLATFORMS = new Set(["windows-native", "linux-native"]);
const STEP_CODES = Object.freeze({
  installPostgres: "MANAGED_POSTGRES_INSTALL_FAILED",
  installPgvector: "MANAGED_PGVECTOR_INSTALL_FAILED",
  createArchiveRoles: "MANAGED_DATABASE_ROLES_FAILED",
  installRedisCompatible: "MANAGED_REDIS_INSTALL_FAILED",
  installPgAdmin: "MANAGED_PGADMIN_INSTALL_FAILED",
});

function fail(code, message, nextActions = [], details = {}) {
  return { ok: false, code, message, details, nextActions };
}

function safeInstallerDiagnostic(result, secrets) {
  let diagnostic = `${result?.stderr || ""}\n${result?.stdout || ""}`.trim();
  for (const secret of Object.values(secrets || {})) {
    if (typeof secret === "string" && secret) diagnostic = diagnostic.replaceAll(secret, "[redacted]");
  }
  return diagnostic
    .replace(/(password\s*[=:]\s*)\S+/gi, "$1[redacted]")
    .slice(0, 800)
    .trim();
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

async function eventuallyHealthy(probe, { attempts, wait, delayMs }) {
  let latest;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    latest = await probe();
    if (healthy(latest)) return { ok: true, latest };
    if (attempt + 1 < attempts) await wait(delayMs);
  }
  return { ok: false, latest };
}

function resolveSecrets(secrets) {
  const resolved = typeof secrets === "function" ? secrets() : secrets;
  for (const name of ["dbOwnerPassword", "dbAppPassword", "redisPassword"]) {
    if (typeof resolved?.[name] !== "string" || !resolved[name]) throw new Error(`Managed data provisioner requires ${name}.`);
  }
  return resolved;
}

export function createManagedDataProvisioner({
  platform,
  effects,
  probes,
  secrets,
  wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  redisProbeAttempts = 12,
  redisProbeDelayMs = 250,
} = {}) {
  if (!NATIVE_PLATFORMS.has(platform)) throw new Error("Managed data provisioner requires a Native platform.");
  if (!effects || !probes || !secrets) throw new Error("Managed data provisioner requires effects, probes, and secrets.");
  for (const name of ["postgres", "pgvector", "redis"]) requireFunction(probes[name], `probes.${name}`);
  if (typeof secrets !== "function") resolveSecrets(secrets);

  return async function provision(plan = {}) {
    const postgresKind = plan?.postgres?.kind;
    const redisKind = plan?.redis?.kind;
    const redisEnabled = plan?.redis?.enabled === true || ["managed", "external"].includes(redisKind);
    if (!["managed", "external"].includes(postgresKind) || (redisEnabled && !["managed", "external"].includes(redisKind))) {
      return fail("DATA_PLAN_INVALID", "Managed data provisioning requires PostgreSQL plus either a Redis mode or an explicit disabled Redis choice.", ["Choose managed or external PostgreSQL, then choose managed, external, or disabled Redis."]);
    }

    const needsManagedSecrets = postgresKind === "managed" || (redisEnabled && redisKind === "managed");
    const managedSecrets = needsManagedSecrets ? resolveSecrets(secrets) : undefined;
    const request = { platform, postgres: plan.postgres, redis: plan.redis, pgAdmin: plan.pgAdmin === true, secrets: managedSecrets };
    const requiredSteps = [];
    if (postgresKind === "managed") requiredSteps.push("installPostgres", "installPgvector", "createArchiveRoles");
    if (redisEnabled && redisKind === "managed") requiredSteps.push("installRedisCompatible");
    if (plan.pgAdmin === true) requiredSteps.push("installPgAdmin");
    for (const name of requiredSteps) {
      const operation = requireFunction(effects[name], `effects.${name}`);
      const result = await operation(request);
      if (!successful(result)) {
        const installerDiagnostic = safeInstallerDiagnostic(result, managedSecrets);
        return fail(STEP_CODES[name], "Managed data setup did not complete.", ["Review the protected installer logs and retry the setup operation."], {
          step: name,
          ...(installerDiagnostic ? { installerDiagnostic } : {}),
        });
      }
    }

    if (!healthy(await probes.postgres())) return fail("POSTGRES_UNHEALTHY", "PostgreSQL did not pass its functional probe.", ["Verify PostgreSQL and retry setup."]);
    if (!healthy(await probes.pgvector())) return fail("PGVECTOR_UNHEALTHY", "The pgvector extension did not pass its functional probe.", ["Install or repair pgvector, then retry setup."]);
    const redisHealth = redisEnabled
      ? await eventuallyHealthy(probes.redis, { attempts: redisProbeAttempts, wait, delayMs: redisProbeDelayMs })
      : { ok: true };
    if (!redisHealth.ok) {
      let installerDiagnostic = "";
      try {
        if (typeof effects.logs === "function") installerDiagnostic = safeInstallerDiagnostic(effects.logs(), managedSecrets);
      } catch { /* Diagnostic collection must not hide the health verdict. */ }
      return fail("REDIS_UNHEALTHY", "The Redis-compatible service did not pass its functional probe.", ["Verify the cache service and retry setup."], {
        backend: "redis",
        ...(redisHealth.latest?.code ? { probe: redisHealth.latest.code } : {}),
        ...(installerDiagnostic ? { installerDiagnostic } : {}),
      });
    }

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

/**
 * Tests for src/config/env.js
 *
 * Each test group isolates process.env by saving/restoring the original
 * values so tests don't bleed into each other. We use dynamic re-import
 * (via vi.resetModules) to get a fresh config evaluation per test.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Helper: re-import env.js with a custom process.env patch applied.
async function loadConfig(envPatch = {}) {
  vi.resetModules();
  const saved = {};
  for (const [k, v] of Object.entries(envPatch)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }

  let mod;
  try {
    mod = await import("../env.js");
  } finally {
    // Restore env regardless of whether the import throws
    for (const [k] of Object.entries(envPatch)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
  return mod.config;
}

describe("config — smart defaults", () => {
  it("applies port default 8787 when API_PORT is absent", async () => {
    const cfg = await loadConfig({ API_PORT: undefined });
    expect(cfg.port).toBe(8787);
  });

  it("parses API_PORT as a number", async () => {
    const cfg = await loadConfig({ API_PORT: "9000" });
    expect(cfg.port).toBe(9000);
  });

  it("defaults backend to pocketbase", async () => {
    const cfg = await loadConfig({ BACKEND: undefined });
    expect(cfg.backend).toBe("pocketbase");
  });

  it("uses provided BACKEND", async () => {
    const cfg = await loadConfig({ BACKEND: "postgres" });
    expect(cfg.backend).toBe("postgres");
  });

  it("defaults jwtTtlSec to 43200 (12h)", async () => {
    const cfg = await loadConfig({ JWT_TTL_SEC: undefined });
    expect(cfg.jwtTtlSec).toBe(43200);
  });

  it("defaults backupEnabled to false", async () => {
    const cfg = await loadConfig({ BACKUP_ENABLED: undefined });
    expect(cfg.backupEnabled).toBe(false);
  });

  it("defaults backupIntervalHours to 24", async () => {
    const cfg = await loadConfig({ BACKUP_INTERVAL_HOURS: undefined });
    expect(cfg.backupIntervalHours).toBe(24);
  });

  it("defaults fileStoreDir to .archive-files", async () => {
    const cfg = await loadConfig({ FILE_STORE_DIR: undefined });
    expect(cfg.fileStoreDir).toBe(".archive-files");
  });

  it("defaults embeddingModel to text-embedding-3-small", async () => {
    const cfg = await loadConfig({ EMBEDDING_MODEL: undefined });
    expect(cfg.embeddingModel).toBe("text-embedding-3-small");
  });

  it("defaults totpIssuer to 'Archive Suite'", async () => {
    const cfg = await loadConfig({ TOTP_ISSUER: undefined });
    expect(cfg.totpIssuer).toBe("Archive Suite");
  });
});

describe("config — env var parsing", () => {
  it("parses BACKUP_ENABLED=true as boolean true", async () => {
    const cfg = await loadConfig({ BACKUP_ENABLED: "true" });
    expect(cfg.backupEnabled).toBe(true);
  });

  it("parses BACKUP_ENABLED=1 as boolean true", async () => {
    const cfg = await loadConfig({ BACKUP_ENABLED: "1" });
    expect(cfg.backupEnabled).toBe(true);
  });

  it("parses BACKUP_ENABLED=0 as boolean false", async () => {
    const cfg = await loadConfig({ BACKUP_ENABLED: "0" });
    expect(cfg.backupEnabled).toBe(false);
  });

  it("parses WORKFLOW_DUE_REMINDERS_ENABLED=true correctly", async () => {
    const cfg = await loadConfig({ WORKFLOW_DUE_REMINDERS_ENABLED: "true" });
    expect(cfg.workflowDueRemindersEnabled).toBe(true);
  });

  it("CONTROL_AGENT_SERVICES as valid JSON becomes array", async () => {
    const services = [{ id: "my-svc", name: "My Service" }];
    const cfg = await loadConfig({ CONTROL_AGENT_SERVICES: JSON.stringify(services) });
    expect(cfg.controlAgentServices).toEqual(services);
  });

  it("CONTROL_AGENT_SERVICES with invalid JSON becomes []", async () => {
    const cfg = await loadConfig({ CONTROL_AGENT_SERVICES: "{bad json" });
    expect(cfg.controlAgentServices).toEqual([]);
  });

  it("CONTROL_AGENT_SERVICES absent defaults to []", async () => {
    const cfg = await loadConfig({ CONTROL_AGENT_SERVICES: undefined });
    expect(cfg.controlAgentServices).toEqual([]);
  });

  it("openaiApiKey falls back to AI_API_KEY when OPENAI_API_KEY is absent", async () => {
    const cfg = await loadConfig({ OPENAI_API_KEY: undefined, AI_API_KEY: "ai-key-123" });
    expect(cfg.openaiApiKey).toBe("ai-key-123");
  });

  it("openaiApiKey uses OPENAI_API_KEY when both are set", async () => {
    const cfg = await loadConfig({ OPENAI_API_KEY: "oai-key", AI_API_KEY: "ai-key" });
    expect(cfg.openaiApiKey).toBe("oai-key");
  });

  it("trustProxy is true by default (TRUST_PROXY absent)", async () => {
    const cfg = await loadConfig({ TRUST_PROXY: undefined });
    expect(cfg.trustProxy).toBe(true);
  });

  it("trustProxy is false when TRUST_PROXY=0", async () => {
    const cfg = await loadConfig({ TRUST_PROXY: "0" });
    expect(cfg.trustProxy).toBe(false);
  });
});

describe("config — numeric defaults", () => {
  it("rateLimitRpcMax defaults to 600", async () => {
    const cfg = await loadConfig({ RATE_LIMIT_RPC_MAX: undefined });
    expect(cfg.rateLimitRpcMax).toBe(600);
  });

  it("rateLimitLoginMax defaults to 10", async () => {
    const cfg = await loadConfig({ RATE_LIMIT_LOGIN_MAX: undefined });
    expect(cfg.rateLimitLoginMax).toBe(10);
  });

  it("maxRecordBytes defaults to 10MB", async () => {
    const cfg = await loadConfig({ MAX_RECORD_BYTES: undefined });
    expect(cfg.maxRecordBytes).toBe(10 * 1024 * 1024);
  });

  it("maxOcrBytes defaults to 20MB", async () => {
    const cfg = await loadConfig({ MAX_OCR_BYTES: undefined });
    expect(cfg.maxOcrBytes).toBe(20 * 1024 * 1024);
  });

  it("shareExpiryDays defaults to 30", async () => {
    const cfg = await loadConfig({ SHARE_EXPIRY_DAYS: undefined });
    expect(cfg.shareExpiryDays).toBe(30);
  });
});

describe("config — object is frozen", () => {
  it("config is a frozen object", async () => {
    const cfg = await loadConfig({});
    expect(Object.isFrozen(cfg)).toBe(true);
  });
});

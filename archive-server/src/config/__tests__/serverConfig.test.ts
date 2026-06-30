import { describe, it, expect } from "vitest";
import {
  resolveDatabaseUrl,
  resolveServerConfig,
  resolveFileStoreConfig,
} from "../serverConfig.js";

describe("resolveDatabaseUrl", () => {
  it("returns source 'none' and empty url when no config is present", () => {
    const result = resolveDatabaseUrl({ file: {}, env: {} });
    expect(result.source).toBe("none");
    expect(result.url).toBe("");
  });

  it("prefers file config url over env DATABASE_URL", () => {
    const file = { database: { url: "postgresql://file-host/db" } };
    const env = { DATABASE_URL: "postgresql://env-host/db" };
    const result = resolveDatabaseUrl({ file, env });
    expect(result.source).toBe("file");
    expect(result.url).toContain("file-host");
    expect(result.url).not.toContain("env-host");
  });

  it("falls back to env DATABASE_URL when file has no url", () => {
    const env = { DATABASE_URL: "postgresql://env-host/db" };
    const result = resolveDatabaseUrl({ file: {}, env });
    expect(result.source).toBe("env");
    expect(result.url).toContain("env-host");
  });

  it("builds a url from POSTGRES_* env vars when DATABASE_URL is absent", () => {
    const env = {
      POSTGRES_USER: "testuser",
      POSTGRES_PASSWORD: "testpass",
      POSTGRES_HOST: "pg-host",
      POSTGRES_DB: "testdb",
    };
    const result = resolveDatabaseUrl({ file: {}, env });
    expect(result.source).toBe("default");
    expect(result.url).toContain("pg-host");
    expect(result.url).toContain("testdb");
  });

  it("returns postgresql as the default engine", () => {
    const result = resolveDatabaseUrl({ file: {}, env: {} });
    expect(result.engine).toBe("postgresql");
  });

  it("parses the engine from a postgresql:// file url", () => {
    const file = { database: { url: "postgresql://host/db" } };
    const result = resolveDatabaseUrl({ file, env: {} });
    expect(result.engine).toBe("postgresql");
  });
});

describe("resolveServerConfig", () => {
  it("returns a config object with all required keys", () => {
    const config = resolveServerConfig({ file: {}, env: {} });
    expect(config).toHaveProperty("databaseUrl");
    expect(config).toHaveProperty("databaseEngine");
    expect(config).toHaveProperty("databaseSource");
    expect(config).toHaveProperty("databaseTarget");
    expect(config).toHaveProperty("fileStore");
  });

  it("databaseUrl is a string", () => {
    const config = resolveServerConfig({ file: {}, env: {} });
    expect(typeof config.databaseUrl).toBe("string");
  });

  it("databaseEngine defaults to postgresql", () => {
    const config = resolveServerConfig({ file: {}, env: {} });
    expect(config.databaseEngine).toBe("postgresql");
  });

  it("picks up DATABASE_URL from env", () => {
    const env = { DATABASE_URL: "postgresql://localhost/mydb" };
    const config = resolveServerConfig({ file: {}, env });
    expect(config.databaseUrl).toContain("localhost");
    expect(config.databaseSource).toBe("env");
  });

  it("picks up SQLSERVER_URL when DATABASE_PROVIDER is sqlserver", () => {
    const env = {
      DATABASE_PROVIDER: "sqlserver",
      SQLSERVER_URL: "sqlserver://sqlserver:1433;database=archive;user=sa;password=Password-123;encrypt=true;trustServerCertificate=true"
    };
    const config = resolveServerConfig({ file: {}, env });
    expect(config.databaseEngine).toBe("sqlserver");
    expect(config.databaseUrl).toBe(env.SQLSERVER_URL);
    expect(config.databaseSource).toBe("env");
  });
});

describe("resolveFileStoreConfig", () => {
  it("defaults fileStore to 'disk' when nothing is configured", () => {
    const result = resolveFileStoreConfig({ file: {}, env: {} });
    expect(result.fileStore).toBe("disk");
    expect(result.fileStoreSource).toBe("default");
  });

  it("prefers file config fileStore kind over env FILE_STORE", () => {
    const file = { fileStore: { kind: "s3" } };
    const env = { FILE_STORE: "disk" };
    const result = resolveFileStoreConfig({ file, env });
    expect(result.fileStore).toBe("s3");
    expect(result.fileStoreSource).toBe("file");
  });

  it("uses env FILE_STORE when file has no fileStore kind", () => {
    const env = { FILE_STORE: "azure" };
    const result = resolveFileStoreConfig({ file: {}, env });
    expect(result.fileStore).toBe("azure");
    expect(result.fileStoreSource).toBe("env");
  });

  it("ignores invalid FILE_STORE values and defaults to disk", () => {
    const env = { FILE_STORE: "unknown-store" };
    const result = resolveFileStoreConfig({ file: {}, env });
    expect(result.fileStore).toBe("disk");
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted() runs before module evaluation, so we can safely reference the
// returned object from inside the vi.mock() factory below.
const bcryptMock = vi.hoisted(() => ({
  compare: vi.fn(),
  hash: vi.fn(),
}));

// Intercept bcryptjs for the entire test file. The factory is hoisted to the
// top by Vitest's transform, so it executes before any import resolves.
vi.mock("bcryptjs", () => ({
  default: bcryptMock,
  compare: bcryptMock.compare,
  hash: bcryptMock.hash,
}));

import { verifySecret, loginUser } from "../authService.js";

describe("verifySecret", () => {
  beforeEach(() => {
    bcryptMock.compare.mockReset();
  });

  it("rejects empty inputs", async () => {
    expect(await verifySecret("", "hash")).toBe(false);
    expect(await verifySecret("plain", "")).toBe(false);
    expect(await verifySecret(null, "hash")).toBe(false);
    expect(await verifySecret("plain", null)).toBe(false);
  });

  it("verifies bcrypt hash when bcryptjs.compare resolves true", async () => {
    bcryptMock.compare.mockResolvedValue(true);
    // Non-64-hex-char string → bcrypt branch
    expect(await verifySecret("anypassword", "$2a$12$notahexhash")).toBe(true);
    expect(bcryptMock.compare).toHaveBeenCalledOnce();
  });

  it("returns false when bcryptjs.compare resolves false", async () => {
    bcryptMock.compare.mockResolvedValue(false);
    expect(await verifySecret("wrongpassword", "$2a$12$notahexhash")).toBe(false);
  });

  it("returns false when bcryptjs.compare throws", async () => {
    bcryptMock.compare.mockRejectedValue(new Error("bad hash format"));
    expect(await verifySecret("pass", "$2a$12$intentionally-invalid")).toBe(false);
  });

  it("verifies legacy SHA-256 hash (64 hex chars — no bcrypt call)", async () => {
    const { createHash } = await import("node:crypto");
    const hash = createHash("sha256").update("legacypass").digest("hex");
    // 64-char hex → SHA-256 branch only
    expect(await verifySecret("legacypass", hash)).toBe(true);
    expect(await verifySecret("wrongpass", hash)).toBe(false);
    expect(bcryptMock.compare).not.toHaveBeenCalled();
  });

  it("verifies legacy SHA-256 hash case-insensitively", async () => {
    const { createHash } = await import("node:crypto");
    const hash = createHash("sha256").update("testcase").digest("hex");
    expect(await verifySecret("testcase", hash.toUpperCase())).toBe(true);
  });
});

describe("loginUser", () => {
  beforeEach(() => {
    bcryptMock.compare.mockReset();
  });

  it("throws 401 when username is empty", async () => {
    const provider = { getAll: vi.fn().mockResolvedValue([]) };
    await expect(
      loginUser({ username: "", password: "p" }, { provider, secret: "jwt-secret" })
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("throws 401 when password is empty", async () => {
    const provider = { getAll: vi.fn().mockResolvedValue([]) };
    await expect(
      loginUser({ username: "u", password: "" }, { provider, secret: "jwt-secret" })
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("throws 401 when both username and password are empty", async () => {
    const provider = { getAll: vi.fn().mockResolvedValue([]) };
    await expect(
      loginUser({ username: "", password: "" }, { provider, secret: "jwt-secret" })
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it("throws when JWT secret is missing", async () => {
    await expect(
      loginUser({ username: "u", password: "p" }, {})
    ).rejects.toThrow("JWT secret");
  });

  it("throws 401 when user is not found in provider", async () => {
    bcryptMock.compare.mockResolvedValue(false);
    const provider = { getAll: vi.fn().mockResolvedValue([]) };
    await expect(
      loginUser({ username: "ghost", password: "pass" }, { provider, secret: "jwt-secret" })
    ).rejects.toMatchObject({ statusCode: 401 });
  });
});

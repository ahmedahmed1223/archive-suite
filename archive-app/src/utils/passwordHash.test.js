import { describe, it, expect } from "vitest";
import {
  hashPassword,
  legacyHashPassword,
  verifyPassword,
  isLegacyHash,
  validatePasswordStrength,
} from "./passwordHash.js";

describe("hashPassword", () => {
  it("returns a bcrypt hash string", async () => {
    const hash = await hashPassword("Test@1234");
    expect(hash).toMatch(/^\$2[ab]\$/);
  });

  it("throws on empty password", async () => {
    await expect(hashPassword("")).rejects.toThrow();
  });
});

describe("legacyHashPassword", () => {
  it("returns a 64-char hex string", async () => {
    const hash = await legacyHashPassword("password");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it("is deterministic", async () => {
    const a = await legacyHashPassword("abc");
    const b = await legacyHashPassword("abc");
    expect(a).toBe(b);
  });

  it("differs for different inputs", async () => {
    const a = await legacyHashPassword("abc");
    const b = await legacyHashPassword("xyz");
    expect(a).not.toBe(b);
  });

  it("matches known SHA-256 of 'password'", async () => {
    const hash = await legacyHashPassword("password");
    expect(hash).toBe("5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8");
  });
});

describe("verifyPassword", () => {
  it("returns false for empty password", async () => {
    expect(await verifyPassword("", "anything")).toBe(false);
  });

  it("returns false for empty hash", async () => {
    expect(await verifyPassword("password", "")).toBe(false);
  });

  it("verifies a bcrypt hash correctly", async () => {
    const hash = await hashPassword("MyPass!9");
    expect(await verifyPassword("MyPass!9", hash)).toBe(true);
    expect(await verifyPassword("Wrong!9x", hash)).toBe(false);
  });

  it("verifies a legacy SHA-256 hash correctly", async () => {
    const legacyHash = await legacyHashPassword("oldpass");
    expect(await verifyPassword("oldpass", legacyHash)).toBe(true);
    expect(await verifyPassword("wrongpass", legacyHash)).toBe(false);
  });
});

describe("isLegacyHash", () => {
  it("detects 64-char hex as legacy", async () => {
    const h = await legacyHashPassword("x");
    expect(isLegacyHash(h)).toBe(true);
  });

  it("does not flag bcrypt as legacy", async () => {
    const h = await hashPassword("Test@1234");
    expect(isLegacyHash(h)).toBe(false);
  });
});

describe("validatePasswordStrength", () => {
  it("accepts a strong password", () => {
    expect(validatePasswordStrength("StrongPass@9")).toHaveLength(0);
  });

  it("rejects passwords shorter than 8 chars", () => {
    const errs = validatePasswordStrength("Ab@1");
    expect(errs.some((e) => e.includes("8"))).toBe(true);
  });

  it("rejects passwords without digits", () => {
    const errs = validatePasswordStrength("NoDigits@here");
    expect(errs.some((e) => e.includes("رقم"))).toBe(true);
  });

  it("rejects passwords without special chars", () => {
    const errs = validatePasswordStrength("NoSpecial123");
    expect(errs.some((e) => e.includes("رمز"))).toBe(true);
  });
});

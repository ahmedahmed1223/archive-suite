import { describe, it, expect, beforeEach } from "vitest";
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  revokeRefreshFamily,
  peekRefreshFamily,
  DEFAULT_ACCESS_EXPIRES_IN_SEC
} from "../tokenService.js";

const SECRET = "test-jwt-secret-32-chars-minimum!";
const USER = { id: "u_123", username: "alice", role: "editor" };

// ── signAccessToken ──────────────────────────────────────────────────────────

describe("signAccessToken", () => {
  it("returns a three-part JWT string", () => {
    const token = signAccessToken(USER, SECRET);
    expect(token.split(".")).toHaveLength(3);
  });

  it("embeds sub, username, and role in the payload", () => {
    const token = signAccessToken(USER, SECRET);
    const body = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    expect(body.sub).toBe(USER.id);
    expect(body.username).toBe(USER.username);
    expect(body.role).toBe(USER.role);
  });

  it("uses DEFAULT_ACCESS_EXPIRES_IN_SEC (15 min) when no TTL given", () => {
    const before = Math.floor(Date.now() / 1000);
    const token = signAccessToken(USER, SECRET);
    const body = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    const delta = body.exp - body.iat;
    expect(delta).toBe(DEFAULT_ACCESS_EXPIRES_IN_SEC);
    expect(body.iat).toBeGreaterThanOrEqual(before);
  });

  it("honours a custom expiresInSec option", () => {
    const token = signAccessToken(USER, SECRET, { expiresInSec: 300 });
    const body = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    expect(body.exp - body.iat).toBe(300);
  });

  it("throws when secret is missing", () => {
    expect(() => signAccessToken(USER, "")).toThrow("secret");
  });

  it("throws when user.id is missing", () => {
    expect(() => signAccessToken({}, SECRET)).toThrow("user.id");
  });
});

// ── signRefreshToken ─────────────────────────────────────────────────────────

describe("signRefreshToken", () => {
  it("returns token, familyId, and expiresInSec", () => {
    const result = signRefreshToken(USER, SECRET);
    expect(result).toHaveProperty("token");
    expect(result).toHaveProperty("familyId");
    expect(result).toHaveProperty("expiresInSec");
    expect(typeof result.token).toBe("string");
    expect(typeof result.familyId).toBe("string");
  });

  it("refresh token payload carries typ:refresh and fam claim", () => {
    const { token } = signRefreshToken(USER, SECRET);
    const body = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    expect(body.typ).toBe("refresh");
    expect(typeof body.fam).toBe("string");
  });

  it("throws when secret is missing", () => {
    expect(() => signRefreshToken(USER, "")).toThrow("secret");
  });

  it("throws when user.id is missing", () => {
    expect(() => signRefreshToken({}, SECRET)).toThrow("user.id");
  });
});

// ── verifyAccessToken ────────────────────────────────────────────────────────

describe("verifyAccessToken", () => {
  it("returns claims for a valid access token", () => {
    const token = signAccessToken(USER, SECRET);
    const claims = verifyAccessToken(token, SECRET);
    expect(claims.sub).toBe(USER.id);
    expect(claims.username).toBe(USER.username);
  });

  it("throws 401 when given a refresh token instead of an access token", () => {
    const { token } = signRefreshToken(USER, SECRET);
    expect(() => verifyAccessToken(token, SECRET)).toThrow(
      expect.objectContaining({ statusCode: 401 })
    );
  });

  it("throws 401 for a tampered token", () => {
    const token = signAccessToken(USER, SECRET);
    const tampered = token.slice(0, -4) + "XXXX";
    expect(() => verifyAccessToken(tampered, SECRET)).toThrow(
      expect.objectContaining({ statusCode: 401 })
    );
  });

  it("throws when secret is missing", () => {
    const token = signAccessToken(USER, SECRET);
    expect(() => verifyAccessToken(token, "")).toThrow("secret");
  });
});

// ── verifyRefreshToken ───────────────────────────────────────────────────────

describe("verifyRefreshToken", () => {
  it("rotates the token and returns new token + original claims", () => {
    const { token } = signRefreshToken(USER, SECRET);
    const result = verifyRefreshToken(token, SECRET);
    expect(result).toHaveProperty("token");
    expect(result).toHaveProperty("claims");
    expect(result.claims.sub).toBe(USER.id);
    expect(result.token).not.toBe(token); // must be a new token
  });

  it("throws REFRESH_REUSED when a rotated token is replayed (theft defence)", () => {
    const { token } = signRefreshToken(USER, SECRET);
    verifyRefreshToken(token, SECRET); // first rotate — token is now retired
    expect(() => verifyRefreshToken(token, SECRET)).toThrow(
      expect.objectContaining({ code: "REFRESH_REUSED" })
    );
  });

  it("throws 401 for a completely invalid refresh token", () => {
    expect(() => verifyRefreshToken("not.a.token", SECRET)).toThrow(
      expect.objectContaining({ statusCode: 401 })
    );
  });

  it("throws when secret is missing", () => {
    const { token } = signRefreshToken(USER, SECRET);
    expect(() => verifyRefreshToken(token, "")).toThrow("secret");
  });
});

// ── peekRefreshFamily / revokeRefreshFamily ──────────────────────────────────

describe("peekRefreshFamily", () => {
  it("extracts the family id from a refresh token without verifying it", () => {
    const { token, familyId } = signRefreshToken(USER, SECRET);
    expect(peekRefreshFamily(token)).toBe(familyId);
  });

  it("returns null for a non-refresh token", () => {
    const accessToken = signAccessToken(USER, SECRET);
    expect(peekRefreshFamily(accessToken)).toBeNull();
  });

  it("returns null for garbage input", () => {
    expect(peekRefreshFamily("not-a-jwt")).toBeNull();
    expect(peekRefreshFamily("")).toBeNull();
    expect(peekRefreshFamily(null)).toBeNull();
  });
});

describe("revokeRefreshFamily", () => {
  it("causes subsequent rotation to fail after family is revoked", () => {
    const { token, familyId } = signRefreshToken(USER, SECRET);
    revokeRefreshFamily(familyId);
    // After revoking, the family entry is gone → family expired error
    expect(() => verifyRefreshToken(token, SECRET)).toThrow(
      expect.objectContaining({ statusCode: 401 })
    );
  });

  it("does not throw when called with an unknown family id", () => {
    expect(() => revokeRefreshFamily("does-not-exist")).not.toThrow();
    expect(() => revokeRefreshFamily(null)).not.toThrow();
  });
});

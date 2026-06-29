/**
 * Refresh token store — rotation with reuse detection (§20.1).
 *
 * Design (mirrors tokenBlacklist.js: in-memory hot path, single-instance):
 *   - Each login starts a token *family* (`fam` claim). Exactly one refresh
 *     token jti is valid per family at any time.
 *   - rotateRefreshToken() verifies the presented token, then swaps the
 *     family's current jti for a fresh one and returns a new refresh token.
 *   - Presenting an old (already-rotated) token is treated as theft/reuse:
 *     the whole family is revoked and the caller gets a 401.
 *   - revokeRefreshFamily() kills a family outright (logout).
 *
 * Tokens themselves are HS256 JWTs signed with the auth secret and carry
 * `typ: "refresh"` so an access-token path can never accept one and vice versa.
 */

import { randomUUID } from "node:crypto";
import { signJwt, verifyJwt } from "./jwt.js";
import { createLogger } from "../logger.js";

const log = createLogger("refreshTokens");

export const DEFAULT_REFRESH_EXPIRES_IN_SEC = 30 * 24 * 60 * 60; // 30 days

interface FamilyEntry {
  jti: string;
  expMs: number;
}

interface UserClaims {
  sub: string;
  username?: string;
  role?: string;
}

interface RefreshTokenResult {
  token: string;
  familyId: string;
  expiresInSec: number;
}

interface RotateRefreshTokenResult {
  token: string;
  claims: any;
  familyId: string;
}

interface RefreshTokenOptions {
  expiresInSec?: number;
}

// fam → { jti, expMs }
const families = new Map<string, FamilyEntry>();

const pruneInterval = setInterval(() => {
  const now = Date.now();
  for (const [fam, entry] of families) if (entry.expMs < now) families.delete(fam);
}, 15 * 60 * 1000);
if (typeof pruneInterval.unref === "function") pruneInterval.unref();

function unauthorized(message: string, code?: string): Error {
  const err = new Error(message);
  (err as any).statusCode = 401;
  if (code) (err as any).code = code;
  return err;
}

/**
 * Issue a refresh token for a user, starting a new rotation family.
 */
export function issueRefreshToken(
  user: UserClaims,
  secret: string,
  { expiresInSec = DEFAULT_REFRESH_EXPIRES_IN_SEC }: RefreshTokenOptions = {}
): RefreshTokenResult {
  if (!secret) throw new Error("issueRefreshToken requires a secret.");
  const familyId = randomUUID();
  const jti = randomUUID();
  const token = signJwt(
    { jti, sub: user.sub, username: user.username, role: user.role, typ: "refresh", fam: familyId },
    secret,
    { expiresInSec }
  );
  families.set(familyId, { jti, expMs: Date.now() + expiresInSec * 1000 });
  return { token, familyId, expiresInSec };
}

/**
 * Verify a refresh token and rotate it: the presented jti is retired and a
 * new refresh token (same family) is returned alongside the verified claims.
 *
 * Reuse of a retired jti revokes the entire family (stolen-token defense).
 */
export function rotateRefreshToken(
  token: string,
  secret: string,
  { expiresInSec = DEFAULT_REFRESH_EXPIRES_IN_SEC }: RefreshTokenOptions = {}
): RotateRefreshTokenResult {
  const claims = verifyJwt(token, secret); // throws 401 on bad/expired/blacklisted
  if (claims.typ !== "refresh" || !claims.fam) {
    throw unauthorized("ليست بطاقة تجديد صالحة.", "NOT_REFRESH_TOKEN");
  }

  const entry = families.get(claims.fam);
  if (!entry || entry.expMs < Date.now()) {
    throw unauthorized(
      "جلسة التجديد منتهية — يرجى تسجيل الدخول من جديد.",
      "REFRESH_FAMILY_EXPIRED"
    );
  }
  if (entry.jti !== claims.jti) {
    // A previously-rotated token was replayed → assume theft, kill the family.
    families.delete(claims.fam);
    log.warn({ fam: claims.fam, sub: claims.sub }, "Refresh token reuse detected — family revoked");
    throw unauthorized(
      "تم رصد إعادة استخدام بطاقة تجديد — أُبطلت الجلسة.",
      "REFRESH_REUSED"
    );
  }

  const jti = randomUUID();
  const next = signJwt(
    {
      jti,
      sub: claims.sub,
      username: claims.username,
      role: claims.role,
      typ: "refresh",
      fam: claims.fam,
    },
    secret,
    { expiresInSec }
  );
  families.set(claims.fam, { jti, expMs: Date.now() + expiresInSec * 1000 });
  return { token: next, claims, familyId: claims.fam };
}

/**
 * Revoke a whole refresh family (used by logout). Safe on unknown ids.
 */
export function revokeRefreshFamily(familyId: string): void {
  if (familyId) families.delete(familyId);
}

/**
 * Extract the family id from a refresh token without trusting anything else.
 * Used by logout, where an expired refresh token should still kill its family.
 */
export function peekRefreshFamily(token: string): string | null {
  try {
    const body = String(token).split(".")[1] || "";
    const pad = body.length % 4 === 0 ? "" : "=".repeat(4 - (body.length % 4));
    const payload = JSON.parse(
      Buffer.from(body.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64").toString("utf8")
    );
    return payload?.typ === "refresh" && payload?.fam ? payload.fam : null;
  } catch {
    return null;
  }
}

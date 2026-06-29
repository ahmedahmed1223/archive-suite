/**
 * tokenService — thin facade over jwt.ts + refreshTokenStore.ts.
 *
 * Centralises the decision of which secret / TTL to use for access vs.
 * refresh tokens so callers (routes, tests) don't repeat config lookups.
 *
 * Access tokens:  short-lived (default 15 min), returned in JSON body.
 * Refresh tokens: long-lived (default 30 d), set as HttpOnly cookie only.
 *                 Rotation is handled by refreshTokenStore; reuse of a
 *                 rotated token kills the whole family (§20.1 theft defence).
 */

import { signJwt, verifyJwt } from "./jwt.js";
import {
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshFamily,
  peekRefreshFamily,
  DEFAULT_REFRESH_EXPIRES_IN_SEC,
} from "./refreshTokenStore.js";

/** Default access-token TTL: 15 minutes */
export const DEFAULT_ACCESS_EXPIRES_IN_SEC = 15 * 60;

interface User {
  id: string;
  username?: string;
  role?: string;
}

interface TokenOptions {
  expiresInSec?: number;
}

interface RefreshTokenResult {
  token: string;
  familyId: string;
  expiresInSec: number;
}

interface VerifyRefreshTokenResult {
  token: string;
  claims: any;
  familyId: string;
}

/**
 * Issue a short-lived access token.
 */
export function signAccessToken(
  user: User,
  secret: string,
  { expiresInSec = DEFAULT_ACCESS_EXPIRES_IN_SEC }: TokenOptions = {}
): string {
  if (!secret) throw new Error("signAccessToken requires a secret.");
  if (!user?.id) throw new Error("signAccessToken requires user.id.");
  return signJwt(
    { sub: user.id, username: user.username, role: user.role },
    secret,
    { expiresInSec }
  );
}

/**
 * Issue a long-lived refresh token and start a rotation family.
 */
export function signRefreshToken(
  user: User,
  secret: string,
  { expiresInSec = DEFAULT_REFRESH_EXPIRES_IN_SEC }: TokenOptions = {}
): RefreshTokenResult {
  if (!secret) throw new Error("signRefreshToken requires a secret.");
  if (!user?.id) throw new Error("signRefreshToken requires user.id.");
  return issueRefreshToken(
    { sub: user.id, username: user.username, role: user.role },
    secret,
    { expiresInSec }
  );
}

/**
 * Verify an access token and return its claims.
 */
export function verifyAccessToken(token: string, secret: string): any {
  if (!secret) throw new Error("verifyAccessToken requires a secret.");
  const claims = verifyJwt(token, secret);
  // Reject refresh tokens used in the access-token slot.
  if (claims.typ === "refresh") {
    const err = new Error("Invalid token type.");
    (err as any).statusCode = 401;
    throw err;
  }
  return claims;
}

/**
 * Verify a refresh token, rotate it, and return the new token + claims.
 */
export function verifyRefreshToken(
  token: string,
  secret: string,
  { expiresInSec = DEFAULT_REFRESH_EXPIRES_IN_SEC }: TokenOptions = {}
): VerifyRefreshTokenResult {
  if (!secret) throw new Error("verifyRefreshToken requires a secret.");
  return rotateRefreshToken(token, secret, { expiresInSec });
}

/**
 * Revoke an entire refresh family (used by logout).
 * Safe to call with an unknown family id.
 */
export { revokeRefreshFamily };

/**
 * Extract the family id from a refresh token without verifying its signature.
 * Useful during logout when the access token may already be expired.
 */
export { peekRefreshFamily };

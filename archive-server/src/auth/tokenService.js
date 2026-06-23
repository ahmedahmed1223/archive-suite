/**
 * tokenService — thin facade over jwt.js + refreshTokenStore.js.
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
  DEFAULT_REFRESH_EXPIRES_IN_SEC
} from "./refreshTokenStore.js";

/** Default access-token TTL: 15 minutes */
export const DEFAULT_ACCESS_EXPIRES_IN_SEC = 15 * 60;

/**
 * Issue a short-lived access token.
 *
 * @param {{ id: string, username?: string, role?: string }} user
 * @param {string} secret
 * @param {{ expiresInSec?: number }} [options]
 * @returns {string} signed JWT
 */
export function signAccessToken(user, secret, { expiresInSec = DEFAULT_ACCESS_EXPIRES_IN_SEC } = {}) {
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
 *
 * @param {{ id: string, username?: string, role?: string }} user
 * @param {string} secret
 * @param {{ expiresInSec?: number }} [options]
 * @returns {{ token: string, familyId: string, expiresInSec: number }}
 */
export function signRefreshToken(user, secret, { expiresInSec = DEFAULT_REFRESH_EXPIRES_IN_SEC } = {}) {
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
 *
 * @param {string} token
 * @param {string} secret
 * @returns {object} the verified JWT payload
 * @throws {Error} statusCode 401 on failure
 */
export function verifyAccessToken(token, secret) {
  if (!secret) throw new Error("verifyAccessToken requires a secret.");
  const claims = verifyJwt(token, secret);
  // Reject refresh tokens used in the access-token slot.
  if (claims.typ === "refresh") {
    const err = new Error("Invalid token type.");
    err.statusCode = 401;
    throw err;
  }
  return claims;
}

/**
 * Verify a refresh token, rotate it, and return the new token + claims.
 *
 * @param {string} token
 * @param {string} secret
 * @param {{ expiresInSec?: number }} [options]
 * @returns {{ token: string, claims: object, familyId: string }}
 * @throws {Error} statusCode 401; code "REFRESH_REUSED" on theft detection
 */
export function verifyRefreshToken(token, secret, { expiresInSec = DEFAULT_REFRESH_EXPIRES_IN_SEC } = {}) {
  if (!secret) throw new Error("verifyRefreshToken requires a secret.");
  return rotateRefreshToken(token, secret, { expiresInSec });
}

/**
 * Revoke an entire refresh family (used by logout).
 * Safe to call with an unknown family id.
 *
 * @param {string} familyId
 */
export { revokeRefreshFamily };

/**
 * Extract the family id from a refresh token without verifying its signature.
 * Useful during logout when the access token may already be expired.
 *
 * @param {string} token
 * @returns {string|null}
 */
export { peekRefreshFamily };

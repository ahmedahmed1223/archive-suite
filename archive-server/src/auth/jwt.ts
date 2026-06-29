import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { isRevoked } from "./tokenBlacklist.js";

// Minimal HS256 JWT — signed/verified with node:crypto, zero dependencies.
// Enough for single-tenant session auth on the RPC API. Not a general JWT lib
// (no RS256, no JWK) — deliberately small and auditable.

interface JwtPayload {
  [key: string]: any;
  iat?: number;
  exp?: number;
  jti?: string;
}

interface JwtOptions {
  expiresInSec?: number;
}

function base64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlJson(obj: any): string {
  return base64url(JSON.stringify(obj));
}

function fromBase64url(str: string): Buffer {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(data)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Sign a JWT (HS256).
 */
export function signJwt(
  payload: JwtPayload,
  secret: string,
  { expiresInSec = 12 * 60 * 60 }: JwtOptions = {}
): string {
  if (!secret) throw new Error("signJwt requires a secret.");
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  // Ensure every token has a unique identifier for revocation support.
  // Callers (e.g. share tokens) may supply their own jti; don't overwrite it.
  const jti = payload.jti ?? randomUUID();
  const body = { jti, ...payload, iat: now, exp: now + expiresInSec };
  const head = `${base64urlJson(header)}.${base64urlJson(body)}`;
  return `${head}.${sign(head, secret)}`;
}

/**
 * Verify a JWT (HS256) and return its payload, or throw.
 */
export function verifyJwt(token: string, secret: string): JwtPayload {
  if (!secret) throw new Error("verifyJwt requires a secret.");
  const fail = (message: string): Error => {
    const err = new Error(message);
    (err as any).statusCode = 401;
    return err;
  };

  if (typeof token !== "string") throw fail("Missing token.");
  const parts = token.split(".");
  if (parts.length !== 3) throw fail("Malformed token.");

  const [headB64, bodyB64, sigB64] = parts;
  const head = `${headB64}.${bodyB64}`;
  const expected = sign(head, secret);

  // Constant-time comparison to avoid signature timing leaks.
  const a = Buffer.from(sigB64);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw fail("Invalid signature.");
  }

  let payload: JwtPayload;
  try {
    payload = JSON.parse(fromBase64url(bodyB64).toString("utf8"));
  } catch {
    throw fail("Invalid payload.");
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && now >= payload.exp) {
    throw fail("Token expired.");
  }

  if (payload.jti && isRevoked(payload.jti)) {
    const err = fail("Token revoked.");
    (err as any).code = "TOKEN_REVOKED";
    throw err;
  }

  return payload;
}

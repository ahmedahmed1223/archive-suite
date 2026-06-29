// Scoped sharing (G6) — signed share tokens.
//
// Reuses the zero-dependency HS256 JWT module so a public share link can't be
// forged or have its scope tampered with. A share token carries kind:"share"
// plus the normalized scope, and a default 30-day expiry.

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { signJwt, verifyJwt } from "../auth/jwt.js";
import { createShareScope } from "./scope.js";

const DEFAULT_EXPIRY_DAYS = 30;
const PASSWORD_MAX_LENGTH = 256;

export class ShareTokenError extends Error {
  statusCode: number;

  constructor(message: string, { statusCode = 404 } = {}) {
    super(message);
    this.name = "ShareTokenError";
    this.statusCode = statusCode;
  }
}

function normalizePassword(password: unknown): string {
  const value = String(password || "").trim();
  return value ? value.slice(0, PASSWORD_MAX_LENGTH) : "";
}

function passwordDigest(password: unknown, secret: string): string {
  return createHmac("sha256", String(secret))
    .update(normalizePassword(password))
    .digest("hex");
}

function passwordMatches(
  expectedDigest: string,
  password: unknown,
  secret: string
): boolean {
  const provided = normalizePassword(password);
  if (!provided) return false;
  const actual = Buffer.from(passwordDigest(provided, secret), "hex");
  const expected = Buffer.from(String(expectedDigest || ""), "hex");
  return (
    actual.length === expected.length && timingSafeEqual(actual, expected)
  );
}

interface MintShareTokenParams {
  scope?: unknown;
  secret?: string;
  expiresInDays?: number;
  title?: string;
  password?: string;
}

/** Mint a signed share token for a scope. */
export function mintShareToken({
  scope,
  secret,
  expiresInDays = DEFAULT_EXPIRY_DAYS,
  title = "",
  password = "",
}: MintShareTokenParams = {}): string {
  if (!secret)
    throw new ShareTokenError(
      "Share signing secret is not configured.",
      { statusCode: 501 }
    );
  const normalized = createShareScope(scope);
  const rawDays = Number(expiresInDays);
  const days =
    Number.isFinite(rawDays) && rawDays > 0
      ? Math.min(365, rawDays)
      : DEFAULT_EXPIRY_DAYS;
  const normalizedPassword = normalizePassword(password);
  const payload: any = {
    kind: "share",
    jti: randomUUID(),
    scope: normalized,
    title: String(title || "")
      .trim()
      .slice(0, 120),
  };
  if (normalizedPassword) {
    payload.passwordProtected = true;
    payload.passwordDigest = passwordDigest(normalizedPassword, secret);
  }
  return signJwt(payload, secret, {
    expiresInSec: Math.floor(days * 24 * 60 * 60),
  });
}

function verifySharePayload(token: string, secret: string): any {
  if (!secret)
    throw new ShareTokenError(
      "Share signing secret is not configured.",
      { statusCode: 501 }
    );
  if (!token)
    throw new ShareTokenError("Missing share token.", { statusCode: 404 });
  let payload;
  try {
    payload = verifyJwt(token, secret);
  } catch {
    // Invalid/expired/tampered all look the same to a public visitor: not found.
    throw new ShareTokenError(
      "Share link is invalid or has expired.",
      { statusCode: 404 }
    );
  }
  if (!payload || payload.kind !== "share") {
    throw new ShareTokenError("Not a share link.", { statusCode: 404 });
  }
  return payload;
}

interface ShareTokenPayload {
  scope: unknown;
  title: string;
  expiresAt: string;
  jti: string;
  passwordProtected: boolean;
}

/** Verify a share token and return its normalized scope (throws ShareTokenError). */
export function readShareToken(
  token: string,
  secret: string,
  options?: { password?: string }
): unknown {
  return readShareTokenPayload(token, secret, options).scope;
}

/** Verify a share token and return public metadata used by the share page. */
export function readShareTokenPayload(
  token: string,
  secret: string,
  options?: { password?: string }
): ShareTokenPayload {
  const payload = verifySharePayload(token, secret);
  if (
    payload.passwordDigest &&
    !passwordMatches(payload.passwordDigest, options?.password, secret)
  ) {
    throw new ShareTokenError(
      "كلمة مرور المشاركة مطلوبة أو غير صحيحة.",
      { statusCode: 401 }
    );
  }
  return {
    scope: createShareScope(payload.scope),
    title: String(payload.title || "")
      .trim()
      .slice(0, 120),
    expiresAt:
      typeof payload.exp === "number"
        ? new Date(payload.exp * 1000).toISOString()
        : "",
    jti: payload.jti || "",
    passwordProtected: Boolean(payload.passwordDigest || payload.passwordProtected),
  };
}

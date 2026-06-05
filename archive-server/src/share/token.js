// Scoped sharing (G6) — signed share tokens.
//
// Reuses the zero-dependency HS256 JWT module so a public share link can't be
// forged or have its scope tampered with. A share token carries kind:"share"
// plus the normalized scope, and a default 30-day expiry.

import { signJwt, verifyJwt } from "../auth/jwt.js";
import { createShareScope } from "./scope.js";

const DEFAULT_EXPIRY_DAYS = 30;

export class ShareTokenError extends Error {
  constructor(message, { statusCode = 404 } = {}) {
    super(message);
    this.name = "ShareTokenError";
    this.statusCode = statusCode;
  }
}

/** Mint a signed share token for a scope. */
export function mintShareToken({ scope, secret, expiresInDays = DEFAULT_EXPIRY_DAYS, title = "" } = {}) {
  if (!secret) throw new ShareTokenError("Share signing secret is not configured.", { statusCode: 501 });
  const normalized = createShareScope(scope);
  const rawDays = Number(expiresInDays);
  const days = Number.isFinite(rawDays) && rawDays > 0 ? Math.min(365, rawDays) : DEFAULT_EXPIRY_DAYS;
  return signJwt({
    kind: "share",
    scope: normalized,
    title: String(title || "").trim().slice(0, 120)
  }, secret, { expiresInSec: Math.floor(days * 24 * 60 * 60) });
}

function verifySharePayload(token, secret) {
  if (!secret) throw new ShareTokenError("Share signing secret is not configured.", { statusCode: 501 });
  if (!token) throw new ShareTokenError("Missing share token.", { statusCode: 404 });
  let payload;
  try {
    payload = verifyJwt(token, secret);
  } catch {
    // Invalid/expired/tampered all look the same to a public visitor: not found.
    throw new ShareTokenError("Share link is invalid or has expired.", { statusCode: 404 });
  }
  if (!payload || payload.kind !== "share") {
    throw new ShareTokenError("Not a share link.", { statusCode: 404 });
  }
  return payload;
}

/** Verify a share token and return its normalized scope (throws ShareTokenError). */
export function readShareToken(token, secret) {
  return createShareScope(verifySharePayload(token, secret).scope);
}

/** Verify a share token and return public metadata used by the share page. */
export function readShareTokenPayload(token, secret) {
  const payload = verifySharePayload(token, secret);
  return {
    scope: createShareScope(payload.scope),
    title: String(payload.title || "").trim().slice(0, 120),
    expiresAt: typeof payload.exp === "number" ? new Date(payload.exp * 1000).toISOString() : ""
  };
}

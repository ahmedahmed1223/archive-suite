/**
 * In-memory password reset token store.
 * Token: 32 random bytes (hex) — NOT a JWT (no signing needed; it's a one-time use secret).
 * TTL: 15 minutes.
 */
import { randomBytes } from "node:crypto";

interface ResetTokenData {
  userId: string;
  username: string;
  email: string;
  expiresAt: number;
}

const tokens = new Map<string, ResetTokenData>(); // token → { userId, username, email, expiresAt }
const TTL_MS = 15 * 60 * 1000;

export function createResetToken(userId: string, username: string, email: string): string {
  const token = randomBytes(32).toString("hex");
  const expiresAt = Date.now() + TTL_MS;
  // Invalidate any previous token for this user
  for (const [t, data] of tokens) if (data.userId === userId) tokens.delete(t);
  tokens.set(token, { userId, username, email, expiresAt });
  return token;
}

export function consumeResetToken(token: string): ResetTokenData | null {
  const data = tokens.get(token);
  if (!data) return null;
  if (Date.now() > data.expiresAt) {
    tokens.delete(token);
    return null;
  }
  tokens.delete(token); // one-time use
  return data;
}

// Prune expired tokens periodically so they don't accumulate in memory.
const pruneInterval = setInterval(() => {
  const now = Date.now();
  for (const [t, data] of tokens) if (data.expiresAt < now) tokens.delete(t);
}, 5 * 60 * 1000);
if (typeof pruneInterval.unref === "function") pruneInterval.unref();

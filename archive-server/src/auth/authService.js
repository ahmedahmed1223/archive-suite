import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";

import { signJwt } from "./jwt.js";

// Server-side credential verification + login. Verifies against the `users`
// records the app already stores (bcrypt `passwordHash`, or legacy 64-char
// SHA-256 for accounts created before the bcrypt migration). Issues a JWT on
// success. Kept HTTP-free so it's unit-testable with an injected provider.

const SHA_HEX_RE = /^[a-f0-9]{64}$/i;

/** Verify a plaintext secret against a stored hash (bcrypt or legacy SHA-256). */
export async function verifySecret(plain, hash) {
  if (typeof plain !== "string" || !plain || typeof hash !== "string" || !hash) {
    return false;
  }
  if (SHA_HEX_RE.test(hash)) {
    // Legacy SHA-256 (unsalted) — supported only so old accounts can still log
    // in; the SPA upgrades them to bcrypt on next successful local login.
    const digest = createHash("sha256").update(plain).digest("hex");
    return digest === hash.toLowerCase();
  }
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

function unauthorized(message) {
  const err = new Error(message);
  err.statusCode = 401;
  return err;
}

function pickUser(users, username) {
  const wanted = String(username || "").trim().toLowerCase();
  return (users || []).find(
    (u) => String(u?.username || "").trim().toLowerCase() === wanted && u?.isActive !== false
  );
}

/**
 * Authenticate { username, password } against the active provider's users.
 * @returns {Promise<{token: string, user: {id, username, role}}>}
 * @throws 401 on bad credentials
 */
export async function loginUser({ username, password }, { provider, secret, expiresInSec } = {}) {
  if (!secret) throw new Error("loginUser requires a JWT secret.");
  if (!username || !password) throw unauthorized("اسم المستخدم وكلمة المرور مطلوبان.");

  const users = await provider.getAll("users").catch(() => []);
  const user = pickUser(users, username);
  // Always run a verify (even when user is missing) to avoid user-enumeration
  // timing differences.
  const hash = user?.passwordHash || "$2a$12$0000000000000000000000000000000000000000000000000000";
  const ok = await verifySecret(password, hash);
  if (!user || !ok) throw unauthorized("بيانات الدخول غير صحيحة.");

  const claims = { sub: user.id, username: user.username, role: user.role || "viewer" };
  const token = signJwt(claims, secret, { expiresInSec });
  return { token, user: { id: user.id, username: user.username, role: claims.role } };
}

/**
 * Seed a first admin from env if the users store is empty. Lets a fresh cloud
 * deploy have a login without a separate setup UI. No-op when users exist or
 * env is unset.
 * @returns {Promise<{seeded: boolean, username?: string}>}
 */
export async function seedAdminIfMissing({ provider, username, password, now = () => new Date().toISOString() } = {}) {
  if (!username || !password) return { seeded: false };
  const users = await provider.getAll("users").catch(() => []);
  if (users.length > 0) return { seeded: false };

  const passwordHash = await bcrypt.hash(password, 12);
  const stamp = now();
  const admin = {
    id: `admin_${Date.now().toString(36)}`,
    username: String(username).trim(),
    displayName: "Administrator",
    role: "admin",
    isActive: true,
    passwordHash,
    createdAt: stamp,
    updatedAt: stamp
  };
  await provider.put("users", admin);
  return { seeded: true, username: admin.username };
}

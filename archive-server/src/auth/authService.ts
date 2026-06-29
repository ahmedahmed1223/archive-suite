import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";

import { signJwt } from "./jwt.js";
import { createLogger } from "../logger.js";

const log = createLogger("auth");

// Server-side credential verification + login. Verifies against the `users`
// records the app already stores (bcrypt `passwordHash`, or legacy 64-char
// SHA-256 for accounts created before the bcrypt migration). Issues a JWT on
// success. Kept HTTP-free so it's unit-testable with an injected provider.

const SHA_HEX_RE = /^[a-f0-9]{64}$/i;

interface User {
  id: string;
  username: string;
  role?: string;
  isAdmin?: boolean;
  passwordHash?: string;
  totpEnabled?: boolean;
  totpSecret?: string;
  totpRecoveryCodes?: string[];
  isActive?: boolean;
}

interface LoginResult {
  token: string;
  user: {
    id: string;
    username: string;
    role: string;
  };
}

interface SeedAdminResult {
  seeded: boolean;
  username?: string;
}

/** Verify a plaintext secret against a stored hash (bcrypt or legacy SHA-256). */
export async function verifySecret(plain: string, hash: string): Promise<boolean> {
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

function unauthorized(message: string): Error {
  const err = new Error(message);
  (err as any).statusCode = 401;
  return err;
}

function pickUser(users: User[], username: string): User | undefined {
  const wanted = String(username || "").trim().toLowerCase();
  return (users || []).find(
    (u) => String(u?.username || "").trim().toLowerCase() === wanted && u?.isActive !== false
  );
}

/**
 * Authenticate { username, password } against the active provider's users.
 * When the account has TOTP enabled, opts.totpToken must also be provided.
 */
export async function loginUser(
  { username, password }: { username: string; password: string },
  {
    provider,
    secret,
    expiresInSec,
    totpToken,
  }: {
    provider?: any;
    secret?: string;
    expiresInSec?: number;
    totpToken?: string;
  } = {}
): Promise<LoginResult> {
  if (!secret) throw new Error("loginUser requires a JWT secret.");
  if (!username || !password) throw unauthorized("اسم المستخدم وكلمة المرور مطلوبان.");

  // Prefer getByField when the provider supports it (Postgres uses an indexed
  // JSONB query; PocketBase falls back to getAll + in-memory filter internally).
  // Fall back to getAll + pickUser for providers that don't implement it.
  let user: User | undefined;
  const wantedUsername = String(username || "").trim().toLowerCase();
  if (typeof provider?.getByField === "function") {
    const found = await provider.getByField("users", "username", wantedUsername).catch(() => undefined);
    // Guard: the field-matched record must also be active (mirrors pickUser logic).
    user = found?.isActive !== false ? found : undefined;
  } else {
    const users = await provider?.getAll("users").catch(() => []);
    user = pickUser(users, username);
  }
  // Always run a verify (even when user is missing) to avoid user-enumeration
  // timing differences.
  const hash = user?.passwordHash || "$2a$12$0000000000000000000000000000000000000000000000000000";
  const ok = await verifySecret(password, hash);
  if (!user || !ok) {
    log.warn({ username }, "Failed login attempt.");
    throw unauthorized("بيانات الدخول غير صحيحة.");
  }

  // TOTP check — only enforced when the account has 2FA enabled.
  if (user.totpEnabled && user.totpSecret) {
    if (!totpToken) {
      const err = new Error("رمز المصادقة الثنائية مطلوب.");
      (err as any).statusCode = 401;
      (err as any).code = "TOTP_REQUIRED";
      throw err;
    }
    const { verifyTotpToken, verifyRecoveryCode } = await import("./totpService.js");
    const isTotp = verifyTotpToken(user.totpSecret, totpToken);
    if (!isTotp) {
      // Fallback: try treating the token as a recovery code.
      const matchIndex = user.totpRecoveryCodes?.length
        ? await verifyRecoveryCode(totpToken, user.totpRecoveryCodes)
        : -1;
      if (matchIndex === -1) {
        log.warn({ username }, "Failed TOTP/recovery-code attempt.");
        const err = new Error("رمز المصادقة الثنائية أو رمز الاسترداد غير صحيح.");
        (err as any).statusCode = 401;
        (err as any).code = "TOTP_INVALID";
        throw err;
      }
      // Consume the used recovery code (remove its hash from the stored list).
      const remaining = (user.totpRecoveryCodes || []).filter((_, i) => i !== matchIndex);
      await provider?.put("users", { id: user.id, totpRecoveryCodes: remaining });
      log.info(
        { username, remainingCodes: remaining.length },
        "Recovery code consumed at login."
      );
    }
  }

  // Default to "editor" (not "viewer") for legacy accounts without a role field,
  // so existing users retain write access after the RBAC upgrade.
  const claims = { sub: user.id, username: user.username, role: user.role || "editor" };
  const token = signJwt(claims, secret, { expiresInSec });
  log.info({ username: user.username, role: claims.role }, "Login successful.");
  return { token, user: { id: user.id, username: user.username, role: claims.role } };
}

/**
 * Seed a first admin from env if the users store is empty. Lets a fresh cloud
 * deploy have a login without a separate setup UI. No-op when users exist or
 * env is unset.
 */
export async function seedAdminIfMissing({
  provider,
  username,
  password,
  now = () => new Date().toISOString(),
}: {
  provider?: any;
  username?: string;
  password?: string;
  now?: () => string;
} = {}): Promise<SeedAdminResult> {
  if (!username || !password) return { seeded: false };
  const users = await provider?.getAll("users").catch(() => []);
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
    updatedAt: stamp,
  };
  await provider?.put("users", admin);
  return { seeded: true, username: admin.username };
}

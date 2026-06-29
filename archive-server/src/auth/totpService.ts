/**
 * TOTP (Time-based One-Time Password) service.
 * Compatible with Google Authenticator, Authy, and any RFC 6238 app.
 * Secrets are stored encrypted in the user record (base32, via otpauth).
 *
 * Production note: the QR code URL below uses a free third-party service
 * (api.qrserver.com). For production deployments, replace with a self-hosted
 * solution using the `qrcode` npm package to avoid sending otpauth URLs to
 * an external service.
 *
 * TODO (follow-up): implement backup/recovery codes — generate ~10 single-use
 * codes on 2FA setup, store as bcrypt hashes in user.totpRecoveryCodes[], and
 * accept them at login in place of a TOTP token (consuming the code on use).
 */
import * as OTPAuth from "otpauth";
import { randomBytes } from "node:crypto";
import QRCode from "qrcode";
import bcrypt from "bcryptjs";

import { config } from "../config/env.js";

const ISSUER = config.totpIssuer;
const WINDOW = 1; // Allow ±1 time step (30 s window each side)

interface TotpSecret {
  secret: string;
  otpauthUrl: string;
  qrUrl: string;
}

interface RecoveryCodes {
  plain: string[];
  hashes: string[];
}

/**
 * Generate a new TOTP secret for a user.
 * Returns { secret (base32), otpauthUrl, qrUrl }.
 */
export async function generateTotpSecret(username: string): Promise<TotpSecret> {
  // Build a 32-character base32 secret from 20 random bytes.
  // base64 output contains A-Z, a-z, 0-9, +, /, = — replace non-base32
  // chars with 'A' so the result is a valid base32 string.
  const rawBase32 = randomBytes(20)
    .toString("base64")
    .replace(/[^A-Z2-7]/gi, "A")
    .toUpperCase()
    .slice(0, 32);

  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label: username,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(rawBase32),
  });

  const otpauthUrl = totp.toString();
  // Generate QR code locally — never send the otpauth:// URI to an external service.
  const qrUrl = await QRCode.toDataURL(otpauthUrl, { width: 200, margin: 1 });
  return { secret: totp.secret.base32, otpauthUrl, qrUrl };
}

const RECOVERY_CODE_BYTES = 10; // produces a 20-char hex code split as XXXXX-XXXXX-XXXXX-XXXXX

/**
 * Generate `count` single-use recovery codes (plain-text) and their bcrypt hashes.
 * Caller stores the hashes; plain codes are shown to the user once and then discarded.
 */
export async function generateRecoveryCodes(count: number = 8): Promise<RecoveryCodes> {
  const plain = Array.from({ length: count }, () => {
    const hex = randomBytes(RECOVERY_CODE_BYTES).toString("hex").toUpperCase();
    return `${hex.slice(0, 5)}-${hex.slice(5, 10)}-${hex.slice(10, 15)}-${hex.slice(15, 20)}`;
  });
  const hashes = await Promise.all(
    plain.map((code) => bcrypt.hash(code.replace(/-/g, ""), 10))
  );
  return { plain, hashes };
}

/**
 * Check a plain-text recovery code against an array of stored bcrypt hashes.
 * Returns the index of the matched hash, or -1 if none match.
 * Compares all hashes to avoid leaking which index matched via timing.
 */
export async function verifyRecoveryCode(
  plain: string,
  hashes: string[] = []
): Promise<number> {
  if (!plain || !hashes.length) return -1;
  const normalized = String(plain).replace(/[^A-Fa-f0-9]/g, "").toUpperCase();
  const results = await Promise.all(
    hashes.map((h) => bcrypt.compare(normalized, h).catch(() => false))
  );
  return results.findIndex(Boolean);
}

/**
 * Verify a TOTP token against a stored base32 secret.
 * Returns true if valid.
 */
export function verifyTotpToken(secret: string, token: string): boolean {
  if (!secret || !token) return false;
  try {
    const totp = new OTPAuth.TOTP({
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
    const delta = totp.validate({
      token: String(token).replace(/\s/g, ""),
      window: WINDOW,
    });
    return delta !== null;
  } catch {
    return false;
  }
}

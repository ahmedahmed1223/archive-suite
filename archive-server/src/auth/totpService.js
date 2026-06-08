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

const ISSUER = process.env.TOTP_ISSUER || "Archive Suite";
const WINDOW = 1; // Allow ±1 time step (30 s window each side)

/**
 * Generate a new TOTP secret for a user.
 * Returns { secret (base32), otpauthUrl, qrUrl }.
 */
export async function generateTotpSecret(username) {
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

/**
 * Verify a TOTP token against a stored base32 secret.
 * Returns true if valid.
 */
export function verifyTotpToken(secret, token) {
  if (!secret || !token) return false;
  try {
    const totp = new OTPAuth.TOTP({
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
    const delta = totp.validate({ token: String(token).replace(/\s/g, ""), window: WINDOW });
    return delta !== null;
  } catch {
    return false;
  }
}

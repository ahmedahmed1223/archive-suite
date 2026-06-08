import bcrypt from "bcryptjs";

/**
 * Password utilities — unified bcrypt-based hashing with backwards
 * compatibility for the legacy SHA-256 hashes still present in
 * existing IndexedDB rows.
 *
 * Threat model addressed:
 *  - Rainbow-table attacks on SHA-256 hashes (no salt).
 *  - Dictionary attacks on weak passwords.
 *  - Empty-password user accounts.
 *  - Brute-force via repeated login attempts (lockout in authSlice).
 *
 * Legacy hash policy:
 *  - SHA-256 hashes (raw 64-char hex, no "$2..." prefix) still verify
 *    correctly via verifyPassword so existing users can sign in.
 *  - isLegacyHash() lets the auth slice flag the account so the user
 *    is forced to set a new bcrypt hash on the next successful login.
 */

/** SHA-256 via Web Crypto — replaces crypto-js (~150 KB) for a single operation. */
async function sha256Hex(text) {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(String(text || ""))
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const BCRYPT_COST = 12;
const SHA_HEX_RE = /^[a-f0-9]{64}$/i;

/**
 * Hash a password using bcrypt at cost 12.
 *
 * Async — callers must await. Returns the standard bcrypt hash string
 * ("$2a$12$..."), which is salted and slow enough to make rainbow
 * tables impractical.
 *
 * @param {string} password
 * @returns {Promise<string>}
 */
export async function hashPassword(password) {
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("كلمة المرور مطلوبة.");
  }
  return bcrypt.hash(password, BCRYPT_COST);
}

/**
 * Legacy SHA-256 hash (async, Web Crypto). Retained only for verifying
 * hashes created before the bcrypt migration — do not use for new accounts.
 *
 * @param {string} password
 * @returns {Promise<string>}
 */
export async function legacyHashPassword(password) {
  return sha256Hex(password);
}

/**
 * Verify a plaintext password against a stored hash.
 *
 * Handles both formats:
 *  - "$2a$..." / "$2b$..." → bcrypt.compare (recommended).
 *  - 64-char hex (legacy SHA-256) → constant-time hex compare.
 *
 * Empty stored hash and empty password both return false — empty
 * passwords are no longer accepted (policy change from previous
 * version where !user.passwordHash + !password returned true).
 *
 * @param {string} password
 * @param {string} storedHash
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, storedHash) {
  if (typeof password !== "string" || password.length === 0) return false;
  if (typeof storedHash !== "string" || storedHash.length === 0) return false;
  try {
    if (storedHash.startsWith("$2")) {
      return await bcrypt.compare(password, storedHash);
    }
    if (SHA_HEX_RE.test(storedHash)) {
      const candidate = await legacyHashPassword(password);
      return constantTimeEquals(candidate, storedHash);
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Detect whether a stored hash is in the legacy (unsalted SHA-256)
 * format. Auth slice uses this to flag accounts for re-hashing on the
 * next successful login.
 *
 * @param {string} storedHash
 * @returns {boolean}
 */
export function isLegacyHash(storedHash) {
  return typeof storedHash === "string" && SHA_HEX_RE.test(storedHash) && !storedHash.startsWith("$2");
}

/**
 * Validate a candidate password against the project policy.
 *
 *  - Minimum 8 characters.
 *  - At least one letter (any script — Arabic letters count).
 *  - At least one digit (Latin or Arabic-Indic).
 *  - At least one symbol (anything that isn't a letter, digit, or whitespace).
 *
 * Returns an array of localized error messages — empty array means OK.
 *
 * @param {string} password
 * @returns {string[]}
 */
export function validatePasswordStrength(password) {
  const errors = [];
  const value = typeof password === "string" ? password : "";
  if (value.length < 8) {
    errors.push("كلمة المرور يجب أن تكون 8 أحرف على الأقل.");
  }
  if (!/\p{L}/u.test(value)) {
    errors.push("يجب أن تحتوي على حرف واحد على الأقل.");
  }
  if (!/[\d٠-٩]/.test(value)) {
    errors.push("يجب أن تحتوي على رقم واحد على الأقل.");
  }
  if (!/[^\p{L}\p{N}\s]/u.test(value)) {
    errors.push("يجب أن تحتوي على رمز خاص واحد على الأقل (مثل ! @ # $).");
  }
  return errors;
}

function constantTimeEquals(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

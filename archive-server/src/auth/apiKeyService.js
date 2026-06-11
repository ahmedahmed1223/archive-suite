/**
 * apiKeyService.js — programmatic API keys (§20.5).
 *
 * Keys are separate from user JWTs: they grant scoped, read-oriented access
 * to external systems. Only the SHA-256 hash is persisted; the plaintext key
 * is returned exactly once at creation time.
 *
 * Key format: `ak_<prefix8>_<secret32>` — the `prefix` column stores the
 * shown-everywhere `ak_<prefix8>` portion for listing; the full string is
 * hashed for lookup. Lookup is by unique hash, not a compare.
 */

import { createHash, randomBytes } from "node:crypto";

export const API_SCOPES = ["read", "write"];
const DEFAULT_SCOPES = ["read"];

/** SHA-256 hex of the full key string (what we store and look up by). */
export function hashApiKey(key) {
  return createHash("sha256").update(String(key)).digest("hex");
}

function generateKeyMaterial() {
  const prefix = `ak_${randomBytes(4).toString("hex")}`; // ak_ + 8 hex chars
  const secret = randomBytes(24).toString("base64url");  // 32 url-safe chars
  const key = `${prefix}_${secret}`;
  return { key, prefix };
}

function normalizeScopes(scopes) {
  if (!Array.isArray(scopes) || scopes.length === 0) return [...DEFAULT_SCOPES];
  const filtered = scopes.filter((s) => API_SCOPES.includes(s));
  return filtered.length ? [...new Set(filtered)] : [...DEFAULT_SCOPES];
}

/**
 * Create an API key. Returns the row plus the one-time plaintext `key`.
 * @returns {Promise<{id,name,prefix,scopes,key,expiresAt}>}
 */
export async function createApiKey(prisma, { name, scopes, ownerId, expiresAt } = {}) {
  if (!prisma?.apiKey) {
    const err = new Error("مفاتيح API غير متاحة في هذا الإعداد."); err.statusCode = 501; throw err;
  }
  const cleanName = String(name || "").trim().slice(0, 80);
  if (!cleanName) { const err = new Error("اسم المفتاح مطلوب."); err.statusCode = 400; throw err; }
  if (expiresAt && Number.isNaN(Date.parse(expiresAt))) {
    const err = new Error("تاريخ انتهاء غير صالح."); err.statusCode = 400; throw err;
  }

  const { key, prefix } = generateKeyMaterial();
  const row = await prisma.apiKey.create({
    data: {
      name: cleanName,
      keyHash: hashApiKey(key),
      prefix,
      scopes: normalizeScopes(scopes),
      ownerId: ownerId || "unknown",
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  });

  return {
    id: row.id, name: row.name, prefix: row.prefix, scopes: row.scopes,
    expiresAt: row.expiresAt, key, // plaintext — shown once, never stored
  };
}

/** List a user's keys without secrets (prefix only, for display). */
export async function listApiKeys(prisma, ownerId) {
  if (!prisma?.apiKey) return [];
  const rows = await prisma.apiKey.findMany({
    where: { ownerId }, orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id, name: r.name, prefix: r.prefix, scopes: r.scopes,
    active: r.active, lastUsedAt: r.lastUsedAt, expiresAt: r.expiresAt, createdAt: r.createdAt,
  }));
}

/** Revoke (delete) a key the caller owns. Returns true when one was removed. */
export async function revokeApiKey(prisma, ownerId, id) {
  if (!prisma?.apiKey) return false;
  const { count } = await prisma.apiKey.deleteMany({ where: { id: String(id || ""), ownerId } });
  return count > 0;
}

/**
 * Verify a presented API key. Returns the principal claims on success or
 * null on any failure (unknown/expired/inactive). Touches lastUsedAt async.
 *
 * @returns {Promise<{sub:string, role:string, scopes:string[], apiKeyId:string}|null>}
 */
export async function verifyApiKey(prisma, key) {
  if (!prisma?.apiKey || !key) return null;
  let row;
  try {
    row = await prisma.apiKey.findUnique({ where: { keyHash: hashApiKey(key) } });
  } catch {
    return null;
  }
  if (!row || row.active === false) return null;
  if (row.expiresAt && new Date(row.expiresAt).getTime() <= Date.now()) return null;

  // Fire-and-forget last-used stamp; failure must not block the request.
  prisma.apiKey.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

  return {
    sub: row.ownerId,
    // API keys map to a scoped role; "write" grants editor, otherwise viewer.
    role: row.scopes?.includes("write") ? "editor" : "viewer",
    scopes: row.scopes || [...DEFAULT_SCOPES],
    apiKeyId: row.id,
  };
}

// @ts-nocheck
// §1697 — in-browser store for tracking minted share links.
// Persists to localStorage so the user can review and revoke links even
// after closing the share dialog. Key: archive_minted_share_links.
// PURE: no network, no React.

const STORAGE_KEY = "archive_minted_share_links";
const MAX_ENTRIES = 200;

function readAll() {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(entries) {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
    }
  } catch {
    // ignore quota errors silently
  }
}

/**
 * Save a freshly minted link entry into the local store.
 * Safe to call multiple times with the same jti (replaces).
 * @returns {object|null} the saved entry or null if url+token are both empty
 */
export function saveMintedLink({
  jti = "",
  url = "",
  token = "",
  permission = "view",
  scopeType = "",
  label = "",
  expiresAt = "",
  passwordProtected = false
} = {}) {
  if (!url && !token) return null;
  const entry = {
    jti: String(jti || ""),
    token: String(token || ""),
    url: String(url || ""),
    permission: String(permission || "view"),
    scopeType: String(scopeType || ""),
    label: String(label || ""),
    expiresAt: String(expiresAt || ""),
    passwordProtected: Boolean(passwordProtected),
    mintedAt: new Date().toISOString(),
    revoked: false
  };
  const entries = readAll();
  const idx = entries.findIndex(
    (e) => (entry.jti && e.jti === entry.jti) || (entry.url && e.url === entry.url)
  );
  if (idx >= 0) entries.splice(idx, 1, entry);
  else entries.unshift(entry);
  writeAll(entries);
  return entry;
}

/** Mark a link as revoked in the local store (by jti). */
export function markLinkRevoked(jti) {
  if (!jti) return;
  const entries = readAll().map((e) =>
    e.jti === jti ? { ...e, revoked: true } : e
  );
  writeAll(entries);
}

/** Remove a single link entry from the store (by jti or url). */
export function removeMintedLink(jti) {
  if (!jti) return;
  writeAll(readAll().filter((e) => e.jti !== jti));
}

/** Return all tracked links, newest first. */
export function getAllMintedLinks() {
  return readAll();
}

/** Wipe the entire store. */
export function clearAllMintedLinks() {
  writeAll([]);
}


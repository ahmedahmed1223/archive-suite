// §16.7 — Share permission enforcement service.
//
// Provides helpers used by server.js to verify that a public share token
// carries sufficient permission before allowing a protected action (comment,
// download, edit).
//
// Usage:
//   import { createSharePermissionService } from "../share/sharePermissionService.js";
//   const sharePerm = createSharePermissionService({ resolvedShareSecret });
//
//   const check = sharePerm.fromRequest(req);
//   if (!check.ok) return send(res, check.status, { ok: false, error: check.error });
//   if (!sharePerm.allows(check.payload, "canDownload")) {
//     return send(res, 403, { ok: false, error: "الرابط لا يمنح صلاحية التحميل." });
//   }

import { readShareTokenPayload } from "./token.js";
import { permissionCapabilities } from "./scope.js";

const CAPABILITY_KEYS = Object.freeze([
  "canView",
  "canComment",
  "canDownload",
  "canEdit",
]);

type CapabilityKey = (typeof CAPABILITY_KEYS)[number];

interface FromRequestResult {
  ok: boolean;
  payload?: any;
  status?: number;
  error?: string;
}

interface SharePermissionService {
  fromRequest: (
    req: any,
    options?: { password?: string }
  ) => FromRequestResult;
  allows: (payload: any, capabilityKey: CapabilityKey) => boolean;
  capabilities: (payload: any) => Record<string, boolean>;
  scopeIncludesItem: (payload: any, itemId: string) => boolean;
}

/**
 * @param {{ resolvedShareSecret: string }} deps
 */
export function createSharePermissionService({
  resolvedShareSecret,
}: {
  resolvedShareSecret?: string;
} = {}): SharePermissionService {
  /**
   * Extract the share token from the request and validate it.
   * Accepts the token from:
   *   - x-share-token: <token>  (preferred explicit header)
   *   - Query param:   ?shareToken=<token>
   *   - Authorization: Bearer <token>  (fallback if 3-part JWT)
   *
   * Returns { ok: true, payload } or { ok: false, status, error }.
   */
  function fromRequest(
    req: any,
    { password }: { password?: string } = {}
  ): FromRequestResult {
    if (!resolvedShareSecret) {
      return {
        ok: false,
        status: 501,
        error: "خدمة المشاركة غير مهيأة.",
      };
    }

    const rawUrl = req.url || "";
    const params = new URLSearchParams(
      rawUrl.includes("?")
        ? rawUrl.slice(rawUrl.indexOf("?") + 1)
        : ""
    );
    let token =
      params.get("shareToken") ||
      (req.headers["x-share-token"] || "").trim() ||
      "";

    if (!token) {
      const auth = (req.headers["authorization"] || "").trim();
      const parts = auth.startsWith("Bearer ")
        ? auth.slice(7).trim().split(".")
        : [];
      if (parts.length === 3) token = auth.slice(7).trim();
    }

    if (!token) {
      return { ok: false, status: 401, error: "رمز المشاركة مطلوب." };
    }

    try {
      const payload = readShareTokenPayload(token, resolvedShareSecret, {
        password,
      });
      return { ok: true, payload };
    } catch (err: any) {
      const status = err?.statusCode || 401;
      return {
        ok: false,
        status,
        error: err?.message || "رمز المشاركة غير صالح.",
      };
    }
  }

  /**
   * Return true when the payload's permission level satisfies the given capability.
   *
   * @param {object} payload  Validated share token payload.
   * @param {string} capabilityKey  One of: canView, canComment, canDownload, canEdit.
   */
  function allows(payload: any, capabilityKey: CapabilityKey): boolean {
    if (!payload?.scope?.permission) return false;
    if (!(CAPABILITY_KEYS as readonly string[]).includes(capabilityKey))
      return false;
    const caps = permissionCapabilities(payload.scope.permission);
    return Boolean(caps[capabilityKey as keyof typeof caps]);
  }

  /**
   * Resolve capabilities for a payload's permission level.
   *
   * @param {object} payload  Validated share token payload.
   * @returns {{ canView: boolean, canComment: boolean, canDownload: boolean, canEdit: boolean }}
   */
  function capabilities(payload: any) {
    return permissionCapabilities(payload?.scope?.permission || "view");
  }

  /**
   * Check whether the scope in the token includes a given item id.
   * Returns true for "all" scopes or when the id is explicitly listed.
   *
   * @param {object} payload  Validated share token payload.
   * @param {string} itemId
   */
  function scopeIncludesItem(payload: any, itemId: string): boolean {
    const scope = payload?.scope;
    if (!scope) return false;
    if (scope.type === "all") return true;
    if (scope.type === "items" || scope.type === "collection") {
      return (
        Array.isArray(scope.ids) && scope.ids.includes(String(itemId || ""))
      );
    }
    return false;
  }

  return { fromRequest, allows, capabilities, scopeIncludesItem };
}

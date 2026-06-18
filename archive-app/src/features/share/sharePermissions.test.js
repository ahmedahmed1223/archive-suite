import { describe, it, expect } from "vitest";

import {
  SHARE_PERMISSIONS,
  SHARE_SCOPE_TYPES,
  DEFAULT_SHARE_PERMISSION,
  isValidPermission,
  isValidScopeType,
  permissionCapabilities,
  getPermissionMeta,
  createShareGrant,
  describeShareGrant
} from "./sharePermissions.js";

describe("SHARE_PERMISSIONS ordering and metadata", () => {
  it("lists the four levels in ascending capability order", () => {
    expect(SHARE_PERMISSIONS.map((p) => p.id)).toEqual(["view", "comment", "download", "edit"]);
  });

  it("gives each level an Arabic label", () => {
    expect(getPermissionMeta("view").label).toBe("عرض فقط");
    expect(getPermissionMeta("comment").label).toBe("تعليق");
    expect(getPermissionMeta("download").label).toBe("تحميل");
    expect(getPermissionMeta("edit").label).toBe("تعديل");
  });

  it("returns null meta for an unknown level", () => {
    expect(getPermissionMeta("bogus")).toBeNull();
  });
});

describe("permissionCapabilities", () => {
  it("view grants only canView", () => {
    expect(permissionCapabilities("view")).toEqual({ canView: true, canComment: false, canDownload: false, canEdit: false });
  });

  it("comment adds canComment", () => {
    expect(permissionCapabilities("comment")).toEqual({ canView: true, canComment: true, canDownload: false, canEdit: false });
  });

  it("download adds canDownload (cumulative)", () => {
    expect(permissionCapabilities("download")).toEqual({ canView: true, canComment: true, canDownload: true, canEdit: false });
  });

  it("edit grants every capability", () => {
    expect(permissionCapabilities("edit")).toEqual({ canView: true, canComment: true, canDownload: true, canEdit: true });
  });

  it("falls back to view capabilities for unknown input", () => {
    expect(permissionCapabilities("nope")).toEqual(permissionCapabilities(DEFAULT_SHARE_PERMISSION));
    expect(permissionCapabilities(undefined)).toEqual(permissionCapabilities("view"));
  });

  it("returns a fresh object (immutable source)", () => {
    const caps = permissionCapabilities("edit");
    caps.canEdit = false;
    expect(permissionCapabilities("edit").canEdit).toBe(true);
  });
});

describe("validation helpers", () => {
  it("isValidPermission accepts known levels only", () => {
    expect(isValidPermission("edit")).toBe(true);
    expect(isValidPermission("admin")).toBe(false);
    expect(isValidPermission("")).toBe(false);
  });

  it("isValidScopeType accepts server-backed item aliases and collections", () => {
    expect(SHARE_SCOPE_TYPES).toEqual(["items", "collection"]);
    expect(isValidScopeType("item")).toBe(true);
    expect(isValidScopeType("items")).toBe(true);
    expect(isValidScopeType("collection")).toBe(true);
    expect(isValidScopeType("folder")).toBe(false);
    expect(isValidScopeType("workspace")).toBe(false);
  });
});

describe("createShareGrant normalization and validation", () => {
  it("normalizes a valid collection grant", () => {
    const grant = createShareGrant({ scopeType: "collection", scopeIds: ["c1"], permission: "comment", expiresInDays: 30, label: "  مراجعة  " });
    expect(grant).toMatchObject({ scopeType: "collection", scopeIds: ["c1"], permission: "comment", expiresInDays: 30, label: "مراجعة" });
    expect(grant.capabilities).toEqual(permissionCapabilities("comment"));
  });

  it("defaults permission to view when omitted (backward compatible)", () => {
    const grant = createShareGrant({ scopeType: "item", scopeIds: ["i1"] });
    expect(grant.scopeType).toBe("items");
    expect(grant.permission).toBe("view");
  });

  it("coerces a single scope id into an array and trims it", () => {
    const grant = createShareGrant({ scopeType: "item", scopeIds: " i9 " });
    expect(grant.scopeIds).toEqual(["i9"]);
  });

  it("drops empty/blank ids", () => {
    const grant = createShareGrant({ scopeType: "items", scopeIds: ["i1", "", "  ", "i2"] });
    expect(grant.scopeIds).toEqual(["i1", "i2"]);
  });

  it("clamps expiry to a sane range and floors fractions", () => {
    expect(createShareGrant({ scopeType: "item", scopeIds: ["i1"], expiresInDays: 9999 }).expiresInDays).toBe(365);
    expect(createShareGrant({ scopeType: "item", scopeIds: ["i1"], expiresInDays: 7.8 }).expiresInDays).toBe(7);
    expect(createShareGrant({ scopeType: "item", scopeIds: ["i1"], expiresInDays: -5 }).expiresInDays).toBe(0);
    expect(createShareGrant({ scopeType: "item", scopeIds: ["i1"], expiresInDays: "abc" }).expiresInDays).toBe(0);
  });

  it("falls back to view for an unknown permission rather than throwing", () => {
    expect(createShareGrant({ scopeType: "item", scopeIds: ["i1"], permission: "owner" }).permission).toBe("view");
  });

  it("throws on an invalid scope type", () => {
    expect(() => createShareGrant({ scopeType: "workspace", scopeIds: ["x"] })).toThrow();
    expect(() => createShareGrant({ scopeType: "folder", scopeIds: ["f1"] })).toThrow();
  });

  it("throws when there are no usable scope ids", () => {
    expect(() => createShareGrant({ scopeType: "item", scopeIds: [] })).toThrow();
    expect(() => createShareGrant({ scopeType: "item", scopeIds: ["", "  "] })).toThrow();
  });
});

describe("describeShareGrant", () => {
  it("summarizes a collection comment grant with expiry", () => {
    const grant = createShareGrant({ scopeType: "collection", scopeIds: ["c1"], permission: "comment", expiresInDays: 30 });
    expect(describeShareGrant(grant)).toBe("مشاركة مجموعة — تعليق — تنتهي خلال 30 يوماً");
  });

  it("notes when there is no expiry", () => {
    const grant = createShareGrant({ scopeType: "item", scopeIds: ["i1"], permission: "edit" });
    expect(describeShareGrant(grant)).toBe("مشاركة عنصر — تعديل — بدون تاريخ انتهاء");
  });

  it("returns a safe message for an invalid grant", () => {
    expect(describeShareGrant(null)).toBe("مشاركة غير صالحة");
    expect(describeShareGrant({ scopeType: "bad" })).toBe("مشاركة غير صالحة");
  });
});

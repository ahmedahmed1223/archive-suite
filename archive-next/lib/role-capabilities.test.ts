import { describe, expect, test } from "vitest";
import { can, type Capability } from "@/lib/role-capabilities";

const allCapabilities: readonly Capability[] = [
  "records.create",
  "records.edit",
  "records.bulkDelete",
  "users.manage",
  "system.control",
  "automation.manage",
  "backup.manage",
  "rights.manage",
  "ingest.manage",
  "collections.manage",
  "tags.manage",
  "vocabulary.manage",
  "delegations.manage",
  "shares.manage",
  "trash.restore",
  "trash.purge"
];

describe("role-capabilities", () => {
  test("admin is allowed every capability", () => {
    for (const capability of allCapabilities) {
      expect(can("admin", capability)).toBe(true);
    }
  });

  test("editor is allowed records.edit and ingest.manage but denied users.manage and system.control", () => {
    expect(can("editor", "records.edit")).toBe(true);
    expect(can("editor", "ingest.manage")).toBe(true);
    expect(can("editor", "users.manage")).toBe(false);
    expect(can("editor", "system.control")).toBe(false);
  });

  test("editor is allowed the new entity-management capabilities but denied trash.purge (admin-only)", () => {
    expect(can("editor", "collections.manage")).toBe(true);
    expect(can("editor", "tags.manage")).toBe(true);
    expect(can("editor", "vocabulary.manage")).toBe(true);
    expect(can("editor", "delegations.manage")).toBe(true);
    expect(can("editor", "shares.manage")).toBe(true);
    expect(can("editor", "trash.restore")).toBe(true);
    expect(can("editor", "trash.purge")).toBe(false);
  });

  test("viewer is denied records.bulkDelete", () => {
    expect(can("viewer", "records.bulkDelete")).toBe(false);
  });

  test("undefined role is denied everything", () => {
    for (const capability of allCapabilities) {
      expect(can(undefined, capability)).toBe(false);
    }
  });
});

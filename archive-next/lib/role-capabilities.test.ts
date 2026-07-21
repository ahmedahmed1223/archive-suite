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
  "rights.manage"
];

describe("role-capabilities", () => {
  test("admin is allowed every capability", () => {
    for (const capability of allCapabilities) {
      expect(can("admin", capability)).toBe(true);
    }
  });

  test("editor is allowed records.edit but denied users.manage and system.control", () => {
    expect(can("editor", "records.edit")).toBe(true);
    expect(can("editor", "users.manage")).toBe(false);
    expect(can("editor", "system.control")).toBe(false);
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

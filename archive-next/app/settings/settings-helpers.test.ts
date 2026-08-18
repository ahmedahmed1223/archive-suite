import { describe, expect, test } from "vitest";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { OdbcProbe } from "@/lib/archive-api";
import {
  disabledOdbcProbe,
  formatPreviewValue,
  getDefaultOdbcKeyColumn,
  odbcStatusLabel,
  odbcStatusMessage,
  odbcStatusTone
} from "./settings-helpers";

const odbcCopy = getDictionary("ar").pages.settings.odbc;

function probe(overrides: Partial<OdbcProbe> = {}): OdbcProbe {
  return { ...disabledOdbcProbe, ...overrides };
}

describe("getDefaultOdbcKeyColumn", () => {
  test("uses 'key' for the settings table", () => {
    expect(getDefaultOdbcKeyColumn("settings")).toBe("key");
  });

  test("uses 'id' for every other core table", () => {
    expect(getDefaultOdbcKeyColumn("items")).toBe("id");
    expect(getDefaultOdbcKeyColumn("users")).toBe("id");
    expect(getDefaultOdbcKeyColumn("audit")).toBe("id");
  });
});

describe("odbcStatusLabel / odbcStatusTone", () => {
  test("maps each status to its Arabic label and badge tone", () => {
    expect(odbcStatusLabel("connected", odbcCopy)).toBe(odbcCopy.statusMap.connected);
    expect(odbcStatusTone("connected")).toBe("success");
    expect(odbcStatusTone("failed")).toBe("danger");
    expect(odbcStatusTone("disabled")).toBe("neutral");
  });
});

describe("odbcStatusMessage", () => {
  test("uses the fixed message for known non-connected statuses", () => {
    expect(odbcStatusMessage(probe({ status: "missing-dsn" }), odbcCopy)).toBe(odbcCopy.statusMessages.missingDsn);
  });

  test("falls back to the raw driver error when present", () => {
    expect(odbcStatusMessage(probe({ status: "failed", error: "driver blew up" }), odbcCopy)).toBe("driver blew up");
  });
});

describe("formatPreviewValue", () => {
  test("returns the not-available text for empty values", () => {
    expect(formatPreviewValue(null, "N/A")).toBe("N/A");
    expect(formatPreviewValue(undefined, "N/A")).toBe("N/A");
    expect(formatPreviewValue("", "N/A")).toBe("N/A");
  });

  test("stringifies objects and passes through primitives", () => {
    expect(formatPreviewValue({ a: 1 }, "N/A")).toBe('{"a":1}');
    expect(formatPreviewValue(42, "N/A")).toBe("42");
  });
});

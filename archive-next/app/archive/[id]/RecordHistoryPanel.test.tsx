// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import type { RecordHistoryEntry } from "@/lib/archive-api";
import { RecordHistoryPanel } from "./RecordHistoryPanel";

afterEach(cleanup);

function entry(overrides: Partial<RecordHistoryEntry> = {}): RecordHistoryEntry {
  return {
    id: "hist-1",
    event: "record_notes.create",
    action: "create",
    resourceType: "record_note",
    resourceId: "note-1",
    actorId: "user-1",
    outcome: "success",
    statusCode: 200,
    metadata: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

function renderPanel(props: Partial<Parameters<typeof RecordHistoryPanel>[0]> = {}) {
  render(
    <LocaleProvider initialLocale="ar" hasLocaleCookie={false}>
      <RecordHistoryPanel entries={[]} loading={false} error={null} {...props} />
    </LocaleProvider>
  );
}

describe("RecordHistoryPanel", () => {
  test("shows the empty state when there are no events", () => {
    renderPanel();
    expect(screen.getByText("لا يوجد سجل تغييرات بعد")).toBeInTheDocument();
  });

  test("labels a known event and shows the diff fields from metadata", () => {
    renderPanel({
      entries: [
        entry({
          metadata: { diff: { fields: ["title", "description"] } }
        })
      ]
    });
    expect(screen.getByText("إضافة ملاحظة خاصة")).toBeInTheDocument();
    expect(screen.getByText("title")).toBeInTheDocument();
    expect(screen.getByText("description")).toBeInTheDocument();
  });

  test("renders a before/after comparison table when the diff has both sides", () => {
    renderPanel({
      entries: [
        entry({
          event: "rights.upsert",
          metadata: { diff: { before: { licenseType: "restricted" }, after: { licenseType: "public" } } }
        })
      ]
    });
    expect(screen.getByText("restricted")).toBeInTheDocument();
    expect(screen.getByText("public")).toBeInTheDocument();
  });

  test("falls back to the raw event name for unknown events", () => {
    renderPanel({ entries: [entry({ event: "custom.unmapped" })] });
    expect(screen.getByText("custom.unmapped")).toBeInTheDocument();
  });
});

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import type { RecordNote } from "@/lib/archive-api";
import { RecordNotesPanel, formatNoteTime, sortRecordNotes } from "./RecordNotesPanel";

afterEach(cleanup);

function note(overrides: Partial<RecordNote> = {}): RecordNote {
  return {
    id: "note-1",
    itemId: "rec-1",
    authorId: "user-1",
    authorName: "سارة",
    body: "ملاحظة",
    region: null,
    timestampSeconds: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: null,
    ...overrides
  };
}

describe("formatNoteTime", () => {
  test("formats sub-hour durations as m:ss", () => {
    expect(formatNoteTime(83)).toBe("1:23");
  });

  test("formats hour-plus durations as h:mm:ss", () => {
    expect(formatNoteTime(3661)).toBe("1:01:01");
  });

  test("falls back to 0:00 for invalid input", () => {
    expect(formatNoteTime(-5)).toBe("0:00");
    expect(formatNoteTime(Number.NaN)).toBe("0:00");
  });
});

describe("sortRecordNotes", () => {
  test("orders timestamped notes before general ones, earliest first", () => {
    const sorted = sortRecordNotes([
      note({ id: "general", timestampSeconds: null, createdAt: "2026-01-01T00:00:00.000Z" }),
      note({ id: "late", timestampSeconds: 90 }),
      note({ id: "early", timestampSeconds: 10 })
    ]);
    expect(sorted.map((item) => item.id)).toEqual(["early", "late", "general"]);
  });
});

describe("RecordNotesPanel", () => {
  test("submits a new note and clears the form", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(
      <LocaleProvider initialLocale="ar" hasLocaleCookie={false}>
        <RecordNotesPanel notes={[]} loading={false} error={null} onCreate={onCreate} onDelete={vi.fn()} />
      </LocaleProvider>
    );

    fireEvent.change(screen.getByPlaceholderText("اكتب ملاحظة شخصية عن هذا السجل... استخدم @ للإشارة لزميل"), {
      target: { value: "ملاحظة جديدة" }
    });
    fireEvent.click(screen.getByRole("button", { name: "إضافة ملاحظة" }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith({ body: "ملاحظة جديدة", timestampSeconds: null }));
  });

  test("shows the empty state when there are no notes", () => {
    render(
      <LocaleProvider initialLocale="ar" hasLocaleCookie={false}>
        <RecordNotesPanel notes={[]} loading={false} error={null} onCreate={vi.fn()} onDelete={vi.fn()} />
      </LocaleProvider>
    );
    expect(screen.getByText("لا توجد ملاحظات بعد")).toBeInTheDocument();
  });
});

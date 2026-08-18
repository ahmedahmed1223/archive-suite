// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import type { RecordComment } from "@/lib/archive-api";
import { RecordCommentsPanel } from "./RecordCommentsPanel";

afterEach(cleanup);

function comment(overrides: Partial<RecordComment> = {}): RecordComment {
  return {
    id: "comment-1",
    itemId: "rec-1",
    authorId: "user-1",
    authorName: "سارة",
    body: "تعليق",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: null,
    ...overrides
  };
}

describe("RecordCommentsPanel", () => {
  test("posts a new comment and clears the form", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(
      <LocaleProvider initialLocale="ar" hasLocaleCookie={false}>
        <RecordCommentsPanel comments={[]} loading={false} error={null} onCreate={onCreate} onDelete={vi.fn()} />
      </LocaleProvider>
    );

    fireEvent.change(screen.getByPlaceholderText("اكتب تعليقاً يراه بقية أعضاء الفريق... استخدم @ للإشارة لزميل"), {
      target: { value: "تعليق جديد" }
    });
    fireEvent.click(screen.getByRole("button", { name: "نشر التعليق" }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith({ body: "تعليق جديد" }));
  });

  test("renders existing comments with a delete action", () => {
    render(
      <LocaleProvider initialLocale="ar" hasLocaleCookie={false}>
        <RecordCommentsPanel comments={[comment()]} loading={false} error={null} onCreate={vi.fn()} onDelete={vi.fn()} />
      </LocaleProvider>
    );
    expect(screen.getByText("تعليق")).toBeInTheDocument();
    expect(screen.getByText("سارة")).toBeInTheDocument();
  });

  test("shows the empty state when there are no comments", () => {
    render(
      <LocaleProvider initialLocale="ar" hasLocaleCookie={false}>
        <RecordCommentsPanel comments={[]} loading={false} error={null} onCreate={vi.fn()} onDelete={vi.fn()} />
      </LocaleProvider>
    );
    expect(screen.getByText("لا توجد تعليقات بعد")).toBeInTheDocument();
  });
});

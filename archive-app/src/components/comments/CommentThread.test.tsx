/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { CommentThread } from "./CommentThread.jsx";

vi.mock("../forms/TagAutocomplete.jsx", () => ({
  TagAutocomplete: ({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder?: string }) => (
    <textarea
      aria-label={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}));

describe("CommentThread", () => {
  it("renders an empty state and disables submit until text is entered", () => {
    const onSubmit = vi.fn();
    const onDraftChange = vi.fn();

    render(
      <CommentThread
        comments={[]}
        draft=""
        onDraftChange={onDraftChange}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByText("لا توجد تعليقات بعد.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "إرسال" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("اكتب ملاحظة للفريق حول هذه المادة..."), {
      target: { value: "ملاحظة مهمة" }
    });

    expect(onDraftChange).toHaveBeenCalledWith("ملاحظة مهمة");
  });

  it("shows comments and exposes delete for the author", () => {
    const onRemove = vi.fn();

    render(
      <CommentThread
        comments={[{
          id: "c1",
          userId: "u1",
          author: "سارة",
          text: "راجعوا المقطع الأخير.",
          createdAt: "2026-06-19T08:00:00.000Z"
        }]}
        currentUser={{ id: "u1", role: "viewer" }}
        draft="رد"
        onDraftChange={vi.fn()}
        onSubmit={vi.fn()}
        onRemove={onRemove}
      />
    );

    expect(screen.getByText("سارة")).toBeInTheDocument();
    expect(screen.getByText("راجعوا المقطع الأخير.")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("حذف التعليق"));

    expect(onRemove).toHaveBeenCalledWith(expect.objectContaining({ id: "c1" }));
  });
});

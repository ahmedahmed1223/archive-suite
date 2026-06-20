// @vitest-environment jsdom
import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { bookmarkTimeToSeconds, TimeBookmarkList } from "./TimeBookmarks.jsx";

describe("time bookmark editing", () => {
  it("parses editable timecodes", () => {
    expect(bookmarkTimeToSeconds("01:23")).toBe(83);
    expect(bookmarkTimeToSeconds("1:02:03")).toBe(3723);
    expect(bookmarkTimeToSeconds("1:99")).toBeNull();
  });

  it("edits time, title, and a long note without deleting the bookmark", () => {
    const onUpdate = vi.fn();
    const onDelete = vi.fn();
    render(<TimeBookmarkList bookmarks={[{ id: "b1", time: 10, title: "قديم", note: "ملاحظة طويلة" }]} onUpdate={onUpdate} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole("button", { name: "تحرير العلامة الزمنية: قديم" }));
    fireEvent.change(screen.getByLabelText("وقت العلامة الزمنية"), { target: { value: "01:23" } });
    fireEvent.change(screen.getByLabelText("عنوان العلامة الزمنية"), { target: { value: "عنوان جديد" } });
    fireEvent.change(screen.getByLabelText("ملاحظة العلامة الزمنية"), { target: { value: "ملاحظة طويلة محفوظة بعد التحرير" } });
    fireEvent.click(screen.getByRole("button", { name: "حفظ التعديل" }));
    expect(onUpdate).toHaveBeenCalledWith("b1", { time: 83, title: "عنوان جديد", note: "ملاحظة طويلة محفوظة بعد التحرير" });
    expect(onDelete).not.toHaveBeenCalled();
  });
});

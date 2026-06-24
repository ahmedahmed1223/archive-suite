/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BatchFixToolbar } from "../BatchFixToolbar.jsx";
import { useSavedViews } from "../../../hooks/useSavedViews.js";
import { renderHook, act } from "@testing-library/react";

// ─── helpers ────────────────────────────────────────────────────────────────

const CONTENT_TYPES = [
  { id: "video", name: "فيديو" },
  { id: "audio", name: "صوت" },
];

const VIDEO_ITEMS = [
  { id: "a1", title: "مقطع أول", workflowStatus: "draft", type: "video", version: 1 },
  { id: "a2", title: "مقطع ثانٍ", workflowStatus: "editing", type: "audio", version: 2 },
];

function makeProps(overrides = {}) {
  return {
    selectedItems: ["a1", "a2"],
    videoItems: VIDEO_ITEMS,
    contentTypes: CONTENT_TYPES,
    updateVideoItem: vi.fn().mockResolvedValue(undefined),
    showToast: vi.fn(),
    onClear: vi.fn(),
    ...overrides,
  };
}

// ─── BatchFixToolbar tests ───────────────────────────────────────────────────

describe("BatchFixToolbar", () => {
  it("renders when selectedItems is non-empty", () => {
    render(<BatchFixToolbar {...makeProps()} />);
    expect(screen.getByRole("region", { name: /تحرير العناصر المحددة/i })).toBeInTheDocument();
  });

  it("is hidden (returns null) when no items are selected", () => {
    const { container } = render(<BatchFixToolbar {...makeProps({ selectedItems: [] })} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows the count of selected items in the badge", () => {
    render(<BatchFixToolbar {...makeProps({ selectedItems: ["a1", "a2"] })} />);
    expect(screen.getByText(/تحرير المحدد \(2\)/)).toBeInTheDocument();
  });

  it("Apply button is disabled when no dropdown value is chosen", () => {
    render(<BatchFixToolbar {...makeProps()} />);
    expect(screen.getByRole("button", { name: /تطبيق التعديلات على العناصر المحددة/i })).toBeDisabled();
  });

  it("dispatches updateVideoItem for each selected item when status is changed and Apply clicked", async () => {
    const user = userEvent.setup();
    const updateVideoItem = vi.fn().mockResolvedValue(undefined);
    const showToast = vi.fn();

    render(
      <BatchFixToolbar
        {...makeProps({ updateVideoItem, showToast })}
      />
    );

    // Change status dropdown
    const statusSelect = screen.getByLabelText(/الحالة/i);
    await user.selectOptions(statusSelect, "approved");

    // Apply
    const applyBtn = screen.getByRole("button", { name: /تطبيق التعديلات على العناصر المحددة/i });
    await user.click(applyBtn);

    await waitFor(() => {
      expect(updateVideoItem).toHaveBeenCalledTimes(2);
    });

    // Both calls should include workflowStatus: "approved"
    expect(updateVideoItem.mock.calls[0][0]).toMatchObject({ workflowStatus: "approved" });
    expect(updateVideoItem.mock.calls[1][0]).toMatchObject({ workflowStatus: "approved" });
  });

  it("calls showToast with success message after applying", async () => {
    const user = userEvent.setup();
    const showToast = vi.fn();

    render(<BatchFixToolbar {...makeProps({ showToast })} />);

    const statusSelect = screen.getByLabelText(/الحالة/i);
    await user.selectOptions(statusSelect, "review");

    await user.click(screen.getByRole("button", { name: /تطبيق التعديلات على العناصر المحددة/i }));

    await waitFor(() => {
      expect(showToast).toHaveBeenCalledWith(
        expect.stringMatching(/تم تحديث/),
        "success"
      );
    });
  });

  it("calls onClear when the dismiss button is clicked", async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();

    render(<BatchFixToolbar {...makeProps({ onClear })} />);

    await user.click(screen.getByRole("button", { name: /إغلاق شريط التحرير/i }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("changes type for all selected items when type dropdown is changed and applied", async () => {
    const user = userEvent.setup();
    const updateVideoItem = vi.fn().mockResolvedValue(undefined);

    render(<BatchFixToolbar {...makeProps({ updateVideoItem })} />);

    const typeSelect = screen.getByLabelText(/النوع/i);
    await user.selectOptions(typeSelect, "audio");

    await user.click(screen.getByRole("button", { name: /تطبيق التعديلات على العناصر المحددة/i }));

    await waitFor(() => {
      expect(updateVideoItem).toHaveBeenCalledTimes(2);
    });
    expect(updateVideoItem.mock.calls[0][0]).toMatchObject({ type: "audio", subtype: "" });
  });
});

// ─── useSavedViews tests ─────────────────────────────────────────────────────

describe("useSavedViews", () => {
  const STORAGE_KEY = "archive:savedViews";

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("starts with an empty list when localStorage is empty", () => {
    const { result } = renderHook(() => useSavedViews());
    expect(result.current.savedViews).toEqual([]);
  });

  it("saves a view and returns it in the list", () => {
    const { result } = renderHook(() => useSavedViews());

    act(() => {
      result.current.saveView("عرض المراجعة", { sortBy: "title", sortDir: "asc" });
    });

    expect(result.current.savedViews).toHaveLength(1);
    expect(result.current.savedViews[0].name).toBe("عرض المراجعة");
    expect(result.current.savedViews[0].sortBy).toBe("title");
  });

  it("persists the saved view to localStorage", () => {
    const { result } = renderHook(() => useSavedViews());

    act(() => {
      result.current.saveView("عرض ثانٍ", { filters: { status: "approved" } });
    });

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe("عرض ثانٍ");
  });

  it("deletes a view by id", () => {
    const { result } = renderHook(() => useSavedViews());

    act(() => {
      result.current.saveView("سيُحذف");
    });
    const id = result.current.savedViews[0].id;

    act(() => {
      result.current.deleteView(id);
    });

    expect(result.current.savedViews).toHaveLength(0);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    expect(stored).toHaveLength(0);
  });

  it("replaces a view with the same name on save", () => {
    const { result } = renderHook(() => useSavedViews());

    act(() => {
      result.current.saveView("عرضي", { sortBy: "title" });
    });
    act(() => {
      result.current.saveView("عرضي", { sortBy: "updatedAt" });
    });

    expect(result.current.savedViews).toHaveLength(1);
    expect(result.current.savedViews[0].sortBy).toBe("updatedAt");
  });

  it("loads existing views from localStorage on mount", () => {
    const existingViews = [
      { id: "sv_abc", name: "عرض موجود", columns: null, sortBy: "title", sortDir: "asc", filters: {}, createdAt: "2026-01-01T00:00:00.000Z" },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existingViews));

    const { result } = renderHook(() => useSavedViews());
    expect(result.current.savedViews).toHaveLength(1);
    expect(result.current.savedViews[0].name).toBe("عرض موجود");
  });
});

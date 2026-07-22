// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { BulkMacroRecorder } from "./BulkMacroRecorder";

afterEach(cleanup);

function apiFixture() {
  return {
    bulkMacros: vi.fn().mockResolvedValue({ ok: true, macros: [] }),
    createBulkMacro: vi.fn().mockResolvedValue({ ok: true, macro: { id: "m1", name: "وسم", version: 1, steps: [{ type: "add-tag", tag: "مهم" }], createdAt: null, updatedAt: null } }),
    updateBulkMacro: vi.fn(), deleteBulkMacro: vi.fn().mockResolvedValue({ ok: true, deleted: true }),
    bulkMacroRuns: vi.fn().mockResolvedValue({ ok: true, runs: [] }),
    previewBulkMacro: vi.fn().mockResolvedValue({ ok: true, previewToken: "signed", expiresAt: "2026-07-22T15:00:00Z", summary: { affectedCount: 1, missingCount: 0, targetCount: 1 }, results: [{ store: "main", id: "1", status: "ready", steps: [{ index: 0, type: "add-tag", status: "would_apply", reversible: true }] }] }),
    runBulkMacro: vi.fn().mockResolvedValue({ ok: true, run: { id: "r1", macroId: "m1", macroVersion: 1, targetCount: 1, completedCount: 1, failedCount: 0, targets: [], results: [], createdAt: null } })
  };
}

describe("BulkMacroRecorder", () => {
  test("does not issue a run before preview and invalidates it after targets change", async () => {
    const api = apiFixture();
    const { rerender } = render(<BulkMacroRecorder api={api as never} targets={[{ store: "main", id: "1" }]} />);
    fireEvent.change(screen.getByRole("textbox", { name: "اسم الماكرو" }), { target: { value: "وسم" } });
    fireEvent.change(screen.getByRole("textbox", { name: "الوسم الجديد" }), { target: { value: "مهم" } });
    fireEvent.click(screen.getByRole("button", { name: "إضافة وسم" }));
    fireEvent.click(screen.getByRole("button", { name: "حفظ الماكرو" }));
    await waitFor(() => expect(api.createBulkMacro).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole("button", { name: "معاينة التنفيذ" })).not.toBeDisabled());
    expect(screen.getByRole("button", { name: "تنفيذ الماكرو" })).toBeDisabled();
    expect(api.runBulkMacro).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "معاينة التنفيذ" }));
    await waitFor(() => expect(api.previewBulkMacro).toHaveBeenCalled());
    expect(screen.getByRole("button", { name: "تنفيذ الماكرو" })).not.toBeDisabled();
    expect(screen.getByText(/قابل للتراجع/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "تنفيذ الماكرو" }));
    await waitFor(() => expect(api.runBulkMacro).toHaveBeenCalledWith("m1", expect.objectContaining({ previewToken: "signed" }), undefined));
    expect(screen.getByText(/نتيجة التنفيذ/)).toBeTruthy();
    rerender(<BulkMacroRecorder api={api as never} targets={[{ store: "main", id: "2" }]} />);
    expect(screen.getByRole("button", { name: "تنفيذ الماكرو" })).toBeDisabled();
  });
});

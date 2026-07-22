// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { BulkMacroRecorder } from "./BulkMacroRecorder";

afterEach(cleanup);

const detailedResult = { store: "main", id: "1", status: "completed", steps: [{ index: 0, type: "add-tag", status: "completed", reversible: true, before: ["قديم"], after: ["قديم", "مهم"], reason: "mutation_failed" }] };
const detailedRun = { id: "r1", macroId: "m1", macroVersion: 1, targetCount: 1, completedCount: 1, failedCount: 0, targets: [{ store: "main", id: "1" }], results: [detailedResult], createdAt: null };

function apiFixture() {
  const macro = { id: "m1", name: "وسم", version: 1, steps: [{ type: "add-tag", tag: "مهم" }], createdAt: null, updatedAt: null };
  return {
    bulkMacros: vi.fn().mockResolvedValue({ ok: true, macros: [] }),
    createBulkMacro: vi.fn().mockResolvedValue({ ok: true, macro }),
    updateBulkMacro: vi.fn().mockImplementation((_id, payload) => Promise.resolve({ ok: true, macro: { ...macro, ...payload, version: 2 } })), deleteBulkMacro: vi.fn().mockResolvedValue({ ok: true, deleted: true }),
    bulkMacroRuns: vi.fn().mockResolvedValue({ ok: true, runs: [] }),
    previewBulkMacro: vi.fn().mockResolvedValue({ ok: true, previewToken: "signed", expiresAt: "2099-07-22T15:00:00Z", summary: { affectedCount: 1, missingCount: 0, targetCount: 1 }, results: [detailedResult] }),
    runBulkMacro: vi.fn().mockResolvedValue({ ok: true, run: detailedRun })
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

  test("requires saving definition and name edits and clears a prior preview after name-only save", async () => {
    const api = apiFixture();
    render(<BulkMacroRecorder api={api as never} targets={[{ store: "main", id: "1" }]} />);
    fireEvent.change(screen.getByRole("textbox", { name: "اسم الماكرو" }), { target: { value: "وسم" } });
    fireEvent.change(screen.getByRole("textbox", { name: "الوسم الجديد" }), { target: { value: "مهم" } });
    fireEvent.click(screen.getByRole("button", { name: "إضافة وسم" }));
    fireEvent.click(screen.getByRole("button", { name: "حفظ الماكرو" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "معاينة التنفيذ" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "معاينة التنفيذ" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "تنفيذ الماكرو" })).toBeEnabled());
    fireEvent.change(screen.getByRole("textbox", { name: "اسم الماكرو" }), { target: { value: "اسم معدل" } });
    expect(screen.getByRole("button", { name: "معاينة التنفيذ" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "تنفيذ الماكرو" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "حفظ الماكرو" }));
    await waitFor(() => expect(api.updateBulkMacro).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText("معاينة موقعة", { exact: true })).toBeNull());
  });

  test("automatically disables execution when a preview reaches its expiry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-01T00:00:00Z"));
    const api = apiFixture();
    api.bulkMacros.mockResolvedValue({ ok: true, macros: [{ id: "m1", name: "وسم", version: 1, steps: [{ type: "add-tag", tag: "مهم" }], createdAt: null, updatedAt: null }] });
    api.previewBulkMacro.mockResolvedValue({ ok: true, previewToken: "short-lived", expiresAt: new Date(Date.now() + 60_000).toISOString(), summary: { affectedCount: 1, missingCount: 0, targetCount: 1 }, results: [] });
    try {
      render(<BulkMacroRecorder api={api as never} targets={[{ store: "main", id: "1" }]} />);
      await act(async () => { await Promise.resolve(); });
      fireEvent.change(screen.getByRole("combobox", { name: "الماكرو المحفوظ" }), { target: { value: "m1" } });
      fireEvent.click(screen.getByRole("button", { name: "معاينة التنفيذ" }));
      await act(async () => { await Promise.resolve(); });
      expect(screen.getByRole("button", { name: "تنفيذ الماكرو" })).toBeEnabled();
      await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
      expect(screen.getByRole("alert")).toHaveTextContent("انتهت صلاحية المعاينة");
      expect(screen.getByRole("button", { name: "تنفيذ الماكرو" })).toBeDisabled();
    } finally {
      vi.useRealTimers();
    }
  });

  test("guards duplicate preview and run submissions and renders detailed immediate/history results", async () => {
    const api = apiFixture();
    api.bulkMacros.mockResolvedValue({ ok: true, macros: [{ id: "m1", name: "حالة", version: 1, steps: [{ type: "set-workflow-status", status: "review" }], createdAt: null, updatedAt: null }] });
    api.bulkMacroRuns.mockResolvedValue({ ok: true, runs: [detailedRun] });
    render(<BulkMacroRecorder api={api as never} targets={[{ store: "main", id: "1" }]} />);
    await waitFor(() => expect(screen.getByRole("option", { name: "حالة" })).toBeTruthy());
    fireEvent.change(screen.getByRole("combobox", { name: "الماكرو المحفوظ" }), { target: { value: "m1" } });
    await waitFor(() => expect(screen.getByText("تعيين الحالة: قيد المراجعة")).toBeTruthy());
    const previewButton = screen.getByRole("button", { name: "معاينة التنفيذ" }); fireEvent.click(previewButton); fireEvent.click(previewButton);
    await waitFor(() => expect(api.previewBulkMacro).toHaveBeenCalledTimes(1));
    const runButton = await screen.findByRole("button", { name: "تنفيذ الماكرو" }); fireEvent.click(runButton); fireEvent.click(runButton);
    await waitFor(() => expect(api.runBulkMacro).toHaveBeenCalledTimes(1));
    expect(screen.getAllByText("قبل").length).toBeGreaterThan(0);
    expect(screen.getAllByText("بعد").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/السبب: تعذر تطبيق التغيير/).length).toBeGreaterThan(0);
    expect(screen.getByRole("article", { name: "تشغيل محفوظ 1" })).toHaveTextContent("قابل للتراجع");
    expect(screen.getByRole("option", { name: "قيد المراجعة" })).toHaveValue("review");
  });

  test("renders a localized target_failed reason in persisted history details", async () => {
    const api = apiFixture();
    const failedRun = { ...detailedRun, id: "failed-run", failedCount: 1, completedCount: 0, results: [{ ...detailedResult, status: "failed", reason: "target_failed", steps: [] }] };
    api.bulkMacros.mockResolvedValue({ ok: true, macros: [{ id: "m1", name: "فشل محفوظ", version: 1, steps: [{ type: "delete" }], createdAt: null, updatedAt: null }] });
    api.bulkMacroRuns.mockResolvedValue({ ok: true, runs: [failedRun] });
    render(<BulkMacroRecorder api={api as never} targets={[{ store: "main", id: "1" }]} />);
    await waitFor(() => expect(screen.getByRole("option", { name: "فشل محفوظ" })).toBeTruthy());
    fireEvent.change(screen.getByRole("combobox", { name: "الماكرو المحفوظ" }), { target: { value: "m1" } });
    const historyResult = await screen.findByRole("article", { name: "تشغيل محفوظ 1" });
    expect(historyResult).toHaveTextContent("سبب نتيجة السجل: تعذرت معالجة السجل");
    expect(historyResult).not.toHaveTextContent("target_failed");
  });
});

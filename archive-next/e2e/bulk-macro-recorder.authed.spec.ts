import { expect, test } from "./fixtures/auth";

test("editor must preview a saved macro before it can run, and selection changes invalidate it", async ({ roleSession }) => {
  const { page } = await roleSession("editor");
  let runs = 0;
  await page.route("**/api/v1/bulk-macros**", async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    const body = url.endsWith("/runs") && method === "GET" ? { ok: true, runs: [] }
      : method === "GET" ? { ok: true, macros: [] }
      : url.endsWith("/preview") ? { ok: true, previewToken: "signed", expiresAt: "2026-07-22T16:00:00Z", summary: { affectedCount: 1, missingCount: 0, targetCount: 1 }, results: [{ store: "main", id: "record-1", status: "ready", steps: [{ index: 0, type: "add-tag", status: "would_apply", reversible: true }, { index: 1, type: "delete", status: "would_apply", reversible: true }] }] }
      : url.endsWith("/run") ? (runs += 1, { ok: true, run: { id: "r1", macroId: "m1", macroVersion: 1, targetCount: 1, completedCount: 1, failedCount: 0, targets: [], results: [], createdAt: null } })
      : { ok: true, macro: { id: "m1", name: "وسم مهم", version: 1, steps: [{ type: "add-tag", tag: "مهم" }], createdAt: null, updatedAt: null } };
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto("/archive");
  const selectedRecord = page.getByRole("checkbox", { name: "تحديد سجل editor المعزول" });
  await selectedRecord.check();
  let recorder = page.getByRole("region", { name: "مسجل الإجراءات الجماعية" });
  await expect(recorder.getByRole("heading", { name: "مسجل الإجراءات الجماعية" })).toBeVisible();
  await recorder.getByRole("textbox", { name: "اسم الماكرو" }).fill("وسم مهم");
  await recorder.getByRole("textbox", { name: "الوسم الجديد" }).fill("مهم");
  await recorder.getByRole("button", { name: "إضافة وسم" }).click();
  await recorder.getByRole("button", { name: "إضافة حالة" }).click();
  await recorder.getByRole("button", { name: "إضافة حذف" }).click();
  await recorder.getByRole("button", { name: "نقل الخطوة 3 للأعلى" }).click();
  await recorder.getByRole("button", { name: "إزالة الخطوة 2" }).click();
  await recorder.getByRole("button", { name: "حفظ الماكرو" }).click();
  await expect(recorder.getByText("تم حفظ الماكرو.")).toBeVisible();
  await expect(recorder.getByRole("button", { name: "تنفيذ الماكرو" })).toBeDisabled();
  expect(runs).toBe(0);
  await recorder.getByRole("button", { name: "معاينة التنفيذ" }).click();
  await expect(recorder.getByText("معاينة موقعة")).toBeVisible();
  await expect(recorder.getByText("قابل للتراجع").first()).toBeVisible();
  await expect(recorder.getByRole("button", { name: "تنفيذ الماكرو" })).toBeEnabled();
  await selectedRecord.uncheck();
  await expect(recorder).toHaveCount(0);
  await selectedRecord.check();
  recorder = page.getByRole("region", { name: "مسجل الإجراءات الجماعية" });
  await expect(recorder.getByRole("button", { name: "تنفيذ الماكرو" })).toBeDisabled();
  await recorder.getByRole("button", { name: "معاينة التنفيذ" }).click();
  await expect(recorder.getByRole("button", { name: "تنفيذ الماكرو" })).toBeEnabled();
  await recorder.getByRole("button", { name: "تنفيذ الماكرو" }).click();
  await expect(recorder.getByText(/نتيجة التنفيذ/)).toBeVisible();
  expect(runs).toBe(1);
});

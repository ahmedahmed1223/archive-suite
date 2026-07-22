import { expect, test } from "./fixtures/auth";

test("editor must preview a saved macro before it can run, and selection changes invalidate it", async ({ roleSession }) => {
  const { page } = await roleSession("editor");
  let runs = 0;
  await page.route("**/api/v1/bulk-macros**", async (route) => {
    const url = route.request().url();
    const method = route.request().method();
    const body = method === "GET" ? { ok: true, macros: [] }
      : url.endsWith("/preview") ? { ok: true, previewToken: "signed", expiresAt: "2026-07-22T16:00:00Z", summary: { affectedCount: 1, missingCount: 0, targetCount: 1 }, results: [] }
      : url.endsWith("/run") ? (runs += 1, { ok: true, run: { id: "r1", macroId: "m1", macroVersion: 1, targetCount: 1, completedCount: 1, failedCount: 0, targets: [], results: [], createdAt: null } })
      : { ok: true, macro: { id: "m1", name: "وسم مهم", version: 1, steps: [{ type: "add-tag", tag: "مهم" }], createdAt: null, updatedAt: null } };
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
  });
  await page.goto("/archive");
  await page.locator("[role=listitem]").first().click();
  await expect(page.getByRole("heading", { name: "مسجل الإجراءات الجماعية" })).toBeVisible();
  await expect(page.getByRole("button", { name: "تنفيذ الماكرو" })).toBeDisabled();
  expect(runs).toBe(0);
});

import { expect, test } from "@playwright/test";

test("runs the Arabic synthetic safety preview without requesting live destructive endpoints", async ({ page }) => {
  const apiRequests: string[] = [];
  // The Next proxy protects workspace routes before client-side refresh can run.
  await page.context().addCookies([{ name: "va_session", value: "synthetic-e2e-session", url: "http://127.0.0.1:3000" }]);
  await page.route("**/api/v1/**", async (route) => {
    const url = route.request().url();
    apiRequests.push(url);
    if (url.endsWith("/auth/refresh")) {
      await route.fulfill({ json: { ok: true, user: { id: "editor-1", name: "محرر", email: "editor@example.test", role: "editor" }, accessToken: "token-abc", expiresAt: "2030-07-22T13:00:00.000Z" } });
      return;
    }
    if (url.endsWith("/safety-preview/scenarios")) {
      await route.fulfill({ json: { ok: true, synthetic: true, scenarios: ["bulk-delete-basic", "restore-conflict"] } });
      return;
    }
    if (url.endsWith("/safety-preview/run")) {
      await route.fulfill({ json: { ok: true, synthetic: true, scenario: "restore-conflict", operation: "restore", expiresAt: "2026-07-22T13:00:00.000Z", before: { live: 8, trash: 3 }, after: { live: 9, trash: 2 }, results: [{ id: "restore-ok", deleted: false, restored: true }, { id: "restore-conflict", deleted: false, restored: false, reason: "conflict" }, { id: "missing", deleted: false, restored: false, reason: "not_found" }] } });
      return;
    }
    await route.fulfill({ status: 404, json: { ok: false, error: "طلب غير متوقع" } });
  });

  await page.goto("/safety-preview");
  await expect(page.getByText("مساحة معاينة السلامة")).toBeVisible();
  await expect(page.getByText("synthetic: true").first()).toBeVisible();
  const releaseNotes = page.getByRole("dialog", { name: "ما الجديد في مسار" });
  if (await releaseNotes.isVisible()) await releaseNotes.getByRole("button", { name: "إغلاق" }).click();
  await page.getByLabel("السيناريو").selectOption("restore-conflict");
  await page.getByRole("button", { name: "تشغيل المحاكاة" }).click();

  await expect(page.getByLabel("نتائج عناصر المحاكاة")).toContainText("تعارض");
  await expect(page.getByLabel("نتائج عناصر المحاكاة")).toContainText("غير موجود");
  expect(apiRequests.some((url) => /\/(records\/bulk-delete|trash|restore)(?:[/?]|$)/.test(new URL(url).pathname))).toBe(false);
  const previewRequests = apiRequests
    .filter((url) => new URL(url).pathname.includes("/safety-preview/"))
    .map((url) => new URL(url).pathname);
  expect(previewRequests).toContain("/api/v1/safety-preview/scenarios");
  expect(previewRequests.filter((path) => path === "/api/v1/safety-preview/run")).toHaveLength(1);
  expect(previewRequests.every((path) => path === "/api/v1/safety-preview/scenarios" || path === "/api/v1/safety-preview/run")).toBe(true);
});

import { expect, test } from "./fixtures/auth";

/**
 * V3-VOCAB-001: applies the "Broadcast & TV Programming" archive-pattern
 * template end to end against a clean instance (no existing types,
 * templates, or tags), then confirms a second apply against the same state
 * is idempotent — every item previews as "already exists" and no create
 * endpoint is called again.
 *
 * Requires the live Laravel + Next gate: `pnpm verify:laravel-next:live`
 * (not runnable in this sandbox — see the task report for details). Network
 * calls are still mocked via page.route(), matching the existing convention
 * in e2e/bulk-macro-recorder.authed.spec.ts: the login/session is real, the
 * vocabulary endpoints are not.
 */
test("editor previews and applies the broadcast pattern template, then a repeat apply creates nothing", async ({ roleSession }) => {
  const { page } = await roleSession("editor");

  let typeCreated = false;
  const createdTags: string[] = [];
  let templateCreated = false;

  await page.route("**/api/v1/types**", async (route) => {
    const method = route.request().method();
    if (method === "POST") {
      typeCreated = true;
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, type: { id: "pattern-broadcast-program", name: "برنامج تلفزيوني", fields: [] } }) });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, types: typeCreated ? [{ id: "pattern-broadcast-program", name: "برنامج تلفزيوني", fields: [] }] : [], nextCursor: null }),
    });
  });

  await page.route("**/api/v1/metadata-templates**", async (route) => {
    const method = route.request().method();
    if (method === "POST") {
      templateCreated = true;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ ok: true, template: { id: "tpl-1", typeId: "pattern-broadcast-program", departmentId: "general", name: "قالب بيانات برنامج تلفزيوني", fields: {}, tags: [], enabled: false, usageRoles: [], currentVersion: 1, createdById: null, updatedById: null, publishedVersion: null, publishedById: null, publishedAt: null, createdAt: "", updatedAt: "" } }),
      });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        templates: templateCreated ? [{ id: "tpl-1", typeId: "pattern-broadcast-program", departmentId: "general", name: "قالب بيانات برنامج تلفزيوني", fields: {}, tags: [], enabled: false, usageRoles: [], currentVersion: 1, createdById: null, updatedById: null, publishedVersion: null, publishedById: null, publishedAt: null, createdAt: "", updatedAt: "" }] : [],
      }),
    });
  });

  await page.route("**/api/v1/tag-nodes**", async (route) => {
    const method = route.request().method();
    if (method === "POST") {
      const body = route.request().postDataJSON() as { tag: string; parent: string };
      createdTags.push(body.tag);
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, node: { id: `n-${createdTags.length}`, tag: body.tag, parent: body.parent, color: null, order: 0, icon: null, createdAt: null, updatedAt: null } }) });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ ok: true, nodes: createdTags.map((tag, index) => ({ id: `n-${index + 1}`, tag, parent: tag === "بث تلفزيوني" ? "" : "بث تلفزيوني", color: null, order: 0, icon: null, createdAt: null, updatedAt: null })) }),
    });
  });

  await page.goto("/types");
  await page.getByRole("button", { name: "قوالب أنماط الأرشيف" }).click();

  await page.getByText("البث التلفزيوني والبرامج").click();
  await expect(page.getByText("سيُنشأ").first()).toBeVisible();

  await page.getByLabel(/معرّف القسم المالك/).fill("general");
  await page.getByRole("button", { name: "تطبيق القالب" }).click();

  await expect(page.getByText(/تم التطبيق/)).toBeVisible();
  expect(typeCreated).toBe(true);
  expect(templateCreated).toBe(true);
  expect(createdTags).toHaveLength(3);

  // Idempotency: close, reopen, pick the same template again — everything
  // this run created is now visible to the preview, so nothing is "سيُنشأ".
  await page.getByRole("button", { name: "إغلاق" }).click();
  await page.getByRole("button", { name: "قوالب أنماط الأرشيف" }).click();
  await page.getByText("البث التلفزيوني والبرامج").click();

  await expect(page.getByText("كل عناصر هذا القالب موجودة بالفعل — لا شيء لتطبيقه.")).toBeVisible();
  await expect(page.getByRole("button", { name: "تطبيق القالب" })).toBeDisabled();
});

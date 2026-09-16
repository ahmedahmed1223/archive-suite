import type { Page } from '@playwright/test';

/**
 * The `no-permission` route state, shared by the axe gate and the visual gate
 * so both refuse the same way. One definition, because two copies of a stub
 * drift and then the two gates are auditing different screens.
 *
 * This is the exact envelope Laravel returns from
 * Controller::requireEditor/requireAdmin — `ApiError::envelope('Forbidden.',
 * 403)` — so a page that reads `code` to tell a refusal from a fault sees in
 * the gate what it sees in production.
 */
export const FORBIDDEN_ENVELOPE = { ok: false, code: 'FORBIDDEN', error: 'Forbidden.' } as const;

/**
 * Answers 403 to every API call except the session bootstrap. Without that
 * exception the app falls back to the guest shell and the gate would be
 * auditing the login redirect rather than the refusal surface.
 */
export async function stubForbiddenApi(page: Page): Promise<void> {
  await page.route('**/api/v1/**', async (route) => {
    if (/\/auth\/(refresh|me|login)/.test(route.request().url())) {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify(FORBIDDEN_ENVELOPE),
    });
  });
}

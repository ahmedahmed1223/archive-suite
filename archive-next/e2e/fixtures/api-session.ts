import { expect } from '@playwright/test';
import type { APIResponse, Page } from '@playwright/test';

/**
 * An authenticated API client for a role's page.
 *
 * `page.request` carries the browser context's cookies but not the SPA's
 * in-memory bearer token, and the app rotates `va_refresh` every time it
 * boots. A spec that posts through `page.request` alone therefore works only
 * while its cookie happens to be the current one — which made several specs
 * quietly order-dependent: green when they ran before anything that loaded a
 * page, 401 afterwards. Minting a token the way the app itself does removes
 * the ordering from the equation.
 */
export async function apiFor(page: Page) {
  const response = await page.request.post('/api/v1/auth/refresh');
  const raw = await response.text();

  let payload: { ok?: boolean; error?: string; accessToken?: string };
  try {
    payload = JSON.parse(raw) as typeof payload;
  } catch {
    throw new Error(`mint access token: non-JSON response (${response.status()}) — ${raw.slice(0, 300)}`);
  }

  if (!response.ok() || payload.ok === false || typeof payload.accessToken !== 'string') {
    throw new Error(`mint access token: ${response.status()} — ${payload.error ?? raw.slice(0, 300)}`);
  }

  const headers = { Authorization: `Bearer ${payload.accessToken}` };

  return {
    get: (url: string) => page.request.get(url, { headers }),
    post: (url: string, data?: unknown) =>
      page.request.post(url, data === undefined ? { headers } : { headers, data }),
    patch: (url: string, data: unknown) => page.request.patch(url, { headers, data }),
    delete: (url: string) => page.request.delete(url, { headers }),
  };
}

export type ApiSession = Awaited<ReturnType<typeof apiFor>>;

/** Reads an ok envelope, or fails with the status and the server's own message. */
export async function envelope<T>(label: string, response: APIResponse): Promise<T> {
  const raw = await response.text();

  let payload: { ok?: boolean; error?: string };
  try {
    payload = JSON.parse(raw) as typeof payload;
  } catch {
    throw new Error(`${label}: non-JSON response (${response.status()}) — ${raw.slice(0, 300)}`);
  }

  if (!response.ok() || payload.ok === false) {
    throw new Error(`${label}: ${response.status()} — ${payload.error ?? raw.slice(0, 300)}`);
  }

  return payload as T;
}

/** Asserts a response succeeded, naming the status and body when it did not. */
export async function expectOk(label: string, response: APIResponse): Promise<void> {
  if (response.ok()) return;
  const raw = await response.text();
  expect(response.ok(), `${label}: ${response.status()} — ${raw.slice(0, 300)}`).toBe(true);
}

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test as base, expect } from '@playwright/test';
import { WHATS_NEW_RELEASE, WHATS_NEW_STORAGE_KEY } from '../../lib/whats-new';
import type { BrowserContext, Page } from '@playwright/test';
import {
  PROVISION_MANIFEST_PATH,
  ROLE_ACCOUNTS,
  type ProvisionManifest,
  type RoleAccount,
  type RoleData,
  type RoleName,
  storageStatePath,
} from './roles';

/**
 * V1-303B: per-role Playwright fixtures.
 *
 * `roleSession('editor')` hands back a page already carrying the editor's own
 * `va_refresh` cookie (minted by the editor's own login in global-setup) plus
 * the editor's own isolated data identities. No spec is handed an admin token
 * it did not earn — the role you ask for is the role you get.
 */

let cachedManifest: ProvisionManifest | null = null;
const roleContexts = new Map<RoleName, BrowserContext>();

function manifest(): ProvisionManifest {
  if (cachedManifest) return cachedManifest;

  const file = path.resolve(PROVISION_MANIFEST_PATH);

  try {
    cachedManifest = JSON.parse(readFileSync(file, 'utf8')) as ProvisionManifest;
  } catch (error) {
    throw new Error(
      `V1-303B provision manifest missing at ${file}. It is written by e2e/auth.setup.ts, ` +
        'which needs a live Laravel API (run via `pnpm verify:laravel-next:live`). ' +
        `Underlying error: ${(error as Error).message}`,
    );
  }

  return cachedManifest;
}

export interface RoleSession {
  readonly account: RoleAccount;
  readonly data: RoleData;
  readonly page: Page;
  readonly context: BrowserContext;
}

export interface RoleFixtures {
  /** Opens an isolated browser context authenticated as exactly this role. */
  roleSession: (role: RoleName) => Promise<RoleSession>;
}

export const test = base.extend<RoleFixtures>({
  roleSession: async ({ browser }, use) => {
    const openedPages: Page[] = [];
    const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000';

    await use(async (role: RoleName) => {
      let context = roleContexts.get(role);
      if (!context) {
        context = await browser.newContext({ baseURL, storageState: storageStatePath(role) });
        roleContexts.set(role, context);

        // Fresh contexts would otherwise trigger the modal whats-new dialog,
        // which makes every background element invisible to role queries.
        // shouldShowWhatsNew is a strict equality check, so the stored value
        // must be the real current release.
        await context.addInitScript(
          ([key, release]) => {
            window.localStorage.setItem(key, release);
          },
          [WHATS_NEW_STORAGE_KEY, WHATS_NEW_RELEASE] as const,
        );
      }

      // Refresh rotates the cookie. Reusing the role's worker-local context
      // preserves that newly issued cookie for its next page, avoiding a fresh
      // login for every a11y state while keeping each role fully isolated.
      const account = ROLE_ACCOUNTS[role];
      const cookies = await context.cookies(baseURL);
      if (!cookies.some((cookie) => cookie.name === 'va_session')) {
        throw new Error(`roleSession(${role}): provisioned storage state has no va_session for ${baseURL}`);
      }

      const page = await context.newPage();
      openedPages.push(page);

      return {
        account,
        data: manifest().roles[role],
        page,
        context,
      };
    });

    for (const page of openedPages) {
      await page.close();
    }
  },
});

export { expect };
export { roleDataFor } from './roles';
export type { RoleName } from './roles';
export const roleData = (role: RoleName): RoleData => manifest().roles[role];

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
    const opened: BrowserContext[] = [];

    await use(async (role: RoleName) => {
      const context = await browser.newContext({ storageState: storageStatePath(role) });
      opened.push(context);

      // The API ROTATES the refresh token on every use (AuthController::refresh
      // deletes the session and issues a new one), so the storage-state cookie
      // is single-use: only the first context per role could ever refresh.
      // Log in fresh per context so each one owns its own rotation chain.
      const account = ROLE_ACCOUNTS[role];
      const login = await context.request.post('/api/v1/auth/login', {
        data: { email: account.email, password: account.password },
      });
      if (!login.ok()) {
        throw new Error(`roleSession(${role}): fresh login failed with ${login.status()}`);
      }

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

      const page = await context.newPage();

      return {
        account: ROLE_ACCOUNTS[role],
        data: manifest().roles[role],
        page,
        context,
      };
    });

    for (const context of opened) {
      await context.close();
    }
  },
});

export { expect };
export { roleDataFor } from './roles';
export type { RoleName } from './roles';
export const roleData = (role: RoleName): RoleData => manifest().roles[role];

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { request as playwrightRequest, test as setup } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import {
  PROVISION_MANIFEST_PATH,
  ROLE_ACCOUNTS,
  ROLE_NAMES,
  type ProvisionManifest,
  type RoleAccount,
  type RoleData,
  type RoleName,
  roleDataFor,
  storageStatePath,
} from './fixtures/roles';

/**
 * V1-303B: provisions admin/editor/viewer against the LIVE Laravel API once
 * per run, then persists one storageState per role.
 *
 * Why global setup rather than a per-test fixture: /auth/login is throttled to
 * 10/min per caller (routes/api.php, V1-104). Three roles x two Playwright
 * projects x CI retries would trip that and fail every spec on an unrelated
 * 429 — the exact trap next-laravel-integration.spec.ts already documents.
 * Logging in once per role for the whole run costs 3 of the 10.
 */

const AUTH_DIR = 'e2e/.auth';

interface Envelope {
  ok?: boolean;
  error?: string;
  [key: string]: unknown;
}

async function readEnvelope(label: string, response: { ok(): boolean; status(): number; text(): Promise<string> }) {
  const raw = await response.text();
  let payload: Envelope;

  try {
    payload = JSON.parse(raw) as Envelope;
  } catch {
    throw new Error(`${label}: non-JSON response (${response.status()}) — ${raw.slice(0, 300)}`);
  }

  if (!response.ok() || payload.ok === false) {
    throw new Error(`${label}: ${response.status()} — ${payload.error ?? raw.slice(0, 300)}`);
  }

  return payload;
}

/** Bearer token for a role, from that role's own credentials. */
async function loginFor(api: APIRequestContext, account: RoleAccount): Promise<string> {
  const response = await api.post('/api/v1/auth/login', {
    data: { email: account.email, password: account.password },
  });
  const payload = await readEnvelope(`login(${account.role})`, response);
  const token = payload.accessToken;

  if (typeof token !== 'string' || token.length === 0) {
    throw new Error(`login(${account.role}): response carried no accessToken`);
  }

  return token;
}

/**
 * Creates editor/viewer through the real invitation flow, because
 * POST /v1/users does NOT create a user — it mints an invitation (admin-only),
 * and POST /v1/invitations/{token}/accept (public) creates the account with a
 * password. Re-running against an already-seeded DB is normal (the live gate
 * re-uses a container), so an existing account is a no-op, not a failure.
 */
async function ensureAccount(
  api: APIRequestContext,
  adminToken: string,
  account: RoleAccount,
): Promise<void> {
  const invite = await api.post('/api/v1/users', {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { email: account.email, role: account.role },
  });

  if (invite.status() === 422) {
    // "A user with this email already exists." — a prior run provisioned it.
    return;
  }

  const invitePayload = await readEnvelope(`invite(${account.role})`, invite);
  const token = invitePayload.token;

  if (typeof token !== 'string') {
    throw new Error(`invite(${account.role}): response carried no invitation token`);
  }

  const accept = await api.post(`/api/v1/invitations/${token}/accept`, {
    data: { name: account.name, password: account.password },
  });
  await readEnvelope(`accept(${account.role})`, accept);
}

/**
 * Seeds this role's own rows. Records and rights are editor+ writes, so a
 * viewer's fixture data is written by the editor identity on the viewer's
 * behalf and namespaced to the viewer — the viewer still *reads* it under its
 * own session, which is what the a11y specs exercise. Media jobs are created
 * by the role itself, since created_by drives V1-111 ownership.
 */
async function seedRoleData(
  api: APIRequestContext,
  account: RoleAccount,
  writerToken: string,
  ownToken: string,
): Promise<RoleData> {
  const data = roleDataFor(account);

  await readEnvelope(
    `records/bulk(${account.role})`,
    await api.post('/api/v1/records/bulk', {
      headers: { Authorization: `Bearer ${writerToken}` },
      data: {
        store: 'archive',
        records: [
          {
            uid: data.recordUid,
            id: data.recordUid,
            title: data.recordTitle,
            description: `بيانات معزولة للدور ${account.role} (V1-303B).`,
            type: 'document',
            tags: [account.namespace],
          },
        ],
      },
    }),
  );

  await readEnvelope(
    `rights(${account.role})`,
    await api.post('/api/v1/rights', {
      headers: { Authorization: `Bearer ${writerToken}` },
      data: {
        itemId: data.rightsItemId,
        rightsHolder: `${account.name} Holder`,
        licenseType: 'OWNED',
        expiresAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
        notes: `V1-303B ${account.role} fixture.`,
      },
    }),
  );

  // Owned by the role itself — this is the one surface with real per-user
  // scoping, so it must be created under the role's own token to be isolated.
  const job = await api.post('/api/v1/media/jobs', {
    headers: { Authorization: `Bearer ${ownToken}` },
    data: { recordId: data.recordUid, operation: 'thumbnail' },
  });
  const jobPayload = await readEnvelope(`media/jobs(${account.role})`, job);
  const jobId = (jobPayload.job as { id?: string } | undefined)?.id ?? null;

  return { ...data, mediaJobId: jobId };
}

/**
 * A setup *project*, not a config-level `globalSetup`. A globalSetup runs on
 * every Playwright invocation, including `pnpm e2e:next` and `e2e:next:a11y`,
 * which deliberately run against a bare Next.js shell with no Laravel backend
 * — provisioning there would fail every time. As a project dependency it runs
 * only when a spec that needs roles is actually selected.
 */
setup('provision isolated role accounts and data', async ({ browser }) => {
  setup.setTimeout(120_000); // real logins + seeding against a live API

  const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000';

  await mkdir(AUTH_DIR, { recursive: true });

  const api = await playwrightRequest.newContext({ baseURL });

  try {
    // 1. Bootstrap: the seeded admin mints the other two accounts. This is the
    //    ONLY use of the admin identity on another role's behalf; from step 2
    //    on, every role acts as itself.
    const adminToken = await loginFor(api, ROLE_ACCOUNTS.admin);

    for (const role of ROLE_NAMES) {
      if (role === 'admin') continue;
      await ensureAccount(api, adminToken, ROLE_ACCOUNTS[role]);
    }

    // 2. One real login per role -> one storageState per role.
    const tokens: Record<RoleName, string> = {
      admin: adminToken,
      editor: '',
      viewer: '',
    };

    for (const role of ROLE_NAMES) {
      const account = ROLE_ACCOUNTS[role];
      const context = await browser.newContext({ baseURL });
      const response = await context.request.post('/api/v1/auth/login', {
        data: { email: account.email, password: account.password },
      });
      const payload = await readEnvelope(`session-login(${role})`, response);

      if (typeof payload.accessToken === 'string') {
        tokens[role] = payload.accessToken;
      }

      const state = await context.storageState();
      const refreshCookie = state.cookies.find((cookie) => cookie.name === 'va_refresh');
      const sessionCookie = state.cookies.find((cookie) => cookie.name === 'va_session');

      if (!refreshCookie) {
        throw new Error(
          `session-login(${role}): no va_refresh cookie in storage state — the app bootstraps ` +
            'its session from that cookie (lib/auth-session.tsx -> api.refresh()), so the ' +
            'fixture would silently fall back to the guest state.',
        );
      }

      if (!sessionCookie) {
        throw new Error(
          `session-login(${role}): no va_session cookie in storage state — the Next proxy ` +
            'uses it to admit protected routes before the client can refresh its access token.',
        );
      }

      await context.storageState({ path: storageStatePath(role) });
      await context.close();
    }

    // 3. Per-role isolated data. The editor writes record/rights rows for
    //    itself and for the viewer (viewer is 403 on those writes by design —
    //    RoleMatrixApiTest asserts exactly that); admin writes its own.
    const roles = {} as Record<RoleName, RoleData>;

    for (const role of ROLE_NAMES) {
      const account = ROLE_ACCOUNTS[role];
      const writerToken = role === 'admin' ? tokens.admin : tokens.editor;
      roles[role] = await seedRoleData(api, account, writerToken, tokens[role]);
    }

    const manifest: ProvisionManifest = { roles, createdAt: new Date().toISOString() };
    await writeFile(
      path.resolve(PROVISION_MANIFEST_PATH),
      `${JSON.stringify(manifest, null, 2)}\n`,
      'utf8',
    );
  } finally {
    await api.dispose();
  }
});

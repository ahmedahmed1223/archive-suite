/**
 * V1-303B: role-based auth fixtures — shared definitions.
 *
 * TASKS.md is explicit: "لا تستخدم token مدير موحدًا" — no single shared admin
 * token. Each role below gets its own real authenticated session against the
 * live Laravel API (its own `va_refresh` cookie, minted by its own
 * /auth/login), and its own namespaced data so one role's spec cannot observe
 * another's rows.
 *
 * Isolation model, per surface (what the API actually enforces, not what we
 * wish it enforced):
 * - media jobs  — real per-user isolation: MediaJobsController stamps
 *                 `created_by` and V1-111 scopes reads to the owner.
 * - records     — no ownership column; isolated by UID namespace
 *                 (`e2e-<role>-record-*`), asserted via search-by-namespace.
 * - rights      — keyed by `item_id` only (RightsController::store does
 *                 firstOrNew on item_id); isolated by pointing each role's
 *                 rights row at that role's own namespaced record UID.
 * - backups     — genuinely global + admin-only; only the admin role touches
 *                 them, so there is nothing to isolate. See ROLE_DATA below.
 */

export type RoleName = 'admin' | 'editor' | 'viewer';

export const ROLE_NAMES: readonly RoleName[] = ['admin', 'editor', 'viewer'] as const;

export interface RoleAccount {
  readonly role: RoleName;
  readonly email: string;
  readonly password: string;
  readonly name: string;
  /** UID/itemId prefix owned exclusively by this role. */
  readonly namespace: string;
}

/**
 * The seeded admin (NextIntegrationSeeder) is the only account that exists
 * before the run. It is the bootstrap identity used to mint invitations for
 * the other two roles — and nothing else. Every role, admin included, then
 * logs in as itself; no spec borrows another role's credentials.
 */
export const SEEDED_ADMIN_EMAIL = process.env.ARCHIVE_E2E_EMAIL ?? 'it@archive.test';
export const SEEDED_ADMIN_PASSWORD = process.env.ARCHIVE_E2E_PASSWORD ?? 'password123';

/**
 * Distinct password per role. A shared constant would make a leaked assertion
 * in one spec authenticate as any role.
 */
export const ROLE_ACCOUNTS: Readonly<Record<RoleName, RoleAccount>> = {
  admin: {
    role: 'admin',
    email: SEEDED_ADMIN_EMAIL,
    password: SEEDED_ADMIN_PASSWORD,
    name: 'E2E Admin',
    namespace: 'e2e-admin',
  },
  editor: {
    role: 'editor',
    email: 'e2e-editor@archive.test',
    password: 'e2e-editor-password-9f13',
    name: 'E2E Editor',
    namespace: 'e2e-editor',
  },
  viewer: {
    role: 'viewer',
    email: 'e2e-viewer@archive.test',
    password: 'e2e-viewer-password-4b72',
    name: 'E2E Viewer',
    namespace: 'e2e-viewer',
  },
};

/** Storage-state file per role, written by global-setup.ts. */
export function storageStatePath(role: RoleName): string {
  return `e2e/.auth/${role}.json`;
}

/** Manifest of what global-setup actually provisioned, read back by specs. */
export const PROVISION_MANIFEST_PATH = 'e2e/.auth/manifest.json';

export interface RoleData {
  readonly recordUid: string;
  readonly recordTitle: string;
  readonly rightsItemId: string;
  readonly mediaJobId: string | null;
}

export interface ProvisionManifest {
  readonly roles: Record<RoleName, RoleData>;
  readonly createdAt: string;
}

/** Deterministic per-role data identities, derived from the namespace. */
export function roleDataFor(account: RoleAccount): Omit<RoleData, 'mediaJobId'> {
  return {
    recordUid: `${account.namespace}-record-1`,
    recordTitle: `سجل ${account.role} المعزول`,
    rightsItemId: `${account.namespace}-record-1`,
  };
}

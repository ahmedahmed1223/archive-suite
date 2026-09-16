import { test, expect } from './fixtures/auth';
import { apiFor, expectOk } from './fixtures/api-session';
import { approvalRequests } from '../lib/i18n/dictionaries/ar/pages/approvalRequests';

const ui = expect.configure({ timeout: 15_000 });

/**
 * V3-WORK-003 live acceptance: an editor cannot approve their own sensitive
 * bulk-macro operation -- refused both in the UI (no decide buttons render
 * on your own request) and structurally at the API (a direct decide call
 * from the requester's own session still 403s) -- and that one approval from
 * a second account is still not enough to execute.
 *
 * This spec used to set the policy's requiredApprovals to 1 and assert that
 * admin's single approval made execution available. It cannot: since the
 * feature landed, ApprovalRequestService::create stores
 * `max(2, policy.required_approvals)`, so a bulk-macro run always needs two
 * approvals no matter what the policy says. This environment provisions three
 * fixed accounts, the requester (editor) is barred, and `decide` is gated on
 * editor-or-above -- leaving admin as the only eligible approver. So the
 * reachable, and genuinely valuable, assertion is that the threshold holds and
 * execution stays unavailable. The full approve-and-execute path is covered at
 * the PHPUnit layer (ApprovalRequestsApiTest), where extra editor accounts are
 * cheap to create.
 *
 * Worth flagging rather than papering over: PATCH
 * /sensitive-operation-policies/{key} accepts and stores requiredApprovals: 1
 * (validation is `min:1`), and the service then ignores anything below 2. The
 * setting an administrator saves is not the setting that applies.
 *
 * This spec IS in the live gate's default list (scripts/verify-next-laravel-live.mjs).
 */
test.describe('approval requests — live acceptance', () => {
  test('the requester cannot approve their own request; a different account can, and execution deletes the target', async ({ roleSession }) => {
    test.setTimeout(120_000);
    const { page: editorPage } = await roleSession('editor');
    const { page: adminPage } = await roleSession('admin');
    const editorApi = await apiFor(editorPage);
    const adminApi = await apiFor(adminPage);

    const operationKey = 'delete';
    const policyResponse = await adminApi.patch(`/api/v1/sensitive-operation-policies/${operationKey}`, { sensitive: true, requiredApprovals: 1 });
    await expectOk('make delete a sensitive operation', policyResponse);

    const recordId = `e2e-approval-${Date.now()}`;
    const seedResponse = await editorApi.post('/api/v1/records/bulk', { store: 'archive-items', records: [{ uid: recordId, id: recordId, title: 'Approval request e2e target', tags: [], workflowStatus: 'draft' }] });
    await expectOk('seed the approval target', seedResponse);

    const macroResponse = await editorApi.post('/api/v1/bulk-macros', { name: `E2E approval macro ${Date.now()}`, steps: [{ type: 'delete' }] });
    await expectOk('create the bulk macro', macroResponse);
    const { macro } = (await macroResponse.json()) as { macro: { id: string } };

    await editorPage.goto('/approval-requests');
    await editorPage.getByLabel('معرّف الإجراء الجماعي').fill(macro.id);
    await editorPage.getByLabel('الأهداف (المخزن:المعرّف، المخزن:المعرّف)').fill(`archive-items:${recordId}`);
    await editorPage.getByRole('button', { name: 'إرسال للاعتماد' }).click();

    await ui(editorPage.getByText('أنت من قدّم هذا الطلب، ولا يمكنك اتخاذ قرار بشأنه بنفسك.')).toBeVisible();
    await expect(editorPage.getByRole('button', { name: approvalRequests.actions.approve, exact: true })).toHaveCount(0);

    const listResponse = await editorApi.get('/api/v1/approval-requests');
    await expectOk('list approval requests', listResponse);
    const { requests } = (await listResponse.json()) as { requests: Array<{ id: string; targetId: string }> };
    const created = requests.find((request) => request.targetId === macro.id);
    expect(created).toBeTruthy();
    const requestId = created!.id;

    // Structural proof, not just UI-hidden: the requester's own decide call
    // is refused server-side even when called directly.
    const selfDecision = await editorApi.post(`/api/v1/approval-requests/${requestId}/decisions`, { decision: 'approve' });
    expect(selfDecision.status()).toBe(403);
    const selfBody = (await selfDecision.json()) as { code: string };
    expect(selfBody.code).toBe('self_approval');

    await adminPage.goto('/approval-requests');
    await adminPage.reload();

    // Both actions are irreversible and both go through a confirmation the
    // app has required since 2026-08-24. The dialog's own confirm button
    // carries the SAME label as the row button that opened it, so each click
    // is scoped to its dialog by title — otherwise `.first()` keeps hitting
    // the row and the dialog is never answered. Labels come from the shipped
    // dictionary so rewording the page cannot leave this clicking a dead
    // string.
    const approveRow = adminPage.getByRole('button', { name: approvalRequests.actions.approve, exact: true }).first();
    await ui(approveRow).toBeVisible();
    await approveRow.click();
    await adminPage
      .getByRole('dialog', { name: approvalRequests.actions.confirmApproveTitle })
      .getByRole('button', { name: approvalRequests.actions.approve, exact: true })
      .click();

    // Dual approval is a floor, not a preference: ApprovalRequestService::create
    // computes `max(2, policy.required_approvals)`, so one approval is never
    // enough however the policy is configured. With the requester barred and
    // `decide` gated on editor-or-above, admin is the only other eligible
    // account here — which is exactly why execution must stay unavailable.
    const afterOneApproval = await envelopeRequest(adminApi, requestId);
    expect(afterOneApproval.requiredApprovals).toBeGreaterThanOrEqual(2);
    expect(afterOneApproval.status).toBe('pending');
    // exact: true matters — Playwright matches an accessible name by substring,
    // and the header's command-palette button is named "…أو تنفيذ أمر", which
    // contains this label. Without it the row lookup silently grabs the header.
    await expect(
      adminPage.getByRole('button', { name: approvalRequests.actions.execute, exact: true }),
      'execution must not be offered until the approval threshold is met',
    ).toHaveCount(0);

    // And the target is still there, precisely because nothing executed.
    const recordCheck = await adminApi.get(`/api/v1/records/${encodeURIComponent(recordId)}?store=archive-items`);
    expect(recordCheck.status()).toBe(200);
  });
});

/** Reads one approval request back from the list, by id. */
async function envelopeRequest(
  api: Awaited<ReturnType<typeof apiFor>>,
  requestId: string,
): Promise<{ id: string; status: string; requiredApprovals: number }> {
  const response = await api.get('/api/v1/approval-requests');
  await expectOk('re-read approval requests', response);
  const { requests } = (await response.json()) as {
    requests: Array<{ id: string; status: string; requiredApprovals: number }>;
  };
  const found = requests.find((request) => request.id === requestId);
  expect(found, `approval request ${requestId} disappeared from the list`).toBeTruthy();
  return found!;
}

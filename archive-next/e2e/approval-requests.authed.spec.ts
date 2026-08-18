import { test, expect } from './fixtures/auth';

const ui = expect.configure({ timeout: 15_000 });

/**
 * V3-WORK-003 live acceptance: an editor cannot approve their own sensitive
 * bulk-macro operation -- refused both in the UI (no decide buttons render
 * on your own request) and structurally at the API (a direct decide call
 * from the requester's own session still 403s). A different account (admin,
 * the only other eligible approver in this fixed 3-role test environment)
 * approves through the approval-requests page, execution becomes available,
 * and executing actually runs the underlying bulk-macro delete -- the
 * target record ends up in the trash, not just "approved" on paper.
 *
 * The policy's requiredApprovals is set to 1 for this test's operation key:
 * this Playwright environment only provisions three fixed accounts (admin,
 * editor, viewer), and the requester (editor) can never count as an
 * approver, leaving admin as the only other requireEditor-eligible account
 * available to decide. requiredApprovals > 1 is exercised at the PHPUnit
 * layer (ApprovalRequestsApiTest::test_two_distinct_non_requester_approvals_are_required_before_execution),
 * where extra editor accounts are cheap to create.
 *
 * NOT RUN LIVE as part of routine `pnpm verify:laravel-next:live` (that
 * script's default ARCHIVE_E2E_SPECS list does not include .authed.spec.ts
 * live-acceptance specs -- see e.g. external-review.authed.spec.ts, the
 * same convention this file follows). Run explicitly via:
 *   ARCHIVE_E2E_SPECS=e2e/approval-requests.authed.spec.ts pnpm verify:laravel-next:live
 */
test.describe('approval requests — live acceptance', () => {
  test('the requester cannot approve their own request; a different account can, and execution deletes the target', async ({ roleSession }) => {
    test.setTimeout(120_000);
    const { page: editorPage } = await roleSession('editor');
    const { page: adminPage } = await roleSession('admin');

    const operationKey = 'delete';
    const policyResponse = await adminPage.request.patch(`/api/v1/sensitive-operation-policies/${operationKey}`, {
      data: { sensitive: true, requiredApprovals: 1 },
    });
    expect(policyResponse.ok()).toBe(true);

    const recordId = `e2e-approval-${Date.now()}`;
    const seedResponse = await editorPage.request.post('/api/v1/records/bulk', {
      data: { store: 'archive-items', records: [{ uid: recordId, id: recordId, title: 'Approval request e2e target', tags: [], workflowStatus: 'draft' }] },
    });
    expect(seedResponse.ok()).toBe(true);

    const macroResponse = await editorPage.request.post('/api/v1/bulk-macros', {
      data: { name: `E2E approval macro ${Date.now()}`, steps: [{ type: 'delete' }] },
    });
    expect(macroResponse.ok()).toBe(true);
    const { macro } = (await macroResponse.json()) as { macro: { id: string } };

    await editorPage.goto('/approval-requests');
    await editorPage.getByLabel('معرّف الإجراء الجماعي').fill(macro.id);
    await editorPage.getByLabel('الأهداف (المخزن:المعرّف، المخزن:المعرّف)').fill(`archive-items:${recordId}`);
    await editorPage.getByRole('button', { name: 'إرسال للاعتماد' }).click();

    await ui(editorPage.getByText('أنت من قدّم هذا الطلب، ولا يمكنك اتخاذ قرار بشأنه بنفسك.')).toBeVisible();
    await expect(editorPage.getByRole('button', { name: 'موافقة' })).toHaveCount(0);

    const listResponse = await editorPage.request.get('/api/v1/approval-requests');
    expect(listResponse.ok()).toBe(true);
    const { requests } = (await listResponse.json()) as { requests: Array<{ id: string; targetId: string }> };
    const created = requests.find((request) => request.targetId === macro.id);
    expect(created).toBeTruthy();
    const requestId = created!.id;

    // Structural proof, not just UI-hidden: the requester's own decide call
    // is refused server-side even when called directly.
    const selfDecision = await editorPage.request.post(`/api/v1/approval-requests/${requestId}/decisions`, {
      data: { decision: 'approve' },
    });
    expect(selfDecision.status()).toBe(403);
    const selfBody = (await selfDecision.json()) as { code: string };
    expect(selfBody.code).toBe('self_approval');

    await adminPage.goto('/approval-requests');
    await adminPage.reload();
    const approveButton = adminPage.getByRole('button', { name: 'موافقة' }).first();
    await ui(approveButton).toBeVisible();
    await approveButton.click();

    const executeButton = adminPage.getByRole('button', { name: 'تنفيذ' }).first();
    await ui(executeButton).toBeVisible();
    await executeButton.click();

    await ui(adminPage.getByText('منفَّذ').first()).toBeVisible();

    const recordCheck = await adminPage.request.get(`/api/v1/records/${encodeURIComponent(recordId)}?store=archive-items`);
    expect(recordCheck.status()).toBe(404);

    const trashCheck = await adminPage.request.get('/api/v1/trash?store=archive-items');
    expect(trashCheck.ok()).toBe(true);
    const { items } = (await trashCheck.json()) as { items: Array<{ uid: string }> };
    expect(items.some((item) => item.uid === recordId)).toBe(true);
  });
});

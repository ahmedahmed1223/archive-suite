// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";

const approvalRequests = vi.fn();
const createApprovalRequest = vi.fn();
const decideApprovalRequest = vi.fn();
const executeApprovalRequest = vi.fn();

vi.mock("@/lib/archive-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/archive-api")>("@/lib/archive-api");
  return { ...actual, createArchiveApiClient: () => ({ approvalRequests, createApprovalRequest, decideApprovalRequest, executeApprovalRequest }) };
});

let currentUserId = "1";
vi.mock("@/lib/auth-session", () => ({
  useAuthSession: () => ({ user: { id: currentUserId, role: "editor" }, status: "authenticated", accessToken: "token-abc" })
}));

vi.mock("@/components/AppShell", () => ({ default: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/PageToolbar", () => ({ default: ({ title, description }: { title: string; description: string }) => <header><h1>{title}</h1><p>{description}</p></header> }));
vi.mock("@/components/EmptyState", () => ({ default: ({ title }: { title: string }) => <p>{title}</p> }));

import ApprovalRequestsPage from "./page";

function renderPage() {
  return render(
    <LocaleProvider initialLocale="ar" hasLocaleCookie={false}>
      <ApprovalRequestsPage />
    </LocaleProvider>
  );
}

function pendingRequest(overrides: Partial<{ requestedBy: number; decisions: Array<{ id: string; approverId: number; decision: "approve" | "reject"; notes: string | null; decidedAt: string }> }> = {}) {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    operationKey: "bulk-macro-run",
    targetType: "bulk-macro" as const,
    targetId: "macro-1",
    requestedBy: overrides.requestedBy ?? 1,
    status: "pending" as const,
    requiredApprovals: 2,
    payload: {},
    executedRunId: null,
    executedAt: null,
    decisions: overrides.decisions ?? [],
    createdAt: "2026-08-18T00:00:00.000Z",
    updatedAt: "2026-08-18T00:00:00.000Z"
  };
}

afterEach(cleanup);
beforeEach(() => {
  currentUserId = "1";
  approvalRequests.mockResolvedValue({ ok: true, requests: [] });
  createApprovalRequest.mockReset();
  decideApprovalRequest.mockReset();
  executeApprovalRequest.mockReset();
});

test("the requester sees a self-approval notice instead of decide buttons on their own request", async () => {
  approvalRequests.mockResolvedValue({ ok: true, requests: [pendingRequest({ requestedBy: 1 })] });
  renderPage();

  await screen.findByText("أنت من قدّم هذا الطلب، ولا يمكنك اتخاذ قرار بشأنه بنفسك.");
  expect(screen.queryByRole("button", { name: "موافقة" })).toBeNull();
});

test("a different editor can approve, and execute appears once approved", async () => {
  currentUserId = "2";
  approvalRequests.mockResolvedValue({ ok: true, requests: [pendingRequest({ requestedBy: 1 })] });
  decideApprovalRequest.mockResolvedValue({ ok: true, request: pendingRequest({ requestedBy: 1, decisions: [{ id: "d1", approverId: 2, decision: "approve", notes: null, decidedAt: "2026-08-18T00:00:00.000Z" }] }) });
  renderPage();

  const approveButton = await screen.findByRole("button", { name: "موافقة" });
  fireEvent.click(approveButton);

  await waitFor(() => expect(decideApprovalRequest).toHaveBeenCalledWith(
    "11111111-1111-1111-1111-111111111111",
    { decision: "approve" },
    { accessToken: "token-abc" }
  ));
});

test("submitting a new request calls the API with parsed targets", async () => {
  createApprovalRequest.mockResolvedValue({ ok: true, request: pendingRequest() });
  renderPage();

  fireEvent.change(screen.getByLabelText("معرّف الإجراء الجماعي"), { target: { value: "macro-42" } });
  fireEvent.change(screen.getByLabelText("الأهداف (المخزن:المعرّف، المخزن:المعرّف)"), { target: { value: "archive-items:alpha, archive-items:bravo" } });
  fireEvent.click(screen.getByRole("button", { name: "إرسال للاعتماد" }));

  await waitFor(() => expect(createApprovalRequest).toHaveBeenCalledWith(
    { targetType: "bulk-macro", targetId: "macro-42", targets: [{ store: "archive-items", id: "alpha" }, { store: "archive-items", id: "bravo" }] },
    { accessToken: "token-abc" }
  ));
});

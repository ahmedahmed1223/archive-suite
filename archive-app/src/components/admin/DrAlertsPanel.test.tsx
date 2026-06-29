/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DrAlertsPanel } from "./DrAlertsPanel";

const TOKEN = "tok-test";

function mockFetch(responses: Record<string, unknown>) {
  return vi.fn(async (url: string, opts?: RequestInit) => {
    const path = url.toString();
    const key = path + ":" + (opts?.method ?? "GET");
    if (responses[key] !== undefined) {
      return { ok: true, json: async () => responses[key] } as Response;
    }
    if (responses[path] !== undefined) {
      return { ok: true, json: async () => responses[path] } as Response;
    }
    return { ok: false, json: async () => ({}) } as Response;
  });
}

const healthyProbe = {
  probe: {
    healthy: true,
    consecutiveFails: 0,
    failCount: 0,
    lastChecked: "2026-06-29T06:00:00.000Z",
    lastSuccess: "2026-06-29T06:00:00.000Z",
    probeUrl: "http://localhost/api/health",
  },
};

const failingProbe = {
  probe: {
    healthy: false,
    consecutiveFails: 4,
    failCount: 4,
    lastChecked: "2026-06-29T06:00:00.000Z",
    lastSuccess: "2026-06-29T05:00:00.000Z",
    probeUrl: "http://localhost/api/health",
  },
};

const sampleHistory = {
  history: [
    { id: "d1", startedAt: "2026-06-29T05:30:00.000Z", durationMs: 320, passed: true, replicaCount: 2, testedCount: 2, details: [] },
    { id: "d2", startedAt: "2026-06-29T04:30:00.000Z", durationMs: 290, passed: false, replicaCount: 2, testedCount: 1, details: [] },
  ],
};

const scheduledFailure = {
  history: [
    {
      passed: false,
      replicaId: null,
      ranAt: "2026-06-29T05:45:00.000Z",
      durationMs: 4,
      error: "No restorable replica found in manifest",
    },
  ],
  schedule: {
    enabled: true,
    running: true,
    intervalMs: 86_400_000,
    intervalHours: 24,
    startedAt: "2026-06-29T00:00:00.000Z",
    nextRunAt: "2026-06-30T00:00:00.000Z",
    lastRunAt: "2026-06-29T05:45:00.000Z",
    historyCount: 1,
    lastResult: {
      passed: false,
      replicaId: null,
      ranAt: "2026-06-29T05:45:00.000Z",
      durationMs: 4,
      error: "No restorable replica found in manifest",
    },
  },
};

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("DrAlertsPanel", () => {
  it("shows healthy status when probe is ok", async () => {
    global.fetch = mockFetch({
      "/api/backups/health-probe": healthyProbe,
      "/api/backups/drill-history": { history: [] },
    }) as typeof fetch;
    render(<DrAlertsPanel authToken={TOKEN} />);
    await waitFor(() => expect(screen.getByText("سليم")).toBeTruthy());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows failing alert banner when probe has consecutive failures", async () => {
    global.fetch = mockFetch({
      "/api/backups/health-probe": failingProbe,
      "/api/backups/drill-history": { history: [] },
    }) as typeof fetch;
    render(<DrAlertsPanel authToken={TOKEN} />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByText(/تنبيه DR/)).toBeTruthy();
    expect(screen.getByText(/4 مرة/)).toBeTruthy();
  });

  it("shows failing badge with count", async () => {
    global.fetch = mockFetch({
      "/api/backups/health-probe": failingProbe,
      "/api/backups/drill-history": { history: [] },
    }) as typeof fetch;
    render(<DrAlertsPanel authToken={TOKEN} />);
    await waitFor(() => expect(screen.getByText("فشل (4)")).toBeTruthy());
  });

  it("renders drill history list", async () => {
    global.fetch = mockFetch({
      "/api/backups/health-probe": healthyProbe,
      "/api/backups/drill-history": sampleHistory,
    }) as typeof fetch;
    render(<DrAlertsPanel authToken={TOKEN} />);
    await waitFor(() => expect(screen.getByText("1/2 نسخة · 290ms")).toBeTruthy());
    const items = screen.getAllByRole("listitem");
    expect(items.length).toBe(2);
  });

  it("shows scheduled drill status and alerts when the last drill failed", async () => {
    global.fetch = mockFetch({
      "/api/backups/health-probe": healthyProbe,
      "/api/backups/drill-history": scheduledFailure,
    }) as typeof fetch;
    render(<DrAlertsPanel authToken={TOKEN} />);

    await waitFor(() => expect(screen.getByText("جدولة الحفر الآلي")).toBeTruthy());
    expect(screen.getByText("مجدول ويعمل")).toBeTruthy();
    expect(screen.getByText("24 ساعة")).toBeTruthy();
    expect(screen.getByText("آخر حفر DR فشل")).toBeTruthy();
    expect(screen.getAllByText(/No restorable replica/).length).toBeGreaterThan(0);
  });

  it("shows empty history message when no drills", async () => {
    global.fetch = mockFetch({
      "/api/backups/health-probe": healthyProbe,
      "/api/backups/drill-history": { history: [] },
    }) as typeof fetch;
    render(<DrAlertsPanel authToken={TOKEN} />);
    await waitFor(() => expect(screen.getByText(/لا يوجد سجل حفر/)).toBeTruthy());
  });

  it("hides drill button for non-admins", async () => {
    global.fetch = mockFetch({
      "/api/backups/health-probe": healthyProbe,
      "/api/backups/drill-history": { history: [] },
    }) as typeof fetch;
    render(<DrAlertsPanel authToken={TOKEN} isAdmin={false} />);
    await waitFor(() => screen.getByText(/لا يوجد سجل حفر/));
    expect(screen.queryByText("تشغيل الحفر الآن")).toBeNull();
  });

  it("shows drill button for admins", async () => {
    global.fetch = mockFetch({
      "/api/backups/health-probe": healthyProbe,
      "/api/backups/drill-history": { history: [] },
    }) as typeof fetch;
    render(<DrAlertsPanel authToken={TOKEN} isAdmin={true} />);
    await waitFor(() => expect(screen.getByText("تشغيل الحفر الآن")).toBeTruthy());
  });

  it("shows success message after successful drill", async () => {
    global.fetch = mockFetch({
      "/api/backups/health-probe": healthyProbe,
      "/api/backups/drill-history": { history: [] },
      "/api/backups/drill-now:POST": { ok: true, drill: { passed: true } },
    }) as typeof fetch;
    render(<DrAlertsPanel authToken={TOKEN} isAdmin={true} />);
    await waitFor(() => screen.getByText("تشغيل الحفر الآن"));
    await act(async () => { await userEvent.click(screen.getByText("تشغيل الحفر الآن")); });
    await waitFor(() => expect(screen.getByText(/اجتاز الحفر DR بنجاح/)).toBeTruthy());
  });

  it("polls probe on interval", async () => {
    vi.useFakeTimers();
    const fetchMock = mockFetch({
      "/api/backups/health-probe": healthyProbe,
      "/api/backups/drill-history": { history: [] },
    }) as typeof fetch;
    global.fetch = fetchMock;
    render(<DrAlertsPanel authToken={TOKEN} pollIntervalMs={500} />);
    // flush initial fetch
    await act(async () => { vi.runAllTimersAsync(); });
    const callsBefore = (fetchMock as ReturnType<typeof vi.fn>).mock.calls.length;
    await act(async () => { vi.advanceTimersByTime(600); });
    expect((fetchMock as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(callsBefore);
    vi.useRealTimers();
  });
});

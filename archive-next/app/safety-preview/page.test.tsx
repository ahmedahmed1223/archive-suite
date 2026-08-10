// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";

const scenariosMock = vi.fn();
const runMock = vi.fn();
let role = "editor";

vi.mock("@/lib/archive-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/archive-api")>("@/lib/archive-api");
  return { ...actual, createArchiveApiClient: () => ({ safetyPreviewScenarios: scenariosMock, runSafetyPreview: runMock }) };
});

vi.mock("@/lib/auth-session", () => ({
  useAuthSession: () => ({ user: { id: "user-1", role }, status: "authenticated", accessToken: "token-abc" })
}));

vi.mock("@/components/AppShell", () => ({ default: ({ children }: { children: ReactNode }) => <main>{children}</main> }));

import SafetyPreviewPage from "./page";

const preview = {
  ok: true as const,
  synthetic: true as const,
  scenario: "restore-conflict" as const,
  operation: "restore" as const,
  expiresAt: "2026-07-22T13:00:00.000Z",
  before: { live: 8, trash: 3 },
  after: { live: 9, trash: 2 },
  results: [
    { id: "conflict", deleted: false, restored: false, reason: "conflict" },
    { id: "recoverable", deleted: false, restored: true },
    { id: "missing", deleted: false, restored: false, reason: "not_found" }
  ]
};

function renderPage() {
  return render(
    <LocaleProvider initialLocale="ar" hasLocaleCookie={false}>
      <SafetyPreviewPage />
    </LocaleProvider>
  );
}

beforeEach(() => {
  role = "editor";
  scenariosMock.mockResolvedValue({ ok: true, synthetic: true, scenarios: [
    { id: "bulk-delete-basic", description: "حذف جماعي تجريبي لسجلات اصطناعية" },
    { id: "restore-conflict", description: "استعادة تجريبية تعرض تعارضاً وعنصراً قابلاً للاستعادة" }
  ] });
  runMock.mockResolvedValue(preview);

  const values = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      get length() {
        return values.size;
      },
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      key: (index: number) => [...values.keys()][index] ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    } satisfies Storage,
  });
});

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("safety preview workspace", () => {
  test("runs only the synthetic preview and renders counts, expiry, and item outcomes", async () => {
    renderPage();
    await screen.findByRole("option", { name: "استعادة تجريبية تعرض تعارضاً وعنصراً قابلاً للاستعادة" });
    fireEvent.change(screen.getByLabelText("السيناريو"), { target: { value: "restore-conflict" } });
    fireEvent.click(screen.getByRole("button", { name: "تشغيل المحاكاة" }));

    await screen.findByText("recoverable");
    expect(runMock).toHaveBeenCalledWith(
      { scenario: "restore-conflict", operation: "restore", ids: ["conflict", "recoverable", "missing"] },
      { accessToken: "token-abc" }
    );
    expect(screen.getByText("synthetic: true")).toBeTruthy();
    expect(screen.getByText("8")).toBeTruthy();
    expect(screen.getByText("9")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("تعارض")).toBeTruthy();
    expect(screen.getByText("غير موجود")).toBeTruthy();
    expect(screen.getByText(/تنتهي المعاينة في/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: "عرض سجل التدقيق" })).toBeNull();
    expect(screen.queryByText(/نفّذ الإجراء عند الجاهزية/)).toBeNull();
  });

  test("shows a safe denial for viewers without calling the run endpoint", async () => {
    role = "viewer";
    renderPage();
    await screen.findByText("لا تملك صلاحية تشغيل المحاكاة");
    expect(screen.getByRole("button", { name: "تشغيل المحاكاة" })).toBeDisabled();
    expect(runMock).not.toHaveBeenCalled();
  });
});

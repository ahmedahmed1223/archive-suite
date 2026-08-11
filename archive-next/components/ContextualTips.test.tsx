// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import ContextualTips from "@/components/ContextualTips";
import { useContextualTips } from "@/lib/use-contextual-tips";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";

const handleDismiss = vi.fn();
const handleDismissSession = vi.fn();

vi.mock("@/lib/use-contextual-tips", () => ({
  useContextualTips: vi.fn()
}));

vi.mock("@/lib/auth-session", () => ({
  useAuthSession: () => ({ user: { role: "viewer" } })
}));

const mockUseContextualTips = vi.mocked(useContextualTips);

function renderTips(node: ReactNode) {
  return render(<LocaleProvider initialLocale="ar" hasLocaleCookie>{node}</LocaleProvider>);
}

function mockHookState(overrides: Partial<ReturnType<typeof useContextualTips>> = {}) {
  mockUseContextualTips.mockReturnValue({
    isDismissed: false,
    isEnabled: true,
    handleDismiss,
    handleDismissSession,
    isHydrated: true,
    ...overrides
  });
}

afterEach(() => {
  cleanup();
  handleDismiss.mockClear();
  handleDismissSession.mockClear();
});

describe("ContextualTips role integration (V1-306C)", () => {
  test("shows viewer guidance without archive editing instructions", () => {
    mockHookState();
    renderTips(<ContextualTips page="archive" />);
    fireEvent.click(screen.getByRole("button", { name: /نصائح سريعة/ }));

    expect(screen.getByText("وضع القراءة")).toBeTruthy();
    expect(screen.queryByText("تعديل السجلات")).toBeNull();
  });
});

describe("ContextualTips dismiss and Settings control (design fix)", () => {
  test("renders nothing once dismissed", () => {
    mockHookState({ isDismissed: true });
    renderTips(<ContextualTips page="archive" />);

    expect(screen.queryByRole("button", { name: /نصائح سريعة/ })).toBeNull();
  });

  test("renders nothing when disabled globally from Settings", () => {
    mockHookState({ isEnabled: false });
    renderTips(<ContextualTips page="archive" />);

    expect(screen.queryByRole("button", { name: /نصائح سريعة/ })).toBeNull();
  });

  test("'hide for this session' calls the session dismiss handler, not the permanent one", () => {
    mockHookState();
    renderTips(<ContextualTips page="archive" />);
    fireEvent.click(screen.getByRole("button", { name: /نصائح سريعة/ }));
    fireEvent.click(screen.getByRole("button", { name: /إخفاء لهذه الجلسة/ }));

    expect(handleDismissSession).toHaveBeenCalledOnce();
    expect(handleDismiss).not.toHaveBeenCalled();
  });

  test("'never show again' calls the permanent dismiss handler, not the session one", () => {
    mockHookState();
    renderTips(<ContextualTips page="archive" />);
    fireEvent.click(screen.getByRole("button", { name: /نصائح سريعة/ }));
    fireEvent.click(screen.getByRole("button", { name: /عدم إظهار مرة أخرى/ }));

    expect(handleDismiss).toHaveBeenCalledOnce();
    expect(handleDismissSession).not.toHaveBeenCalled();
  });
});

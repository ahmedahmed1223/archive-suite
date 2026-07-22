// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import ContextualTips from "@/components/ContextualTips";
import { useContextualTips } from "@/lib/use-contextual-tips";

const handleDismiss = vi.fn();
const handleDismissSession = vi.fn();

vi.mock("@/lib/use-contextual-tips", () => ({
  useContextualTips: vi.fn()
}));

vi.mock("@/lib/auth-session", () => ({
  useAuthSession: () => ({ user: { role: "viewer" } })
}));

const mockUseContextualTips = vi.mocked(useContextualTips);

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
    render(<ContextualTips page="archive" />);
    fireEvent.click(screen.getByRole("button", { name: /نصائح حول/ }));

    expect(screen.getByText("وضع القراءة")).toBeTruthy();
    expect(screen.queryByText("تعديل السجلات")).toBeNull();
  });
});

describe("ContextualTips dismiss and Settings control (design fix)", () => {
  test("renders nothing once dismissed", () => {
    mockHookState({ isDismissed: true });
    render(<ContextualTips page="archive" />);

    expect(screen.queryByRole("button", { name: /نصائح حول/ })).toBeNull();
  });

  test("renders nothing when disabled globally from Settings", () => {
    mockHookState({ isEnabled: false });
    render(<ContextualTips page="archive" />);

    expect(screen.queryByRole("button", { name: /نصائح حول/ })).toBeNull();
  });

  test("'hide for this session' calls the session dismiss handler, not the permanent one", () => {
    mockHookState();
    render(<ContextualTips page="archive" />);
    fireEvent.click(screen.getByRole("button", { name: /نصائح حول/ }));
    fireEvent.click(screen.getByRole("button", { name: /إخفاء لهذه الجلسة/ }));

    expect(handleDismissSession).toHaveBeenCalledOnce();
    expect(handleDismiss).not.toHaveBeenCalled();
  });

  test("'never show again' calls the permanent dismiss handler, not the session one", () => {
    mockHookState();
    render(<ContextualTips page="archive" />);
    fireEvent.click(screen.getByRole("button", { name: /نصائح حول/ }));
    fireEvent.click(screen.getByRole("button", { name: /عدم إظهار مرة أخرى/ }));

    expect(handleDismiss).toHaveBeenCalledOnce();
    expect(handleDismissSession).not.toHaveBeenCalled();
  });
});

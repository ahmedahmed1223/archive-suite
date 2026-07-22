// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import ContextualTips from "@/components/ContextualTips";

vi.mock("@/lib/use-contextual-tips", () => ({
  useContextualTips: () => ({
    isDismissed: false,
    handleDismiss: vi.fn(),
    isHydrated: true
  })
}));

vi.mock("@/lib/auth-session", () => ({
  useAuthSession: () => ({ user: { role: "viewer" } })
}));

afterEach(cleanup);

describe("ContextualTips role integration (V1-306C)", () => {
  test("shows viewer guidance without archive editing instructions", () => {
    render(<ContextualTips page="archive" />);
    fireEvent.click(screen.getByRole("button", { name: /نصائح حول/ }));

    expect(screen.getByText("وضع القراءة")).toBeTruthy();
    expect(screen.queryByText("تعديل السجلات")).toBeNull();
  });
});

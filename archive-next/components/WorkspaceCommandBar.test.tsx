// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import WorkspaceCommandBar from "./WorkspaceCommandBar";

const mockUseAuthSession = vi.fn();

vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/lib/auth-session", () => ({ useAuthSession: () => mockUseAuthSession() }));
vi.mock("@/components/CommandPalette", () => ({ openCommandPalette: vi.fn() }));
vi.mock("@/components/ContextualTips", () => ({ default: () => null }));
vi.mock("@/lib/keyboard-shortcuts", () => ({
  getShortcut: () => ({ key: "k", ctrl: true }),
  formatShortcutDisplay: () => "Ctrl + K"
}));

afterEach(() => {
  document.body.innerHTML = "";
  mockUseAuthSession.mockReset();
});

describe("WorkspaceCommandBar", () => {
  test("exposes the workspace command entry as the primary search action", () => {
    mockUseAuthSession.mockReturnValue({
      status: "authenticated",
      user: { name: "مدير الأرشيف", role: "admin" }
    });

    render(<WorkspaceCommandBar />);

    const commandEntry = screen.getByRole("button", { name: "بحث، فتح صفحة، أو تنفيذ أمر" });
    expect(commandEntry).toHaveAttribute("aria-label", "بحث، فتح صفحة، أو تنفيذ أمر");
    expect(commandEntry).toHaveAttribute("aria-keyshortcuts", "Control+K Meta+K");
    expect(screen.getByText("Ctrl + K")).toBeVisible();
  });
});

// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import WorkspaceCommandBar from "./WorkspaceCommandBar";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";

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
  test("uses English labels for the primary command action", () => {
    mockUseAuthSession.mockReturnValue({
      status: "authenticated",
      user: { name: "Archive manager", role: "admin" }
    });

    render(
      <LocaleProvider initialLocale="en" hasLocaleCookie>
        <WorkspaceCommandBar />
      </LocaleProvider>,
    );

    expect(screen.getByRole("button", { name: "Search, open a page, or run a command" })).toHaveAttribute(
      "aria-label",
      "Search, open a page, or run a command",
    );
    expect(screen.getByRole("navigation", { name: "Quick actions" })).toBeVisible();
  });

  test("exposes the workspace command entry as the primary search action", () => {
    mockUseAuthSession.mockReturnValue({
      status: "authenticated",
      user: { name: "مدير الأرشيف", role: "admin" }
    });

    render(<LocaleProvider initialLocale="ar" hasLocaleCookie><WorkspaceCommandBar /></LocaleProvider>);

    const commandEntry = screen.getByRole("button", { name: "بحث، فتح صفحة، أو تنفيذ أمر" });
    expect(commandEntry).toHaveAttribute("aria-label", "بحث، فتح صفحة، أو تنفيذ أمر");
    expect(commandEntry).toHaveAttribute("aria-keyshortcuts", "Control+K Meta+K");
    expect(screen.getByText("Ctrl + K")).toBeVisible();
  });
});

// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import AppHeader from "./AppHeader";

const mockUseAuthSession = vi.fn();
const mockUsePathname = vi.fn();

vi.mock("next/link", () => ({ default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a> }));
vi.mock("next/navigation", () => ({ usePathname: () => mockUsePathname(), useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/lib/auth-session", () => ({ useAuthSession: () => mockUseAuthSession() }));
vi.mock("@/components/CommandPalette", () => ({ openCommandPalette: vi.fn() }));
vi.mock("@/components/DensityToggle", () => ({ default: () => null }));
vi.mock("@/components/FocusModeToggle", () => ({ default: () => null }));
vi.mock("@/components/NotificationsPanel", () => ({ NotificationsPanel: () => null }));
vi.mock("@/components/Breadcrumb", () => ({ default: () => null }));
vi.mock("@/components/ThemeProvider", () => ({
  useTheme: () => ({ settings: { currentPreset: "cinematic-dark" }, setPreset: vi.fn() })
}));

function mockMatchMedia(matchingQuery: string) {
  window.matchMedia = ((query: string) => ({
    matches: query === matchingQuery,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    // Legacy API some libraries still probe for.
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => {
  document.body.innerHTML = "";
  mockUsePathname.mockReset();
  mockUseAuthSession.mockReset();
});

function mockSession(role: "admin" | "editor" | "viewer" = "viewer") {
  mockUsePathname.mockReturnValue("/");
  mockUseAuthSession.mockReturnValue({ status: "authenticated", user: { role }, logout: vi.fn() });
}

describe("AppHeader navigation", () => {
  test("keeps command palette and navigation controls discoverable", () => {
    mockSession();
    mockMatchMedia("");

    render(<AppHeader subtitle="مساحة العمل" />);

    expect(screen.getByRole("button", { name: "فتح لوحة الأوامر" })).toBeVisible();
    expect(screen.getByRole("navigation", { name: "المسارات الرئيسية" })).toBeVisible();
  });

  test("opens navigation and returns focus to its trigger on Escape", () => {
    mockSession();
    mockMatchMedia("");
    render(<AppHeader subtitle="الرئيسية" />);

    const trigger = screen.getByRole("button", { name: "فتح التنقل" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(trigger);
  });
});

describe("AppHeader grouped navigation", () => {
  test("groups routes by function and can expand every group", () => {
    mockSession();
    mockMatchMedia("");
    render(<AppHeader subtitle="الرئيسية" />);

    const groups = Array.from(document.querySelectorAll(".nav-group")) as HTMLDetailsElement[];
    expect(groups.length).toBeGreaterThan(2);
    expect(screen.getByText("المكتبة").closest("details")?.open).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "فتح كل المجموعات" }));
    expect(groups.every((group) => group.open)).toBe(true);
  });

  test("scrolls the desktop navigation from its explicit controls", () => {
    mockSession();
    mockMatchMedia("");
    render(<AppHeader subtitle="الرئيسية" />);

    const navigation = screen.getByRole("navigation");
    Object.defineProperties(navigation, {
      scrollHeight: { value: 800 },
      clientHeight: { value: 300 },
      scrollTop: { value: 120, writable: true }
    });
    const scrollBy = vi.fn();
    Object.assign(navigation, { scrollBy });
    fireEvent.scroll(navigation);

    fireEvent.click(screen.getByRole("button", { name: "تمرير القائمة لأسفل" }));
    expect(scrollBy).toHaveBeenCalledWith(expect.objectContaining({ top: expect.any(Number) }));
  });
});

describe("AppHeader contextual guide", () => {
  test("does not link a viewer to an admin-only contextual chapter", () => {
    mockSession("viewer");
    mockUsePathname.mockReturnValue("/settings/users");
    mockMatchMedia("");

    render(<AppHeader subtitle="الإعدادات" />);

    expect(screen.queryByRole("link", { name: "كيف تعمل هذه الصفحة؟" })).toBeNull();
  });
});

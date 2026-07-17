// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import AppHeader from "./AppHeader";

vi.mock("next/link", () => ({ default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a> }));
vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/lib/auth-session", () => ({ useAuthSession: () => ({ status: "anonymous", user: null, logout: vi.fn() }) }));
vi.mock("@/components/CommandPalette", () => ({ openCommandPalette: vi.fn() }));
vi.mock("@/components/DensityToggle", () => ({ default: () => null }));
vi.mock("@/components/FocusModeToggle", () => ({ default: () => null }));
vi.mock("@/components/NotificationsPanel", () => ({ NotificationsPanel: () => null }));
vi.mock("@/components/Breadcrumb", () => ({ default: () => null }));

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
});

describe("AppHeader navigation", () => {
  test("opens navigation and returns focus to its trigger on Escape", () => {
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

describe("AppHeader wide-sidebar layout (V1-nav)", () => {
  test("'المزيد' starts collapsed on narrow/mid viewports", () => {
    mockMatchMedia("(max-width: 760px)");
    render(<AppHeader subtitle="الرئيسية" />);

    const details = document.querySelector(".nav-more") as HTMLDetailsElement;
    expect(details.open).toBe(false);
  });

  test("'المزيد' starts expanded once the header becomes a persistent sidebar (>=1120px)", () => {
    mockMatchMedia("(min-width: 1120px)");
    render(<AppHeader subtitle="الرئيسية" />);

    const details = document.querySelector(".nav-more") as HTMLDetailsElement;
    expect(details.open).toBe(true);
  });
});

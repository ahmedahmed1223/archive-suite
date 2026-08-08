// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import MobilePrimaryNav from "./MobilePrimaryNav";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";

const { openCommandPalette } = vi.hoisted(() => ({ openCommandPalette: vi.fn() }));

vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/lib/auth-session", () => ({
  useAuthSession: () => ({ status: "authenticated", user: { role: "viewer" } })
}));
vi.mock("@/components/CommandPalette", () => ({ openCommandPalette }));

afterEach(() => {
  document.body.innerHTML = "";
  openCommandPalette.mockReset();
});

describe("MobilePrimaryNav", () => {
  test("renders daily navigation and command controls in English", () => {
    render(<LocaleProvider initialLocale="en" hasLocaleCookie><MobilePrimaryNav /></LocaleProvider>);

    expect(screen.getByRole("navigation", { name: "Daily navigation" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Open commands" })).toBeVisible();
    expect(screen.getByRole("button", { name: "More" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeVisible();
  });

  test("opens the global command palette from the mobile navigation", () => {
    render(<LocaleProvider initialLocale="ar" hasLocaleCookie><MobilePrimaryNav /></LocaleProvider>);

    fireEvent.click(screen.getByRole("button", { name: "فتح الأوامر" }));

    expect(openCommandPalette).toHaveBeenCalledOnce();
  });
});

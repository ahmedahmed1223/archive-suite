// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import MobilePrimaryNav from "./MobilePrimaryNav";

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
  test("opens the global command palette from the mobile navigation", () => {
    render(<MobilePrimaryNav />);

    fireEvent.click(screen.getByRole("button", { name: "فتح الأوامر" }));

    expect(openCommandPalette).toHaveBeenCalledOnce();
  });
});

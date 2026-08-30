// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthGate, AuthProvider } from "./auth-session";
import { LocaleProvider } from "./i18n/LocaleProvider";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/archive",
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock("@/lib/archive-api", () => ({
  ARCHIVE_UNAUTHORIZED_EVENT: "archive-next:unauthorized",
  createArchiveApiClient: () => ({
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn().mockResolvedValue({ ok: false, error: "Unauthorized", code: "http_401" }),
  }),
}));

describe("localized authentication gate", () => {
  beforeEach(() => {
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
    mocks.replace.mockReset();
  });

  afterEach(cleanup);

  it("uses English session and redirect copy when English is active", async () => {
    render(
      <LocaleProvider initialLocale="en" hasLocaleCookie>
        <AuthProvider>
          <AuthGate>
            <div>private content</div>
          </AuthGate>
        </AuthProvider>
      </LocaleProvider>,
    );

    // V14-UX-REVIEW: bootstrap now retries transient 401s (~3.2s) before going
    // guest, so the redirect copy appears after the retry window.
    expect(await screen.findByText("Taking you to the sign-in page…", {}, { timeout: 6000 })).toBeInTheDocument();
    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith("/login?next=%2Farchive");
    });
  }, 7_000);
});

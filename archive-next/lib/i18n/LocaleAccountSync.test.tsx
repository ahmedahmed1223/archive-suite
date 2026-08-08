// @vitest-environment jsdom

import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocaleAccountSync } from "./LocaleAccountSync";
import { LocaleProvider } from "./LocaleProvider";

const mocks = vi.hoisted(() => ({
  locale: "en" as "ar" | "en" | null,
  refresh: vi.fn(),
  status: "authenticated" as "authenticated" | "loading" | "guest",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("@/lib/auth-session", () => ({
  useAuthSession: () => ({
    status: mocks.status,
    user: mocks.status === "authenticated" ? { id: "user-1", locale: mocks.locale } : null,
  }),
}));

describe("LocaleAccountSync", () => {
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
    document.cookie = "archive_locale=; Max-Age=0; Path=/";
    mocks.locale = "en";
    mocks.status = "authenticated";
    mocks.refresh.mockReset();
  });

  afterEach(cleanup);

  it("makes the authenticated account locale authoritative and refreshes server content once", async () => {
    render(
      <LocaleProvider initialLocale="ar" hasLocaleCookie>
        <LocaleAccountSync />
      </LocaleProvider>,
    );

    await waitFor(() => expect(document.documentElement).toHaveAttribute("lang", "en"));
    expect(document.documentElement).toHaveAttribute("dir", "ltr");
    expect(document.cookie).toContain("archive_locale=en");
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("keeps the request locale when the account has no explicit preference", async () => {
    mocks.locale = null;

    render(
      <LocaleProvider initialLocale="ar" hasLocaleCookie>
        <LocaleAccountSync />
      </LocaleProvider>,
    );

    await waitFor(() => expect(document.documentElement).toHaveAttribute("lang", "ar"));
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});

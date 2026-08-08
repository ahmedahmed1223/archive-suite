// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import LanguageSettings from "./LanguageSettings";
import { AuthProvider, useAuthSession } from "@/lib/auth-session";
import { LocaleProvider, useLocale } from "@/lib/i18n/LocaleProvider";

const api = vi.hoisted(() => ({
  login: vi.fn(),
  logout: vi.fn(),
  refresh: vi.fn(),
  updateAccountPreferences: vi.fn(),
}));

vi.mock("@/lib/archive-api", () => ({
  ARCHIVE_UNAUTHORIZED_EVENT: "archive-next:unauthorized",
  createArchiveApiClient: () => api,
}));

const arabicUser = {
  id: "user-1",
  name: "Archive User",
  email: "user@example.test",
  role: "editor" as const,
  roles: ["editor"],
  locale: "ar" as const,
};

function StateProbe() {
  const { user } = useAuthSession();
  const { locale } = useLocale();
  return <output>{`${locale}:${user?.locale ?? "none"}`}</output>;
}

function renderSettings() {
  return render(
    <LocaleProvider initialLocale="ar" hasLocaleCookie>
      <AuthProvider>
        <LanguageSettings />
        <StateProbe />
      </AuthProvider>
    </LocaleProvider>,
  );
}

describe("LanguageSettings", () => {
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
    api.login.mockReset();
    api.logout.mockReset();
    api.refresh.mockReset().mockResolvedValue({
      ok: true,
      user: arabicUser,
      accessToken: "access-token",
      expiresAt: "2026-08-08T18:00:00Z",
    });
    api.updateAccountPreferences.mockReset();
  });

  afterEach(cleanup);

  it("updates the account and interface together", async () => {
    api.updateAccountPreferences.mockResolvedValue({
      ok: true,
      user: { ...arabicUser, locale: "en" },
    });
    renderSettings();
    await screen.findByText("ar:ar");

    fireEvent.change(screen.getByRole("combobox", { name: "لغة الواجهة" }), { target: { value: "en" } });

    await screen.findByText("Language updated.");
    expect(screen.getByText("en:en")).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute("lang", "en");
    expect(api.updateAccountPreferences).toHaveBeenCalledWith({ locale: "en" });
  });

  it("rolls the account and interface back when persistence fails", async () => {
    api.updateAccountPreferences.mockResolvedValue({ ok: false, error: "network unavailable" });
    renderSettings();
    await screen.findByText("ar:ar");

    fireEvent.change(screen.getByRole("combobox", { name: "لغة الواجهة" }), { target: { value: "en" } });

    await waitFor(() => expect(screen.getByText("ar:ar")).toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent("تعذر حفظ اللغة. أعد المحاولة.");
    expect(document.documentElement).toHaveAttribute("lang", "ar");
  });
});

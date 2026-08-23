// @vitest-environment jsdom

vi.mock("@/components/ui/ConfirmDialog", () => ({
  useConfirmDialog: () => ({ confirm: vi.fn().mockResolvedValue(true), prompt: vi.fn(), alert: vi.fn() }),
  ConfirmDialogProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import SettingsPage from "./page";
import { DEFAULT_CAPABILITIES, DEFAULT_EXPERIENCE } from "@/lib/experience-profile";

const displaySettings = { timeZone: "Europe/Istanbul", dateFormat: "DD/MM/YYYY" as const, timeFormat: "24h" as const, showSeconds: false };

vi.mock("@/components/AppShell", () => ({ default: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/DropboxFolderPicker", () => ({ default: () => null }));
vi.mock("@/components/MetricStrip", () => ({ default: () => null }));
vi.mock("@/components/PageToolbar", () => ({ default: ({ title }: { title: string }) => <h1>{title}</h1> }));
vi.mock("@/components/ShortcutsSettings", () => ({ default: () => null }));
vi.mock("@/components/AppearanceSettings", () => ({ default: () => null }));
vi.mock("@/components/LanguageSettings", () => ({ default: () => null }));
vi.mock("@/lib/contextual-tips", () => ({ isTipsEnabledGlobally: () => true, setTipsEnabledGlobally: vi.fn() }));
vi.mock("@/lib/auth-session", () => ({ useAuthSession: () => ({ user: { role: "admin" } }) }));
vi.mock("@/lib/experience-profile-context", () => ({
  useExperienceProfile: () => ({
    status: "ready",
    capabilities: DEFAULT_CAPABILITIES,
    capabilitiesStatus: "ready",
    capabilitiesError: null,
    experience: DEFAULT_EXPERIENCE,
    experienceStatus: "ready",
    experienceError: null,
    profileVersion: 0,
    writeConflict: null,
    clearWriteConflict: vi.fn(),
    retryLoad: vi.fn(),
    updateExperience: vi.fn().mockResolvedValue({ ok: true }),
    resetExperience: vi.fn().mockResolvedValue({ ok: true }),
    updateCapabilities: vi.fn().mockResolvedValue({ ok: true })
  })
}));
vi.mock("@/lib/display-settings-context", () => ({
  useDisplaySettings: () => ({
    settings: displaySettings,
    status: "ready",
    error: null,
    replaceSettings: vi.fn()
  })
}));
vi.mock("@/lib/archive-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/archive-api")>("@/lib/archive-api");
  return {
    ...actual,
    createArchiveApiClient: () => ({
      dropboxConnection: vi.fn().mockResolvedValue({ ok: false }),
      getSecuritySettings: vi.fn().mockResolvedValue({ ok: false, error: "" }),
      odbcStatus: vi.fn().mockResolvedValue({ ok: false, code: "NOT_FOUND" }),
      updateDisplaySettings: vi.fn().mockImplementation(async (settings) => ({ ok: true, settings }))
    })
  };
});

vi.mock("@/lib/i18n/LocaleProvider", async () => {
  const { getDictionary } = await vi.importActual<typeof import("@/lib/i18n/dictionaries")>("@/lib/i18n/dictionaries");
  return { useLocale: () => ({ locale: "ar", t: getDictionary("ar") }) };
});

describe("SettingsPage display settings", () => {
  afterEach(cleanup);

  it("shows the central date and time section to an administrator", () => {
    render(<SettingsPage />);

    expect(screen.getByRole("heading", { name: "التاريخ والوقت" })).toBeInTheDocument();
  });

  it("previews and saves the selected central date format", async () => {
    render(<SettingsPage />);

    fireEvent.change(screen.getByLabelText("تنسيق التاريخ"), { target: { value: "MM/DD/YYYY" } });

    expect(screen.getByText("معاينة: 07/21/2026 09:05")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "حفظ إعداد التاريخ والوقت" }));

    await waitFor(() => expect(screen.getByText("تم حفظ إعداد التاريخ والوقت لجميع المستخدمين.")).toBeInTheDocument());
  });
});

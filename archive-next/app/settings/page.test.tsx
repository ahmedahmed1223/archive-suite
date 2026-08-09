// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

const client = vi.hoisted(() => ({
  dropboxConnection: vi.fn(),
  getSecuritySettings: vi.fn(),
  updateSecuritySettings: vi.fn(),
  odbcStatus: vi.fn()
}));

vi.mock("@/lib/archive-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/archive-api")>("@/lib/archive-api");
  return { ...actual, createArchiveApiClient: () => client };
});
vi.mock("@/components/AppShell", () => ({ default: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/MetricStrip", () => ({ default: () => null }));
vi.mock("@/components/PageToolbar", () => ({ default: () => null }));
vi.mock("@/components/ShortcutsSettings", () => ({ default: () => null }));
vi.mock("@/components/AppearanceSettings", () => ({ default: () => null }));
vi.mock("@/components/LanguageSettings", () => ({ default: () => null }));
vi.mock("@/components/DropboxFolderPicker", () => ({ default: () => null }));
vi.mock("@/lib/contextual-tips", () => ({ isTipsEnabledGlobally: () => true, setTipsEnabledGlobally: vi.fn() }));

import SettingsPage from "./page";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SettingsPage", () => {
  test("describes a feature-gated ODBC bridge as disabled", async () => {
    client.dropboxConnection.mockResolvedValue({ ok: false });
    client.getSecuritySettings.mockResolvedValue({
      ok: true,
      settings: {
        accessTokenTtlMinutes: 60,
        perUserRateLimit: 60,
        webhookUrlAllowlist: [],
        legacyPasswordUpgrade: true,
        whisperDevice: "cpu",
        cspPolicy: "default-src 'self'",
        corsOrigins: []
      }
    });
    client.odbcStatus.mockResolvedValue({ ok: false, error: "العنصر غير موجود.", code: "NOT_FOUND" });

    render(<SettingsPage />);

    const heading = await screen.findByRole("heading", { name: "ODBC للأنظمة القديمة" });
    const bridge = heading.closest("article");
    expect(bridge).not.toBeNull();

    await waitFor(() => expect(within(bridge!).getAllByText("معطل").length).toBeGreaterThan(0));
    expect(within(bridge!).queryByText("خطأ: العنصر غير موجود.")).not.toBeInTheDocument();
  });

  test("saves the selected Whisper processor", async () => {
    client.dropboxConnection.mockResolvedValue({ ok: false });
    client.getSecuritySettings.mockResolvedValue({
      ok: true,
      settings: {
        accessTokenTtlMinutes: 60,
        perUserRateLimit: 60,
        webhookUrlAllowlist: [],
        legacyPasswordUpgrade: true,
        whisperDevice: "cpu",
        cspPolicy: "default-src 'self'",
        corsOrigins: []
      }
    });
    client.odbcStatus.mockResolvedValue({ ok: false, error: "العنصر غير موجود.", code: "NOT_FOUND" });
    client.updateSecuritySettings.mockResolvedValue({
      ok: true,
      settings: {
        accessTokenTtlMinutes: 60,
        perUserRateLimit: 60,
        webhookUrlAllowlist: [],
        legacyPasswordUpgrade: true,
        whisperDevice: "cuda",
        cspPolicy: "default-src 'self'",
        corsOrigins: []
      }
    });

    render(<SettingsPage />);

    const processor = await screen.findByLabelText("المعالج");
    fireEvent.change(processor, { target: { value: "cuda" } });

    await waitFor(() => expect(client.updateSecuritySettings).toHaveBeenCalledWith({ whisperDevice: "cuda" }));
    expect(await screen.findByText("تم حفظ إعداد Whisper. سيُطبق على مهام التفريغ الجديدة.")).toBeInTheDocument();
  });
});

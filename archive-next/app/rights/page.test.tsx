// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import RightsPage from "./page";

vi.mock("@/components/AppShell", () => ({ default: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/PageToolbar", () => ({ default: ({ children, title }: { children: ReactNode; title: string }) => <section aria-label={title}>{children}</section> }));
vi.mock("@/components/RoleGate", () => ({ useCapability: () => true }));
vi.mock("@/components/OperationalSafetyPanel", () => ({ default: () => null }));
vi.mock("@/components/DataViewSwitcher", () => ({ default: ({ value, options, onChange }: { value: string; options: Array<{ value: string; label: string }>; onChange: (v: string) => void }) => <select value={value} onChange={(e) => onChange(e.target.value)}>{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select> }));
vi.mock("@/components/EmptyState", () => ({ default: () => null }));
vi.mock("@/components/ui/Skeleton", () => ({ Skeleton: () => null }));
vi.mock("@/lib/display-settings-context", () => ({ useDisplaySettings: () => ({ settings: { dateFormat: "YYYY-MM-DD", timeFormat: "HH:mm" } }) }));
vi.mock("@/lib/archive-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/archive-api")>();
  return {
    ...actual,
    createArchiveApiClient: () => ({
      expiringRights: vi.fn().mockResolvedValue({ ok: true, records: [
        {
          id: "rights-1",
          itemId: "item-1",
          rightsHolder: "Acme Corp",
          licenseType: "LICENSED",
          expiresAt: "2025-12-31T23:59:59Z",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z"
        }
      ] }),
      rightsEnforcement: vi.fn().mockResolvedValue({ ok: true, itemId: "item-1", decisions: [
        { usage: "broadcast", allowed: false, reason: "No window for broadcast", decidedBy: "no_window_for_usage" },
        { usage: "digital_public", allowed: true, reason: "Window grants digital public", decidedBy: "window-1" }
      ] }),
      rightsWindows: vi.fn().mockResolvedValue({ ok: true, windows: [
        {
          id: "window-1",
          rightsRecordId: "rights-1",
          usage: "digital_public",
          startsAt: "2024-06-01T00:00:00Z",
          endsAt: "2025-12-31T23:59:59Z",
          territories: [],
          platforms: [],
          granted: true
        }
      ] }),
      createRightsWindow: vi.fn().mockResolvedValue({ ok: true, window: { id: "window-2", rightsRecordId: "rights-1", usage: "broadcast", startsAt: null, endsAt: null, territories: [], platforms: [], granted: true } }),
      updateRightsWindow: vi.fn().mockResolvedValue({ ok: true, window: { id: "window-1", rightsRecordId: "rights-1", usage: "digital_public", startsAt: "2024-06-01T00:00:00Z", endsAt: "2025-12-31T23:59:59Z", territories: [], platforms: [], granted: false } }),
      deleteRightsWindow: vi.fn().mockResolvedValue({ ok: true, deleted: true })
    })
  };
});

describe("rights enforcement decisions", () => {
  afterEach(() => cleanup());

  test("shows each decision per usage instead of a single allowed badge", async () => {
    render(<LocaleProvider initialLocale="en" hasLocaleCookie><RightsPage /></LocaleProvider>);

    // Wait for the record to load
    await waitFor(() => expect(screen.getByText("item-1")).toBeInTheDocument());

    // Click to check enforcement
    const checkButton = screen.getByRole("button", { name: "Check enforcement" });
    checkButton.click();

    // Wait for decisions to be rendered
    // Localized usage labels, not the raw enum values the API sends.
    await waitFor(() => expect(screen.getByText(/Broadcast: Blocked/)).toBeInTheDocument());
    expect(screen.getByText(/Digital public: Allowed/)).toBeInTheDocument();
  });

  test("renders empty territories and platforms as unrestricted, not restricted", async () => {
    render(<LocaleProvider initialLocale="en" hasLocaleCookie><RightsPage /></LocaleProvider>);

    // Wait for the record to load
    await waitFor(() => expect(screen.getByText("item-1")).toBeInTheDocument());

    // The id still links to the record, so the windows have their own control.
    expect(screen.getByRole("link", { name: "item-1" })).toHaveAttribute("href", "/archive/item-1");
    screen.getByRole("button", { name: "Rights windows" }).click();

    // Wait for the windows section to appear
    await waitFor(() => expect(screen.getByText(/Rights windows for item-1/)).toBeInTheDocument());

    // Check that empty lists are rendered as "Unrestricted"
    const unrestrictedElements = screen.getAllByText("Unrestricted");
    expect(unrestrictedElements.length).toBeGreaterThan(0);
  });
});

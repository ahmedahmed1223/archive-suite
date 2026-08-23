// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
vi.mock("@/components/ui/ConfirmDialog", () => ({
  useConfirmDialog: () => ({ confirm: vi.fn().mockResolvedValue(true), prompt: vi.fn(), alert: vi.fn() }),
  ConfirmDialogProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import type { OdbcProbe } from "@/lib/archive-api";

const { odbcTable } = vi.hoisted(() => ({
  odbcTable: vi.fn().mockResolvedValue({ ok: true, table: "items", count: 0, rows: [] })
}));

vi.mock("@/lib/archive-api", () => ({
  createArchiveApiClient: () => ({ odbcTable })
}));

import { OdbcBridgePanel } from "./OdbcBridgePanel";

afterEach(cleanup);

const connectedOdbc: OdbcProbe = { enabled: true, driverLoaded: true, dsn: "archive-dsn", status: "connected", tables: ["items", "users"] };

function renderPanel(overrides: Partial<Parameters<typeof OdbcBridgePanel>[0]> = {}) {
  const onSelectedOdbcTableChange = vi.fn();
  render(
    <LocaleProvider initialLocale="ar" hasLocaleCookie={false}>
      <OdbcBridgePanel
        odbc={connectedOdbc}
        isOdbcLoading={false}
        odbcError={null}
        selectedOdbcTable="items"
        onSelectedOdbcTableChange={onSelectedOdbcTableChange}
        {...overrides}
      />
    </LocaleProvider>
  );
  return { onSelectedOdbcTableChange };
}

describe("OdbcBridgePanel", () => {
  test("shows the loading state while the ODBC probe is in flight", () => {
    renderPanel({ odbc: null, isOdbcLoading: true });
    expect(screen.getByText("جارٍ فحص ODBC...")).toBeInTheDocument();
  });

  test("shows the connected status and posture rows", () => {
    renderPanel();
    expect(screen.getAllByText("متصل").length).toBeGreaterThan(0);
    expect(screen.getByText("archive-dsn")).toBeInTheDocument();
  });

  test("loads a table preview when the preview button is clicked", async () => {
    odbcTable.mockResolvedValue({ ok: true, table: "items", count: 1, rows: [{ id: "1", name: "test" }] });
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: /معاينة/ }));

    await waitFor(() => expect(odbcTable).toHaveBeenCalledWith("items", { limit: 10 }));
    await waitFor(() => expect(screen.getByText("test")).toBeInTheDocument());
  });

  test("notifies the parent when a different table is selected", () => {
    const { onSelectedOdbcTableChange } = renderPanel();
    fireEvent.change(screen.getByLabelText("الجدول الأساسي"), { target: { value: "users" } });
    expect(onSelectedOdbcTableChange).toHaveBeenCalledWith("users");
  });
});

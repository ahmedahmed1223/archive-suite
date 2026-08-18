// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";

const { dropboxConnection, testStorageConnection, testDatabaseConnection } = vi.hoisted(() => ({
  dropboxConnection: vi.fn().mockResolvedValue({ ok: true, dropbox: { configured: false, folderPath: null, status: "disconnected" } }),
  testStorageConnection: vi.fn(),
  testDatabaseConnection: vi.fn()
}));

vi.mock("@/lib/archive-api", () => ({
  createArchiveApiClient: () => ({ dropboxConnection, testStorageConnection, testDatabaseConnection })
}));

import { ConnectionTestingPanel } from "./ConnectionTestingPanel";

afterEach(cleanup);

function renderPanel() {
  return render(
    <LocaleProvider initialLocale="ar" hasLocaleCookie={false}>
      <ConnectionTestingPanel />
    </LocaleProvider>
  );
}

describe("ConnectionTestingPanel", () => {
  test("shows the not-connected Dropbox status by default", async () => {
    renderPanel();
    await waitFor(() => expect(dropboxConnection).toHaveBeenCalled());
    expect(screen.getByText("غير متصل. يتطلب الربط بيانات OAuth معتمدة من مسؤول النظام.")).toBeInTheDocument();
  });

  test("runs the local storage test and shows success", async () => {
    testStorageConnection.mockResolvedValue({
      ok: true,
      connection: { status: "connected", driver: "local", message: "تم الاتصال بنجاح.", testedAt: "2026-01-01T00:00:00.000Z" }
    });
    renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "فحص التخزين" }));

    await waitFor(() => expect(screen.getByText("تم الاتصال بنجاح.")).toBeInTheDocument());
  });

  test("blocks the database test when no database name is provided", async () => {
    renderPanel();
    const databaseInput = screen.getByPlaceholderText(":memory: أو /path/to/database.sqlite");
    fireEvent.change(databaseInput, { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "فحص قاعدة البيانات" }));

    await waitFor(() => expect(screen.getByText("أدخل اسم قاعدة البيانات أو مسار ملف SQLite قبل الفحص.")).toBeInTheDocument());
    expect(testDatabaseConnection).not.toHaveBeenCalled();
  });
});

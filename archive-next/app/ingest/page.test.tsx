// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import IngestPage from "./page";

const mocks = vi.hoisted(() => ({
  ingestScan: vi.fn()
}));

vi.mock("@/components/AppShell", () => ({
  default: ({ children }: { children: ReactNode }) => <main>{children}</main>
}));

vi.mock("@/components/RoleGate", () => ({
  useCapability: () => true
}));

vi.mock("@/lib/archive-api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/archive-api")>();
  return {
    ...original,
    createArchiveApiClient: () => ({
      ingestScan: mocks.ingestScan,
      previewWatchedIngest: vi.fn(),
      applyWatchedIngestBatch: vi.fn(),
      ingestFtpPull: vi.fn(),
      ingestSmbPull: vi.fn(),
      ingestDropboxPull: vi.fn()
    })
  };
});

function renderIngest() {
  return render(
    <LocaleProvider initialLocale="en" hasLocaleCookie>
      <IngestPage />
    </LocaleProvider>
  );
}

describe("ingest workflow workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("shows the actual next workflow stage and keeps media job continuation reachable", () => {
    renderIngest();

    expect(screen.getByRole("list", { name: "Ingest workflow" })).toHaveTextContent("Receive source");
    expect(screen.getByRole("link", { name: "Open media jobs" })).toHaveAttribute("href", "/media/jobs");
  });

  test("uses an explicit operation error state when an ingest scan fails", async () => {
    mocks.ingestScan.mockResolvedValue({ ok: false, error: "The ingest directory is unavailable." });
    renderIngest();

    fireEvent.click(screen.getByRole("button", { name: "Start scan" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The ingest directory is unavailable.");
  });
});

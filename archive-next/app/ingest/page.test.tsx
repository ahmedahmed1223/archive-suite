// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import IngestPage from "./page";

const mocks = vi.hoisted(() => ({
  ingestScan: vi.fn(),
  previewWatchedIngest: vi.fn(),
  applyWatchedIngestBatch: vi.fn()
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
      previewWatchedIngest: mocks.previewWatchedIngest,
      applyWatchedIngestBatch: mocks.applyWatchedIngestBatch,
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

  test("presents one flexible five-stage batch workspace", () => {
    renderIngest();

    const workspace = screen.getByRole("region", { name: "Ingest batch workspace" });
    expect(workspace).toHaveTextContent("Source");
    expect(workspace).toHaveTextContent("Inventory and preview");
    expect(workspace).toHaveTextContent("Metadata and rights");
    expect(workspace).toHaveTextContent("Processing");
    expect(workspace).toHaveTextContent("Review and decision");
    expect(workspace).toHaveTextContent("No batch created yet");
  });

  test("lets an operator revisit a reachable workflow stage without starting an operation", () => {
    renderIngest();

    fireEvent.click(screen.getByRole("button", { name: "Metadata and rights" }));

    expect(screen.getByRole("region", { name: "Current ingest stage" })).toHaveTextContent(
      "Metadata is completed on the archive record after material is received."
    );
    expect(mocks.ingestScan).not.toHaveBeenCalled();
  });

  test("uses an explicit operation error state when an ingest scan fails", async () => {
    mocks.ingestScan.mockResolvedValue({ ok: false, error: "The ingest directory is unavailable." });
    renderIngest();

    fireEvent.click(screen.getByRole("button", { name: "Start scan" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The ingest directory is unavailable.");
  });

  test("links each received record directly into its description and inspection work", async () => {
    mocks.ingestScan.mockResolvedValue({ ok: true, ingested: [{ id: "record-9", fileName: "reel.mov" }], skipped: 0 });
    renderIngest();

    fireEvent.click(screen.getByRole("button", { name: "Start scan" }));

    expect(await screen.findByRole("link", { name: "Open reel.mov" })).toHaveAttribute("href", "/archive/record-9");
  });

  test("keeps watched-folder preview separate from record creation", async () => {
    mocks.previewWatchedIngest.mockResolvedValue({
      ok: true,
      batch: {
        id: "batch-1",
        status: "pending",
        entries: [{ id: "entry-1", fileName: "reel.mov", status: "pending", routing: null, reason: null }]
      }
    });

    renderIngest();
    fireEvent.click(screen.getByRole("button", { name: /Watched folder/ }));
    fireEvent.click(screen.getByRole("button", { name: "Preview batch" }));

    expect((await screen.findAllByText("Preview ready for approval")).length).toBeGreaterThan(0);
    expect(screen.getByRole("list", { name: "Ingest workflow" })).toHaveTextContent("A record is created when new material is ingested");
    expect(screen.getByRole("list", { name: "Ingest workflow" })).not.toHaveTextContent("The operation created records for ingested material");
    expect(screen.getByRole("region", { name: "Ingest batch workspace" })).toHaveTextContent("1 material");
    expect(screen.getByRole("region", { name: "Ingest batch workspace" })).toHaveTextContent("0 accepted");
  });

  test("marks records created only for applied watched entries", async () => {
    mocks.previewWatchedIngest.mockResolvedValue({
      ok: true,
      batch: {
        id: "batch-1",
        status: "pending",
        entries: [{ id: "entry-1", fileName: "reel.mov", status: "pending", routing: null, reason: null }]
      }
    });
    mocks.applyWatchedIngestBatch.mockResolvedValue({
      ok: true,
      batch: {
        id: "batch-1",
        status: "applied",
        entries: [{ id: "entry-1", fileName: "reel.mov", status: "applied", routing: null, reason: null }]
      }
    });

    renderIngest();
    fireEvent.click(screen.getByRole("button", { name: /Watched folder/ }));
    fireEvent.click(screen.getByRole("button", { name: "Preview batch" }));
    await screen.findAllByText("Preview ready for approval");
    fireEvent.click(screen.getByRole("button", { name: "Approve and ingest" }));

    expect(await screen.findByText("The operation created records for ingested material")).toBeVisible();
    expect((await screen.findAllByText("1 ingested")).length).toBeGreaterThan(0);
  });

  test("keeps record creation pending when an applied watched batch is empty", async () => {
    mocks.previewWatchedIngest.mockResolvedValue({ ok: true, batch: { id: "batch-1", status: "pending", entries: [] } });
    mocks.applyWatchedIngestBatch.mockResolvedValue({ ok: true, batch: { id: "batch-1", status: "applied", entries: [] } });

    renderIngest();
    fireEvent.click(screen.getByRole("button", { name: /Watched folder/ }));
    fireEvent.click(screen.getByRole("button", { name: "Preview batch" }));
    await screen.findByText("No stable material is in this batch yet");
    fireEvent.click(screen.getByRole("button", { name: "Approve and ingest" }));

    expect(await screen.findByText("No records were created because this batch has no material")).toBeVisible();
    expect(screen.getByRole("list", { name: "Ingest workflow" })).toHaveTextContent("A record is created when new material is ingested");
  });

  test("keeps the applied count honest when other watched entries need review", async () => {
    mocks.previewWatchedIngest.mockResolvedValue({
      ok: true,
      batch: {
        id: "batch-1", status: "pending",
        entries: [
          { id: "entry-1", fileName: "reel.mov", status: "pending", routing: null, reason: null },
          { id: "entry-2", fileName: "bad.mov", status: "quarantined", routing: null, reason: "Unreadable" }
        ]
      }
    });
    mocks.applyWatchedIngestBatch.mockResolvedValue({
      ok: true,
      batch: {
        id: "batch-1", status: "applied",
        entries: [
          { id: "entry-1", fileName: "reel.mov", status: "applied", routing: null, reason: null },
          { id: "entry-2", fileName: "bad.mov", status: "quarantined", routing: null, reason: "Unreadable" }
        ]
      }
    });

    renderIngest();
    fireEvent.click(screen.getByRole("button", { name: /Watched folder/ }));
    fireEvent.click(screen.getByRole("button", { name: "Preview batch" }));
    await screen.findByText("Some batch files need attention");
    fireEvent.click(screen.getByRole("button", { name: "Approve and ingest" }));

    expect((await screen.findAllByText("1 ingested")).length).toBeGreaterThan(0);
    expect(screen.getByText("Ingested 1 items and skipped 1.")).toBeVisible();
  });
});

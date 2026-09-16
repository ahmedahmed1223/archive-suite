// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import IngestPage from "./page";

const mocks = vi.hoisted(() => ({
  ingestScan: vi.fn(),
  previewWatchedIngest: vi.fn(),
  applyWatchedIngestBatch: vi.fn(),
  useCapability: vi.fn(() => true)
}));

vi.mock("@/components/AppShell", () => ({
  default: ({ children }: { children: ReactNode }) => <main>{children}</main>
}));

vi.mock("@/components/RoleGate", () => ({
  useCapability: mocks.useCapability
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

/** Drives the wizard from an empty draft up to (and including) a completed scan preview. */
async function advanceScanToPreview() {
  fireEvent.click(screen.getByRole("button", { name: "Server folder" }));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  mocks.ingestScan.mockResolvedValue({ ok: true, ingested: [{ id: "record-9", fileName: "reel.mov" }], skipped: 0 });
  fireEvent.click(screen.getByRole("button", { name: "Start scan" }));
  await screen.findByText("Scan the ingest folder completed");
}

/** Drives the wizard all the way to the decision step (scan source). */
async function advanceScanToDecision() {
  await advanceScanToPreview();
  fireEvent.click(screen.getByRole("button", { name: "Next" })); // -> metadata
  fireEvent.change(screen.getByLabelText("Destination project or collection *"), { target: { value: "2026 field recordings" } });
  fireEvent.click(screen.getByLabelText(/confirm the rights/));
  fireEvent.click(screen.getByRole("button", { name: "Next" })); // -> inspection
  fireEvent.click(screen.getByLabelText(/requested, or reviewed, the technical probe/));
  fireEvent.click(screen.getByRole("button", { name: "Next" })); // -> decision
}

describe("ingest intake wizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useCapability.mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("renders the five ordered steps with the source step current", () => {
    renderIngest();

    const stepper = screen.getByRole("list", { name: "Intake steps" });
    expect(stepper).toHaveTextContent("Source");
    expect(stepper).toHaveTextContent("Preview");
    expect(stepper).toHaveTextContent("Metadata & rights");
    expect(stepper).toHaveTextContent("Inspection");
    expect(stepper).toHaveTextContent("Accept/quarantine");

    expect(screen.getByRole("button", { name: /^Source/ })).toHaveAttribute("aria-current", "step");
  });

  test("blocks advancing past the source step until a source is chosen and configured", () => {
    renderIngest();

    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Server folder" }));
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  test("keeps a connection-parameter source blocked until its required fields are filled in", () => {
    renderIngest();

    fireEvent.click(screen.getByRole("button", { name: "SMB" }));
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Share *"), { target: { value: "\\\\server\\share" } });
    fireEvent.change(screen.getByLabelText("User *"), { target: { value: "operator" } });
    fireEvent.change(screen.getByLabelText("Password *"), { target: { value: "secret" } });
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  test("cannot jump ahead to an unreached step from the stepper", () => {
    renderIngest();

    // Inspection is three steps ahead of an unconfigured source -- clicking it must not move the wizard.
    fireEvent.click(screen.getByRole("button", { name: /^Inspection/ }));
    expect(screen.getByRole("button", { name: /^Source/ })).toHaveAttribute("aria-current", "step");
  });

  test("advances through preview, metadata, inspection to the decision step", async () => {
    renderIngest();
    await advanceScanToDecision();

    expect(screen.getByRole("button", { name: /^Accept\/quarantine/ })).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("button", { name: "Accept into the archive" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Quarantine for review" })).toBeInTheDocument();
  });

  test("records an explicit accept decision -- never a default", async () => {
    renderIngest();
    await advanceScanToDecision();

    fireEvent.click(screen.getByRole("button", { name: "Accept into the archive" }));
    expect((await screen.findAllByText("Accepted into the archive.")).length).toBeGreaterThan(0);
  });

  test("records an explicit quarantine decision as an equally reachable terminal", async () => {
    renderIngest();
    await advanceScanToDecision();

    fireEvent.click(screen.getByRole("button", { name: "Quarantine for review" }));
    expect((await screen.findAllByText("Quarantined for review.")).length).toBeGreaterThan(0);
  });

  test("back-navigation to an earlier step invalidates the steps after it", async () => {
    renderIngest();
    await advanceScanToPreview();
    fireEvent.click(screen.getByRole("button", { name: "Next" })); // -> metadata
    fireEvent.change(screen.getByLabelText("Destination project or collection *"), { target: { value: "2026 field recordings" } });
    fireEvent.click(screen.getByLabelText(/confirm the rights/));

    // Jump back to the source step -- everything after it, including this rights confirmation, must be cleared.
    fireEvent.click(screen.getByRole("button", { name: /^Source/ }));
    expect(screen.getByRole("button", { name: /^Source/ })).toHaveAttribute("aria-current", "step");

    fireEvent.click(screen.getByRole("button", { name: "Next" })); // -> preview again
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled(); // preview must be redone

    mocks.ingestScan.mockResolvedValue({ ok: true, ingested: [], skipped: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Start scan" }));
    await screen.findByText("Scan the ingest folder completed");
    fireEvent.click(screen.getByRole("button", { name: "Next" })); // -> metadata

    // The previously confirmed rights checkbox is gone -- nothing carried over.
    expect(screen.getByLabelText(/confirm the rights/)).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  test("switching source invalidates a completed preview", async () => {
    renderIngest();
    await advanceScanToPreview();

    fireEvent.click(screen.getByRole("button", { name: "Next" })); // -> metadata, preview was valid
    fireEvent.click(screen.getByRole("button", { name: /^Source/ }));
    fireEvent.click(screen.getByRole("button", { name: "FTP/FTPS" }));

    fireEvent.click(screen.getByRole("button", { name: "Next" })); // blocked: FTP has no connection details yet
    expect(screen.getByRole("button", { name: /^Source/ })).toHaveAttribute("aria-current", "step");
  });

  test("uses an explicit operation error state when an ingest scan fails", async () => {
    mocks.ingestScan.mockResolvedValue({ ok: false, error: "The ingest directory is unavailable." });
    renderIngest();

    fireEvent.click(screen.getByRole("button", { name: "Server folder" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Start scan" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The ingest directory is unavailable.");
    // A failed preview keeps the wizard from advancing.
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  test("links each received record directly into its description and inspection work", async () => {
    renderIngest();
    await advanceScanToPreview();

    expect(screen.getByRole("link", { name: "Open reel.mov" })).toHaveAttribute("href", "/archive/record-9");
    expect(screen.getByRole("link", { name: "Open media jobs" })).toHaveAttribute("href", "/media/jobs");
  });

  test("keeps watched-folder preview separate from record creation, and gates approval on confirmed rights", async () => {
    mocks.previewWatchedIngest.mockResolvedValue({
      ok: true,
      batch: {
        id: "batch-1",
        status: "pending",
        entries: [{ id: "entry-1", fileName: "reel.mov", status: "pending", routing: null, reason: null }]
      }
    });

    renderIngest();
    fireEvent.click(screen.getByRole("button", { name: "Watched folder" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByRole("button", { name: "Preview batch" }));
    expect((await screen.findAllByText("Preview ready for approval")).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Next" })); // -> metadata
    fireEvent.change(screen.getByLabelText("Destination project or collection *"), { target: { value: "Watched intake" } });

    // Approval is blocked until rights are confirmed.
    expect(screen.getByRole("button", { name: "Approve and ingest" })).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/confirm the rights/));
    expect(screen.getByRole("button", { name: "Approve and ingest" })).toBeEnabled();

    mocks.applyWatchedIngestBatch.mockResolvedValue({
      ok: true,
      batch: {
        id: "batch-1",
        status: "applied",
        entries: [{ id: "entry-1", fileName: "reel.mov", status: "applied", recordId: "record-9", routing: null, reason: null }]
      }
    });
    fireEvent.click(screen.getByRole("button", { name: "Approve and ingest" }));

    expect(await screen.findByText("Watched folder completed")).toBeVisible();
    expect(screen.getByRole("link", { name: "Open reel.mov" })).toHaveAttribute("href", "/archive/record-9");
  });

  test("respects the ingest.manage capability by explaining why actions are unavailable, without a bare disabled button", () => {
    mocks.useCapability.mockReturnValue(false);
    renderIngest();

    fireEvent.click(screen.getByRole("button", { name: "Server folder" }));
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("You do not have permission to run ingest; you can only review results.")).toBeVisible();
  });
});

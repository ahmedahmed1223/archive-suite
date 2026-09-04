// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import { MediaJobsList } from "./MediaJobsList";

const mocks = vi.hoisted(() => ({
  cancelMediaJob: vi.fn(),
  createMediaJob: vi.fn(),
  ingestScan: vi.fn(),
  mediaJobQueueStatus: vi.fn(),
  mediaJobs: vi.fn(),
  onConnectionStateChange: vi.fn()
}));

vi.mock("@/lib/archive-api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/archive-api")>();
  return {
    ...original,
    createArchiveApiClient: () => ({
      cancelMediaJob: mocks.cancelMediaJob,
      createMediaJob: mocks.createMediaJob,
      ingestScan: mocks.ingestScan,
      mediaJobQueueStatus: mocks.mediaJobQueueStatus,
      mediaJobs: mocks.mediaJobs
    })
  };
});

vi.mock("@/lib/echo", () => ({
  getEchoClient: () => null,
  onConnectionStateChange: mocks.onConnectionStateChange
}));

function mediaJob(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-102",
    recordId: "record-42",
    operation: "media_probe",
    status: "queued",
    progressStage: "Waiting for a worker",
    progressPercent: 0,
    executor: "archive-media-v1",
    contractVersion: 1,
    sourcePath: "ingest/reel.mov",
    options: {},
    result: null,
    error: null,
    queuedAt: "2026-09-04T08:15:00Z",
    startedAt: null,
    completedAt: null,
    ...overrides
  };
}

function renderJobs() {
  return render(
    <LocaleProvider initialLocale="en" hasLocaleCookie>
      <MediaJobsList />
    </LocaleProvider>
  );
}

describe("MediaJobsList workflow workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.onConnectionStateChange.mockReturnValue(() => undefined);
    mocks.mediaJobQueueStatus.mockResolvedValue({ ok: true, status: { default: 0, gpu: 0, device: "cpu", resourceFailure: null } });
    mocks.createMediaJob.mockResolvedValue({ ok: true, job: mediaJob() });
    mocks.ingestScan.mockResolvedValue({ ok: true, ingested: [], skipped: 0 });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  test("shows the current workflow stage and links an active job to its archive record and review workspace", async () => {
    mocks.mediaJobs.mockResolvedValue({ ok: true, jobs: [mediaJob()], pagination: { page: 1, limit: 20, total: 1, hasMore: false } });

    renderJobs();

    expect(await screen.findByRole("list", { name: "Archive video workflow" })).toHaveTextContent("Technical processing");
    expect(screen.getByRole("link", { name: "Open archive record" })).toHaveAttribute("href", "/archive/record-42");
    expect(screen.getByRole("link", { name: "Open media review" })).toHaveAttribute("href", "/media/studio?recordId=record-42");
  });

  test("keeps a technical probe report in its job context", async () => {
    mocks.mediaJobs.mockResolvedValue({
      ok: true,
      jobs: [mediaJob({
        status: "completed",
        progressPercent: 100,
        result: {
          artifacts: [{
            kind: "media_probe_report",
            report: {
              formatNames: ["QuickTime / MOV"],
              durationSeconds: 32,
              sizeBytes: 1048576,
              bitRate: 256000,
              streams: [{ index: 0, type: "video", codec: "h264", width: 1920, height: 1080, language: null }]
            }
          }]
        },
        completedAt: "2026-09-04T08:20:00Z"
      })],
      pagination: { page: 1, limit: 20, total: 1, hasMore: false }
    });

    renderJobs();

    expect(await screen.findByRole("complementary", { name: "Technical report context" })).toHaveTextContent("QuickTime / MOV");
    expect(screen.getByText("Technical report")).toBeVisible();
  });

  test("provides failure details and guidance when one job fails while another continues", async () => {
    mocks.mediaJobs.mockResolvedValue({
      ok: true,
      jobs: [
        mediaJob({ status: "processing", progressPercent: 44, progressStage: "Transcoding" }),
        mediaJob({ id: "job-103", status: "failed", error: "The source file could not be read." })
      ],
      pagination: { page: 1, limit: 20, total: 2, hasMore: false }
    });

    renderJobs();

    expect(await screen.findByText("Some media work needs attention")).toBeVisible();
    expect(screen.getByText("The source file could not be read.")).toBeVisible();
    expect(screen.getByText("Retry guidance")).toBeVisible();
  });

  test("cancels an active job using the supported API and reflects the returned state", async () => {
    mocks.mediaJobs.mockResolvedValue({ ok: true, jobs: [mediaJob({ status: "processing", progressPercent: 44 })], pagination: { page: 1, limit: 20, total: 1, hasMore: false } });
    mocks.cancelMediaJob.mockResolvedValue({ ok: true, job: mediaJob({ status: "canceled", progressPercent: 44 }) });

    renderJobs();

    fireEvent.click(await screen.findByRole("button", { name: "Cancel job" }));

    await waitFor(() => expect(mocks.cancelMediaJob).toHaveBeenCalledWith("job-102"));
    expect((await screen.findAllByText("Canceled")).length).toBeGreaterThan(0);
  });

  test("presents an explicit empty state when no media jobs exist", async () => {
    mocks.mediaJobs.mockResolvedValue({ ok: true, jobs: [], pagination: { page: 1, limit: 20, total: 0, hasMore: false } });

    renderJobs();

    expect(await screen.findByText("No media jobs yet.")).toBeVisible();
  });

  test("announces the polling fallback when live updates are unavailable", async () => {
    mocks.mediaJobs.mockResolvedValue({ ok: true, jobs: [mediaJob({ status: "processing" })], pagination: { page: 1, limit: 20, total: 1, hasMore: false } });
    let notifyConnection: ((state: "disconnected") => void) | undefined;
    mocks.onConnectionStateChange.mockImplementation((listener) => {
      notifyConnection = listener;
      return () => undefined;
    });

    renderJobs();
    await screen.findByText(/^record-42$/);
    await waitFor(() => expect(mocks.onConnectionStateChange).toHaveBeenCalled());
    act(() => notifyConnection?.("disconnected"));

    expect(await screen.findByText("Realtime updates are unavailable")).toBeVisible();
  });
});

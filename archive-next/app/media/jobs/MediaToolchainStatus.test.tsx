// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import { MediaToolchainStatus } from "./MediaToolchainStatus";

const mocks = vi.hoisted(() => ({
  mediaToolchainStatus: vi.fn()
}));

vi.mock("@/lib/archive-api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/archive-api")>();
  return {
    ...original,
    createArchiveApiClient: () => ({
      mediaToolchainStatus: mocks.mediaToolchainStatus
    })
  };
});

function renderPanel() {
  return render(
    <LocaleProvider initialLocale="en" hasLocaleCookie>
      <MediaToolchainStatus />
    </LocaleProvider>
  );
}

function component(overrides: Record<string, unknown> = {}) {
  return {
    key: "ffmpeg",
    status: "available",
    detail: "ffmpeg is installed and available on this server.",
    configHint: null,
    ...overrides
  };
}

describe("MediaToolchainStatus panel", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("shows a busy status notice while the panel loads", () => {
    mocks.mediaToolchainStatus.mockReturnValue(new Promise(() => {}));

    renderPanel();

    expect(screen.getByRole("status")).toHaveTextContent("Checking the media-processing toolchain...");
  });

  test("lists every independent component with a text label alongside its status, not color alone", async () => {
    mocks.mediaToolchainStatus.mockResolvedValue({
      ok: true,
      checkedAt: "2026-09-13T10:00:00+00:00",
      components: [
        component({ key: "ffmpeg", status: "available", detail: "ffmpeg is installed and available on this server." }),
        component({
          key: "gpu",
          status: "needs_configuration",
          detail: "The transcription device is set to CUDA but no GPU is visible on this worker.",
          configHint: "Deploy a worker with the NVIDIA Container Toolkit (laravel-worker-gpu)."
        }),
        component({ key: "reverb", status: "stopped", detail: "Reverb broadcasting is not currently in use (driver: log)." })
      ]
    });

    renderPanel();

    expect(await screen.findByText("FFmpeg")).toBeVisible();
    expect(screen.getByText("Available")).toBeVisible();
    expect(screen.getByText("GPU")).toBeVisible();
    expect(screen.getByText("Needs configuration")).toBeVisible();
    expect(screen.getByText("Deploy a worker with the NVIDIA Container Toolkit (laravel-worker-gpu).")).toBeVisible();
    expect(screen.getByText("Reverb")).toBeVisible();
    expect(screen.getByText("Stopped")).toBeVisible();
    expect(screen.getByRole("region", { name: "Media processing toolchain status" })).toBeInTheDocument();
  });

  test("shows an empty-state notice with a retry action when no components are reported", async () => {
    mocks.mediaToolchainStatus.mockResolvedValue({ ok: true, checkedAt: "2026-09-13T10:00:00+00:00", components: [] });

    renderPanel();

    expect(await screen.findByText("No toolchain status is available right now.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  test("shows a recoverable error notice when the status request fails", async () => {
    mocks.mediaToolchainStatus.mockResolvedValue({ ok: false, error: "Server error." });

    renderPanel();

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Unable to load toolchain status: Server error."));
  });
});

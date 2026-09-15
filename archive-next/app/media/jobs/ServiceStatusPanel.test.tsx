// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { ServiceStatusPanel } from "./ServiceStatusPanel";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";

const systemServices = vi.hoisted(() => vi.fn());

// The panel used to call fetch() directly, which sent no session and answered
// 401 on every load. Mocking the client rather than global fetch keeps that
// regression visible: a panel that bypassed the client would not be exercised
// by these tests at all.
vi.mock("@/lib/archive-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/archive-api")>()),
  createArchiveApiClient: () => ({ systemServices }),
}));

const ALL_AVAILABLE = {
  ffmpeg: { state: "available", reason: null },
  ffprobe: { state: "available", reason: null },
  whisper: { state: "available", reason: null },
  reverb: { state: "available", reason: null },
  gpu: { state: "available", reason: null },
  storage: {},
};

function renderComponent() {
  return render(
    <LocaleProvider initialLocale="en" hasLocaleCookie={false}>
      <ServiceStatusPanel />
    </LocaleProvider>
  );
}

beforeEach(() => {
  systemServices.mockReset();
});

afterEach(cleanup);

describe("ServiceStatusPanel", () => {
  it("displays loading state initially", async () => {
    let release: (value: unknown) => void = () => {};
    systemServices.mockImplementation(() => new Promise((resolve) => { release = resolve; }));

    renderComponent();

    expect(screen.getByText(/loading service status/i)).toBeInTheDocument();
    release({ ok: true, services: ALL_AVAILABLE });
    await screen.findByText("Service status");
  });

  it("displays services when successfully loaded", async () => {
    systemServices.mockResolvedValue({
      ok: true,
      services: {
        ...ALL_AVAILABLE,
        whisper: { state: "requires_setup", reason: "WHISPER_ENDPOINT not configured" },
        gpu: { state: "down", reason: "GPU probe failed" },
        storage: {
          local: { state: "available", reason: null },
          s3: { state: "down", reason: "Storage connector unavailable" },
        },
      },
    });

    renderComponent();

    await waitFor(() => expect(screen.getByText("Service status")).toBeInTheDocument());
    expect(screen.getByText(/ffmpeg/i)).toBeInTheDocument();
    expect(screen.getAllByText(/available/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/setup required/i)).toBeInTheDocument();
    expect(screen.getAllByText(/unavailable/i).length).toBeGreaterThan(0);
  });

  it("reports a refused read instead of an empty panel", async () => {
    systemServices.mockResolvedValue({ ok: false, error: "لا تملك صلاحية لتنفيذ هذا الإجراء.", code: "FORBIDDEN" });

    renderComponent();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("لا تملك صلاحية لتنفيذ هذا الإجراء.");
  });

  it("displays service-specific reason text when available", async () => {
    systemServices.mockResolvedValue({
      ok: true,
      services: { ...ALL_AVAILABLE, gpu: { state: "down", reason: "GPU probe failed" } },
    });

    renderComponent();

    await waitFor(() => expect(screen.getByText("GPU probe failed")).toBeInTheDocument());
  });

  it("displays storage connectors separately", async () => {
    systemServices.mockResolvedValue({
      ok: true,
      services: {
        ...ALL_AVAILABLE,
        storage: {
          local: { state: "available", reason: null },
          s3: { state: "down", reason: "Storage connector unavailable" },
        },
      },
    });

    renderComponent();

    await waitFor(() => expect(screen.getByText(/storage connectors/i)).toBeInTheDocument());
  });

  it("stops refreshing once it leaves the page", async () => {
    systemServices.mockResolvedValue({ ok: true, services: ALL_AVAILABLE });

    const { unmount } = renderComponent();

    await waitFor(() => expect(systemServices).toHaveBeenCalledTimes(1));
    unmount();
    expect(systemServices).toHaveBeenCalledTimes(1);
  });
});

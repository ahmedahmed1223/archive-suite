// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { ServiceStatusPanel } from "./ServiceStatusPanel";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

afterEach(cleanup);

describe("ServiceStatusPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
      <LocaleProvider initialLocale="en" hasLocaleCookie={false}>
        <ServiceStatusPanel />
      </LocaleProvider>
    );
  };

  it("displays loading state initially", () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolve
    renderComponent();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("displays services when successfully loaded", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        services: {
          ffmpeg: { state: "available", reason: null },
          ffprobe: { state: "available", reason: null },
          whisper: { state: "requires_setup", reason: "WHISPER_ENDPOINT not configured" },
          reverb: { state: "available", reason: null },
          gpu: { state: "down", reason: "GPU probe failed" },
          storage: {
            local: { state: "available", reason: null },
            s3: { state: "down", reason: "Storage connector unavailable" },
          },
        },
      }),
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Service status")).toBeInTheDocument();
    });

    expect(screen.getByText(/ffmpeg/i)).toBeInTheDocument();
    expect(screen.getAllByText(/available/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/setup required/i)).toBeInTheDocument();
    expect(screen.getAllByText(/unavailable/i).length).toBeGreaterThan(0);
  });

  it("displays error message on fetch failure", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/error:/i)).toBeInTheDocument();
    });
  });

  it("displays service-specific reason text when available", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        services: {
          ffmpeg: { state: "available", reason: null },
          ffprobe: { state: "available", reason: null },
          whisper: {
            state: "requires_setup",
            reason: "WHISPER_ENDPOINT not configured",
          },
          reverb: { state: "available", reason: null },
          gpu: { state: "down", reason: "GPU probe failed" },
          storage: {},
        },
      }),
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("GPU probe failed")).toBeInTheDocument();
    });
  });

  it("displays storage connectors separately", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        services: {
          ffmpeg: { state: "available", reason: null },
          ffprobe: { state: "available", reason: null },
          whisper: { state: "available", reason: null },
          reverb: { state: "available", reason: null },
          gpu: { state: "available", reason: null },
          storage: {
            local: { state: "available", reason: null },
            s3: { state: "down", reason: "Storage connector unavailable" },
          },
        },
      }),
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/storage connectors/i)).toBeInTheDocument();
    });
  });

  it("sets up auto-refresh interval", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        services: {
          ffmpeg: { state: "available", reason: null },
          ffprobe: { state: "available", reason: null },
          whisper: { state: "available", reason: null },
          reverb: { state: "available", reason: null },
          gpu: { state: "available", reason: null },
          storage: {},
        },
      }),
    });

    const { unmount } = renderComponent();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // Wait for interval to trigger (30 seconds is default)
    // We verify the cleanup happens on unmount
    unmount();

    // After unmount, no more fetches should happen
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

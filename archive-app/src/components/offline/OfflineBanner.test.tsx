/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

import { OfflineBanner } from "./OfflineBanner.jsx";

let mockConnectivity = { isOnline: true, lastCheckedAt: null, isLocalBackend: true };
let mockSettings = { ui: {} };
let mockUpdateSettings = vi.fn();

vi.mock("../../features/offline/connectivityProbe.js", () => ({
  useConnectivity: () => mockConnectivity
}));

vi.mock("../../features/offline/offlineQueue.js", () => ({
  getOfflineQueueCount: () => 0,
  replayOfflineQueue: vi.fn()
}));

vi.mock("../../stores/index.js", () => ({
  useAppStore: (selector: (state: any) => unknown) => {
    const mockSettingsState = { settings: mockSettings, updateSettings: mockUpdateSettings };
    return typeof selector === "function" ? selector(mockSettingsState) : mockSettingsState;
  }
}));

describe("OfflineBanner", () => {
  beforeEach(() => {
    cleanup();
    mockSettings = { ui: {} };
    mockUpdateSettings = vi.fn();
  });

  it("stays hidden in local backend mode even when offline", () => {
    mockConnectivity = { isOnline: false, lastCheckedAt: null, isLocalBackend: true };
    render(<OfflineBanner />);
    expect(screen.queryByText("لا يوجد اتصال بالإنترنت")).toBeNull();
  });

  it("shows the bar with dismiss controls when offline on a remote backend", () => {
    mockConnectivity = { isOnline: false, lastCheckedAt: null, isLocalBackend: false };
    render(<OfflineBanner />);
    expect(screen.getByText("لا يوجد اتصال بالإنترنت")).toBeInTheDocument();
    expect(screen.getByText("لا تظهر مجدداً")).toBeInTheDocument();
    expect(screen.getByLabelText("إغلاق التنبيه")).toBeInTheDocument();
  });

  it("clicking the X hides the bar for this session without persisting", () => {
    mockConnectivity = { isOnline: false, lastCheckedAt: null, isLocalBackend: false };
    render(<OfflineBanner />);
    fireEvent.click(screen.getByLabelText("إغلاق التنبيه"));
    expect(screen.queryByText("لا يوجد اتصال بالإنترنت")).toBeNull();
    expect(mockUpdateSettings).not.toHaveBeenCalled();
  });

  it("clicking 'don't show again' persists the dismiss to settings", () => {
    mockConnectivity = { isOnline: false, lastCheckedAt: null, isLocalBackend: false };
    render(<OfflineBanner />);
    fireEvent.click(screen.getByText("لا تظهر مجدداً"));
    expect(mockUpdateSettings).toHaveBeenCalledWith({
      ui: { offlineBannerDismissed: true }
    });
    expect(screen.queryByText("لا يوجد اتصال بالإنترنت")).toBeNull();
  });

  it("respects a persisted dismiss across mounts", () => {
    mockConnectivity = { isOnline: false, lastCheckedAt: null, isLocalBackend: false };
    mockSettings = { ui: { offlineBannerDismissed: true } };
    render(<OfflineBanner />);
    expect(screen.queryByText("لا يوجد اتصال بالإنترنت")).toBeNull();
  });
});

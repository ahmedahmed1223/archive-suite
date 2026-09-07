// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import type { ArchiveRecord, MediaInspection } from "@/lib/archive-api";

const { mediaInspections } = vi.hoisted(() => ({ mediaInspections: vi.fn() }));

vi.mock("@/lib/archive-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/archive-api")>("@/lib/archive-api");
  return { ...actual, createArchiveApiClient: () => ({ mediaInspections }) };
});

import MediaInspectionsPanel from "./MediaInspectionsPanel";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function inspection(overrides: Partial<MediaInspection> = {}): MediaInspection {
  return {
    id: "inspection-1",
    recordStore: "archive-items",
    recordUid: "record-1",
    inspectionType: "probe",
    status: "completed",
    versionToken: "record:checksum-1",
    isCurrentVersion: true,
    report: {
      formatNames: ["mov"],
      formatLongName: "QuickTime / MOV",
      durationSeconds: 83.5,
      sizeBytes: 1048576,
      bitRate: 2_500_000,
      tags: {},
      streams: []
    },
    mediaJobId: "job-1",
    completedAt: "2026-09-07T10:00:00.000Z",
    ...overrides
  };
}

describe("MediaInspectionsPanel", () => {
  test("shows a current, persisted technical probe instead of burying it in job history", async () => {
    mediaInspections.mockResolvedValue({ ok: true, inspections: [inspection()] });

    render(
      <LocaleProvider initialLocale="ar" hasLocaleCookie={false}>
        <MediaInspectionsPanel record={{ id: "record-1", store: "archive-items" } as ArchiveRecord} />
      </LocaleProvider>
    );

    await waitFor(() => expect(mediaInspections).toHaveBeenCalledWith("record-1", { store: "archive-items" }));
    expect(screen.getByRole("heading", { name: "الفحص التقني" })).toBeInTheDocument();
    expect(screen.getByText("مطابق للنسخة الحالية")).toBeInTheDocument();
    expect(screen.getByText("QuickTime / MOV")).toBeInTheDocument();
    expect(screen.getByText("٨٣٫٥ ث")).toBeInTheDocument();
  });
});

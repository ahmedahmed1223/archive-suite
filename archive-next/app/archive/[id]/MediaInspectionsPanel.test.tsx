// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import type { ArchiveRecord, MediaInspection } from "@/lib/archive-api";

const { mediaInspections, overrideMediaQc } = vi.hoisted(() => ({ mediaInspections: vi.fn(), overrideMediaQc: vi.fn() }));

vi.mock("@/lib/archive-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/archive-api")>("@/lib/archive-api");
  return { ...actual, createArchiveApiClient: () => ({ mediaInspections, overrideMediaQc }) };
});

vi.mock("@/lib/auth-session", () => ({
  useAuthSession: () => ({ user: { id: "admin-1", role: "admin" } })
}));

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
    qcOverride: false,
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

  test("shows persisted QC failures as operational findings, not a generic job error", async () => {
    mediaInspections.mockResolvedValue({
      ok: true,
      inspections: [{
        ...inspection(),
        inspectionType: "qc",
        status: "failed",
        report: {
          status: "failed",
          findings: [{ rule: "audio_clipping", startSeconds: 0, endSeconds: null, status: "failed", evidence: "Maximum audio level: -0.2 dB." }],
          metrics: { maxVolumeDb: -0.2 }
        }
      }]
    });

    render(
      <LocaleProvider initialLocale="ar" hasLocaleCookie={false}>
        <MediaInspectionsPanel record={{ id: "record-1", store: "archive-items" } as ArchiveRecord} />
      </LocaleProvider>
    );

    expect(await screen.findByText("فحص الجودة" )).toBeInTheDocument();
    expect(screen.getAllByText("فشل")).toHaveLength(2);
    expect(screen.getByText("ذروة صوت مرتفعة")).toBeInTheDocument();
  });

  test("shows an authorized QC override without rewriting the failed technical finding", async () => {
    mediaInspections.mockResolvedValue({ ok: true, inspections: [{ ...inspection(), inspectionType: "qc", status: "failed", qcOverride: true, report: { status: "failed", findings: [], metrics: {} } }] });
    render(<LocaleProvider initialLocale="ar" hasLocaleCookie={false}><MediaInspectionsPanel record={{ id: "record-1", store: "archive-items" } as ArchiveRecord} /></LocaleProvider>);
    expect(await screen.findByText("تم التجاوز")).toBeInTheDocument();
    expect(screen.getByText("السماح بالتصدير يستند إلى تجاوز موثق؛ تبقى نتيجة الفحص الفني الأصلية محفوظة دون تعديل.")).toBeInTheDocument();
  });

  test("lets an administrator document a reason before overriding a current QC failure", async () => {
    mediaInspections.mockResolvedValue({ ok: true, inspections: [{ ...inspection(), inspectionType: "qc", status: "failed", report: { status: "failed", findings: [], metrics: {} } }] });
    overrideMediaQc.mockResolvedValue({ ok: true, override: { id: "override-1", inspectionId: "inspection-1", reason: "مرجع المصدر معتمد رغم الخلل.", overriddenAt: "2026-09-09T10:00:00.000Z" } });

    render(<LocaleProvider initialLocale="ar" hasLocaleCookie={false}><MediaInspectionsPanel record={{ id: "record-1", store: "archive-items" } as ArchiveRecord} /></LocaleProvider>);

    fireEvent.click(await screen.findByRole("button", { name: "تسجيل تجاوز موثق" }));
    fireEvent.change(screen.getByLabelText("سبب التجاوز"), { target: { value: "مرجع المصدر معتمد رغم الخلل." } });
    fireEvent.click(screen.getByRole("button", { name: "تأكيد التجاوز" }));

    await waitFor(() => expect(overrideMediaQc).toHaveBeenCalledWith("inspection-1", { reason: "مرجع المصدر معتمد رغم الخلل." }));
    expect(await screen.findByText("تم تسجيل التجاوز الموثق." )).toBeInTheDocument();
  });
});

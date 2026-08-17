// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";

const { record, recordAttachments, mediaClips } = vi.hoisted(() => ({
  record: vi.fn(),
  recordAttachments: vi.fn(),
  mediaClips: vi.fn()
}));

vi.mock("@/lib/archive-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/archive-api")>("@/lib/archive-api");
  return {
    ...actual,
    createArchiveApiClient: () => ({ record, recordAttachments, mediaClips })
  };
});

import RecordVersionCompare from "./RecordVersionCompare";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderCompare() {
  return render(
    <LocaleProvider initialLocale="ar" hasLocaleCookie>
      <RecordVersionCompare recordId="r1" store="archive-items" />
    </LocaleProvider>
  );
}

describe("RecordVersionCompare", () => {
  test("shows an empty state when the record has fewer than two versions", async () => {
    record.mockResolvedValue({ ok: true, record: { id: "r1", title: "Only source", metadata: {} } });
    recordAttachments.mockResolvedValue({ ok: true, attachments: [] });

    renderCompare();

    expect(await screen.findByText("نسخة واحدة فقط متاحة")).toBeTruthy();
  });

  test("lists the primary source plus attachments as selectable versions and loads clips for both", async () => {
    record.mockResolvedValue({
      ok: true,
      record: { id: "r1", title: "Interview", metadata: { filePath: "media/interview.mp4" } }
    });
    recordAttachments.mockResolvedValue({
      ok: true,
      attachments: [
        {
          id: "attach-1",
          recordStore: "archive-items",
          recordUid: "r1",
          disk: "ingest",
          path: "ingest/attachments/attach-1.mp4",
          originalName: "cut-b.mp4",
          sizeBytes: 10,
          checksumSha256: "a".repeat(64),
          isPrimary: false,
          processingStatus: "ready"
        }
      ]
    });
    mediaClips.mockResolvedValue({ ok: true, clips: [] });

    renderCompare();

    await waitFor(() => expect(screen.getByRole("combobox", { name: "النسخة أ" })).toBeTruthy());
    const selectA = screen.getByRole("combobox", { name: "النسخة أ" }) as HTMLSelectElement;
    const selectB = screen.getByRole("combobox", { name: "النسخة ب" }) as HTMLSelectElement;

    // Primary source defaults into A, the attachment into B.
    expect(selectA.value).toBe("media/interview.mp4");
    expect(selectB.value).toBe("attach-1");

    // Both players stream through the authenticated files endpoint.
    const mediaElements = document.querySelectorAll("audio, video");
    expect(mediaElements.length).toBe(2);

    // Clip list panel mounts once both sides resolve to a real version.
    expect(await screen.findByText("قائمة المقاطع")).toBeTruthy();
    await waitFor(() => expect(mediaClips).toHaveBeenCalled());
  });
});

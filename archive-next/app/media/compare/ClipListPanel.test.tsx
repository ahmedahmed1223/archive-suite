// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";

const { mediaClips, createMediaClip, deleteMediaClip, downloadMediaClipsExport } = vi.hoisted(() => ({
  mediaClips: vi.fn(),
  createMediaClip: vi.fn(),
  deleteMediaClip: vi.fn(),
  downloadMediaClipsExport: vi.fn()
}));
vi.mock("@/lib/archive-api", () => ({
  createArchiveApiClient: () => ({ mediaClips, createMediaClip, deleteMediaClip, downloadMediaClipsExport })
}));

import ClipListPanel from "./ClipListPanel";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderPanel(node: ReactNode) {
  return render(
    <LocaleProvider initialLocale="ar" hasLocaleCookie>
      {node}
    </LocaleProvider>
  );
}

const versionA = { attachmentId: null, label: "Primary source" };
const versionB = { attachmentId: "attach-1", label: "cut-b.mp4" };

describe("ClipListPanel", () => {
  test("lists clips scoped to version A and creates a new clip", async () => {
    mediaClips.mockResolvedValue({ ok: true, clips: [] });
    createMediaClip.mockResolvedValue({
      ok: true,
      clip: {
        id: "clip-1",
        recordStore: "archive-items",
        recordUid: "r1",
        attachmentId: null,
        versionToken: "record:abc",
        isCurrentVersion: true,
        title: "Opening",
        notes: null,
        inSeconds: 1,
        outSeconds: 4,
        fps: 25,
        createdBy: null,
        createdAt: null,
        updatedAt: null
      }
    });

    renderPanel(<ClipListPanel recordId="r1" store="archive-items" versionA={versionA} versionB={versionB} currentTimeA={2.5} currentTimeB={0} />);

    await waitFor(() => expect(mediaClips).toHaveBeenCalledWith("r1", { store: "archive-items", attachmentId: undefined }));

    fireEvent.change(screen.getByPlaceholderText("عنوان المقطع"), { target: { value: "Opening" } });
    fireEvent.click(screen.getByRole("button", { name: "إضافة مقطع" }));

    await waitFor(() => expect(createMediaClip).toHaveBeenCalled());
    const payload = createMediaClip.mock.calls[0][1];
    expect(payload.attachmentId).toBeNull();
    expect(payload.title).toBe("Opening");

    expect(await screen.findByText("Opening")).toBeTruthy();
  });

  test("switching scope to version B re-fetches with that attachment id", async () => {
    mediaClips.mockResolvedValue({ ok: true, clips: [] });

    renderPanel(<ClipListPanel recordId="r1" store="archive-items" versionA={versionA} versionB={versionB} currentTimeA={0} currentTimeB={0} />);

    await waitFor(() => expect(mediaClips).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "cut-b.mp4" }));

    await waitFor(() => expect(mediaClips).toHaveBeenLastCalledWith("r1", { store: "archive-items", attachmentId: "attach-1" }));
  });

  test("deletes a clip after confirmation", async () => {
    mediaClips.mockResolvedValue({
      ok: true,
      clips: [
        {
          id: "clip-1",
          recordStore: "archive-items",
          recordUid: "r1",
          attachmentId: null,
          versionToken: "record:abc",
          isCurrentVersion: true,
          title: "Opening",
          notes: null,
          inSeconds: 1,
          outSeconds: 4,
          fps: 25,
          createdBy: null,
          createdAt: null,
          updatedAt: null
        }
      ]
    });
    deleteMediaClip.mockResolvedValue({ ok: true, deleted: true });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    renderPanel(<ClipListPanel recordId="r1" store="archive-items" versionA={versionA} versionB={versionB} currentTimeA={0} currentTimeB={0} />);

    expect(await screen.findByText("Opening")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "حذف المقطع" }));

    await waitFor(() => expect(deleteMediaClip).toHaveBeenCalledWith("clip-1"));
    await waitFor(() => expect(screen.queryByText("Opening")).toBeNull());
  });
});

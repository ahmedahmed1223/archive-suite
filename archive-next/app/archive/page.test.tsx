// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const searchMock = vi.fn();
const savedSearchesMock = vi.fn();
const uploadFileMock = vi.fn();
const bulkRecordsMock = vi.fn();

vi.mock("@/lib/archive-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/archive-api")>("@/lib/archive-api");
  return {
    ...actual,
    createArchiveApiClient: () => ({
      search: searchMock,
      savedSearches: savedSearchesMock,
      uploadFile: uploadFileMock,
      bulkRecords: bulkRecordsMock
    })
  };
});

vi.mock("@/lib/auth-session", () => ({
  useAuthSession: () => ({ user: { id: "user-1" }, status: "authenticated", accessToken: "token-abc" })
}));

// A stable searchParams instance matters here: the page has an effect keyed
// on it (to reload records / sync the URL), and Next's real useSearchParams()
// returns a stable reference across renders. A factory that allocates a new
// URLSearchParams() per call breaks that dependency and free-spins the effect.
const stableSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => stableSearchParams
}));

// AppShell pulls in AppHeader/OnboardingPrompt/WorkspaceCommandBar/etc, which
// is unrelated chrome for this drop-zone test — stub it to a passthrough.
vi.mock("@/components/AppShell", () => ({
  default: ({ children }: { children: ReactNode }) => <div data-testid="app-shell-stub">{children}</div>
}));

vi.mock("@/components/ui/ConfirmDialog", () => ({
  useConfirmDialog: () => ({ confirm: vi.fn(), prompt: vi.fn(), alert: vi.fn() })
}));

import ArchivePage from "./page";

function fileDataTransfer(files: File[], types: string[] = ["Files"]) {
  return { types, files };
}

beforeEach(() => {
  searchMock.mockResolvedValue({ ok: true, records: [], facets: undefined });
  savedSearchesMock.mockResolvedValue({ ok: true, searches: [] });
  uploadFileMock.mockReset();
  bulkRecordsMock.mockReset();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("archive page drop-anywhere upload (V1-716)", () => {
  test("dropping a file anywhere on the page uploads it via archiveApi.uploadFile", async () => {
    uploadFileMock.mockResolvedValue({
      ok: true,
      record: { id: "rec-9", fileName: "clip.mp4", filePath: "/files/clip.mp4", checksum: "abc123", source: "upload" }
    });
    bulkRecordsMock.mockResolvedValue({ ok: true, count: 1 });

    render(<ArchivePage />);
    const dropzone = screen.getByTestId("archive-drop-zone");
    const file = new File(["content"], "clip.mp4", { type: "video/mp4" });

    fireEvent.drop(dropzone, { dataTransfer: fileDataTransfer([file]) });

    await vi.waitFor(() => expect(uploadFileMock).toHaveBeenCalledTimes(1));
    expect(uploadFileMock).toHaveBeenCalledWith(file, undefined, { accessToken: "token-abc" });
    await vi.waitFor(() => expect(bulkRecordsMock).toHaveBeenCalledTimes(1));
  });

  test("supports multiple files dropped at once", async () => {
    uploadFileMock.mockImplementation((file: File) =>
      Promise.resolve({
        ok: true,
        record: { id: `rec-${file.name}`, fileName: file.name, filePath: `/files/${file.name}`, checksum: "x", source: "upload" }
      })
    );
    bulkRecordsMock.mockResolvedValue({ ok: true, count: 1 });

    render(<ArchivePage />);
    const dropzone = screen.getByTestId("archive-drop-zone");
    const fileA = new File(["a"], "a.txt", { type: "text/plain" });
    const fileB = new File(["b"], "b.txt", { type: "text/plain" });

    fireEvent.drop(dropzone, { dataTransfer: fileDataTransfer([fileA, fileB]) });

    await vi.waitFor(() => expect(uploadFileMock).toHaveBeenCalledTimes(2));
  });

  test("shows a visual drag-active overlay while a file is dragged over the page, cleared on drag-leave", () => {
    render(<ArchivePage />);
    const dropzone = screen.getByTestId("archive-drop-zone");

    fireEvent.dragOver(dropzone, { dataTransfer: fileDataTransfer([]) });
    expect(screen.getByText("أفلت الملفات هنا لإضافتها إلى الأرشيف")).toBeTruthy();

    fireEvent.dragLeave(dropzone);
    expect(screen.queryByText("أفلت الملفات هنا لإضافتها إلى الأرشيف")).toBeNull();
  });

  test("ignores non-file drags so a future in-page drag interaction would not collide", () => {
    render(<ArchivePage />);
    const dropzone = screen.getByTestId("archive-drop-zone");

    fireEvent.dragOver(dropzone, { dataTransfer: fileDataTransfer([], ["text/plain"]) });

    expect(screen.queryByText("أفلت الملفات هنا لإضافتها إلى الأرشيف")).toBeNull();
  });

  test("shows an error toast and does not crash when the upload fails", async () => {
    uploadFileMock.mockResolvedValue({ ok: false, error: "تعذر الرفع" });

    render(<ArchivePage />);
    const dropzone = screen.getByTestId("archive-drop-zone");
    const file = new File(["content"], "broken.mp4", { type: "video/mp4" });

    fireEvent.drop(dropzone, { dataTransfer: fileDataTransfer([file]) });

    await vi.waitFor(() => expect(uploadFileMock).toHaveBeenCalledTimes(1));
    expect(bulkRecordsMock).not.toHaveBeenCalled();
  });
});

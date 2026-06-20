// @vitest-environment jsdom
import * as React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FileManagerPage } from "./FileManagerPage.jsx";

function apiMock() {
  return {
    browseFiles: vi.fn(async () => ({ entries: [{ name: "raw", key: "raw", kind: "folder" }, { name: "clip.mp4", key: "clip.mp4", kind: "file", size: 1024 }], nextCursor: null })),
    createFileFolder: vi.fn(async () => ({ key: "new" })),
    runFileAction: vi.fn(async () => ({ results: [] })),
    uploadManagedFile: vi.fn(async ({ key }) => ({ key })),
    downloadManagedFile: vi.fn(async () => new Blob(["x"]))
  };
}

describe("FileManagerPage", () => {
  it("loads files, switches view, creates a folder, and archives only explicitly", async () => {
    const api = apiMock();
    const onArchive = vi.fn();
    render(<FileManagerPage api={api} queueUpload={vi.fn(async () => null)} storageProvider={{}} onArchive={onArchive} />);
    expect(await screen.findByText("clip.mp4")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "عرض شبكة" }));
    expect(screen.getByRole("button", { name: "عرض شبكة" })).toHaveClass("btn-active");
    expect(onArchive).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /مجلد جديد/ }));
    fireEvent.change(screen.getByLabelText("اسم المجلد"), { target: { value: "ready" } });
    fireEvent.click(screen.getByRole("button", { name: "إنشاء" }));
    await waitFor(() => expect(api.createFileFolder).toHaveBeenCalledWith(expect.objectContaining({ path: "ready" })));

    fireEvent.click(screen.getByRole("button", { name: /clip.mp4/ }));
    fireEvent.click(screen.getByRole("button", { name: /بدء الأرشفة/ }));
    expect(onArchive).toHaveBeenCalledWith({ fileKey: "clip.mp4", source: "file-manager" });
  });
});

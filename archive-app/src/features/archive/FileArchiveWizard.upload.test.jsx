/**
 * @vitest-environment jsdom
 */
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { useAppStore } from "../../stores/appStore.js";
import { FileArchiveWizard } from "./FileArchiveWizard.jsx";

describe("FileArchiveWizard upload queue integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      enqueueUploads: vi.fn(() => [{ id: "up_1", status: "queued" }]),
      updateUpload: vi.fn(),
      showNotification: vi.fn(),
      bulkDeleteItems: vi.fn()
    });
  });

  it("queues each imported file and links the upload entry to the created item", async () => {
    const file = new File(["video-bytes"], "clip-one.mp4", { type: "video/mp4" });
    const addVideoItem = vi.fn(async (item) => item);

    render(
      <FileArchiveWizard
        open
        onOpenChange={vi.fn()}
        contentTypes={[{ id: "video", name: "فيديو", status: "active" }]}
        videoItems={[]}
        addVideoItem={addVideoItem}
        showToast={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText("اختيار ملفات فيديو للاستيراد"), {
      target: { files: [file] }
    });
    fireEvent.click(screen.getByRole("button", { name: /إضافة/ }));

    await waitFor(() => expect(addVideoItem).toHaveBeenCalledTimes(1));
    const savedItem = addVideoItem.mock.calls[0][0];
    expect(useAppStore.getState().enqueueUploads).toHaveBeenCalledWith(
      [file],
      expect.objectContaining({
        source: "fileArchiveWizard",
        linkedItemId: savedItem.id,
        fieldKey: "localFile"
      })
    );
  });

  it("archives a stored file without uploading it again", async () => {
    const addVideoItem = vi.fn(async (item) => ({ ...item, id: "saved-item" }));
    const onArchived = vi.fn();
    render(
      <FileArchiveWizard
        open
        onOpenChange={vi.fn()}
        initialStoredFiles={[{ fileKey: "incoming/stored.mp4", name: "stored.mp4", size: 12, mimeType: "video/mp4", queueId: "q1" }]}
        contentTypes={[{ id: "video", name: "فيديو", status: "active" }]}
        videoItems={[]}
        addVideoItem={addVideoItem}
        onArchived={onArchived}
        showToast={vi.fn()}
      />
    );
    fireEvent.click(await screen.findByRole("button", { name: /إضافة/ }));
    await waitFor(() => expect(addVideoItem).toHaveBeenCalledTimes(1));
    expect(addVideoItem.mock.calls[0][0].path).toBe("incoming/stored.mp4");
    expect(useAppStore.getState().enqueueUploads).not.toHaveBeenCalled();
    expect(onArchived).toHaveBeenCalledWith(expect.objectContaining({ item: expect.objectContaining({ id: "saved-item" }) }));
  });
});

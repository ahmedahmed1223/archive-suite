/**
 * @vitest-environment jsdom
 */
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";

import { useAppStore } from "../../stores/appStore.js";
import { useChunkedUpload } from "../../hooks/useChunkedUpload.js";
import { UploadQueueController } from "./UploadQueueController.jsx";

vi.mock("../../hooks/useChunkedUpload.js", () => ({
  useChunkedUpload: vi.fn()
}));

describe("UploadQueueController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      uploads: [],
      videoItems: [],
      updateVideoItem: vi.fn(async (item) => item),
      updateUpload: vi.fn(),
      showNotification: vi.fn()
    });
  });

  it("starts queued uploads and patches the linked item when the upload completes", async () => {
    const file = { name: "lesson.mp4", size: 123, type: "video/mp4" };
    const start = vi.fn(async (upload) => ({
      id: upload.id,
      key: "sha256abc",
      url: "/api/files/sha256abc"
    }));
    useChunkedUpload.mockReturnValue({ start, cancel: vi.fn() });
    const updateVideoItem = vi.fn(async (item) => item);

    useAppStore.setState({
      uploads: [{
        id: "up_1",
        file,
        name: "lesson.mp4",
        status: "queued",
        linkedItemId: "video_1",
        progress: 0
      }],
      videoItems: [{
        id: "video_1",
        title: "Lesson",
        metadata: { localFile: { name: "lesson.mp4", uploadId: "up_1" } }
      }],
      updateVideoItem
    });

    render(<UploadQueueController />);

    await waitFor(() => expect(start).toHaveBeenCalledWith(expect.objectContaining({ id: "up_1" })));
    await waitFor(() => expect(updateVideoItem).toHaveBeenCalled());
    expect(updateVideoItem.mock.calls[0][0].metadata).toMatchObject({
      storageKey: "sha256abc",
      fileHash: "sha256abc",
      localFile: {
        uploadId: "up_1",
        storageKey: "sha256abc"
      }
    });
    expect(updateVideoItem.mock.calls[0][1]).toMatchObject({
      skipUndo: true,
      skipActivityLog: true
    });
  });
});

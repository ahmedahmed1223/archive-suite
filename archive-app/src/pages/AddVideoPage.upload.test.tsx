/**
 * @vitest-environment jsdom
 */
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { useAppStore } from "../stores/appStore.js";
import { AddVideoPage } from "./AddVideoPage.jsx";

describe("AddVideoPage upload queue integration", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    useAppStore.setState({
      contentTypes: [{ id: "video", name: "فيديو", status: "active", fields: [] }],
      addVideoItem: vi.fn(async (item) => item),
      enqueueUploads: vi.fn(() => [{ id: "up_1", status: "queued" }]),
      updateUpload: vi.fn(),
      setCurrentPage: vi.fn(),
      setSelectedItemId: vi.fn(),
      showToast: vi.fn()
    });
  });

  it("queues the selected local file and saves the archive item with the upload id", async () => {
    const file = new File(["video-bytes"], "lesson-one.mp4", { type: "video/mp4" });
    Object.defineProperty(file, "webkitRelativePath", {
      value: "raw/lesson-one.mp4",
      configurable: true
    });

    render(<AddVideoPage />);

    fireEvent.change(screen.getByLabelText("اختيار ملف محلي للفيديو"), {
      target: { files: [file] }
    });

    expect(useAppStore.getState().enqueueUploads).toHaveBeenCalledWith(
      [file],
      expect.objectContaining({ source: "addVideoPage" })
    );

    const clickNext = () => fireEvent.click(screen.getAllByRole("button", { name: /التالي/ })[0]);
    clickNext();
    clickNext();
    clickNext();
    fireEvent.click(screen.getAllByRole("button", { name: "حفظ وفتح التفاصيل" })[0]);

    await waitFor(() => expect(useAppStore.getState().addVideoItem).toHaveBeenCalled());
    const savedItem = useAppStore.getState().addVideoItem.mock.calls[0][0];
    expect(savedItem.metadata.localFile).toMatchObject({
      name: "lesson-one.mp4",
      uploadId: "up_1",
      uploadStatus: "queued"
    });
  });
});

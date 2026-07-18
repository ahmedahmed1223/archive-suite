// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

const { recordAttachments, uploadRecordAttachments, deleteRecordAttachment } = vi.hoisted(() => ({
  recordAttachments: vi.fn(), uploadRecordAttachments: vi.fn(), deleteRecordAttachment: vi.fn()
}));
vi.mock("@/lib/archive-api", () => ({ createArchiveApiClient: () => ({ recordAttachments, uploadRecordAttachments, deleteRecordAttachment }) }));

import RecordAttachmentsPanel from "./RecordAttachmentsPanel";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("RecordAttachmentsPanel", () => {
  test("shows a valid fileless state then uploads several files", async () => {
    recordAttachments.mockResolvedValue({ ok: true, attachments: [] });
    uploadRecordAttachments.mockResolvedValue({ ok: true, attachments: [{ id: "a1", originalName: "one.pdf", sizeBytes: 1000, processingStatus: "ready", isPrimary: true }] });
    render(<RecordAttachmentsPanel recordId="r1" />);
    expect(await screen.findByText("لا توجد ملفات بعد؛ السجل صالح كسجل وصفي مستقل.")).toBeTruthy();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "one.pdf", { type: "application/pdf" })] } });
    await waitFor(() => expect(uploadRecordAttachments).toHaveBeenCalled());
    expect(await screen.findByText("one.pdf")).toBeTruthy();
  });
});

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";

const { recordSegments } = vi.hoisted(() => ({ recordSegments: vi.fn() }));

vi.mock("@/lib/archive-api", () => ({
  createArchiveApiClient: () => ({ recordSegments })
}));

import StudioRecordSegments from "./StudioRecordSegments";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("StudioRecordSegments", () => {
  test("lists persisted timed segments and seeks to their in-point", async () => {
    recordSegments.mockResolvedValue({
      ok: true,
      segments: [{
        id: "segment-1",
        recordId: "record-1",
        title: "بداية المؤتمر",
        description: "",
        tags: [],
        startSeconds: 12.5,
        endSeconds: 47,
        createdAt: "2026-09-14T10:00:00.000Z",
        updatedAt: "2026-09-14T10:00:00.000Z"
      }]
    });
    const onSeek = vi.fn();

    render(
      <LocaleProvider initialLocale="ar" hasLocaleCookie={false}>
        <StudioRecordSegments recordId="record-1" onSeek={onSeek} />
      </LocaleProvider>
    );

    await waitFor(() => expect(recordSegments).toHaveBeenCalledWith("record-1"));
    expect(await screen.findByRole("heading", { name: "مقاطع المادة" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "الانتقال إلى بداية المؤتمر عند 0:12" }));
    expect(onSeek).toHaveBeenCalledWith(12.5);
  });
});

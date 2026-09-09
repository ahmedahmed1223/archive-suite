// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { TimedDescriptionSegment } from "@/lib/archive-api";

const { timedDescriptionSegments, createTimedDescriptionSegment } = vi.hoisted(() => ({
  timedDescriptionSegments: vi.fn(),
  createTimedDescriptionSegment: vi.fn()
}));

vi.mock("@/lib/archive-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/archive-api")>("@/lib/archive-api");
  return { ...actual, createArchiveApiClient: () => ({ timedDescriptionSegments, createTimedDescriptionSegment }) };
});

vi.mock("@/components/RoleGate", () => ({ useCapability: () => true }));

import TimedDescriptionSegmentsPanel from "./TimedDescriptionSegmentsPanel";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function segment(overrides: Partial<TimedDescriptionSegment> = {}): TimedDescriptionSegment {
  return {
    id: "segment-1",
    recordId: "record-1",
    startFrame: 120,
    endFrame: 360,
    title: "بداية المؤتمر",
    description: null,
    subjects: [],
    place: null,
    rightsNote: null,
    createdAt: "2026-09-09T10:00:00.000Z",
    updatedAt: "2026-09-09T10:00:00.000Z",
    ...overrides
  };
}

describe("TimedDescriptionSegmentsPanel", () => {
  test("sends the optional cataloguing context when creating a timed segment", async () => {
    timedDescriptionSegments.mockResolvedValue({ ok: true, segments: [] });
    createTimedDescriptionSegment.mockResolvedValue({ ok: true, segment: segment({ title: "وصول الضيوف" }) });

    render(<TimedDescriptionSegmentsPanel recordId="record-1" />);

    fireEvent.change(screen.getByLabelText("العنوان"), { target: { value: "وصول الضيوف" } });
    fireEvent.change(screen.getByLabelText("نهاية الإطار"), { target: { value: "240" } });
    fireEvent.change(screen.getByLabelText("الوصف"), { target: { value: "لقطة عامة لوصول الضيوف إلى القاعة." } });
    fireEvent.change(screen.getByLabelText("الأشخاص والموضوعات"), { target: { value: "الضيوف، المؤتمر السنوي" } });
    fireEvent.change(screen.getByLabelText("المكان"), { target: { value: "قاعة الاحتفالات" } });
    fireEvent.change(screen.getByLabelText("ملاحظة الحقوق"), { target: { value: "للاستخدام التحريري الداخلي" } });
    fireEvent.click(screen.getByRole("button", { name: "إضافة مقطع" }));

    await waitFor(() => expect(createTimedDescriptionSegment).toHaveBeenCalledWith("record-1", {
      title: "وصول الضيوف",
      startFrame: 0,
      endFrame: 240,
      description: "لقطة عامة لوصول الضيوف إلى القاعة.",
      subjects: ["الضيوف", "المؤتمر السنوي"],
      place: "قاعة الاحتفالات",
      rightsNote: "للاستخدام التحريري الداخلي"
    }));
  });
});

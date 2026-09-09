// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { AuthorityEntity, TimedDescriptionSegment } from "@/lib/archive-api";

const { timedDescriptionSegments, createTimedDescriptionSegment, authorityEntities, timedDescriptionSegmentAuthorityEntities, linkTimedDescriptionSegmentAuthorityEntity } = vi.hoisted(() => ({
  timedDescriptionSegments: vi.fn(),
  createTimedDescriptionSegment: vi.fn(),
  authorityEntities: vi.fn(),
  timedDescriptionSegmentAuthorityEntities: vi.fn(),
  linkTimedDescriptionSegmentAuthorityEntity: vi.fn()
}));

vi.mock("@/lib/archive-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/archive-api")>("@/lib/archive-api");
  return { ...actual, createArchiveApiClient: () => ({ timedDescriptionSegments, createTimedDescriptionSegment, authorityEntities, timedDescriptionSegmentAuthorityEntities, linkTimedDescriptionSegmentAuthorityEntity }) };
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
    authorityEntities.mockResolvedValue({ ok: true, entities: [] });
    timedDescriptionSegmentAuthorityEntities.mockResolvedValue({ ok: true, links: [] });
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

  test("links a controlled person to the exact timed segment", async () => {
    const person: AuthorityEntity = { id: "entity-1", kind: "person", preferredLabel: "ليلى حداد", aliases: [], mergedIntoId: null };
    timedDescriptionSegments.mockResolvedValue({ ok: true, segments: [segment()] });
    authorityEntities.mockResolvedValue({ ok: true, entities: [person] });
    timedDescriptionSegmentAuthorityEntities.mockResolvedValue({ ok: true, links: [] });
    linkTimedDescriptionSegmentAuthorityEntity.mockResolvedValue({ ok: true, link: { id: "link-1", relationship: "on_screen", entity: person } });

    render(<TimedDescriptionSegmentsPanel recordId="record-1" />);

    const selector = await screen.findByLabelText("سجل استنادي للمقطع: بداية المؤتمر");
    fireEvent.change(selector, { target: { value: "entity-1" } });
    fireEvent.click(screen.getByRole("button", { name: "ربط السجل الاستنادي" }));

    await waitFor(() => expect(linkTimedDescriptionSegmentAuthorityEntity).toHaveBeenCalledWith("segment-1", {
      entityId: "entity-1",
      relationship: "on_screen"
    }));
    expect(await screen.findByText("ليلى حداد · on_screen")).toBeInTheDocument();
  });
});

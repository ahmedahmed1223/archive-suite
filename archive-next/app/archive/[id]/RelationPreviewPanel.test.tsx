// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ConfirmDialogProvider } from "@/components/ui/ConfirmDialog";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import type { RelationGraphPayload } from "@/lib/archive-api";
import { RelationPreviewPanel } from "./RelationPreviewPanel";

afterEach(cleanup);

const graph: RelationGraphPayload = {
  nodes: [
    { id: "rec-1", kind: "item", label: "السجل الأول", tags: [], type: "video", degree: 1 },
    { id: "rec-2", kind: "item", label: "السجل الثاني", tags: [], type: "video", degree: 1 }
  ],
  edges: [
    {
      id: "edge-1",
      source: "rec-1",
      target: "rec-2",
      kind: "manual",
      relationId: "rel-1",
      label: "مرتبط بـ",
      type: "related_to",
      weight: 1,
      note: "سياق الربط"
    }
  ],
  stats: { edgeCount: 1, manualEdgeCount: 1, inferredEdgeCount: 0, nodeCount: 2 },
  relationTypes: [{ key: "related_to", label: "مرتبط بـ", inverse: "related_to", bidirectional: true }]
};

function renderPanel(overrides: Partial<Parameters<typeof RelationPreviewPanel>[0]> = {}) {
  const onCreate = vi.fn().mockResolvedValue(undefined);
  const onUpdate = vi.fn().mockResolvedValue(undefined);
  const onDelete = vi.fn().mockResolvedValue(undefined);
  render(
    <LocaleProvider initialLocale="ar" hasLocaleCookie={false}>
      <ConfirmDialogProvider>
        <RelationPreviewPanel
          graph={graph}
          recordId="rec-1"
          onCreate={onCreate}
          onUpdate={onUpdate}
          onDelete={onDelete}
          canEdit
          {...overrides}
        />
      </ConfirmDialogProvider>
    </LocaleProvider>
  );
  return { onCreate, onUpdate, onDelete };
}

describe("RelationPreviewPanel", () => {
  test("shows manual/inferred counts and the linked record", () => {
    renderPanel();
    expect(screen.getByText("السجل الثاني · سياق الربط")).toBeInTheDocument();
  });

  test("shows the empty state when the record has no relations", () => {
    renderPanel({ graph: { ...graph, edges: [] } });
    expect(screen.getByText("لا توجد علاقات ظاهرة لهذا السجل")).toBeInTheDocument();
  });

  test("creates a new relation from the inline form", async () => {
    const { onCreate } = renderPanel();
    fireEvent.change(screen.getByPlaceholderText("UID أو ID"), { target: { value: "rec-3" } });
    fireEvent.submit(screen.getByRole("button", { name: "إضافة علاقة" }).closest("form")!);

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith({
      sourceId: "rec-1",
      targetId: "rec-3",
      type: "related_to"
    }));
  });
});

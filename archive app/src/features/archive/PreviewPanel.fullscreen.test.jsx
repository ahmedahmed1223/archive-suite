/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import { PreviewPanel } from "./ArchiveViews.jsx";

const baseItem = {
  id: "item-2",
  title: "Quarterly archive scan",
  type: "document",
  url: "https://example.com/scan.png",
  metadata: {},
  tags: []
};

function renderPreviewPanel(props = {}) {
  return render(
    <PreviewPanel
      item={baseItem}
      typeLabel="Document"
      subtypeLabel="Image"
      typeDefinition={null}
      onOpen={() => {}}
      onQuickEdit={() => {}}
      canPreviewPrevious
      canPreviewNext
      onPreviewPrevious={vi.fn()}
      onPreviewNext={vi.fn()}
      {...props}
    />
  );
}

describe("PreviewPanel fullscreen preview", () => {
  it("opens an accessible fullscreen dialog and closes it with Escape", () => {
    renderPreviewPanel();

    fireEvent.click(screen.getByRole("button", { name: /تكبير المعاينة/ }));

    const dialog = screen.getByRole("dialog", { name: /معاينة مكبرة/ });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { name: "Quarterly archive scan" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: /معاينة مكبرة/ })).not.toBeInTheDocument();
  });

  it("supports arrow-key navigation in fullscreen preview", () => {
    const onPreviewPrevious = vi.fn();
    const onPreviewNext = vi.fn();
    renderPreviewPanel({ onPreviewPrevious, onPreviewNext });

    fireEvent.click(screen.getByRole("button", { name: /تكبير المعاينة/ }));
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    fireEvent.keyDown(window, { key: "ArrowRight" });

    expect(onPreviewPrevious).toHaveBeenCalledTimes(1);
    expect(onPreviewNext).toHaveBeenCalledTimes(1);
  });
});

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { ArchiveRecord } from "@/lib/archive-api";
import { ArchiveRecordCard } from "./ArchiveRecordCard";

afterEach(cleanup);

const record: ArchiveRecord = { id: "rec-1", title: "سجل تجريبي" };

function renderCard(overrides: Partial<React.ComponentProps<typeof ArchiveRecordCard>> = {}) {
  const onSelectClick = vi.fn();
  const onPreview = vi.fn();
  render(
    <ArchiveRecordCard
      record={record}
      itemSize="compact"
      isSelected={false}
      onSelectClick={onSelectClick}
      onPreview={onPreview}
      {...overrides}
    />
  );
  return { onSelectClick, onPreview };
}

describe("ArchiveRecordCard right-click context menu", () => {
  test("right-click opens a menu with فتح، فتح في تبويب جديد، تحديد only", async () => {
    renderCard();
    fireEvent.contextMenu(screen.getByRole("listitem"));

    expect(await screen.findByRole("menuitem", { name: "فتح" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "فتح في تبويب جديد" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "تحديد" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "مشاركة" })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "حذف" })).toBeNull();
  });

  test("تحديد menu item calls the existing selection handler with plain-click modifiers", async () => {
    const { onSelectClick } = renderCard();
    fireEvent.contextMenu(screen.getByRole("listitem"));

    fireEvent.click(await screen.findByRole("menuitem", { name: "تحديد" }));

    expect(onSelectClick).toHaveBeenCalledWith("rec-1", { shiftKey: false, ctrlKey: false, metaKey: false });
  });

  test("فتح triggers the same navigation as the title link", async () => {
    renderCard();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    fireEvent.contextMenu(screen.getByRole("listitem"));

    fireEvent.click(await screen.findByRole("menuitem", { name: "فتح" }));

    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  test("فتح في تبويب جديد opens the exact same href in a new tab", async () => {
    renderCard();
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    fireEvent.contextMenu(screen.getByRole("listitem"));

    fireEvent.click(await screen.findByRole("menuitem", { name: "فتح في تبويب جديد" }));

    expect(openSpy).toHaveBeenCalledWith(`/archive/${encodeURIComponent("rec-1")}`, "_blank", "noopener,noreferrer");
    openSpy.mockRestore();
  });

  test("Escape closes the context menu", async () => {
    renderCard();
    fireEvent.contextMenu(screen.getByRole("listitem"));
    await screen.findByRole("menuitem", { name: "فتح" });

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("menuitem", { name: "فتح" })).toBeNull();
  });
});

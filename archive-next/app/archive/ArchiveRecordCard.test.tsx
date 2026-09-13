// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { ArchiveRecord } from "@/lib/archive-api";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import { ArchiveRecordCard } from "./ArchiveRecordCard";

vi.mock("@/components/ProtectedDerivativeImage", () => ({
  default: ({ derivativeId, alt }: { derivativeId: string; alt: string }) => <img src={`blob:${derivativeId}`} alt={alt} />,
}));

afterEach(cleanup);

const record: ArchiveRecord = { id: "rec-1", title: "سجل تجريبي" };

function renderCard(overrides: Partial<React.ComponentProps<typeof ArchiveRecordCard>> = {}) {
  const onSelectClick = vi.fn();
  const onPreview = vi.fn();
  const onRename = vi.fn();
  render(
    <LocaleProvider initialLocale="ar" hasLocaleCookie={false}>
      <ArchiveRecordCard
        record={record}
        itemSize="compact"
        isSelected={false}
        canEdit
        onSelectClick={onSelectClick}
        onPreview={onPreview}
        onRename={onRename}
        {...overrides}
      />
    </LocaleProvider>
  );
  return { onSelectClick, onPreview, onRename };
}

test("native checkbox activation changes checked state once while forwarding selection modifiers", () => {
  const onSelectClick = vi.fn();
  function StatefulCard() {
    const [selected, setSelected] = useState(false);
    return <ArchiveRecordCard record={record} itemSize="compact" isSelected={selected} canEdit onPreview={() => {}} onRename={() => {}}
      onSelectClick={(id, event) => { onSelectClick(id, event); setSelected((value) => value ? !event.ctrlKey : true); }} />;
  }
  render(<LocaleProvider initialLocale="ar" hasLocaleCookie={false}><StatefulCard /></LocaleProvider>);
  const checkbox = screen.getByRole("checkbox", { name: "تحديد سجل تجريبي" });
  expect(checkbox).not.toBeChecked();
  fireEvent.click(checkbox);
  expect(checkbox).toBeChecked();
  expect(onSelectClick).toHaveBeenCalledTimes(1);
  expect(onSelectClick).toHaveBeenCalledWith("rec-1", expect.objectContaining({ shiftKey: false, ctrlKey: false, metaKey: false }));
  fireEvent.click(checkbox);
  expect(checkbox).not.toBeChecked();
  expect(onSelectClick).toHaveBeenCalledTimes(2);
  expect(onSelectClick).toHaveBeenLastCalledWith("rec-1", expect.objectContaining({ ctrlKey: true, shiftKey: false, metaKey: false }));
});

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

describe("ArchiveRecordCard double-click inline rename", () => {
  test("double-click on title shows an input pre-filled with the current title", () => {
    renderCard();
    fireEvent.doubleClick(screen.getByText("سجل تجريبي"));

    const input = screen.getByRole("textbox", { name: /عنوان/ }) as HTMLInputElement;
    expect(input.value).toBe("سجل تجريبي");
  });

  test("Enter saves the new title via onRename", () => {
    const { onRename } = renderCard();
    fireEvent.doubleClick(screen.getByText("سجل تجريبي"));

    const input = screen.getByRole("textbox", { name: /عنوان/ });
    fireEvent.change(input, { target: { value: "عنوان جديد" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onRename).toHaveBeenCalledWith("rec-1", "عنوان جديد");
    expect(screen.queryByRole("textbox", { name: /عنوان/ })).toBeNull();
  });

  test("Escape cancels the edit without calling onRename", () => {
    const { onRename } = renderCard();
    fireEvent.doubleClick(screen.getByText("سجل تجريبي"));

    const input = screen.getByRole("textbox", { name: /عنوان/ });
    fireEvent.change(input, { target: { value: "عنوان جديد" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(onRename).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox", { name: /عنوان/ })).toBeNull();
    expect(screen.getByText("سجل تجريبي")).toBeTruthy();
  });

  test("Enter with an unchanged or empty title does not call onRename", () => {
    const { onRename } = renderCard();
    fireEvent.doubleClick(screen.getByText("سجل تجريبي"));

    const input = screen.getByRole("textbox", { name: /عنوان/ });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onRename).not.toHaveBeenCalled();
  });
});

describe("ArchiveRecordCard media summary", () => {
  test("renders a video thumbnail, duration, and operational state from the current media summary", () => {
    renderCard({
      record: {
        ...record,
        mediaSummary: {
          kind: "video",
          durationSeconds: 62,
          thumbnailDerivativeId: "thumbnail-current",
          thumbnailStatus: "ready",
          proxyStatus: "processing",
          waveformStatus: "missing",
          inspectionStatus: "passed",
        },
      },
    });

    expect(screen.getByRole("img", { name: "معاينة فيديو سجل تجريبي" })).toHaveAttribute("src", "blob:thumbnail-current");
    expect(screen.getByText("01:02")).toBeTruthy();
    expect(screen.getByText("النسخة البديلة قيد المعالجة")).toBeTruthy();
    expect(screen.getByText("الفحص اجتاز")).toBeTruthy();
  });

  test("does not render a thumbnail until the current derivative is ready", () => {
    renderCard({
      record: {
        ...record,
        mediaSummary: {
          kind: "video",
          durationSeconds: null,
          thumbnailDerivativeId: "thumbnail-processing",
          thumbnailStatus: "processing",
          proxyStatus: "pending",
          waveformStatus: "missing",
          inspectionStatus: "pending",
        },
      },
    });

    expect(screen.queryByRole("img", { name: "معاينة فيديو سجل تجريبي" })).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent("المعاينة قيد الإنشاء");
  });
});

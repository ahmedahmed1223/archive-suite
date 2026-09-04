// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, test, vi } from "vitest";
import { ContextPanel } from "./ContextPanel";

describe("ContextPanel", () => {
  test("renders complementary record context with a labelled landmark", () => {
    render(
      <ContextPanel title="بيانات القيد" description="المعلومات المرتبطة بالقيد">
        <dl><dt>المالك</dt><dd>فريق الأرشيف</dd></dl>
      </ContextPanel>
    );

    expect(screen.getByRole("complementary", { name: "بيانات القيد" })).toHaveTextContent("فريق الأرشيف");
    expect(screen.getByRole("heading", { level: 2, name: "بيانات القيد" })).toBeInTheDocument();
  });

  test("uses parent-controlled drawer state and moves focus to the open panel", () => {
    const onDismiss = vi.fn();
    render(
      <ContextPanel title="سياق المهمة" presentation="drawer" open onDismiss={onDismiss}>
        تفاصيل المهمة
      </ContextPanel>
    );

    const panel = screen.getByRole("dialog", { name: "سياق المهمة" });
    expect(panel).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "إغلاق السياق" }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  test("does not render a closed drawer", () => {
    const { container } = render(<ContextPanel title="سياق المهمة" presentation="drawer" open={false}>تفاصيل</ContextPanel>);
    expect(within(container).queryByRole("dialog", { name: "سياق المهمة" })).not.toBeInTheDocument();
  });

  test("accepts caller-provided dismissal copy for an English drawer", () => {
    render(
      <ContextPanel title="Job context" presentation="drawer" open onDismiss={() => undefined} dismissLabel="Close context">
        Details
      </ContextPanel>
    );

    expect(screen.getByRole("button", { name: "Close context" })).toBeInTheDocument();
  });

  test("returns focus to the opening control after its parent closes the drawer", () => {
    function DrawerExample() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>فتح السياق</button>
          <ContextPanel title="سياق المهمة" presentation="drawer" open={open} onDismiss={() => setOpen(false)}>
            تفاصيل المهمة
          </ContextPanel>
        </>
      );
    }

    const { container } = render(<DrawerExample />);
    const trigger = within(container).getByRole("button", { name: "فتح السياق" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(within(container).getByRole("dialog", { name: "سياق المهمة" })).toHaveFocus();
    fireEvent.click(within(container).getByRole("button", { name: "إغلاق السياق" }));
    expect(trigger).toHaveFocus();
  });
});

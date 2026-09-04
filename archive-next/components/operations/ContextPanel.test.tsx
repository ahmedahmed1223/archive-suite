// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
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
});

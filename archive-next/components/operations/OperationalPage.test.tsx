// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { OperationalPage } from "./OperationalPage";

describe("OperationalPage", () => {
  test("exposes the page heading, action groups, status, and content region", () => {
    render(
      <OperationalPage
        eyebrow="الأرشيف"
        title="سجل القيد"
        description="راجِع بيانات القيد قبل المتابعة."
        primaryAction={<button type="button">حفظ</button>}
        secondaryActions={<button type="button">إلغاء</button>}
        status="تم الحفظ"
        contentLabel="محتوى سجل القيد"
      >
        <p>تفاصيل القيد</p>
      </OperationalPage>
    );

    expect(screen.getByRole("region", { name: "سجل القيد" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "سجل القيد" })).toBeInTheDocument();
    expect(screen.getByText("الأرشيف")).toBeVisible();
    expect(screen.getByRole("button", { name: "حفظ" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "إلغاء" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("تم الحفظ");
    expect(screen.getByRole("region", { name: "محتوى سجل القيد" })).toHaveTextContent("تفاصيل القيد");
  });

  test("keeps inherited RTL direction instead of forcing a direction", () => {
    const { container } = render(
      <div dir="rtl">
        <OperationalPage title="Archive records">Content</OperationalPage>
      </div>
    );

    expect(screen.getByRole("region", { name: "Archive records" })).not.toHaveAttribute("dir");
    expect(container.firstElementChild).toHaveAttribute("dir", "rtl");
  });

  test("accepts a caller-provided accessible name for custom actions", () => {
    render(
      <OperationalPage
        title="Archive records"
        actionsLabel="Archive actions"
        primaryAction={<button type="button">Add record</button>}
      />
    );

    expect(screen.getByRole("group", { name: "Archive actions" })).toHaveTextContent("Add record");
  });

  test("does not expose an unnamed content landmark when no content label is supplied", () => {
    const { container } = render(<OperationalPage title="Archive records">Content</OperationalPage>);

    expect(within(container).getAllByRole("region")).toHaveLength(1);
  });
});

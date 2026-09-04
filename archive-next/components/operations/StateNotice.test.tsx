// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import { StateNotice } from "./StateNotice";

describe("StateNotice", () => {
  test.each([
    ["loading", "جارٍ التحميل", "status"],
    ["empty", "لا توجد سجلات", "status"],
    ["error", "تعذر التحميل", "alert"],
    ["offline", "لا يوجد اتصال", "status"],
    ["read-only", "وضع العرض فقط", "status"],
    ["locked", "السجل مقفل", "status"],
    ["conflict", "تعارض في التغييرات", "alert"]
  ] as const)("announces the %s state", (state, title, role) => {
    const { container } = render(
      <LocaleProvider initialLocale="ar" hasLocaleCookie>
        <StateNotice state={state} title={title} description="تفاصيل الحالة" />
      </LocaleProvider>
    );

    expect(within(container).getByRole(role)).toHaveTextContent(title);
  });

  test("keeps caller-provided action content in non-async notices", () => {
    render(
      <StateNotice state="locked" title="السجل مقفل" actions={<a href="/archive">العودة إلى السجل</a>} />
    );

    expect(screen.getByRole("link", { name: "العودة إلى السجل" })).toHaveAttribute("href", "/archive");
  });
});

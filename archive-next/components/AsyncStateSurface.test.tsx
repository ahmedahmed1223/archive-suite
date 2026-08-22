// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import AsyncStateSurface from "./AsyncStateSurface";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";

// V14-UX-004 (Task 4): semantic contracts of the shared state surface.
describe("AsyncStateSurface", () => {
  test("renders an error as role=alert with a working retry action", () => {
    const retry = vi.fn();
    render(
      <LocaleProvider initialLocale="ar" hasLocaleCookie>
        <AsyncStateSurface status="error" title="تعذر التحميل" onRetry={retry} retryLabel="إعادة المحاولة" />
      </LocaleProvider>
    );

    expect(screen.getByRole("alert")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "إعادة المحاولة" }));
    expect(retry).toHaveBeenCalledOnce();
  });

  test("announces loading through role=status with aria-busy", () => {
    render(
      <LocaleProvider initialLocale="ar" hasLocaleCookie>
        <AsyncStateSurface status="loading" loadingLabel="جارٍ تحميل السجلات" />
      </LocaleProvider>
    );

    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("جارٍ تحميل السجلات")).toBeVisible();
  });

  test("supports a secondary action next to the primary one", () => {
    const onPrimary = vi.fn();
    const onSecondary = vi.fn();
    render(
      <LocaleProvider initialLocale="ar" hasLocaleCookie>
        <AsyncStateSurface
          status="empty"
          title="لا نتائج"
          action={{ label: "مسح الفلاتر", onClick: onPrimary }}
          secondaryAction={{ label: "بحث محفوظ", onClick: onSecondary }}
        />
      </LocaleProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "مسح الفلاتر" }));
    fireEvent.click(screen.getByRole("button", { name: "بحث محفوظ" }));
    expect(onPrimary).toHaveBeenCalledOnce();
    expect(onSecondary).toHaveBeenCalledOnce();
  });

  test("renders children only in the success state", () => {
    render(
      <LocaleProvider initialLocale="ar" hasLocaleCookie>
        <AsyncStateSurface status="success">المحتوى</AsyncStateSurface>
      </LocaleProvider>
    );
    expect(screen.getByText("المحتوى")).toBeVisible();
  });
});

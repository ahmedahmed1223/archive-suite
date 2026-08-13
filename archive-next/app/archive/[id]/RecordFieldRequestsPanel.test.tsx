// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import { RecordFieldRequestsPanel } from "./page";

afterEach(cleanup);

describe("RecordFieldRequestsPanel", () => {
  test("creates an assigned field-completion request", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(
      <LocaleProvider initialLocale="ar" hasLocaleCookie={false}>
        <RecordFieldRequestsPanel
          requests={[]}
          loading={false}
          error={null}
          onCreate={onCreate}
          onResolve={vi.fn().mockResolvedValue(undefined)}
          canEdit
        />
      </LocaleProvider>
    );

    fireEvent.change(screen.getByLabelText("الحقل الناقص"), { target: { value: "تاريخ الإنتاج" } });
    fireEvent.change(screen.getByLabelText("المطلوب"), { target: { value: "تأكيد التاريخ من المصدر." } });
    fireEvent.change(screen.getByLabelText("المكلّف (اختياري)"), { target: { value: "فريق التوثيق" } });
    fireEvent.submit(screen.getByRole("button", { name: "إسناد طلب" }).closest("form")!);

    await waitFor(() => expect(onCreate).toHaveBeenCalledWith({
      field: "تاريخ الإنتاج",
      message: "تأكيد التاريخ من المصدر.",
      assignee: "فريق التوثيق"
    }));
    await waitFor(() => expect(screen.getByText("تم إسناد طلب الاستكمال.")).toBeInTheDocument());
  });
});

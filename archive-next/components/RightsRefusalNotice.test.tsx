// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import RightsRefusalNotice from "@/components/RightsRefusalNotice";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";

afterEach(cleanup);

function renderNotice(refusal: { reason: string; decidedBy: string; itemId?: string }) {
  return render(
    <LocaleProvider initialLocale="ar" hasLocaleCookie>
      <RightsRefusalNotice refusal={refusal} />
    </LocaleProvider>
  );
}

describe("RightsRefusalNotice", () => {
  test("explains a known decision code and still shows the clause that decided it", () => {
    renderNotice({ reason: "لا توجد بيانات حقوق مسجّلة", decidedBy: "no_record" });

    expect(screen.getByRole("alert")).toHaveAttribute("data-decided-by", "no_record");
    expect(screen.getByText("لا توجد بيانات حقوق مسجّلة لهذه المادة بعد.")).toBeInTheDocument();
    expect(screen.getByText("no_record")).toBeInTheDocument();
  });

  test("falls back to the server sentence when the clause is a window id", () => {
    renderNotice({ reason: "النافذة rw-7 لا تطابق المعايير", decidedBy: "rw-7", itemId: "item-1" });

    expect(screen.getAllByText("النافذة rw-7 لا تطابق المعايير").length).toBeGreaterThan(0);
    expect(screen.getByText("rw-7")).toBeInTheDocument();
    expect(screen.getByText("item-1")).toBeInTheDocument();
  });
});

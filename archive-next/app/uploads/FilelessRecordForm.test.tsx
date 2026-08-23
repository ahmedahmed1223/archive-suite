// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";

const { createRecord } = vi.hoisted(() => ({ createRecord: vi.fn() }));
vi.mock("@/lib/archive-api", () => ({ createArchiveApiClient: () => ({ createRecord }) }));

import { FilelessRecordForm } from "./FilelessRecordForm";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("FilelessRecordForm", () => {
  // V14-UX-REVIEW-3: daily users create several records in a row — the form
  // stays put with a success banner and a link instead of navigating away.
  test("creates a record, shows a success banner with a link, and keeps the form ready", async () => {
    createRecord.mockResolvedValue({ ok: true, record: { id: "record-7", title: "شهادة" } });
    render(<LocaleProvider initialLocale="ar" hasLocaleCookie={false}><FilelessRecordForm /></LocaleProvider>);
    fireEvent.change(screen.getByLabelText("العنوان *"), { target: { value: "شهادة" } });
    fireEvent.click(screen.getByRole("button", { name: "إنشاء السجل" }));
    await waitFor(() => expect(createRecord).toHaveBeenCalledWith(expect.objectContaining({ title: "شهادة", tags: [] })));

    const banner = await screen.findByRole("status");
    expect(banner.textContent).toContain("تم إنشاء «شهادة»");
    const openLink = screen.getByRole("link", { name: "فتح السجل" });
    expect(openLink.getAttribute("href")).toBe("/archive/record-7");
    // form resets for the next record
    expect((screen.getByLabelText("العنوان *") as HTMLInputElement).value).toBe("");
  });
});

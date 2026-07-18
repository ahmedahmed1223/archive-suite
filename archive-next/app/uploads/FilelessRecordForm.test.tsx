// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

const { createRecord, push } = vi.hoisted(() => ({ createRecord: vi.fn(), push: vi.fn() }));
vi.mock("@/lib/archive-api", () => ({ createArchiveApiClient: () => ({ createRecord }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { FilelessRecordForm } from "./FilelessRecordForm";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("FilelessRecordForm", () => {
  test("creates a descriptive record and opens it without selecting a file", async () => {
    createRecord.mockResolvedValue({ ok: true, record: { id: "record-7", title: "شهادة" } });
    render(<FilelessRecordForm />);
    fireEvent.change(screen.getByLabelText("العنوان *"), { target: { value: "شهادة" } });
    fireEvent.click(screen.getByRole("button", { name: "إنشاء السجل" }));
    await waitFor(() => expect(createRecord).toHaveBeenCalledWith(expect.objectContaining({ title: "شهادة", tags: [] })));
    expect(push).toHaveBeenCalledWith("/archive/record-7");
  });
});

// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import WhatsNewDialog from "./WhatsNewDialog";
import { WHATS_NEW_STORAGE_KEY } from "@/lib/whats-new";

describe("WhatsNewDialog", () => {
  beforeEach(() => window.localStorage.clear());

  it("opens once for a new release and records acknowledgement", async () => {
    render(<WhatsNewDialog />);

    expect(await screen.findByRole("dialog", { name: "ما الجديد في مسار" })).toBeTruthy();
    expect(screen.getByText("بحث أسرع وأكثر دقة")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "ابدأ العمل" }));

    expect(window.localStorage.getItem(WHATS_NEW_STORAGE_KEY)).toBe("2026.07.18");
    expect(screen.queryByRole("dialog", { name: "ما الجديد في مسار" })).toBeNull();
  });

  it("stays closed after the current release was acknowledged", () => {
    window.localStorage.setItem(WHATS_NEW_STORAGE_KEY, "2026.07.18");
    render(<WhatsNewDialog />);

    expect(screen.queryByRole("dialog", { name: "ما الجديد في مسار" })).toBeNull();
  });
});

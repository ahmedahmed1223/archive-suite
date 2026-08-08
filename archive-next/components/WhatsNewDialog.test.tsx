// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WhatsNewDialog from "./WhatsNewDialog";
import {
  WHATS_NEW_DISMISSED_KEY,
  WHATS_NEW_RELEASE,
  WHATS_NEW_STORAGE_KEY,
} from "@/lib/whats-new";

vi.mock("@/lib/i18n/LocaleProvider", () => ({ useLocale: () => ({ locale: "ar" }) }));

describe("WhatsNewDialog", () => {
  beforeEach(() => window.localStorage.clear());

  it("opens once for a new release and records acknowledgement", async () => {
    render(<WhatsNewDialog />);

    expect(await screen.findByRole("dialog", { name: "ما الجديد في مسار" })).toBeTruthy();
    expect(screen.getByText("تنظيم العمل بين الأقسام")).toBeTruthy();
    expect(screen.getByText("ما الذي ينبغي عليك فعله الآن؟")).toBeTruthy();
    expect(screen.getByRole("link", { name: "فتح ما الجديد في المساعدة" })).toHaveAttribute(
      "href",
      "/help?chapter=whats-new",
    );

    fireEvent.click(screen.getByRole("button", { name: "ابدأ العمل" }));

    expect(window.localStorage.getItem(WHATS_NEW_STORAGE_KEY)).toBe(WHATS_NEW_RELEASE);
    expect(screen.queryByRole("dialog", { name: "ما الجديد في مسار" })).toBeNull();
  });

  it("stays closed after the current release was acknowledged", () => {
    window.localStorage.setItem(WHATS_NEW_STORAGE_KEY, WHATS_NEW_RELEASE);
    render(<WhatsNewDialog />);

    expect(screen.queryByRole("dialog", { name: "ما الجديد في مسار" })).toBeNull();
  });

  it("can permanently hide future whats-new dialogs on this device", async () => {
    render(<WhatsNewDialog />);

    await screen.findByRole("dialog", { name: "ما الجديد في مسار" });
    fireEvent.click(screen.getByRole("checkbox", { name: "لا تعرض تحديثات ما الجديد مرة أخرى" }));
    fireEvent.click(screen.getByRole("button", { name: "ابدأ العمل" }));

    expect(window.localStorage.getItem(WHATS_NEW_DISMISSED_KEY)).toBe("true");
  });
});

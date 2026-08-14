// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WhatsNewDialog from "./WhatsNewDialog";
import {
  WHATS_NEW_DISMISSED_KEY,
  WHATS_NEW_RELEASE,
  WHATS_NEW_STORAGE_KEY,
} from "@/lib/whats-new";

vi.mock("@/lib/i18n/LocaleProvider", async () => {
  const { getDictionary } = await import("@/lib/i18n/dictionaries");

  return {
    useLocale: () => ({
      locale: "ar",
      direction: "rtl",
      t: getDictionary("ar"),
      setLocale: vi.fn(),
    }),
  };
});

describe("WhatsNewDialog", () => {
  beforeEach(() => window.localStorage.clear());

  it("opens once for a new release and records acknowledgement", async () => {
    render(<WhatsNewDialog />);

    expect(await screen.findByRole("dialog", { name: "ما الجديد في Archive Suite 1.2.1" })).toBeTruthy();
    expect(screen.getByText("دعم متكامل للغتين")).toBeTruthy();
    expect(screen.getByText("اكتشف تفاصيل الإصدار")).toBeTruthy();
    expect(screen.getByRole("link", { name: "عرض تفاصيل الإصدار" })).toHaveAttribute(
      "href",
      "/help/releases/1.2.1",
    );

    fireEvent.click(screen.getByRole("button", { name: "ابدأ العمل" }));

    expect(window.localStorage.getItem(WHATS_NEW_STORAGE_KEY)).toBe(WHATS_NEW_RELEASE);
    expect(screen.queryByRole("dialog", { name: "ما الجديد في Archive Suite 1.2.1" })).toBeNull();
  });

  it("stays closed after the current release was acknowledged", () => {
    window.localStorage.setItem(WHATS_NEW_STORAGE_KEY, WHATS_NEW_RELEASE);
    render(<WhatsNewDialog />);

    expect(screen.queryByRole("dialog", { name: "ما الجديد في مسار 1.1" })).toBeNull();
  });

  it("can permanently hide future whats-new dialogs on this device", async () => {
    render(<WhatsNewDialog />);

    await screen.findByRole("dialog", { name: "ما الجديد في Archive Suite 1.2.1" });
    fireEvent.click(screen.getByRole("checkbox", { name: "لا تعرض تحديثات ما الجديد مرة أخرى" }));
    fireEvent.click(screen.getByRole("button", { name: "ابدأ العمل" }));

    expect(window.localStorage.getItem(WHATS_NEW_DISMISSED_KEY)).toBe("true");
  });
});

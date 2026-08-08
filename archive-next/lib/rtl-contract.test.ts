import type { ReactElement } from "react";
import { describe, expect, test, vi } from "vitest";
import RootLayout from "@/app/layout";
import { isRtlLtrException } from "@/lib/rtl-contract";

const requestLocale = vi.hoisted(() => ({ locale: "ar" }));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({
    "x-archive-locale": requestLocale.locale,
    "x-archive-locale-cookie": "1",
  }),
}));

vi.mock("next/font/google", () => ({
  IBM_Plex_Sans_Arabic: () => ({ variable: "font-arabic" }),
}));

describe("RTL operational contract (V1-306B)", () => {
  test.each([
    ["ar", "rtl"],
    ["en", "ltr"],
  ])("renders the %s document root with %s direction", async (locale, direction) => {
    requestLocale.locale = locale;
    const layout = await RootLayout({ children: null }) as ReactElement<{ lang: string; dir: string }>;

    expect(layout.props.lang).toBe(locale);
    expect(layout.props.dir).toBe(direction);
  });

  test("limits LTR overrides to machine-readable exception kinds", () => {
    expect(isRtlLtrException("email")).toBe(true);
    expect(isRtlLtrException("button-label")).toBe(false);
  });
});

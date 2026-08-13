// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

let pathname = "/archive";

vi.mock("next/navigation", () => ({
  usePathname: () => pathname
}));
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

import RouteAnnouncer from "@/components/RouteAnnouncer";

describe("RouteAnnouncer", () => {
  beforeEach(() => {
    pathname = "/archive";
    document.title = "الأرشيف | مسار";
  });

  test("announces the title once after a client-side route change", () => {
    const { rerender } = render(<RouteAnnouncer />);
    expect(screen.getByTestId("route-announcer")).toHaveTextContent("تم فتح الأرشيف | مسار");

    pathname = "/search";
    document.title = "البحث | مسار";
    rerender(<RouteAnnouncer />);

    expect(screen.getByTestId("route-announcer")).toHaveTextContent("تم فتح البحث | مسار");
  });
});

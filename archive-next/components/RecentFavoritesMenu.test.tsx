// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import RecentFavoritesMenu from "@/components/RecentFavoritesMenu";
import { addFavorite } from "@/lib/favorites";
import { recordView } from "@/lib/recent-items";

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

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("RecentFavoritesMenu (V1-773)", () => {
  test("shows empty-state copy when nothing is favorited or recently viewed", async () => {
    render(<RecentFavoritesMenu />);
    fireEvent.click(screen.getByRole("button", { name: "العناصر الأخيرة والمفضّلة" }));

    expect(await screen.findByText("لا توجد عناصر مفضّلة بعد.")).toBeTruthy();
    expect(screen.getByText("لم تفتح أي سجل بعد.")).toBeTruthy();
  });

  test("lists favorited and recently-viewed records once opened", async () => {
    addFavorite({ id: "rec-1", title: "سجل مفضّل", addedAt: new Date().toISOString() });
    recordView("rec-2", "سجل مفتوح مؤخرًا");

    render(<RecentFavoritesMenu />);
    fireEvent.click(screen.getByRole("button", { name: "العناصر الأخيرة والمفضّلة" }));

    expect(await screen.findByText("سجل مفضّل")).toBeTruthy();
    expect(screen.getByText("سجل مفتوح مؤخرًا")).toBeTruthy();
  });
});

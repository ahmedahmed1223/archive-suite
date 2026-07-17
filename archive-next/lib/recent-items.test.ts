// @vitest-environment jsdom
import { afterEach, describe, expect, test } from "vitest";
import { clearRecent, listRecent, recordView } from "@/lib/recent-items";

afterEach(() => {
  clearRecent();
});

describe("recent-items", () => {
  test("returns an empty list initially", () => {
    expect(listRecent()).toEqual([]);
  });

  test("records a view and lists it most-recent-first", () => {
    recordView("rec-1", "الأول", "document");
    recordView("rec-2", "الثاني", "image");

    const items = listRecent();
    expect(items.map((item) => item.id)).toEqual(["rec-2", "rec-1"]);
    expect(items[0].title).toBe("الثاني");
  });

  test("moves an already-viewed item to the front instead of duplicating it", () => {
    recordView("rec-1", "الأول");
    recordView("rec-2", "الثاني");
    recordView("rec-1", "الأول");

    const items = listRecent();
    expect(items.map((item) => item.id)).toEqual(["rec-1", "rec-2"]);
  });

  test("caps the list at 10 entries", () => {
    for (let i = 0; i < 12; i += 1) {
      recordView(`rec-${i}`, `عنصر ${i}`);
    }

    const items = listRecent();
    expect(items).toHaveLength(10);
    expect(items[0].id).toBe("rec-11");
  });
});

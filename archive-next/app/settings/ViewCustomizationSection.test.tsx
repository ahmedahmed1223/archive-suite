// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DEFAULT_EXPERIENCE } from "@/lib/experience-profile";

const { savedSearchesMock } = vi.hoisted(() => ({ savedSearchesMock: vi.fn() }));

vi.mock("@/lib/i18n/LocaleProvider", async () => {
  const { getDictionary } = await vi.importActual<typeof import("@/lib/i18n/dictionaries")>("@/lib/i18n/dictionaries");
  return { useLocale: () => ({ locale: "ar", t: getDictionary("ar") }) };
});
vi.mock("@/lib/auth-session", () => ({ useAuthSession: () => ({ status: "authenticated", accessToken: "token" }) }));
vi.mock("@/lib/archive-api", () => ({
  createArchiveApiClient: () => ({ savedSearches: savedSearchesMock })
}));

const { default: ViewCustomizationSection } = await import("./ViewCustomizationSection");

function experienceWith(archive: { mode?: "table" | "grid"; columns?: string[]; defaultSavedSearchId?: string | null }) {
  return {
    ...structuredClone(DEFAULT_EXPERIENCE),
    views: { value: { archive }, source: "user" as const, editable: true }
  };
}

describe("ViewCustomizationSection", () => {
  afterEach(() => {
    cleanup();
    savedSearchesMock.mockReset();
  });

  test("the title column is never offered as a toggle -- it always stays visible", () => {
    savedSearchesMock.mockResolvedValue({ ok: true, searches: [] });
    const onUpdate = vi.fn().mockResolvedValue({ ok: true });

    render(<ViewCustomizationSection experience={experienceWith({})} onUpdate={onUpdate} />);

    expect(screen.queryByLabelText("العنوان")).not.toBeInTheDocument();
  });

  test("toggling a column off keeps title and writes the remaining columns via onUpdate", () => {
    savedSearchesMock.mockResolvedValue({ ok: true, searches: [] });
    const onUpdate = vi.fn().mockResolvedValue({ ok: true });

    render(
      <ViewCustomizationSection
        experience={experienceWith({ mode: "table", columns: ["title", "store", "type", "updated"] })}
        onUpdate={onUpdate}
      />
    );

    fireEvent.click(screen.getByLabelText("المخزن"));

    expect(onUpdate).toHaveBeenCalledWith({
      views: { archive: expect.objectContaining({ columns: expect.arrayContaining(["title", "type", "updated"]) }) }
    });
    const call = onUpdate.mock.calls[0][0];
    expect(call.views.archive.columns).not.toContain("store");
  });

  test("lists fetched saved searches and writes the chosen id as defaultSavedSearchId", async () => {
    savedSearchesMock.mockResolvedValue({
      ok: true,
      searches: [{ id: "abc", name: "بحث الشهر الحالي", query: null, filters: null, createdAt: null, updatedAt: null }]
    });
    const onUpdate = vi.fn().mockResolvedValue({ ok: true });

    render(<ViewCustomizationSection experience={experienceWith({})} onUpdate={onUpdate} />);

    const select = await screen.findByDisplayValue("بلا");
    fireEvent.change(select, { target: { value: "abc" } });

    expect(onUpdate).toHaveBeenCalledWith({
      views: { archive: expect.objectContaining({ defaultSavedSearchId: "abc" }) }
    });
  });
});

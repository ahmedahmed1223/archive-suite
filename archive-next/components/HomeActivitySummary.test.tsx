// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import type { ArchiveApiClient } from "@/lib/archive-api";

const { default: HomeActivitySummary } = await import("./HomeActivitySummary");

function stubApi(overrides: Partial<ArchiveApiClient> = {}): ArchiveApiClient {
  return { search: vi.fn() } as unknown as ArchiveApiClient & typeof overrides;
}

describe("HomeActivitySummary", () => {
  afterEach(cleanup);

  test("shows the 7-day addition count and description-completion percent, computed from real facets.total", async () => {
    const search = vi.fn(async (params: { dateFrom?: string; descriptionState?: string }) => {
      if (params.dateFrom) return { ok: true, records: [], facets: { mode: "keyword", total: 12 } };
      if (params.descriptionState === "complete") return { ok: true, records: [], facets: { mode: "keyword", total: 30 } };
      return { ok: true, records: [], facets: { mode: "keyword", total: 40 } };
    });
    const api = { search } as unknown as ArchiveApiClient;

    render(
      <LocaleProvider initialLocale="ar" hasLocaleCookie>
        <HomeActivitySummary api={api} accessToken="token" totalRecords={40} typeFacets={[{ value: "video", label: "فيديو", count: 40 }]} />
      </LocaleProvider>
    );

    // ar-EG locale formats with Arabic-Indic digits.
    expect(await screen.findByText("١٢")).toBeInTheDocument();
    // 30 complete of 40 total => 75%.
    expect(await screen.findByText("75%")).toBeInTheDocument();
  });

  test("never fabricates a count: an unavailable facets.total renders as 'not enough data', not 0 or a guess", async () => {
    const search = vi.fn(async () => ({ ok: true, records: [], facets: undefined }));
    const api = { search } as unknown as ArchiveApiClient;

    render(
      <LocaleProvider initialLocale="ar" hasLocaleCookie>
        <HomeActivitySummary api={api} accessToken="token" totalRecords={undefined} typeFacets={undefined} />
      </LocaleProvider>
    );

    await waitFor(() => expect(search).toHaveBeenCalled());
    expect(screen.getAllByText("لا توجد بيانات كافية بعد").length).toBeGreaterThan(0);
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
    expect(screen.queryByText(/^0$/)).not.toBeInTheDocument();
  });

  test("renders the media-type distribution from the caller's real facets, not a refetch", async () => {
    const search = vi.fn(async () => ({ ok: true, records: [], facets: { mode: "keyword", total: 5 } }));
    const api = { search } as unknown as ArchiveApiClient;

    render(
      <LocaleProvider initialLocale="ar" hasLocaleCookie>
        <HomeActivitySummary
          api={api}
          accessToken="token"
          totalRecords={5}
          typeFacets={[
            { value: "video", label: "فيديو", count: 3 },
            { value: "audio", label: "صوت", count: 2 }
          ]}
        />
      </LocaleProvider>
    );

    expect(await screen.findByText("فيديو")).toBeInTheDocument();
    expect(screen.getByText("صوت")).toBeInTheDocument();
  });
});

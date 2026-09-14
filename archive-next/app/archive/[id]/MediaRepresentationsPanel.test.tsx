// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import type { ArchiveRecord, MediaRepresentation } from "@/lib/archive-api";

const { mediaRepresentations } = vi.hoisted(() => ({ mediaRepresentations: vi.fn() }));

vi.mock("@/lib/archive-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/archive-api")>("@/lib/archive-api");
  return { ...actual, createArchiveApiClient: () => ({ mediaRepresentations }) };
});

import MediaRepresentationsPanel from "./MediaRepresentationsPanel";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("MediaRepresentationsPanel", () => {
  test("shows the source and only current copies returned by the API", async () => {
    const representations: MediaRepresentation[] = [
      { id: "source-1", type: "source", status: "ready", versionToken: "record:checksum-1", isCurrentVersion: true, derivativeId: null, createdAt: null },
      { id: "thumbnail-1", type: "thumbnail", status: "ready", versionToken: "record:checksum-1", isCurrentVersion: true, derivativeId: "derivative-1", createdAt: "2026-09-14T10:00:00.000Z" },
    ];
    mediaRepresentations.mockResolvedValue({ ok: true, representations });

    render(<LocaleProvider initialLocale="ar" hasLocaleCookie={false}><MediaRepresentationsPanel record={{ id: "record-1", store: "archive-items" } as ArchiveRecord} /></LocaleProvider>);

    await waitFor(() => expect(mediaRepresentations).toHaveBeenCalledWith("record-1", { store: "archive-items" }));
    expect(screen.getByRole("heading", { name: "تمثيلات الوسائط" })).toBeInTheDocument();
    expect(screen.getByText("المصدر الحالي")).toBeInTheDocument();
    expect(screen.getByText("صورة مصغرة")).toBeInTheDocument();
    expect(screen.queryByText("نسخة حفظ")).not.toBeInTheDocument();
    expect(screen.getAllByText("record:checksum-1")).toHaveLength(2);
  });
});

// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import CollectionsPage from "./page";

vi.mock("@/components/AppShell", () => ({ default: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/PageToolbar", () => ({ default: ({ children, title }: { children: ReactNode; title: string }) => <section aria-label={title}>{children}</section> }));
vi.mock("@/components/RoleGate", () => ({ useCapability: () => true }));
vi.mock("@/components/ui/ConfirmDialog", () => ({ useConfirmDialog: () => ({ confirm: vi.fn() }) }));
vi.mock("@/components/IconPicker", () => ({ default: () => null }));
vi.mock("@/components/ChangeImpactPreview", () => ({ default: () => null }));
vi.mock("@/components/ui/Skeleton", () => ({ Skeleton: () => null }));
vi.mock("@/lib/toast", () => ({ toastError: vi.fn(), toastSuccess: vi.fn() }));
vi.mock("@/lib/archive-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/archive-api")>();
  return {
    ...actual,
    createArchiveApiClient: () => ({
      collections: vi.fn().mockResolvedValue({ ok: true, collections: [] }),
      archivalNodes: vi.fn().mockResolvedValue({ ok: true, nodes: [] }),
      authorityEntities: vi.fn().mockResolvedValue({ ok: true, entities: [] }),
      curatedCollections: vi.fn().mockResolvedValue({ ok: true, collections: [{ id: "curated-1", title: "Evening news", introduction: null, status: "draft" }] }),
      curatedCollectionRecords: vi.fn().mockResolvedValue({ ok: true, recordIds: ["record-1", "record-2"] }),
      search: vi.fn().mockResolvedValue({ ok: true, records: [{ id: "record-1", title: "Bulletin 1", type: "video", tags: [] }, { id: "record-2", title: "Bulletin 2", type: "video", tags: [] }] })
    })
  };
});

describe("curated collection membership", () => {
  afterEach(() => cleanup());

  test("shows the selected collection's records without implying they were moved", async () => {
    render(<LocaleProvider initialLocale="en" hasLocaleCookie><CollectionsPage /></LocaleProvider>);

    await waitFor(() => expect(screen.getAllByRole("button", { name: "Remove from collection" })).toHaveLength(2));
    expect(screen.getByText("Selected records")).toBeVisible();
    expect(screen.getByText("Bulletin 1")).toBeVisible();
    expect(screen.getAllByRole("button", { name: "Move down" })).toHaveLength(2);
    // The record still counts toward the archive's own type breakdown, proving
    // curated membership does not remove or relocate it from the archive.
    expect(screen.getByText("Type: video")).toBeVisible();
  });
});

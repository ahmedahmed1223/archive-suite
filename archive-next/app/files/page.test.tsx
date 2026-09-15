// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import FilesPage from "./page";

const createShare = vi.hoisted(() => vi.fn());

vi.mock("@/components/AppShell", () => ({ default: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/PageToolbar", () => ({ default: ({ children, title }: { children: ReactNode; title: string }) => <section aria-label={title}>{children}</section> }));
vi.mock("@/components/RoleGate", () => ({ useCapability: () => true }));
vi.mock("@/components/ui/Skeleton", () => ({ Skeleton: () => null }));
// rightsRefusal stays real: this test is worthless if it agrees with a local
// re-implementation of the refusal contract instead of the shipped one.
vi.mock("@/lib/archive-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/archive-api")>();
  return {
    ...actual,
    createArchiveApiClient: () => ({
      createShare,
      files: vi.fn().mockResolvedValue({
        ok: true,
        files: [{ key: "media/clip.mov", name: "clip.mov", size: 1024, modifiedAt: "2026-09-15T09:00:00.000Z" }]
      }),
      storageWorkspace: vi.fn().mockResolvedValue({ ok: true, storages: [] }),
      ingestScan: vi.fn()
    })
  };
});

const REFUSAL = {
  ok: false,
  error: "Access denied by rights enforcement.",
  code: "FORBIDDEN",
  reason: "لا توجد بيانات حقوق مسجّلة",
  decidedBy: "no_record"
};

async function shareTheFirstFile() {
  render(
    <LocaleProvider initialLocale="ar" hasLocaleCookie>
      <FilesPage />
    </LocaleProvider>
  );

  const copy = (await import("@/lib/i18n/dictionaries/ar/pages/files")).files;
  fireEvent.click(await screen.findByRole("checkbox", { name: copy.select.replace("{name}", "clip.mov") }));
  fireEvent.click(await screen.findByRole("button", { name: new RegExp(copy.createShare) }));

  const dialog = await screen.findByRole("dialog");
  for (const checkbox of Array.from(dialog.querySelectorAll<HTMLInputElement>("input[type=checkbox]"))) {
    fireEvent.click(checkbox);
  }
  fireEvent.click(screen.getByRole("button", { name: copy.confirmShare }));
  return copy;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("files share flow", () => {
  test("shows the clause that refused the share instead of a bare error", async () => {
    createShare.mockResolvedValue(REFUSAL);

    await shareTheFirstFile();

    const notice = await screen.findByRole("alert");
    expect(notice).toHaveAttribute("data-decided-by", "no_record");
    expect(notice).toHaveTextContent("لا توجد بيانات حقوق مسجّلة لهذه المادة بعد.");
  });

  test("keeps the plain error banner for a failure that names no clause", async () => {
    createShare.mockResolvedValue({ ok: false, error: "تعذر إنشاء الرابط.", code: "SERVER_ERROR" });

    const copy = await shareTheFirstFile();

    const banner = await screen.findByRole("alert");
    expect(banner).not.toHaveAttribute("data-decided-by");
    expect(banner).toHaveTextContent(copy.shareError);
  });
});

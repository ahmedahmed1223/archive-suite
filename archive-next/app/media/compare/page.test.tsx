// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  useSearchParams: () => new URLSearchParams()
}));

// AppShell pulls in AppHeader/OnboardingPrompt/etc, which needs a full app
// router + auth context unrelated to this mode-switch test -- stub it to a
// passthrough, same approach as app/archive/page.test.tsx.
vi.mock("@/components/AppShell", () => ({
  default: ({ children }: { children: ReactNode }) => <div data-testid="app-shell-stub">{children}</div>
}));

vi.mock("./RecordVersionCompare", () => ({
  default: ({ recordId, store }: { recordId: string; store: string }) => (
    <div data-testid="record-version-compare">
      {recordId}:{store}
    </div>
  )
}));

import ComparePage from "./page";

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/media/compare");
});

function renderPage() {
  return render(
    <LocaleProvider initialLocale="ar" hasLocaleCookie>
      <ComparePage />
    </LocaleProvider>
  );
}

/**
 * V3-MEDIA-004: ?recordId= switches /media/compare into record-version
 * compare mode; without it, the page keeps its original manual two-path
 * comparison tool unchanged.
 */
describe("media compare page mode switch", () => {
  test("falls back to the manual path-comparison UI without recordId", async () => {
    window.history.replaceState(null, "", "/media/compare");
    renderPage();
    expect(await screen.findByLabelText("مسار الملف أ")).toBeTruthy();
    expect(screen.queryByTestId("record-version-compare")).toBeNull();
  });

  test("switches to record-version compare mode when recordId is present", async () => {
    window.history.replaceState(null, "", "/media/compare?recordId=r1&store=archive-items");
    renderPage();
    await waitFor(() => expect(screen.getByTestId("record-version-compare")).toBeTruthy());
    expect(screen.getByTestId("record-version-compare").textContent).toBe("r1:archive-items");
    expect(screen.queryByLabelText("مسار الملف أ")).toBeNull();
  });
});

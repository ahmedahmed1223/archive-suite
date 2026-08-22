// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import UploadsPage from "./page";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";

// The intake forms hit the API and the auth session on mount — both are
// irrelevant to this hierarchy test, so they are stubbed out.
const mocks = vi.hoisted(() => ({
  uploadFile: vi.fn(),
  useAuthSession: vi.fn()
}));

vi.mock("@/lib/auth-session", () => ({
  useAuthSession: mocks.useAuthSession
}));

vi.mock("@/lib/experience-profile-context", () => ({
  useExperienceProfile: () => ({
    experience: { navigation: { value: undefined } },
    capabilities: new Proxy({}, { get: () => ({ status: "enabled", value: true }) })
  })
}));

vi.mock("@/components/ThemeProvider", () => ({
  useTheme: () => ({ settings: { currentPreset: "cinematic-dark" }, setPreset: vi.fn() })
}));

vi.mock("@/components/NotificationsPanel", () => ({ NotificationsPanel: () => null }));
vi.mock("@/components/DensityToggle", () => ({ default: () => null }));
vi.mock("@/components/FocusModeToggle", () => ({ default: () => null }));

vi.mock("@/lib/archive-api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/archive-api")>();
  return {
    ...original,
    createArchiveApiClient: () => ({
      uploadFile: mocks.uploadFile,
      intakeTemplates: vi.fn().mockResolvedValue({ ok: true as const, templates: [] }),
      uploadLinks: vi.fn().mockResolvedValue({ ok: true as const, links: [] })
    })
  };
});

vi.mock("next/link", () => ({
  default: ({ children, ...props }: React.ComponentProps<"a">) => <a {...props}>{children}</a>
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/uploads",
  useSearchParams: () => new URLSearchParams()
}));

mocks.useAuthSession.mockReturnValue({ status: "authenticated", user: { role: "editor" }, logout: vi.fn() });

function renderUploads(locale: "ar" | "en" = "ar") {
  return render(
    <LocaleProvider initialLocale={locale} hasLocaleCookie>
      <UploadsPage />
    </LocaleProvider>
  );
}

// V14-UX-006 (Task 6): one primary intake path; secondary options disclosed.
describe("uploads page intake hierarchy", () => {
  test("shows the file upload form first and hides secondary intake behind a disclosure", () => {
    const { container } = renderUploads();

    const primary = container.querySelector(".add-workspace__primary form");
    expect(primary).toBeVisible();
    // Fileless record is a secondary route now — inside the closed disclosure.
    const filelessHeading = screen.queryByText(/سجل بلا ملف|Fileless record/);
    if (filelessHeading) {
      expect(filelessHeading.closest(".disclosure-toolbar__content")).not.toBeVisible();
    }
  });

  test("reveals other intake options on demand", () => {
    renderUploads();

    const trigger = screen.getAllByText(/خيارات إضافة أخرى/)[0];
    expect(trigger).toBeVisible();

    fireEvent.click(trigger.closest("summary") ?? trigger);
    const details = trigger.closest("details");
    expect(details?.open).toBe(true);
  });
});

// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { DEFAULT_CAPABILITIES, DEFAULT_EXPERIENCE, type Capabilities } from "@/lib/experience-profile";

const authState = vi.hoisted(() => ({ user: { role: "admin" as "admin" | "editor" | "viewer" } }));
const profileState = vi.hoisted(() => ({
  status: "ready" as "loading" | "ready" | "fallback",
  capabilities: {} as Capabilities,
  capabilitiesStatus: "ready" as "loading" | "ready" | "fallback",
  capabilitiesError: null as string | null,
  experience: {} as typeof import("@/lib/experience-profile").DEFAULT_EXPERIENCE,
  experienceStatus: "ready" as "loading" | "ready" | "fallback",
  experienceError: null as string | null,
  profileVersion: 0,
  writeConflict: null as { scope: "experience" | "capabilities"; message: string } | null,
  clearWriteConflict: vi.fn(),
  retryLoad: vi.fn(),
  updateExperience: vi.fn(),
  resetExperience: vi.fn(),
  updateCapabilities: vi.fn()
}));

vi.mock("@/lib/auth-session", () => ({ useAuthSession: () => authState }));
vi.mock("@/lib/experience-profile-context", () => ({ useExperienceProfile: () => profileState }));
vi.mock("@/lib/i18n/LocaleProvider", async () => {
  const { getDictionary } = await vi.importActual<typeof import("@/lib/i18n/dictionaries")>("@/lib/i18n/dictionaries");
  return { useLocale: () => ({ locale: "ar", t: getDictionary("ar") }) };
});

const { default: SettingsHub } = await import("./SettingsHub");

function resetProfileState() {
  profileState.status = "ready";
  profileState.capabilities = structuredClone(DEFAULT_CAPABILITIES);
  profileState.capabilitiesStatus = "ready";
  profileState.capabilitiesError = null;
  profileState.experience = structuredClone(DEFAULT_EXPERIENCE);
  profileState.experienceStatus = "ready";
  profileState.experienceError = null;
  profileState.writeConflict = null;
  profileState.clearWriteConflict = vi.fn();
  profileState.retryLoad = vi.fn();
  profileState.updateExperience = vi.fn().mockResolvedValue({ ok: true });
  profileState.resetExperience = vi.fn().mockResolvedValue({ ok: true });
  profileState.updateCapabilities = vi.fn().mockResolvedValue({ ok: true });
}

describe("SettingsHub", () => {
  afterEach(cleanup);

  test("shows the administration section to an administrator", () => {
    resetProfileState();
    authState.user = { role: "admin" };

    render(<SettingsHub />);

    expect(screen.getByRole("heading", { name: "الإدارة" })).toBeInTheDocument();
  });

  test("never renders the administration section for a non-admin", () => {
    resetProfileState();
    authState.user = { role: "editor" };

    render(<SettingsHub />);

    expect(screen.queryByRole("heading", { name: "الإدارة" })).not.toBeInTheDocument();
    // Not just visually hidden -- the controls must not exist in the tree at all.
    expect(screen.queryByLabelText("التحكم بالنظام")).not.toBeInTheDocument();
  });

  test("renders the server-provided lock reason for a locked capability, verbatim", () => {
    resetProfileState();
    authState.user = { role: "admin" };
    profileState.capabilities = {
      ...structuredClone(DEFAULT_CAPABILITIES),
      semanticSearch: {
        value: false,
        source: "deployment",
        editable: false,
        status: "needs_configuration",
        reason: "Semantic search requires PostgreSQL, pgvector, and an embeddings provider.",
        version: 0
      }
    };

    render(<SettingsHub />);

    expect(screen.getByText("Semantic search requires PostgreSQL, pgvector, and an embeddings provider.")).toBeInTheDocument();
    const checkbox = screen.getByLabelText("البحث الدلالي") as HTMLInputElement;
    expect(checkbox.disabled).toBe(true);
  });

  test("commits an editable experience setting change through the profile's update call", () => {
    resetProfileState();
    authState.user = { role: "editor" };

    render(<SettingsHub />);

    const densitySelect = screen.getByLabelText("كثافة العرض") as HTMLSelectElement;
    expect(densitySelect.value).toBe("comfortable");

    fireEvent.change(densitySelect, { target: { value: "compact" } });

    // MyExperienceSection hands the change straight to the profile's optimistic
    // updater -- the actual optimistic-paint-before-server-confirms behavior is
    // exercised end-to-end in SettingsHub.optimistic.test.tsx against the real
    // ExperienceProfileProvider.
    expect(profileState.updateExperience).toHaveBeenCalledWith({ density: "compact" });
  });

  test("renders a load-failure fallback with a retry affordance instead of crashing", () => {
    resetProfileState();
    profileState.status = "fallback";
    profileState.capabilitiesError = "Could not reach the server.";

    render(<SettingsHub />);

    expect(screen.getByRole("alert")).toHaveTextContent("Could not reach the server.");
    const retryButton = screen.getByRole("button", { name: "إعادة المحاولة" });

    fireEvent.click(retryButton);
    expect(profileState.retryLoad).toHaveBeenCalledTimes(1);
  });

  test("shows a distinct banner for a capability write conflict, separate from a generic error", () => {
    resetProfileState();
    profileState.writeConflict = { scope: "capabilities", message: "The capability changed since you last loaded it." };

    render(<SettingsHub />);

    expect(screen.getByText("The capability changed since you last loaded it.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "إغلاق" }));
    expect(profileState.clearWriteConflict).toHaveBeenCalledTimes(1);
  });
});

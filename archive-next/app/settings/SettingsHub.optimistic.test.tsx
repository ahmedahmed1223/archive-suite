// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { DEFAULT_CAPABILITIES } from "@/lib/experience-profile";

const authState = vi.hoisted(() => ({ status: "authenticated" as const, accessToken: "test-token", user: { role: "editor" as const } }));

vi.mock("@/lib/auth-session", () => ({ useAuthSession: () => authState }));
vi.mock("@/lib/i18n/LocaleProvider", async () => {
  const { getDictionary } = await vi.importActual<typeof import("@/lib/i18n/dictionaries")>("@/lib/i18n/dictionaries");
  return { useLocale: () => ({ locale: "ar", t: getDictionary("ar") }) };
});

const { ExperienceProfileProvider } = await import("@/lib/experience-profile-context");
const { default: SettingsHub } = await import("./SettingsHub");

function experienceBody(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    schemaVersion: 1,
    profileVersion: 3,
    experience: {
      locale: { value: "ar", source: "default", editable: true },
      timeZone: { value: "Europe/Istanbul", source: "default", editable: true },
      dateFormat: { value: "DD/MM/YYYY", source: "default", editable: true },
      timeFormat: { value: "24h", source: "default", editable: true },
      theme: { value: "cinematic-dark", source: "default", editable: true },
      density: { value: "comfortable", source: "default", editable: true },
      textScale: { value: "medium", source: "default", editable: true },
      reducedMotion: { value: false, source: "default", editable: true },
      homePage: { value: "/", source: "default", editable: true },
      navigation: { value: { order: [], hiddenModules: [] }, source: "default", editable: true },
      views: { value: { archive: { mode: "table", pageSize: 25, columns: [], defaultSavedSearchId: null } }, source: "default", editable: true },
      shortcuts: {
        value: { playPause: "Space", seekForward: "ArrowRight", seekBackward: "ArrowLeft", nextComment: "N", previousComment: "P" },
        source: "default",
        editable: true
      },
      notifications: { value: { dailyDigest: false, optional: [] }, source: "default", editable: true },
      studioLayout: { value: { comments: "right", transcript: "left", timelineHeight: 240, panels: [] }, source: "default", editable: true },
      ...overrides
    }
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("SettingsHub optimistic write (real provider)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test("paints the new density before the PATCH resolves, keeps it once the server confirms", async () => {
    let resolvePatch!: (value: Response) => void;

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/system/capabilities")) return jsonResponse(200, { ok: true, schemaVersion: 1, capabilities: DEFAULT_CAPABILITIES });
      if (init?.method === "PATCH" && url.endsWith("/account/experience")) {
        return new Promise<Response>((resolve) => {
          resolvePatch = resolve;
        });
      }
      if (url.endsWith("/account/experience")) return jsonResponse(200, experienceBody());
      throw new Error(`unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ExperienceProfileProvider>
        <SettingsHub />
      </ExperienceProfileProvider>
    );

    const densitySelect = (await screen.findByLabelText("كثافة العرض")) as HTMLSelectElement;
    await waitFor(() => expect(densitySelect.value).toBe("comfortable"));

    fireEvent.change(densitySelect, { target: { value: "compact" } });

    // Optimistic: the select already reflects "compact" while the PATCH is still in flight.
    expect(densitySelect.value).toBe("compact");

    resolvePatch(jsonResponse(200, experienceBody({ density: { value: "compact", source: "user", editable: true } })));

    await waitFor(() => expect(densitySelect.value).toBe("compact"));
  });
});

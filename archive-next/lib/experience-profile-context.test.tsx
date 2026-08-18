// @vitest-environment jsdom

import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  DEFAULT_CAPABILITIES,
  type Capabilities,
  type ExperienceSettings
} from "@/lib/experience-profile";

const authState = vi.hoisted(() => ({
  status: "authenticated" as "authenticated" | "guest" | "loading",
  accessToken: "test-access-token" as string | undefined
}));

vi.mock("@/lib/auth-session", () => ({
  useAuthSession: () => authState
}));

// Imported after the mock so the provider picks up the mocked auth hook.
const { ExperienceProfileProvider, useExperienceProfile } = await import("@/lib/experience-profile-context");

function wrapper({ children }: Readonly<{ children: ReactNode }>) {
  return <ExperienceProfileProvider>{children}</ExperienceProfileProvider>;
}

function capabilitiesBody(overrides: Partial<Capabilities> = {}) {
  return {
    ok: true,
    schemaVersion: 1,
    capabilities: { ...DEFAULT_CAPABILITIES, ...overrides }
  };
}

function experienceBody(overrides: Partial<ExperienceSettings> = {}) {
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
      views: {
        value: { archive: { mode: "table", pageSize: 25, columns: [], defaultSavedSearchId: null } },
        source: "default",
        editable: true
      },
      shortcuts: {
        value: {
          playPause: "Space",
          seekForward: "ArrowRight",
          seekBackward: "ArrowLeft",
          nextComment: "N",
          previousComment: "P"
        },
        source: "default",
        editable: true
      },
      notifications: { value: { dailyDigest: false, optional: [] }, source: "default", editable: true },
      studioLayout: {
        value: { comments: "right", transcript: "left", timelineHeight: 240, panels: [] },
        source: "default",
        editable: true
      },
      ...overrides
    }
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("ExperienceProfileProvider", () => {
  beforeEach(() => {
    authState.status = "authenticated";
    authState.accessToken = "test-access-token";
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  test("loads capabilities and experience from the server on mount", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/system/capabilities")) return jsonResponse(200, capabilitiesBody());
      if (url.endsWith("/account/experience")) return jsonResponse(200, experienceBody());
      throw new Error(`unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useExperienceProfile(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("ready"));

    expect(result.current.capabilities.systemControl.value).toBe(true);
    expect(result.current.experience.locale.value).toBe("ar");
    expect(result.current.profileVersion).toBe(3);
    expect(result.current.experienceError).toBeNull();
    expect(result.current.capabilitiesError).toBeNull();
  });

  test("falls back to safe defaults without crashing when the initial load fails", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("network down");
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useExperienceProfile(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("fallback"));

    expect(result.current.capabilities).toEqual(DEFAULT_CAPABILITIES);
    expect(result.current.capabilities.systemControl.editable).toBe(false);
    expect(result.current.experienceError).toBeTruthy();
    expect(result.current.capabilitiesError).toBeTruthy();

    // retryLoad must give the UI a way to try again instead of being stuck.
    const fetchMockRetry = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/system/capabilities")) return jsonResponse(200, capabilitiesBody());
      if (url.endsWith("/account/experience")) return jsonResponse(200, experienceBody());
      throw new Error(`unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMockRetry);

    act(() => {
      result.current.retryLoad();
    });

    await waitFor(() => expect(result.current.status).toBe("ready"));
  });

  test("applies experience writes optimistically and keeps the server value on success", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "PATCH" && url.endsWith("/account/experience")) {
        return jsonResponse(200, experienceBody({ theme: { value: "luxury-dark", source: "user", editable: true } }));
      }
      if (url.endsWith("/system/capabilities")) return jsonResponse(200, capabilitiesBody());
      if (url.endsWith("/account/experience")) return jsonResponse(200, experienceBody());
      throw new Error(`unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useExperienceProfile(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("ready"));

    let writePromise!: Promise<unknown>;
    act(() => {
      writePromise = result.current.updateExperience({ theme: "luxury-dark" });
    });

    // Optimistic value is visible before the PATCH resolves.
    expect(result.current.experience.theme.value).toBe("luxury-dark");

    const outcome = await act(async () => writePromise);

    expect(outcome).toEqual({ ok: true });
    expect(result.current.experience.theme.value).toBe("luxury-dark");
    expect(result.current.experience.theme.source).toBe("user");
  });

  test("rolls back an optimistic experience write when the PATCH fails", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "PATCH" && url.endsWith("/account/experience")) {
        return jsonResponse(422, { ok: false, error: "Invalid theme.", code: "VALIDATION_FAILED" });
      }
      if (url.endsWith("/system/capabilities")) return jsonResponse(200, capabilitiesBody());
      if (url.endsWith("/account/experience")) return jsonResponse(200, experienceBody());
      throw new Error(`unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useExperienceProfile(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("ready"));

    const originalTheme = result.current.experience.theme.value;

    let writePromise!: Promise<unknown>;
    act(() => {
      writePromise = result.current.updateExperience({ theme: "luxury-dark" });
    });

    expect(result.current.experience.theme.value).toBe("luxury-dark");

    const outcome = await act(async () => writePromise);

    expect(outcome).toMatchObject({ ok: false, failure: { kind: "validation" } });
    expect(result.current.experience.theme.value).toBe(originalTheme);
    expect(result.current.experienceError).toBe("Invalid theme.");
  });

  test("surfaces a 409 capability write conflict distinctly instead of as a generic error", async () => {
    const conflictCapabilities: Capabilities = {
      ...DEFAULT_CAPABILITIES,
      systemControl: { value: false, source: "system", editable: true, status: "disabled", reason: "Disabled by an administrator.", version: 5 }
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (init?.method === "PATCH" && url.endsWith("/system/capabilities")) {
        return jsonResponse(409, {
          ok: false,
          error: "The capability changed since you last loaded it.",
          code: "CAPABILITY_VERSION_CONFLICT",
          capabilities: conflictCapabilities
        });
      }
      if (url.endsWith("/system/capabilities")) {
        return jsonResponse(
          200,
          capabilitiesBody({ systemControl: { value: true, source: "system", editable: true, status: "enabled", reason: null, version: 4 } })
        );
      }
      if (url.endsWith("/account/experience")) return jsonResponse(200, experienceBody());
      throw new Error(`unexpected request: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useExperienceProfile(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("ready"));

    let writePromise!: Promise<unknown>;
    act(() => {
      writePromise = result.current.updateCapabilities({ systemControl: false });
    });

    const outcome = await act(async () => writePromise);

    expect(outcome).toMatchObject({ ok: false, failure: { kind: "version_conflict" } });
    expect(result.current.writeConflict).toEqual({
      scope: "capabilities",
      message: "The capability changed since you last loaded it."
    });
    // The server's refreshed snapshot (version 5) replaces the stale optimistic write, not a blind rollback.
    expect(result.current.capabilities.systemControl.version).toBe(5);

    act(() => {
      result.current.clearWriteConflict();
    });
    expect(result.current.writeConflict).toBeNull();
  });
});

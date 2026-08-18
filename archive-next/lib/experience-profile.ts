import type { components as GeneratedApiComponents } from "@/lib/generated/archive-api";

type GeneratedSchemas = GeneratedApiComponents["schemas"];

export type SettingSource = GeneratedSchemas["SettingSource"];
export type CapabilityStatus = GeneratedSchemas["CapabilityStatus"];
export type EffectiveCapabilitySetting = GeneratedSchemas["EffectiveCapabilitySetting"];
export type Capabilities = GeneratedSchemas["Capabilities"];
export type CapabilityKey = keyof Capabilities;
export type EffectiveExperienceSetting = GeneratedSchemas["EffectiveExperienceSetting"];
export type ExperienceSettings = GeneratedSchemas["ExperienceSettings"];
export type ExperienceKey = keyof ExperienceSettings;
export type UpdateExperienceProfileRequest = GeneratedSchemas["UpdateExperienceProfileRequest"];
export type UpdateCapabilitiesRequest = GeneratedSchemas["UpdateCapabilitiesRequest"];
type CapabilitiesResponse = GeneratedSchemas["CapabilitiesResponse"];
type ExperienceProfileResponse = GeneratedSchemas["ExperienceProfileResponse"];

// The two known-key lists mirror archive-laravel/config/archive-settings.php
// exactly. Do not add a key here that the Laravel contract does not define.
export const CAPABILITY_KEYS: readonly CapabilityKey[] = [
  "systemControl",
  "backups",
  "trash",
  "odbc",
  "broadcastMetadata",
  "semanticSearch",
  "mediaProcessing",
  "ocr",
  "mcp"
];

export const EXPERIENCE_KEYS: readonly ExperienceKey[] = [
  "locale",
  "timeZone",
  "dateFormat",
  "timeFormat",
  "theme",
  "density",
  "textScale",
  "reducedMotion",
  "homePage",
  "navigation",
  "views",
  "shortcuts",
  "notifications",
  "studioLayout"
];

function capabilityFallback(value: boolean): EffectiveCapabilitySetting {
  return { value, source: "default", editable: false, status: value ? "enabled" : "disabled", reason: null, version: 0 };
}

// Fallback values used only when the server cannot be reached (see
// acceptance criterion: never crash the app shell on a failed initial
// load). `editable: false` is deliberate — until the server confirms
// otherwise, offering an admin-only PATCH control here would send it into
// a request we can't fully sanity-check client side. Values mirror the
// Laravel `default` column, not an app-level guess.
export const DEFAULT_CAPABILITIES: Capabilities = {
  systemControl: capabilityFallback(true),
  backups: capabilityFallback(true),
  trash: capabilityFallback(true),
  odbc: capabilityFallback(true),
  broadcastMetadata: capabilityFallback(true),
  semanticSearch: capabilityFallback(false),
  mediaProcessing: capabilityFallback(false),
  ocr: capabilityFallback(false),
  mcp: capabilityFallback(true)
};

// Experience defaults are always editable — ExperienceProfileService never
// locks a user-scope value, so the fallback matches that unconditionally.
export const DEFAULT_EXPERIENCE: ExperienceSettings = {
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
  }
};

export const DEFAULT_SCHEMA_VERSION = 1;

export type WriteFailure =
  | { kind: "network"; message: string }
  | { kind: "unauthorized"; message: string }
  | { kind: "validation"; message: string }
  | { kind: "locked"; message: string; source: string }
  | { kind: "version_conflict"; message: string; capabilities?: Capabilities }
  | { kind: "http"; status: number; message: string };

export type FetchResult<T> = { ok: true; data: T } | { ok: false; failure: WriteFailure };

const API_BASE_URL = "/api/v1";

interface RawEnvelope {
  ok: boolean;
  error?: string;
  code?: string;
  capabilities?: Capabilities;
  source?: string;
}

async function requestJson<T>(
  path: string,
  { method = "GET", body, accessToken }: { method?: "GET" | "PATCH" | "DELETE"; body?: unknown; accessToken?: string } = {}
): Promise<FetchResult<T>> {
  const headers = new Headers({ Accept: "application/json" });

  if (body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      credentials: "include",
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    return { ok: false, failure: { kind: "network", message: "Could not reach the server." } };
  }

  const payload = (await response.json().catch(() => null)) as (RawEnvelope & Record<string, unknown>) | null;

  if (!payload) {
    return { ok: false, failure: { kind: "http", status: response.status, message: "The server returned an invalid response." } };
  }

  if (payload.ok === false) {
    const message = payload.error ?? "Request failed.";

    if (response.status === 409) {
      return { ok: false, failure: { kind: "version_conflict", message, capabilities: payload.capabilities } };
    }

    if (response.status === 403 && payload.code === "SETTING_LOCKED") {
      return { ok: false, failure: { kind: "locked", message, source: typeof payload.source === "string" ? payload.source : "release" } };
    }

    if (response.status === 401) {
      return { ok: false, failure: { kind: "unauthorized", message } };
    }

    if (response.status === 422) {
      return { ok: false, failure: { kind: "validation", message } };
    }

    return { ok: false, failure: { kind: "http", status: response.status, message } };
  }

  return { ok: true, data: payload as unknown as T };
}

export function fetchCapabilities(accessToken?: string): Promise<FetchResult<CapabilitiesResponse>> {
  return requestJson<CapabilitiesResponse>("/system/capabilities", { accessToken });
}

export function saveCapabilities(
  values: UpdateCapabilitiesRequest,
  accessToken?: string
): Promise<FetchResult<CapabilitiesResponse>> {
  return requestJson<CapabilitiesResponse>("/system/capabilities", { method: "PATCH", body: values, accessToken });
}

export function fetchExperienceProfile(accessToken?: string): Promise<FetchResult<ExperienceProfileResponse>> {
  return requestJson<ExperienceProfileResponse>("/account/experience", { accessToken });
}

export function saveExperienceProfile(
  values: UpdateExperienceProfileRequest,
  accessToken?: string
): Promise<FetchResult<ExperienceProfileResponse>> {
  return requestJson<ExperienceProfileResponse>("/account/experience", { method: "PATCH", body: values, accessToken });
}

export function resetExperienceProfile(accessToken?: string): Promise<FetchResult<ExperienceProfileResponse>> {
  return requestJson<ExperienceProfileResponse>("/account/experience", { method: "DELETE", accessToken });
}

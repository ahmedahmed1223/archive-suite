"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useAuthSession } from "@/lib/auth-session";
import {
  CAPABILITY_KEYS,
  DEFAULT_CAPABILITIES,
  DEFAULT_EXPERIENCE,
  DEFAULT_SCHEMA_VERSION,
  fetchCapabilities,
  fetchExperienceProfile,
  resetExperienceProfile,
  saveCapabilities,
  saveExperienceProfile,
  type Capabilities,
  type CapabilityKey,
  type ExperienceSettings,
  type FetchResult,
  type UpdateCapabilitiesRequest,
  type UpdateExperienceProfileRequest,
  type WriteFailure
} from "@/lib/experience-profile";

type LoadStatus = "loading" | "ready" | "fallback";

export interface WriteConflict {
  scope: "experience" | "capabilities";
  message: string;
}

export type WriteOutcome = { ok: true } | { ok: false; failure: WriteFailure };

interface ExperienceProfileContextValue {
  status: LoadStatus;
  schemaVersion: number;

  capabilities: Capabilities;
  capabilitiesStatus: LoadStatus;
  capabilitiesError: string | null;

  experience: ExperienceSettings;
  experienceStatus: LoadStatus;
  experienceError: string | null;
  profileVersion: number;

  writeConflict: WriteConflict | null;
  clearWriteConflict(): void;

  retryLoad(): void;
  updateExperience(values: UpdateExperienceProfileRequest): Promise<WriteOutcome>;
  resetExperience(): Promise<WriteOutcome>;
  updateCapabilities(values: Omit<UpdateCapabilitiesRequest, "expectedVersions">): Promise<WriteOutcome>;
}

const ExperienceProfileContext = createContext<ExperienceProfileContextValue | null>(null);

const CACHE_KEY = "archive-next:experience-profile-cache";

interface CacheShape {
  schemaVersion: number;
  profileVersion: number;
  capabilities: Capabilities;
  experience: ExperienceSettings;
}

function readCache(): CacheShape | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CacheShape>;
    if (!parsed.capabilities || !parsed.experience) return null;
    return parsed as CacheShape;
  } catch {
    return null;
  }
}

function writeCache(cache: CacheShape) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ponytail: quota/exceptions here only lose the optimistic paint on next
    // load, never correctness — the server fetch stays authoritative.
  }
}

function clearCache() {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(CACHE_KEY);
  } catch {
    // no-op
  }
}

function applyOptimisticExperience(current: ExperienceSettings, patch: UpdateExperienceProfileRequest): ExperienceSettings {
  const next = { ...current };

  for (const key of Object.keys(patch) as (keyof UpdateExperienceProfileRequest)[]) {
    const value = patch[key];
    if (value === undefined) continue;

    const existing = next[key as keyof ExperienceSettings];
    next[key as keyof ExperienceSettings] = { ...existing, value, source: "user" } as never;
  }

  return next;
}

function applyOptimisticCapabilities(current: Capabilities, patch: Omit<UpdateCapabilitiesRequest, "expectedVersions">): Capabilities {
  const next = { ...current };

  for (const key of Object.keys(patch) as CapabilityKey[]) {
    const value = patch[key];
    if (value === undefined) continue;

    next[key] = { ...next[key], value, source: "system" };
  }

  return next;
}

export function ExperienceProfileProvider({ children }: Readonly<{ children: ReactNode }>) {
  const { status: authStatus, accessToken } = useAuthSession();

  const [capabilities, setCapabilities] = useState<Capabilities>(DEFAULT_CAPABILITIES);
  const [capabilitiesStatus, setCapabilitiesStatus] = useState<LoadStatus>("loading");
  const [capabilitiesError, setCapabilitiesError] = useState<string | null>(null);

  const [experience, setExperience] = useState<ExperienceSettings>(DEFAULT_EXPERIENCE);
  const [experienceStatus, setExperienceStatus] = useState<LoadStatus>("loading");
  const [experienceError, setExperienceError] = useState<string | null>(null);
  const [profileVersion, setProfileVersion] = useState(0);

  const [schemaVersion, setSchemaVersion] = useState(DEFAULT_SCHEMA_VERSION);
  const [writeConflict, setWriteConflict] = useState<WriteConflict | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  const capabilitiesRef = useRef(capabilities);
  capabilitiesRef.current = capabilities;
  const experienceRef = useRef(experience);
  experienceRef.current = experience;

  // Paint from the last-known-good server response immediately so the
  // shell never flashes hardcoded defaults for a returning user; the fetch
  // below still runs unconditionally and overwrites this with the
  // authoritative server state.
  useEffect(() => {
    const cached = readCache();
    if (!cached) return;

    setCapabilities(cached.capabilities);
    setExperience(cached.experience);
    setProfileVersion(cached.profileVersion);
    setSchemaVersion(cached.schemaVersion);
  }, []);

  useEffect(() => {
    if (authStatus === "guest") {
      clearCache();
      setCapabilities(DEFAULT_CAPABILITIES);
      setExperience(DEFAULT_EXPERIENCE);
      setProfileVersion(0);
      setCapabilitiesStatus("loading");
      setExperienceStatus("loading");
    }
  }, [authStatus]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;

    let cancelled = false;

    async function load() {
      setCapabilitiesStatus("loading");
      setExperienceStatus("loading");

      const [capabilitiesResult, experienceResult] = await Promise.all([
        fetchCapabilities(accessToken),
        fetchExperienceProfile(accessToken)
      ]);

      if (cancelled) return;

      applyLoadResult("capabilities", capabilitiesResult);
      applyLoadResult("experience", experienceResult);
    }

    function applyLoadResult(
      domain: "capabilities" | "experience",
      result: FetchResult<{ ok: true; schemaVersion: number; capabilities?: Capabilities; experience?: ExperienceSettings; profileVersion?: number }>
    ) {
      if (!result.ok) {
        if (domain === "capabilities") {
          setCapabilitiesError(result.failure.message);
          setCapabilitiesStatus("fallback");
        } else {
          setExperienceError(result.failure.message);
          setExperienceStatus("fallback");
        }
        return;
      }

      setSchemaVersion(result.data.schemaVersion);

      if (domain === "capabilities" && result.data.capabilities) {
        setCapabilities(result.data.capabilities);
        setCapabilitiesError(null);
        setCapabilitiesStatus("ready");
      }

      if (domain === "experience" && result.data.experience) {
        setExperience(result.data.experience);
        setProfileVersion(result.data.profileVersion ?? 0);
        setExperienceError(null);
        setExperienceStatus("ready");
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [authStatus, accessToken, loadAttempt]);

  // Cache every authoritative (server-confirmed) snapshot, never an
  // optimistic one, so a reload never resurrects an unconfirmed write.
  useEffect(() => {
    if (capabilitiesStatus !== "ready" || experienceStatus !== "ready") return;

    writeCache({ schemaVersion, profileVersion, capabilities, experience });
  }, [capabilities, capabilitiesStatus, experience, experienceStatus, profileVersion, schemaVersion]);

  const retryLoad = useCallback(() => {
    setLoadAttempt((attempt) => attempt + 1);
  }, []);

  const clearWriteConflict = useCallback(() => setWriteConflict(null), []);

  const updateExperience = useCallback(
    async (values: UpdateExperienceProfileRequest): Promise<WriteOutcome> => {
      const previous = experienceRef.current;
      setExperience((current) => applyOptimisticExperience(current, values));
      setExperienceError(null);

      const result = await saveExperienceProfile(values, accessToken);

      if (!result.ok) {
        setExperience(previous);
        setExperienceError(result.failure.message);
        return { ok: false, failure: result.failure };
      }

      setExperience(result.data.experience);
      setProfileVersion(result.data.profileVersion);
      setSchemaVersion(result.data.schemaVersion);
      return { ok: true };
    },
    [accessToken]
  );

  const resetExperience = useCallback(async (): Promise<WriteOutcome> => {
    const previous = experienceRef.current;
    setExperience(DEFAULT_EXPERIENCE);
    setExperienceError(null);

    const result = await resetExperienceProfile(accessToken);

    if (!result.ok) {
      setExperience(previous);
      setExperienceError(result.failure.message);
      return { ok: false, failure: result.failure };
    }

    setExperience(result.data.experience);
    setProfileVersion(result.data.profileVersion);
    setSchemaVersion(result.data.schemaVersion);
    return { ok: true };
  }, [accessToken]);

  const updateCapabilities = useCallback(
    async (values: Omit<UpdateCapabilitiesRequest, "expectedVersions">): Promise<WriteOutcome> => {
      const previous = capabilitiesRef.current;

      // The caller only supplies the values it wants to change; the
      // expected-version token per key is derived here from the last
      // server-confirmed state so every write is concurrency-checked
      // without the caller having to track versions itself.
      const expectedVersions: Record<string, number> = {};
      for (const key of CAPABILITY_KEYS) {
        if (values[key] !== undefined) {
          expectedVersions[key] = previous[key].version;
        }
      }

      setCapabilities((current) => applyOptimisticCapabilities(current, values));
      setCapabilitiesError(null);

      const result = await saveCapabilities({ ...values, expectedVersions }, accessToken);

      if (!result.ok) {
        if (result.failure.kind === "version_conflict") {
          setWriteConflict({ scope: "capabilities", message: result.failure.message });
          if (result.failure.capabilities) {
            setCapabilities(result.failure.capabilities);
          } else {
            setCapabilities(previous);
          }
        } else {
          setCapabilities(previous);
        }

        setCapabilitiesError(result.failure.message);
        return { ok: false, failure: result.failure };
      }

      setCapabilities(result.data.capabilities);
      setSchemaVersion(result.data.schemaVersion);
      return { ok: true };
    },
    [accessToken]
  );

  const status: LoadStatus = useMemo(() => {
    if (capabilitiesStatus === "loading" || experienceStatus === "loading") return "loading";
    if (capabilitiesStatus === "fallback" || experienceStatus === "fallback") return "fallback";
    return "ready";
  }, [capabilitiesStatus, experienceStatus]);

  const value = useMemo<ExperienceProfileContextValue>(
    () => ({
      status,
      schemaVersion,
      capabilities,
      capabilitiesStatus,
      capabilitiesError,
      experience,
      experienceStatus,
      experienceError,
      profileVersion,
      writeConflict,
      clearWriteConflict,
      retryLoad,
      updateExperience,
      resetExperience,
      updateCapabilities
    }),
    [
      status,
      schemaVersion,
      capabilities,
      capabilitiesStatus,
      capabilitiesError,
      experience,
      experienceStatus,
      experienceError,
      profileVersion,
      writeConflict,
      clearWriteConflict,
      retryLoad,
      updateExperience,
      resetExperience,
      updateCapabilities
    ]
  );

  return <ExperienceProfileContext.Provider value={value}>{children}</ExperienceProfileContext.Provider>;
}

export function useExperienceProfile(): ExperienceProfileContextValue {
  const value = useContext(ExperienceProfileContext);
  if (!value) {
    throw new Error("useExperienceProfile must be used within ExperienceProfileProvider");
  }

  return value;
}

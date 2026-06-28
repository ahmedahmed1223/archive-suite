import { generateId } from "../stores/storeCore.js";

const DEVICE_ID_PREFIX = "dev";
const STORAGE_KEY = "videoArchive:deviceIdentity";

export interface DeviceIdentity {
  deviceId: string;
  deviceName: string;
}

function hasCryptoUUID() {
  return typeof globalThis !== "undefined"
    && globalThis.crypto
    && typeof globalThis.crypto.randomUUID === "function";
}

/** A locally-unique device id, durable across page reloads. */
export function createDeviceId() {
  if (hasCryptoUUID()) return `${DEVICE_ID_PREFIX}_${globalThis.crypto.randomUUID()}`;
  return generateId(DEVICE_ID_PREFIX);
}

/** Returns the best-effort human-friendly default name for a device. */
export function getDefaultDeviceName() {
  if (typeof navigator === "undefined") return "هذا الجهاز";
  const platform = navigator.platform || "";
  const userAgent = navigator.userAgent || "";
  if (/Windows/i.test(platform) || /Windows/i.test(userAgent)) return "حاسوب Windows";
  if (/Mac/i.test(platform) || /Macintosh/i.test(userAgent)) return "حاسوب Mac";
  if (/Linux/i.test(platform) && !/Android/i.test(userAgent)) return "حاسوب Linux";
  if (/Android/i.test(userAgent)) return "جهاز Android";
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "جهاز iOS";
  return "هذا الجهاز";
}

/**
 * Read the persisted device identity from localStorage. Returns a
 * freshly generated identity if nothing is stored or the stored
 * value is malformed. Falls back to settings-provided values when
 * localStorage is unavailable (private mode, server-side, etc).
 */
export function readDeviceIdentity(fallback: DeviceIdentity | null = null): DeviceIdentity | null {
  try {
    if (typeof window === "undefined") return fallback;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || typeof (parsed as { deviceId?: unknown }).deviceId !== "string") return fallback;
    return {
      deviceId: (parsed as { deviceId: string }).deviceId,
      deviceName: typeof (parsed as { deviceName?: unknown }).deviceName === "string" && (parsed as { deviceName: string }).deviceName.trim()
        ? (parsed as { deviceName: string }).deviceName
        : getDefaultDeviceName()
    };
  } catch {
    return fallback;
  }
}

export function persistDeviceIdentity(identity: DeviceIdentity) {
  try {
    if (typeof window === "undefined") return false;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(identity));
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure a stable device identity is available. Reads from
 * localStorage first; if nothing is stored, seeds from `seed` (the
 * persisted settings value) or generates a fresh identity. Always
 * writes the resolved identity back so subsequent reads are cheap.
 */
export function ensureDeviceIdentity(seed: DeviceIdentity | null = null): DeviceIdentity {
  const existing = readDeviceIdentity(null);
  if (existing) {
    if (seed?.deviceName && seed.deviceName !== existing.deviceName) {
      // Settings holds a newer name (user just renamed) — reconcile.
      const merged = { ...existing, deviceName: seed.deviceName };
      persistDeviceIdentity(merged);
      return merged;
    }
    return existing;
  }
  const next = seed && seed.deviceId
    ? { deviceId: seed.deviceId, deviceName: seed.deviceName || getDefaultDeviceName() }
    : { deviceId: createDeviceId(), deviceName: seed?.deviceName || getDefaultDeviceName() };
  persistDeviceIdentity(next);
  return next;
}

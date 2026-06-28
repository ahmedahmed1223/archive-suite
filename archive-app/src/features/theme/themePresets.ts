// @ts-nocheck
export const DENSITY_OPTIONS = [
  { id: "compact", label: "مضغوط", description: "أقصى كثافة للعرض" },
  { id: "balanced", label: "متوازن", description: "الإعداد الافتراضي" },
  { id: "comfortable", label: "مريح", description: "مسافات أوسع" },
];

export const DEFAULT_DENSITY = "balanced";
export const DENSITY_STORAGE_KEY = "videoArchive:density";

const VALID_DENSITY_IDS = new Set(DENSITY_OPTIONS.map((d) => d.id));

function normalizeId(value) {
  return VALID_DENSITY_IDS.has(value) ? value : DEFAULT_DENSITY;
}

export function getDensityClass(densityId) {
  if (densityId === "compact") return "density-compact";
  if (densityId === "comfortable") return "density-comfortable";
  return "";
}

export function getStoredDensity(storage = typeof localStorage !== "undefined" ? localStorage : null) {
  try {
    return normalizeId(storage?.getItem?.(DENSITY_STORAGE_KEY));
  } catch {
    return DEFAULT_DENSITY;
  }
}

export function setStoredDensity(id, storage = typeof localStorage !== "undefined" ? localStorage : null) {
  const normalized = normalizeId(id);
  try {
    storage?.setItem?.(DENSITY_STORAGE_KEY, normalized);
  } catch {
    // localStorage unavailable — in-memory state is the source of truth.
  }
  return normalized;
}

export function applyDensityToDocument(id, doc = typeof document !== "undefined" ? document : null) {
  const normalized = normalizeId(id);
  if (!doc?.documentElement) return normalized;
  if (normalized === DEFAULT_DENSITY) {
    doc.documentElement.removeAttribute("data-density");
  } else {
    doc.documentElement.setAttribute("data-density", normalized);
  }
  return normalized;
}


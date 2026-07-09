// ponytail: minimalist focus mode state using localStorage
const FOCUS_MODE_KEY = "masar.focusMode";

export function isFocusMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(FOCUS_MODE_KEY) === "true";
  } catch {
    return false;
  }
}

export function setFocusMode(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FOCUS_MODE_KEY, enabled ? "true" : "false");
  } catch {
    // Silent fail on storage errors
  }
}

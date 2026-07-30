// ponytail: one opt-out flag, same tiny localStorage shape as favorites.ts/recent-items.ts.
// Personal context never leaves the browser, so the control lives here and not in the API.
const STORAGE_KEY = "masar.personal-context.recording";

/** Recently-viewed records and recent searches are recorded unless the user opts out. */
export function isContextRecordingEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setContextRecording(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    // Storage quota or private mode: recording keeps its previous value.
  }
}

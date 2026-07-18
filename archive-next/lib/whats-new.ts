export const WHATS_NEW_RELEASE = "2026.07.18";
export const WHATS_NEW_STORAGE_KEY = "archive.whats-new.acknowledged-release";

export function shouldShowWhatsNew(
  acknowledgedRelease: string | null,
  currentRelease: string,
) {
  return acknowledgedRelease !== currentRelease;
}

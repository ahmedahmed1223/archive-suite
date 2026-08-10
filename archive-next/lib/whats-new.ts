export const WHATS_NEW_RELEASE = "1.2";
export const WHATS_NEW_STORAGE_KEY = "archive.whats-new.acknowledged-release";
export const WHATS_NEW_DISMISSED_KEY = "archive.whats-new.dismissed";

export function shouldShowWhatsNew(
  acknowledgedRelease: string | null,
  currentRelease: string,
  permanentlyDismissed = false,
) {
  return !permanentlyDismissed && acknowledgedRelease !== currentRelease;
}

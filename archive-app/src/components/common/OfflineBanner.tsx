import { useOnlineStatus } from "../../hooks/useOnlineStatus.js";
import { useT } from "../../i18n/useT.js";

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const { t } = useT();
  if (isOnline) return null;
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-0 inset-x-0 z-[var(--va-z-offline-banner)] border-b border-[color-mix(in_oklab,var(--va-status-warning)_45%,transparent)] bg-[var(--va-highlight-soft)] px-4 py-2 text-center text-sm font-medium text-[var(--va-highlight)]"
    >
      📡 {t("error.offline")}
    </div>
  );
}

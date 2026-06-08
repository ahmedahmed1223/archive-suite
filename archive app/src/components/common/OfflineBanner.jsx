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
      className="fixed top-0 inset-x-0 z-[2000] bg-orange-900 border-b border-orange-700 text-orange-100 text-sm text-center py-2 px-4"
    >
      📡 {t("error.offline")}
    </div>
  );
}

import { useOnlineStatus } from "../../hooks/useOnlineStatus.js";

export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-0 inset-x-0 z-[2000] bg-orange-900 border-b border-orange-700 text-orange-100 text-sm text-center py-2 px-4"
    >
      📡 أنت غير متصل بالإنترنت — بعض الميزات قد لا تعمل حتى تعود الاتصال
    </div>
  );
}

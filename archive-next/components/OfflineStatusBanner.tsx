"use client";

import { useSyncExternalStore } from "react";
import { connectivityStore, type ConnectivityStatus } from "@/lib/connectivity-probe";
import { offlineQueueStore } from "@/lib/offline-queue";

type Props = {
  className?: string;
};

export default function OfflineStatusBanner({ className = "" }: Props) {
  const connectivity = useSyncExternalStore(
    connectivityStore.subscribe,
    connectivityStore.getSnapshot,
    connectivityStore.getServerSnapshot
  );
  const queuedMutations = useSyncExternalStore(
    offlineQueueStore.subscribe,
    offlineQueueStore.getSnapshot,
    offlineQueueStore.getServerSnapshot
  );

  if (connectivity === "online" && queuedMutations.length === 0) {
    return null; // No banner needed when online
  }

  const isOffline = connectivity === "offline";
  const isDegraded = connectivity === "degraded";
  const hasPending = queuedMutations.length > 0;

  // Determine banner style
  const bannerClass = isOffline
    ? "bg-red-900 text-red-50"
    : isDegraded
      ? "bg-amber-900 text-amber-50"
      : "bg-blue-900 text-blue-50";

  // Determine message
  let message = "";
  if (isOffline) {
    message = hasPending
      ? `أنت غير متصل. ${queuedMutations.length} عملية في الانتظار للإرسال عند استعادة الاتصال.`
      : "أنت غير متصل. سيتم إعادة المحاولة تلقائياً عند استعادة الاتصال.";
  } else if (isDegraded) {
    message = "الاتصال بطيء أو غير مستقر. بعض العمليات قد تحتاج وقتاً أطول.";
  } else if (hasPending) {
    message = `${queuedMutations.length} عملية في الانتظار للإرسال...`;
  }

  return (
    <div
      className={`
        fixed top-0 right-0 left-0 z-50
        px-4 py-3
        text-sm font-medium
        ${bannerClass}
        flex items-center justify-center gap-3
        border-b
        ${isOffline ? "border-red-800" : isDegraded ? "border-amber-800" : "border-blue-800"}
        ${className}
      `}
      role="alert"
      aria-live="polite"
      aria-label={isOffline ? "تنبيه بعدم الاتصال" : isDegraded ? "تنبيه بضعف الاتصال" : "تنبيه بعمليات معلقة"}
    >
      {/* Icon */}
      <div className="flex-shrink-0">
        {isOffline && (
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10.5 1.5H5.804a1.5 1.5 0 00-1.5 1.5v2.25H2.25a1.5 1.5 0 00-1.5 1.5v9.75a1.5 1.5 0 001.5 1.5h15.5a1.5 1.5 0 001.5-1.5v-9.75a1.5 1.5 0 00-1.5-1.5H17.3V3a1.5 1.5 0 00-1.5-1.5h-5.3V1.5z"
              clipRule="evenodd"
            />
          </svg>
        )}
        {isDegraded && (
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.346 2.357-1.346 3.03 0l6.28 12.591c.675 1.345-.213 2.914-1.515 2.914H3.72c-1.302 0-2.19-1.569-1.514-2.914L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0V5.75A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
        )}
        {!isOffline && !isDegraded && hasPending && (
          <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
      </div>

      {/* Message */}
      <p className="flex-1 text-center">{message}</p>

      {/* Spacer for balance */}
      <div className="flex-shrink-0 w-5" />
    </div>
  );
}

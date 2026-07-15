"use client";

import { useCallback, useSyncExternalStore } from "react";

/** استعلام العرض المحمول الموحّد — يحدّد التبديل إلى العروض المضغوطة. */
export const MOBILE_VIEWPORT_QUERY = "(max-width: 760px)";
/** استعلام تفضيل تقليل الحركة. */
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const noop = () => {};

function getMediaQueryList(query: string): MediaQueryList | null {
  // العرض على الخادم (App Router) لا يملك matchMedia، وكذلك بيئات الاختبار المجرّدة.
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return window.matchMedia(query);
}

/**
 * قراءة فورية وآمنة للاستعلام — للاستخدام خارج دورة العرض (مثل القيم الابتدائية للحالة).
 * تُرجع false على الخادم.
 */
export function matchesMediaQuery(query: string): boolean {
  return getMediaQueryList(query)?.matches ?? false;
}

/**
 * اشتراك تفاعلي في استعلام وسائط عبر useSyncExternalStore.
 * آمن للعرض على الخادم: اللقطة الخادمية دائمًا false ثم تُصحَّح بعد الترطيب.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const list = getMediaQueryList(query);
      if (!list) return noop;
      list.addEventListener("change", onStoreChange);
      return () => list.removeEventListener("change", onStoreChange);
    },
    [query]
  );

  const getSnapshot = useCallback(() => matchesMediaQuery(query), [query]);

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

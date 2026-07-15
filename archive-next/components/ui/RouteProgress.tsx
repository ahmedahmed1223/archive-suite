"use client";

import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { REDUCED_MOTION_QUERY, useMediaQuery } from "@/lib/use-media-query";

/** مهلة قصيرة بعد استقرار المسار حتى لا يومض الشريط في التنقلات الفورية. */
const SETTLE_MS = 180;
/** صمام أمان: لو أُلغي التنقل فلن يبقى الشريط معلّقًا إلى الأبد. */
const FAILSAFE_MS = 8000;

/** يبدأ الشريط عند نقرة رابط داخلي حقيقي فقط — لا روابط خارجية ولا تبويب جديد ولا تنزيل. */
function startsInAppNavigation(event: MouseEvent): boolean {
  if (event.defaultPrevented || event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;

  const target = event.target;
  const anchor = target instanceof Element ? target.closest("a[href]") : null;
  if (!(anchor instanceof HTMLAnchorElement)) return false;
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;
  if (anchor.origin !== window.location.origin) return false;

  // روابط المرساة داخل نفس الصفحة ليست تنقلًا بين الصفحات.
  return anchor.pathname !== window.location.pathname || anchor.search !== window.location.search;
}

/**
 * شريط تقدّم علوي رفيع بين الصفحات.
 * زخرفي بالكامل (aria-hidden) — تغيّر الصفحة يُعلَن أصلًا عبر عنوان الصفحة،
 * وإعلانه في منطقة حيّة عند كل تنقل يعني ثرثرة متواصلة لقارئات الشاشة.
 */
export default function RouteProgress() {
  const pathname = usePathname();
  const prefersReducedMotion = useMediaQuery(REDUCED_MOTION_QUERY);
  const [isActive, setIsActive] = useState(false);
  const isFirstRender = useRef(true);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (startsInAppNavigation(event)) setIsActive(true);
    };
    // مرحلة الالتقاط: نسبق موجّه Next حتى يظهر الشريط فور النقر لا بعد اكتمال التنقل.
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => setIsActive(false), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    if (!isActive) return;
    const timer = setTimeout(() => setIsActive(false), FAILSAFE_MS);
    return () => clearTimeout(timer);
  }, [isActive]);

  if (!isActive) return null;

  return (
    <div aria-hidden="true" className="ui-route-progress">
      <motion.div
        animate={{ scaleX: 0.9 }}
        className="ui-route-progress__fill"
        initial={{ scaleX: 0.05 }}
        // ponytail: تقدّم تقريبي لا حقيقي — App Router لا يكشف نسبة تحميل عامة.
        // لو لزم تقدّم حقيقي لاحقًا فالمخرج هو useLinkStatus لكل رابط.
        transition={prefersReducedMotion ? { duration: 0 } : { duration: 2.2, ease: "easeOut" }}
      />
    </div>
  );
}

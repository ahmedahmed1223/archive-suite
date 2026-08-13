"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";

/**
 * Announces client-side route changes that do not trigger a full page load.
 * The region is deliberately singular and atomic so navigation is announced
 * once, without competing with page-specific upload/search status messages.
 */
export default function RouteAnnouncer() {
  const { t } = useLocale();
  const copy = t.shell.routeAnnouncer;
  const pathname = usePathname() || "/";
  const [message, setMessage] = useState("");

  useEffect(() => {
    const title = document.title.trim();
    setMessage(title ? copy.opened.replace("{title}", title) : copy.openedPage);
  }, [copy, pathname]);

  return (
    <p className="ui-visually-hidden" role="status" aria-live="polite" aria-atomic="true" data-testid="route-announcer">
      {message}
    </p>
  );
}

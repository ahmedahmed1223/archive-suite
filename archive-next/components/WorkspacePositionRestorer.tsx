"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  readWorkspacePreferences,
  resolveWorkspaceRoute,
  updateWorkspacePreferences,
  WORKSPACE_PREFERENCES_STORAGE_KEY
} from "@/lib/workspace-preferences";

/** Keeps a per-workspace reading position locally; storage failures are deliberately non-blocking. */
export default function WorkspacePositionRestorer() {
  const pathname = usePathname();

  useEffect(() => {
    const route = resolveWorkspaceRoute(pathname);
    if (!route) return;

    try {
      const saved = readWorkspacePreferences(window.localStorage.getItem(WORKSPACE_PREFERENCES_STORAGE_KEY));
      const position = saved.routes[route]?.workPosition;
      if (typeof position === "number" && position > 0) {
        requestAnimationFrame(() => window.scrollTo(0, position));
      }

      const savePosition = () => {
        const current = readWorkspacePreferences(window.localStorage.getItem(WORKSPACE_PREFERENCES_STORAGE_KEY));
        const next = updateWorkspacePreferences(current, route, { workPosition: Math.round(window.scrollY) });
        window.localStorage.setItem(WORKSPACE_PREFERENCES_STORAGE_KEY, JSON.stringify(next));
      };

      // ponytail: rAF-throttled so it keeps storage fresh as the user scrolls, instead of
      // relying only on `pagehide` (which never fires on a Next.js client-side route change,
      // only on a real unload/reload) — that's what let list -> detail -> back lose position.
      let scrollScheduled = false;
      const handleScroll = () => {
        if (scrollScheduled) return;
        scrollScheduled = true;
        requestAnimationFrame(() => {
          savePosition();
          scrollScheduled = false;
        });
      };

      window.addEventListener("scroll", handleScroll, { passive: true });
      window.addEventListener("pagehide", savePosition);
      return () => {
        window.removeEventListener("scroll", handleScroll);
        window.removeEventListener("pagehide", savePosition);
      };
    } catch {
      return;
    }
  }, [pathname]);

  return null;
}

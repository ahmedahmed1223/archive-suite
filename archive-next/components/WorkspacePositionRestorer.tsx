"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  readUserWorkspacePreferences,
  resolveWorkspaceRoute,
  updateWorkspacePreferences,
  workspacePreferencesStorageKey,
} from "@/lib/workspace-preferences";
import { useAuthSession } from "@/lib/auth-session";
import { isContextRecordingEnabled } from "@/lib/personal-context";

/** Keeps a per-workspace reading position locally; storage failures are deliberately non-blocking. */
export default function WorkspacePositionRestorer() {
  const pathname = usePathname();
  const { user } = useAuthSession();

  useEffect(() => {
    const route = resolveWorkspaceRoute(pathname);
    if (!route || !user?.id || !isContextRecordingEnabled()) return;

    try {
      const saved = readUserWorkspacePreferences(window.localStorage, user.id);
      const position = saved.routes[route]?.workPosition;
      if (typeof position === "number" && position > 0) {
        requestAnimationFrame(() => window.scrollTo(0, position));
      }

      const savePosition = () => {
        const current = readUserWorkspacePreferences(window.localStorage, user.id);
        const next = updateWorkspacePreferences(current, route, { workPosition: Math.round(window.scrollY) });
        window.localStorage.setItem(workspacePreferencesStorageKey(user.id), JSON.stringify(next));
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
  }, [pathname, user?.id]);

  return null;
}

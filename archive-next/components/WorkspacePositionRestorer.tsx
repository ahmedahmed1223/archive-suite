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
      window.addEventListener("pagehide", savePosition);
      return () => {
        window.removeEventListener("pagehide", savePosition);
      };
    } catch {
      return;
    }
  }, [pathname]);

  return null;
}

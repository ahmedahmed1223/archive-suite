"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getShortcut, isTypingTarget, matchesKeyEvent } from "@/lib/keyboard-shortcuts";

/**
 * V1-832: the route-level shortcuts (search, new record). Page-scoped ones
 * (save, comments, tags) live with the form they act on, since a global
 * listener cannot know which record is open.
 */
export default function GlobalShortcuts() {
  const router = useRouter();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Single-key bindings: never steal a keystroke from a field, and never
      // fire mid-composition on an IME.
      if (event.isComposing || isTypingTarget(event.target)) return;

      if (matchesKeyEvent(event, getShortcut("focusSearch"))) {
        event.preventDefault();
        router.push("/search");
        return;
      }

      if (matchesKeyEvent(event, getShortcut("newRecord"))) {
        event.preventDefault();
        router.push("/uploads");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return null;
}

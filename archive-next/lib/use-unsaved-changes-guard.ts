"use client";

import { useEffect } from "react";

/**
 * Warns before the user closes the tab or reloads while `isDirty` is true,
 * via the browser's native beforeunload prompt. Browsers render their own
 * generic confirmation text for this prompt (Chrome/Firefox/Safari all
 * ignore custom messages set on `event.returnValue` for security reasons),
 * so this hook does not accept or attempt to pass a custom message.
 */
export function useUnsavedChangesGuard(isDirty: boolean): void {
  useEffect(() => {
    if (!isDirty) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);
}

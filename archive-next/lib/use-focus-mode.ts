"use client";

import { useCallback, useEffect, useState } from "react";
import { isFocusMode, setFocusMode } from "./focus-mode";

export function useFocusMode() {
  const [isFocus, setIsFocus] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsFocus(isFocusMode());
    setIsHydrated(true);
  }, []);

  const toggleFocusMode = useCallback(() => {
    setIsFocus((prev) => {
      const next = !prev;
      setFocusMode(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F11 or Ctrl+Shift+F for focus mode toggle
      if ((e.key === "F11" && !e.ctrlKey) || (e.ctrlKey && e.shiftKey && e.key === "f")) {
        e.preventDefault();
        toggleFocusMode();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleFocusMode]);

  return {
    isFocusMode: isFocus,
    toggleFocusMode,
    isHydrated
  };
}

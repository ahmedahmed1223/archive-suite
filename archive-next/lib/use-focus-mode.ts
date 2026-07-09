"use client";

import { useEffect, useState } from "react";
import { isFocusMode, setFocusMode } from "./focus-mode";

export function useFocusMode() {
  const [isFocus, setIsFocus] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsFocus(isFocusMode());
    setIsHydrated(true);
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
  }, [isFocus]);

  const toggleFocusMode = () => {
    const newState = !isFocus;
    setIsFocus(newState);
    setFocusMode(newState);
  };

  return {
    isFocusMode: isFocus,
    toggleFocusMode,
    isHydrated
  };
}

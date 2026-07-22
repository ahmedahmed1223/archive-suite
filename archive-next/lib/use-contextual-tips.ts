"use client";

import { useEffect, useState } from "react";
import {
  isTipsDismissed,
  isTipsDismissedForSession,
  isTipsEnabledGlobally,
  dismissTips,
  dismissTipsForSession,
  type PageKey
} from "./contextual-tips";

export function useContextualTips(page: PageKey) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsDismissed(isTipsDismissed(page) || isTipsDismissedForSession(page));
    setIsEnabled(isTipsEnabledGlobally());
    setIsHydrated(true);
  }, [page]);

  const handleDismiss = () => {
    dismissTips(page);
    setIsDismissed(true);
  };

  const handleDismissSession = () => {
    dismissTipsForSession(page);
    setIsDismissed(true);
  };

  return {
    isDismissed,
    isEnabled,
    handleDismiss,
    handleDismissSession,
    isHydrated
  };
}

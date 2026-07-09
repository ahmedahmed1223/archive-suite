"use client";

import { useEffect, useState } from "react";
import { isTipsDismissed, dismissTips, type PageKey } from "./contextual-tips";

export function useContextualTips(page: PageKey) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsDismissed(isTipsDismissed(page));
    setIsHydrated(true);
  }, [page]);

  const handleDismiss = () => {
    dismissTips(page);
    setIsDismissed(true);
  };

  return {
    isDismissed,
    handleDismiss,
    isHydrated
  };
}

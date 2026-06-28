// useBackgroundNotificationBridge — surfaces newly arrived app notifications as
// local browser notifications when the tab is in the background (§14.2).
//
// Policy lives in pushManager.notifyForAppNotification: it only fires when the
// document is hidden and the OS permission was already granted, so this hook
// never prompts and never spams a focused user. Each notification id is alerted
// at most once.

import * as React from "react";
import { useAppStore } from "../../stores/index.js";
import { notifyForAppNotification } from "./pushManager.js";

interface AppNotificationRecord {
  id?: string | number;
}

export function useBackgroundNotificationBridge(): void {
  const history = useAppStore((state: any) => state.notificationHistory) as AppNotificationRecord[] | undefined;
  const toggleCenter = useAppStore((state: any) => state.toggleNotificationCenter) as (() => void) | undefined;
  const seenIds = React.useRef(new Set<string | number>());
  const primed = React.useRef(false);

  React.useEffect(() => {
    const items = Array.isArray(history) ? history : [];
    // On first run, mark everything already present as seen so we don't replay
    // the backlog as OS notifications on page load.
    if (!primed.current) {
      for (const item of items) {
        if (item?.id) seenIds.current.add(item.id);
      }
      primed.current = true;
      return;
    }
    for (const item of items) {
      if (!item?.id || seenIds.current.has(item.id)) continue;
      seenIds.current.add(item.id);
      notifyForAppNotification(item, {
        onClick: () => {
          try {
            globalThis.focus?.();
            toggleCenter?.();
          } catch {
            /* ignore focus errors in restricted contexts */
          }
        },
      });
    }
  }, [history, toggleCenter]);
}

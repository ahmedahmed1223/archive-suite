/**
 * BottomNav — DaisyUI dock-based fixed bottom navigation for mobile.
 *
 * Replaces the plain BottomTabBar with:
 *   - DaisyUI `dock` component for accessibility + theme support
 *   - Badge counters (unread notifications, pending uploads)
 *   - Active indicator dot
 *   - `md:hidden` so it only shows on mobile
 *
 * Connected to: MobileShell.jsx, AppRouter.jsx
 */
import { Archive, CirclePlus, LayoutGrid, Bell, Search } from "lucide-react";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { useAppStore } from "../../stores/index.js";

const TABS = [
  { id: "dashboard", labelAr: "الرئيسية", Icon: LayoutGrid, badgeKey: null },
  { id: "archive",   labelAr: "الأرشيف",  Icon: Archive,    badgeKey: null },
  { id: "add",       labelAr: "إضافة",    Icon: CirclePlus, badgeKey: null },
  { id: "search",    labelAr: "بحث",      Icon: Search,     badgeKey: null },
  { id: "inbox",     labelAr: "الوارد",   Icon: Bell,       badgeKey: "inbox" },
];

export function BottomNav() {
  const currentPage       = useAppStore((s) => s.currentPage);
  const setCurrentPage    = useAppStore((s) => s.setCurrentPage);
  const setSelectedItemId = useAppStore((s) => s.setSelectedItemId);
  const inboxItems        = useAppStore((s) => s.inboxItems || []);
  const notifications     = useAppStore((s) => s.notifications || []);

  const unreadInbox        = inboxItems.filter((i) => !i.readAt).length;
  const activeNotifs       = notifications.filter((n) => !n.dismissed).length;
  const badgeCounts        = { inbox: unreadInbox + activeNotifs };

  function navigate(pageId) {
    setSelectedItemId?.(null);
    setCurrentPage(pageId);
  }

  return jsx("nav", {
    "aria-label": "التنقل السريع",
    className: [
      "dock fixed bottom-0 right-0 left-0 z-30",
      "border-t border-base-300",
      "pb-[env(safe-area-inset-bottom,0px)]",
      "md:hidden",
    ].join(" "),
    children: TABS.map(({ id, labelAr, Icon, badgeKey }) => {
      const active     = currentPage === id;
      const badgeCount = badgeKey ? (badgeCounts[badgeKey] || 0) : 0;

      return jsx("button", {
        key: id,
        type: "button",
        onClick: () => navigate(id),
        "aria-current": active ? "page" : undefined,
        "aria-label": labelAr,
        className: active ? "dock-active" : "",
        children: jsxs("span", {
          className: "relative inline-flex",
          children: [
            jsx(Icon, { className: "h-5 w-5", "aria-hidden": "true" }),
            badgeCount > 0 && jsx("span", {
              className: [
                "badge badge-error badge-xs",
                "absolute -top-1 -start-1",
                "min-w-[16px] h-4 text-[9px] font-bold",
              ].join(" "),
              "aria-label": `${badgeCount} غير مقروء`,
              children: badgeCount > 9 ? "9+" : String(badgeCount),
            }),
          ],
        }),
      });
    }),
  });
}

export default BottomNav;

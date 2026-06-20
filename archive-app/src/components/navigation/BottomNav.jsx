/**
 * BottomNav — DaisyUI dock-based fixed bottom navigation for mobile.
 *
 * The single mobile navigation surface:
 *   - DaisyUI `dock` component for accessibility + theme support
 *   - Badge counters (unread notifications, pending uploads)
 *   - Active indicator dot
 *   - `md:hidden` so it only shows on mobile
 *
 * Connected to: MobileShell.jsx, AppRouter.jsx
 */
import { Archive, CirclePlus, LayoutGrid, Menu, Search } from "lucide-react";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { useAppStore } from "../../stores/index.js";

const TABS = [
  { id: "dashboard", labelAr: "الرئيسية", Icon: LayoutGrid, badgeKey: null },
  { id: "archive",   labelAr: "الأرشيف",  Icon: Archive,    badgeKey: null },
  { id: "add",       labelAr: "إضافة",    Icon: CirclePlus, badgeKey: null },
  { id: "search",    labelAr: "بحث",      Icon: Search,     badgeKey: null },
];

export function BottomNav() {
  const currentPage       = useAppStore((s) => s.currentPage);
  const setCurrentPage    = useAppStore((s) => s.setCurrentPage);
  const setSelectedItemId = useAppStore((s) => s.setSelectedItemId);
  const setSidebarOpen     = useAppStore((s) => s.setSidebarOpen);
  const toggleSidebar      = useAppStore((s) => s.toggleSidebar);
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
    // Layered editorial bottom nav: elevated surface + hairline top border + soft
    // shadow, blurred when supported. `md:hidden` keeps it mobile-only (paired
    // with MobileShell / useIsMobile 768px boundary).
    className: [
      "dock fixed bottom-0 right-0 left-0 z-30",
      "border-t border-[var(--va-border-soft)]",
      "bg-[color-mix(in_srgb,var(--va-surface)_92%,transparent)]",
      "supports-[backdrop-filter]:bg-[color-mix(in_srgb,var(--va-surface)_78%,transparent)] supports-[backdrop-filter]:backdrop-blur-xl",
      "shadow-[var(--va-elev-2)]",
      "pb-[env(safe-area-inset-bottom,0px)]",
      "md:hidden",
    ].join(" "),
    children: [
      ...TABS.map(({ id, labelAr, Icon, badgeKey }) => {
      const active     = currentPage === id;
      const badgeCount = badgeKey ? (badgeCounts[badgeKey] || 0) : 0;

      return jsx("button", {
        type: "button",
        onClick: () => navigate(id),
        "aria-current": active ? "page" : undefined,
        "aria-label": labelAr,
        className: [
          "group relative transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/55",
          active
            ? "dock-active text-emerald-400"
            : "text-[var(--va-text-muted)] hover:text-[var(--va-text)]",
        ].join(" "),
        children: jsxs("span", {
          className: "relative inline-flex flex-col items-center gap-0.5",
          children: [
            // Active indicator pill above the icon — editorial accent cue.
            active && jsx("span", {
              "aria-hidden": "true",
              className: "absolute -top-2 h-1 w-6 rounded-full bg-emerald-500",
            }),
            jsxs("span", {
              className: "relative inline-flex",
              children: [
                jsx(Icon, { className: "h-5 w-5", "aria-hidden": "true" }),
                badgeCount > 0 && jsx("span", {
                  className: [
                    "absolute -top-1.5 -start-1.5 inline-flex items-center justify-center",
                    "min-w-[16px] h-4 px-1 rounded-full",
                    "bg-[var(--va-status-danger)] text-white text-[9px] font-bold leading-none",
                    "ring-2 ring-[var(--va-surface)]",
                  ].join(" "),
                  "aria-label": `${badgeCount} غير مقروء`,
                  children: badgeCount > 9 ? "9+" : String(badgeCount),
                }),
              ],
            }),
          ],
        }),
      }, id);
    }),
      jsx("button", {
        type: "button",
        onClick: () => setSidebarOpen ? setSidebarOpen(true) : toggleSidebar?.(),
        "aria-label": "المزيد",
        className: "group relative text-[var(--va-text-muted)] transition-colors hover:text-[var(--va-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/55",
        children: jsxs("span", {
          className: "relative inline-flex flex-col items-center gap-0.5",
          children: [
            jsxs("span", { className: "relative inline-flex", children: [
              jsx(Menu, { className: "h-5 w-5", "aria-hidden": "true" }),
              badgeCounts.inbox > 0 && jsx("span", {
                className: "absolute -top-1.5 -start-1.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--va-status-danger)] px-1 text-[9px] font-bold leading-none text-white ring-2 ring-[var(--va-surface)]",
                "aria-label": `${badgeCounts.inbox} غير مقروء`,
                children: badgeCounts.inbox > 9 ? "9+" : String(badgeCounts.inbox)
              })
            ] }),
            jsx("span", { className: "dock-label text-[10px]", children: "المزيد" })
          ]
        })
      }, "more")
    ],
  });
}

export default BottomNav;

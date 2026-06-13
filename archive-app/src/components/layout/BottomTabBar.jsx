import { Archive, CirclePlus, LayoutGrid, Menu, Search } from "lucide-react";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { useAppStore } from "../../stores/index.js";

const TABS = [
  { id: "dashboard", label: "الرئيسية", Icon: LayoutGrid },
  { id: "archive",   label: "الأرشيف",  Icon: Archive },
  { id: "add",       label: "إضافة",    Icon: CirclePlus },
  { id: "search",    label: "بحث",      Icon: Search },
];

export function BottomTabBar() {
  const { currentPage, setCurrentPage, setSelectedItemId, setSidebarOpen, toggleSidebar } = useAppStore();

  function navigate(pageId) {
    setSelectedItemId(null);
    setCurrentPage(pageId);
  }

  return jsx("nav", {
    "aria-label": "التنقل السريع",
    className: [
      "va-bottom-tabs",
      // z-30 keeps the tab bar below the sidebar drawer's dim overlay (z-40)
      // so tabs are not clickable while the drawer is open.
      "fixed bottom-0 right-0 left-0 z-30",
      "border-t border-white/10 bg-gray-950/95 backdrop-blur-md",
      "pb-[env(safe-area-inset-bottom,0px)]",
      "md:hidden"
    ].join(" "),
    children: jsxs("div", {
      className: "flex w-full",
      children: [
        TABS.map(({ id, label, Icon }) => {
          const active = currentPage === id;
          return jsx("button", {
            type: "button",
            onClick: () => navigate(id),
            "aria-current": active ? "page" : undefined,
            "aria-label": label,
            className: [
              "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 min-h-[56px]",
              "text-[10px] font-medium transition-colors",
              active ? "va-accent-text-on-soft" : "text-gray-500 hover:text-gray-300"
            ].join(" "),
            children: [
              jsxs("span", {
                className: [
                  "relative flex h-8 w-8 items-center justify-center rounded-xl transition-colors",
                  active ? "va-accent-bg-soft" : ""
                ].join(" "),
                children: [
                  jsx(Icon, { className: "h-5 w-5" }),
                  active && jsx("span", {
                    className: "absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full va-accent-bg",
                    "aria-hidden": "true"
                  })
                ]
              }),
              jsx("span", { children: label })
            ]
          }, id);
        }),
        jsx("button", {
          type: "button",
          onClick: () => setSidebarOpen ? setSidebarOpen(true) : toggleSidebar?.(),
          "aria-label": "فتح القائمة الكاملة",
          className: [
            "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 min-h-[56px]",
            "text-[10px] font-medium text-gray-500 hover:text-gray-300 transition-colors"
          ].join(" "),
          children: [
            jsx("span", {
              className: "flex h-8 w-8 items-center justify-center rounded-xl",
              children: jsx(Menu, { className: "h-5 w-5" })
            }),
            jsx("span", { children: "المزيد" })
          ]
        })
      ]
    })
  });
}

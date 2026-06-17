import {
  Database,
  Download,
  HardDrive,
  RefreshCw,
  Upload
} from "lucide-react";
import { jsx, jsxs } from "react/jsx-runtime";



const iconMap = {
  export: Download,
  import: Upload,
  transfer: RefreshCw,
  backup: HardDrive
};

const defaultTabs = [
  { id: "export", label: "التصدير" },
  { id: "import", label: "الاستيراد" },
  { id: "transfer", label: "النقل" },
  { id: "backup", label: "النسخ الاحتياطي" }
];

export function DataTabs({
  tabs = defaultTabs,
  activeTab,
  value,
  onChange,
  onValueChange,
  isDark = true,
  label = "مركز البيانات"
}) {
  const activeValue = activeTab || value || tabs[0]?.id;
  const changeTab = onChange || onValueChange || (() => {});

  return jsx("div", {
    className: `grid grid-cols-2 gap-2 rounded-2xl border p-2 sm:grid-cols-4 ${
      isDark ? "border-white/10 bg-gray-900/50" : "border-gray-200 bg-white"
    }`,
    role: "tablist",
    "aria-label": label,
    dir: "rtl",
    children: tabs.map((tab) => {
      const Icon = tab.iconComponent || iconMap[tab.id] || Database;
      const active = activeValue === tab.id;
      return jsxs("button", {
        type: "button",
        role: "tab",
        "aria-selected": active,
        onClick: () => changeTab(tab.id),
        className: `flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium transition-colors ${
          active
            ? "bg-primary text-primary-content shadow-lg shadow-emerald-500/10"
            : isDark
              ? "text-gray-400 hover:bg-white/5 hover:text-white"
              : "text-gray-700 hover:bg-gray-100"
        }`,
        children: [
          tab.icon || jsx(Icon, { className: "h-4 w-4 shrink-0" }),
          jsx("span", { className: "truncate", children: tab.label })
        ]
      }, tab.id);
    })
  });
}

DataTabs.displayName = "DataTabs";
DataTabs.componentId = "data-tabs";
DataTabs.migrationStatus = "native";

export default DataTabs;

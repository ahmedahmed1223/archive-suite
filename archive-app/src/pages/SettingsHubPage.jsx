import { jsx, jsxs } from "react/jsx-runtime";
import {
  Settings,
  Palette,
  Shield,
  Database,
  Bell,
  Keyboard,
  Wrench,
  ChevronRight,
  Download,
  RefreshCw,
} from "lucide-react";
import { MotionPage, PageHero } from "../components/ui/index.js";
import { SettingsSearch } from "../components/settings/SettingsSearch.jsx";
import { SettingsImportExport } from "../components/settings/SettingsImportExport.jsx";
import {
  SETTINGS_CATEGORIES,
  SETTINGS_CATEGORY_LABELS,
  SETTINGS_REGISTRY,
  getSettingsByCategory,
  getSettingValue,
} from "../features/settings/settingsRegistry.js";
import { useAppStore } from "../stores/index.js";
import { getDefaultSettings } from "../utils/settings.js";

const CATEGORY_ICONS = {
  general:       Settings,
  appearance:    Palette,
  security:      Shield,
  data:          Database,
  notifications: Bell,
  shortcuts:     Keyboard,
  advanced:      Wrench,
};

const CATEGORY_DESCRIPTIONS = {
  general:       "اللغة، الحفظ التلقائي، عرض الأرشيف، الإكمال التلقائي.",
  appearance:    "السمة، اللون، الكثافة، النمط البصري.",
  security:      "قفل الجلسة، تحذيرات الحذف، التشفير.",
  data:          "النسخ الاحتياطي، الجداول، سجل المراجعة.",
  notifications: "توست، سطح المكتب، الاحتفاظ بالتنبيهات.",
  shortcuts:     "اختصارات لوحة المفاتيح لكل العمليات.",
  advanced:      "وضع الإقلاع، التوجيه، سياسة التحديث.",
};

const CATEGORY_TAB_MAP = {
  general:       "general",
  appearance:    "appearance",
  security:      "security",
  data:          "data",
  notifications: "general",
  shortcuts:     "shortcuts",
  advanced:      "maintenance",
};

function countCustomized(settings, category) {
  const defaults = getDefaultSettings();
  return getSettingsByCategory(category).filter((entry) => {
    if (entry.sensitive) return false;
    const cur = getSettingValue(settings, entry.path);
    const def = getSettingValue(defaults, entry.path);
    if (cur === undefined || def === undefined) return false;
    return JSON.stringify(cur) !== JSON.stringify(def);
  }).length;
}

export function SettingsHubPage() {
  const settings       = useAppStore((s) => s.settings || {});
  const updateSettings = useAppStore((s) => s.updateSettings);
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);

  function navigateToTab(tab) {
    updateSettings?.({ ui: { ...settings.ui, lastSettingsTab: tab } });
    setCurrentPage?.("settings");
  }

  const totalCustomized = SETTINGS_REGISTRY.filter((entry) => {
    if (entry.sensitive) return false;
    const defaults = getDefaultSettings();
    const cur = getSettingValue(settings, entry.path);
    const def = getSettingValue(defaults, entry.path);
    if (cur === undefined || def === undefined) return false;
    return JSON.stringify(cur) !== JSON.stringify(def);
  }).length;

  return jsx(MotionPage, {
    children: jsxs("div", {
      className: "mx-auto max-w-5xl space-y-8 px-4 pb-16 pt-4",
      children: [
        jsx(PageHero, {
          title: "مركز الإعدادات",
          subtitle: "جميع إعدادات التطبيق في مكان واحد — قابل للبحث والاستيراد والتصدير.",
          children: totalCustomized > 0 && jsxs("span", {
            className: "flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-gray-400",
            children: [
              jsx(RefreshCw, { className: "h-3.5 w-3.5" }),
              jsx("span", { className: "va-number-badge text-white", children: totalCustomized }),
              "إعداد مخصص من الافتراضي",
            ],
          }),
        }),

        // Search bar
        jsx("div", {
          className: "rounded-2xl border border-white/10 bg-white/[0.02] p-4",
          children: jsxs("div", {
            className: "flex flex-col gap-3",
            children: [
              jsx("h2", { className: "text-xs font-semibold uppercase tracking-wider text-gray-600", children: "بحث سريع" }),
              jsx(SettingsSearch, { onSelectEntry: (entry) => navigateToTab(entry.tab) }),
            ],
          }),
        }),

        // Category cards
        jsxs("div", {
          className: "flex flex-col gap-3",
          children: [
            jsx("h2", { className: "text-xs font-semibold uppercase tracking-wider text-gray-600", children: "التصفح بالفئة" }),
            jsx("div", {
              className: "grid gap-3 sm:grid-cols-2 lg:grid-cols-3",
              children: SETTINGS_CATEGORIES.map((cat) => {
                const Icon        = CATEGORY_ICONS[cat] || Settings;
                const tab         = CATEGORY_TAB_MAP[cat] || "general";
                const customCount = countCustomized(settings, cat);
                const total       = getSettingsByCategory(cat).filter((e) => !e.sensitive).length;

                return jsxs("button", {
                  type: "button",
                  onClick: () => navigateToTab(tab),
                  className: "group flex items-start gap-3.5 rounded-xl border border-white/10 bg-white/[0.025] p-4 text-right transition-colors hover:border-emerald-500/25 hover:bg-white/[0.055]",
                  children: [
                    jsx("span", {
                      className: "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-gray-400 transition-colors group-hover:border-emerald-500/30 group-hover:text-emerald-300",
                      children: jsx(Icon, { className: "h-5 w-5" }),
                    }),
                    jsxs("span", {
                      className: "min-w-0 flex-1",
                      children: [
                        jsxs("span", {
                          className: "flex items-center gap-2",
                          children: [
                            jsx("span", { className: "font-semibold text-white", children: SETTINGS_CATEGORY_LABELS[cat] || cat }),
                            customCount > 0 && jsx("span", {
                              className: "rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400",
                              children: `${customCount} مخصص`,
                            }),
                          ],
                        }),
                        jsx("span", { className: "mt-1 block text-xs leading-5 text-gray-500", children: CATEGORY_DESCRIPTIONS[cat] || "" }),
                        jsx("span", { className: "mt-2 block text-[11px] text-gray-700", children: `${total} إعداد` }),
                      ],
                    }),
                    jsx(ChevronRight, { className: "mt-1 h-4 w-4 shrink-0 text-gray-700 transition-colors group-hover:text-emerald-400" }),
                  ],
                }, cat);
              }),
            }),
          ],
        }),

        // Import / Export
        jsxs("div", {
          className: "rounded-2xl border border-white/10 bg-white/[0.02] p-5",
          children: [
            jsxs("div", {
              className: "mb-4 flex items-center gap-2.5",
              children: [
                jsx("span", {
                  className: "flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]",
                  children: jsx(Download, { className: "h-4 w-4 text-gray-400" }),
                }),
                jsxs("div", {
                  children: [
                    jsx("h2", { className: "text-sm font-semibold text-white", children: "تصدير / استيراد الإعدادات" }),
                    jsx("p", { className: "text-xs text-gray-600", children: "انقل إعداداتك بين أجهزة أو احتفظ بنسخة احتياطية." }),
                  ],
                }),
              ],
            }),
            jsx(SettingsImportExport, {}),
          ],
        }),

        // Footer link to full SettingsPage
        jsx("div", {
          className: "text-center",
          children: jsxs("button", {
            type: "button",
            onClick: () => navigateToTab("general"),
            className: "text-sm text-gray-600 transition-colors hover:text-emerald-400",
            children: [
              "فتح الإعدادات الكاملة",
              jsx(ChevronRight, { className: "ms-1 inline h-3.5 w-3.5" }),
            ],
          }),
        }),
      ],
    }),
  });
}

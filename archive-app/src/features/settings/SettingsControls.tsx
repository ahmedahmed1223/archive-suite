import {
  Bot,
  Database,
  Eye,
  EyeOff,
  HardDrive,
  Keyboard,
  LayoutGrid,
  Lightbulb,
  ShieldCheck,
  Sparkles,
  Tags
} from "lucide-react";
import { motion } from "framer-motion";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";

import { SETTINGS_TABS, SETTINGS_TAB_ROLE_ORDER, SETTINGS_TAB_ROLE_LABELS } from "./settingsTabs.js";
import {
  SHORTCUT_ACTIONS,
  SHORTCUT_DISABLED,
  findShortcutConflict,
  getDefaultKeyboardShortcuts,
  getEffectiveKeyboardShortcuts,
  getShortcutConflictDetails,
  normalizeImportedKeyboardShortcuts,
  serializeShortcutExportPayload
} from "./keyboardShortcuts.js";

export const THEME_OPTIONS = [
  { value: "dark", label: "ليلي حبري", detail: "Ink Slate للعمل الطويل" },
  { value: "light", label: "نهاري دافئ", detail: "Warm Off-white للقراءة" },
  { value: "system", label: "حسب النظام", detail: "يتبع المتصفح" }
];

export const ACCENT_OPTIONS = [
  { value: "blue", label: "أزرق Office", color: "#2563eb", hint: "للعمل اليومي" },
  { value: "slate", label: "رمادي صامت", color: "#475569", hint: "monochrome مهني" },
  { value: "teal", label: "فيروزي", color: "#0d9488" },
  { value: "indigo", label: "نيلي", color: "#5b5fc7" },
  { value: "emerald", label: "زمردي", color: "#059669" },
  { value: "amber", label: "كهرماني", color: "#b45309" },
  { value: "rose", label: "وردي", color: "#e11d48" }
];

const TAB_ICONS = {
  general: Lightbulb,
  appearance: Sparkles,
  data: HardDrive,
  ai: Bot,
  security: ShieldCheck,
  shortcuts: Keyboard,
  maintenance: Database
};

export const VIEW_OPTIONS = [
  { value: "grid", label: "شبكة", detail: "بطاقات ومعاينة" },
  { value: "gallery", label: "معرض", detail: "Masonry بصري" },
  { value: "compact", label: "مدمجة", detail: "بلاطات كثيفة" },
  { value: "list", label: "قائمة", detail: "تفاصيل أكثر" },
  { value: "details", label: "تفاصيل", detail: "جدول قابل للتخصيص" }
];

export const DENSITY_OPTIONS = [
  { value: "comfortable", label: "مريحة", detail: "مساحات أوضح" },
  { value: "compact", label: "مضغوطة", detail: "بيانات أكثر" }
];

export function cx(...classes: any) {
  return classes.filter(Boolean).join(" ");
}

export function SettingsCard({ title, description, icon, children, aside }: any) {
  return jsxs("section", {
    className: "va-card rounded-2xl border border-white/10 bg-gray-900/50 p-4 text-right shadow-xl shadow-black/5 backdrop-blur-sm",
    dir: "rtl",
    children: [
      jsxs("div", {
        className: "flex flex-wrap items-start justify-between gap-3",
        children: [
          jsxs("div", {
            className: "min-w-0",
            children: [
              jsxs("h2", {
                className: "flex items-center gap-2 text-base font-bold text-white",
                children: [
                  icon,
                  title
                ]
              }),
              description && jsx("p", { className: "mt-1 text-sm leading-relaxed text-gray-500", children: description })
            ]
          }),
          aside
        ]
      }),
      jsx("div", { className: "mt-4 space-y-3", children })
    ]
  });
}

export function SegmentedChoices({ label, value, options, onChange, columns = "sm:grid-cols-3" }: any) {
  return jsxs("div", {
    className: "space-y-2",
    children: [
      jsx("p", { className: "text-sm font-medium text-gray-300", children: label }),
      jsx("div", {
        className: cx("grid gap-2", columns),
        role: "group",
        "aria-label": label,
        children: options.map((option: any) => {
          const selected = value === option.value;
          return jsxs("button", {
            type: "button",
            onClick: () => onChange(option.value),
            className: cx(
              "btn btn-ghost min-h-16 rounded-xl px-3 py-2 text-right transition-colors",
              selected
                ? "va-accent-border va-accent-bg-soft va-accent-text-on-soft"
                : "border-white/10 bg-gray-950/35 text-gray-400 hover:bg-white/5 hover:text-white"
            ),
            "aria-pressed": selected,
            children: [
              jsx("span", { className: "block text-sm font-semibold", children: option.label }),
              option.detail && jsx("span", { className: "mt-1 block text-xs text-gray-500", children: option.detail })
            ]
          }, option.value);
        })
      })
    ]
  });
}

export function ToggleRow({ label, description, checked, onChange }: any) {
  return jsxs("button", {
    type: "button",
    onClick: () => onChange(!checked),
    className: "va-card-subtle flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-gray-950/30 p-3 text-right transition-colors hover:bg-white/[0.04]",
    "aria-pressed": checked,
    children: [
      jsxs("span", {
        className: "min-w-0",
        children: [
          jsx("span", { className: "block text-sm font-semibold text-white", children: label }),
          description && jsx("span", { className: "mt-1 block text-xs leading-relaxed text-gray-500", children: description })
        ]
      }),
      jsx("span", {
        className: cx(
          "relative h-6 w-11 shrink-0 rounded-full border transition-colors",
          checked ? "va-accent-border va-accent-bg" : "border-white/15 bg-gray-800"
        ),
        children: jsx("span", {
          className: cx(
            "absolute top-1 h-4 w-4 rounded-full bg-white transition-transform",
            checked ? "right-6" : "right-1"
          )
        })
      })
    ]
  });
}

export function SelectRow({ label, value, options, onChange, description }: any) {
  return jsxs("label", {
    className: "va-card-subtle block rounded-xl border border-white/10 bg-gray-950/30 p-3",
    children: [
      jsx("span", { className: "block text-sm font-semibold text-white", children: label }),
      description && jsx("span", { className: "mt-1 block text-xs leading-relaxed text-gray-500", children: description }),
      jsx("select", {
        value,
        onChange: (event: any) => onChange(event.target.value),
        className: "select select-bordered w-full mt-3",
        children: options.map((option: any) => jsx("option", { value: option.value, children: option.label }, option.value))
      })
    ]
  });
}

export function TextInputRow({ label, value, onChange, description, dir = "rtl", placeholder = "", type = "text" }: any) {
  const [revealed, setRevealed] = React.useState(false);
  const isPassword = type === "password";
  const inputType = isPassword ? (revealed ? "text" : "password") : type;
  const RevealIcon = revealed ? EyeOff : Eye;
  return jsxs("label", {
    className: "va-card-subtle block rounded-xl border border-white/10 bg-gray-950/30 p-3",
    children: [
      jsx("span", { className: "block text-sm font-semibold text-white", children: label }),
      description && jsx("span", { className: "mt-1 block text-xs leading-relaxed text-gray-500", children: description }),
      jsxs("div", {
        className: "relative mt-3",
        children: [
          jsx("input", {
            type: inputType,
            value,
            onChange: (event: any) => onChange(event.target.value),
            placeholder,
            dir,
            className: `input input-bordered w-full mt-3 ${isPassword ? "pe-10" : ""}`
          }),
          isPassword && jsx("button", {
            type: "button",
            onClick: (event: any) => { event.preventDefault(); setRevealed((prev: any) => !prev); },
            "aria-label": revealed ? "إخفاء كلمة المرور" : "إظهار كلمة المرور",
            "aria-pressed": revealed,
            className: "absolute inset-inline-end-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-500 transition-colors hover:text-gray-200",
            children: jsx(RevealIcon, { className: "h-4 w-4" })
          })
        ]
      })
    ]
  });
}

export function ColorChoices({ value, onChange }: any) {
  return jsxs("div", {
    className: "space-y-2",
    children: [
      jsx("p", { className: "text-sm font-medium text-gray-300", children: "لون التفاعل" }),
      jsx("div", {
        className: "grid gap-2 sm:grid-cols-5",
        children: ACCENT_OPTIONS.map((option: any) => {
          const selected = value === option.value;
          return jsxs("button", {
            type: "button",
            onClick: () => onChange(option.value),
            className: cx(
              "btn btn-ghost min-h-16 rounded-xl p-3 text-right transition-colors",
              selected ? "va-accent-border va-accent-bg-soft" : "border-white/10 bg-gray-950/35 hover:bg-white/5"
            ),
            children: [
              jsx("span", { className: "block h-5 w-5 rounded-full", style: { backgroundColor: option.color } }),
              jsx("span", { className: "mt-2 block text-xs font-semibold text-white", children: option.label })
            ]
          }, option.value);
        })
      })
    ]
  });
}

export function SettingsTabs({ activeTab, onTabChange }: any) {
  // Group tabs by their declared role so the section dividers stay in a
  // predictable order regardless of how SETTINGS_TABS is sorted.
  const grouped = SETTINGS_TAB_ROLE_ORDER.map((role: any) => ({
    role,
    label: (SETTINGS_TAB_ROLE_LABELS as any)[role] || role,
    tabs: SETTINGS_TABS.filter((tab: any) => (tab.role || "personal") === role)
  })).filter((group: any) => group.tabs.length > 0);

  // Single layout: a horizontal scrollable bar at every width. Role
  // groups flow left-to-right separated by a vertical rule.
  return jsxs("nav", {
    className: cx(
      "va-tab-surface rounded-2xl border p-2",
      // Always a horizontal scrollable bar — at every width.
      "flex gap-1 overflow-x-auto"
    ),
    dir: "rtl",
    "aria-label": "تبويبات الإعدادات",
    children: grouped.map((group: any, groupIndex: any) => jsxs("div", {
      className: cx(
        // Always inline so role groups flow left-to-right on the bar.
        "flex shrink-0 items-center gap-1",
        // Vertical separator between groups (RTL: a right border).
        groupIndex > 0 ? "border-r border-white/10 pe-1 ps-1" : ""
      ),
      children: [
        ...group.tabs.map((tab: any) => {
          const Icon = (TAB_ICONS as any)[tab.id] || CircleQuestionFallback;
          const selected = activeTab === tab.id;
          return jsxs("button", {
            type: "button",
            onClick: () => onTabChange(tab.id),
            "aria-current": selected ? "page" : undefined,
            className: cx(
              "relative inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm transition-colors",
              selected ? "text-white" : "text-gray-400 hover:bg-white/5 hover:text-white"
            ),
            children: [
              selected && jsx(motion.span, {
                layoutId: "settings-tab-active",
                className: "absolute inset-0 rounded-xl border border-[color-mix(in_srgb,var(--va-action)_45%,transparent)] bg-[color-mix(in_srgb,var(--va-action)_15%,transparent)]"
              }),
              jsx(Icon, { className: "relative h-4 w-4 shrink-0" }),
              jsx("span", { className: "relative", children: tab.label })
            ]
          }, tab.id);
        })
      ]
    }, group.role))
  });
}

function CircleQuestionFallback(props: any) {
  return jsx("span", { ...props, children: "؟" });
}

export function ShortcutManager({ settings, onSave, showToast }: any) {
  const [draft, setDraft] = React.useState(() => getEffectiveKeyboardShortcuts(settings));
  const [importText, setImportText] = React.useState("");
  const [exportText, setExportText] = React.useState("");
  const conflicts = getShortcutConflictDetails(draft);
  const hasConflicts = Object.keys(conflicts).length > 0;

  const updateShortcut = (action: any, value: any) => {
    const conflict = findShortcutConflict(draft, action.id, value);
    if (conflict) {
      showToast?.(`يتعارض هذا الاختصار مع: ${conflict.label}`, "warning");
    }
    setDraft((current: any) => ({ ...current, [action.id]: value || SHORTCUT_DISABLED }));
  };

  const disableAll = () => {
    setDraft(Object.fromEntries(SHORTCUT_ACTIONS.map((action: any) => [action.id, SHORTCUT_DISABLED])));
  };

  const restoreDefaults = () => {
    setDraft(getDefaultKeyboardShortcuts());
  };

  const save = () => {
    if (hasConflicts) {
      showToast?.("حل تعارضات الاختصارات قبل الحفظ.", "warning");
      return;
    }
    onSave?.({ keyboardShortcuts: draft }, "تم حفظ الاختصارات");
  };

  const exportJson = async () => {
    const text = serializeShortcutExportPayload({ ...settings, keyboardShortcuts: draft });
    setExportText(text);
    try {
      await navigator.clipboard?.writeText(text);
      showToast?.("تم نسخ خريطة الاختصارات كـ JSON", "success");
    } catch {
      showToast?.("تم تجهيز JSON للنسخ اليدوي", "info");
    }
  };

  const importJson = () => {
    try {
      const parsed = JSON.parse(importText || "{}");
      setDraft(normalizeImportedKeyboardShortcuts(parsed, draft));
      showToast?.("تم استيراد خريطة الاختصارات. راجعها ثم احفظ.", "success");
    } catch {
      showToast?.("ملف JSON غير صالح.", "error");
    }
  };

  return jsxs("div", {
    className: "space-y-4",
    children: [
      jsx("div", {
        className: "grid gap-3 md:grid-cols-2",
        children: SHORTCUT_ACTIONS.map((action: any) => {
          const conflict = conflicts[action.id];
          return jsxs("label", {
            className: cx(
              "va-card-subtle block rounded-xl border p-3",
              conflict ? "border-amber-500/30 bg-amber-500/10" : "border-white/10 bg-gray-950/30"
            ),
            children: [
              jsxs("span", {
                className: "flex items-start justify-between gap-3",
                children: [
                  jsxs("span", {
                    children: [
                      jsx("span", { className: "block text-sm font-semibold text-white", children: action.label }),
                      jsx("span", { className: "mt-1 block text-xs text-gray-500", children: action.category })
                    ]
                  }),
                  conflict && jsx("span", { className: "rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-200", children: "تعارض" })
                ]
              }),
              jsx("select", {
                value: draft[action.id] || SHORTCUT_DISABLED,
                onChange: (event: any) => updateShortcut(action, event.target.value),
                className: "select select-bordered w-full mt-3",
                dir: "ltr",
                children: action.options.map((option: any) => jsx("option", {
                  value: option,
                  children: option === SHORTCUT_DISABLED ? "معطل" : option
                }, option))
              }),
              conflict && jsx("span", { className: "mt-2 block text-xs leading-relaxed text-amber-200", children: `نفس الاختصار مستخدم في ${conflict.label}` })
            ]
          }, action.id);
        })
      }),
      jsxs("div", {
        className: "flex flex-wrap gap-2",
        children: [
          jsx("button", { type: "button", onClick: save, disabled: hasConflicts, className: "btn btn-primary", children: "حفظ الاختصارات" }),
          jsx("button", { type: "button", onClick: restoreDefaults, className: "btn btn-ghost", children: "استعادة الافتراضيات" }),
          jsx("button", { type: "button", onClick: disableAll, className: "btn btn-ghost text-error", children: "تعطيل الكل" })
        ]
      }),
      jsxs("div", {
        className: "grid gap-3 lg:grid-cols-2",
        children: [
          jsxs("div", {
            className: "rounded-xl border border-white/10 bg-gray-950/30 p-3",
            children: [
              jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [
                jsx("p", { className: "text-sm font-semibold text-white", children: "تصدير الاختصارات" }),
                jsx("button", { type: "button", onClick: exportJson, className: "btn btn-ghost btn-xs", children: "نسخ JSON" })
              ] }),
              jsx("textarea", {
                readOnly: true,
                value: exportText,
                placeholder: "اضغط نسخ JSON لتجهيز خريطة الاختصارات الحالية.",
                dir: "ltr",
                className: "textarea textarea-bordered w-full mt-3 min-h-28 font-mono text-xs"
              })
            ]
          }),
          jsxs("div", {
            className: "rounded-xl border border-white/10 bg-gray-950/30 p-3",
            children: [
              jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2", children: [
                jsx("p", { className: "text-sm font-semibold text-white", children: "استيراد الاختصارات" }),
                jsx("button", { type: "button", onClick: importJson, className: "btn btn-ghost btn-xs", children: "تطبيق JSON" })
              ] }),
              jsx("textarea", {
                value: importText,
                onChange: (event: any) => setImportText(event.target.value),
                placeholder: "الصق JSON هنا. يتم تجاهل المفاتيح غير المعروفة والقيم غير المسموحة.",
                dir: "ltr",
                className: "textarea textarea-bordered w-full mt-3 min-h-28 font-mono text-xs"
              })
            ]
          })
        ]
      })
    ]
  });
}

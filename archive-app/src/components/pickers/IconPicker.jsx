import {
  useAppStore
} from "../../stores/index.js";
import {
  Upload
} from "lucide-react";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";

import {
  APP_ICON_REGISTRY,
  ICON_PICKER_EMOJIS,
  getFallbackIconFromSpec,
  normalizeIconSpec,
  renderArchiveIcon
} from "../icons/index.js";
import { normalizeArabicSearchText } from "../../utils/formatting.js";


function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("تعذر قراءة ملف الصورة"));
    reader.readAsDataURL(file);
  });
}

export function IconPicker({
  value,
  fallbackIcon = "📁",
  color = "#10b981",
  onChange,
  onFallbackIconChange,
  inputId = "archive-icon-picker",
  title = "الأيقونة"
}) {
  const { settings, updateSettings, showToast } = useAppStore();
  const activeTab = settings.ui?.iconPickerLastTab || "builtin";
  const normalized = normalizeIconSpec(value, fallbackIcon);
  const [query, setQuery] = React.useState("");
  const [textValue, setTextValue] = React.useState(["emoji", "text"].includes(normalized.type) ? normalized.value : fallbackIcon);
  const [urlValue, setUrlValue] = React.useState(normalized.type === "url" ? normalized.value : "");
  const [isUploading, setIsUploading] = React.useState(false);

  React.useEffect(() => {
    const next = normalizeIconSpec(value, fallbackIcon);
    if (["emoji", "text"].includes(next.type)) setTextValue(next.value);
    if (next.type === "url") setUrlValue(next.value);
  }, [value, fallbackIcon]);

  const setActiveTab = (tab) => {
    updateSettings?.({ ui: { ...(settings.ui || {}), iconPickerLastTab: tab } });
  };

  const applySpec = (spec, nextFallbackIcon = fallbackIcon) => {
    const nextSpec = normalizeIconSpec(spec, nextFallbackIcon);
    onChange?.(nextSpec);
    onFallbackIconChange?.(getFallbackIconFromSpec(nextSpec, nextFallbackIcon));
  };

  const visibleBuiltinIcons = APP_ICON_REGISTRY.filter((item) => {
    const haystack = normalizeArabicSearchText(`${item.id} ${item.label} ${item.category}`);
    return !query.trim() || haystack.includes(normalizeArabicSearchText(query));
  });

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp|gif|svg\+xml)$/i.test(file.type)) {
      showToast?.("اختر صورة مناسبة للأيقونة.", "warning");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast?.("حجم الأيقونة كبير. الحد الحالي 5MB.", "warning");
      return;
    }
    setIsUploading(true);
    try {
      const dataUrl = await readImageAsDataUrl(file);
      applySpec({
        type: "image",
        value: dataUrl,
        sourceName: file.name,
        updatedAt: new Date().toISOString()
      }, fallbackIcon);
    } catch (error) {
      showToast?.(error?.message || "تعذر قراءة صورة الأيقونة.", "error");
    } finally {
      setIsUploading(false);
    }
  };

  const applyUrlIcon = () => {
    const cleanUrl = urlValue.trim();
    if (!/^(https?:\/\/|data:image\/)/i.test(cleanUrl)) {
      showToast?.("أدخل رابط صورة يبدأ بـ http أو https، أو استخدم رفع صورة محلية.", "warning");
      return;
    }
    applySpec({ type: "url", value: cleanUrl, sourceName: cleanUrl, updatedAt: new Date().toISOString() }, fallbackIcon);
  };

  const tabs = [
    { id: "builtin", label: "Lucide" },
    { id: "emoji", label: "نص/إيموجي" },
    { id: "upload", label: "صورة" },
    { id: "url", label: "رابط" }
  ];

  return jsxs("div", {
    className: "space-y-3",
    dir: "rtl",
    children: [
      jsxs("div", {
        className: "flex flex-wrap items-center justify-between gap-3",
        children: [
          jsx("label", { className: "text-sm font-medium text-gray-300", children: title }),
          jsxs("div", {
            className: "flex items-center gap-2 rounded-xl border border-white/10 bg-gray-800/40 px-2 py-1",
            children: [
              renderArchiveIcon(normalized, { fallbackIcon, color, className: "h-5 w-5", imageClassName: "h-7 w-7 rounded-lg object-cover", textClassName: "text-xl" }),
              jsx("span", {
                className: "text-xs text-gray-500",
                children: normalized.type === "lucide" ? "مدمجة" : normalized.type === "url" ? "رابط" : normalized.type === "image" ? "صورة" : "نص"
              })
            ]
          })
        ]
      }),
      jsx("div", {
        className: "va-settings-tabs",
        role: "tablist",
        "aria-label": "مصادر الأيقونة",
        children: tabs.map((tab) => jsx("button", {
          type: "button",
          role: "tab",
          "aria-selected": activeTab === tab.id,
          onClick: () => setActiveTab(tab.id),
          className: `va-settings-tab ${activeTab === tab.id ? "va-settings-tab-active" : ""}`,
          children: tab.label
        }, tab.id))
      }),
      activeTab === "builtin" && jsxs("div", {
        className: "space-y-3",
        children: [
          jsx("input", {
            value: query,
            onChange: (event) => setQuery(event.target.value),
            placeholder: "ابحث في الأيقونات المدمجة...",
            className: "input input-bordered w-full"
          }),
          jsx("div", {
            className: "grid grid-cols-4 gap-2 sm:grid-cols-6",
            children: visibleBuiltinIcons.map((item) => {
              const IconComponent = item.icon;
              const isSelected = normalized.type === "lucide" && normalized.value === item.id;
              return jsx("button", {
                type: "button",
                onClick: () => applySpec({ type: "lucide", value: item.id, color }, fallbackIcon),
                className: `flex h-11 items-center justify-center rounded-xl border transition-colors ${
                  isSelected ? "va-accent-border va-accent-bg-soft va-accent-text" : "border-white/10 bg-gray-800/35 text-gray-300 hover:border-white/30 hover:text-white"
                }`,
                title: item.label,
                "aria-label": `اختيار أيقونة ${item.label}`,
                children: jsx(IconComponent, { className: "h-5 w-5" })
              }, item.id);
            })
          })
        ]
      }),
      activeTab === "emoji" && jsxs("div", {
        className: "space-y-3",
        children: [
          jsx("div", {
            className: "flex flex-wrap gap-2",
            children: ICON_PICKER_EMOJIS.map((icon) => jsx("button", {
              type: "button",
              onClick: () => {
                setTextValue(icon);
                applySpec({ type: "emoji", value: icon }, icon);
              },
              className: `h-10 w-10 rounded-lg border text-xl transition-colors ${
                normalized.type === "emoji" && normalized.value === icon ? "va-accent-border va-accent-bg-soft" : "border-white/10 bg-gray-800/35 hover:border-white/30"
              }`,
              "aria-label": `اختيار ${icon}`,
              children: icon
            }, icon))
          }),
          jsxs("div", {
            className: "flex gap-2",
            children: [
              jsx("input", {
                value: textValue,
                onChange: (event) => setTextValue(event.target.value.slice(0, 8)),
                placeholder: "إيموجي أو نص قصير",
                className: "input input-bordered w-full",
                maxLength: 8
              }),
              jsx("button", {
                type: "button",
                onClick: () => applySpec({ type: textValue.length <= 2 ? "emoji" : "text", value: textValue.trim() || fallbackIcon }, textValue.trim() || fallbackIcon),
                className: "rounded-xl border border-white/10 px-3 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white",
                children: "تطبيق"
              })
            ]
          })
        ]
      }),
      activeTab === "upload" && jsxs("div", {
        className: "rounded-xl border border-white/10 bg-gray-800/30 p-3",
        children: [
          jsxs("button", {
            type: "button",
            onClick: () => document.getElementById(`${inputId}-file`)?.click(),
            disabled: isUploading,
            className: "flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white disabled:opacity-60",
            children: [
              jsx(Upload, { className: "h-4 w-4" }),
              isUploading ? "جار القراءة..." : "رفع أيقونة محلية"
            ]
          }),
          jsx("input", { id: `${inputId}-file`, type: "file", "aria-label": "اختيار صورة أيقونة", accept: "image/png,image/jpeg,image/webp,image/gif,image/svg+xml", onChange: handleImageUpload, style: { display: "none" } }),
          jsx("p", { className: "mt-2 text-xs text-gray-500", children: "تحفظ الصورة كبيانات محلية خفيفة داخل إعدادات العنصر." })
        ]
      }),
      activeTab === "url" && jsxs("div", {
        className: "space-y-2",
        children: [
          jsx("input", {
            value: urlValue,
            onChange: (event) => setUrlValue(event.target.value),
            placeholder: "https://example.com/icon.png",
            dir: "ltr",
            className: "input input-bordered w-full"
          }),
          jsx("button", {
            type: "button",
            onClick: applyUrlIcon,
            className: "min-h-10 w-full rounded-xl border border-white/10 px-3 py-2 text-sm text-gray-300 hover:bg-white/5 hover:text-white",
            children: "استخدام الرابط"
          }),
          jsx("p", { className: "text-xs text-gray-500", children: "يخزن الرابط فقط، ومع تعذر تحميله يعود العرض للأيقونة القديمة." })
        ]
      })
    ]
  });
}

IconPicker.displayName = "IconPicker";
IconPicker.componentId = "icon-picker";
IconPicker.migrationStatus = "native";

export default IconPicker;

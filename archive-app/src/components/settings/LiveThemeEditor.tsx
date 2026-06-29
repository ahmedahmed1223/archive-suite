import { SlidersHorizontal } from "lucide-react";
import * as React from "react";

import {
  CUSTOM_DAISY_THEME_FIELDS,
  DEFAULT_CUSTOM_DAISY_THEME,
  normalizeCustomDaisyTheme
} from "../../features/theme/customDaisyTheme.js";
import { DAISY_THEME_OPTIONS } from "../../features/theme/daisyThemes.js";
import { THEME_MODE, normalizeSchedule } from "../../features/theme/themeSchedule.js";

const MOTION_LEVEL_VALUE = { off: 0, reduced: 1, full: 2 };
const MOTION_LEVEL_BY_VALUE = ["off", "reduced", "full"];
const FONT_SCALE_VALUE = { small: 0, normal: 1, large: 2, xlarge: 3 };
const FONT_SCALE_BY_VALUE = ["small", "normal", "large", "xlarge"];

export function LiveThemeEditor({ draft, onPatch }: any) {
  const selectedTheme = DAISY_THEME_OPTIONS.find((theme: any) => theme.id === draft.daisyTheme) || DAISY_THEME_OPTIONS[0];
  const themeSchedule = normalizeSchedule(draft.themeSchedule);
  const customTheme = normalizeCustomDaisyTheme(draft.customDaisyTheme);
  const lightThemes = DAISY_THEME_OPTIONS.filter((theme: any) => theme.tone?.includes("فاتح") || theme.tone?.includes("نهاري") || theme.id === "light");
  const darkThemes = DAISY_THEME_OPTIONS.filter((theme: any) => theme.tone?.includes("داكن") || theme.id === "dark" || theme.id === "business");
  const patchSchedule = (patch: any) => onPatch?.({
    themeSchedule: normalizeSchedule({
      ...themeSchedule,
      ...patch
    })
  });
  const patchCustomTheme = (patch: any) => onPatch?.({
    customDaisyTheme: normalizeCustomDaisyTheme({
      ...customTheme,
      ...patch,
      vars: {
        ...customTheme.vars,
        ...(patch.vars || {})
      }
    })
  });

  return (
    <section className="card card-border rounded-2xl border border-white/10 bg-gray-950/30 p-3 text-right" dir="rtl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-bold text-white">
            <SlidersHorizontal className="h-4 w-4 va-accent-text" />
            محرر حي مختصر
          </h3>
          <p className="mt-1 text-xs leading-6 text-gray-500">
            يضبط سمة DaisyUI مع كثافة التطبيق وحركته قبل حفظ المسودة.
          </p>
        </div>
        <span className="badge badge-sm rounded-full border-white/10 bg-white/5 text-gray-200">
          {selectedTheme.label}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="space-y-2">
          <span className="block text-xs font-semibold text-gray-300">سمة DaisyUI</span>
          <select
            value={draft.daisyTheme}
            onChange={(event: any) => onPatch?.({ daisyTheme: event.target.value })}
            className="select select-sm select-accent w-full rounded-xl"
          >
            {DAISY_THEME_OPTIONS.map((theme: any) => (
              <option key={theme.id} value={theme.id}>{theme.label}</option>
            ))}
          </select>
        </label>

        <div className="rounded-xl border border-white/10 bg-base-200/30 p-3">
          <label className="flex items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-gray-300">جدولة فاتح/داكن</span>
              <span className="mt-1 block text-[11px] leading-5 text-gray-500">
                يتبع تفضيل النظام للوضع الفاتح أو الداكن عند التفعيل.
              </span>
            </span>
            <input
              type="checkbox"
              checked={themeSchedule.mode === THEME_MODE.AUTO}
              onChange={(event: any) => patchSchedule({
                mode: event.target.checked ? THEME_MODE.AUTO : THEME_MODE.MANUAL,
                theme: draft.daisyTheme
              })}
              className="toggle toggle-accent toggle-sm"
              aria-label="تفعيل جدولة السمات التلقائية"
            />
          </label>
        </div>

        <label className="space-y-2">
          <span className="block text-xs font-semibold text-gray-300">ثيم التطبيق</span>
          <select
            value={draft.theme}
            onChange={(event: any) => onPatch?.({ theme: event.target.value })}
            className="select select-sm select-accent w-full rounded-xl"
          >
            <option value="dark">ليلي</option>
            <option value="light">نهاري</option>
            <option value="system">حسب النظام</option>
          </select>
        </label>

        {themeSchedule.mode === THEME_MODE.AUTO && (
          <>
            <label className="space-y-2">
              <span className="block text-xs font-semibold text-gray-300">سمة الوضع الفاتح</span>
              <select
                value={themeSchedule.lightTheme}
                onChange={(event: any) => patchSchedule({ lightTheme: event.target.value })}
                className="select select-sm select-accent w-full rounded-xl"
              >
                {lightThemes.map((theme: any) => (
                  <option key={theme.id} value={theme.id}>{theme.label}</option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="block text-xs font-semibold text-gray-300">سمة الوضع الداكن</span>
              <select
                value={themeSchedule.darkTheme}
                onChange={(event: any) => patchSchedule({ darkTheme: event.target.value })}
                className="select select-sm select-accent w-full rounded-xl"
              >
                {darkThemes.map((theme: any) => (
                  <option key={theme.id} value={theme.id}>{theme.label}</option>
                ))}
              </select>
            </label>
          </>
        )}

        <div className="md:col-span-2 rounded-xl border border-white/10 bg-base-200/30 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <label className="flex min-w-0 items-center justify-between gap-3 sm:flex-1">
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-gray-300">سمة CSS مخصصة</span>
                <span className="mt-1 block text-[11px] leading-5 text-gray-500">
                  تحفظ متغيرات DaisyUI والتطبيق كطبقة فوق السمة الحالية.
                </span>
              </span>
              <input
                type="checkbox"
                checked={customTheme.enabled}
                onChange={(event: any) => patchCustomTheme({ enabled: event.target.checked })}
                className="toggle toggle-accent toggle-sm"
                aria-label="تفعيل السمة المخصصة"
              />
            </label>
            <button
              type="button"
              className="btn btn-ghost btn-xs self-start"
              onClick={() => onPatch?.({ customDaisyTheme: DEFAULT_CUSTOM_DAISY_THEME })}
            >
              إعادة ضبط
            </button>
          </div>

          {customTheme.enabled && (
            <div className="mt-3 space-y-3">
              <label className="space-y-2">
                <span className="block text-xs font-semibold text-gray-300">اسم السمة</span>
                <input
                  type="text"
                  value={customTheme.name}
                  onChange={(event: any) => patchCustomTheme({ name: event.target.value })}
                  className="input input-sm input-accent w-full rounded-xl"
                />
              </label>
              <div className="grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
                {CUSTOM_DAISY_THEME_FIELDS.map((field: any) => (
                  <label key={field.key} className="rounded-lg border border-white/10 bg-base-100/30 p-2">
                    <span className="flex items-center justify-between gap-2 text-[11px] font-semibold text-gray-300">
                      <span>{field.label}</span>
                      <span className="font-mono text-[10px] text-gray-500">{(customTheme.vars as any)[field.key]}</span>
                    </span>
                    <input
                      type="color"
                      value={(customTheme.vars as any)[field.key]}
                      onChange={(event: any) => patchCustomTheme({ vars: { [field.key]: event.target.value } })}
                      className="input input-sm input-accent mt-2 h-9 w-full rounded-xl p-1"
                      aria-label={`لون ${field.label}`}
                    />
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <label className="space-y-2">
          <span className="block text-xs font-semibold text-gray-300">الحركة</span>
          <input
            type="range"
            min={0}
            max={2}
            value={(MOTION_LEVEL_VALUE as any)[draft.motionLevel] ?? 2}
            onChange={(event: any) => onPatch?.({ motionLevel: MOTION_LEVEL_BY_VALUE[Number(event.target.value)] || "full" })}
            className="range range-accent range-sm"
          />
          <span className="block text-[11px] text-gray-500">
            {draft.motionLevel === "off" ? "بدون حركة" : draft.motionLevel === "reduced" ? "مخففة" : "كاملة"}
          </span>
        </label>

        <label className="space-y-2">
          <span className="block text-xs font-semibold text-gray-300">حجم الخط</span>
          <input
            type="range"
            min={0}
            max={3}
            value={(FONT_SCALE_VALUE as any)[draft.fontScale] ?? 1}
            onChange={(event: any) => onPatch?.({ fontScale: FONT_SCALE_BY_VALUE[Number(event.target.value)] || "normal" })}
            className="range range-accent range-sm"
          />
          <span className="block text-[11px] text-gray-500">
            {draft.fontScale === "small" ? "صغير" : draft.fontScale === "large" ? "كبير" : draft.fontScale === "xlarge" ? "كبير جدا" : "عادي"}
          </span>
        </label>
      </div>
    </section>
  );
}

export default LiveThemeEditor;

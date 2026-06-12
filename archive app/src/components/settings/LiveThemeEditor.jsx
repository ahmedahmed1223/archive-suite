import { SlidersHorizontal } from "lucide-react";
import * as React from "react";

import { DAISY_THEME_OPTIONS } from "../../features/theme/daisyThemes.js";
import { THEME_MODE, normalizeSchedule } from "../../features/theme/themeSchedule.js";

const MOTION_LEVEL_VALUE = { off: 0, reduced: 1, full: 2 };
const MOTION_LEVEL_BY_VALUE = ["off", "reduced", "full"];
const FONT_SCALE_VALUE = { small: 0, normal: 1, large: 2, xlarge: 3 };
const FONT_SCALE_BY_VALUE = ["small", "normal", "large", "xlarge"];

export function LiveThemeEditor({ draft, onPatch }) {
  const selectedTheme = DAISY_THEME_OPTIONS.find((theme) => theme.id === draft.daisyTheme) || DAISY_THEME_OPTIONS[0];
  const themeSchedule = normalizeSchedule(draft.themeSchedule);
  const lightThemes = DAISY_THEME_OPTIONS.filter((theme) => theme.tone?.includes("فاتح") || theme.tone?.includes("نهاري") || theme.id === "light");
  const darkThemes = DAISY_THEME_OPTIONS.filter((theme) => theme.tone?.includes("داكن") || theme.id === "dark" || theme.id === "business");
  const patchSchedule = (patch) => onPatch?.({
    themeSchedule: normalizeSchedule({
      ...themeSchedule,
      ...patch
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
            onChange={(event) => onPatch?.({ daisyTheme: event.target.value })}
            className="select select-sm select-accent w-full rounded-xl"
          >
            {DAISY_THEME_OPTIONS.map((theme) => (
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
              onChange={(event) => patchSchedule({
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
            onChange={(event) => onPatch?.({ theme: event.target.value })}
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
                onChange={(event) => patchSchedule({ lightTheme: event.target.value })}
                className="select select-sm select-accent w-full rounded-xl"
              >
                {lightThemes.map((theme) => (
                  <option key={theme.id} value={theme.id}>{theme.label}</option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="block text-xs font-semibold text-gray-300">سمة الوضع الداكن</span>
              <select
                value={themeSchedule.darkTheme}
                onChange={(event) => patchSchedule({ darkTheme: event.target.value })}
                className="select select-sm select-accent w-full rounded-xl"
              >
                {darkThemes.map((theme) => (
                  <option key={theme.id} value={theme.id}>{theme.label}</option>
                ))}
              </select>
            </label>
          </>
        )}

        <label className="space-y-2">
          <span className="block text-xs font-semibold text-gray-300">الحركة</span>
          <input
            type="range"
            min={0}
            max={2}
            value={MOTION_LEVEL_VALUE[draft.motionLevel] ?? 2}
            onChange={(event) => onPatch?.({ motionLevel: MOTION_LEVEL_BY_VALUE[Number(event.target.value)] || "full" })}
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
            value={FONT_SCALE_VALUE[draft.fontScale] ?? 1}
            onChange={(event) => onPatch?.({ fontScale: FONT_SCALE_BY_VALUE[Number(event.target.value)] || "normal" })}
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

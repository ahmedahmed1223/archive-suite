import { Check, Palette } from "lucide-react";
import * as React from "react";

import { DAISY_THEME_OPTIONS, normalizeDaisyTheme } from "../../features/theme/daisyThemes.js";
import { cx } from "../../features/settings/SettingsControls.jsx";

export function ThemeGallery({ value, onChange, themes = DAISY_THEME_OPTIONS }: any) {
  const selected = normalizeDaisyTheme(value);

  return (
    <section className="space-y-3" dir="rtl" aria-labelledby="daisy-theme-gallery-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 id="daisy-theme-gallery-title" className="flex items-center gap-2 text-sm font-bold text-white">
            <Palette className="h-4 w-4 va-accent-text" />
            معرض سمات DaisyUI
          </h3>
          <p className="mt-1 text-xs leading-6 text-gray-500">
            اختر سمة جاهزة؛ كل بطاقة تستخدم `data-theme` داخليا حتى ترى ألوان DaisyUI الحقيقية قبل التطبيق.
          </p>
        </div>
        <span className="badge badge-sm badge-accent badge-soft rounded-full">
          {themes.length} سمة
        </span>
      </div>

      <div className="grid max-h-[26rem] gap-2 overflow-y-auto pe-1 sm:grid-cols-2 xl:grid-cols-3" role="radiogroup" aria-label="سمات DaisyUI">
        {themes.map((theme: any) => {
          const active = selected === theme.id;
          return (
            <label
              key={theme.id}
              data-theme={theme.id}
              className={cx(
                "card card-border min-h-28 cursor-pointer rounded-xl border p-3 text-right transition-colors",
                active ? "ring-2 ring-[var(--va-action)]" : "hover:ring-1 hover:ring-base-content/20"
              )}
              style={{ backgroundColor: theme.bg, color: theme.fg }}
            >
              <input
                type="radio"
                name="daisy-theme-gallery"
                value={theme.id}
                checked={active}
                onChange={() => onChange?.(theme.id)}
                className="theme-controller radio radio-accent radio-sm sr-only"
              />
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">{theme.label}</span>
                  <span className="mt-1 block text-xs opacity-70">{theme.tone}</span>
                </span>
                {active ? <Check className="h-4 w-4 shrink-0" /> : null}
              </span>
              <span className="mt-3 flex gap-1.5" aria-hidden="true">
                <span className="h-5 flex-1 rounded bg-base-100 border border-base-content/10" />
                <span className="h-5 flex-1 rounded bg-base-200 border border-base-content/10" />
                <span className="h-5 flex-1 rounded bg-primary" />
                <span className="h-5 flex-1 rounded bg-secondary" />
                <span className="h-5 flex-1 rounded bg-accent" style={{ backgroundColor: theme.accent }} />
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
}

export default ThemeGallery;

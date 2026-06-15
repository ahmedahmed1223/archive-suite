import * as React from "react";
import { motion } from "framer-motion";
import { Palette, Download, Upload, ChevronDown } from "lucide-react";

import { DAISY_THEME_OPTIONS, getStoredDaisyTheme, storeDaisyTheme } from "../features/theme/daisyThemes.js";
import {
  CUSTOM_DAISY_THEME_FIELDS,
  getStoredCustomDaisyTheme,
  storeCustomDaisyTheme,
  applyCustomDaisyTheme,
} from "../features/theme/customDaisyTheme.js";
import {
  getStoredDensity,
  setStoredDensity,
  applyDensityToDocument,
} from "../features/theme/themePresets.js";
import { downloadThemeFile, importThemeConfig } from "../features/theme/themeExportImport.js";

import { ThemePreviewCard } from "../components/theme/ThemePreviewCard.jsx";
import { DensitySelector } from "../components/theme/DensitySelector.jsx";

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------
function Section({ title, children }) {
  return (
    <section className="rounded-2xl border border-base-300/40 bg-base-200/30 p-4 sm:p-5">
      <h2 className="mb-4 text-sm font-bold text-base-content/80 uppercase tracking-wide">
        {title}
      </h2>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Custom theme fields editor
// ---------------------------------------------------------------------------
function CustomThemeEditor({ customTheme, onChange }) {
  const [open, setOpen] = React.useState(false);

  const handleToggleEnabled = () => {
    const next = { ...customTheme, enabled: !customTheme.enabled };
    onChange(next);
    applyCustomDaisyTheme(next);
  };

  const handleColorChange = (key, value) => {
    const next = {
      ...customTheme,
      vars: { ...customTheme.vars, [key]: value },
    };
    onChange(next);
    if (next.enabled) applyCustomDaisyTheme(next);
  };

  return (
    <div className="space-y-3">
      {/* Enable / disable toggle */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-base-content/70">تفعيل السمة المخصصة</span>
        <button
          type="button"
          role="switch"
          aria-checked={customTheme.enabled}
          aria-label={customTheme.enabled ? "تعطيل السمة المخصصة" : "تفعيل السمة المخصصة"}
          onClick={handleToggleEnabled}
          className={[
            "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
            customTheme.enabled ? "bg-primary/70" : "bg-base-300/60",
          ].join(" ")}
        >
          <span
            className={[
              "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
              customTheme.enabled ? "translate-x-1" : "translate-x-6",
            ].join(" ")}
          />
        </button>
      </div>

      {/* Expand / collapse fields */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border border-base-300/40 bg-base-200/40 px-3 py-2 text-sm text-base-content/70 hover:bg-base-200/70"
      >
        <span>تحرير الألوان</span>
        <ChevronDown
          className={["h-4 w-4 transition-transform", open ? "rotate-180" : ""].join(" ")}
        />
      </button>

      {open && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {CUSTOM_DAISY_THEME_FIELDS.map((field) => (
            <label key={field.key} className="flex items-center gap-2 rounded-lg border border-base-300/30 bg-base-200/20 px-2 py-1.5">
              <input
                type="color"
                value={customTheme.vars[field.key] ?? field.defaultValue}
                onChange={(e) => handleColorChange(field.key, e.target.value)}
                className="h-7 w-7 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
                aria-label={field.label}
              />
              <span className="truncate text-xs text-base-content/70">{field.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export function AppearanceSettingsPage() {
  const [daisyTheme, setDaisyTheme] = React.useState(() => getStoredDaisyTheme());
  const [density, setDensity] = React.useState(() => getStoredDensity());
  const [customTheme, setCustomTheme] = React.useState(() => getStoredCustomDaisyTheme());
  const [importError, setImportError] = React.useState(null);
  const fileInputRef = React.useRef(null);

  // ---- handlers ----

  const handleThemeSelect = (themeId) => {
    setDaisyTheme(themeId);
    storeDaisyTheme(themeId);
    // Dispatch DOM event so existing listeners (AppShell, etc.) update.
    document.dispatchEvent(new CustomEvent("daisytheme:change", { detail: { theme: themeId } }));
  };

  const handleDensityChange = (id) => {
    setDensity(id);
    setStoredDensity(id);
    applyDensityToDocument(id);
  };

  const handleCustomThemeChange = (next) => {
    setCustomTheme(next);
    storeCustomDaisyTheme(next);
  };

  const handleExport = () => {
    downloadThemeFile({ daisyTheme, customTheme, density });
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const config = importThemeConfig(ev.target.result);
        // Apply daisy theme
        handleThemeSelect(config.daisyTheme);
        // Apply density
        handleDensityChange(config.density);
        // Apply custom theme
        handleCustomThemeChange(config.customTheme);
        applyCustomDaisyTheme(config.customTheme);
        setImportError(null);
      } catch (err) {
        setImportError(err.message || "فشل استيراد الإعدادات.");
      }
    };
    reader.readAsText(file);
    // Reset so the same file can be re-selected.
    e.target.value = "";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="va-page-shell space-y-6 p-4 sm:p-6"
      dir="rtl"
    >
      {/* Page header */}
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Palette className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-lg font-bold text-base-content">المظهر</h1>
          <p className="text-sm text-base-content/60">
            تخصيص السمة والكثافة والألوان ومشاركة الإعدادات.
          </p>
        </div>
      </div>

      {/* 1. Theme grid */}
      <Section title="السمة">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {DAISY_THEME_OPTIONS.map((theme) => (
            <ThemePreviewCard
              key={theme.id}
              theme={theme}
              selected={daisyTheme === theme.id}
              onSelect={handleThemeSelect}
            />
          ))}
        </div>
      </Section>

      {/* 2. Density */}
      <Section title="الكثافة">
        <DensitySelector density={density} onChange={handleDensityChange} />
      </Section>

      {/* 3. Custom theme */}
      <Section title="سمة مخصصة">
        <CustomThemeEditor
          customTheme={customTheme}
          onChange={handleCustomThemeChange}
        />
      </Section>

      {/* 4. Import / Export */}
      <Section title="استيراد / تصدير">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-xl border border-base-300/40 bg-base-200/40 px-4 py-2 text-sm font-semibold text-base-content/80 hover:bg-base-200/70"
          >
            <Download className="h-4 w-4" />
            تصدير الإعدادات
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-xl border border-base-300/40 bg-base-200/40 px-4 py-2 text-sm font-semibold text-base-content/80 hover:bg-base-200/70"
          >
            <Upload className="h-4 w-4" />
            استيراد
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportFile}
            className="hidden"
            aria-label="استيراد ملف الإعدادات"
          />
        </div>

        {importError && (
          <p className="mt-3 rounded-lg border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">
            {importError}
          </p>
        )}
      </Section>
    </motion.div>
  );
}

AppearanceSettingsPage.pageId = "appearance";
AppearanceSettingsPage.migrationStatus = "native";

export default AppearanceSettingsPage;

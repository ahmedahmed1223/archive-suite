import * as React from "react";
import { motion } from "framer-motion";
import { Palette, Download, Upload, ChevronDown } from "lucide-react";

import { PageHero } from "../components/ui/V1Primitives.jsx";
import { Button, Switch } from "../components/ui/index.js";
import {
  DAISY_THEME_OPTIONS,
  getStoredDaisyTheme,
  storeDaisyTheme,
  normalizeDaisyTheme,
  applyDaisyTheme,
} from "../features/theme/daisyThemes.js";
import {
  CUSTOM_DAISY_THEME_FIELDS,
  getStoredCustomDaisyTheme,
  storeCustomDaisyTheme,
  applyCustomDaisyTheme,
  normalizeCustomDaisyTheme,
} from "../features/theme/customDaisyTheme.js";
import {
  getStoredDensity,
  setStoredDensity,
  applyDensityToDocument,
} from "../features/theme/themePresets.js";
import { downloadThemeFile, importThemeConfig } from "../features/theme/themeExportImport.js";

import { ThemePreviewCard } from "../components/theme/ThemePreviewCard.jsx";
import { DensitySelector } from "../components/theme/DensitySelector.jsx";
import { useAppStore } from "../stores/index.js";

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------
function Section({ title, children }: any) {
  return (
    <section className="rounded-[var(--va-radius-lg)] border border-[var(--va-border-soft)] bg-[var(--va-surface)] p-4 shadow-[var(--va-elev-1)] sm:p-5">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-[var(--va-text-2)]">
        {title}
      </h2>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Custom theme fields editor
// ---------------------------------------------------------------------------
function CustomThemeEditor({ customTheme, onChange }: any) {
  const [open, setOpen] = React.useState(false);

  const handleToggleEnabled = () => {
    const next = { ...customTheme, enabled: !customTheme.enabled };
    onChange(next);
    applyCustomDaisyTheme(next);
  };

  const handleColorChange = (key: any, value: any) => {
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
        <span className="text-sm text-[var(--va-text-2)]">تفعيل السمة المخصصة</span>
        <Switch
          checked={customTheme.enabled}
          onChange={handleToggleEnabled}
        />
      </div>

      {/* Expand / collapse fields */}
      <button
        type="button"
        onClick={() => setOpen((v: any) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-[var(--va-radius-md)] border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] px-3 py-2 text-sm text-[var(--va-text-2)] transition-colors hover:bg-[var(--va-elevated)]"
      >
        <span>تحرير الألوان</span>
        <ChevronDown
          className={["h-4 w-4 transition-transform", open ? "rotate-180" : ""].join(" ")}
        />
      </button>

      {open && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {CUSTOM_DAISY_THEME_FIELDS.map((field: any) => (
            <label key={field.key} className="flex items-center gap-2 rounded-[var(--va-radius-md)] border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] px-2 py-1.5">
              <input
                type="color"
                value={customTheme.vars[field.key] ?? field.defaultValue}
                onChange={(e: any) => handleColorChange(field.key, e.target.value)}
                className="h-7 w-7 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
                aria-label={field.label}
              />
              <span className="truncate text-xs text-[var(--va-text-2)]">{field.label}</span>
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
  // The app store (settings.ui.*) is the source of truth that AppRouter reads
  // to drive the live theme effect; localStorage mirrors it for reload survival.
  // Reading from the store here keeps this page consistent with SettingsPage and
  // prevents navigation/store re-renders from reverting a freshly picked theme.
  const settings = useAppStore((s: any) => s.settings);
  const updateSettings = useAppStore((s: any) => s.updateSettings);
  const showToast = useAppStore((s: any) => s.showToast);

  const ui = settings?.ui || {};
  const patchUi = (uiPatch: any, message?: any) =>
    updateSettings?.({ ui: { ...ui, ...uiPatch } }) !== false && message
      ? showToast?.(message, "success")
      : undefined;

  const [daisyTheme, setDaisyTheme] = React.useState(() => ui.daisyTheme || getStoredDaisyTheme());
  const [density, setDensity] = React.useState(() => ui.visualDensity || getStoredDensity());
  const [customTheme, setCustomTheme] = React.useState(
    () => normalizeCustomDaisyTheme(ui.customDaisyTheme || getStoredCustomDaisyTheme())
  );
  const [importError, setImportError] = React.useState(null);
  const fileInputRef = React.useRef(null);

  // Keep local state in sync if the theme changes elsewhere (e.g. SettingsPage).
  React.useEffect(() => { setDaisyTheme(ui.daisyTheme || getStoredDaisyTheme()); }, [ui.daisyTheme]);
  React.useEffect(() => { setDensity(ui.visualDensity || getStoredDensity()); }, [ui.visualDensity]);
  React.useEffect(() => {
    setCustomTheme(normalizeCustomDaisyTheme(ui.customDaisyTheme || getStoredCustomDaisyTheme()));
  }, [ui.customDaisyTheme]);

  // ---- handlers ----

  const handleThemeSelect = (themeId: any) => {
    const normalized = normalizeDaisyTheme(themeId);
    setDaisyTheme(normalized);
    storeDaisyTheme(normalized);
    applyDaisyTheme(normalized);
    // Persist into the store so AppRouter's theme effect re-runs — previously the
    // pick only reached localStorage + an unobserved DOM event, so the gallery
    // appeared not to apply and reverted on navigation.
    patchUi({ daisyTheme: normalized });
  };

  const handleDensityChange = (id: any) => {
    setDensity(id);
    setStoredDensity(id);
    applyDensityToDocument(id);
    patchUi({ visualDensity: id });
  };

  const handleCustomThemeChange = (next: any) => {
    const normalized = normalizeCustomDaisyTheme(next);
    setCustomTheme(normalized);
    storeCustomDaisyTheme(normalized);
    patchUi({ customDaisyTheme: normalized });
  };

  const handleExport = () => {
    downloadThemeFile({ daisyTheme, customTheme, density });
  };

  const handleImportFile = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev: any) => {
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
      } catch (err: any) {
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
      <PageHero
        icon={<Palette className="h-6 w-6 va-accent-text" />}
        title="المظهر"
        description="تخصيص السمة والكثافة والألوان ومشاركة الإعدادات."
      />

      {/* 1. Theme grid */}
      <Section title="السمة">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {DAISY_THEME_OPTIONS.map((theme: any) => (
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
          <Button
            variant="secondary"
            onClick={handleExport}
            leadingIcon={<Download className="h-4 w-4" />}
          >
            تصدير الإعدادات
          </Button>

          <Button
            variant="secondary"
            onClick={() => (fileInputRef.current as any)?.click()}
            leadingIcon={<Upload className="h-4 w-4" />}
          >
            استيراد
          </Button>

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
          <p className="mt-3 rounded-[var(--va-radius-md)] border border-[var(--va-status-danger)]/40 bg-[var(--va-status-danger)]/10 px-3 py-2 text-sm text-[var(--va-status-danger)]" role="alert">
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

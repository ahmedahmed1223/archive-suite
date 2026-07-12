"use client";

import { useState, useRef } from "react";
import { Download, Upload, Plus, Trash2, Clock } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import {
  THEME_PRESETS,
  exportThemeAsJson,
  importThemeFromJson,
  addScheduledRule,
  removeScheduledRule,
  updateScheduledRule,
  updateAppearanceSettings,
  type ScheduledThemeRule
} from "@/lib/themes";

export default function AppearanceSettings() {
  const { settings, setPreset, refreshTheme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exportedJson, setExportedJson] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [newRuleTime, setNewRuleTime] = useState({ start: "06:00", end: "18:00" });
  const [newRuleMode, setNewRuleMode] = useState<"light" | "dark">("light");

  const handleExport = () => {
    const json = exportThemeAsJson();
    setExportedJson(json);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "archive-theme.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const result = importThemeFromJson(content);
      if (result.success) {
        setImportError(null);
        refreshTheme();
      } else {
        setImportError(result.error || "خطأ غير معروف أثناء الاستيراد.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleAddRule = () => {
    const id = `rule-${Date.now()}`;
    const rule: ScheduledThemeRule = {
      id,
      enabled: true,
      startTime: newRuleTime.start,
      endTime: newRuleTime.end,
      mode: newRuleMode
    };
    addScheduledRule(rule);
    refreshTheme();
  };

  const handleToggleRule = (id: string, enabled: boolean) => {
    updateScheduledRule(id, { enabled });
    refreshTheme();
  };

  const handleRemoveRule = (id: string) => {
    removeScheduledRule(id);
    refreshTheme();
  };

  const handleToggleScheduling = () => {
    updateAppearanceSettings({ schedulingEnabled: !settings.schedulingEnabled });
    refreshTheme();
  };

  return (
    <div className="appearance-settings">
      {/* Presets */}
      <div className="settings-section">
        <h3>سمات جاهزة</h3>
        <div className="preset-grid">
          {THEME_PRESETS.map((preset) => (
            <button
              key={preset.id}
              className={`preset-card ${settings.currentPreset === preset.id ? "active" : ""}`}
              onClick={() => setPreset(preset.id)}
              type="button"
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Export/Import */}
      <div className="settings-section">
        <h3>بيانات السمة</h3>
        <div className="button-group">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleExport}
          >
            <Download size={16} />
            تصدير السمة
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={16} />
            استيراد السمة
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            style={{ display: "none" }}
          />
        </div>
        {importError && <div className="error-message">{importError}</div>}
        {exportedJson && (
          <details className="export-preview">
            <summary>معاينة JSON المُصدَّر</summary>
            <pre>{exportedJson}</pre>
          </details>
        )}
      </div>

      {/* Scheduled Switching */}
      <div className="settings-section">
        <h3>
          <Clock size={16} />
          تبديل السمة حسب الوقت
        </h3>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={settings.schedulingEnabled}
            onChange={handleToggleScheduling}
          />
          تفعيل التبديل التلقائي حسب الوقت
        </label>

        <div className="rules-list">
          {settings.scheduledRules.map((rule) => (
            <div key={rule.id} className="rule-item">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={(e) => handleToggleRule(rule.id, e.target.checked)}
                />
                {rule.startTime} - {rule.endTime}: {rule.mode === "dark" ? "داكن" : "فاتح"}
              </label>
              <button
                type="button"
                className="btn-icon"
                onClick={() => handleRemoveRule(rule.id)}
                title="حذف القاعدة"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>

        <div className="add-rule-form">
          <div className="form-row">
            <input
              type="time"
              value={newRuleTime.start}
              onChange={(e) =>
                setNewRuleTime({ ...newRuleTime, start: e.target.value })
              }
              placeholder="وقت البدء"
            />
            <input
              type="time"
              value={newRuleTime.end}
              onChange={(e) =>
                setNewRuleTime({ ...newRuleTime, end: e.target.value })
              }
              placeholder="وقت الانتهاء"
            />
            <select
              value={newRuleMode}
              onChange={(e) => setNewRuleMode(e.target.value as "light" | "dark")}
            >
              <option value="light">فاتح</option>
              <option value="dark">داكن</option>
            </select>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleAddRule}
            >
              <Plus size={16} />
              إضافة
            </button>
          </div>
        </div>
      </div>

      <style>{`
        .appearance-settings {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .settings-section {
          padding: 1.5rem;
          border: 1px solid var(--color-border-primary);
          border-radius: var(--radius-lg);
          background: var(--color-bg-secondary);
        }

        .settings-section h3 {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin: 0 0 1rem 0;
          font-size: var(--font-size-lg);
          font-weight: var(--font-weight-semibold);
          color: var(--color-text-primary);
        }

        .preset-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 1rem;
        }

        .preset-card {
          padding: 1rem;
          border: 2px solid var(--color-border-secondary);
          border-radius: var(--radius-md);
          background: var(--color-bg-tertiary);
          color: var(--color-text-primary);
          cursor: pointer;
          transition: all 150ms ease-out;
          font-weight: var(--font-weight-medium);
        }

        .preset-card:hover {
          border-color: var(--color-accent-primary);
          background: var(--color-surface-elevated);
        }

        .preset-card.active {
          border-color: var(--color-accent-primary);
          background: var(--color-surface-selected);
          color: var(--color-accent-primary);
        }

        .button-group {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
          margin-bottom: 1rem;
        }

        .btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          border: none;
          border-radius: var(--radius-md);
          cursor: pointer;
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
          transition: all 150ms ease-out;
        }

        .btn-primary {
          background: var(--color-accent-primary);
          color: var(--color-text-inverse);
        }

        .btn-primary:hover {
          background: var(--color-accent-primary-hover);
        }

        .btn-secondary {
          background: var(--color-bg-tertiary);
          color: var(--color-text-primary);
          border: 1px solid var(--color-border-primary);
        }

        .btn-secondary:hover {
          background: var(--color-surface-elevated);
          border-color: var(--color-border-strong);
        }

        .btn-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.5rem;
          border: none;
          background: transparent;
          color: var(--color-text-secondary);
          cursor: pointer;
          border-radius: var(--radius-sm);
          transition: all 150ms ease-out;
        }

        .btn-icon:hover {
          background: var(--color-bg-tertiary);
          color: var(--color-status-error);
        }

        .error-message {
          padding: 0.75rem 1rem;
          margin: 1rem 0 0 0;
          border-radius: var(--radius-md);
          background: rgba(196, 91, 91, 0.1);
          color: var(--color-status-error);
          font-size: var(--font-size-sm);
        }

        .export-preview {
          margin-top: 1rem;
        }

        .export-preview summary {
          cursor: pointer;
          color: var(--color-text-link);
          font-size: var(--font-size-sm);
          margin-bottom: 0.5rem;
        }

        .export-preview pre {
          padding: 1rem;
          background: var(--color-bg-tertiary);
          border-radius: var(--radius-md);
          overflow-x: auto;
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
          margin-bottom: 1rem;
          color: var(--color-text-primary);
        }

        .checkbox-label input {
          cursor: pointer;
        }

        .rules-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin: 1rem 0;
        }

        .rule-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem;
          background: var(--color-bg-tertiary);
          border-radius: var(--radius-md);
          border: 1px solid var(--color-border-secondary);
        }

        .rule-item .checkbox-label {
          margin-bottom: 0;
        }

        .add-rule-form {
          margin-top: 1.5rem;
          padding-top: 1.5rem;
          border-top: 1px solid var(--color-border-secondary);
        }

        .form-row {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
          align-items: center;
        }

        .form-row input,
        .form-row select {
          padding: 0.5rem 0.75rem;
          border: 1px solid var(--color-border-primary);
          border-radius: var(--radius-md);
          background: var(--color-bg-tertiary);
          color: var(--color-text-primary);
          font-size: var(--font-size-sm);
        }

        .form-row input:focus,
        .form-row select:focus {
          outline: none;
          border-color: var(--color-accent-primary);
          box-shadow: 0 0 0 2px var(--color-surface-selected);
        }
      `}</style>
    </div>
  );
}

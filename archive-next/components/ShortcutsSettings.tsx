"use client";

import { useEffect, useState } from "react";
import { RotateCcw, Keyboard } from "lucide-react";
import {
  getShortcut,
  updateShortcut,
  resetShortcuts,
  getAllShortcuts,
  formatShortcutDisplay,
  type ShortcutKey
} from "@/lib/keyboard-shortcuts";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLocale } from "@/lib/i18n/LocaleProvider";

type RecordingKey = ShortcutKey | null;

export default function ShortcutsSettings() {
  const { t } = useLocale();
  const copy = t.settings.shortcuts;
  const dialogs = useConfirmDialog();
  const [shortcuts, setShortcuts] = useState<ReturnType<typeof getAllShortcuts> | null>(null);
  const [recordingKey, setRecordingKey] = useState<RecordingKey>(null);
  const [recordedBinding, setRecordedBinding] = useState<any>(null);

  useEffect(() => {
    setShortcuts(getAllShortcuts());

    const handleUpdate = () => {
      setShortcuts(getAllShortcuts());
    };

    window.addEventListener("archive:shortcuts-changed", handleUpdate);
    return () => window.removeEventListener("archive:shortcuts-changed", handleUpdate);
  }, []);

  const handleStartRecording = (key: ShortcutKey) => {
    setRecordingKey(key);
    setRecordedBinding(null);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!recordingKey) return;

    event.preventDefault();
    event.stopPropagation();

    // Don't record modifier-only keys
    if (["Control", "Meta", "Shift", "Alt"].includes(event.key)) {
      return;
    }

    const binding = {
      key: event.key,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      shiftKey: event.shiftKey,
      altKey: event.altKey
    };

    setRecordedBinding(binding);
  };

  const handleConfirmBinding = () => {
    if (recordingKey && recordedBinding) {
      updateShortcut(recordingKey, recordedBinding);
      setRecordingKey(null);
      setRecordedBinding(null);
      setShortcuts(getAllShortcuts());
    }
  };

  const handleCancelRecording = () => {
    setRecordingKey(null);
    setRecordedBinding(null);
  };

  const handleReset = async () => {
    const confirmed = await dialogs.confirm({
      title: copy.resetDialogTitle,
      message: copy.resetDialogMessage,
      confirmLabel: copy.resetButton,
      destructive: true
    });
    if (!confirmed) return;
    resetShortcuts();
    setShortcuts(getAllShortcuts());
    setRecordingKey(null);
    setRecordedBinding(null);
  };

  if (!shortcuts) {
    return (
      <article className="workspace-panel" aria-label={copy.panelAriaLabel}>
        <div className="workspace-panel__header">
          <div>
            <h2>{copy.title}</h2>
            <Skeleton label={copy.loading} lines={2} />
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="workspace-panel" aria-label={copy.panelAriaLabel}>
      <div className="workspace-panel__header">
        <div>
          <h2>{copy.title}</h2>
          <p>{copy.description}</p>
        </div>
        <button
          type="button"
          className="button button-secondary"
          onClick={handleReset}
          title={copy.resetTitle}
        >
          <RotateCcw size={16} aria-hidden="true" />
          {copy.resetButton}
        </button>
      </div>

      <div className="stack">
        <div className="shortcuts-list" aria-label={copy.shortcutsListAriaLabel}>
          {Object.entries(shortcuts).map(([key, { binding }]) => {
            const isRecording = recordingKey === key;
            const label = copy.labels[key as ShortcutKey];

            return (
              <div key={key} className="shortcut-item">
                <div className="shortcut-info">
                  <strong>{label}</strong>
                  <small className="mono-text">{key}</small>
                </div>

                {isRecording ? (
                  <div
                    className="shortcut-recorder"
                    onKeyDown={handleKeyDown}
                    tabIndex={0}
                    role="region"
                    aria-label={copy.recorderAriaLabel}
                  >
                    <div className="recorder-prompt">
                      <Keyboard size={16} aria-hidden="true" />
                      <span>{copy.recorderPrompt}</span>
                    </div>

                    {recordedBinding && (
                      <div className="recorder-preview">
                        <span className="badge">{formatShortcutDisplay(recordedBinding)}</span>
                        <div className="recorder-actions">
                          <button
                            type="button"
                            className="button button-primary"
                            onClick={handleConfirmBinding}
                          >
                            {copy.saveButton}
                          </button>
                          <button
                            type="button"
                            className="button button-secondary"
                            onClick={handleCancelRecording}
                          >
                            {copy.cancelButton}
                          </button>
                        </div>
                      </div>
                    )}

                    {!recordedBinding && (
                      <button
                        type="button"
                        className="button button-secondary"
                        onClick={handleCancelRecording}
                      >
                        {copy.cancelButton}
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    className="shortcut-badge"
                    onClick={() => handleStartRecording(key as ShortcutKey)}
                    title={copy.changeShortcutTitle}
                  >
                    {formatShortcutDisplay(binding)}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="helper-text">
          {copy.modifierHint}
        </div>
      </div>
    </article>
  );
}

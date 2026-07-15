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

type RecordingKey = ShortcutKey | null;

export default function ShortcutsSettings() {
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
      title: "إعادة تعيين الاختصارات",
      message: "إعادة تعيين جميع اختصارات لوحة المفاتيح إلى الافتراضية؟ ستفقد أي اختصارات خصصتها.",
      confirmLabel: "إعادة تعيين",
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
      <article className="workspace-panel" aria-label="إعدادات اختصارات لوحة المفاتيح">
        <div className="workspace-panel__header">
          <div>
            <h2>اختصارات لوحة المفاتيح</h2>
            <Skeleton label="جاري تحميل الاختصارات..." lines={2} />
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="workspace-panel" aria-label="إعدادات اختصارات لوحة المفاتيح">
      <div className="workspace-panel__header">
        <div>
          <h2>اختصارات لوحة المفاتيح</h2>
          <p>خصص اختصارات لوحة المفاتيح لتسريع سير عملك. اضغط على الاختصار لإعادة تعيين المفاتيح.</p>
        </div>
        <button
          type="button"
          className="button button-secondary"
          onClick={handleReset}
          title="إعادة تعيين جميع الاختصارات إلى الافتراضية"
        >
          <RotateCcw size={16} aria-hidden="true" />
          إعادة تعيين
        </button>
      </div>

      <div className="stack">
        <div className="shortcuts-list" aria-label="قائمة الاختصارات">
          {Object.entries(shortcuts).map(([key, { label, binding }]) => {
            const isRecording = recordingKey === key;

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
                    aria-label="مسجل الاختصار"
                  >
                    <div className="recorder-prompt">
                      <Keyboard size={16} aria-hidden="true" />
                      <span>اضغط على المفاتيح...</span>
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
                            حفظ
                          </button>
                          <button
                            type="button"
                            className="button button-secondary"
                            onClick={handleCancelRecording}
                          >
                            إلغاء
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
                        إلغاء
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    className="shortcut-badge"
                    onClick={() => handleStartRecording(key as ShortcutKey)}
                    title="انقر لإعادة تعيين"
                  >
                    {formatShortcutDisplay(binding)}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="helper-text">
          💡 لا يمكن حفظ الاختصارات إلا عندما تتضمن مفتاح تعديل واحد على الأقل (Ctrl أو Cmd أو Shift أو Alt).
        </div>
      </div>
    </article>
  );
}

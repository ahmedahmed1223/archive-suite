import * as React from "react";
import {
  Link2,
  Magnet,
  MousePointer2,
  Redo2,
  Scissors,
  Undo2,
  Unlink2
} from "lucide-react";

function ToolButton({ label, icon: Icon, pressed, disabled, onClick }) {
  return (
    <div className="tooltip tooltip-bottom" data-tip={label}>
      <button
        type="button"
        className={`btn btn-ghost btn-xs btn-square montage-toolstrip__button${pressed ? " btn-active" : ""}`}
        aria-label={label}
        aria-pressed={pressed === undefined ? undefined : pressed}
        disabled={disabled}
        onClick={onClick}
      >
        <Icon aria-hidden="true" className="h-4 w-4" />
      </button>
    </div>
  );
}

export function MontageToolStrip({
  preferences = {},
  selectedTool = "select",
  onPreferencesChange,
  onAction,
  canUndo = false,
  canRedo = false
}) {
  const [activeTool, setActiveTool] = React.useState(selectedTool);
  React.useEffect(() => setActiveTool(selectedTool), [selectedTool]);

  const updatePreferences = (patch) => onPreferencesChange?.({ ...preferences, ...patch });
  const chooseTool = (tool) => {
    setActiveTool(tool);
    onAction?.({ type: "tool.select", tool });
  };

  return (
    <div className="montage-toolstrip">
      <div className="montage-toolstrip__group" aria-label="السجل">
        <ToolButton label="تراجع" icon={Undo2} disabled={!canUndo} onClick={() => onAction?.({ type: "history.undo" })} />
        <ToolButton label="إعادة" icon={Redo2} disabled={!canRedo} onClick={() => onAction?.({ type: "history.redo" })} />
      </div>
      <div className="montage-toolstrip__group" aria-label="أدوات التحرير">
        <ToolButton label="أداة التحديد" icon={MousePointer2} pressed={activeTool === "select"} onClick={() => chooseTool("select")} />
        <ToolButton label="أداة القطع" icon={Scissors} pressed={activeTool === "blade"} onClick={() => chooseTool("blade")} />
      </div>
      <div className="montage-toolstrip__group" aria-label="سلوك الخط الزمني">
        <ToolButton
          label="الالتقاط المغناطيسي"
          icon={Magnet}
          pressed={preferences.snapping !== false}
          onClick={() => updatePreferences({ snapping: preferences.snapping === false })}
        />
        <ToolButton
          label="ربط الصوت والفيديو"
          icon={preferences.linkAudioVideo === false ? Unlink2 : Link2}
          pressed={preferences.linkAudioVideo !== false}
          onClick={() => updatePreferences({ linkAudioVideo: preferences.linkAudioVideo === false })}
        />
        <label className="montage-toolstrip__select-label">
          <span>Ripple</span>
          <select
            aria-label="نطاق Ripple"
            className="select select-bordered select-xs montage-toolstrip__select"
            value={preferences.rippleMode || "primary"}
            onChange={(event) => updatePreferences({ rippleMode: event.target.value })}
          >
            <option value="off">متوقف</option>
            <option value="primary">المسار الأساسي</option>
            <option value="all-unlocked">كل المسارات المفتوحة</option>
          </select>
        </label>
      </div>
    </div>
  );
}

export default MontageToolStrip;

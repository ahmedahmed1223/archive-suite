import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  Headphones,
  Lock,
  Magnet,
  Trash2,
  Unlock,
  Volume2,
  VolumeX
} from "lucide-react";

function HeaderButton({ label, icon: Icon, active, disabled, onClick }) {
  return (
    <div className="tooltip tooltip-left" data-tip={label}>
      <button
        type="button"
        className={`btn btn-ghost btn-xs btn-square multitrack-header__button${active ? " btn-active" : ""}`}
        aria-label={label}
        aria-pressed={active === undefined ? undefined : active}
        disabled={disabled}
        onClick={onClick}
      >
        <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function TrackHeader({ track, index, total, onCommand, onRequestDelete }) {
  const [name, setName] = React.useState(track.name);
  React.useEffect(() => setName(track.name), [track.name]);

  const patch = (nextPatch) => onCommand?.({ type: "track.patch", trackId: track.id, patch: nextPatch });
  const commitName = () => {
    const clean = name.trim();
    if (!clean || clean === track.name) return;
    patch({ name: clean });
  };

  return (
    <div className="multitrack-header" data-track-type={track.type}>
      <div className="multitrack-header__identity">
        <span className="multitrack-header__code">{track.id.toUpperCase()}</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          onBlur={commitName}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") { setName(track.name); event.currentTarget.blur(); }
          }}
          aria-label={`اسم مسار ${track.name}`}
          className="multitrack-header__name"
        />
      </div>
      <div className="multitrack-header__controls">
        <HeaderButton label={`${track.hidden ? "إظهار" : "إخفاء"} مسار ${track.name}`} icon={track.hidden ? EyeOff : Eye} active={!track.hidden} onClick={() => patch({ hidden: !track.hidden })} />
        {track.type === "audio" ? (
          <>
            <HeaderButton label={`${track.muted ? "إلغاء كتم" : "كتم"} مسار ${track.name}`} icon={track.muted ? VolumeX : Volume2} active={track.muted} onClick={() => patch({ muted: !track.muted })} />
            <HeaderButton label={`${track.solo ? "إلغاء عزل" : "عزل"} مسار ${track.name}`} icon={Headphones} active={track.solo} onClick={() => patch({ solo: !track.solo })} />
          </>
        ) : null}
        <HeaderButton label={`${track.locked ? "فتح" : "قفل"} مسار ${track.name}`} icon={track.locked ? Unlock : Lock} active={track.locked} onClick={() => patch({ locked: !track.locked })} />
        {track.type === "video" ? <HeaderButton label={`المسار المغناطيسي ${track.name}`} icon={Magnet} active={track.magnetic} onClick={() => patch({ magnetic: !track.magnetic })} /> : null}
        <HeaderButton label={`نقل مسار ${track.name} لأعلى`} icon={ArrowUp} disabled={index === 0} onClick={() => onCommand?.({ type: "track.reorder", trackId: track.id, direction: -1 })} />
        <HeaderButton label={`نقل مسار ${track.name} لأسفل`} icon={ArrowDown} disabled={index === total - 1} onClick={() => onCommand?.({ type: "track.reorder", trackId: track.id, direction: 1 })} />
        <HeaderButton label={`حذف مسار ${track.name}`} icon={Trash2} onClick={() => onRequestDelete?.(track)} />
      </div>
    </div>
  );
}

export default TrackHeader;

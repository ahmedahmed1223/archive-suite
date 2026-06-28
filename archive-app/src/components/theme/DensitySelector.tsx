import { DENSITY_OPTIONS } from "../../features/theme/themePresets.js";

function DensityPreview({ densityId }: { densityId: string }) {
  const gaps: Record<string, string[]> = {
    compact: ["h-1.5", "h-1", "h-1"],
    balanced: ["h-2.5", "h-1.5", "h-1.5"],
    comfortable: ["h-3.5", "h-2", "h-2"],
  };
  const bars = gaps[densityId] ?? gaps.balanced;

  return (
    <div className="flex w-full flex-col gap-0.5 px-1">
      {bars.map((cls, idx) => (
        <div
          key={idx}
          className={`w-full rounded-sm bg-current opacity-25 ${cls}`}
        />
      ))}
    </div>
  );
}

/**
 * Three-card density picker.
 */
export function DensitySelector({
  density,
  onChange,
}: {
  density: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="كثافة العرض">
      {DENSITY_OPTIONS.map((option) => {
        const isSelected = density === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(option.id)}
            className={[
              "flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-all",
              "hover:border-primary/60 hover:bg-base-200/60",
              isSelected
                ? "border-primary bg-primary/10 text-primary"
                : "border-base-300/40 bg-base-200/30 text-base-content/70",
            ].join(" ")}
          >
            <div className="flex h-10 w-full items-center justify-center rounded-lg bg-base-300/30 px-2 py-1.5">
              <DensityPreview densityId={option.id} />
            </div>

            <span className="text-sm font-semibold">{option.label}</span>
            <span className="text-xs opacity-70">{option.description}</span>
          </button>
        );
      })}
    </div>
  );
}

export default DensitySelector;

interface ThemePreview {
  id: string;
  label: string;
  tone: string;
  bg: string;
  fg: string;
  accent: string;
}

interface ThemePreviewCardProps {
  theme: ThemePreview;
  selected: boolean;
  onSelect: (id: string) => void;
}

/**
 * Small card displaying a DaisyUI theme with color swatches.
 */
export function ThemePreviewCard({ theme, selected, onSelect }: ThemePreviewCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(theme.id)}
      aria-pressed={selected}
      aria-label={`اختيار سمة ${theme.label}`}
      className={[
        "group flex flex-col gap-2 rounded-xl border p-2.5 text-right transition-all",
        "hover:border-primary/60 hover:shadow-sm",
        selected
          ? "border-primary ring-2 ring-primary/40"
          : "border-base-300/40",
      ].join(" ")}
      style={{ background: theme.bg, color: theme.fg }}
    >
      <div className="flex items-center gap-1">
        <span
          className="h-4 w-4 rounded-full border border-black/10"
          style={{ background: theme.bg }}
          title="الخلفية"
        />
        <span
          className="h-4 w-4 rounded-full border border-black/10"
          style={{ background: theme.fg }}
          title="النص"
        />
        <span
          className="h-4 w-4 rounded-full border border-black/10"
          style={{ background: theme.accent }}
          title="التمييز"
        />
      </div>

      <div className="min-w-0">
        <p className="truncate text-xs font-bold" style={{ color: theme.fg }}>
          {theme.label}
        </p>
        <p
          className="truncate text-[10px] opacity-70"
          style={{ color: theme.fg }}
        >
          {theme.tone}
        </p>
      </div>
    </button>
  );
}

export default ThemePreviewCard;

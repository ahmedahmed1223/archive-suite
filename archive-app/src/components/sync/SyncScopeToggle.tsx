interface SyncScopeToggleProps {
  label: string;
  included: boolean;
  onToggle: (next: boolean) => void;
  disabled?: boolean;
}

export default function SyncScopeToggle({ label, included, onToggle, disabled = false }: SyncScopeToggleProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className="text-sm text-gray-700">{label}</span>
      <button
        role="switch"
        aria-checked={included}
        disabled={disabled}
        onClick={() => !disabled && onToggle(!included)}
        className={[
          "relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
          included ? "bg-blue-600" : "bg-gray-300",
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
        ].join(" ")}
      >
        <span
          className={[
            "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
            included ? "translate-x-4" : "translate-x-0",
          ].join(" ")}
        />
      </button>
    </div>
  );
}

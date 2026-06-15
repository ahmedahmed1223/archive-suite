const BADGE_CONFIG = {
  local: { dot: "bg-gray-400", label: "محلي" },
  cloud: { dot: "bg-blue-500", label: "سحابي" },
  syncing: { dot: "bg-green-500 animate-pulse", label: "جاري..." },
  conflict: { dot: "bg-orange-500", label: "تعارض" },
  excluded: { dot: "bg-gray-300 opacity-50", label: "مستثنى" },
};

export default function PerItemSyncBadge({ status }) {
  const config = BADGE_CONFIG[status] ?? BADGE_CONFIG.local;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-gray-600">
      <span className={`w-2 h-2 rounded-full shrink-0 ${config.dot}`} />
      {config.label}
    </span>
  );
}

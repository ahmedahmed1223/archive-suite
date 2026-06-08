/**
 * Shows who else is viewing the same record — avatars/initials.
 */
export function PresenceIndicator({ viewers = [], currentUserId }) {
  // Filter out current user
  const others = viewers.filter(v => v.userId !== currentUserId);
  if (others.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5" aria-label={`${others.length} مستخدم يعرض هذا العنصر`}>
      <div className="flex -space-x-1 rtl:space-x-reverse">
        {others.slice(0, 3).map(v => (
          <div key={v.userId}
            title={v.username}
            className="w-6 h-6 rounded-full bg-emerald-700 border-2 border-gray-900 flex items-center justify-center text-xs text-white font-medium"
          >
            {(v.username || "?")[0].toUpperCase()}
          </div>
        ))}
        {others.length > 3 && (
          <div className="w-6 h-6 rounded-full bg-gray-700 border-2 border-gray-900 flex items-center justify-center text-xs text-gray-300">
            +{others.length - 3}
          </div>
        )}
      </div>
      <span className="text-xs text-gray-500">
        {others.length === 1 ? "يعرض" : "يعرضون"}
      </span>
    </div>
  );
}

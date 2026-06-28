export interface Viewer {
  userId: string;
  username?: string;
}

export interface PresenceIndicatorProps {
  viewers?: Viewer[];
  currentUserId?: string;
}

/**
 * Shows who else is viewing the same record - avatars/initials.
 */
export function PresenceIndicator({ viewers = [], currentUserId }: PresenceIndicatorProps) {
  const others = viewers.filter((v) => v.userId !== currentUserId);
  if (others.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5" aria-label={`${others.length} مستخدم يعرض هذا العنصر`}>
      <div className="flex -space-x-1 rtl:space-x-reverse">
        {others.slice(0, 3).map((v) => (
          <div
            key={v.userId}
            title={v.username}
            className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-gray-900 bg-emerald-700 text-xs font-medium text-white"
          >
            {(v.username?.trim() || "?").charAt(0).toUpperCase()}
          </div>
        ))}
        {others.length > 3 ? (
          <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-gray-900 bg-gray-700 text-xs text-gray-300">
            +{others.length - 3}
          </div>
        ) : null}
      </div>
      <span className="text-xs text-gray-500">{others.length === 1 ? "يعرض" : "يعرضون"}</span>
    </div>
  );
}

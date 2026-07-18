export function recordPresenceRoom(recordId: string) {
  return `record:${recordId}`;
}

export function presenceInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0]?.[0] ?? "؟";
  return `${parts[0][0]}${parts.at(-1)?.[0] ?? ""}`;
}

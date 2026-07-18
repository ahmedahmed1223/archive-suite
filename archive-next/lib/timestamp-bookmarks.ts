export function bookmarkNotes<T extends { timestampSeconds: number | null }>(notes: readonly T[]): T[] {
  return notes
    .filter((note): note is T & { timestampSeconds: number } => typeof note.timestampSeconds === "number" && Number.isFinite(note.timestampSeconds))
    .sort((left, right) => left.timestampSeconds - right.timestampSeconds);
}

export function formatBookmarkTime(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

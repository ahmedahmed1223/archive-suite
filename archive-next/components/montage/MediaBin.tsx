"use client";

import type { MontageSourceRef } from "@/lib/montage-editor";

export type MaterialBinItem = {
  id: string;
  name: string;
  durationSeconds: number;
  source: MontageSourceRef;
};

type MediaBinProps = {
  items: MaterialBinItem[];
  selectedId: string | null;
  onSelect: (item: MaterialBinItem) => void;
  onAddToTimeline?: (item: MaterialBinItem) => void;
};

/** V1.5 Task 5: accessible material bin — native list semantics, keyboard first. */
export default function MediaBin({ items, selectedId, onSelect, onAddToTimeline }: MediaBinProps) {
  return (
    <section aria-label="مخزن المواد" className="media-bin">
      <ul role="listbox" aria-label="المواد المتاحة" className="media-bin__list">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              role="option"
              aria-selected={item.id === selectedId}
              className="media-bin__item"
              onClick={() => onSelect(item)}
              onDoubleClick={() => onAddToTimeline?.(item)}
            >
              <span dir="auto" className="media-bin__name">{item.name}</span>
              <span dir="ltr" className="media-bin__duration">
                {Math.round(item.durationSeconds)}ث
              </span>
            </button>
          </li>
        ))}
        {items.length === 0 && <li className="media-bin__empty">لا توجد مواد بعد</li>}
      </ul>
    </section>
  );
}

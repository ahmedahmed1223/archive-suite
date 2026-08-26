"use client";

import type { MontageSourceRef } from "@/lib/montage-editor";

export type MaterialBinItem = {
  id: string;
  name: string;
  durationSeconds: number;
  source: MontageSourceRef;
};

export type MediaBinCopy = {
  binAriaLabel: string;
  listLabel: string;
  emptyBin: string;
};

type MediaBinProps = {
  items: MaterialBinItem[];
  selectedId: string | null;
  onSelect: (item: MaterialBinItem) => void;
  onAddToTimeline?: (item: MaterialBinItem) => void;
  copy: MediaBinCopy;
};

/** V1.5 Task 5: accessible material bin — native list semantics, keyboard first. */
export default function MediaBin({ items, selectedId, onSelect, onAddToTimeline, copy }: MediaBinProps) {
  return (
    <section aria-label={copy.binAriaLabel} className="media-bin">
      <ul role="listbox" aria-label={copy.listLabel} className="media-bin__list">
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
                {Math.round(item.durationSeconds)}s
              </span>
            </button>
          </li>
        ))}
        {items.length === 0 && <li className="media-bin__empty">{copy.emptyBin}</li>}
      </ul>
    </section>
  );
}

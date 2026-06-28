import { Gauge } from "lucide-react";

export interface RelatedContentItem {
  id: string;
  title?: string;
}

export interface RelatedContentEntry {
  item: RelatedContentItem;
  percent: number;
  reason?: string;
}

export interface RelatedContentPanelProps {
  items?: RelatedContentEntry[];
  onOpenItem?: (item: RelatedContentItem) => void;
}

export function RelatedContentPanel({ items = [], onOpenItem }: RelatedContentPanelProps) {
  if (!items.length) return null;

  return (
    <section>
      <h2 className="flex items-center gap-2 text-base font-bold text-white">
        <Gauge className="h-4 w-4 va-accent-text" />
        مواد قد ترتبط بهذا السياق
      </h2>
      <ul className="mt-3 space-y-2">
        {items.map((related) => (
          <li key={related.item.id}>
            <button
              type="button"
              onClick={() => onOpenItem?.(related.item)}
              className="w-full rounded-xl va-surface-subtle border p-3 text-right transition-colors hover:border-emerald-500/25"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
                  {related.item.title || "بدون عنوان"}
                </span>
                <span dir="ltr" className="shrink-0 font-mono text-[10px] va-accent-text">
                  {`${related.percent}%`}
                </span>
              </div>
              {related.reason ? <p className="mt-1 text-[11px] text-gray-500">{related.reason}</p> : null}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

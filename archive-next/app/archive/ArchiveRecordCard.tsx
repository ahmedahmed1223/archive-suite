"use client";

import { useRef, useState } from "react";
import { ContextMenu, type ContextMenuPosition } from "@/components/ui/ContextMenu";
import type { ArchiveRecord } from "@/lib/archive-api";
import { formatDate, type ArchiveItemSize, type SelectClickModifiers } from "./page";

const descriptorCompletionLabels = {
  green: { icon: "🟢", label: "مكتمل التوصيف" },
  yellow: { icon: "🟡", label: "يحتاج استكمالًا" },
  red: { icon: "🔴", label: "توصيف ناقص" }
} as const;

const PLAIN_CLICK_MODIFIERS: SelectClickModifiers = { shiftKey: false, ctrlKey: false, metaKey: false };

interface ArchiveRecordCardProps {
  record: ArchiveRecord;
  itemSize: ArchiveItemSize;
  isSelected: boolean;
  onSelectClick: (recordId: string, modifiers: SelectClickModifiers) => void;
  onPreview: (recordId: string) => void;
}

export function ArchiveRecordCard({ record, itemSize, isSelected, onSelectClick, onPreview }: ArchiveRecordCardProps) {
  const titleLinkRef = useRef<HTMLAnchorElement>(null);
  const [menuPosition, setMenuPosition] = useState<ContextMenuPosition | null>(null);
  const href = `/archive/${encodeURIComponent(record.id)}`;

  const closeMenu = () => setMenuPosition(null);

  return (
    <article
      key={record.id}
      className="record-card"
      data-size={itemSize}
      data-selected={isSelected ? "true" : "false"}
      role="listitem"
      onMouseEnter={() => onPreview(record.id)}
      onContextMenu={(e) => {
        e.preventDefault();
        setMenuPosition({ x: e.clientX, y: e.clientY });
      }}
    >
      <div className="record-card__select">
        <input
          type="checkbox"
          aria-label={`تحديد ${record.title || "السجل"}`}
          checked={isSelected}
          onClick={(e) => {
            e.preventDefault();
            onSelectClick(record.id, e);
          }}
          onChange={() => {}}
        />
      </div>
      <div className="record-card__body">
        <div className="panel-title-row">
          <h2>
            <a ref={titleLinkRef} href={href} className="text-accent">
              {record.title || "بدون عنوان"}
            </a>
          </h2>
          <button type="button" className="badge" onClick={() => onPreview(record.id)}>
            معاينة
          </button>
        </div>
        {record.description ? (
          <p className="record-card__description">
            {record.description.substring(0, itemSize === "large" ? 220 : 130)}
            {record.description.length > (itemSize === "large" ? 220 : 130) ? "..." : ""}
          </p>
        ) : null}
        <div className="record-meta">
          {record.store ? <span className="badge">{record.store}</span> : null}
          {record.type ? <span className="badge">{record.type}</span> : null}
          {record.subtype ? <span className="badge">{record.subtype}</span> : null}
          {record.descriptorCompletion ? (
            <span
              className="badge"
              aria-label={`اكتمال التوصيف: ${descriptorCompletionLabels[record.descriptorCompletion.status].label}`}
              title={`اكتمال التوصيف ${record.descriptorCompletion.complete} من ${record.descriptorCompletion.total}`}
            >
              {descriptorCompletionLabels[record.descriptorCompletion.status].icon}{" "}
              {descriptorCompletionLabels[record.descriptorCompletion.status].label}
            </span>
          ) : null}
          <time className="created-at">{formatDate(record.updatedAt || record.createdAt)}</time>
        </div>
        {record.tags && record.tags.length > 0 ? (
          <div className="tags">
            {record.tags.slice(0, itemSize === "large" ? 6 : 3).map((tag) => (
              <span key={tag} className="tag">
                {tag}
              </span>
            ))}
            {record.tags.length > (itemSize === "large" ? 6 : 3) ? (
              <span className="tag muted">+{record.tags.length - (itemSize === "large" ? 6 : 3)}</span>
            ) : null}
          </div>
        ) : null}
      </div>

      {menuPosition ? (
        <ContextMenu
          position={menuPosition}
          onClose={closeMenu}
          items={[
            {
              // reuses the exact title-link navigation — no new handler
              label: "فتح",
              onSelect: () => titleLinkRef.current?.click()
            },
            {
              // reuses the exact same href, just opened in a new tab
              label: "فتح في تبويب جديد",
              onSelect: () => window.open(href, "_blank", "noopener,noreferrer")
            },
            {
              // reuses the existing selection handler (V1-748), as a plain click
              label: "تحديد",
              onSelect: () => onSelectClick(record.id, PLAIN_CLICK_MODIFIERS)
            }
            // مشاركة / حذف intentionally omitted: no per-card handler exists yet
            // (only bulk-selection share/delete flows), inventing one is out of scope.
          ]}
        />
      ) : null}
    </article>
  );
}

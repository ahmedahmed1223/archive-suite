"use client";

import { useRef, useState } from "react";
import { ContextMenu, type ContextMenuPosition } from "@/components/ui/ContextMenu";
import type { ArchiveRecord } from "@/lib/archive-api";
import { deriveRecordStatus } from "@/lib/record-status";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { formatDate, type ArchiveItemSize } from "./archive-filters";
import type { SelectClickModifiers } from "./selection";

const PLAIN_CLICK_MODIFIERS: SelectClickModifiers = { shiftKey: false, ctrlKey: false, metaKey: false };

interface ArchiveRecordCardProps {
  record: ArchiveRecord;
  itemSize: ArchiveItemSize;
  isSelected: boolean;
  canEdit: boolean;
  onSelectClick: (recordId: string, modifiers: SelectClickModifiers) => void;
  onPreview: (recordId: string) => void;
  onRename: (recordId: string, newTitle: string) => void;
}

export function ArchiveRecordCard({ record, itemSize, isSelected, canEdit, onSelectClick, onPreview, onRename }: ArchiveRecordCardProps) {
  const { t, locale } = useLocale();
  const titleLinkRef = useRef<HTMLAnchorElement>(null);
  const [menuPosition, setMenuPosition] = useState<ContextMenuPosition | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(record.title || "");
  const href = `/archive/${encodeURIComponent(record.id)}`;
  const status = deriveRecordStatus(record, locale);

  const closeMenu = () => setMenuPosition(null);

  const startEditingTitle = () => {
    setTitleDraft(record.title || "");
    setIsEditingTitle(true);
  };

  const commitTitleEdit = () => {
    setIsEditingTitle((wasEditing) => {
      if (wasEditing) {
        const trimmed = titleDraft.trim();
        if (trimmed && trimmed !== record.title) {
          onRename(record.id, trimmed);
        }
      }
      return false;
    });
  };

  return (
    <article
      key={record.id}
      className="record-card"
      data-size={itemSize}
      data-selected={isSelected ? "true" : "false"}
      data-record-id={record.id}
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
          aria-label={t.pages.archiveRecordCard.selectRecord.replace("{title}", record.title || t.pages.archiveRecordCard.fallbackRecordLabel)}
          checked={isSelected}
          onClick={(e) => {
            onSelectClick(record.id, {
              shiftKey: e.shiftKey,
              ctrlKey: e.ctrlKey || (isSelected && !e.shiftKey && !e.metaKey),
              metaKey: e.metaKey
            });
          }}
          onChange={() => {}}
        />
      </div>
      <div className="record-card__body">
        <div className="panel-title-row">
          <h2>
            {isEditingTitle ? (
              <input
                className="record-card__title-input"
                aria-label={t.pages.archiveRecordCard.titleInputLabel}
                value={titleDraft}
                autoFocus
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={commitTitleEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitTitleEdit();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    setIsEditingTitle(false);
                  }
                }}
              />
            ) : (
              <a
                ref={titleLinkRef}
                href={href}
                className="text-accent"
                title={canEdit ? t.pages.archiveRecordCard.doubleClickRenameHint : undefined}
                onDoubleClick={canEdit ? (e) => {
                  e.preventDefault();
                  startEditingTitle();
                } : undefined}
              >
                {record.title || t.pages.archiveRecordCard.untitled}
              </a>
            )}
          </h2>
          <button type="button" className="badge" onClick={() => onPreview(record.id)}>
            {t.pages.archiveRecordCard.preview}
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
          <span className="badge" data-record-status={status.kind} aria-label={`${status.label}: ${status.reason}`} title={status.reason}>
            {status.label}
          </span>
          <time className="created-at">{formatDate(record.updatedAt || record.createdAt, t.pages.archiveRecordCard.notSpecified)}</time>
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
              label: t.pages.archiveRecordCard.contextMenuOpen,
              onSelect: () => titleLinkRef.current?.click()
            },
            {
              // reuses the exact same href, just opened in a new tab
              label: t.pages.archiveRecordCard.contextMenuOpenNewTab,
              onSelect: () => window.open(href, "_blank", "noopener,noreferrer")
            },
            {
              // reuses the existing selection handler (V1-748), as a plain click
              label: t.pages.archiveRecordCard.contextMenuSelect,
              onSelect: () => onSelectClick(record.id, PLAIN_CLICK_MODIFIERS)
            }
            // Share and delete are intentionally omitted: no per-card handler exists yet.
            // (only bulk-selection share/delete flows), inventing one is out of scope.
          ]}
        />
      ) : null}
    </article>
  );
}

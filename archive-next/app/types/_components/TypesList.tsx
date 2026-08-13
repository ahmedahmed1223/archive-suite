"use client";

import { Button } from "@/components/ui/Button";
import EmptyState from "@/components/EmptyState";
import type { ArchiveType } from "@/lib/archive-api";
import { iconRegistry } from "@/lib/icon-registry";
import { useLocale } from "@/lib/i18n/LocaleProvider";

type TypesListProps = {
  types: ArchiveType[];
  selectedTypeId: string | null;
  deletingTypeId: string | null;
  onSelectType: (id: string) => void;
  onEditType: (type: ArchiveType) => void;
  onDeleteType: (type: ArchiveType) => void;
  onCreateType: () => void;
};

export default function TypesList({
  types,
  selectedTypeId,
  deletingTypeId,
  onSelectType,
  onEditType,
  onDeleteType,
  onCreateType,
}: TypesListProps) {
  const { t } = useLocale();
  const copy = t.pages.types;
  if (types.length === 0) {
    return (
      <EmptyState
        title={copy.list.emptyTitle}
        description={copy.list.emptyDescription}
        actions={<Button type="button" variant="primary" onClick={onCreateType}>{copy.list.createFirst}</Button>}
      />
    );
  }

  return (
    <ul className="types-list" aria-label={copy.list.ariaLabel}>
      {types.map((type) => {
        const isSelected = selectedTypeId === type.id;
        const isDeleting = deletingTypeId === type.id;
        const iconName = type.icon;
        const Icon = iconName ? iconRegistry[iconName] : undefined;

        return (
          <li className="type-list-item" data-selected={isSelected ? "true" : "false"} key={type.id}>
            <button
              className="type-list-item__select"
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelectType(type.id)}
            >
              <span className="type-list-item__mark" aria-hidden="true">
                {Icon ? <Icon size={20} strokeWidth={2} /> : type.name.slice(0, 1)}
              </span>
              <span className="type-list-item__body">
                <strong>{type.name}</strong>
                <span className="type-list-item__id" dir="ltr">{type.id}</span>
                <span className="type-list-item__summary">{copy.list.fields.replace("{count}", String(type.fields.length))}</span>
              </span>
            </button>
            <div className="type-list-item__actions" aria-label={copy.list.actions.replace("{name}", type.name)}>
              <Button type="button" size="sm" onClick={() => onEditType(type)}>{copy.edit}</Button>
              <Button
                type="button"
                size="sm"
                variant="danger"
                disabled={isDeleting}
                onClick={() => onDeleteType(type)}
              >
                {isDeleting ? copy.list.deleting : copy.delete}
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

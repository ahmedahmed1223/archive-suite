"use client";

import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import EmptyState from "@/components/EmptyState";
import type { ArchiveType } from "@/lib/archive-api";
import { getTypeIcon } from "@/lib/type-icons";

const iconRegistry = Icons as unknown as Record<string, LucideIcon>;

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
  if (types.length === 0) {
    return (
      <EmptyState
        title="لا توجد أنواع معرفة بعد"
        description="أنشئ نوعًا لتحديد حقول البيانات والصلاحيات التي يحتاجها فريق الأرشفة."
        actions={<Button type="button" variant="primary" onClick={onCreateType}>إنشاء أول نوع</Button>}
      />
    );
  }

  return (
    <ul className="types-list" aria-label="الأنواع المعرفة">
      {types.map((type) => {
        const isSelected = selectedTypeId === type.id;
        const isDeleting = deletingTypeId === type.id;
        const iconName = getTypeIcon(type.id);
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
                <span className="type-list-item__summary">{type.fields.length} {type.fields.length === 1 ? "حقل" : "حقول"}</span>
              </span>
            </button>
            <div className="type-list-item__actions" aria-label={`إجراءات ${type.name}`}>
              <Button type="button" size="sm" onClick={() => onEditType(type)}>تحرير</Button>
              <Button
                type="button"
                size="sm"
                variant="danger"
                disabled={isDeleting}
                onClick={() => onDeleteType(type)}
              >
                {isDeleting ? "جارٍ الحذف…" : "حذف"}
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

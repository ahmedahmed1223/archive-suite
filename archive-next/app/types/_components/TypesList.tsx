"use client";

import { ArchiveRecord } from "@/lib/archive-api";

type TypesListProps = {
  types: ArchiveRecord[];
  selectedTypeId: string | null;
  onSelectType: (id: string) => void;
  onDeleteType: (id: string) => void;
};

export default function TypesList({
  types,
  selectedTypeId,
  onSelectType,
  onDeleteType,
}: TypesListProps) {
  if (types.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        لا توجد أنواع محددة بعد
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {types.map((type) => (
        <div
          key={type.id}
          className={`p-4 border rounded cursor-pointer transition ${
            selectedTypeId === type.id
              ? "border-blue-500 bg-blue-50"
              : "border-gray-200 hover:border-gray-300"
          }`}
          onClick={() => onSelectType(type.id as string)}
        >
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold text-lg">{type.name}</h3>
              <p className="text-sm text-gray-500">{type.id}</p>
              <p className="text-sm mt-2">
                {Array.isArray(type.fields) ? type.fields.length : 0} حقول
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteType(type.id as string);
              }}
              className="text-red-600 hover:text-red-800 text-sm"
            >
              حذف
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

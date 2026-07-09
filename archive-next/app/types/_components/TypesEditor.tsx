"use client";

import { useState } from "react";
import { ArchiveRecord } from "@/lib/archive-api";

type Field = {
  name: string;
  type: "text" | "number" | "date" | "select" | "multi" | "boolean";
  fieldAcl?: {
    view: string[];
    edit: string[];
  };
};

type TypesEditorProps = {
  onSave: (typeData: ArchiveRecord) => void;
  onCancel: () => void;
};

const ROLES = ["viewer", "editor", "admin"];
const FIELD_TYPES = ["text", "number", "date", "select", "multi", "boolean"];

export default function TypesEditor({ onSave, onCancel }: TypesEditorProps) {
  const [typeId, setTypeId] = useState("");
  const [typeName, setTypeName] = useState("");
  const [fields, setFields] = useState<Field[]>([]);
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);

  function addField() {
    setFields([
      ...fields,
      {
        name: "",
        type: "text",
        fieldAcl: {
          view: [],
          edit: [],
        },
      },
    ]);
    setEditingFieldIndex(fields.length);
  }

  function updateField(index: number, field: Field) {
    const newFields = [...fields];
    newFields[index] = field;
    setFields(newFields);
  }

  function removeField(index: number) {
    setFields(fields.filter((_, i) => i !== index));
    if (editingFieldIndex === index) {
      setEditingFieldIndex(null);
    }
  }

  function toggleFieldRole(
    fieldIndex: number,
    role: string,
    type: "view" | "edit"
  ) {
    const field = fields[fieldIndex];
    const acl = field.fieldAcl || { view: [], edit: [] };
    const roles = acl[type];
    const updated = roles.includes(role)
      ? roles.filter((r) => r !== role)
      : [...roles, role];

    updateField(fieldIndex, {
      ...field,
      fieldAcl: {
        ...acl,
        [type]: updated,
      },
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!typeId.trim() || !typeName.trim() || fields.length === 0) {
      alert("الرجاء ملء جميع الحقول المطلوبة");
      return;
    }

    const typeData: ArchiveRecord = {
      id: typeId,
      name: typeName,
      fields: fields.map((f) => ({
        ...f,
        fieldAcl: f.fieldAcl ? { view: f.fieldAcl.view, edit: f.fieldAcl.edit } : undefined,
      })),
    };

    onSave(typeData);
  }

  return (
    <div className="border rounded p-6 bg-white">
      <h2 className="text-xl font-semibold mb-6">محرر الأنواع</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium mb-2">معرف النوع</label>
          <input
            type="text"
            value={typeId}
            onChange={(e) => setTypeId(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">اسم النوع</label>
          <input
            type="text"
            value={typeName}
            onChange={(e) => setTypeName(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            required
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-4">
            <label className="block text-sm font-medium">الحقول</label>
            <button
              type="button"
              onClick={addField}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              + إضافة حقل
            </button>
          </div>

          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={index} className="border rounded p-3 bg-gray-50">
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-xs font-medium">اسم الحقل</label>
                    <input
                      type="text"
                      value={field.name}
                      onChange={(e) =>
                        updateField(index, { ...field, name: e.target.value })
                      }
                      className="w-full px-2 py-1 text-sm border rounded"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium">النوع</label>
                    <select
                      value={field.type}
                      onChange={(e) =>
                        updateField(index, {
                          ...field,
                          type: e.target.value as Field["type"],
                        })
                      }
                      className="w-full px-2 py-1 text-sm border rounded"
                    >
                      {FIELD_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="text-xs font-medium mb-2">التحكم في الوصول</div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="font-medium mb-1">يمكن العرض</p>
                    {ROLES.map((role) => (
                      <label key={role} className="flex items-center gap-2 mb-1">
                        <input
                          type="checkbox"
                          checked={field.fieldAcl?.view.includes(role) || false}
                          onChange={() =>
                            toggleFieldRole(index, role, "view")
                          }
                        />
                        {role}
                      </label>
                    ))}
                  </div>
                  <div>
                    <p className="font-medium mb-1">يمكن التعديل</p>
                    {ROLES.map((role) => (
                      <label key={role} className="flex items-center gap-2 mb-1">
                        <input
                          type="checkbox"
                          checked={field.fieldAcl?.edit.includes(role) || false}
                          onChange={() =>
                            toggleFieldRole(index, role, "edit")
                          }
                        />
                        {role}
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => removeField(index)}
                  className="text-red-600 hover:text-red-800 text-xs mt-2"
                >
                  حذف الحقل
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
          >
            حفظ
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-gray-300 text-gray-800 py-2 rounded hover:bg-gray-400"
          >
            إلغاء
          </button>
        </div>
      </form>
    </div>
  );
}

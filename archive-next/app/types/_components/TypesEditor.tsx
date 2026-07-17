"use client";

import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { FieldError, FormHint } from "@/components/ui/Form";
import type { ArchiveType, ArchiveTypeField, ArchiveTypeFieldKind } from "@/lib/archive-api";
import { clearDraft, loadDraft, saveDraft } from "@/lib/local-draft";

type TypesEditorProps = {
  initialType: ArchiveType | null;
  isSaving: boolean;
  requestError?: string;
  onSave: (typeData: ArchiveType) => Promise<void>;
  onCancel: () => void;
};

const ROLES = ["viewer", "editor", "admin"];
const FIELD_TYPES: Array<{ value: ArchiveTypeFieldKind; label: string }> = [
  { value: "text", label: "نص" },
  { value: "number", label: "رقم" },
  { value: "date", label: "تاريخ" },
  { value: "select", label: "اختيار واحد" },
  { value: "multi", label: "اختيارات متعددة" },
  { value: "boolean", label: "نعم / لا" },
];

const EMPTY_FIELD: ArchiveTypeField = {
  name: "",
  type: "text",
  fieldAcl: { view: [], edit: [] },
};

// V1-769: autosave draft, scoped to creating a NEW type — editing an existing
// type already has a stable source of truth (initialType), so restoring a
// stale draft there risks mixing content from a different type.
const NEW_TYPE_DRAFT_KEY = "types-editor-new";

interface TypeDraftData {
  typeId: string;
  typeName: string;
  fields: ArchiveTypeField[];
}

function isDraftWorthKeeping(draft: TypeDraftData): boolean {
  return Boolean(draft.typeId.trim() || draft.typeName.trim() || draft.fields.some((field) => field.name.trim()));
}

function cloneFields(fields: ArchiveTypeField[]) {
  return fields.map((field) => ({
    ...field,
    ...(field.condition ? { condition: { ...field.condition } } : {}),
    fieldAcl: {
      view: field.fieldAcl?.view ?? [],
      edit: field.fieldAcl?.edit ?? [],
    },
  }));
}

function typeIdError(typeId: string): string {
  return typeId.trim() ? "" : "أدخل معرّف النوع.";
}

function typeNameError(typeName: string): string {
  return typeName.trim() ? "" : "أدخل اسم النوع.";
}

function fieldNameError(name: string): string {
  return name.trim() ? "" : "أدخل اسمًا لهذا الحقل.";
}

function duplicateFieldIndexes(fields: ArchiveTypeField[]): Set<number> {
  const seenAt = new Map<string, number>();
  const duplicates = new Set<number>();
  fields.forEach((field, index) => {
    const name = field.name.trim();
    if (!name) return;
    const firstIndex = seenAt.get(name);
    if (firstIndex === undefined) {
      seenAt.set(name, index);
    } else {
      duplicates.add(firstIndex);
      duplicates.add(index);
    }
  });
  return duplicates;
}

function fieldConditionError(field: ArchiveTypeField): string {
  if (!field.condition) return "";
  const missingField = !field.condition.field.trim();
  const missingEquals = typeof field.condition.equals === "string" && !field.condition.equals.trim();
  return missingField || missingEquals ? "أدخل الحقل المصدر وقيمة المقارنة لهذا العرض المشروط." : "";
}

export default function TypesEditor({ initialType, isSaving, requestError, onSave, onCancel }: TypesEditorProps) {
  const formId = useId();
  const [typeId, setTypeId] = useState("");
  const [typeName, setTypeName] = useState("");
  const [fields, setFields] = useState<ArchiveTypeField[]>([EMPTY_FIELD]);
  const [formError, setFormError] = useState("");
  const [touchedTypeId, setTouchedTypeId] = useState(false);
  const [touchedTypeName, setTouchedTypeName] = useState(false);
  const [touchedFieldNames, setTouchedFieldNames] = useState<Set<number>>(new Set());
  const [touchedConditions, setTouchedConditions] = useState<Set<number>>(new Set());
  const [pendingDraft, setPendingDraft] = useState<{ data: TypeDraftData; savedAt: string } | null>(null);
  const isEditing = initialType !== null;

  const duplicateIndexes = useMemo(() => duplicateFieldIndexes(fields), [fields]);

  useEffect(() => {
    if (isEditing) return;
    const draft = loadDraft<TypeDraftData>(NEW_TYPE_DRAFT_KEY);
    if (draft && isDraftWorthKeeping(draft.data)) setPendingDraft(draft);
    // Runs once per mount into "new type" mode; re-checking on every field
    // change would just re-show a banner the user already dismissed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isEditing) return;
    const draft: TypeDraftData = { typeId, typeName, fields };
    if (isDraftWorthKeeping(draft)) saveDraft(NEW_TYPE_DRAFT_KEY, draft);
  }, [isEditing, typeId, typeName, fields]);

  function handleRestoreDraft() {
    if (!pendingDraft) return;
    setTypeId(pendingDraft.data.typeId);
    setTypeName(pendingDraft.data.typeName);
    setFields(pendingDraft.data.fields);
    setPendingDraft(null);
  }

  function handleDiscardDraft() {
    clearDraft(NEW_TYPE_DRAFT_KEY);
    setPendingDraft(null);
  }

  useEffect(() => {
    setTypeId(initialType?.id ?? "");
    setTypeName(initialType?.name ?? "");
    setFields(initialType ? cloneFields(initialType.fields) : [{ ...EMPTY_FIELD, fieldAcl: { view: [], edit: [] } }]);
    setFormError("");
    setTouchedTypeId(false);
    setTouchedTypeName(false);
    setTouchedFieldNames(new Set());
    setTouchedConditions(new Set());
  }, [initialType]);

  function updateField(index: number, update: Partial<ArchiveTypeField>) {
    setFields((current) => current.map((field, fieldIndex) => {
      if (fieldIndex !== index) return field;
      if ("condition" in update && update.condition === undefined) {
        const { condition: _, ...fieldWithoutCondition } = field;
        const { condition: __, ...updateWithoutCondition } = update;
        return { ...fieldWithoutCondition, ...updateWithoutCondition };
      }
      return { ...field, ...update };
    }));
  }

  function toggleFieldRole(fieldIndex: number, role: string, access: "view" | "edit") {
    setFields((current) => current.map((field, index) => {
      if (index !== fieldIndex) return field;
      const fieldAcl = field.fieldAcl ?? { view: [], edit: [] };
      const roles = fieldAcl[access] ?? [];
      return {
        ...field,
        fieldAcl: {
          ...fieldAcl,
          [access]: roles.includes(role) ? roles.filter((item) => item !== role) : [...roles, role],
        },
      };
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedFields = fields.map((field) => ({
      ...field,
      name: field.name.trim(),
      ...(field.condition
        ? {
            condition: {
              ...field.condition,
              field: field.condition.field.trim(),
              equals: typeof field.condition.equals === "string" ? field.condition.equals.trim() : field.condition.equals,
            },
          }
        : {}),
    }));
    setTouchedTypeId(true);
    setTouchedTypeName(true);
    setTouchedFieldNames(new Set(normalizedFields.map((_, index) => index)));
    setTouchedConditions(new Set(normalizedFields.map((_, index) => index).filter((index) => normalizedFields[index].condition)));

    if (typeIdError(typeId) || typeNameError(typeName)) {
      setFormError("أدخل معرّف النوع واسمه قبل الحفظ.");
      return;
    }
    if (normalizedFields.some((field) => fieldNameError(field.name))) {
      setFormError("أدخل اسمًا لكل حقل قبل الحفظ.");
      return;
    }
    if (duplicateFieldIndexes(normalizedFields).size > 0) {
      setFormError("أسماء بعض الحقول مكررة. استخدم اسمًا فريدًا لكل حقل.");
      return;
    }
    if (normalizedFields.some((field) => fieldConditionError(field))) {
      setFormError("أدخل الحقل المصدر وقيمة المقارنة لكل عرض مشروط قبل الحفظ.");
      return;
    }

    setFormError("");
    await onSave({ id: typeId.trim(), name: typeName.trim(), fields: normalizedFields });
    if (!isEditing) clearDraft(NEW_TYPE_DRAFT_KEY);
  }

  return (
    <aside className="schema-editor" aria-labelledby={`${formId}-heading`}>
      <div className="schema-editor__heading">
        <div>
          <p className="schema-editor__eyebrow">{isEditing ? "تحرير النوع" : "نوع جديد"}</p>
          <h2 id={`${formId}-heading`}>{isEditing ? typeName || "نوع غير مسمى" : "إنشاء مخطط بيانات"}</h2>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>إغلاق</Button>
      </div>

      <form className="schema-editor__form" onSubmit={handleSubmit} noValidate>
        {(formError || requestError) ? <FieldError>{formError || requestError}</FieldError> : null}

        {pendingDraft ? (
          <div className="panel panel-compact draft-restore-banner" role="status">
            <p className="form-status">
              يوجد نوع غير محفوظ من {new Date(pendingDraft.savedAt).toLocaleString("ar")}. استعادته؟
            </p>
            <div className="button-row">
              <Button type="button" size="sm" variant="secondary" onClick={handleRestoreDraft}>استعادة المسودة</Button>
              <Button type="button" size="sm" variant="ghost" onClick={handleDiscardDraft}>تجاهل</Button>
            </div>
          </div>
        ) : null}

        <label className="schema-form-field">
          <span>معرّف النوع</span>
          <input
            className="schema-field-control"
            value={typeId}
            onChange={(event) => setTypeId(event.target.value)}
            onBlur={() => setTouchedTypeId(true)}
            disabled={isEditing || isSaving}
            aria-describedby={`${formId}-id-hint`}
            required
          />
          {touchedTypeId ? <FieldError>{typeIdError(typeId)}</FieldError> : null}
          <FormHint className="schema-field-hint" >
            <span id={`${formId}-id-hint`}>{isEditing ? "لا يمكن تغيير المعرّف بعد الإنشاء." : "استخدم معرّفًا ثابتًا مثل document أو photo."}</span>
          </FormHint>
        </label>

        <label className="schema-form-field">
          <span>اسم النوع</span>
          <input
            className="schema-field-control"
            value={typeName}
            onChange={(event) => setTypeName(event.target.value)}
            onBlur={() => setTouchedTypeName(true)}
            disabled={isSaving}
            placeholder="مثال: مستند"
            required
          />
          {touchedTypeName ? <FieldError>{typeNameError(typeName)}</FieldError> : null}
        </label>

        <fieldset className="schema-fields">
          <legend>الحقول</legend>
          <FormHint>حدّد الحقول التي تظهر عند إدخال سجل من هذا النوع، ثم امنح الأدوار صلاحية العرض أو التحرير.</FormHint>

          <div className="schema-field-list">
            {fields.map((field, index) => (
              <section className="schema-field-row" key={`${initialType?.id ?? "new"}-${index}`} aria-labelledby={`${formId}-field-${index}`}>
                <div className="schema-field-row__topline">
                  <strong id={`${formId}-field-${index}`}>الحقل {index + 1}</strong>
                  <Button type="button" size="sm" variant="ghost" disabled={isSaving || fields.length === 1} onClick={() => setFields((current) => current.filter((_, itemIndex) => itemIndex !== index))}>حذف</Button>
                </div>
                <div className="schema-field-grid">
                  <label className="schema-form-field">
                    <span>اسم الحقل</span>
                    <input
                      className="schema-field-control"
                      value={field.name}
                      disabled={isSaving}
                      onChange={(event) => updateField(index, { name: event.target.value })}
                      onBlur={() => setTouchedFieldNames((current) => new Set(current).add(index))}
                      placeholder="مثال: جهة الإصدار"
                      required
                    />
                    {touchedFieldNames.has(index) ? (
                      <FieldError>
                        {fieldNameError(field.name) || (duplicateIndexes.has(index) ? `اسم الحقل «${field.name.trim()}» مكرر.` : "")}
                      </FieldError>
                    ) : null}
                  </label>
                  <label className="schema-form-field">
                    <span>نوع البيانات</span>
                    <select className="schema-field-control" value={field.type} disabled={isSaving} onChange={(event) => updateField(index, { type: event.target.value as ArchiveTypeFieldKind })}>
                      {FIELD_TYPES.map((fieldType) => <option key={fieldType.value} value={fieldType.value}>{fieldType.label}</option>)}
                    </select>
                  </label>
                </div>
                <fieldset className="schema-acl">
                  <label className="schema-check">
                    <input
                      type="checkbox"
                      checked={Boolean(field.condition)}
                      disabled={isSaving}
                      onChange={(event) => updateField(index, { condition: event.target.checked ? { field: "", equals: "" } : undefined })}
                    />
                    <span>عرض مشروط</span>
                  </label>
                  {field.condition ? (
                    <div className="schema-field-grid">
                      <label className="schema-form-field">
                        <span>الحقل المصدر</span>
                        <select
                          className="schema-field-control"
                          value={field.condition.field}
                          disabled={isSaving}
                          onChange={(event) => updateField(index, { condition: { ...(field.condition ?? { field: "", equals: "" }), field: event.target.value } })}
                          onBlur={() => setTouchedConditions((current) => new Set(current).add(index))}
                        >
                          <option value="">اختر الحقل المصدر</option>
                          {fields
                            .filter((candidate) => candidate.name.trim() && candidate.name.trim() !== field.name.trim())
                            .map((candidate, candidateIndex) => <option key={`${candidate.name}-${candidateIndex}`} value={candidate.name.trim()}>{candidate.name.trim()}</option>)}
                        </select>
                      </label>
                      <label className="schema-form-field">
                        <span>يساوي</span>
                        <input
                          className="schema-field-control"
                          value={String(field.condition.equals)}
                          disabled={isSaving}
                          onChange={(event) => updateField(index, { condition: { ...(field.condition ?? { field: "", equals: "" }), equals: event.target.value } })}
                          onBlur={() => setTouchedConditions((current) => new Set(current).add(index))}
                          required
                        />
                      </label>
                      {touchedConditions.has(index) ? <FieldError>{fieldConditionError(field)}</FieldError> : null}
                    </div>
                  ) : null}
                </fieldset>
                <div className="schema-acl-grid">
                  {(["view", "edit"] as const).map((access) => (
                    <fieldset className="schema-acl" key={access}>
                      <legend>{access === "view" ? "يمكن العرض" : "يمكن التحرير"}</legend>
                      {ROLES.map((role) => (
                        <label className="schema-check" key={role}>
                          <input type="checkbox" checked={field.fieldAcl?.[access]?.includes(role) ?? false} disabled={isSaving} onChange={() => toggleFieldRole(index, role, access)} />
                          <span>{role === "viewer" ? "مشاهد" : role === "editor" ? "محرر" : "مدير"}</span>
                        </label>
                      ))}
                    </fieldset>
                  ))}
                </div>
              </section>
            ))}
          </div>
          <Button type="button" variant="secondary" disabled={isSaving} onClick={() => setFields((current) => [...current, { ...EMPTY_FIELD, fieldAcl: { view: [], edit: [] } }])}>إضافة حقل</Button>
        </fieldset>

        <div className="schema-editor__actions">
          <Button type="submit" variant="primary" disabled={isSaving}>{isSaving ? "جارٍ الحفظ…" : "حفظ النوع"}</Button>
          <Button type="button" variant="secondary" disabled={isSaving} onClick={onCancel}>إلغاء</Button>
        </div>
      </form>
    </aside>
  );
}

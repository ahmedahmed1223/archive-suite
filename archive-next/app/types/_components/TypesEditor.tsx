"use client";

import { useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { FieldError, FormHint } from "@/components/ui/Form";
import IconPicker from "@/components/IconPicker";
import type { ArchiveType, ArchiveTypeField, ArchiveTypeFieldKind } from "@/lib/archive-api";
import { clearDraft, loadDraft, saveDraft } from "@/lib/local-draft";
import { useLocale } from "@/lib/i18n/LocaleProvider";

type TypesEditorProps = {
  initialType: ArchiveType | null;
  isSaving: boolean;
  requestError?: string;
  onSave: (typeData: ArchiveType) => Promise<void>;
  onCancel: () => void;
};

const ROLES = ["viewer", "editor", "admin"];

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

function typeIdError(typeId: string, message: string): string {
  return typeId.trim() ? "" : message;
}

function typeNameError(typeName: string, message: string): string {
  return typeName.trim() ? "" : message;
}

function fieldNameError(name: string, message: string): string {
  return name.trim() ? "" : message;
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

function fieldConditionError(field: ArchiveTypeField, message: string): string {
  if (!field.condition) return "";
  const missingField = !field.condition.field.trim();
  const missingEquals = typeof field.condition.equals === "string" && !field.condition.equals.trim();
  return missingField || missingEquals ? message : "";
}

export default function TypesEditor({ initialType, isSaving, requestError, onSave, onCancel }: TypesEditorProps) {
  const { locale, t } = useLocale();
  const copy = t.pages.types;
  const fieldTypes: Array<{ value: ArchiveTypeFieldKind; label: string }> = [
    { value: "text", label: copy.fieldTypes.text }, { value: "number", label: copy.fieldTypes.number },
    { value: "date", label: copy.fieldTypes.date }, { value: "select", label: copy.fieldTypes.select },
    { value: "multi", label: copy.fieldTypes.multi }, { value: "boolean", label: copy.fieldTypes.boolean },
  ];
  const formId = useId();
  const [typeId, setTypeId] = useState("");
  const [typeName, setTypeName] = useState("");
  const [icon, setIcon] = useState("");
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
    setIcon(initialType?.icon ?? "");
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

    if (typeIdError(typeId, copy.typeIdRequired) || typeNameError(typeName, copy.typeNameRequired)) {
      setFormError(copy.formIdentityRequired);
      return;
    }
    if (normalizedFields.some((field) => fieldNameError(field.name, copy.fieldNameRequired))) {
      setFormError(copy.formFieldsRequired);
      return;
    }
    if (duplicateFieldIndexes(normalizedFields).size > 0) {
      setFormError(copy.duplicateFields);
      return;
    }
    if (normalizedFields.some((field) => fieldConditionError(field, copy.conditionRequired))) {
      setFormError(copy.conditionalFieldsRequired);
      return;
    }

    setFormError("");
    const savedId = typeId.trim();
    await onSave({
      id: savedId,
      name: typeName.trim(),
      ...(icon ? { icon } : {}),
      fields: normalizedFields,
    });
    if (!isEditing) clearDraft(NEW_TYPE_DRAFT_KEY);
  }

  return (
    <aside className="schema-editor" aria-labelledby={`${formId}-heading`}>
      <div className="schema-editor__heading">
        <div>
          <p className="schema-editor__eyebrow">{isEditing ? copy.editType : copy.newType}</p>
          <h2 id={`${formId}-heading`}>{isEditing ? typeName || copy.unnamedType : copy.createSchema}</h2>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>{copy.close}</Button>
      </div>

      <form className="schema-editor__form" onSubmit={handleSubmit} noValidate>
        {(formError || requestError) ? <FieldError>{formError || requestError}</FieldError> : null}

        {pendingDraft ? (
          <div className="panel panel-compact draft-restore-banner" role="status">
            <p className="form-status">
              {copy.unsavedDraft.replace("{date}", new Date(pendingDraft.savedAt).toLocaleString(locale === "ar" ? "ar-SA" : "en-US"))}
            </p>
            <div className="button-row">
              <Button type="button" size="sm" variant="secondary" onClick={handleRestoreDraft}>{copy.restoreDraft}</Button>
              <Button type="button" size="sm" variant="ghost" onClick={handleDiscardDraft}>{copy.discard}</Button>
            </div>
          </div>
        ) : null}

        <label className="schema-form-field">
          <span>{copy.typeId}</span>
          <input
            className="schema-field-control"
            value={typeId}
            onChange={(event) => setTypeId(event.target.value)}
            onBlur={() => setTouchedTypeId(true)}
            disabled={isEditing || isSaving}
            aria-describedby={`${formId}-id-hint`}
            required
          />
          {touchedTypeId ? <FieldError>{typeIdError(typeId, copy.typeIdRequired)}</FieldError> : null}
          <FormHint className="schema-field-hint" >
            <span id={`${formId}-id-hint`}>{isEditing ? copy.typeIdEditHint : copy.typeIdCreateHint}</span>
          </FormHint>
        </label>

        <label className="schema-form-field">
          <span>{copy.typeName}</span>
          <input
            className="schema-field-control"
            value={typeName}
            onChange={(event) => setTypeName(event.target.value)}
            onBlur={() => setTouchedTypeName(true)}
            disabled={isSaving}
            placeholder={copy.typeNamePlaceholder}
            required
          />
          {touchedTypeName ? <FieldError>{typeNameError(typeName, copy.typeNameRequired)}</FieldError> : null}
        </label>

        <div className="schema-form-field">
          <span>{copy.typeIcon}</span>
          <IconPicker value={icon} onChange={setIcon} label={copy.selectTypeIcon} />
        </div>

        <fieldset className="schema-fields">
          <legend>{copy.fields}</legend>
          <FormHint>{copy.fieldsHint}</FormHint>

          <div className="schema-field-list">
            {fields.map((field, index) => (
              <section className="schema-field-row" key={`${initialType?.id ?? "new"}-${index}`} aria-labelledby={`${formId}-field-${index}`}>
                <div className="schema-field-row__topline">
                  <strong id={`${formId}-field-${index}`}>{copy.fieldNumber.replace("{number}", String(index + 1))}</strong>
                  <Button type="button" size="sm" variant="ghost" disabled={isSaving || fields.length === 1} onClick={() => setFields((current) => current.filter((_, itemIndex) => itemIndex !== index))}>{copy.delete}</Button>
                </div>
                <div className="schema-field-grid">
                  <label className="schema-form-field">
                    <span>{copy.fieldName}</span>
                    <input
                      className="schema-field-control"
                      value={field.name}
                      disabled={isSaving}
                      onChange={(event) => updateField(index, { name: event.target.value })}
                      onBlur={() => setTouchedFieldNames((current) => new Set(current).add(index))}
                      placeholder={copy.fieldNamePlaceholder}
                      required
                    />
                    {touchedFieldNames.has(index) ? (
                      <FieldError>
                        {fieldNameError(field.name, copy.fieldNameRequired) || (duplicateIndexes.has(index) ? copy.duplicateFieldName.replace("{name}", field.name.trim()) : "")}
                      </FieldError>
                    ) : null}
                  </label>
                  <label className="schema-form-field">
                    <span>{copy.dataType}</span>
                    <select className="schema-field-control" value={field.type} disabled={isSaving} onChange={(event) => updateField(index, { type: event.target.value as ArchiveTypeFieldKind })}>
                      {fieldTypes.map((fieldType) => <option key={fieldType.value} value={fieldType.value}>{fieldType.label}</option>)}
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
                    <span>{copy.conditionalDisplay}</span>
                  </label>
                  {field.condition ? (
                    <div className="schema-field-grid">
                      <label className="schema-form-field">
                        <span>{copy.sourceField}</span>
                        <select
                          className="schema-field-control"
                          value={field.condition.field}
                          disabled={isSaving}
                          onChange={(event) => updateField(index, { condition: { ...(field.condition ?? { field: "", equals: "" }), field: event.target.value } })}
                          onBlur={() => setTouchedConditions((current) => new Set(current).add(index))}
                        >
                          <option value="">{copy.selectSourceField}</option>
                          {fields
                            .filter((candidate) => candidate.name.trim() && candidate.name.trim() !== field.name.trim())
                            .map((candidate, candidateIndex) => <option key={`${candidate.name}-${candidateIndex}`} value={candidate.name.trim()}>{candidate.name.trim()}</option>)}
                        </select>
                      </label>
                      <label className="schema-form-field">
                        <span>{copy.equals}</span>
                        <input
                          className="schema-field-control"
                          value={String(field.condition.equals)}
                          disabled={isSaving}
                          onChange={(event) => updateField(index, { condition: { ...(field.condition ?? { field: "", equals: "" }), equals: event.target.value } })}
                          onBlur={() => setTouchedConditions((current) => new Set(current).add(index))}
                          required
                        />
                      </label>
                      {touchedConditions.has(index) ? <FieldError>{fieldConditionError(field, copy.conditionRequired)}</FieldError> : null}
                    </div>
                  ) : null}
                </fieldset>
                <div className="schema-acl-grid">
                  {(["view", "edit"] as const).map((access) => (
                    <fieldset className="schema-acl" key={access}>
                      <legend>{access === "view" ? copy.canView : copy.canEdit}</legend>
                      {ROLES.map((role) => (
                        <label className="schema-check" key={role}>
                          <input type="checkbox" checked={field.fieldAcl?.[access]?.includes(role) ?? false} disabled={isSaving} onChange={() => toggleFieldRole(index, role, access)} />
                          <span>{copy.roles[role as keyof typeof copy.roles]}</span>
                        </label>
                      ))}
                    </fieldset>
                  ))}
                </div>
              </section>
            ))}
          </div>
          <Button type="button" variant="secondary" disabled={isSaving} onClick={() => setFields((current) => [...current, { ...EMPTY_FIELD, fieldAcl: { view: [], edit: [] } }])}>{copy.addField}</Button>
        </fieldset>

        <div className="schema-editor__actions">
          <Button type="submit" variant="primary" disabled={isSaving}>{isSaving ? copy.saving : copy.saveType}</Button>
          <Button type="button" variant="secondary" disabled={isSaving} onClick={onCancel}>{copy.cancel}</Button>
        </div>
      </form>
    </aside>
  );
}

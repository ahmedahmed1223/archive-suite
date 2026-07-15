"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { Button } from "@/components/ui/Button";
import { createArchiveApiClient, type ArchiveType } from "@/lib/archive-api";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import TypesList from "./_components/TypesList";
import TypesEditor from "./_components/TypesEditor";
import "./types.css";

type TypesState =
  | { status: "loading"; types: ArchiveType[] }
  | { status: "ready"; types: ArchiveType[] }
  | { status: "error"; types: ArchiveType[]; message: string };

export default function TypesPage() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const dialogs = useConfirmDialog();
  const [state, setState] = useState<TypesState>({ status: "loading", types: [] });
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [editorType, setEditorType] = useState<ArchiveType | null | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingTypeId, setDeletingTypeId] = useState<string | null>(null);
  const [editorError, setEditorError] = useState("");
  const [actionMessage, setActionMessage] = useState("");

  const loadTypes = useCallback(async () => {
    setState((current) => ({ status: "loading", types: current.types }));
    const types: ArchiveType[] = [];
    let cursor: string | undefined;

    do {
      const response = await api.types({ cursor, limit: 200 });
      if (!response.ok) {
        setState({ status: "error", types, message: response.error || "تعذر تحميل الأنواع." });
        return;
      }
      types.push(...response.types);
      cursor = response.nextCursor ?? undefined;
    } while (cursor);

    setState({ status: "ready", types });
    setSelectedTypeId((current) => current && types.some((type) => type.id === current) ? current : types[0]?.id ?? null);
  }, [api]);

  useEffect(() => {
    void loadTypes();
  }, [loadTypes]);

  const selectedType = state.types.find((type) => type.id === selectedTypeId) ?? null;
  const isEditorOpen = editorType !== undefined;

  function startCreate() {
    setEditorError("");
    setEditorType(null);
  }

  async function startEdit(type: ArchiveType) {
    setEditorError("");
    setActionMessage("");
    const response = await api.type(type.id);
    if (!response.ok) {
      setActionMessage(response.error || "تعذر تحميل النوع للتحرير.");
      return;
    }
    setSelectedTypeId(response.type.id);
    setEditorType(response.type);
  }

  function closeEditor() {
    if (isSaving) return;
    setEditorError("");
    setEditorType(undefined);
  }

  async function handleSaveType(typeData: ArchiveType) {
    setIsSaving(true);
    setEditorError("");
    setActionMessage("");
    const response = await api.saveType(typeData);
    setIsSaving(false);

    if (!response.ok) {
      setEditorError(response.error || "تعذر حفظ النوع. تحقق من البيانات ثم أعد المحاولة.");
      return;
    }

    setState((current) => {
      const index = current.types.findIndex((type) => type.id === response.type.id);
      const types = index === -1
        ? [...current.types, response.type]
        : current.types.map((type) => type.id === response.type.id ? response.type : type);
      return { status: "ready", types };
    });
    setSelectedTypeId(response.type.id);
    setActionMessage(`تم حفظ النوع «${response.type.name}».`);
    setEditorType(undefined);
  }

  async function handleDeleteType(type: ArchiveType) {
    const confirmed = await dialogs.confirm({
      title: "حذف النوع",
      message: `هل تريد حذف النوع «${type.name}»؟ لا يمكن التراجع عن هذا الإجراء.`,
      confirmLabel: "حذف",
      destructive: true
    });
    if (!confirmed) return;

    setDeletingTypeId(type.id);
    setActionMessage("");
    const response = await api.deleteType(type.id);
    setDeletingTypeId(null);

    if (!response.ok) {
      setActionMessage(response.error || "تعذر حذف النوع. حاول مجددًا.");
      return;
    }

    setState((current) => ({ status: "ready", types: current.types.filter((item) => item.id !== type.id) }));
    setSelectedTypeId((current) => current === type.id ? null : current);
    if (editorType?.id === type.id) setEditorType(undefined);
    setActionMessage(`تم حذف النوع «${type.name}».`);
  }

  return (
    <AppShell subtitle="الأنواع" contentClassName="types-content">
      <PageToolbar
        eyebrow={<span className="badge">تنظيم البيانات</span>}
        title="الأنواع"
        description="عرّف مخططات البيانات والحقول وصلاحيات كل دور قبل إدخال السجلات إلى الأرشيف."
        meta={<span className="badge">{state.types.length} نوع</span>}
        actions={<Button type="button" variant="primary" onClick={startCreate}>نوع جديد</Button>}
      />

      {actionMessage ? <p className="types-feedback" role="status">{actionMessage}</p> : null}
      <section className="state-banner" role="alert">
        <strong>معاينة أثر المخطط</strong>
        <span className="helper-text">تغيير الحقول أو حذف النوع قد يجعل بيانات السجلات الحالية غير متوافقة. راجع الحقول والصلاحيات قبل الحفظ؛ الحذف لا يمكن التراجع عنه.</span>
      </section>

      {state.status === "error" ? (
        <section className="types-state" role="alert">
          <strong>تعذر تحميل الأنواع</strong>
          <p>{state.message}</p>
          <Button type="button" variant="secondary" onClick={() => void loadTypes()}>إعادة المحاولة</Button>
        </section>
      ) : null}

      {state.status === "loading" && state.types.length === 0 ? (
        <section className="types-state" aria-live="polite"><p>جارٍ تحميل الأنواع…</p></section>
      ) : null}

      {(state.status === "ready" || state.types.length > 0) ? (
        <div className="schema-studio">
          <section className="schema-sidebar" aria-labelledby="types-list-heading">
            <div className="schema-sidebar__heading">
              <div>
                <p className="schema-editor__eyebrow">المخططات المتاحة</p>
                <h2 id="types-list-heading">أنواع الأرشيف</h2>
              </div>
              {state.status === "loading" ? <span className="schema-loading">جارٍ التحديث…</span> : null}
            </div>
            <TypesList
              types={state.types}
              selectedTypeId={selectedTypeId}
              deletingTypeId={deletingTypeId}
              onSelectType={setSelectedTypeId}
              onEditType={(type) => void startEdit(type)}
              onDeleteType={(type) => void handleDeleteType(type)}
              onCreateType={startCreate}
            />
          </section>

          <section className="schema-preview" aria-labelledby="type-preview-heading">
            {selectedType ? (
              <>
                <div className="schema-preview__heading">
                  <div>
                    <p className="schema-editor__eyebrow">معاينة المخطط</p>
                    <h2 id="type-preview-heading">{selectedType.name}</h2>
                    <code dir="ltr">{selectedType.id}</code>
                  </div>
                  <Button type="button" size="sm" onClick={() => void startEdit(selectedType)}>تحرير</Button>
                </div>
                <dl className="schema-preview__fields">
                  {selectedType.fields.map((field) => (
                    <div key={field.name}>
                      <dt>{field.name}</dt>
                      <dd>{FIELD_TYPES_LABELS[field.type]}</dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : (
              <EmptyState title="اختر نوعًا لمعاينة حقوله" description="أو أنشئ نوعًا جديدًا للبدء في تنظيم بيانات الأرشيف." actions={<Button type="button" variant="primary" onClick={startCreate}>نوع جديد</Button>} />
            )}
          </section>

          {isEditorOpen ? <TypesEditor initialType={editorType ?? null} isSaving={isSaving} requestError={editorError} onSave={handleSaveType} onCancel={closeEditor} /> : <aside className="schema-editor schema-editor--placeholder"><p>اختر «نوع جديد» أو حرّر نوعًا موجودًا لتعديل المخطط.</p></aside>}
        </div>
      ) : null}
    </AppShell>
  );
}

const FIELD_TYPES_LABELS: Record<ArchiveType["fields"][number]["type"], string> = {
  text: "نص",
  number: "رقم",
  date: "تاريخ",
  select: "اختيار واحد",
  multi: "اختيارات متعددة",
  boolean: "نعم / لا",
};

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { FieldError } from "@/components/ui/Form";
import {
  createArchiveApiClient,
  type ArchiveRecord,
  type ContentField,
  type ContentSubtype,
  type ContentTypeRecord
} from "@/lib/archive-api";

type TypesState =
  | { status: "loading" }
  | { status: "ready"; types: ContentTypeRecord[] }
  | { status: "error"; message: string };

type SaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

const fieldTypes: ContentField["type"][] = ["text", "textarea", "number", "date", "select", "relation", "checkbox"];

const starterTypes: ContentTypeRecord[] = [
  {
    uid: "video",
    id: "video",
    slug: "video",
    name: "فيديو",
    icon: "VID",
    color: "#176f5d",
    description: "مواد فيديو رئيسية مع توصيف إنتاجي.",
    active: true,
    subtypes: [
      { id: "raw", name: "لقطة خام" },
      { id: "edited", name: "نسخة مونتاج" },
      { id: "archive", name: "أرشيف قديم" }
    ],
    fields: [
      { id: "producer", key: "producer", label: "المنتج", type: "text" },
      { id: "shootDate", key: "shootDate", label: "تاريخ التصوير", type: "date" },
      { id: "rights", key: "rights", label: "حقوق الاستخدام", type: "select", options: ["داخلي", "مرخص", "غير معروف"] }
    ]
  },
  {
    uid: "document",
    id: "document",
    slug: "document",
    name: "مستند",
    icon: "DOC",
    color: "#2f4d73",
    description: "ملفات PDF وWord والمرفقات الداعمة.",
    active: true,
    subtypes: [
      { id: "pdf", name: "PDF" },
      { id: "contract", name: "عقد" },
      { id: "research", name: "بحث" }
    ],
    fields: [
      { id: "owner", key: "owner", label: "الجهة المالكة", type: "text" },
      { id: "referenceId", key: "referenceId", label: "رقم المرجع", type: "text" }
    ]
  },
  {
    uid: "photo",
    id: "photo",
    slug: "photo",
    name: "صورة",
    icon: "IMG",
    color: "#b77a25",
    description: "صور، أغلفة، ومواد بصرية ثابتة.",
    active: true,
    subtypes: [
      { id: "cover", name: "غلاف" },
      { id: "still", name: "لقطة" }
    ],
    fields: [
      { id: "photographer", key: "photographer", label: "المصور", type: "text" },
      { id: "location", key: "location", label: "الموقع", type: "text" }
    ]
  }
];

const emptyDraft: ContentTypeRecord = {
  uid: "",
  id: "",
  slug: "",
  name: "",
  icon: "TYPE",
  color: "#176f5d",
  description: "",
  active: true,
  subtypes: [],
  fields: []
};

const typeFormSchema = z.object({
  name: z.string().trim().min(1, "اكتب اسم النوع قبل الحفظ."),
  slug: z.string().trim().optional(),
  icon: z.string().trim().optional(),
  color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "اختر لونًا صحيحًا."),
  description: z.string().trim().optional(),
  subtypesText: z.string().optional(),
  fieldsText: z.string().optional(),
  active: z.boolean().default(true)
});

type TypeFormValues = z.input<typeof typeFormSchema>;

function slugify(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9\u0600-\u06ff-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || `type-${Date.now().toString(36)}`;
}

function normalizeType(record: ArchiveRecord): ContentTypeRecord {
  const id = String(record.id || record.uid || record.slug || "");
  const slug = String(record.slug || id);

  return {
    uid: String(record.uid || id || slug),
    id: id || slug,
    slug,
    name: String(record.name || "نوع بلا اسم"),
    icon: typeof record.icon === "string" ? record.icon : "TYPE",
    color: typeof record.color === "string" ? record.color : "#176f5d",
    description: typeof record.description === "string" ? record.description : "",
    active: record.active !== false,
    subtypes: Array.isArray(record.subtypes) ? (record.subtypes as ContentSubtype[]) : [],
    fields: Array.isArray(record.fields) ? (record.fields as ContentField[]) : [],
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : undefined
  };
}

function serializeType(type: ContentTypeRecord): ArchiveRecord {
  return {
    uid: type.uid,
    id: type.id,
    slug: type.slug,
    title: type.name,
    name: type.name,
    icon: type.icon,
    color: type.color,
    description: type.description,
    active: type.active !== false,
    subtypes: type.subtypes,
    fields: type.fields,
    updatedAt: new Date().toISOString()
  };
}

function parseSubtypes(value: string): ContentSubtype[] {
  return value
    .split(/\r?\n|،|,/)
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({ id: slugify(name), name }));
}

function parseFieldLines(value: string): ContentField[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [label = "", key = "", type = "text", options = ""] = line.split("|").map((part) => part.trim());
      const fieldType = fieldTypes.includes(type as ContentField["type"]) ? (type as ContentField["type"]) : "text";

      return {
        id: key || `field-${index + 1}`,
        key: key || slugify(label || `field-${index + 1}`),
        label: label || key || `حقل ${index + 1}`,
        type: fieldType,
        options: options ? options.split(",").map((item) => item.trim()).filter(Boolean) : undefined
      };
    });
}

function fieldsToText(fields: ContentField[]) {
  return fields
    .map((field) => [field.label, field.key, field.type, field.options?.join(",") || ""].join("|"))
    .join("\n");
}

function typeAccentStyle(color?: string) {
  return { "--type-color": color || "var(--color-brand-primary)" } as CSSProperties;
}

export default function TypesPage() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [state, setState] = useState<TypesState>({ status: "loading" });
  const [draft, setDraft] = useState<ContentTypeRecord>(emptyDraft);
  const [subtypesText, setSubtypesText] = useState("");
  const [fieldsText, setFieldsText] = useState("");
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
  const typeForm = useForm<TypeFormValues>({
    defaultValues: {
      name: "",
      slug: "",
      icon: "TYPE",
      color: "#176f5d",
      description: "",
      subtypesText: "",
      fieldsText: "",
      active: true
    }
  });
  const typeErrors = typeForm.formState.errors;

  const loadTypes = useCallback(async () => {
    setState({ status: "loading" });

    try {
      const response = await api.records({ store: "content_types", limit: 100 });

      if (!response.ok) {
        setState({ status: "error", message: response.error });
        return;
      }

      setState({ status: "ready", types: response.records.map(normalizeType) });
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : "تعذر تحميل الأنواع." });
    }
  }, [api]);

  useEffect(() => {
    void loadTypes();
  }, [loadTypes]);

  const typeList = state.status === "ready" ? state.types : [];
  const draftSubtypes = useMemo(() => parseSubtypes(subtypesText), [subtypesText]);
  const draftFields = useMemo(() => parseFieldLines(fieldsText), [fieldsText]);
  const activeCount = typeList.filter((type) => type.active !== false).length;
  const fieldCount = typeList.reduce((sum, type) => sum + type.fields.length, 0);
  const subtypeCount = typeList.reduce((sum, type) => sum + type.subtypes.length, 0);

  function editType(type: ContentTypeRecord) {
    setDraft(type);
    setSubtypesText(type.subtypes.map((subtype) => subtype.name).join("\n"));
    setFieldsText(fieldsToText(type.fields));
    typeForm.reset({
      name: type.name,
      slug: type.slug,
      icon: type.icon || "TYPE",
      color: type.color || "#176f5d",
      description: type.description || "",
      subtypesText: type.subtypes.map((subtype) => subtype.name).join("\n"),
      fieldsText: fieldsToText(type.fields),
      active: type.active !== false
    });
    setSaveState({ status: "idle" });
  }

  async function saveTypes(records: ContentTypeRecord[], message: string) {
    setSaveState({ status: "saving" });

    try {
      const response = await api.bulkRecords({
        store: "content_types",
        records: records.map(serializeType)
      });

      if (!response.ok) {
        setSaveState({ status: "error", message: response.error });
        return;
      }

      setSaveState({ status: "success", message });
      await loadTypes();
    } catch (err) {
      setSaveState({ status: "error", message: err instanceof Error ? err.message : "تعذر حفظ الأنواع." });
    }
  }

  const handleSubmit = typeForm.handleSubmit(async (values) => {
    typeForm.clearErrors();
    const parsed = typeFormSchema.safeParse(values);

    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0];
        if (field && typeof field === "string") {
          typeForm.setError(field as keyof TypeFormValues, { type: "zod", message: issue.message });
        }
      });
      setSaveState({ status: "error", message: parsed.error.issues[0]?.message || "راجع بيانات النوع." });
      return;
    }

    const name = parsed.data.name.trim();
    const slug = slugify(parsed.data.slug || name);
    const parsedSubtypes = parseSubtypes(parsed.data.subtypesText || "");
    const parsedFields = parseFieldLines(parsed.data.fieldsText || "");
    const normalized: ContentTypeRecord = {
      ...draft,
      uid: draft.uid || slug,
      id: draft.id || slug,
      slug,
      name,
      icon: parsed.data.icon || "TYPE",
      color: parsed.data.color,
      description: parsed.data.description || "",
      active: parsed.data.active,
      subtypes: parsedSubtypes,
      fields: parsedFields
    };

    const nextTypes = [
      normalized,
      ...typeList.filter((type) => type.uid !== normalized.uid)
    ];

    await saveTypes(nextTypes, "تم حفظ النوع.");
  });

  async function seedDefaults() {
    const existing = new Set(typeList.map((type) => type.uid));
    const missing = starterTypes.filter((type) => !existing.has(type.uid));

    await saveTypes([...missing, ...typeList], missing.length ? "تمت إضافة القوالب الأساسية." : "القوالب الأساسية موجودة بالفعل.");
  }

  const resetDraft = () => {
    setDraft(emptyDraft);
    setSubtypesText("");
    setFieldsText("");
    typeForm.reset({
      name: "",
      slug: "",
      icon: "TYPE",
      color: "#176f5d",
      description: "",
      subtypesText: "",
      fieldsText: "",
      active: true
    });
    setSaveState({ status: "idle" });
  };

  return (
    <AppShell subtitle="استديو الأنواع" contentClassName="types-content">
      <PageToolbar
        eyebrow={<span className="badge">Schema Studio</span>}
        title="إدارة الأنواع والحقول"
        description="استديو عملي لضبط أنواع المحتوى وفروعها وحقول metadata، مع معاينة فورية قبل الحفظ في Laravel."
        meta={(
          <>
            <span className="badge">{activeCount} نوع نشط</span>
            <span className="badge">{subtypeCount} فرع</span>
            <span className="badge">{fieldCount} حقل</span>
          </>
        )}
        actions={(
          <>
            <button className="button button-primary" type="button" onClick={() => void seedDefaults()}>
              إضافة القوالب
            </button>
            <button className="button button-secondary" type="button" onClick={resetDraft}>
              نوع جديد
            </button>
          </>
        )}
      >
        <div className="record-meta">
          <span className="badge">content_types</span>
          <span className="badge">metadata schema</span>
          <span className="badge">RTL</span>
        </div>
      </PageToolbar>

      {state.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>تعذر فتح إدارة الأنواع</strong>
          <p className="helper-text">{state.message}</p>
        </div>
      ) : null}

      <section className="schema-studio" aria-label="محرر الأنواع">
        <aside className="schema-sidebar" aria-label="قائمة الأنواع">
          <div className="panel-section-header">
            <h2>الأنواع الحالية</h2>
            <p className="field-note">اختر نوعاً للتعديل أو ابدأ بقالب جديد.</p>
          </div>

          {state.status === "loading" ? <p className="form-status">جار تحميل الأنواع...</p> : null}
          {state.status === "ready" && typeList.length === 0 ? (
            <EmptyState
              title="لا توجد أنواع محفوظة."
              description="أضف القوالب الأساسية أو أنشئ نوعاً جديداً من المحرر."
              actions={<button className="button button-secondary" type="button" onClick={() => void seedDefaults()}>إضافة القوالب</button>}
            />
          ) : null}
          {state.status === "ready" ? typeList.map((type) => (
            <article className="type-list-item" key={type.uid} style={typeAccentStyle(type.color)}>
              <div className="type-list-item__mark">{type.icon || "TYPE"}</div>
              <div className="type-list-item__body">
                <h3>{type.name}</h3>
                <p>{type.description || type.slug}</p>
                <div className="record-meta">
                  <span className="badge">{type.subtypes.length} فروع</span>
                  <span className="badge">{type.fields.length} حقول</span>
                  <span className="badge">{type.active === false ? "غير نشط" : "نشط"}</span>
                </div>
              </div>
              <button className="button button-secondary button-sm" type="button" onClick={() => editType(type)}>
                تعديل
              </button>
            </article>
          )) : null}
        </aside>

        <form className="panel auth-form schema-editor" onSubmit={handleSubmit} aria-label="نموذج النوع">
          <div className="panel-section-header">
            <div>
              <h2>{draft.uid ? "تعديل نوع" : "نوع جديد"}</h2>
              <p>صيغة الحقول: الاسم|المفتاح|النوع|خيارات مفصولة بفواصل.</p>
            </div>
          </div>

          <div className="field-row">
            <label>
              الاسم
              <input
                value={draft.name}
                {...typeForm.register("name")}
                onChange={(event) => {
                  const value = event.target.value;
                  typeForm.setValue("name", value, { shouldDirty: true });
                  setDraft({ ...draft, name: value });
                }}
              />
              <FieldError>{typeErrors.name?.message}</FieldError>
            </label>
            <label>
              المفتاح
              <input
                value={draft.slug}
                {...typeForm.register("slug")}
                onChange={(event) => {
                  const value = event.target.value;
                  typeForm.setValue("slug", value, { shouldDirty: true });
                  setDraft({ ...draft, slug: value });
                }}
              />
              <FieldError>{typeErrors.slug?.message}</FieldError>
            </label>
          </div>
          <div className="field-row">
            <label>
              الأيقونة
              <input
                value={draft.icon || ""}
                {...typeForm.register("icon")}
                onChange={(event) => {
                  const value = event.target.value;
                  typeForm.setValue("icon", value, { shouldDirty: true });
                  setDraft({ ...draft, icon: value });
                }}
              />
              <FieldError>{typeErrors.icon?.message}</FieldError>
            </label>
            <label>
              اللون
              <input
                type="color"
                value={draft.color || "#176f5d"}
                {...typeForm.register("color")}
                onChange={(event) => {
                  const value = event.target.value;
                  typeForm.setValue("color", value, { shouldDirty: true });
                  setDraft({ ...draft, color: value });
                }}
              />
              <FieldError>{typeErrors.color?.message}</FieldError>
            </label>
          </div>
          <label>
            الوصف
            <input
              value={draft.description || ""}
              {...typeForm.register("description")}
              onChange={(event) => {
                const value = event.target.value;
                typeForm.setValue("description", value, { shouldDirty: true });
                setDraft({ ...draft, description: value });
              }}
            />
            <FieldError>{typeErrors.description?.message}</FieldError>
          </label>
          <label>
            الفروع
            <textarea
              className="search-input"
              value={subtypesText}
              {...typeForm.register("subtypesText")}
              onChange={(event) => {
                const value = event.target.value;
                typeForm.setValue("subtypesText", value, { shouldDirty: true });
                setSubtypesText(value);
              }}
              rows={4}
            />
            <FieldError>{typeErrors.subtypesText?.message}</FieldError>
          </label>
          <label>
            الحقول
            <textarea
              className="search-input"
              value={fieldsText}
              {...typeForm.register("fieldsText")}
              onChange={(event) => {
                const value = event.target.value;
                typeForm.setValue("fieldsText", value, { shouldDirty: true });
                setFieldsText(value);
              }}
              rows={8}
            />
            <FieldError>{typeErrors.fieldsText?.message}</FieldError>
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={draft.active !== false}
              {...typeForm.register("active")}
              onChange={(event) => {
                const value = event.target.checked;
                typeForm.setValue("active", value, { shouldDirty: true });
                setDraft({ ...draft, active: value });
              }}
            />
            نشط
          </label>

          <div className="button-row">
            <button className="button button-primary" type="submit" disabled={saveState.status === "saving"}>
              {saveState.status === "saving" ? "جار الحفظ" : "حفظ النوع"}
            </button>
            <button className="button button-secondary" type="button" onClick={resetDraft}>
              تفريغ
            </button>
          </div>

          <p className={`form-status ${saveState.status === "error" ? "status-error" : saveState.status === "success" ? "status-success" : ""}`}>
            {saveState.status === "error" || saveState.status === "success" ? saveState.message : ""}
          </p>
        </form>

        <aside className="schema-preview" aria-label="معاينة النوع">
          <div className="panel-section-header">
            <span className="badge">معاينة</span>
            <h2>{draft.name || "نوع بلا اسم"}</h2>
            <p>{draft.description || "الوصف يظهر هنا عند إدخاله."}</p>
          </div>
          <div className="record-meta">
            <span className="badge">{draft.slug || "slug"}</span>
            <span className="badge">{draft.active === false ? "غير نشط" : "نشط"}</span>
            <span className="badge">{draftFields.length} حقول</span>
          </div>
          <div className="section-divider">
            <strong>الفروع</strong>
            {draftSubtypes.length > 0 ? (
              <div className="tags mt-tight">
                {draftSubtypes.map((subtype) => <span key={subtype.id} className="tag">{subtype.name}</span>)}
              </div>
            ) : (
              <p className="helper-text mt-tight">لا توجد فروع بعد.</p>
            )}
          </div>
          <div className="section-divider">
            <strong>الحقول</strong>
            {draftFields.length > 0 ? (
              <div className="schema-field-list mt-tight">
                {draftFields.map((field) => (
                  <div className="schema-field-row" key={field.id}>
                    <span>{field.label}</span>
                    <code>{field.key}</code>
                    <span className="badge">{field.type}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="helper-text mt-tight">لا توجد حقول بعد.</p>
            )}
          </div>
        </aside>
      </section>
    </AppShell>
  );
}

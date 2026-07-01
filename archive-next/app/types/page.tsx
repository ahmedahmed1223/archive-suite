"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import AppHeader from "@/components/AppHeader";
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
    color: "#14b8a6",
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
    color: "#64748b",
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
    color: "#8b5cf6",
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
  color: "#0f766e",
  description: "",
  active: true,
  subtypes: [],
  fields: []
};

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
    color: typeof record.color === "string" ? record.color : "#0f766e",
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

export default function TypesPage() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [state, setState] = useState<TypesState>({ status: "loading" });
  const [draft, setDraft] = useState<ContentTypeRecord>(emptyDraft);
  const [subtypesText, setSubtypesText] = useState("");
  const [fieldsText, setFieldsText] = useState("");
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });

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
  const activeCount = typeList.filter((type) => type.active !== false).length;
  const fieldCount = typeList.reduce((sum, type) => sum + type.fields.length, 0);
  const subtypeCount = typeList.reduce((sum, type) => sum + type.subtypes.length, 0);

  function editType(type: ContentTypeRecord) {
    setDraft(type);
    setSubtypesText(type.subtypes.map((subtype) => subtype.name).join("\n"));
    setFieldsText(fieldsToText(type.fields));
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = draft.name.trim();
    const slug = slugify(draft.slug || name);

    if (!name) {
      setSaveState({ status: "error", message: "اكتب اسم النوع قبل الحفظ." });
      return;
    }

    const normalized: ContentTypeRecord = {
      ...draft,
      uid: draft.uid || slug,
      id: draft.id || slug,
      slug,
      name,
      subtypes: parseSubtypes(subtypesText),
      fields: parseFieldLines(fieldsText)
    };

    const nextTypes = [
      normalized,
      ...typeList.filter((type) => type.uid !== normalized.uid)
    ];

    await saveTypes(nextTypes, "تم حفظ النوع.");
  }

  async function seedDefaults() {
    const existing = new Set(typeList.map((type) => type.uid));
    const missing = starterTypes.filter((type) => !existing.has(type.uid));

    await saveTypes([...missing, ...typeList], missing.length ? "تمت إضافة القوالب الأساسية." : "القوالب الأساسية موجودة بالفعل.");
  }

  return (
    <main className="shell">
      <AppHeader subtitle="إدارة الأنواع" />

      <section className="content stack" aria-label="إدارة الأنواع والحقول">
        <div className="hero">
          <span className="badge">Laravel content_types</span>
          <h1>إدارة الأنواع والحقول</h1>
          <p>
            نظّم أنواع المواد، فروعها، والحقول الخاصة بكل نوع من مكان واحد
            حتى تبقى طريقة الإدخال والبحث متسقة عبر النظام.
          </p>
          <div className="hero-actions">
            <span className="badge">{activeCount} نوع نشط</span>
            <span className="badge">{subtypeCount} فرع</span>
            <span className="badge">{fieldCount} حقل</span>
          </div>
        </div>

        {state.status === "error" && (
          <div className="state-banner state-banner-error" role="alert">
            <strong>تعذر فتح إدارة الأنواع</strong>
            <p className="helper-text">{state.message}</p>
          </div>
        )}

        <div className="split-layout" aria-label="محرر الأنواع">
          <section className="stack" aria-label="قائمة الأنواع">
            <div className="toolbar-row">
              <div>
                <h2>الأنواع الحالية</h2>
                <p className="field-note">اختر نوعاً للتعديل أو أضف القوالب الأساسية عند أول تشغيل.</p>
              </div>
              <button className="button button-secondary" type="button" onClick={() => void seedDefaults()}>
                إضافة القوالب
              </button>
            </div>

            {state.status === "loading" && <p className="form-status">جار تحميل الأنواع...</p>}
            {state.status === "ready" && typeList.length === 0 && (
              <div className="empty-state">لا توجد أنواع محفوظة بعد.</div>
            )}
            {state.status === "ready" && typeList.map((type) => (
              <article className="panel panel-compact" key={type.uid}>
                <div className="panel-title-row">
                  <div>
                    <h3>{type.icon || "TYPE"} {type.name}</h3>
                    <p>{type.description || type.slug}</p>
                  </div>
                  <span className="badge" style={{ borderColor: type.color, color: type.color }}>
                    {type.active === false ? "غير نشط" : "نشط"}
                  </span>
                </div>
                <div className="record-meta">
                  <span className="badge">{type.subtypes.length} فروع</span>
                  <span className="badge">{type.fields.length} حقول</span>
                  <button className="button button-secondary" type="button" onClick={() => editType(type)}>
                    تعديل
                  </button>
                </div>
              </article>
            ))}
          </section>

          <form className="panel auth-form" onSubmit={handleSubmit} aria-label="نموذج النوع">
            <div className="panel-title-row">
              <div>
                <h2>{draft.uid ? "تعديل نوع" : "نوع جديد"}</h2>
                <p>اكتب الحقول كسطر لكل حقل: الاسم|المفتاح|النوع|خيارات مفصولة بفواصل.</p>
              </div>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => {
                  setDraft(emptyDraft);
                  setSubtypesText("");
                  setFieldsText("");
                  setSaveState({ status: "idle" });
                }}
              >
                جديد
              </button>
            </div>

            <label>
              الاسم
              <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
            </label>
            <div className="field-row">
              <label>
                المفتاح
                <input value={draft.slug} onChange={(event) => setDraft({ ...draft, slug: event.target.value })} />
              </label>
              <label>
                الأيقونة
                <input value={draft.icon || ""} onChange={(event) => setDraft({ ...draft, icon: event.target.value })} />
              </label>
              <label>
                اللون
                <input type="color" value={draft.color || "#0f766e"} onChange={(event) => setDraft({ ...draft, color: event.target.value })} />
              </label>
            </div>
            <label>
              الوصف
              <input value={draft.description || ""} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
            </label>
            <label>
              الفروع
              <textarea className="search-input" value={subtypesText} onChange={(event) => setSubtypesText(event.target.value)} rows={4} />
            </label>
            <label>
              الحقول
              <textarea className="search-input" value={fieldsText} onChange={(event) => setFieldsText(event.target.value)} rows={7} />
            </label>

            <label style={{ alignItems: "center", display: "inline-flex", gap: "0.5rem" }}>
              <input
                type="checkbox"
                checked={draft.active !== false}
                onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
                style={{ inlineSize: "auto", minBlockSize: "auto" }}
              />
              نشط
            </label>

            <button className="button button-primary" type="submit" disabled={saveState.status === "saving"}>
              {saveState.status === "saving" ? "جار الحفظ" : "حفظ النوع"}
            </button>

            <p className={`form-status ${saveState.status === "error" ? "status-error" : saveState.status === "success" ? "status-success" : ""}`}>
              {saveState.status === "error" || saveState.status === "success" ? saveState.message : ""}
            </p>
          </form>
        </div>
      </section>
    </main>
  );
}

"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { createArchiveApiClient, type IntakeTemplate } from "@/lib/archive-api";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";

type IntakeTemplatesState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; message: string };

export function IntakeTemplatesPanel() {
  const { t } = useLocale();
  const dialogs = useConfirmDialog();
  const api = useMemo(() => createArchiveApiClient(), []);
  const [templates, setTemplates] = useState<IntakeTemplate[]>([]);
  const [templatesState, setTemplatesState] = useState<IntakeTemplatesState>({ status: "loading" });
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [folder, setFolder] = useState("");
  const [tags, setTags] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function refresh() {
    setTemplatesState({ status: "loading" });
    const response = await api.intakeTemplates();
    if (response.ok) {
      setTemplates(response.templates);
      setTemplatesState({ status: "ready" });
    } else {
      setTemplatesState({ status: "error", message: response.error || t.pages.intakeTemplatesPanel.loadError });
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh is redefined every render; this effect should run once on mount only
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const fields: Record<string, unknown> = {};
    if (folder.trim()) fields.folder = folder.trim();
    if (tags.trim()) fields.tags = tags.split(",").map((tag) => tag.trim()).filter(Boolean);

    if (Object.keys(fields).length === 0) {
      setError(t.pages.intakeTemplatesPanel.fieldRequiredError);
      return;
    }

    setIsCreating(true);
    const response = await api.createIntakeTemplate({ name, type: type || undefined, fields });

    if (!response.ok) {
      setError(response.error);
      setIsCreating(false);
      return;
    }

    setName("");
    setType("");
    setFolder("");
    setTags("");
    await refresh();
    setIsCreating(false);
  }

  async function handleDelete(template: IntakeTemplate) {
    const confirmed = await dialogs.confirm({
      title: t.pages.intakeTemplatesPanel.deleteDialog.title,
      message: t.pages.intakeTemplatesPanel.deleteDialog.message.replace("{name}", template.name),
      confirmLabel: t.pages.intakeTemplatesPanel.deleteDialog.confirm,
      destructive: true
    });
    if (!confirmed) return;
    setError(null);
    setDeletingId(template.id);
    const response = await api.deleteIntakeTemplate(template.id);
    if (response.ok) await refresh();
    else setError(response.error || t.pages.intakeTemplatesPanel.deleteError);
    setDeletingId(null);
  }

  return (
    <article className="panel">
      <div className="toolbar-row">
        <div>
          <h2>{t.pages.intakeTemplatesPanel.title}</h2>
          <p className="field-note">{t.pages.intakeTemplatesPanel.description}</p>
        </div>
      </div>

      <form className="auth-form" onSubmit={handleCreate}>
        <label>
          {t.pages.intakeTemplatesPanel.nameLabel}
          <input type="text" value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label>
          {t.pages.intakeTemplatesPanel.typeLabel}
          <input type="text" value={type} onChange={(event) => setType(event.target.value)} placeholder={t.pages.intakeTemplatesPanel.typePlaceholder} dir="ltr" />
        </label>
        <label>
          {t.pages.intakeTemplatesPanel.folderLabel}
          <input type="text" value={folder} onChange={(event) => setFolder(event.target.value)} dir="ltr" />
        </label>
        <label>
          {t.pages.intakeTemplatesPanel.tagsLabel}
          <input type="text" value={tags} onChange={(event) => setTags(event.target.value)} />
        </label>
        <button type="submit" className="button button-primary" disabled={isCreating}>{isCreating ? t.pages.intakeTemplatesPanel.saving : t.pages.intakeTemplatesPanel.saveButton}</button>
        {error ? (
          <p className="form-status" role="alert">
            {error}
          </p>
        ) : null}
      </form>

      {templatesState.status === "loading" ? (
        <div className="panel panel-compact"><Skeleton label={t.pages.intakeTemplatesPanel.loading} /></div>
      ) : templatesState.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>{t.pages.intakeTemplatesPanel.loadErrorHeading}</strong>
          <span className="helper-text">{templatesState.message}</span>
          <div><button type="button" className="button button-secondary button-sm" onClick={() => void refresh()}>{t.pages.intakeTemplatesPanel.retry}</button></div>
        </div>
      ) : templates.length === 0 ? (
        <p className="helper-text">{t.pages.intakeTemplatesPanel.empty}</p>
      ) : (
        <ul className="stack">
          {templates.map((template) => (
            <li key={template.id} className="record-meta">
              <span className="badge">{template.name}</span>
              {template.type ? <span className="badge">{template.type}</span> : null}
              <button type="button" className="button button-secondary button-sm" disabled={deletingId === template.id} onClick={() => void handleDelete(template)}>
                {deletingId === template.id ? t.pages.intakeTemplatesPanel.deleting : t.pages.intakeTemplatesPanel.deleteButton}
              </button>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

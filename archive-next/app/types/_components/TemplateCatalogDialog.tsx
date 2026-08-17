"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { createArchiveApiClient } from "@/lib/archive-api";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { getVocabTemplateCatalog, type VocabTemplateBlueprint, type VocabTemplateKey } from "@/lib/vocab-templates/catalog";
import {
  applyVocabTemplatePlan,
  loadExistingVocabState,
  planVocabTemplateApply,
  type ExistingVocabState,
  type VocabTemplatePlan,
} from "@/lib/vocab-templates/apply";

type PreviewState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; existing: ExistingVocabState };

type ApplyState = { status: "idle" | "applying" } | { status: "done"; message: string } | { status: "failed"; message: string };

interface TemplateCatalogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once after a template apply actually created something, so the types list can refresh. */
  onApplied: () => void;
}

export default function TemplateCatalogDialog({ open, onOpenChange, onApplied }: TemplateCatalogDialogProps) {
  const { locale, t } = useLocale();
  const copy = t.pages.vocabTemplates;
  const api = useMemo(() => createArchiveApiClient(), []);
  const catalog = useMemo(() => getVocabTemplateCatalog(locale), [locale]);

  const [preview, setPreview] = useState<PreviewState>({ status: "loading" });
  const [selectedKey, setSelectedKey] = useState<VocabTemplateKey | null>(null);
  const [departmentId, setDepartmentId] = useState("");
  const [applyState, setApplyState] = useState<ApplyState>({ status: "idle" });

  useEffect(() => {
    if (!open) return;
    setSelectedKey(null);
    setApplyState({ status: "idle" });
    setPreview({ status: "loading" });
    let cancelled = false;
    void loadExistingVocabState(api).then((result) => {
      if (cancelled) return;
      setPreview(result.ok ? { status: "ready", existing: result.state } : { status: "error", message: result.error });
    });
    return () => { cancelled = true; };
  }, [api, open]);

  const selected: VocabTemplateBlueprint | null = catalog.find((entry) => entry.key === selectedKey) ?? null;
  const plan: VocabTemplatePlan | null = selected && preview.status === "ready"
    ? planVocabTemplateApply(selected, preview.existing)
    : null;
  const nothingToDo = plan !== null && plan.type.status === "exists" && plan.metadataTemplate.status === "exists" && plan.tags.every((tag) => tag.status === "exists");
  const needsDepartment = plan !== null && plan.metadataTemplate.status === "create";
  const canApply = plan !== null && !nothingToDo && (!needsDepartment || departmentId.trim().length > 0) && applyState.status !== "applying";

  function chooseTemplate(key: VocabTemplateKey) {
    setSelectedKey(key);
    setApplyState({ status: "idle" });
  }

  function backToChoose() {
    setSelectedKey(null);
    setApplyState({ status: "idle" });
  }

  async function apply() {
    if (!plan) return;
    setApplyState({ status: "applying" });
    const result = await applyVocabTemplatePlan(api, plan, departmentId.trim());
    if (result.error) {
      setApplyState({
        status: "failed",
        message: copy.applyPartial
          .replace("{types}", String(result.createdTypeIds.length))
          .replace("{templates}", String(result.createdTemplateNames.length))
          .replace("{tags}", String(result.createdTags.length))
          .replace("{error}", result.error),
      });
      return;
    }
    setApplyState({
      status: "done",
      message: copy.applySuccess
        .replace("{types}", String(result.createdTypeIds.length))
        .replace("{templates}", String(result.createdTemplateNames.length))
        .replace("{tags}", String(result.createdTags.length)),
    });
    if (result.createdTypeIds.length || result.createdTemplateNames.length || result.createdTags.length) {
      onApplied();
    }
  }

  function retryPreview() {
    setPreview({ status: "loading" });
    void loadExistingVocabState(api).then((result) => {
      setPreview(result.ok ? { status: "ready", existing: result.state } : { status: "error", message: result.error });
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="vocab-template-dialog" title={copy.dialogTitle} description={copy.dialogDescription}>
        {!selected ? (
          <div className="vocab-template-grid" role="list">
            {catalog.map((entry) => (
              <button
                key={entry.key}
                type="button"
                role="listitem"
                className="vocab-template-card"
                onClick={() => chooseTemplate(entry.key)}
              >
                <strong>{copy.templates[entry.key].name}</strong>
                <p>{copy.templates[entry.key].description}</p>
                <span className="badge">{copy.choose}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="vocab-template-preview">
            <div className="button-row">
              <Button type="button" variant="ghost" size="sm" onClick={backToChoose} disabled={applyState.status === "applying"}>
                {copy.back}
              </Button>
              <span className="badge">{copy.chosen}: {copy.templates[selected.key].name}</span>
            </div>

            {preview.status === "loading" ? <p className="helper-text" role="status">{copy.previewLoading}</p> : null}
            {preview.status === "error" ? (
              <div className="state-banner state-banner-error" role="alert">
                <p>{copy.previewLoadError}</p>
                <Button type="button" variant="secondary" size="sm" onClick={retryPreview}>{t.shared.actions.retry}</Button>
              </div>
            ) : null}

            {plan ? (
              <>
                <section aria-labelledby="vocab-template-preview-heading">
                  <h3 id="vocab-template-preview-heading">{copy.previewTitle}</h3>
                  <p className="helper-text">{copy.previewDescription}</p>
                  <ul className="vocab-preview-list">
                    <li className="vocab-preview-row">
                      <span>{copy.previewType}: <strong>{selected.type.name}</strong></span>
                      <span className={`badge ${plan.type.status === "create" ? "badge-success" : "badge-warning"}`}>
                        {plan.type.status === "create" ? copy.willCreate : copy.alreadyExists}
                      </span>
                    </li>
                    <li className="vocab-preview-row">
                      <span>{copy.previewMetadataTemplate}: <strong>{selected.metadataTemplate.name}</strong></span>
                      <span className={`badge ${plan.metadataTemplate.status === "create" ? "badge-success" : "badge-warning"}`}>
                        {plan.metadataTemplate.status === "create" ? copy.willCreate : copy.alreadyExists}
                      </span>
                    </li>
                    {plan.tags.map((tagPlan) => (
                      <li className="vocab-preview-row" key={`${tagPlan.blueprint.parent}/${tagPlan.blueprint.tag}`}>
                        <span>{copy.previewTags}: <strong>{tagPlan.blueprint.tag}</strong></span>
                        <span className={`badge ${tagPlan.status === "create" ? "badge-success" : "badge-warning"}`}>
                          {tagPlan.status === "create" ? copy.willCreate : copy.alreadyExists}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {nothingToDo ? <p className="helper-text" role="status">{copy.allExist}</p> : null}
                </section>

                {needsDepartment ? (
                  <label className="schema-form-field">
                    <span>{copy.departmentLabel}</span>
                    <input
                      className="schema-field-control"
                      value={departmentId}
                      onChange={(event) => setDepartmentId(event.target.value)}
                      placeholder={copy.departmentPlaceholder}
                      disabled={applyState.status === "applying"}
                      required
                    />
                    <span className="helper-text">{copy.departmentHint}</span>
                  </label>
                ) : null}

                {applyState.status === "done" ? <p className="types-feedback" role="status">{applyState.message}</p> : null}
                {applyState.status === "failed" ? <p className="state-banner state-banner-error" role="alert">{applyState.message}</p> : null}

                <div className="schema-editor__actions">
                  <Button type="button" variant="primary" disabled={!canApply} onClick={() => void apply()}>
                    {applyState.status === "applying" ? copy.applying : copy.apply}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={applyState.status === "applying"}>
                    {copy.close}
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

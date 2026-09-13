/**
 * Unified linear intake wizard state machine.
 *
 * Five ordered steps: مصدر (source) -> معاينة (preview) -> بيانات وحقوق
 * (metadata) -> فحص (inspection) -> قبول/حجر (decision). Modeled on
 * `project-intake.ts`: no React, no fetch -- just state + transitions +
 * validation, so the page component can stay a thin driver.
 *
 * A few of these steps have no backing API call of their own (there is no
 * dry-run/preview endpoint for the direct-pull sources, and no
 * accept/quarantine endpoint at all) -- for those this module models the
 * step as an explicit client-side confirmation gate rather than faking a
 * network call.
 */

export const INGEST_STEPS = ["source", "preview", "metadata", "inspection", "decision"] as const;

export type IngestStep = (typeof INGEST_STEPS)[number];

export type IngestSourceKind = "scan" | "watched" | "ftp" | "smb" | "dropbox";

export type IngestDecision = "accept" | "quarantine";

export type IngestWizardDraft = {
  source?: IngestSourceKind;
  /** True once the chosen source has every parameter it needs to run (connection fields, or trivially true for sources with none). */
  sourceConfigured: boolean;
  /** True once a preview/dry-run (or, for sources with no preview endpoint, the operator's reviewed run) has produced a result. */
  previewCompleted: boolean;
  destinationProjectId?: string;
  rightsConfirmed: boolean;
  /** True once the operator has requested/reviewed the technical probe for this material (there is no wizard-level inspection endpoint; /media/jobs owns the real work). */
  inspectionAcknowledged: boolean;
  /** The terminal call: never defaulted, always an explicit choice. */
  decision?: IngestDecision;
};

/** Sources with no connection parameters to fill in are configured the moment they're selected. */
export function sourceRequiresConfig(source: IngestSourceKind): boolean {
  return source === "ftp" || source === "smb";
}

export function createIngestWizardDraft(): IngestWizardDraft {
  return {
    sourceConfigured: false,
    previewCompleted: false,
    rightsConfirmed: false,
    inspectionAcknowledged: false,
  };
}

export function stepIndex(step: IngestStep): number {
  return INGEST_STEPS.indexOf(step);
}

export function isStepValid(step: IngestStep, draft: IngestWizardDraft): boolean {
  switch (step) {
    case "source":
      return Boolean(draft.source) && draft.sourceConfigured;
    case "preview":
      return draft.previewCompleted;
    case "metadata":
      return Boolean(draft.destinationProjectId?.trim()) && draft.rightsConfirmed;
    case "inspection":
      return draft.inspectionAcknowledged;
    case "decision":
      return draft.decision === "accept" || draft.decision === "quarantine";
    default:
      return false;
  }
}

/** True when every step strictly before `step` is valid, i.e. `step` is honestly reachable. */
export function canReachStep(step: IngestStep, draft: IngestWizardDraft): boolean {
  const targetIndex = stepIndex(step);
  for (let i = 0; i < targetIndex; i += 1) {
    if (!isStepValid(INGEST_STEPS[i], draft)) return false;
  }
  return true;
}

export function canAdvanceTo(step: IngestStep, draft: IngestWizardDraft): boolean {
  return canReachStep(step, draft);
}

/** Advance one step only if the current step is valid; otherwise stay put. */
export function nextStep(current: IngestStep, draft: IngestWizardDraft): IngestStep | null {
  const candidate = INGEST_STEPS[stepIndex(current) + 1];
  if (!candidate) return null;
  return isStepValid(current, draft) ? candidate : null;
}

export function previousStep(current: IngestStep): IngestStep | null {
  return INGEST_STEPS[stepIndex(current) - 1] ?? null;
}

/**
 * Jump back to `target`. Every step after `target` is invalidated -- a
 * completed preview, confirmed rights, an inspection acknowledgment, or an
 * accept/quarantine decision made under an earlier answer must never survive
 * once that earlier answer is revisited.
 */
export function goToStep(target: IngestStep, draft: IngestWizardDraft): IngestWizardDraft {
  const targetIndex = stepIndex(target);
  const next: IngestWizardDraft = { ...draft };
  if (targetIndex < stepIndex("preview")) next.previewCompleted = false;
  if (targetIndex < stepIndex("metadata")) {
    next.destinationProjectId = undefined;
    next.rightsConfirmed = false;
  }
  if (targetIndex < stepIndex("inspection")) next.inspectionAcknowledged = false;
  if (targetIndex < stepIndex("decision")) next.decision = undefined;
  return next;
}

/** Choosing a different source invalidates everything downstream, same as jumping back to "source". */
export function selectSource(draft: IngestWizardDraft, source: IngestSourceKind): IngestWizardDraft {
  if (draft.source === source) return draft;
  return {
    ...goToStep("source", draft),
    source,
    sourceConfigured: !sourceRequiresConfig(source),
  };
}

export function setSourceConfigured(draft: IngestWizardDraft, configured: boolean): IngestWizardDraft {
  return draft.sourceConfigured === configured ? draft : { ...draft, sourceConfigured: configured };
}

export function completePreview(draft: IngestWizardDraft): IngestWizardDraft {
  return { ...draft, previewCompleted: true };
}

export function setDestinationProjectId(draft: IngestWizardDraft, destinationProjectId: string): IngestWizardDraft {
  return { ...draft, destinationProjectId };
}

export function setRightsConfirmed(draft: IngestWizardDraft, rightsConfirmed: boolean): IngestWizardDraft {
  return { ...draft, rightsConfirmed };
}

export function setInspectionAcknowledged(draft: IngestWizardDraft, inspectionAcknowledged: boolean): IngestWizardDraft {
  return { ...draft, inspectionAcknowledged };
}

/** Record the terminal accept/quarantine call. Only meaningful once the "decision" step is actually reachable. */
export function decide(draft: IngestWizardDraft, decision: IngestDecision): IngestWizardDraft {
  return canReachStep("decision", draft) ? { ...draft, decision } : draft;
}

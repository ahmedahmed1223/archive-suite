/**
 * V1.5 Task 8: staged intake wizard state machine.
 * Five named stages; "next" is disabled until the current stage is valid;
 * a duplicate is a decision (never auto-merged); a missing right blocks submit.
 */

export const INTAKE_STAGES = ["source", "inspection", "metadata", "rights", "review"] as const;

export type IntakeStage = (typeof INTAKE_STAGES)[number];

export type IntakeDraft = {
  uploadId?: string;
  projectId?: string;
  title?: string;
  description?: string;
  rightsConfirmed: boolean;
  /** Server duplicate-check verdict. */
  duplicateState: "none" | "possible" | "duplicate";
  /** True once the user explicitly decided what to do with a detected duplicate. */
  duplicateDecisionMade?: boolean;
};

export function stageIndex(stage: IntakeStage): number {
  return INTAKE_STAGES.indexOf(stage);
}

export function isStageValid(stage: IntakeStage, draft: IntakeDraft): boolean {
  switch (stage) {
    case "source":
      return Boolean(draft.uploadId);
    case "inspection":
      // A possible duplicate must be explicitly acknowledged before moving on.
      return draft.duplicateState === "none" || draft.duplicateDecisionMade === true;
    case "metadata":
      return Boolean(draft.title?.trim());
    case "rights":
      return draft.rightsConfirmed;
    case "review":
      // Submit requires every earlier gate plus an explicit destination project.
      return Boolean(draft.projectId) && draft.rightsConfirmed && draft.duplicateDecisionMade !== false;
    default:
      return false;
  }
}

export function canAdvanceTo(stage: IntakeStage, draft: IntakeDraft): boolean {
  return isStageValid(stage, draft);
}

/** Advance only if the current stage is valid; otherwise stay put. */
export function nextStage(current: IntakeStage, draft: IntakeDraft): IntakeStage | null {
  const i = stageIndex(current);
  const candidate = INTAKE_STAGES[i + 1];
  if (!candidate) return null;
  return isStageValid(current, draft) ? candidate : null;
}

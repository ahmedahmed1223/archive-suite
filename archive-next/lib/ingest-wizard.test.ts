import { describe, expect, it } from "vitest";
import {
  canAdvanceTo,
  canReachStep,
  completePreview,
  createIngestWizardDraft,
  decide,
  goToStep,
  INGEST_STEPS,
  isStepValid,
  nextStep,
  previousStep,
  selectSource,
  setDestinationProjectId,
  setInspectionAcknowledged,
  setRightsConfirmed,
  setSourceConfigured,
  type IngestWizardDraft,
} from "./ingest-wizard";

function draft(overrides: Partial<IngestWizardDraft> = {}): IngestWizardDraft {
  return { ...createIngestWizardDraft(), ...overrides };
}

describe("unified ingest wizard state machine", () => {
  it("exposes exactly the five named steps in order", () => {
    expect(INGEST_STEPS).toEqual(["source", "preview", "metadata", "inspection", "decision"]);
  });

  it("blocks the source step until a source is chosen and configured", () => {
    expect(isStepValid("source", draft())).toBe(false);
    expect(isStepValid("source", draft({ source: "ftp", sourceConfigured: false }))).toBe(false);
    expect(isStepValid("source", draft({ source: "ftp", sourceConfigured: true }))).toBe(true);
  });

  it("considers sources with no connection parameters configured as soon as they are selected", () => {
    const d = selectSource(draft(), "scan");
    expect(d.sourceConfigured).toBe(true);
    expect(isStepValid("source", d)).toBe(true);
  });

  it("leaves sources with connection parameters unconfigured until the caller says otherwise", () => {
    const d = selectSource(draft(), "smb");
    expect(d.sourceConfigured).toBe(false);
    expect(isStepValid("source", d)).toBe(false);
    expect(isStepValid("source", setSourceConfigured(d, true))).toBe(true);
  });

  it("cannot reach the inspection step without a completed preview", () => {
    const configured = draft({ source: "scan", sourceConfigured: true });
    expect(canReachStep("inspection", configured)).toBe(false);
    expect(canReachStep("inspection", completePreview(configured))).toBe(false); // metadata/rights still missing
  });

  it("cannot reach the decision step without confirmed rights", () => {
    let d = draft({ source: "scan", sourceConfigured: true });
    d = completePreview(d);
    d = setDestinationProjectId(d, "project-1");
    expect(canReachStep("decision", d)).toBe(false); // rights not confirmed

    d = setRightsConfirmed(d, true);
    expect(canReachStep("inspection", d)).toBe(true);
    expect(canReachStep("decision", d)).toBe(false); // inspection not acknowledged yet

    d = setInspectionAcknowledged(d, true);
    expect(canReachStep("decision", d)).toBe(true);
  });

  it("never defaults the terminal accept/quarantine decision", () => {
    let d = draft({ source: "scan", sourceConfigured: true });
    d = completePreview(d);
    d = setDestinationProjectId(d, "project-1");
    d = setRightsConfirmed(d, true);
    d = setInspectionAcknowledged(d, true);

    expect(d.decision).toBeUndefined();
    expect(isStepValid("decision", d)).toBe(false);

    const quarantined = decide(d, "quarantine");
    expect(quarantined.decision).toBe("quarantine");
    expect(isStepValid("decision", quarantined)).toBe(true);

    const accepted = decide(d, "accept");
    expect(accepted.decision).toBe("accept");
  });

  it("refuses to record a decision before the decision step is actually reachable", () => {
    const early = draft({ source: "scan", sourceConfigured: true });
    expect(decide(early, "accept").decision).toBeUndefined();
  });

  it("refuses to advance from an invalid step", () => {
    expect(nextStep("source", draft())).toBeNull();
    const configured = selectSource(draft(), "scan");
    expect(nextStep("source", configured)).toBe("preview");
    expect(nextStep("decision", draft())).toBeNull(); // last step
  });

  it("canAdvanceTo mirrors canReachStep", () => {
    const configured = selectSource(draft(), "scan");
    expect(canAdvanceTo("preview", configured)).toBe(true);
    expect(canAdvanceTo("metadata", configured)).toBe(false);
  });

  it("invalidates every step after the one navigated back to", () => {
    let d = selectSource(draft(), "scan");
    d = completePreview(d);
    d = setDestinationProjectId(d, "p1");
    d = setRightsConfirmed(d, true);
    d = setInspectionAcknowledged(d, true);
    d = decide(d, "accept");
    expect(d.decision).toBe("accept");

    const backToSource = goToStep("source", d);
    expect(backToSource.previewCompleted).toBe(false);
    expect(backToSource.destinationProjectId).toBeUndefined();
    expect(backToSource.rightsConfirmed).toBe(false);
    expect(backToSource.inspectionAcknowledged).toBe(false);
    expect(backToSource.decision).toBeUndefined();
    // The target step's own answer is untouched.
    expect(backToSource.source).toBe("scan");
    expect(backToSource.sourceConfigured).toBe(true);
  });

  it("does not invalidate the target step's own answer when navigating back to it", () => {
    let d = selectSource(draft(), "scan");
    d = completePreview(d);
    d = setDestinationProjectId(d, "p1");
    d = setRightsConfirmed(d, true);

    const backToMetadata = goToStep("metadata", d);
    // metadata is the target step itself, so its own fields are preserved.
    expect(backToMetadata.destinationProjectId).toBe("p1");
    expect(backToMetadata.rightsConfirmed).toBe(true);
    // preview is before the target, also preserved.
    expect(backToMetadata.previewCompleted).toBe(true);
  });

  it("invalidates the whole batch again when the source changes", () => {
    let d = selectSource(draft(), "scan");
    d = completePreview(d);
    d = setRightsConfirmed(d, setDestinationProjectId(d, "p1").destinationProjectId ? true : true);
    const switched = selectSource(d, "watched");
    expect(switched.source).toBe("watched");
    expect(switched.previewCompleted).toBe(false);
    expect(switched.rightsConfirmed).toBe(false);
  });

  it("previousStep walks back one step, and is null before the first step", () => {
    expect(previousStep("preview")).toBe("source");
    expect(previousStep("source")).toBeNull();
  });
});

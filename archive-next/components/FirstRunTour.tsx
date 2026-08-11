"use client";

import { Compass } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/Dialog";
import { clampStepIndex, firstRunTourSteps, hasTourBeenCompleted, markTourCompleted } from "@/lib/first-run-tour";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export default function FirstRunTour() {
  const { t } = useLocale();
  const copy = t.pages.firstRun.tour;
  const localizedSteps = [copy.steps.archive, copy.steps.search, copy.steps.uploads, copy.steps.kanban, copy.steps.settings];
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [completed, setCompleted] = useState(false);

  const step = firstRunTourSteps[stepIndex];
  const stepCopy = localizedSteps[stepIndex];
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === firstRunTourSteps.length - 1;
  const alreadyCompleted = completed || hasTourBeenCompleted();

  function finishTour() {
    markTourCompleted();
    setCompleted(true);
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) setStepIndex(0);
        setOpen(nextOpen);
      }}
    >
      <DialogTrigger asChild>
        <button type="button" className="button button-secondary">
          <Compass aria-hidden="true" size={16} />
          {alreadyCompleted ? copy.restart : copy.start}
        </button>
      </DialogTrigger>
      <DialogContent title={stepCopy.title} description={stepCopy.description}>
        <p className="helper-text">{copy.progress.replace("{current}", String(stepIndex + 1)).replace("{total}", String(firstRunTourSteps.length))}</p>
        <div className="button-row">
          <a className="button button-secondary" href={step.href} onClick={() => setOpen(false)}>
            {stepCopy.action}
          </a>
        </div>
        <div className="button-row">
          <button
            type="button"
            className="button button-secondary"
            disabled={isFirstStep}
            onClick={() => setStepIndex((current) => clampStepIndex(current - 1, firstRunTourSteps.length))}
          >
            {copy.previous}
          </button>
          {isLastStep ? (
            <button type="button" className="button button-primary" onClick={finishTour}>
              {copy.finish}
            </button>
          ) : (
            <button
              type="button"
              className="button button-primary"
              onClick={() => setStepIndex((current) => clampStepIndex(current + 1, firstRunTourSteps.length))}
            >
              {copy.next}
            </button>
          )}
          <button type="button" className="button button-secondary" onClick={() => setOpen(false)}>
            {copy.skip}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

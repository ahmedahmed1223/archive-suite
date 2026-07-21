"use client";

import { Compass } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/Dialog";
import { clampStepIndex, firstRunTourSteps, hasTourBeenCompleted, markTourCompleted } from "@/lib/first-run-tour";

export default function FirstRunTour() {
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [completed, setCompleted] = useState(false);

  const step = firstRunTourSteps[stepIndex];
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
          {alreadyCompleted ? "إعادة الجولة التعريفية" : "بدء جولة تعريفية"}
        </button>
      </DialogTrigger>
      <DialogContent title={step.title} description={step.description}>
        <p className="helper-text">خطوة {stepIndex + 1} من {firstRunTourSteps.length}</p>
        <div className="button-row">
          <a className="button button-secondary" href={step.href} onClick={() => setOpen(false)}>
            {step.actionLabel}
          </a>
        </div>
        <div className="button-row">
          <button
            type="button"
            className="button button-secondary"
            disabled={isFirstStep}
            onClick={() => setStepIndex((current) => clampStepIndex(current - 1, firstRunTourSteps.length))}
          >
            السابق
          </button>
          {isLastStep ? (
            <button type="button" className="button button-primary" onClick={finishTour}>
              إنهاء الجولة
            </button>
          ) : (
            <button
              type="button"
              className="button button-primary"
              onClick={() => setStepIndex((current) => clampStepIndex(current + 1, firstRunTourSteps.length))}
            >
              التالي
            </button>
          )}
          <button type="button" className="button button-secondary" onClick={() => setOpen(false)}>
            تخطي
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

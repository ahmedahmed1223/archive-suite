"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpenCheck, Languages, MonitorCheck } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import {
  shouldShowWhatsNew,
  WHATS_NEW_DISMISSED_KEY,
  WHATS_NEW_RELEASE,
  WHATS_NEW_STORAGE_KEY,
} from "@/lib/whats-new";

const highlightIcons = [Languages, MonitorCheck, BookOpenCheck] as const;

export default function WhatsNewDialog() {
  const { t } = useLocale();
  const copy = t.pages.whatsNewDialog;
  const [open, setOpen] = useState(false);
  const [permanentlyDismissed, setPermanentlyDismissed] = useState(false);

  useEffect(() => {
    setOpen(
      shouldShowWhatsNew(
        window.localStorage.getItem(WHATS_NEW_STORAGE_KEY),
        WHATS_NEW_RELEASE,
        window.localStorage.getItem(WHATS_NEW_DISMISSED_KEY) === "true",
      ),
    );
  }, []);

  const acknowledge = () => {
    window.localStorage.setItem(WHATS_NEW_STORAGE_KEY, WHATS_NEW_RELEASE);
    if (permanentlyDismissed) {
      window.localStorage.setItem(WHATS_NEW_DISMISSED_KEY, "true");
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? setOpen(true) : acknowledge())}>
      <DialogContent
        className="whats-new-dialog"
        title={copy.title}
        description={copy.description}
      >
        <div className="whats-new-list">
          {copy.highlights.map(({ title, description }, index) => {
            const Icon = highlightIcons[index];
            return (
            <section className="whats-new-item" key={title}>
              <span className="whats-new-icon" aria-hidden="true"><Icon size={20} /></span>
              <div>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
            </section>
            );
          })}
        </div>
        <section className="whats-new-next-steps" aria-labelledby="whats-new-next-steps-title">
          <h3 id="whats-new-next-steps-title">{copy.next}</h3>
          <ul>
            {copy.steps.map((step) => <li key={step}>{step}</li>)}
          </ul>
        </section>
        <label className="whats-new-dismiss">
          <input
            type="checkbox"
            checked={permanentlyDismissed}
            onChange={(event) => setPermanentlyDismissed(event.target.checked)}
          />
          <span>{copy.hide}</span>
        </label>
        <div className="whats-new-actions">
          <Link className="button button-secondary" href="/help?chapter=whats-new" onClick={acknowledge}>
            {copy.help}
          </Link>
          <button className="button button-primary" type="button" onClick={acknowledge}>
            {copy.start}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { BookOpenCheck, Languages, MonitorCheck } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import {
  shouldShowWhatsNew,
  WHATS_NEW_DISMISSED_KEY,
  WHATS_NEW_RELEASE,
  WHATS_NEW_STORAGE_KEY,
} from "@/lib/whats-new";

const arabicHighlights = [
  {
    icon: Languages,
    title: "المساعدة والدليل باللغتين",
    description: "اقرأ دليل المستخدم وصفحات المساعدة بالعربية أو الإنجليزية؛ ويتغير الدليل مع لغة الواجهة.",
  },
  {
    icon: MonitorCheck,
    title: "تشغيل Native مدعوم بالكامل",
    description: "تتوفر حزم Native المدعومة لنظامي Windows وLinux، إلى جانب مسار Docker المعتمد.",
  },
  {
    icon: BookOpenCheck,
    title: "اختيار لغة الواجهة من الإعدادات",
    description: "اضبط العربية أو الإنجليزية من الإعدادات، وستُحفظ اللغة المختارة لاستخدامك التالي.",
  },
] as const;

const englishHighlights = [
  { icon: Languages, title: "Bilingual Help and User Guide", description: "Read Help and the user guide in Arabic or English; the guide follows the interface language." },
  { icon: MonitorCheck, title: "Fully supported native operation", description: "Supported native packages are available for Windows and Linux alongside the canonical Docker path." },
  { icon: BookOpenCheck, title: "Choose the interface language in Settings", description: "Set Arabic or English in Settings, and your chosen language is saved for your next visit." },
] as const;

export default function WhatsNewDialog() {
  const { locale } = useLocale();
  const copy = locale === "en" ? {
    title: "What’s new in Archive Suite 1.1", description: "This release improves how you start, learn, and run Archive Suite across supported platforms.", highlights: englishHighlights, next: "What should you do next?", steps: ["Choose your interface language in Settings.", "Open the Help chapter for your role and use its task-based guidance.", "Use the supported native package or Docker path that fits your environment."], hide: "Do not show future what’s-new updates on this device", help: "Open What’s new in Help", start: "Start working",
  } : {
    title: "ما الجديد في مسار 1.1", description: "يركز هذا الإصدار على بدء استخدام أوضح، ومساعدة ثنائية اللغة، وتشغيل موثوق على المنصات المدعومة.", highlights: arabicHighlights, next: "ما الذي ينبغي عليك فعله الآن؟", steps: ["اختر لغة الواجهة من الإعدادات.", "افتح فصل المساعدة المناسب لدورك واتبع إرشاداته العملية.", "استخدم حزمة Native المدعومة أو مسار Docker المناسب لبيئتك."], hide: "لا تعرض تحديثات ما الجديد مرة أخرى", help: "فتح ما الجديد في المساعدة", start: "ابدأ العمل",
  };
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
          {copy.highlights.map(({ icon: Icon, title, description }) => (
            <section className="whats-new-item" key={title}>
              <span className="whats-new-icon" aria-hidden="true"><Icon size={20} /></span>
              <div>
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
            </section>
          ))}
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

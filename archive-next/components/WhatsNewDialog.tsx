"use client";

import { Search, Sparkles, Users } from "lucide-react";
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
    icon: Users,
    title: "تنظيم العمل بين الأقسام",
    description: "أصبح توجيه عناصر الوارد وتسليم المواد بين الأقسام أوضح، مع سجل يحفظ مسؤولية كل انتقال.",
  },
  {
    icon: Sparkles,
    title: "قوالب وتوصيفات أكثر ضبطًا",
    description: "اعتمد القوالب المنشورة وقواعد الجودة وملكية الحقول حسب القسم قبل تطبيقها على المواد.",
  },
  {
    icon: Search,
    title: "استيراد آمن وقابل للمراجعة",
    description: "عاين استيراد CSV ودفعات المجلد المراقَب أولًا، ثم اعتمد ما اجتاز المراجعة.",
  },
] as const;

const englishHighlights = [
  { icon: Users, title: "Clearer handoffs between teams", description: "Route incoming items and hand off material between teams with a record of responsibility at every step." },
  { icon: Sparkles, title: "More consistent templates and description", description: "Apply published templates, quality rules, and field ownership by department before working on material." },
  { icon: Search, title: "Safer, reviewable imports", description: "Preview CSV imports and watched-folder batches first, then approve the items that pass review." },
] as const;

export default function WhatsNewDialog() {
  const { locale } = useLocale();
  const copy = locale === "en" ? {
    title: "What’s new in Archive Suite", description: "A summary of the July 31 update: clearer workflows, better description controls, and safer imports.", highlights: englishHighlights, next: "What should you do next?", steps: ["Review published templates and quality rules before applying them to your team’s material.", "Start by previewing a CSV import or watched-folder batch, then approve the reviewed results.", "Use material handoffs and inbox routing to document work moving between teams."], hide: "Do not show future what’s-new updates on this device", help: "Open What’s new in Help", start: "Start working",
  } : {
    title: "ما الجديد في مسار", description: "ملخص تحديثات 31 يوليو — تنظيم العمل، وضبط التوصيف، واستيراد أكثر أمانًا.", highlights: arabicHighlights, next: "ما الذي ينبغي عليك فعله الآن؟", steps: ["راجع القوالب المنشورة وقواعد الجودة قبل تطبيقها على مواد قسمك.", "ابدأ بمعاينة CSV أو دفعة المجلد المراقَب، ثم اعتمد النتائج بعد مراجعتها.", "استخدم تسليم المادة وتوجيه الوارد لتوثيق انتقال العمل بين الأقسام."], hide: "لا تعرض تحديثات ما الجديد مرة أخرى", help: "فتح ما الجديد في المساعدة", start: "ابدأ العمل",
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

"use client";

import { Search, Sparkles, Users } from "lucide-react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import {
  shouldShowWhatsNew,
  WHATS_NEW_DISMISSED_KEY,
  WHATS_NEW_RELEASE,
  WHATS_NEW_STORAGE_KEY,
} from "@/lib/whats-new";

const highlights = [
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

export default function WhatsNewDialog() {
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
        title="ما الجديد في مسار"
        description="ملخص تحديثات 31 يوليو — تنظيم العمل، وضبط التوصيف، واستيراد أكثر أمانًا."
      >
        <div className="whats-new-list">
          {highlights.map(({ icon: Icon, title, description }) => (
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
          <h3 id="whats-new-next-steps-title">ما الذي ينبغي عليك فعله الآن؟</h3>
          <ul>
            <li>راجع القوالب المنشورة وقواعد الجودة قبل تطبيقها على مواد قسمك.</li>
            <li>ابدأ بمعاينة CSV أو دفعة المجلد المراقَب، ثم اعتمد النتائج بعد مراجعتها.</li>
            <li>استخدم تسليم المادة وتوجيه الوارد لتوثيق انتقال العمل بين الأقسام.</li>
          </ul>
        </section>
        <label className="whats-new-dismiss">
          <input
            type="checkbox"
            checked={permanentlyDismissed}
            onChange={(event) => setPermanentlyDismissed(event.target.checked)}
          />
          <span>لا تعرض تحديثات ما الجديد مرة أخرى</span>
        </label>
        <div className="whats-new-actions">
          <Link className="button button-secondary" href="/help?chapter=whats-new" onClick={acknowledge}>
            فتح ما الجديد في المساعدة
          </Link>
          <button className="button button-primary" type="button" onClick={acknowledge}>
            ابدأ العمل
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

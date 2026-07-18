"use client";

import { Search, Sparkles, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import {
  shouldShowWhatsNew,
  WHATS_NEW_RELEASE,
  WHATS_NEW_STORAGE_KEY,
} from "@/lib/whats-new";

const highlights = [
  {
    icon: Search,
    title: "بحث أسرع وأكثر دقة",
    description: "بحث متقدم واستدلالي، إكمال تلقائي، ووصول مباشر إلى لحظة التطابق داخل المقطع.",
  },
  {
    icon: Users,
    title: "عمليات بحث محفوظة للفريق",
    description: "احفظ بحثك لنفسك أو شاركه للقراءة مع الفريق مع بقاء نسخة كل مستخدم مستقلة.",
  },
  {
    icon: Sparkles,
    title: "تجربة يومية أوضح",
    description: "معاينات أسرع، اختصارات سياقية، واستعادة موضع العمل عند العودة إلى القوائم.",
  },
] as const;

export default function WhatsNewDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(
      shouldShowWhatsNew(
        window.localStorage.getItem(WHATS_NEW_STORAGE_KEY),
        WHATS_NEW_RELEASE,
      ),
    );
  }, []);

  const acknowledge = () => {
    window.localStorage.setItem(WHATS_NEW_STORAGE_KEY, WHATS_NEW_RELEASE);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (nextOpen ? setOpen(true) : acknowledge())}>
      <DialogContent
        className="whats-new-dialog"
        title="ما الجديد في مسار"
        description={`تحديث ${WHATS_NEW_RELEASE} — تحسينات عملية تساعدك على الوصول إلى المحتوى وتنظيمه بسرعة.`}
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
        <div className="whats-new-actions">
          <button className="button button-primary" type="button" onClick={acknowledge}>
            ابدأ العمل
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

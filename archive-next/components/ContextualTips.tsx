"use client";

import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useRef, useState } from "react";
import { pageTips, type PageKey, type Tip } from "@/lib/contextual-tips";
import { useContextualTips } from "@/lib/use-contextual-tips";

const iconRegistry = Icons as unknown as Record<string, LucideIcon>;
const getTipIcon = (name?: string) => iconRegistry[name || "Lightbulb"] || Icons.Lightbulb;

export default function ContextualTips({ page }: Readonly<{ page: PageKey }>) {
  const { isDismissed, handleDismiss, isHydrated } = useContextualTips(page);
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Server-side render guard
  if (!isHydrated) return null;

  const tips = pageTips[page] || [];
  if (tips.length === 0) return null;

  return (
    <div className="contextual-tips">
      <button
        type="button"
        className="contextual-tips__trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={`نصائح حول ${page}`}
        title={isDismissed ? "إظهار النصائح" : "نصائح اضغط لإظهار"}
        aria-pressed={isOpen}
        data-dismissed={isDismissed ? "true" : "false"}
      >
        <Icons.HelpCircle aria-hidden="true" size={18} strokeWidth={2} />
        {!isDismissed && <span className="contextual-tips__badge">جديد</span>}
      </button>

      {isOpen && (
        <div className="contextual-tips__popover" ref={popoverRef}>
          <div className="contextual-tips__header">
            <h3>نصائح سريعة</h3>
            <button
              type="button"
              className="contextual-tips__close"
              onClick={() => setIsOpen(false)}
              aria-label="إغلاق"
            >
              <Icons.X size={16} />
            </button>
          </div>
          <div className="contextual-tips__list">
            {tips.map((tip, idx) => (
              <TipItem key={idx} tip={tip} />
            ))}
          </div>
          <div className="contextual-tips__footer">
            <button
              type="button"
              className="contextual-tips__dismiss"
              onClick={() => {
                handleDismiss();
                setIsOpen(false);
              }}
            >
              عدم إظهار مرة أخرى
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TipItem({ tip }: Readonly<{ tip: Tip }>) {
  const Icon = getTipIcon(tip.icon);
  return (
    <div className="contextual-tips__item">
      <div className="contextual-tips__item-icon">
        <Icon aria-hidden="true" size={16} strokeWidth={2} />
      </div>
      <div className="contextual-tips__item-content">
        <h4>{tip.title}</h4>
        <p>{tip.description}</p>
      </div>
    </div>
  );
}

"use client";

import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { getPageTips, type PageKey, type Tip } from "@/lib/contextual-tips";
import { useAuthSession } from "@/lib/auth-session";
import { useContextualTips } from "@/lib/use-contextual-tips";

const iconRegistry = Icons as unknown as Record<string, LucideIcon>;
const getTipIcon = (name?: string) => iconRegistry[name || "Lightbulb"] || Icons.Lightbulb;

export default function ContextualTips({ page }: Readonly<{ page: PageKey }>) {
  const { isDismissed, isEnabled, handleDismiss, handleDismissSession, isHydrated } = useContextualTips(page);
  const { user } = useAuthSession();
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverId = useId();

  const closePopover = useCallback((returnFocus = true) => {
    setIsOpen(false);
    if (returnFocus) {
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!popoverRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        closePopover();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closePopover();
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closePopover, isOpen]);

  // Server-side render guard; a dismissed or globally-disabled tip renders nothing.
  if (!isHydrated || !isEnabled || isDismissed) return null;

  const tips = getPageTips(page, user?.role);
  if (tips.length === 0) return null;

  return (
    <div className="contextual-tips">
      <button
        type="button"
        className="contextual-tips__trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={`نصائح حول ${page}`}
        aria-expanded={isOpen}
        aria-controls={popoverId}
        title="نصائح اضغط لإظهار"
        data-dismissed="false"
        ref={triggerRef}
      >
        <Icons.HelpCircle aria-hidden="true" size={18} strokeWidth={2} />
        <span className="contextual-tips__badge">جديد</span>
      </button>

      {isOpen && (
        <div
          className="contextual-tips__popover"
          id={popoverId}
          ref={popoverRef}
          role="dialog"
          aria-modal="false"
          aria-labelledby={`${popoverId}-title`}
        >
          <div className="contextual-tips__header">
            <h3 id={`${popoverId}-title`}>نصائح سريعة</h3>
            <button
              type="button"
              className="contextual-tips__close"
              onClick={() => closePopover()}
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
                handleDismissSession();
                closePopover(false);
              }}
            >
              إخفاء لهذه الجلسة (تظهر بعد التحديث)
            </button>
            <button
              type="button"
              className="contextual-tips__dismiss contextual-tips__dismiss--secondary"
              onClick={() => {
                handleDismiss();
                closePopover(false);
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

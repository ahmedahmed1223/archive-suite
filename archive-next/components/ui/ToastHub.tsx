"use client";

import { CheckCircle2, Info, XCircle } from "lucide-react";
import { Toast, ToastClose, ToastDescription } from "@/components/ui/Toast";
import { dismissToast, useToasts, type ToastTone } from "@/lib/toast";

const toneIcon = {
  success: CheckCircle2,
  error: XCircle,
  info: Info
} as const;

function ToneIcon({ tone }: { tone: ToastTone }) {
  const Icon = toneIcon[tone];
  return <Icon aria-hidden="true" size={18} strokeWidth={2} />;
}

export default function ToastHub() {
  const toasts = useToasts();

  return (
    <>
      {toasts.map((item) => (
        <Toast
          key={item.id}
          className="ui-toast"
          data-tone={item.tone}
          duration={5000}
          onOpenChange={(open) => {
            if (!open) dismissToast(item.id);
          }}
        >
          <span className="ui-toast__icon" aria-hidden="true">
            <ToneIcon tone={item.tone} />
          </span>
          <ToastDescription className="ui-toast__message">{item.message}</ToastDescription>
          <ToastClose className="ui-toast__close" aria-label="إغلاق">
            ×
          </ToastClose>
        </Toast>
      ))}
    </>
  );
}

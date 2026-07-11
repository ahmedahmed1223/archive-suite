import type { ReactNode } from "react";
import EmptyState from "@/components/EmptyState";

export interface AsyncStateAction {
  label: string;
  onClick: () => void;
}

export default function AsyncStateSurface({
  status,
  title,
  description,
  action,
  onRetry,
  retryLabel = "إعادة المحاولة",
  children
}: Readonly<{
  status: "loading" | "empty" | "error" | "success";
  title?: ReactNode;
  description?: ReactNode;
  action?: AsyncStateAction;
  onRetry?: () => void;
  retryLabel?: string;
  children?: ReactNode;
}>) {
  if (status === "success") {
    return <>{children}</>;
  }

  const defaultTitle = status === "loading" ? "جار التحميل..." : status === "error" ? "تعذر إكمال الطلب" : "لا توجد نتائج";
  const primaryAction = action ? (
    <button type="button" className="button primary" onClick={action.onClick}>
      {action.label}
    </button>
  ) : onRetry ? (
    <button type="button" className="button primary" onClick={onRetry}>
      {retryLabel}
    </button>
  ) : undefined;

  return (
    <section
      className="async-state-surface"
      data-status={status}
      aria-busy={status === "loading"}
      aria-live={status === "error" ? "assertive" : "polite"}
      role={status === "error" ? "alert" : "status"}
    >
      <EmptyState title={title ?? defaultTitle} description={description} actions={primaryAction} />
    </section>
  );
}

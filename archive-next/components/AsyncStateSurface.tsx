import type { ReactNode } from "react";
import EmptyState from "@/components/EmptyState";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export interface AsyncStateAction {
  label: string;
  onClick: () => void;
}

export default function AsyncStateSurface({
  status,
  title,
  description,
  actions: customActions,
  action,
  secondaryAction,
  onRetry,
  retryLabel,
  loadingLabel,
  children
}: Readonly<{
  status: "loading" | "empty" | "error" | "success";
  title?: ReactNode;
  description?: ReactNode;
  /** Caller-provided action content for an async state. */
  actions?: ReactNode;
  action?: AsyncStateAction;
  /** V14-UX-004: an optional quieter companion to `action` (e.g. saved views). */
  secondaryAction?: AsyncStateAction;
  onRetry?: () => void;
  retryLabel?: string;
  /** V14-UX-004: overrides the generic loading copy while aria-busy holds. */
  loadingLabel?: ReactNode;
  children?: ReactNode;
}>) {
  const { t } = useLocale();
  if (status === "success") {
    return <>{children}</>;
  }

  const defaultTitle = status === "loading" ? t.shared.feedback.loading : status === "error" ? t.shared.feedback.genericError : t.shared.feedback.noResults;

  const defaultActions = action || onRetry || secondaryAction ? (
    <div className="button-row">
      {action ? (
        <button type="button" className="button primary" onClick={action.onClick}>
          {action.label}
        </button>
      ) : onRetry ? (
        <button type="button" className="button primary" onClick={onRetry}>
          {retryLabel ?? t.shared.actions.retry}
        </button>
      ) : null}
      {secondaryAction ? (
        <button type="button" className="button button-secondary" onClick={secondaryAction.onClick}>
          {secondaryAction.label}
        </button>
      ) : null}
    </div>
  ) : undefined;

  return (
    <section
      className="async-state-surface"
      data-status={status}
      aria-busy={status === "loading"}
      aria-live={status === "error" ? "assertive" : "polite"}
      role={status === "error" ? "alert" : "status"}
    >
      <EmptyState
        title={title ?? (status === "loading" && loadingLabel ? loadingLabel : defaultTitle)}
        description={description}
        actions={customActions ?? defaultActions}
      />
    </section>
  );
}

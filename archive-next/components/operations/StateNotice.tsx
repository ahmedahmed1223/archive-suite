import type { ReactNode } from "react";
import AsyncStateSurface from "@/components/AsyncStateSurface";
import EmptyState from "@/components/EmptyState";

export type StateNoticeState = "loading" | "empty" | "error" | "offline" | "read-only" | "locked" | "conflict";

export interface StateNoticeProps {
  state: StateNoticeState;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

export function StateNotice({ state, title, description, actions }: Readonly<StateNoticeProps>) {
  if (state === "loading" || state === "empty" || state === "error") {
    return <AsyncStateSurface status={state} title={title} description={description} loadingLabel={title} actions={actions} />;
  }

  const isConflict = state === "conflict";
  return (
    <section
      className="state-notice"
      data-state={state}
      role={isConflict ? "alert" : "status"}
      aria-live={isConflict ? "assertive" : "polite"}
    >
      <EmptyState title={title} description={description} actions={actions} />
    </section>
  );
}

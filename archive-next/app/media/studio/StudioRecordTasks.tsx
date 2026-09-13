"use client";

import { useEffect, useMemo, useState } from "react";
import EmptyState from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { createArchiveApiClient, type ProjectTask, type ProjectTaskStatus } from "@/lib/archive-api";
import { useLocale } from "@/lib/i18n/LocaleProvider";

type TasksState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; tasks: ProjectTask[] };

const statusOrder: Record<ProjectTaskStatus, number> = {
  in_progress: 0,
  review: 1,
  todo: 2,
  done: 3
};

function dueTimestamp(task: ProjectTask): number {
  if (!task.dueDate) return Number.POSITIVE_INFINITY;
  const value = new Date(task.dueDate).getTime();
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

export function tasksForRecord(recordId: string, tasks: ProjectTask[]): ProjectTask[] {
  if (!recordId) return [];

  return tasks
    .filter((task) => task.recordId === recordId)
    .sort((left, right) =>
      statusOrder[left.status] - statusOrder[right.status] ||
      dueTimestamp(left) - dueTimestamp(right) ||
      left.title.localeCompare(right.title)
    );
}

function taskStatusLabel(status: ProjectTaskStatus, columns: Record<"todo" | "inProgress" | "review" | "done", string>): string {
  if (status === "in_progress") return columns.inProgress;
  return columns[status];
}

export default function StudioRecordTasks({ recordId }: Readonly<{ recordId: string }>) {
  const { locale, t } = useLocale();
  const copy = t.pages.projectTasks;
  const api = useMemo(() => createArchiveApiClient(), []);
  const [state, setState] = useState<TasksState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });

    api.projectTasks().then((response) => {
      if (!active) return;
      setState(
        response.ok
          ? { status: "ready", tasks: tasksForRecord(recordId, response.tasks) }
          : { status: "error", message: response.error || copy.loadErrorTitle }
      );
    });

    return () => {
      active = false;
    };
  }, [api, copy.loadErrorTitle, recordId]);

  const tasksHref = `/project-tasks?recordId=${encodeURIComponent(recordId)}`;

  return (
    <article className="panel" aria-label={copy.toolbarTitle}>
      <div className="panel-title-row">
        <div>
          <h2>{copy.toolbarTitle}</h2>
          <p className="helper-text">{t.pages.mediaStudio.description}</p>
        </div>
        <a className="button button-secondary button-sm" href={tasksHref}>
          {copy.recordsKanban}
        </a>
      </div>

      {state.status === "loading" ? <Skeleton label={copy.loadingLabel} /> : null}

      {state.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>{copy.loadErrorTitle}</strong>
          <p className="helper-text">{state.message}</p>
        </div>
      ) : null}

      {state.status === "ready" && state.tasks.length === 0 ? (
        <EmptyState title={copy.emptyTitle} description={copy.emptyDescription} />
      ) : null}

      {state.status === "ready" && state.tasks.length > 0 ? (
        <ul className="record-note-list">
          {state.tasks.map((task) => (
            <li key={task.id}>
              <div>
                <strong>{task.title}</strong>
                <div className="helper-row">
                  <span className="badge">{taskStatusLabel(task.status, copy.columns)}</span>
                  <span className="helper-text">
                    {task.assignee || copy.unassigned} · {task.dueDate || copy.noDueDate}
                  </span>
                </div>
              </div>
              <small className="helper-text">
                {copy.lastUpdatedPrefix.replace(
                  "{date}",
                  new Date(task.updatedAt).toLocaleDateString(locale === "en" ? "en-US" : "ar-SA")
                )}
              </small>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

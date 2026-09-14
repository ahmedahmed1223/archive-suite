import type { ReactNode } from "react";
import styles from "./studio.module.css";

export type StudioReadinessKey = "source" | "technical" | "description";
export type StudioReadinessStatus = "ready" | "needs-attention";

export type StudioReadinessItem = {
  key: StudioReadinessKey;
  status: StudioReadinessStatus;
};

export function readinessItemsForStudio(input: {
  hasSource: boolean;
  hasTechnicalSpec: boolean;
  hasTranscript: boolean;
}): StudioReadinessItem[] {
  return [
    { key: "source", status: input.hasSource ? "ready" : "needs-attention" },
    { key: "technical", status: input.hasTechnicalSpec ? "ready" : "needs-attention" },
    { key: "description", status: input.hasTranscript ? "ready" : "needs-attention" }
  ];
}

export function nextReadinessKeyForStudio(input: {
  hasSource: boolean;
  hasTechnicalSpec: boolean;
  hasTranscript: boolean;
}): StudioReadinessKey | null {
  return readinessItemsForStudio(input).find((item) => item.status === "needs-attention")?.key ?? null;
}

type ReadinessCopy = {
  title: string;
  nextAction: string;
  statusReady: string;
  statusNeedsAttention: string;
  items: Record<StudioReadinessKey, string>;
};

export default function StudioReadinessStrip({
  hasSource,
  hasTechnicalSpec,
  hasTranscript,
  copy,
  action
}: {
  hasSource: boolean;
  hasTechnicalSpec: boolean;
  hasTranscript: boolean;
  copy: ReadinessCopy;
  action: ReactNode;
}) {
  const items = readinessItemsForStudio({ hasSource, hasTechnicalSpec, hasTranscript });
  const nextItem = items.find((item) => item.status === "needs-attention");

  return (
    <section className={styles.readinessStrip} aria-label={copy.title}>
      <div>
        <p className={styles.readinessEyebrow}>{copy.title}</p>
        <ol className={styles.readinessList}>
          {items.map((item) => (
            <li key={item.key} className={item.status === "ready" ? styles.readinessReady : styles.readinessNeedsAttention}>
              <span aria-hidden="true">{item.status === "ready" ? "✓" : "!"}</span>
              <span>{copy.items[item.key]}</span>
              <small>{item.status === "ready" ? copy.statusReady : copy.statusNeedsAttention}</small>
            </li>
          ))}
        </ol>
      </div>
      {nextItem ? (
        <div className={styles.nextAction}>
          <span>{copy.nextAction}: {copy.items[nextItem.key]}</span>
          {action}
        </div>
      ) : null}
    </section>
  );
}

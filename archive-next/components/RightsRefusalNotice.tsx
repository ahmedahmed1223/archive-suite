"use client";

import Link from "next/link";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { RightsRefusal } from "@/lib/archive-api";

/**
 * A rights refusal is the one refusal the user can act on, so it is shown as
 * the clause that decided it rather than a generic "forbidden". Known
 * decision codes get localized wording; a window id keeps the server's own
 * sentence, which names the window the operator has to open.
 */
const DECISION_COPY = {
  no_record: "noRecord",
  no_window_for_usage: "noWindowForUsage",
  unknown_window: "unknownWindow",
} as const;

export default function RightsRefusalNotice({ refusal }: Readonly<{ refusal: RightsRefusal }>) {
  const { t } = useLocale();
  const copy = t.shared.rightsRefusal;
  const known = DECISION_COPY[refusal.decidedBy as keyof typeof DECISION_COPY];

  return (
    <div className="state-banner state-banner-error" role="alert" data-decided-by={refusal.decidedBy}>
      <strong>{copy.title}</strong>
      <span className="helper-text">{known ? copy[known] : refusal.reason}</span>
      <dl className="helper-text">
        {refusal.itemId ? (
          <>
            <dt>{copy.itemLabel}</dt>
            <dd>{refusal.itemId}</dd>
          </>
        ) : null}
        <dt>{copy.reasonLabel}</dt>
        <dd>{refusal.reason}</dd>
        <dt>{copy.clauseLabel}</dt>
        <dd>{refusal.decidedBy}</dd>
      </dl>
      <Link className="button button-secondary" href="/rights">{copy.openRights}</Link>
    </div>
  );
}

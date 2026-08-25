"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useMemo } from "react";

export type WorkResumeTarget = {
  pathname: string;
  label: string;
  visitedAt: string; // ISO timestamp
};

const DAY_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * V15-DAILY-004: a quiet, contextual resume link shown inside the existing
 * command surface only when there is a safe, recent, permission-valid saved
 * workspace that differs from the current page. Never surfaces a search query
 * or record title, and never adds a global banner.
 */
export default function WorkResumeLink({
  target,
  pathname,
  enabled,
  resumeLabel,
}: Readonly<{
  target: WorkResumeTarget | null;
  pathname: string;
  enabled: boolean;
  resumeLabel: string;
}>) {
  const isStale = useMemo(() => {
    if (!target) return true;
    const age = Date.now() - new Date(target.visitedAt).getTime();
    return Number.isNaN(age) || age > DAY_MS;
  }, [target]);

  if (!enabled || !target || isStale || target.pathname === pathname) {
    return null;
  }

  const relative = formatRelative(target.visitedAt);

  return (
    <Link className="workspace-resume-link" href={target.pathname}>
      <ArrowRight size={14} aria-hidden="true" />
      <span>{resumeLabel.replace("{name}", target.label)}</span>
      <small>{relative}</small>
    </Link>
  );
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMin = Math.round((Date.now() - then) / 60000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (diffMin < 60) return rtf.format(-diffMin, "minute");
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return rtf.format(-diffHr, "hour");
  return rtf.format(-Math.round(diffHr / 24), "day");
}

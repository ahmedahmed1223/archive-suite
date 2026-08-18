"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { ArchiveApiClient, SearchFacetBucket } from "@/lib/archive-api";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function sevenDaysAgoDate(): string {
  return new Date(Date.now() - WEEK_MS).toISOString().slice(0, 10);
}

type CountState = { status: "loading" } | { status: "ready"; count: number } | { status: "unavailable" };

interface HomeActivitySummaryProps {
  api: ArchiveApiClient;
  accessToken?: string | null;
  /** From the caller's own unfiltered /search call -- real facets, not refetched here. */
  totalRecords: number | undefined;
  typeFacets: SearchFacetBucket[] | undefined;
}

/**
 * V3-SET-006 scope extension: a home-page activity panel built entirely from
 * the existing /search endpoint's facets -- no new API endpoint. Every
 * number here is `SearchFacets.total` from a real, live query; if the
 * server doesn't return a total for a given query, that metric renders as
 * "not enough data" rather than falling back to a guessed or placeholder
 * number (records.length under a limit:1 query would be misleading, not a
 * real count).
 */
export default function HomeActivitySummary({ api, accessToken, totalRecords, typeFacets }: Readonly<HomeActivitySummaryProps>) {
  const { locale, t } = useLocale();
  const copy = t.pages.home.activity;
  const en = locale === "en";
  const [weeklyAdditions, setWeeklyAdditions] = useState<CountState>({ status: "loading" });
  const [descriptionComplete, setDescriptionComplete] = useState<CountState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [weekly, complete] = await Promise.all([
        api.search({ dateFrom: sevenDaysAgoDate(), limit: 1 }, { accessToken: accessToken ?? undefined }),
        api.search({ descriptionState: "complete", limit: 1 }, { accessToken: accessToken ?? undefined })
      ]);

      if (cancelled) return;

      setWeeklyAdditions(
        weekly.ok && typeof weekly.facets?.total === "number" ? { status: "ready", count: weekly.facets.total } : { status: "unavailable" }
      );
      setDescriptionComplete(
        complete.ok && typeof complete.facets?.total === "number"
          ? { status: "ready", count: complete.facets.total }
          : { status: "unavailable" }
      );
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [api, accessToken]);

  const completionPercent =
    descriptionComplete.status === "ready" && typeof totalRecords === "number" && totalRecords > 0
      ? Math.round((descriptionComplete.count / totalRecords) * 100)
      : null;

  const typeBuckets = (typeFacets ?? []).filter((bucket) => bucket.count > 0);
  const typeTotal = typeBuckets.reduce((sum, bucket) => sum + bucket.count, 0);

  return (
    <section className="panel dashboard-activity" aria-label={copy.ariaLabel}>
      <h2>{copy.heading}</h2>

      <dl className="kv-grid mt-tight">
        <div className="kv-item">
          <dt>{copy.weeklyAdditions}</dt>
          <dd>
            {weeklyAdditions.status === "loading" && <span className="helper-text" role="status">{copy.loading}</span>}
            {weeklyAdditions.status === "unavailable" && <span className="helper-text">{copy.noData}</span>}
            {weeklyAdditions.status === "ready" && <strong>{weeklyAdditions.count.toLocaleString(en ? "en-US" : "ar-EG")}</strong>}
          </dd>
        </div>

        <div className="kv-item">
          <dt>{copy.descriptionCompletion}</dt>
          <dd>
            {descriptionComplete.status === "loading" && <span className="helper-text" role="status">{copy.loading}</span>}
            {descriptionComplete.status === "unavailable" || completionPercent === null ? (
              <span className="helper-text">{copy.noData}</span>
            ) : descriptionComplete.status === "ready" ? (
              <>
                <strong>{`${completionPercent}%`}</strong>
                <span className="helper-text mt-tight">
                  {copy.descriptionCompletionHint
                    .replace("{complete}", descriptionComplete.count.toLocaleString(en ? "en-US" : "ar-EG"))
                    .replace("{total}", String(totalRecords))}
                </span>
              </>
            ) : null}
          </dd>
        </div>
      </dl>

      <div className="section-divider">
        <strong>{copy.typeDistribution}</strong>
        {typeBuckets.length === 0 ? (
          <p className="helper-text mt-tight">{copy.noData}</p>
        ) : (
          <ul className="dashboard-activity__type-list mt-tight">
            {typeBuckets.map((bucket) => (
              <li key={bucket.value} className="dashboard-activity__type-row">
                <span>{bucket.label}</span>
                <span className="dashboard-activity__type-bar" aria-hidden="true">
                  <span style={{ inlineSize: `${Math.max(4, Math.round((bucket.count / typeTotal) * 100))}%` }} />
                </span>
                <span className="helper-text">{bucket.count.toLocaleString(en ? "en-US" : "ar-EG")}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

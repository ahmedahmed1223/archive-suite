"use client";

import { Archive, Clock3, FileType2, Layers, Search, Tags, UploadCloud } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import MetricStrip, { type MetricStripItem } from "@/components/MetricStrip";
import { useAuthSession } from "@/lib/auth-session";
import { createArchiveApiClient, type ArchiveRecord, type SearchFacets } from "@/lib/archive-api";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { getLocalizedNavigation } from "@/lib/navigation";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; records: ArchiveRecord[]; facets?: SearchFacets };

const quickLinks = [
  { href: "/uploads", labelKey: "uploads", icon: UploadCloud, tone: "accent" as const },
  { href: "/search", labelKey: "search", icon: Search, tone: "default" as const },
  { href: "/collections", labelKey: "collections", icon: Layers, tone: "default" as const },
  { href: "/tags", labelKey: "tags", icon: Tags, tone: "default" as const },
  { href: "/types", labelKey: "types", icon: FileType2, tone: "default" as const }
] as const;

const RECENT_LIMIT = 8;

const todayLabel = (locale: "ar" | "en") =>
  new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ar", { weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(new Date());

export default function HomeDashboard() {
  const { locale, t } = useLocale();
  const localizedNavigation = getLocalizedNavigation(locale).items;
  const en = locale === "en";
  const copy = t.pages.home;
  const api = useMemo(() => createArchiveApiClient(), []);
  const auth = useAuthSession();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const response = await api.search({ limit: RECENT_LIMIT });
      if (cancelled) return;
      if (!response.ok) {
        setState({ status: "error", message: response.error || copy.error });
        return;
      }
      setState({ status: "ready", records: response.records, facets: response.facets });
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [api, copy.error]);

  const metrics = useMemo<MetricStripItem[]>(() => {
    if (state.status !== "ready") return [];
    const facets = state.facets;
    const total = facets?.total ?? state.records.length;
    const typeCount = facets?.types?.length ?? 0;
    const tagCount = facets?.tags?.length ?? 0;
    const storeCount = facets?.stores?.length ?? 0;
    const topType = facets?.types?.[0];

    return [
      { label: copy.total, value: total.toLocaleString(en ? "en-US" : "ar-EG"), icon: <Archive />, tone: "accent" },
      { label: copy.types, value: typeCount.toLocaleString(en ? "en-US" : "ar-EG"), description: topType ? `${copy.most}: ${topType.label}` : undefined, icon: <FileType2 />, tone: "info" },
      { label: copy.tags, value: tagCount.toLocaleString(en ? "en-US" : "ar-EG"), icon: <Tags />, tone: "default" },
      { label: copy.stores, value: storeCount.toLocaleString(en ? "en-US" : "ar-EG"), icon: <Layers />, tone: "default" }
    ];
  }, [copy, en, state]);

  const role = auth.user?.role ?? "viewer";
  const greeting = copy.greetings[role as keyof typeof copy.greetings] ?? copy.greetings.viewer;
  const roleLabel = copy.roles[role as keyof typeof copy.roles] ?? copy.roles.viewer;

  return (
    <AppShell subtitle={t.pageTitles.dashboard} tipsPage="dashboard">
      <header className="dashboard-greeting">
        <div className="dashboard-greeting__intro">
          <h1>{greeting}</h1>
          <p>{roleLabel} · {todayLabel(locale)}</p>
        </div>
        <Link className="ui-button ui-button-primary" href="/uploads">
          <UploadCloud aria-hidden="true" size={16} strokeWidth={2} />
          <span>{copy.add}</span>
        </Link>
      </header>

      {state.status === "loading" ? (
        <section className="panel">
          <Skeleton label={copy.loading} />
        </section>
      ) : null}

      {state.status === "error" ? (
        <EmptyState
          icon={<Archive aria-hidden="true" />}
          title={copy.errorTitle}
          description={state.message}
          actions={<Link className="ui-button ui-button-secondary" href="/archive">{copy.openArchive}</Link>}
        />
      ) : null}

      {state.status === "ready" ? (
        <>
          <MetricStrip items={metrics} ariaLabel={copy.metrics} />

          <div className="dashboard-workspace-grid">
            <nav className="dashboard-quick" aria-label={copy.quick}>
              {quickLinks.map((link) => {
                const Icon = link.icon;
                const label = localizedNavigation.find((item) => item.href === link.href)?.label ?? copy.quickLinks[link.labelKey];
                return (
                  <Link
                    key={link.href}
                    className="dashboard-quick__link"
                    data-tone={link.tone ?? "default"}
                    href={link.href}
                  >
                    <Icon aria-hidden="true" size={18} strokeWidth={2} />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </nav>

            <section className="panel dashboard-recent" aria-label={copy.recent}>
              <header className="dashboard-recent__header">
                <h2>
                  <Clock3 aria-hidden="true" size={18} strokeWidth={2} />
                  <span>{copy.recent}</span>
                </h2>
                <Link className="dashboard-recent__all" href="/archive">{copy.all}</Link>
              </header>

              {state.records.length === 0 ? (
                <EmptyState
                  icon={<Archive aria-hidden="true" />}
                  title={copy.empty}
                  description={copy.emptyDescription}
                  actions={<Link className="ui-button ui-button-primary" href="/uploads">{copy.add}</Link>}
                />
              ) : (
                <ul className="dashboard-recent__grid">
                  {state.records.map((record) => (
                    <li key={record.id}>
                      <Link className="dashboard-recent__card" href={`/archive/${encodeURIComponent(record.id)}`}>
                        {record.type ? <span className="dashboard-recent__card-type">{record.type}</span> : null}
                        <span className="dashboard-recent__card-title">{record.title || copy.untitled}</span>
                        {record.updatedAt ? <span className="dashboard-recent__card-date">{new Date(record.updatedAt).toLocaleDateString(en ? "en-US" : "ar-SA")}</span> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      ) : null}
    </AppShell>
  );
}

"use client";

import { Archive, Clock3, FileType2, Layers, Search, Tags, UploadCloud } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import MetricStrip, { type MetricStripItem } from "@/components/MetricStrip";
import { useAuthSession } from "@/lib/auth-session";
import { createArchiveApiClient, type ArchiveRecord, type SearchFacets } from "@/lib/archive-api";
import { formatDate } from "@/lib/record-utils";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { getLocalizedNavigation } from "@/lib/navigation";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; records: ArchiveRecord[]; facets?: SearchFacets };

const quickLinks = [
  { href: "/uploads", label: "إضافة مادة", icon: UploadCloud, tone: "accent" as const },
  { href: "/search", label: "البحث", icon: Search },
  { href: "/collections", label: "المجموعات", icon: Layers },
  { href: "/tags", label: "الوسوم", icon: Tags },
  { href: "/types", label: "الأنواع", icon: FileType2 }
];

const RECENT_LIMIT = 8;

const roleLabels: Record<string, string> = {
  admin: "مدير الأرشيف",
  editor: "محرر إعلامي",
  viewer: "مشاهد/باحث"
};

const roleGreetings: Record<string, string> = {
  admin: "مرحباً بعودتك، أدر أرشيفك بثقة",
  editor: "مرحباً بعودتك، هيا نكمل التوصيف",
  viewer: "مرحباً بعودتك، اكتشف ما هو جديد"
};

const todayLabel = () =>
  new Intl.DateTimeFormat("ar", { weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(new Date());

export default function HomeDashboard() {
  const { locale } = useLocale();
  const localizedNavigation = getLocalizedNavigation(locale).items;
  const en = locale === "en";
  const copy = useMemo(() => (en ? {
    add: "Add material", loading: "Loading dashboard data…", error: "Unable to load dashboard data.", errorTitle: "Dashboard unavailable", openArchive: "Open archive", metrics: "Archive metrics", quick: "Quick actions", recent: "Recently added", all: "View all", empty: "No records yet", emptyDescription: "Start by adding your first item to the archive.", untitled: "Untitled", total: "Total records", types: "Types", tags: "Tags", stores: "Storage locations", most: "Most common", roles: { admin: "Archive manager", editor: "Media editor", viewer: "Viewer / researcher" }, greetings: { admin: "Welcome back — manage your archive with confidence", editor: "Welcome back — let’s continue describing materials", viewer: "Welcome back — discover what is new" },
  } : {
    add: "إضافة مادة", loading: "جارٍ تحميل بيانات اللوحة…", error: "تعذر تحميل بيانات اللوحة.", errorTitle: "تعذر تحميل اللوحة", openArchive: "فتح الأرشيف", metrics: "مؤشرات الأرشيف", quick: "مهام سريعة", recent: "أُضيف حديثاً", all: "عرض الكل", empty: "لا توجد سجلات بعد", emptyDescription: "ابدأ بإضافة أول مادة إلى الأرشيف.", untitled: "بدون عنوان", total: "إجمالي السجلات", types: "الأنواع", tags: "الوسوم", stores: "المخازن", most: "الأكثر", roles: roleLabels, greetings: roleGreetings,
  }), [en]);
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
    <AppShell subtitle="لوحة المتابعة" tipsPage="dashboard">
      <header className="dashboard-greeting">
        <div className="dashboard-greeting__intro">
          <h1>{greeting}</h1>
          <p>{roleLabel} · {todayLabel()}</p>
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
                const label = localizedNavigation.find((item) => item.href === link.href)?.label ?? link.label;
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
                        {record.updatedAt ? <span className="dashboard-recent__card-date">{formatDate(record.updatedAt)}</span> : null}
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

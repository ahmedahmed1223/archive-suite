"use client";

import { Archive, Clock3, FileType2, Layers, Search, Tags, UploadCloud } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import MetricStrip, { type MetricStripItem } from "@/components/MetricStrip";
import PageToolbar from "@/components/PageToolbar";
import { createArchiveApiClient, type ArchiveRecord, type SearchFacets } from "@/lib/archive-api";
import { formatDate } from "@/lib/record-utils";

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

export default function HomeDashboard() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const response = await api.search({ limit: RECENT_LIMIT });
      if (cancelled) return;
      if (!response.ok) {
        setState({ status: "error", message: response.error || "تعذر تحميل بيانات اللوحة." });
        return;
      }
      setState({ status: "ready", records: response.records, facets: response.facets });
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [api]);

  const metrics = useMemo<MetricStripItem[]>(() => {
    if (state.status !== "ready") return [];
    const facets = state.facets;
    const total = facets?.total ?? state.records.length;
    const typeCount = facets?.types?.length ?? 0;
    const tagCount = facets?.tags?.length ?? 0;
    const storeCount = facets?.stores?.length ?? 0;
    const topType = facets?.types?.[0];

    return [
      { label: "إجمالي السجلات", value: total.toLocaleString("ar-EG"), icon: <Archive />, tone: "accent" },
      { label: "الأنواع", value: typeCount.toLocaleString("ar-EG"), description: topType ? `الأكثر: ${topType.label}` : undefined, icon: <FileType2 />, tone: "info" },
      { label: "الوسوم", value: tagCount.toLocaleString("ar-EG"), icon: <Tags />, tone: "default" },
      { label: "المخازن", value: storeCount.toLocaleString("ar-EG"), icon: <Layers />, tone: "default" }
    ];
  }, [state]);

  return (
    <AppShell subtitle="لوحة المتابعة">
      <PageToolbar
        icon={<Archive aria-hidden="true" />}
        eyebrow={<span className="badge">اللوحة الرئيسية</span>}
        title="لوحة المتابعة"
        description="نظرة سريعة على الأرشيف: المؤشرات الحية، أحدث السجلات، والوصول المباشر لمهام العمل اليومي."
        actions={(
          <Link className="ui-button ui-button-primary" href="/uploads">
            <UploadCloud aria-hidden="true" size={16} strokeWidth={2} />
            <span>إضافة مادة</span>
          </Link>
        )}
      />

      {state.status === "loading" ? (
        <section className="panel" aria-busy="true">
          <p className="muted">جار تحميل بيانات اللوحة...</p>
        </section>
      ) : null}

      {state.status === "error" ? (
        <EmptyState
          icon={<Archive aria-hidden="true" />}
          title="تعذر تحميل اللوحة"
          description={state.message}
          actions={<Link className="ui-button ui-button-secondary" href="/archive">فتح الأرشيف</Link>}
        />
      ) : null}

      {state.status === "ready" ? (
        <>
          <MetricStrip items={metrics} ariaLabel="مؤشرات الأرشيف" />

          <nav className="dashboard-quick" aria-label="مهام سريعة">
            {quickLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  className="dashboard-quick__link"
                  data-tone={link.tone ?? "default"}
                  href={link.href}
                >
                  <Icon aria-hidden="true" size={18} strokeWidth={2} />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          <section className="panel dashboard-recent" aria-label="أحدث السجلات">
            <header className="dashboard-recent__header">
              <h2>
                <Clock3 aria-hidden="true" size={18} strokeWidth={2} />
                <span>أحدث السجلات</span>
              </h2>
              <Link className="dashboard-recent__all" href="/archive">عرض الكل</Link>
            </header>

            {state.records.length === 0 ? (
              <EmptyState
                icon={<Archive aria-hidden="true" />}
                title="لا توجد سجلات بعد"
                description="ابدأ بإضافة أول مادة إلى الأرشيف."
                actions={<Link className="ui-button ui-button-primary" href="/uploads">إضافة مادة</Link>}
              />
            ) : (
              <ul className="dashboard-recent__list">
                {state.records.map((record) => (
                  <li key={record.id}>
                    <Link className="dashboard-recent__item" href={`/archive/${encodeURIComponent(record.id)}`}>
                      <span className="dashboard-recent__title">{record.title || "بدون عنوان"}</span>
                      <span className="dashboard-recent__meta">
                        {record.type ? <span className="badge">{record.type}</span> : null}
                        {record.updatedAt ? <span className="muted">{formatDate(record.updatedAt)}</span> : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </AppShell>
  );
}

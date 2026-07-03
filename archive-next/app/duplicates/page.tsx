"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { createArchiveApiClient, type ArchiveRecord } from "@/lib/archive-api";
import { formatDate, normalizeText } from "@/lib/record-utils";

interface DuplicateGroup {
  key: string;
  reason: string;
  records: ArchiveRecord[];
}

function checksumKey(record: ArchiveRecord) {
  const checksum = record.checksum || record.metadata?.checksum || record.metadata?.sha256;
  return typeof checksum === "string" && checksum.trim() ? `checksum:${checksum.trim()}` : "";
}

function titleKey(record: ArchiveRecord) {
  const title = normalizeText(record.title);
  return title.length > 3 ? `title:${title}` : "";
}

export default function DuplicatesPage() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [records, setRecords] = useState<ArchiveRecord[]>([]);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"checksum" | "title">("checksum");

  useEffect(() => {
    void (async () => {
      const response = await api.search({ limit: 1000 });
      if (response.ok) setRecords(response.records);
      else setError(response.error);
    })();
  }, [api]);

  const groups = useMemo<DuplicateGroup[]>(() => {
    const buckets = new Map<string, ArchiveRecord[]>();
    records.forEach((record) => {
      const key = mode === "checksum" ? checksumKey(record) : titleKey(record);
      if (!key) return;
      buckets.set(key, [...(buckets.get(key) || []), record]);
    });
    return Array.from(buckets.entries())
      .filter(([, items]) => items.length > 1)
      .map(([key, items]) => ({
        key,
        reason: key.startsWith("checksum:") ? "تطابق checksum" : "تشابه عنوان بعد التطبيع",
        records: items
      }))
      .sort((a, b) => b.records.length - a.records.length);
  }, [mode, records]);

  return (
    <AppShell subtitle="المكررات" contentClassName="local-list-content">
      <PageToolbar
        eyebrow={<span className="badge">Quality</span>}
        title="كشف المكررات"
        description="كشف مبدئي للمكررات اعتماداً على checksum عند توفره أو تشابه العنوان. الدمج والحذف يبقيان قراراً يدوياً حتى يتوفر endpoint مخصص."
        meta={(
          <>
            <span className="badge">{groups.length} مجموعة</span>
            <span className="badge">{records.length} سجل مفحوص</span>
          </>
        )}
        actions={<a className="button button-secondary" href="/archive">فتح الأرشيف</a>}
      >
        <div className="archive-toolbar-row">
          <button className="badge" data-active={mode === "checksum" ? "true" : "false"} type="button" onClick={() => setMode("checksum")}>حسب checksum</button>
          <button className="badge" data-active={mode === "title" ? "true" : "false"} type="button" onClick={() => setMode("title")}>حسب العنوان</button>
        </div>
      </PageToolbar>

      {error ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>تعذر فحص المكررات</strong>
          <span className="helper-text">{error}</span>
        </div>
      ) : null}

      {groups.length === 0 ? (
        <EmptyState title="لا توجد مكررات ظاهرة." description="لا توجد مجموعات مطابقة ضمن طريقة الفحص الحالية." />
      ) : (
        <section className="stack" aria-label="مجموعات المكررات">
          {groups.map((group) => (
            <article className="panel" key={group.key}>
              <div className="panel-title-row">
                <div>
                  <h2>{group.reason}</h2>
                  <p className="mono-text wrap-anywhere" dir="ltr">{group.key}</p>
                </div>
                <span className="badge badge-warning">{group.records.length} عناصر</span>
              </div>
              <div className="analytics-tag-list">
                {group.records.map((record) => (
                  <div className="analytics-tag-row" key={record.id}>
                    <span>
                      <strong>{record.title || record.id}</strong>
                      <small className="helper-text"> · {record.type || "غير محدد"} · {formatDate(record.updatedAt || record.createdAt)}</small>
                    </span>
                    <a className="button button-secondary button-sm" href={`/archive/${encodeURIComponent(record.id)}`}>فتح</a>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>
      )}
    </AppShell>
  );
}

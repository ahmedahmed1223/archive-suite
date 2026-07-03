"use client";

import type { FormEvent } from "react";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import DataViewSwitcher, { type DataViewOption } from "@/components/DataViewSwitcher";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { createArchiveApiClient, type ArchiveRecord } from "@/lib/archive-api";

type ArchiveState =
  | { status: "loading" }
  | { status: "ready"; records: ArchiveRecord[] }
  | { status: "error"; message: string };

type ArchiveViewMode = "grid" | "gallery" | "compact" | "list" | "details";
type ArchiveItemSize = "compact" | "comfortable" | "large";
type ArchiveSortField = "updatedAt" | "createdAt" | "title";
type ArchiveSortDirection = "asc" | "desc";

interface SavedArchiveView {
  id: string;
  name: string;
  query: string;
  store: string;
  type: string;
  viewMode: ArchiveViewMode;
  itemSize: ArchiveItemSize;
  sortField: ArchiveSortField;
  sortDirection: ArchiveSortDirection;
}

const SAVED_VIEWS_KEY = "masar:archive:savedViews";

const viewOptions: DataViewOption<ArchiveViewMode>[] = [
  { value: "grid", label: "شبكة", shortLabel: "شبكة" },
  { value: "gallery", label: "معرض", shortLabel: "معرض" },
  { value: "compact", label: "مضغوط", shortLabel: "مضغوط" },
  { value: "list", label: "قائمة", shortLabel: "قائمة" },
  { value: "details", label: "تفاصيل", shortLabel: "جدول" }
];

const itemSizeOptions: DataViewOption<ArchiveItemSize>[] = [
  { value: "compact", label: "مضغوط" },
  { value: "comfortable", label: "مريح" },
  { value: "large", label: "كبير" }
];

const sortLabels: Record<ArchiveSortField, string> = {
  updatedAt: "آخر تحديث",
  createdAt: "تاريخ الإنشاء",
  title: "العنوان"
};

function normalizeText(value: unknown) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLowerCase()
    .trim();
}

function getRecordSearchText(record: ArchiveRecord) {
  const metadata = record.metadata && typeof record.metadata === "object"
    ? Object.values(record.metadata).join(" ")
    : "";

  return normalizeText([
    record.title,
    record.description,
    record.store,
    record.type,
    record.subtype,
    (record.tags || []).join(" "),
    metadata
  ].join(" "));
}

function formatDate(value?: string) {
  if (!value) return "غير محدد";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ar-SA");
}

function getRecordTime(record: ArchiveRecord, field: Exclude<ArchiveSortField, "title">) {
  const value = field === "createdAt" ? record.createdAt : record.updatedAt;
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function getUniqueValues(records: ArchiveRecord[], key: "store" | "type") {
  return Array.from(new Set(records.map((record) => record[key]).filter((value): value is string => Boolean(value)))).sort((a, b) =>
    a.localeCompare(b, "ar")
  );
}

function getInitialViewMode(params: URLSearchParams): ArchiveViewMode {
  const value = params.get("view");
  if (viewOptions.some((option) => option.value === value)) {
    return value as ArchiveViewMode;
  }

  if (typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches) {
    return "list";
  }

  return "grid";
}

function getInitialItemSize(params: URLSearchParams): ArchiveItemSize {
  const value = params.get("size");
  return itemSizeOptions.some((option) => option.value === value) ? (value as ArchiveItemSize) : "compact";
}

function getInitialSortField(params: URLSearchParams): ArchiveSortField {
  const value = params.get("sort");
  return value === "createdAt" || value === "title" ? value : "updatedAt";
}

function readSavedViews(): SavedArchiveView[] {
  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(SAVED_VIEWS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function ArchivePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const api = useMemo(() => createArchiveApiClient(), []);

  const [state, setState] = useState<ArchiveState>({ status: "loading" });
  const [query, setQuery] = useState(() => searchParams.get("q") || "");
  const [store, setStore] = useState(() => searchParams.get("store") || "all");
  const [type, setType] = useState(() => searchParams.get("type") || "all");
  const [viewMode, setViewMode] = useState<ArchiveViewMode>(() => getInitialViewMode(searchParams));
  const [itemSize, setItemSize] = useState<ArchiveItemSize>(() => getInitialItemSize(searchParams));
  const [sortField, setSortField] = useState<ArchiveSortField>(() => getInitialSortField(searchParams));
  const [sortDirection, setSortDirection] = useState<ArchiveSortDirection>(() => searchParams.get("dir") === "asc" ? "asc" : "desc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [savedViews, setSavedViews] = useState<SavedArchiveView[]>([]);

  const loadRecords = useCallback(async (q: string) => {
    setState({ status: "loading" });
    const response = await api.search({ q, limit: 80 });

    if (!response.ok) {
      setState({ status: "error", message: response.error });
      return;
    }

    setState({
      status: "ready",
      records: response.records
    });
  }, [api]);

  useEffect(() => {
    setSavedViews(readSavedViews());
    void loadRecords(searchParams.get("q") || "");
  }, [loadRecords, searchParams]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (store !== "all") params.set("store", store);
    if (type !== "all") params.set("type", type);
    if (viewMode !== "grid") params.set("view", viewMode);
    if (itemSize !== "compact") params.set("size", itemSize);
    if (sortField !== "updatedAt") params.set("sort", sortField);
    if (sortDirection !== "desc") params.set("dir", sortDirection);

    const next = params.toString();
    router.replace(next ? `/archive?${next}` : "/archive", { scroll: false });
  }, [itemSize, query, router, sortDirection, sortField, store, type, viewMode]);

  const records = state.status === "ready" ? state.records : [];
  const storeOptions = useMemo(() => getUniqueValues(records, "store"), [records]);
  const typeOptions = useMemo(() => getUniqueValues(records, "type"), [records]);

  const visibleRecords = useMemo(() => {
    const normalizedQuery = normalizeText(query);
    const filtered = records.filter((record) => {
      if (store !== "all" && record.store !== store) return false;
      if (type !== "all" && record.type !== type) return false;
      if (!normalizedQuery) return true;
      return getRecordSearchText(record).includes(normalizedQuery);
    });

    return filtered.sort((a, b) => {
      const multiplier = sortDirection === "asc" ? 1 : -1;
      if (sortField === "title") {
        return a.title.localeCompare(b.title, "ar") * multiplier;
      }

      return (getRecordTime(a, sortField) - getRecordTime(b, sortField)) * multiplier;
    });
  }, [query, records, sortDirection, sortField, store, type]);

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const previewRecord = useMemo(() => {
    if (previewId) {
      return visibleRecords.find((record) => record.id === previewId) || visibleRecords[0] || null;
    }

    return visibleRecords.find((record) => selectedIdSet.has(record.id)) || visibleRecords[0] || null;
  }, [previewId, selectedIdSet, visibleRecords]);

  const activeFilterCount = [
    query.trim(),
    store !== "all",
    type !== "all",
    sortField !== "updatedAt",
    sortDirection !== "desc"
  ].filter(Boolean).length;

  const handleSearch = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    await loadRecords(query);
  };

  const toggleSelection = (recordId: string) => {
    setSelectedIds((current) =>
      current.includes(recordId)
        ? current.filter((id) => id !== recordId)
        : [...current, recordId]
    );
  };

  const toggleSelectAllVisible = () => {
    setSelectedIds((current) => {
      const allVisibleSelected = visibleRecords.length > 0 && visibleRecords.every((record) => current.includes(record.id));
      return allVisibleSelected ? [] : visibleRecords.map((record) => record.id);
    });
  };

  const resetFilters = () => {
    setQuery("");
    setStore("all");
    setType("all");
    setSortField("updatedAt");
    setSortDirection("desc");
    setSelectedIds([]);
    setPreviewId(null);
  };

  const saveCurrentView = () => {
    const name = window.prompt("اسم العرض المحفوظ");
    if (!name?.trim()) return;

    const nextView: SavedArchiveView = {
      id: crypto.randomUUID(),
      name: name.trim(),
      query,
      store,
      type,
      viewMode,
      itemSize,
      sortField,
      sortDirection
    };
    const nextViews = [nextView, ...savedViews].slice(0, 12);
    window.localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(nextViews));
    setSavedViews(nextViews);
  };

  const applySavedView = (view: SavedArchiveView) => {
    setQuery(view.query);
    setStore(view.store);
    setType(view.type);
    setViewMode(view.viewMode);
    setItemSize(view.itemSize);
    setSortField(view.sortField);
    setSortDirection(view.sortDirection);
    setSelectedIds([]);
    void loadRecords(view.query);
  };

  const removeSavedView = (viewId: string) => {
    const nextViews = savedViews.filter((view) => view.id !== viewId);
    window.localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(nextViews));
    setSavedViews(nextViews);
  };

  const renderRecordCard = (record: ArchiveRecord) => {
    const isSelected = selectedIdSet.has(record.id);

    return (
      <article
        key={record.id}
        className="record-card"
        data-size={itemSize}
        data-selected={isSelected ? "true" : "false"}
        role="listitem"
        onMouseEnter={() => setPreviewId(record.id)}
      >
        <div className="record-card__select">
          <input
            type="checkbox"
            aria-label={`تحديد ${record.title || "السجل"}`}
            checked={isSelected}
            onChange={() => toggleSelection(record.id)}
          />
        </div>
        <div className="record-card__body">
          <div className="panel-title-row">
            <h2>
              <a href={`/archive/${encodeURIComponent(record.id)}`} className="text-accent">
                {record.title || "بدون عنوان"}
              </a>
            </h2>
            <button type="button" className="badge" onClick={() => setPreviewId(record.id)}>
              معاينة
            </button>
          </div>
          {record.description ? (
            <p className="record-card__description">
              {record.description.substring(0, itemSize === "large" ? 220 : 130)}
              {record.description.length > (itemSize === "large" ? 220 : 130) ? "..." : ""}
            </p>
          ) : null}
          <div className="record-meta">
            {record.store ? <span className="badge">{record.store}</span> : null}
            {record.type ? <span className="badge">{record.type}</span> : null}
            {record.subtype ? <span className="badge">{record.subtype}</span> : null}
            <time className="created-at">{formatDate(record.updatedAt || record.createdAt)}</time>
          </div>
          {record.tags && record.tags.length > 0 ? (
            <div className="tags">
              {record.tags.slice(0, itemSize === "large" ? 6 : 3).map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
              {record.tags.length > (itemSize === "large" ? 6 : 3) ? (
                <span className="tag muted">+{record.tags.length - (itemSize === "large" ? 6 : 3)}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      </article>
    );
  };

  return (
    <AppShell subtitle="مركز السجلات" contentClassName="archive-content">
      <PageToolbar
        eyebrow={<span className="badge">Archive Operations</span>}
        title="الأرشيف"
        description="بحث، فرز، معاينة، وتحديد جماعي للسجلات داخل واجهة تشغيل واحدة."
        meta={(
          <>
            <span className="badge">{visibleRecords.length} نتيجة</span>
            <span className="badge">{activeFilterCount} فلتر نشط</span>
            <span className="badge">{selectedIds.length} محدد</span>
          </>
        )}
        actions={(
          <>
            <a className="button button-primary" href="/files">استيراد ملفات</a>
            <button type="button" className="button button-secondary" onClick={saveCurrentView}>حفظ العرض</button>
          </>
        )}
      >
        <form className="archive-toolbar-grid" onSubmit={handleSearch}>
          <label>
            <span>بحث</span>
            <input
              type="search"
              placeholder="العنوان، الوسوم، الوصف، metadata..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="search-input"
            />
          </label>
          <label>
            <span>المخزن</span>
            <select value={store} onChange={(e) => setStore(e.target.value)}>
              <option value="all">كل المخازن</option>
              {storeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            <span>النوع</span>
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="all">كل الأنواع</option>
              {typeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label>
            <span>الفرز</span>
            <select value={sortField} onChange={(e) => setSortField(e.target.value as ArchiveSortField)}>
              {Object.entries(sortLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            <span>الاتجاه</span>
            <select value={sortDirection} onChange={(e) => setSortDirection(e.target.value as ArchiveSortDirection)}>
              <option value="desc">الأحدث أولاً</option>
              <option value="asc">الأقدم أولاً</option>
            </select>
          </label>
          <div className="archive-toolbar-actions">
            <button type="submit" className="button button-primary">تحديث</button>
            <button type="button" className="button button-secondary" onClick={resetFilters}>تصفير</button>
          </div>
        </form>
        <div className="archive-toolbar-row">
          <DataViewSwitcher value={viewMode} options={viewOptions} onChange={setViewMode} />
          <DataViewSwitcher value={itemSize} options={itemSizeOptions} onChange={setItemSize} label="كثافة العناصر" />
          {savedViews.length > 0 ? (
            <div className="saved-views-strip" aria-label="العروض المحفوظة">
              {savedViews.map((view) => (
                <span key={view.id} className="saved-view-chip">
                  <button type="button" onClick={() => applySavedView(view)}>{view.name}</button>
                  <button type="button" aria-label={`حذف ${view.name}`} onClick={() => removeSavedView(view.id)}>×</button>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </PageToolbar>

      {selectedIds.length > 0 ? (
        <div className="bulk-action-bar" role="status">
          <strong>{selectedIds.length} سجل محدد</strong>
          <div className="button-row">
            <button type="button" className="button button-secondary" onClick={toggleSelectAllVisible}>تحديد الظاهر</button>
            <a className="button button-secondary" href={`/archive/${encodeURIComponent(selectedIds[0])}`}>فتح الأول</a>
            <button type="button" className="button button-secondary" onClick={() => setSelectedIds([])}>إلغاء التحديد</button>
          </div>
        </div>
      ) : null}

      {state.status === "loading" ? (
        <div className="panel panel-compact" aria-live="polite" role="status">
          <p className="form-status">جار تحميل السجلات...</p>
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>تعذر تحميل السجلات</strong>
          <span className="helper-text">{state.message}</span>
        </div>
      ) : null}

      {state.status === "ready" ? (
        visibleRecords.length === 0 ? (
          <EmptyState
            title="لا توجد سجلات مطابقة."
            description="خفف الفلاتر أو اترك البحث فارغاً لعرض أحدث السجلات من Laravel API."
            actions={<button type="button" className="button button-secondary" onClick={resetFilters}>تصفير الفلاتر</button>}
          />
        ) : (
          <section className="archive-workspace" data-view={viewMode} aria-label="نتائج الأرشيف">
            <div className="records-surface" data-view={viewMode} data-size={itemSize} role={viewMode === "details" ? undefined : "list"}>
              {viewMode === "details" ? (
                <div className="scroll-x">
                  <table className="data-table archive-table">
                    <thead>
                      <tr>
                        <th>
                          <input
                            type="checkbox"
                            aria-label="تحديد كل النتائج الظاهرة"
                            checked={visibleRecords.length > 0 && visibleRecords.every((record) => selectedIdSet.has(record.id))}
                            onChange={toggleSelectAllVisible}
                          />
                        </th>
                        <th>العنوان</th>
                        <th>المخزن</th>
                        <th>النوع</th>
                        <th>آخر تحديث</th>
                        <th>إجراء</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRecords.map((record) => (
                        <tr key={record.id} onMouseEnter={() => setPreviewId(record.id)}>
                          <td>
                            <input
                              type="checkbox"
                              aria-label={`تحديد ${record.title || "السجل"}`}
                              checked={selectedIdSet.has(record.id)}
                              onChange={() => toggleSelection(record.id)}
                            />
                          </td>
                          <td>
                            <a className="text-accent" href={`/archive/${encodeURIComponent(record.id)}`}>
                              {record.title || "بدون عنوان"}
                            </a>
                          </td>
                          <td>{record.store || "غير محدد"}</td>
                          <td>{record.type || "غير محدد"}</td>
                          <td>{formatDate(record.updatedAt || record.createdAt)}</td>
                          <td>
                            <button type="button" className="badge" onClick={() => setPreviewId(record.id)}>معاينة</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                visibleRecords.map(renderRecordCard)
              )}
            </div>

            <aside className="record-preview-rail" aria-label="معاينة السجل">
              {previewRecord ? (
                <>
                  <div className="panel-section-header">
                    <span className="badge">معاينة</span>
                    <h2>{previewRecord.title || "بدون عنوان"}</h2>
                  </div>
                  <p>{previewRecord.description || "لا يوجد وصف محفوظ لهذا السجل بعد."}</p>
                  <div className="kv-grid">
                    <div className="kv-item">
                      <strong>المخزن</strong>
                      <span>{previewRecord.store || "غير محدد"}</span>
                    </div>
                    <div className="kv-item">
                      <strong>النوع</strong>
                      <span>{previewRecord.type || "غير محدد"}</span>
                    </div>
                    <div className="kv-item">
                      <strong>الإنشاء</strong>
                      <span>{formatDate(previewRecord.createdAt)}</span>
                    </div>
                    <div className="kv-item">
                      <strong>التحديث</strong>
                      <span>{formatDate(previewRecord.updatedAt)}</span>
                    </div>
                  </div>
                  {previewRecord.tags && previewRecord.tags.length > 0 ? (
                    <div className="tags">
                      {previewRecord.tags.map((tag) => <span key={tag} className="tag">{tag}</span>)}
                    </div>
                  ) : null}
                  {previewRecord.metadata && Object.keys(previewRecord.metadata).length > 0 ? (
                    <pre className="token-preview">{JSON.stringify(previewRecord.metadata, null, 2)}</pre>
                  ) : null}
                  <div className="button-row">
                    <a className="button button-primary" href={`/archive/${encodeURIComponent(previewRecord.id)}`}>فتح التفاصيل</a>
                    <a className="button button-secondary" href={`/search?q=${encodeURIComponent(previewRecord.title || "")}`}>بحث مشابه</a>
                  </div>
                </>
              ) : (
                <EmptyState title="لا توجد معاينة." description="اختر سجلاً من النتائج لعرض تفاصيله السريعة هنا." />
              )}
            </aside>
          </section>
        )
      ) : null}
    </AppShell>
  );
}

export default function ArchivePage() {
  return (
    <Suspense fallback={(
      <AppShell subtitle="مركز السجلات" contentClassName="archive-content">
        <div className="panel panel-compact" role="status">
          <p className="form-status">جار تجهيز الأرشيف...</p>
        </div>
      </AppShell>
    )}>
      <ArchivePageContent />
    </Suspense>
  );
}

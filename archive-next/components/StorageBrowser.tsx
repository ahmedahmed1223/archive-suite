"use client";

import { ChevronRight, Download, File, Folder, FolderPlus, MoveLeft, Search, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export type StorageCapability = "browse" | "download" | "upload" | "create-folder" | "move" | "copy" | "rename" | "delete";
export type StorageProvider = { id: string; label: string; type: string; status: "ready" | "offline" | "syncing"; capabilities: StorageCapability[] };
export type StorageEntry = { id: string; name: string; path: string; kind: "file" | "folder"; size?: number; modifiedAt?: string };

type Props = Readonly<{
  providers: StorageProvider[];
  providerId: string;
  path: string;
  entries: StorageEntry[];
  isLoading?: boolean;
  error?: string;
  onProviderChange: (providerId: string) => void;
  onNavigate: (path: string) => void;
  onDownload?: (entry: StorageEntry) => void;
  onAction?: (action: StorageCapability) => void;
}>;

const actionLabels: Array<{ capability: StorageCapability; label: string; icon: typeof Upload }> = [
  { capability: "upload", label: "رفع", icon: Upload },
  { capability: "create-folder", label: "مجلد جديد", icon: FolderPlus },
  { capability: "move", label: "نقل", icon: MoveLeft },
];

function parentPath(path: string) {
  const segments = path.split("/").filter(Boolean);
  return segments.slice(0, -1).join("/");
}

export default function StorageBrowser({ providers, providerId, path, entries, isLoading = false, error, onProviderChange, onNavigate, onDownload, onAction }: Props) {
  const [activeProviderId, setActiveProviderId] = useState(providerId);
  const [query, setQuery] = useState("");
  useEffect(() => {
    setActiveProviderId(providerId);
  }, [providerId]);
  const provider = providers.find((candidate) => candidate.id === activeProviderId) ?? providers[0];
  const visibleEntries = useMemo(() => entries.filter((entry) => entry.name.toLocaleLowerCase("ar").includes(query.toLocaleLowerCase("ar"))), [entries, query]);
  const supports = (capability: StorageCapability) => Boolean(provider?.capabilities.includes(capability));

  const selectProvider = (nextProviderId: string) => {
    setActiveProviderId(nextProviderId);
    onProviderChange(nextProviderId);
  };

  return (
    <section className="workspace-panel" aria-label="مساحة إدارة الملفات">
      <div className="workspace-panel__header">
        <div><h2>إدارة الملفات</h2><p>تصفح وحدات التخزين المتصلة ونفّذ العمليات المسموح بها فقط.</p></div>
        <label>
          <span className="sr-only">وحدة التخزين</span>
          <select aria-label="وحدة التخزين" value={provider?.id ?? ""} onChange={(event) => selectProvider(event.target.value)}>
            {providers.map((item) => <option key={item.id} value={item.id}>{item.label}{item.status === "offline" ? " — غير متصل" : ""}</option>)}
          </select>
        </label>
      </div>
      <div className="record-meta" aria-label="حالة وحدة التخزين"><span className="badge">{provider?.label ?? "لا توجد وحدة تخزين"}</span><span className="badge">{provider?.status === "ready" ? "جاهز" : provider?.status === "syncing" ? "جار المزامنة" : "غير متصل"}</span></div>
      <div className="button-row" aria-label="إجراءات الملفات">
        {actionLabels.map(({ capability, label, icon: Icon }) => <button key={capability} type="button" className="button button-secondary button-sm" disabled={!supports(capability)} onClick={() => onAction?.(capability)}><Icon size={16} aria-hidden="true" />{label}</button>)}
        {!supports("move") ? <span className="helper-text">غير متاح في وحدة التخزين المحددة</span> : null}
      </div>
      <nav className="record-meta" aria-label="مسار وحدة التخزين">
        <button type="button" className="badge" onClick={() => onNavigate("")} disabled={!path}>الجذر</button>
        {path.split("/").filter(Boolean).map((segment, index, all) => <button key={`${index}-${segment}`} type="button" className="badge" onClick={() => onNavigate(all.slice(0, index + 1).join("/"))} aria-current={index === all.length - 1 ? "location" : undefined}>{segment}</button>)}
      </nav>
      <label className="field-label" htmlFor="storage-browser-search">بحث داخل المجلد</label>
      <div className="input-with-icon"><Search size={16} aria-hidden="true" /><input id="storage-browser-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث باسم الملف أو المجلد" /></div>
      {error ? <div className="state-banner state-banner-error" role="alert"><strong>تعذر فتح وحدة التخزين</strong><span>{error}</span></div> : null}
      {isLoading ? <p role="status">جار تحميل الملفات…</p> : null}
      {!isLoading && !error ? <ul className="stack-list" aria-label="محتوى وحدة التخزين">
        {path ? <li><button type="button" className="text-accent" onClick={() => onNavigate(parentPath(path))}><ChevronRight size={16} aria-hidden="true" />المجلد السابق</button></li> : null}
        {visibleEntries.map((entry) => <li key={entry.id} className="panel-title-row"><span>{entry.kind === "folder" ? <Folder size={18} aria-hidden="true" /> : <File size={18} aria-hidden="true" />}{entry.name}</span>{entry.kind === "folder" ? <button type="button" className="button button-secondary button-sm" onClick={() => onNavigate(entry.path)}>فتح</button> : <button type="button" className="button button-secondary button-sm" disabled={!supports("download")} onClick={() => onDownload?.(entry)}><Download size={16} aria-hidden="true" />تنزيل</button>}</li>)}
        {visibleEntries.length === 0 ? <li className="helper-text">لا توجد عناصر مطابقة في هذا المجلد.</li> : null}
      </ul> : null}
    </section>
  );
}

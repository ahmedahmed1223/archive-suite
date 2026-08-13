"use client";

import { ChevronLeft, ChevronRight, Download, File, Folder, FolderPlus, MoveLeft, Search, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";

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

function parentPath(path: string) {
  const segments = path.split("/").filter(Boolean);
  return segments.slice(0, -1).join("/");
}

export default function StorageBrowser({ providers, providerId, path, entries, isLoading = false, error, onProviderChange, onNavigate, onDownload, onAction }: Props) {
  const { t, locale } = useLocale();
  const copy = t.shared.storageBrowser;
  const actionLabels: Array<{ capability: StorageCapability; label: string; icon: typeof Upload }> = [
    { capability: "upload", label: copy.actions.upload, icon: Upload },
    { capability: "create-folder", label: copy.actions.createFolder, icon: FolderPlus },
    { capability: "move", label: copy.actions.move, icon: MoveLeft },
  ];
  const ParentFolderIcon = locale === "en" ? ChevronLeft : ChevronRight;
  const [activeProviderId, setActiveProviderId] = useState(providerId);
  const [query, setQuery] = useState("");
  useEffect(() => {
    setActiveProviderId(providerId);
  }, [providerId]);
  const provider = providers.find((candidate) => candidate.id === activeProviderId) ?? providers[0];
  const visibleEntries = useMemo(() => entries.filter((entry) => entry.name.toLocaleLowerCase(locale).includes(query.toLocaleLowerCase(locale))), [entries, locale, query]);
  const supports = (capability: StorageCapability) => Boolean(provider?.capabilities.includes(capability));

  const selectProvider = (nextProviderId: string) => {
    setActiveProviderId(nextProviderId);
    onProviderChange(nextProviderId);
  };

  return (
    <section className="workspace-panel" aria-label={copy.panelAriaLabel}>
      <div className="workspace-panel__header">
        <div><h2>{copy.title}</h2><p>{copy.description}</p></div>
        <label>
          <span className="sr-only">{copy.providerLabel}</span>
          <select aria-label={copy.providerLabel} value={provider?.id ?? ""} onChange={(event) => selectProvider(event.target.value)}>
            {providers.map((item) => <option key={item.id} value={item.id}>{item.label}{item.status === "offline" ? copy.offlineSuffix : ""}</option>)}
          </select>
        </label>
      </div>
      <div className="record-meta" aria-label={copy.providerStatusAriaLabel}><span className="badge">{provider?.label ?? copy.noProvider}</span><span className="badge">{provider?.status === "ready" ? copy.statuses.ready : provider?.status === "syncing" ? copy.statuses.syncing : copy.statuses.offline}</span></div>
      <div className="button-row" aria-label={copy.actionsAriaLabel}>
        {actionLabels.map(({ capability, label, icon: Icon }) => <button key={capability} type="button" className="button button-secondary button-sm" disabled={!supports(capability)} onClick={() => onAction?.(capability)}><Icon size={16} aria-hidden="true" />{label}</button>)}
        {!supports("move") ? <span className="helper-text">{copy.unavailableAction}</span> : null}
      </div>
      <nav className="record-meta" aria-label={copy.pathAriaLabel}>
        <button type="button" className="badge" onClick={() => onNavigate("")} disabled={!path}>{copy.root}</button>
        {path.split("/").filter(Boolean).map((segment, index, all) => <button key={`${index}-${segment}`} type="button" className="badge" onClick={() => onNavigate(all.slice(0, index + 1).join("/"))} aria-current={index === all.length - 1 ? "location" : undefined}>{segment}</button>)}
      </nav>
      <label className="field-label" htmlFor="storage-browser-search">{copy.searchLabel}</label>
      <div className="input-with-icon"><Search size={16} aria-hidden="true" /><input id="storage-browser-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchPlaceholder} /></div>
      {error ? <div className="state-banner state-banner-error" role="alert"><strong>{copy.openError}</strong><span>{error}</span></div> : null}
      {isLoading ? <p role="status">{copy.loading}</p> : null}
      {!isLoading && !error ? <ul className="stack-list" aria-label={copy.contentsAriaLabel}>
        {path ? <li><button type="button" className="text-accent" onClick={() => onNavigate(parentPath(path))}><ParentFolderIcon size={16} aria-hidden="true" />{copy.parentFolder}</button></li> : null}
        {visibleEntries.map((entry) => <li key={entry.id} className="panel-title-row"><span>{entry.kind === "folder" ? <Folder size={18} aria-hidden="true" /> : <File size={18} aria-hidden="true" />}{entry.name}</span>{entry.kind === "folder" ? <button type="button" className="button button-secondary button-sm" onClick={() => onNavigate(entry.path)}>{copy.open}</button> : <button type="button" className="button button-secondary button-sm" disabled={!supports("download")} onClick={() => onDownload?.(entry)}><Download size={16} aria-hidden="true" />{copy.download}</button>}</li>)}
        {visibleEntries.length === 0 ? <li className="helper-text">{copy.noMatches}</li> : null}
      </ul> : null}
    </section>
  );
}

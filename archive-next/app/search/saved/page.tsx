"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { createArchiveApiClient, type SavedSearch } from "@/lib/archive-api";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLocale } from "@/lib/i18n/LocaleProvider";

export default function SavedSearchesPage() {
  const { t } = useLocale();
  const api = useMemo(() => createArchiveApiClient(), []);
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [departmentDrafts, setDepartmentDrafts] = useState<Record<string, string>>({});
  const [memberDrafts, setMemberDrafts] = useState<Record<string, { userId: string; role: "editor" | "viewer" }>>({});

  async function refresh() {
    setLoading(true);
    const response = await api.savedSearches();
    if (response.ok) setSearches(response.searches);
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh is redefined every render; this effect should run once on mount only
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const response = await api.createSavedSearch({ name, query: query || undefined });

    if (!response.ok) {
      setError(response.error);
      return;
    }

    setName("");
    setQuery("");
    await refresh();
  }

  async function handleDelete(id: string) {
    const response = await api.deleteSavedSearch(id);
    if (response.ok) await refresh();
  }

  async function saveAccess(search: SavedSearch, members = search.members || []) {
    const departmentId = departmentDrafts[search.id] ?? search.departmentId ?? undefined;
    const response = await api.replaceSavedSearchAccess(search.id, { departmentId: departmentId || undefined, members });
    if (!response.ok) setError(response.error || t.pages.savedSearches.accessSaveError);
    else await refresh();
  }

  async function addMember(search: SavedSearch) {
    const draft = memberDrafts[search.id];
    if (!draft?.userId.trim()) return;
    const members = [...(search.members || []).filter((member) => member.userId !== draft.userId.trim()), { userId: draft.userId.trim(), role: draft.role }];
    await saveAccess(search, members);
    setMemberDrafts((current) => ({ ...current, [search.id]: { userId: "", role: "viewer" } }));
  }
  async function handleCopy(id: string) { if ((await api.copySavedSearch(id)).ok) await refresh(); }

  function runUrl(search: SavedSearch): string {
    const params = new URLSearchParams();
    if (search.query) params.set("q", search.query);
    const viewKind = search.filters?.viewKind;
    const store = search.filters?.store;
    const type = search.filters?.type;
    const status = search.filters?.status;
    const viewMode = search.filters?.viewMode;
    if (typeof store === "string" && store) params.set("store", store);
    if (typeof type === "string" && type && type !== "all") params.set("type", type);
    if (typeof status === "string" && status && status !== "all") params.set("status", status);
    if (typeof viewMode === "string" && viewMode && viewMode !== "grid") params.set("view", viewMode);
    const queryString = params.toString();
    const basePath = viewKind === "archive-view" ? "/archive" : "/search";
    return queryString ? `${basePath}?${queryString}` : basePath;
  }

  return (
    <AppShell subtitle={t.pageTitles.savedSearches} contentClassName="stack" tipsPage="search-saved">
      <PageToolbar
        title={t.pages.savedSearches.heading}
        description={t.pages.savedSearches.description}
        meta={<span className="badge">{t.pages.savedSearches.savedItemsCountTemplate.replace("{count}", String(searches.length))}</span>}
        actions={<a className="button button-secondary" href="/search">{t.pages.savedSearches.openAdvancedSearch}</a>}
      />

      <article className="panel">
        <form className="auth-form" onSubmit={handleCreate}>
          <label>
            {t.pages.savedSearches.nameLabel}
            <input type="text" value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label>
            {t.pages.savedSearches.queryLabel}
            <input type="text" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <button type="submit" className="button button-primary">{t.pages.savedSearches.saveButton}</button>
          {error ? (
            <p className="form-status" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      </article>

      {loading ? (
        <div className="panel panel-compact" role="status">
          <Skeleton label={t.pages.savedSearches.loadingLabel} />
        </div>
      ) : null}

      {!loading && searches.length === 0 ? (
        <EmptyState title={t.pages.savedSearches.emptyTitle} description={t.pages.savedSearches.emptyDescription} />
      ) : null}

      {searches.length > 0 ? (
        <ul className="stack">
          {searches.map((search) => (
            <li key={search.id} className="panel panel-compact">
              <div className="panel-title-row">
                <h2>{search.name}</h2>
                <span className="badge">{search.filters?.viewKind === "archive-view" ? t.pages.savedSearches.archiveViewBadge : t.pages.savedSearches.searchBadge}</span>
                <span className="badge">{search.accessRole === "owner" ? t.pages.savedSearches.ownerRole : search.accessRole === "editor" ? t.pages.savedSearches.editorRole : t.pages.savedSearches.viewerRole}</span>
              </div>
              {search.query ? <p className="helper-text">{t.pages.savedSearches.queryPrefixTemplate.replace("{query}", search.query)}</p> : null}
              <div className="button-row">
                <a className="button button-primary button-sm" href={runUrl(search)}>
                  {t.pages.savedSearches.runSearch}
                </a>
                {search.canManage ? <button type="button" className="button button-secondary button-sm" onClick={() => void handleDelete(search.id)}>{t.pages.savedSearches.deleteButton}</button> : <button type="button" className="button button-secondary button-sm" onClick={() => void handleCopy(search.id)}>{t.pages.savedSearches.copyToMine}</button>}
              </div>
              {search.canManage ? <div className="stack">
                <label>{t.pages.savedSearches.departmentLabel} <input value={departmentDrafts[search.id] ?? search.departmentId ?? ""} onChange={(event) => setDepartmentDrafts((current) => ({ ...current, [search.id]: event.target.value }))} placeholder={t.pages.savedSearches.optionalPlaceholder} /></label>
                <div className="button-row">
                  <input value={memberDrafts[search.id]?.userId || ""} onChange={(event) => setMemberDrafts((current) => ({ ...current, [search.id]: { userId: event.target.value, role: current[search.id]?.role || "viewer" } }))} placeholder={t.pages.savedSearches.userIdPlaceholder} aria-label={t.pages.savedSearches.userIdPlaceholder} />
                  <select value={memberDrafts[search.id]?.role || "viewer"} onChange={(event) => setMemberDrafts((current) => ({ ...current, [search.id]: { userId: current[search.id]?.userId || "", role: event.target.value as "editor" | "viewer" } }))}><option value="viewer">{t.pages.savedSearches.viewerRole}</option><option value="editor">{t.pages.savedSearches.editorRole}</option></select>
                  <button type="button" className="button button-secondary button-sm" onClick={() => void addMember(search)}>{t.pages.savedSearches.addMember}</button>
                  <button type="button" className="button button-primary button-sm" onClick={() => void saveAccess(search)}>{t.pages.savedSearches.saveAccess}</button>
                </div>
                {(search.members || []).map((member) => <div className="button-row" key={member.userId}><span className="badge">{member.userId} · {member.role === "editor" ? t.pages.savedSearches.editorRole : t.pages.savedSearches.viewerRole}</span><button type="button" className="button button-secondary button-sm" onClick={() => void saveAccess(search, (search.members || []).filter((item) => item.userId !== member.userId))}>{t.pages.savedSearches.removeMember}</button></div>)}
              </div> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </AppShell>
  );
}

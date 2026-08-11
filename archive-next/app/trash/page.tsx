"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useCapability } from "@/components/RoleGate";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { Skeleton } from "@/components/ui/Skeleton";
import { createArchiveApiClient, type PaginationMeta, type TrashEntry, type TrashFilters } from "@/lib/archive-api";
import { canRedo, canUndo, emptyUndoStack, pushUndo, redo, undo, type UndoStack } from "@/lib/undo-stack";

const PAGE_SIZE = 25;

type TrashState =
  | { status: "loading" }
  | { status: "ready"; items: TrashEntry[]; pagination?: PaginationMeta }
  | { status: "error"; message: string };

function recordTitle(entry: TrashEntry): string {
  const title = entry.record?.title;
  return typeof title === "string" && title.trim() ? title : entry.uid;
}

function formatDate(value: string | null, locale: "ar" | "en"): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString(locale === "en" ? "en-US" : "ar-SA");
}

/** V1-731 (B07): A standalone trash view that supports browsing and restoring records. */
export default function TrashPage() {
  const { t, locale } = useLocale();
  const copy = t.pages.trash;
  const api = useMemo(() => createArchiveApiClient(), []);
  const dialog = useConfirmDialog();
  const canRestore = useCapability("trash.restore");
  const canPurge = useCapability("trash.purge");
  const [state, setState] = useState<TrashState>({ status: "loading" });
  const [store, setStore] = useState("");
  const [search, setSearch] = useState("");
  const [appliedFilters, setAppliedFilters] = useState<TrashFilters>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  // V1-732D: only restore() is undoable here - purge() is genuinely
  // irreversible (its own confirm dialog says so), so it stays outside the
  // stack rather than pretending to support an undo that doesn't exist.
  const [restoreStack, setRestoreStack] = useState<UndoStack<TrashEntry>>(emptyUndoStack);

  const loadTrash = useCallback(
    async (filters: TrashFilters) => {
      setState({ status: "loading" });
      const response = await api.trash({ ...filters, limit: PAGE_SIZE });
      if (!response.ok) {
        setState({ status: "error", message: response.error || copy.loadFailed });
        return;
      }
      setState({ status: "ready", items: response.items, pagination: response.pagination });
    },
    [api, copy.loadFailed]
  );

  useEffect(() => {
    void loadTrash(appliedFilters);
  }, [appliedFilters, loadTrash]);

  async function loadMore() {
    if (state.status !== "ready" || !state.pagination?.hasMore || busy) return;
    setBusy(true);
    const response = await api.trash({ ...appliedFilters, limit: PAGE_SIZE, page: state.pagination.page + 1 });
    setBusy(false);
    if (!response.ok) {
      setNotice(response.error || copy.loadMoreFailed);
      return;
    }
    setState((current) =>
      current.status === "ready"
        ? { status: "ready", items: [...current.items, ...response.items], pagination: response.pagination }
        : current
    );
  }

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    setNotice("");
    const next: TrashFilters = {};
    if (store.trim()) next.store = store.trim();
    if (search.trim()) next.q = search.trim();
    setAppliedFilters(next);
  }

  async function restore(entry: TrashEntry) {
    setNotice("");
    setBusy(true);
    const response = await api.restoreTrash({ store: entry.store, ids: [entry.uid] });
    setBusy(false);

    if (!response.ok) {
      setNotice(response.error || copy.restoreFailed);
      return;
    }

    const result = response.results[0];
    if (!result?.restored) {
      // Restoration is rejected when an active record has the same ID; never replace it silently.
      setNotice(
        result?.reason === "conflict"
          ? copy.restoreConflict.replace("{id}", entry.uid) : copy.restoreMissing.replace("{id}", entry.uid)
      );
      void loadTrash(appliedFilters);
      return;
    }

    setNotice(copy.restored.replace("{title}", recordTitle(entry)));
    setRestoreStack((stack) => pushUndo(stack, entry));
    void loadTrash(appliedFilters);
  }

  async function handleUndoRestore() {
    const result = undo(restoreStack);
    if (!result) return;
    setNotice("");
    setBusy(true);
    const response = await api.bulkDeleteRecords({ store: result.entry.store, ids: [result.entry.uid] });
    setBusy(false);

    if (!response.ok) {
      setNotice(response.error || copy.undoFailed);
      return;
    }

    setNotice(copy.undone.replace("{title}", recordTitle(result.entry)));
    setRestoreStack(result.stack);
    void loadTrash(appliedFilters);
  }

  async function handleRedoRestore() {
    const result = redo(restoreStack);
    if (!result) return;
    setNotice("");
    setBusy(true);
    const response = await api.restoreTrash({ store: result.entry.store, ids: [result.entry.uid] });
    setBusy(false);

    if (!response.ok || !response.results[0]?.restored) {
      setNotice(response.ok ? copy.redoFailed : response.error || copy.redoFailed);
      return;
    }

    setNotice(copy.redone.replace("{title}", recordTitle(result.entry)));
    setRestoreStack(result.stack);
    void loadTrash(appliedFilters);
  }

  async function purge(entry: TrashEntry) {
    const confirmed = await dialog.confirm({
      title: copy.purgeTitle, message: copy.purgeMessage.replace("{title}", recordTitle(entry)), confirmLabel: copy.purgeTitle,
      destructive: true
    });
    if (!confirmed) return;

    setNotice("");
    setBusy(true);
    const response = await api.purgeTrash({ store: entry.store, ids: [entry.uid] });
    setBusy(false);

    if (!response.ok) {
      // Permanent deletion is restricted to administrators (403 for other roles).
      setNotice(response.error || copy.purgeFailed);
      return;
    }

    setNotice(copy.purged.replace("{title}", recordTitle(entry)));
    void loadTrash(appliedFilters);
  }

  const items = state.status === "ready" ? state.items : [];
  const pagination = state.status === "ready" ? state.pagination : undefined;

  return (
    <AppShell subtitle={t.pageTitles.trash} tipsPage="trash">
      <PageToolbar
        eyebrow={<span className="badge">{copy.eyebrow}</span>} title={copy.title} description={copy.description}
        meta={<span className="badge">{pagination ? copy.range.replace("{shown}", String(items.length)).replace("{total}", String(pagination.total)) : copy.itemCount.replace("{count}", String(items.length))}</span>}
        actions={
          <button type="button" className="button button-secondary" onClick={() => void loadTrash(appliedFilters)}>
            {copy.refresh}
          </button>
        }
      />

      <form className="search-form" aria-label={copy.filters} onSubmit={applyFilters}>
        <input
          className="search-input"
          value={store}
          onChange={(event) => setStore(event.target.value)}
          placeholder={copy.allStores} aria-label={copy.storeFilter}
        />
        <input
          className="search-input"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={copy.titleOrId} aria-label={copy.search}
        />
        <button type="submit" className="button button-primary">
          {copy.filter}
        </button>
      </form>

      {notice ? (
        <div className="state-banner" role="status">
          <span className="helper-text">{notice}</span>
        </div>
      ) : null}

      {canRestore && (canUndo(restoreStack) || canRedo(restoreStack)) ? (
        <div className="button-row">
          <button
            type="button"
            className="button button-secondary button-sm"
            disabled={!canUndo(restoreStack) || busy}
            onClick={() => void handleUndoRestore()}
          >
            {copy.undoRestore}{restoreStack.past.length > 0 ? ` (${restoreStack.past.length})` : ""}
          </button>
          <button
            type="button"
            className="button button-secondary button-sm"
            disabled={!canRedo(restoreStack) || busy}
            onClick={() => void handleRedoRestore()}
          >
            {copy.redoRestore}{restoreStack.future.length > 0 ? ` (${restoreStack.future.length})` : ""}
          </button>
        </div>
      ) : null}

      {state.status === "loading" ? <Skeleton /> : null}

      {state.status === "error" ? <EmptyState title={copy.loadError} description={state.message} /> : null}

      {state.status === "ready" && items.length === 0 ? (
        <EmptyState title={copy.empty} description={copy.emptyDescription} />
      ) : null}

      {state.status === "ready" && items.length > 0 ? (
        <div className="scroll-x desktop-table-wrap">
          <table className="data-table" role="grid" aria-label={copy.deletedRecords}>
            <thead>
              <tr>
                <th scope="col">{copy.record}</th><th scope="col">{copy.store}</th><th scope="col">{copy.deletedAt}</th><th scope="col" className="data-table-sticky-end">{copy.actions}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    <strong>{recordTitle(entry)}</strong>
                    <br />
                    <code>{entry.uid}</code>
                  </td>
                  <td>{entry.store}</td>
                  <td>{formatDate(entry.deletedAt, locale)}</td>
                  <td className="data-table-sticky-end">
                    <div className="button-row">
                      {canRestore && (
                        <button
                          type="button"
                          className="button button-secondary"
                          disabled={busy}
                          onClick={() => void restore(entry)}
                        >
                          {copy.restore}
                        </button>
                      )}
                      {canPurge && (
                        <button
                          type="button"
                          className="button button-danger"
                          disabled={busy}
                          onClick={() => void purge(entry)}
                        >
                          {copy.purge}
                        </button>
                      )}
                      {!canRestore && !canPurge && <span className="helper-text">-</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {state.status === "ready" && pagination?.hasMore ? (
        <div className="button-row" style={{ justifyContent: "center" }}>
          <button type="button" className="button button-secondary" onClick={() => void loadMore()} disabled={busy}>
            {busy ? copy.loading : copy.loadMore}
          </button>
        </div>
      ) : null}
    </AppShell>
  );
}

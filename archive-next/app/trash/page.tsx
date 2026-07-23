"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useCapability } from "@/components/RoleGate";
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

function formatDate(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString("ar");
}

/** V1-731 (B07): سلة مهملات مستقلة قابلة للتصفح والاستعادة. */
export default function TrashPage() {
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
        setState({ status: "error", message: response.error || "تعذر تحميل سلة المهملات." });
        return;
      }
      setState({ status: "ready", items: response.items, pagination: response.pagination });
    },
    [api]
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
      setNotice(response.error || "تعذر تحميل المزيد.");
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
      setNotice(response.error || "تعذر استعادة السجل.");
      return;
    }

    const result = response.results[0];
    if (!result?.restored) {
      // الاستعادة تُرفض عند وجود سجل حي بنفس المعرّف — لا نستبدله بصمت.
      setNotice(
        result?.reason === "conflict"
          ? `تعذرت الاستعادة: يوجد سجل حي بالمعرّف ${entry.uid}. احذفه أو غيّر معرّفه أولاً.`
          : `تعذرت الاستعادة: لم يعد ${entry.uid} موجوداً في السلة.`
      );
      void loadTrash(appliedFilters);
      return;
    }

    setNotice(`تمت استعادة ${recordTitle(entry)}.`);
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
      setNotice(response.error || "تعذر التراجع عن الاستعادة.");
      return;
    }

    setNotice(`أُرجع ${recordTitle(result.entry)} إلى السلة.`);
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
      setNotice(response.ok ? "تعذرت إعادة الاستعادة." : response.error || "تعذرت إعادة الاستعادة.");
      return;
    }

    setNotice(`أُعيدت استعادة ${recordTitle(result.entry)}.`);
    setRestoreStack(result.stack);
    void loadTrash(appliedFilters);
  }

  async function purge(entry: TrashEntry) {
    const confirmed = await dialog.confirm({
      title: "حذف نهائي",
      message: `سيُحذف «${recordTitle(entry)}» نهائياً ولا يمكن التراجع. النسخ الاحتياطي هو السبيل الوحيد للاسترجاع بعدها.`,
      confirmLabel: "حذف نهائي",
      destructive: true
    });
    if (!confirmed) return;

    setNotice("");
    setBusy(true);
    const response = await api.purgeTrash({ store: entry.store, ids: [entry.uid] });
    setBusy(false);

    if (!response.ok) {
      // الحذف النهائي مقصور على المدير (403 لغير ذلك).
      setNotice(response.error || "تعذر الحذف النهائي. هذا الإجراء مقصور على المدير.");
      return;
    }

    setNotice(`تم حذف ${recordTitle(entry)} نهائياً.`);
    void loadTrash(appliedFilters);
  }

  const items = state.status === "ready" ? state.items : [];
  const pagination = state.status === "ready" ? state.pagination : undefined;

  return (
    <AppShell subtitle="سلة المهملات" tipsPage="trash">
      <PageToolbar
        eyebrow={<span className="badge">Trash</span>}
        title="سلة المهملات"
        description="السجلات المحذوفة تبقى هنا قابلة للاستعادة حتى انتهاء مدة الاحتفاظ، ثم تُحذف نهائياً تلقائياً. الاستعادة تُعيد السجل بحالته السابقة."
        meta={<span className="badge">{pagination ? `${items.length} من ${pagination.total}` : items.length} عنصر</span>}
        actions={
          <button type="button" className="button button-secondary" onClick={() => void loadTrash(appliedFilters)}>
            تحديث
          </button>
        }
      />

      <form className="search-form" aria-label="فلاتر سلة المهملات" onSubmit={applyFilters}>
        <input
          className="search-input"
          value={store}
          onChange={(event) => setStore(event.target.value)}
          placeholder="كل المخازن"
          aria-label="فلتر المخزن"
        />
        <input
          className="search-input"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="العنوان أو المعرّف"
          aria-label="بحث في السلة"
        />
        <button type="submit" className="button button-primary">
          تصفية
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
            تراجع عن الاستعادة{restoreStack.past.length > 0 ? ` (${restoreStack.past.length})` : ""}
          </button>
          <button
            type="button"
            className="button button-secondary button-sm"
            disabled={!canRedo(restoreStack) || busy}
            onClick={() => void handleRedoRestore()}
          >
            إعادة الاستعادة{restoreStack.future.length > 0 ? ` (${restoreStack.future.length})` : ""}
          </button>
        </div>
      ) : null}

      {state.status === "loading" ? <Skeleton /> : null}

      {state.status === "error" ? <EmptyState title="تعذر التحميل" description={state.message} /> : null}

      {state.status === "ready" && items.length === 0 ? (
        <EmptyState title="السلة فارغة" description="لا توجد سجلات محذوفة ضمن هذه التصفية." />
      ) : null}

      {state.status === "ready" && items.length > 0 ? (
        <div className="scroll-x desktop-table-wrap">
          <table className="data-table" role="grid" aria-label="السجلات المحذوفة">
            <thead>
              <tr>
                <th scope="col">السجل</th>
                <th scope="col">المخزن</th>
                <th scope="col">تاريخ الحذف</th>
                <th scope="col">إجراءات</th>
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
                  <td>{formatDate(entry.deletedAt)}</td>
                  <td>
                    <div className="button-row">
                      {canRestore && (
                        <button
                          type="button"
                          className="button button-secondary"
                          disabled={busy}
                          onClick={() => void restore(entry)}
                        >
                          استعادة
                        </button>
                      )}
                      {canPurge && (
                        <button
                          type="button"
                          className="button button-danger"
                          disabled={busy}
                          onClick={() => void purge(entry)}
                        >
                          حذف نهائي
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
            {busy ? "جار التحميل..." : "تحميل المزيد"}
          </button>
        </div>
      ) : null}
    </AppShell>
  );
}

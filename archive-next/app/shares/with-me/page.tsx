"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { createArchiveApiClient, type ArchiveRecord } from "@/lib/archive-api";
import { redactAdminSecrets } from "@/lib/admin-action-summary";

interface InboundShareEntry {
  token: string;
  label: string;
  recordCount: number;
  permission?: string;
  openedAt: string;
}

type ShareState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; token: string; records: ArchiveRecord[]; permission?: string }
  | { status: "error"; message: string };

const STORAGE_KEY = "masar:shares:with-me";

function readHistory(): InboundShareEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeHistory(entries: InboundShareEntry[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, 25)));
}

function normalizeToken(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts.at(-1) || trimmed;
  } catch {
    return trimmed.replace(/^\/?share\//, "");
  }
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ar-SA");
}

export default function SharedWithMePage() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<InboundShareEntry[]>([]);
  const [state, setState] = useState<ShareState>({ status: "idle" });

  useEffect(() => {
    const storedHistory = readHistory();
    setHistory(storedHistory);
    const params = new URLSearchParams(window.location.search);
    const token = normalizeToken(params.get("token") || "");
    if (token) {
      setInput(token);
      void openShare(token, storedHistory);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openShare(rawToken: string, baseHistory = history) {
    const token = normalizeToken(rawToken);
    if (!token) return;

    setState({ status: "loading" });
    const response = await api.share(token);
    if (!response.ok) {
      setState({ status: "error", message: response.error || "تعذر فتح المشاركة." });
      return;
    }

    const nextEntry: InboundShareEntry = {
      token,
      label: response.records[0]?.title || "مشاركة واردة",
      recordCount: response.records.length,
      permission: response.permission,
      openedAt: new Date().toISOString()
    };
    const nextHistory = [nextEntry, ...baseHistory.filter((entry) => entry.token !== token)].slice(0, 25);
    writeHistory(nextHistory);
    setHistory(nextHistory);
    setState({ status: "ready", token, records: response.records, permission: response.permission });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void openShare(input);
  }

  function clearHistory() {
    if (history.length > 0 && !window.confirm("مسح تاريخ المشاركات من هذا المتصفح فقط؟ لن يؤدي ذلك إلى إلغاء الروابط.")) return;
    writeHistory([]);
    setHistory([]);
  }

  return (
    <AppShell subtitle="مشاركات واردة" navLabel="المشاركات الواردة" contentClassName="local-list-content">
      <PageToolbar
        eyebrow={<span className="badge">Shared with me</span>}
        title="المشاركات الواردة"
        description="افتح روابط مشاركة وصلتك من فريق العمل، واحتفظ بتاريخ محلي سريع للرجوع إليها."
        meta={(
          <>
            <span className="badge">{history.length} في التاريخ</span>
            <span className="badge">{state.status === "ready" ? `${state.records.length} سجل` : "بانتظار رابط"}</span>
          </>
        )}
        actions={<a className="button button-secondary" href="/shares">روابطي المنشأة</a>}
      >
        <form className="archive-toolbar-grid" onSubmit={handleSubmit}>
          <label>
            <span>Token أو رابط المشاركة</span>
            <input
              className="search-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="https://.../share/token أو token"
              dir="ltr"
            />
          </label>
          <div className="archive-toolbar-actions">
            <button type="submit" className="button button-primary" disabled={!input.trim()}>فتح المشاركة</button>
            <button type="button" className="button button-secondary" onClick={clearHistory} disabled={history.length === 0}>مسح التاريخ</button>
          </div>
        </form>
      </PageToolbar>

      {state.status === "loading" ? (
        <div className="panel panel-compact" role="status">
          <p className="form-status">جار فتح المشاركة...</p>
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>تعذر فتح المشاركة</strong>
          <span className="helper-text">{redactAdminSecrets(state.message)} — قد يكون الرابط منتهياً أو غير مسموح لك.</span>
        </div>
      ) : null}

      {state.status === "ready" ? (
        <section className="panel">
          <div className="panel-title-row">
            <div>
              <h2>محتوى المشاركة</h2>
              <p className="mono-text wrap-anywhere" dir="ltr">{state.token}</p>
            </div>
            <span className="badge">{state.permission || "view"}</span>
          </div>
          <p className="helper-text">معاينة محدودة وفق صلاحية الرابط؛ لا تعرض حالة انتهاء إلا إذا قدمها مصدر الرابط.</p>

          {state.records.length === 0 ? (
            <EmptyState title="المشاركة لا تحتوي سجلات." description="قد تكون صلاحية الرابط محدودة أو انتهت." />
          ) : (
            <div className="mobile-card-list" role="list">
              {state.records.map((record) => (
                <article className="local-list-card" key={record.id} role="listitem">
                  <div className="local-list-card__main">
                    <div>
                      <span className="badge">{record.type || "record"}</span>
                      <h3>{record.title || record.id}</h3>
                    </div>
                    <span className="badge">{record.store || "archive"}</span>
                  </div>
                  {record.description ? <p className="helper-text">{record.description}</p> : null}
                  {record.tags?.length ? (
                    <div className="tags">
                      {record.tags.slice(0, 6).map((tag) => <span key={tag} className="tag">{tag}</span>)}
                    </div>
                  ) : null}
                  <a className="button button-secondary button-sm" href={`/share/${encodeURIComponent(state.token)}`}>
                    فتح العارض العام
                  </a>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {history.length > 0 ? (
        <section className="panel">
          <div className="panel-title-row">
            <h2>تاريخ المشاركات الواردة</h2>
            <span className="badge">{history.length}</span>
          </div>
          <div className="mobile-card-list" role="list">
            {history.map((entry) => (
              <article className="local-list-card" key={entry.token} role="listitem">
                <div className="local-list-card__main">
                  <div>
                    <span className="badge">{entry.permission || "view"}</span>
                    <h3>{entry.label}</h3>
                  </div>
                  <strong>{entry.recordCount}</strong>
                </div>
                <p className="mono-text wrap-anywhere" dir="ltr">{entry.token}</p>
                <p className="helper-text">آخر فتح: {formatDate(entry.openedAt)}</p>
                <div className="button-row">
                  <button type="button" className="button button-secondary button-sm" onClick={() => void openShare(entry.token)}>
                    إعادة فتح
                  </button>
                  <a className="button button-secondary button-sm" href={`/share/${encodeURIComponent(entry.token)}`}>
                    العارض العام
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : state.status === "idle" ? (
        <EmptyState title="لا توجد مشاركات واردة بعد." description="الصق token أو رابط مشاركة لفتح السجلات المشتركة معك." />
      ) : null}
    </AppShell>
  );
}

"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { createArchiveApiClient, type ArchiveRecord } from "@/lib/archive-api";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
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

function formatDate(value: string | undefined, locale: "ar" | "en") {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale === "ar" ? "ar-SA" : "en-US");
}

export default function SharedWithMePage() {
  const { locale, t } = useLocale();
  const copy = t.pages.sharesWithMe;
  const api = useMemo(() => createArchiveApiClient(), []);
  const dialogs = useConfirmDialog();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reads the share token from the URL once on mount; openShare is redefined every render and would retrigger this
  }, []);

  async function openShare(rawToken: string, baseHistory = history) {
    const token = normalizeToken(rawToken);
    if (!token) return;

    setState({ status: "loading" });
    const response = await api.share(token);
    if (!response.ok) {
      setState({ status: "error", message: response.error || copy.openError });
      return;
    }

    const nextEntry: InboundShareEntry = {
      token,
      label: response.records[0]?.title || copy.incomingShare,
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

  async function clearHistory() {
    if (
      history.length > 0 &&
      !(await dialogs.confirm({
        title: copy.clearHistoryTitle,
        message: copy.clearHistoryMessage,
        confirmLabel: copy.clear,
        destructive: true
      }))
    )
      return;
    writeHistory([]);
    setHistory([]);
  }

  return (
    <AppShell subtitle={t.pageTitles.incomingSharesSubtitle} navLabel={t.pageTitles.incomingShares} contentClassName="local-list-content" tipsPage="shares-with-me">
      <PageToolbar
        eyebrow={<span className="badge">{copy.eyebrow}</span>}
        title={copy.title}
        description={copy.description}
        meta={(
          <>
            <span className="badge">{copy.historyCount.replace("{count}", String(history.length))}</span>
            <span className="badge">{state.status === "ready" ? copy.recordCount.replace("{count}", String(state.records.length)) : copy.waitingForLink}</span>
          </>
        )}
        actions={<a className="button button-secondary" href="/shares">{copy.myShares}</a>}
      >
        <form className="archive-toolbar-grid" onSubmit={handleSubmit}>
          <label>
            <span>{copy.tokenLabel}</span>
            <input
              className="search-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={copy.tokenPlaceholder}
              dir="ltr"
            />
          </label>
          <div className="archive-toolbar-actions">
            <button type="submit" className="button button-primary" disabled={!input.trim()}>{copy.open}</button>
            <button type="button" className="button button-secondary" onClick={clearHistory} disabled={history.length === 0}>{copy.clearHistory}</button>
          </div>
        </form>
      </PageToolbar>

      {state.status === "loading" ? (
        <div className="panel panel-compact" role="status">
          <p className="form-status">{copy.loading}</p>
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>{copy.errorTitle}</strong>
          <span className="helper-text">{copy.errorDescription.replace("{error}", redactAdminSecrets(state.message))}</span>
        </div>
      ) : null}

      {state.status === "ready" ? (
        <section className="panel">
          <div className="panel-title-row">
            <div>
              <h2>{copy.contentTitle}</h2>
              <p className="mono-text wrap-anywhere" dir="ltr">{state.token}</p>
            </div>
            <span className="badge">{state.permission || "view"}</span>
          </div>
          <p className="helper-text">{copy.limitedPreview}</p>

          {state.records.length === 0 ? (
            <EmptyState title={copy.emptyShareTitle} description={copy.emptyShareDescription} />
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
                    {copy.openPublicViewer}
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
            <h2>{copy.historyTitle}</h2>
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
                <p className="helper-text">{copy.lastOpened.replace("{date}", formatDate(entry.openedAt, locale))}</p>
                <div className="button-row">
                  <button type="button" className="button button-secondary button-sm" onClick={() => void openShare(entry.token)}>
                    {copy.reopen}
                  </button>
                  <a className="button button-secondary button-sm" href={`/share/${encodeURIComponent(entry.token)}`}>
                    {copy.publicViewer}
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : state.status === "idle" ? (
        <EmptyState title={copy.emptyHistoryTitle} description={copy.emptyHistoryDescription} />
      ) : null}
    </AppShell>
  );
}

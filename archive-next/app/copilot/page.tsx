"use client";

import { BotMessageSquare, CopyCheck, DatabaseZap, RefreshCw, Search, ShieldCheck, Tags, X } from "lucide-react";
import { Suspense, useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import AppShell from "@/components/AppShell";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import EmptyState from "@/components/EmptyState";
import MetricStrip from "@/components/MetricStrip";
import PageToolbar from "@/components/PageToolbar";
import OperationalSafetyPanel from "@/components/OperationalSafetyPanel";
import type { CopilotStatus } from "@/lib/copilot-status";
import { buildRecordContext } from "@/lib/copilot-chat";
import { createArchiveApiClient } from "@/lib/archive-api";
import { useAuthSession } from "@/lib/auth-session";

type StatusPhase = "loading" | "ready" | "error";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

type SendPhase = "idle" | "sending";

interface LinkedRecordContext {
  title: string;
  contextText: string;
}

function CopilotPageContent() {
  const { locale, t } = useLocale();
  const copy = t.pages.copilot;
  const safeStartingPoints = [{ title: copy.searchTitle, description: copy.searchDescription, href: "/search", icon: Search, label: copy.openSearch }, { title: copy.duplicatesTitle, description: copy.duplicatesDescription, href: "/duplicates", icon: CopyCheck, label: copy.openDuplicates }, { title: copy.metadataTitle, description: copy.metadataDescription, href: "/tags", icon: Tags, label: copy.openTags }];
  const [phase, setPhase] = useState<StatusPhase>("loading");
  const [status, setStatus] = useState<CopilotStatus | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sendPhase, setSendPhase] = useState<SendPhase>("idle");
  const [sendError, setSendError] = useState<string | null>(null);
  const [recordContext, setRecordContext] = useState<LinkedRecordContext | null>(null);
  const [contextAttached, setContextAttached] = useState(true);
  const { accessToken } = useAuthSession();
  const searchParams = useSearchParams();
  const recordId = searchParams.get("recordId");

  // V1-722: links this conversation to the record the user came from. Fetched
  // once per recordId; the user can detach it before sending (never inferred
  // or attached silently — matches this page's explicit-send safety posture).
  useEffect(() => {
    if (!recordId) {
      setRecordContext(null);
      return;
    }

    let cancelled = false;
    const api = createArchiveApiClient();
    api.record(recordId, { accessToken: accessToken ?? undefined }).then((response) => {
      if (cancelled || !response.ok) return;
      setRecordContext({
        title: response.record.title,
        contextText: buildRecordContext(response.record, locale)
      });
      setContextAttached(true);
    });

    return () => {
      cancelled = true;
    };
  }, [recordId, accessToken, locale]);

  const refreshStatus = useCallback(async () => {
    setPhase("loading");
    try {
      const response = await fetch("/api/copilot/status", { cache: "no-store" });
      if (!response.ok) throw new Error("status_request_failed");

      const nextStatus = await response.json() as CopilotStatus;
      setStatus(nextStatus);
      setPhase("ready");
    } catch {
      setStatus(null);
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const sendConversation = useCallback(async (nextMessages: ChatMessage[]) => {
    setSendPhase("sending");
    setSendError(null);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

      const response = await fetch("/api/copilot/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({
          messages: nextMessages,
          context: contextAttached ? recordContext?.contextText : undefined,
          locale
        })
      });

      const payload = await response.json().catch(() => null) as { ok: true; reply: string } | { ok: false; error: string } | null;

      if (!response.ok || !payload?.ok) {
        setSendError(payload && !payload.ok ? payload.error : copy.sendFailed);
        return;
      }

      setMessages([...nextMessages, { role: "assistant", content: payload.reply }]);
    } catch {
      setSendError(copy.connectionFailed);
    } finally {
      setSendPhase("idle");
    }
  }, [accessToken, contextAttached, recordContext, copy, locale]);

  const handleSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || sendPhase === "sending") return;

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setDraft("");
    void sendConversation(nextMessages);
  }, [draft, messages, sendConversation, sendPhase]);

  const handleRetry = useCallback(() => {
    if (messages.length === 0 || sendPhase === "sending") return;
    void sendConversation(messages);
  }, [messages, sendConversation, sendPhase]);

  const statusLabel = phase === "loading"
    ? copy.checking
    : phase === "error"
      ? copy.checkFailed
      : status?.configured
        ? copy.enabled : copy.unconfigured;

  return (
    <AppShell subtitle={t.pageTitles.archiveAssistant} navLabel={t.pageTitles.archiveAssistantTours} contentClassName="copilot-content" tipsPage="copilot">
      <PageToolbar
        icon={<BotMessageSquare size={24} strokeWidth={1.8} />}
        eyebrow={<span className="badge">{copy.safeSpace}</span>} title={copy.title}
        description={
          status?.configured
            ? copy.configuredDescription : copy.unconfiguredDescription
        }
        meta={(
          <>
            <span className="badge" data-tone={phase === "error" ? "danger" : undefined}>{statusLabel}</span>
            <span className="badge">{copy.external.replace("{value}", status?.configured ? copy.activeOnSend : copy.stopped)}</span>
          </>
        )}
        actions={(
          <button className="button button-secondary" type="button" onClick={() => void refreshStatus()} disabled={phase === "loading"}>
            <RefreshCw aria-hidden="true" size={17} strokeWidth={2} />
            {copy.recheck}
          </button>
        )}
      />

      <OperationalSafetyPanel
        action={copy.safetyAction}
        dryRun={!status?.configured}
        confidence={status?.configured ? 75 : undefined}
        rights="review"
        auditHref="/activity"
      />
      <p className="helper-text">{copy.rightsNote}</p>

      {phase === "loading" ? (
        <div className="panel panel-compact" role="status" aria-live="polite">
          <p className="form-status">{copy.checkingDescription}</p>
        </div>
      ) : null}

      {phase === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>{copy.checkConfigurationFailed}</strong><span className="helper-text">{copy.disabledNote}</span>
        </div>
      ) : null}

      {phase === "ready" && !status?.configured ? (
        <div className="state-banner copilot-safety-banner" role="status">
          <ShieldCheck aria-hidden="true" size={20} strokeWidth={2} />
          <div>
            <strong>{copy.notConfigured}</strong><span>{copy.notConfiguredNote}</span>
          </div>
        </div>
      ) : null}

      {phase === "ready" && status?.configured ? (
        <div className="state-banner copilot-safety-banner" role="status">
          <ShieldCheck aria-hidden="true" size={20} strokeWidth={2} />
          <div>
            <strong>{copy.protectedEnabled}</strong><span>{copy.protectedEnabledNote}</span>
          </div>
        </div>
      ) : null}

      <MetricStrip
        ariaLabel={copy.limits}
        items={[
          {
            label: copy.sentConversations,
            value: String(messages.filter((message) => message.role === "user").length),
            description: status?.configured ? copy.sinceOpen : copy.noBrowserSend,
            icon: <BotMessageSquare size={20} />,
            tone: "accent"
          },
          {
            label: copy.externalContent, value: status?.configured ? copy.onDemand : copy.blocked, description: copy.noExternal,
            icon: <ShieldCheck size={20} />,
            tone: "success"
          },
          { label: copy.safePaths, value: safeStartingPoints.length, description: copy.startOperations, icon: <DatabaseZap size={20} />, tone: "info" }
        ]}
      />

      <section className="copilot-workspace" aria-label={copy.workspace}>
        <article className="panel copilot-conversation" aria-labelledby="copilot-conversation-title">
          <div className="panel-section-header">
            <h2 id="copilot-conversation-title">{copy.conversation}</h2>
            <p>
              {status?.configured
                ? copy.configuredConversation : copy.unconfiguredConversation}
            </p>
          </div>

          {messages.length === 0 ? (
            <EmptyState
              icon={<BotMessageSquare size={24} strokeWidth={1.8} />}
              title={copy.noConversations}
              description={
                status?.configured
                  ? copy.configuredEmpty : copy.unconfiguredEmpty
              }
            />
          ) : (
            <div className="copilot-messages" role="log" aria-live="polite">
              {messages.map((message, index) => (
                <div className="workspace-panel copilot-message" data-role={message.role} key={index}>
                  <strong>{message.role === "user" ? copy.you : copy.assistant}</strong>
                  <p>{message.content}</p>
                </div>
              ))}
              {sendPhase === "sending" ? (
                <p className="form-status" role="status">{copy.typing}</p>
              ) : null}
            </div>
          )}

          {sendError ? (
            <div className="state-banner state-banner-error" role="alert">
              <strong>{copy.sendFailed}</strong>
              <span className="helper-text">{sendError}</span>
              <div className="button-row">
                <button className="button button-secondary" type="button" onClick={handleRetry} disabled={sendPhase === "sending"}>
                  <RefreshCw aria-hidden="true" size={17} strokeWidth={2} />
                  {copy.retry}
                </button>
              </div>
            </div>
          ) : null}

          {recordContext ? (
            <div className="state-banner copilot-context-banner" role="status">
              <div>
                <strong>{contextAttached ? copy.contextAttached : copy.contextDetached}</strong>
                <span className="helper-text">{recordContext.title}</span>
              </div>
              <button
                type="button"
                className="button button-secondary button-sm"
                onClick={() => setContextAttached((attached) => !attached)}
              >
                {contextAttached ? (
                  <>
                    <X aria-hidden="true" size={16} strokeWidth={2} />
                    {copy.removeContext}
                  </>
                ) : (
                  copy.attachContext
                )}
              </button>
            </div>
          ) : null}

          <form onSubmit={handleSubmit}>
            <fieldset
              className="copilot-composer"
              disabled={!status?.configured || sendPhase === "sending"}
              aria-describedby="copilot-composer-note"
            >
              <label htmlFor="copilot-prompt">{copy.prompt}</label>
              <textarea
                id="copilot-prompt"
                className="search-input"
                placeholder={status?.configured ? copy.promptConfigured : copy.promptUnconfigured}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
              <div className="button-row">
                <button className="button button-primary" type="submit" disabled={!draft.trim() || sendPhase === "sending"}>
                  <BotMessageSquare aria-hidden="true" size={17} strokeWidth={2} />
                  {copy.send}
                </button>
              </div>
            </fieldset>
          </form>
          <p id="copilot-composer-note" className="helper-text">
            {status?.configured
              ? copy.draftConfigured : copy.draftUnconfigured}
          </p>
        </article>

        <aside className="copilot-guidance" aria-label={copy.guidance}>
          <div className="panel-section-header">
            <h2>{copy.startSystem}</h2><p>{copy.guidanceNote}</p>
          </div>
          <div className="copilot-guidance__list">
            {safeStartingPoints.map(({ title, description, href, icon: Icon, label }) => (
              <article className="workspace-panel copilot-guidance__item" key={href}>
                <Icon className="copilot-guidance__icon" aria-hidden="true" size={20} strokeWidth={1.8} />
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
                <a className="button button-secondary" href={href}>{label}</a>
              </article>
            ))}
          </div>
        </aside>
      </section>
    </AppShell>
  );
}

export default function CopilotPage() {
  return (
    <Suspense fallback={null}>
      <CopilotPageContent />
    </Suspense>
  );
}

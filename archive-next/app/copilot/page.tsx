"use client";

import { BotMessageSquare, CopyCheck, DatabaseZap, RefreshCw, Search, ShieldCheck, Tags } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import MetricStrip from "@/components/MetricStrip";
import PageToolbar from "@/components/PageToolbar";
import type { CopilotStatus } from "@/lib/copilot-status";
import { useAuthSession } from "@/lib/auth-session";

type StatusPhase = "loading" | "ready" | "error";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

type SendPhase = "idle" | "sending";

const safeStartingPoints = [
  {
    title: "ابحث في الأرشيف",
    description: "استخدم البحث المتقدم مع الفلاتر بدل إرسال محتوى الأرشيف إلى خدمة خارجية.",
    href: "/search",
    icon: Search,
    label: "فتح البحث"
  },
  {
    title: "راجع العناصر المتشابهة",
    description: "اعرض التكرارات المحتملة وقرر الدمج أو الاحتفاظ بكل سجل من داخل النظام.",
    href: "/duplicates",
    icon: CopyCheck,
    label: "فتح المكررات"
  },
  {
    title: "نظّم البيانات الوصفية",
    description: "أدر الأنواع والوسوم والمفردات أولاً لتحسين نتائج البحث والعمل الجماعي.",
    href: "/tags",
    icon: Tags,
    label: "فتح الوسوم"
  }
] as const;

export default function CopilotPage() {
  const [phase, setPhase] = useState<StatusPhase>("loading");
  const [status, setStatus] = useState<CopilotStatus | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sendPhase, setSendPhase] = useState<SendPhase>("idle");
  const [sendError, setSendError] = useState<string | null>(null);
  const { accessToken } = useAuthSession();

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
        body: JSON.stringify({ messages: nextMessages })
      });

      const payload = await response.json().catch(() => null) as { ok: true; reply: string } | { ok: false; error: string } | null;

      if (!response.ok || !payload?.ok) {
        setSendError(payload && !payload.ok ? payload.error : "تعذر إرسال الرسالة. حاول مرة أخرى.");
        return;
      }

      setMessages([...nextMessages, { role: "assistant", content: payload.reply }]);
    } catch {
      setSendError("تعذر الاتصال بالخادم. تحقق من الاتصال ثم أعد المحاولة.");
    } finally {
      setSendPhase("idle");
    }
  }, [accessToken]);

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
    ? "جارٍ التحقق"
    : phase === "error"
      ? "تعذر التحقق"
      : status?.configured
        ? "المحادثة مفعّلة"
        : "غير مهيأ";

  return (
    <AppShell subtitle="مساعد الأرشيف" navLabel="مسارات مساعد الأرشيف" contentClassName="copilot-content">
      <PageToolbar
        icon={<BotMessageSquare size={24} strokeWidth={1.8} />}
        eyebrow={<span className="badge">مساحة آمنة</span>}
        title="مساعد الأرشيف"
        description={
          status?.configured
            ? "المحادثة محمية بجلسة تسجيل الدخول ولا تُرسل رسائلك إلا عند الضغط على إرسال."
            : "نقطة دخول موجهة لعمليات الأرشيف. لا ترسل هذه الشاشة نصوصاً أو ملفات إلى أي مزود ذكاء اصطناعي."
        }
        meta={(
          <>
            <span className="badge" data-tone={phase === "error" ? "danger" : undefined}>{statusLabel}</span>
            <span className="badge">معالجة خارجية: {status?.configured ? "نشطة عند الإرسال" : "متوقفة"}</span>
          </>
        )}
        actions={(
          <button className="button button-secondary" type="button" onClick={() => void refreshStatus()} disabled={phase === "loading"}>
            <RefreshCw aria-hidden="true" size={17} strokeWidth={2} />
            إعادة التحقق
          </button>
        )}
      />

      {phase === "loading" ? (
        <div className="panel panel-compact" role="status" aria-live="polite">
          <p className="form-status">جارٍ فحص جاهزية المساعد على الخادم دون الاتصال بأي مزود خارجي…</p>
        </div>
      ) : null}

      {phase === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>تعذر فحص تهيئة المساعد</strong>
          <span className="helper-text">لا تزال المحادثة والتكاملات الخارجية معطلة. أعد المحاولة بعد التحقق من الخادم.</span>
        </div>
      ) : null}

      {phase === "ready" && !status?.configured ? (
        <div className="state-banner copilot-safety-banner" role="status">
          <ShieldCheck aria-hidden="true" size={20} strokeWidth={2} />
          <div>
            <strong>المساعد غير مهيأ خادمياً</strong>
            <span>تبقى المحادثة معطلة إلى أن يفعّل المسؤول مزوداً خادمياً محمياً ونقطة خدمة تراجع الصلاحيات.</span>
          </div>
        </div>
      ) : null}

      {phase === "ready" && status?.configured ? (
        <div className="state-banner copilot-safety-banner" role="status">
          <ShieldCheck aria-hidden="true" size={20} strokeWidth={2} />
          <div>
            <strong>المحادثة مفعّلة عبر نقطة خدمة محمية</strong>
            <span>تُرسل رسالتك ورد المساعد فقط عند الضغط على إرسال، وتمر عبر التحقق من صلاحيتك أولاً.</span>
          </div>
        </div>
      ) : null}

      <MetricStrip
        ariaLabel="حدود مساعد الأرشيف"
        items={[
          {
            label: "محادثات مرسلة",
            value: String(messages.filter((message) => message.role === "user").length),
            description: status?.configured ? "منذ فتح هذه الصفحة" : "لا يوجد إرسال من المتصفح",
            icon: <BotMessageSquare size={20} />,
            tone: "accent"
          },
          {
            label: "محتوى خارجي",
            value: status?.configured ? "عند الطلب فقط" : "محجوب",
            description: "لا ملفات ولا نصوص تغادر هذه الشاشة دون إرسال صريح",
            icon: <ShieldCheck size={20} />,
            tone: "success"
          },
          { label: "مسارات آمنة", value: safeStartingPoints.length, description: "ابدأ بعمليات النظام الحالية", icon: <DatabaseZap size={20} />, tone: "info" }
        ]}
      />

      <section className="copilot-workspace" aria-label="مساحة مساعد الأرشيف">
        <article className="panel copilot-conversation" aria-labelledby="copilot-conversation-title">
          <div className="panel-section-header">
            <h2 id="copilot-conversation-title">محادثة المساعد</h2>
            <p>
              {status?.configured
                ? "الرسائل هنا تُرسل إلى نقطة خدمة محمية على الخادم بعد التحقق من جلستك."
                : "ستظهر المحادثات المراجعة خادمياً هنا بعد إضافة نقطة الخدمة المحمية."}
            </p>
          </div>

          {messages.length === 0 ? (
            <EmptyState
              icon={<BotMessageSquare size={24} strokeWidth={1.8} />}
              title="لا توجد محادثات بعد"
              description={
                status?.configured
                  ? "اكتب سؤالك أدناه للبدء. لا يُرسل أي محتوى إلى المساعد قبل الضغط على إرسال."
                  : "هذه مساحة فارغة مقصودة: لا تُنشأ أي طلبات ذكاء اصطناعي أو طلبات خارجية من هذا المتصفح."
              }
            />
          ) : (
            <div className="copilot-messages" role="log" aria-live="polite">
              {messages.map((message, index) => (
                <div className="workspace-panel copilot-message" data-role={message.role} key={index}>
                  <strong>{message.role === "user" ? "أنت" : "المساعد"}</strong>
                  <p>{message.content}</p>
                </div>
              ))}
              {sendPhase === "sending" ? (
                <p className="form-status" role="status">المساعد يكتب الرد…</p>
              ) : null}
            </div>
          )}

          {sendError ? (
            <div className="state-banner state-banner-error" role="alert">
              <strong>تعذر إرسال الرسالة</strong>
              <span className="helper-text">{sendError}</span>
              <div className="button-row">
                <button className="button button-secondary" type="button" onClick={handleRetry} disabled={sendPhase === "sending"}>
                  <RefreshCw aria-hidden="true" size={17} strokeWidth={2} />
                  إعادة المحاولة
                </button>
              </div>
            </div>
          ) : null}

          <form onSubmit={handleSubmit}>
            <fieldset
              className="copilot-composer"
              disabled={!status?.configured || sendPhase === "sending"}
              aria-describedby="copilot-composer-note"
            >
              <label htmlFor="copilot-prompt">اكتب طلبك</label>
              <textarea
                id="copilot-prompt"
                className="search-input"
                placeholder={status?.configured ? "اكتب سؤالك عن الأرشيف هنا…" : "المحادثة غير متاحة حتى اكتمال التهيئة الخادمية الآمنة."}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
              <div className="button-row">
                <button className="button button-primary" type="submit" disabled={!draft.trim() || sendPhase === "sending"}>
                  <BotMessageSquare aria-hidden="true" size={17} strokeWidth={2} />
                  إرسال إلى المساعد
                </button>
              </div>
            </fieldset>
          </form>
          <p id="copilot-composer-note" className="helper-text">
            {status?.configured
              ? "لا تحفظ هذه الصفحة أي مسودة في المتصفح؛ المحادثة تُفقد عند تحديث الصفحة."
              : "الحقل معطل عمداً، ولا تحفظ هذه الصفحة أي مسودة في المتصفح."}
          </p>
        </article>

        <aside className="copilot-guidance" aria-label="مسارات آمنة مقترحة">
          <div className="panel-section-header">
            <h2>ابدأ من النظام</h2>
            <p>بدائل عملية متاحة الآن دون انتظار أي تكامل خارجي.</p>
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

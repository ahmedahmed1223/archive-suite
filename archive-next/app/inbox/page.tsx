"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { useCapability } from "@/components/RoleGate";
import { createArchiveApiClient, type InboxItem, type InboxStatus } from "@/lib/archive-api";
import { formatDate, normalizeText } from "@/lib/record-utils";
import { toastError, toastSuccess } from "@/lib/toast";
import { Skeleton } from "@/components/ui/Skeleton";
import { triageCommand } from "@/lib/inbox-triage";

const statusLabels: Record<InboxStatus, string> = {
  new: "وارد جديد",
  triage: "قيد الفرز",
  ready: "جاهز للأرشفة",
  done: "مكتمل"
};

type InboxLoadState =
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; message: string };

export default function InboxPage() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loadState, setLoadState] = useState<InboxLoadState>({ status: "loading" });
  const [statusMessage, setStatusMessage] = useState("");
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("");
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState<InboxStatus | "all">("all");
  const [triageMode, setTriageMode] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [departmentTargets, setDepartmentTargets] = useState<Record<string, string>>({});
  const [routingPreviews, setRoutingPreviews] = useState<Record<string, string>>({});
  const [routingBusyId, setRoutingBusyId] = useState<string | null>(null);
  const canRouteInbox = useCapability("records.edit");

  async function refreshInbox() {
    setLoadState({ status: "loading" });
    const response = await api.inboxItems();
    if (response.ok) {
      setItems(response.items);
      setLoadState({ status: "ready" });
    } else {
      const message = response.error || "تعذر تحميل الوارد.";
      setLoadState({ status: "error", message });
      setStatusMessage(message);
    }
  }

  useEffect(() => {
    void refreshInbox();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refreshInbox is redefined every render; api is the only stable dependency and is already listed
  }, [api]);

  const visibleItems = useMemo(() => {
    return filter === "all" ? items : items.filter((item) => item.status === filter);
  }, [filter, items]);

  const counts = useMemo(() => {
    return items.reduce<Record<InboxStatus, number>>((acc, item) => {
      acc[item.status] += 1;
      return acc;
    }, { new: 0, triage: 0, ready: 0, done: 0 });
  }, [items]);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(0, visibleItems.length - 1)));
  }, [visibleItems.length]);

  useEffect(() => {
    if (!triageMode) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const editing = Boolean(target?.closest("input, textarea, select, [contenteditable='true']"));
      const command = triageCommand(event.key, editing);
      if (!command || !visibleItems.length) return;
      event.preventDefault();
      if (command.type === "move") {
        setActiveIndex((current) => Math.max(0, Math.min(visibleItems.length - 1, current + command.offset)));
        return;
      }
      const item = visibleItems[activeIndex];
      if (!item) return;
      if (command.type === "status") {
        void updateStatus(item.id, command.status);
        return;
      }
      const href = item.status === "ready" ? "/uploads" : item.status === "done" ? "/archive" : `/search?q=${encodeURIComponent(normalizeText(item.title))}`;
      window.location.assign(href);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, triageMode, visibleItems]);

  async function addItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    setStatusMessage("جار الحفظ...");
    const response = await api.createInboxItem({ title: title.trim(), source: source.trim(), note: note.trim() });
    if (!response.ok) {
      const message = response.error || "تعذر إضافة العنصر.";
      setStatusMessage(message);
      toastError(message);
      return;
    }
    setStatusMessage("تمت الإضافة إلى الوارد.");
    toastSuccess("تمت إضافة العنصر إلى الوارد.");
    setTitle("");
    setSource("");
    setNote("");
    await refreshInbox();
  }

  async function updateStatus(id: string, status: InboxStatus) {
    const response = await api.updateInboxItem(id, { status });
    if (!response.ok) {
      const message = response.error || "تعذر تحديث الحالة.";
      setStatusMessage(message);
      toastError(message);
    }
    await refreshInbox();
  }

  async function removeItem(id: string) {
    const response = await api.deleteInboxItem(id);
    if (!response.ok) {
      const message = response.error || "تعذر حذف العنصر.";
      setStatusMessage(message);
      toastError(message);
    } else {
      toastSuccess("تم حذف العنصر.");
    }
    await refreshInbox();
  }

  async function previewRouting(item: InboxItem) {
    const departmentId = departmentTargets[item.id]?.trim();
    if (!departmentId) return;

    setRoutingBusyId(item.id);
    const response = await api.previewInboxDepartmentRouting(item.id, departmentId);
    const message = !response.ok
      ? response.error || "تعذرت معاينة التوجيه."
      : response.blocked
        ? response.reason || "تم منع التوجيه المتكرر."
        : `يمكن التوجيه إلى قسم ${response.toDepartmentId}. لن يُنفذ شيء قبل التأكيد.`;
    setRoutingPreviews((current) => ({ ...current, [item.id]: message }));
    setRoutingBusyId(null);
  }

  async function applyRouting(item: InboxItem) {
    const departmentId = departmentTargets[item.id]?.trim();
    if (!departmentId) return;

    setRoutingBusyId(item.id);
    const response = await api.routeInboxDepartment(item.id, departmentId);
    if (!response.ok) {
      const message = response.error || "تم منع التوجيه أو تعذر تنفيذه.";
      setRoutingPreviews((current) => ({ ...current, [item.id]: message }));
      toastError(message);
    } else {
      toastSuccess(`تم توجيه العنصر إلى قسم ${response.departmentId}.`);
      setRoutingPreviews((current) => ({ ...current, [item.id]: "تم التوجيه وتسجيله في السجل." }));
      await refreshInbox();
    }
    setRoutingBusyId(null);
  }

  return (
    <AppShell subtitle="صندوق الوارد" contentClassName="local-list-content" tipsPage="inbox">
      <PageToolbar
        eyebrow={<span className="badge">التقاط سريع</span>}
        title="صندوق الوارد"
        description="التقاط سريع للمواد أو الأفكار قبل الأرشفة، محفوظ في الخادم لكل مستخدم."
        meta={(
          <>
            <span className="badge">{items.length} عنصر</span>
            <span className="badge">{counts.ready} جاهز للأرشفة</span>
          </>
        )}
        actions={<><button className="button button-secondary" type="button" aria-pressed={triageMode} onClick={() => setTriageMode((value) => !value)}>{triageMode ? "إنهاء الفرز السريع" : "بدء الفرز السريع"}</button><a className="button button-primary" href="/uploads">رفع ملف</a></>}
      >
        <form className="archive-toolbar-grid" onSubmit={addItem}>
          <label>
            <span>العنوان</span>
            <input className="search-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="مادة أو مهمة فرز" />
          </label>
          <label>
            <span>المصدر</span>
            <input className="search-input" value={source} onChange={(event) => setSource(event.target.value)} placeholder="مجلد، جهة، رابط..." />
          </label>
          <label className="full-span">
            <span>ملاحظة</span>
            <textarea className="search-input" value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
          </label>
          <div className="archive-toolbar-actions">
            <button className="button button-primary" type="submit" disabled={!title.trim()}>إضافة للوارد</button>
          </div>
        </form>
        {statusMessage ? <p className="form-status">{statusMessage}</p> : null}
        <div className="archive-toolbar-row">
          <button className="badge" data-active={filter === "all" ? "true" : "false"} type="button" onClick={() => setFilter("all")}>الكل · {items.length}</button>
          {(Object.keys(statusLabels) as InboxStatus[]).map((status) => (
            <button key={status} className="badge" data-active={filter === status ? "true" : "false"} type="button" onClick={() => setFilter(status)}>
              {statusLabels[status]} · {counts[status]}
            </button>
          ))}
        </div>
      </PageToolbar>

      {triageMode ? <div className="state-banner state-banner-info" role="status"><strong>الفرز السريع مفعّل</strong><span>J/K أو الأسهم للتنقل · 1 جديد · 2 قيد الفرز · 3 جاهز · 4 مكتمل · Enter للفتح</span></div> : null}

      {loadState.status === "loading" ? (
        <div className="panel panel-compact"><Skeleton label="جار تحميل عناصر الوارد..." /></div>
      ) : null}

      {loadState.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>تعذر تحميل عناصر الوارد</strong>
          <span className="helper-text">{loadState.message}</span>
          <div><button type="button" className="button button-secondary button-sm" onClick={() => void refreshInbox()}>إعادة المحاولة</button></div>
        </div>
      ) : null}

      {loadState.status === "ready" && visibleItems.length === 0 ? (
        <EmptyState title="لا توجد عناصر في هذا العرض." description="أضف عنصراً سريعاً أو غيّر فلتر الحالة." />
      ) : (
        <section className="dense-grid" aria-label="عناصر الوارد">
          {visibleItems.map((item, index) => (
            <article className="local-list-card" data-triage-active={triageMode && index === activeIndex} aria-current={triageMode && index === activeIndex ? "true" : undefined} key={item.id}>
              <div className="local-list-card__main">
                <div>
                  <span className="badge">{statusLabels[item.status]}</span>
                  <h3>{item.title}</h3>
                </div>
                <span className="badge">{item.createdAt ? formatDate(item.createdAt) : "-"}</span>
              </div>
              <dl className="mobile-field-list">
                <div><dt>المصدر</dt><dd dir="auto">{item.source || "-"}</dd></div>
                <div><dt>الملاحظة</dt><dd>{item.note || "-"}</dd></div>
                <div><dt>القسم</dt><dd>{item.departmentId || "غير موجّه"}</dd></div>
              </dl>
              <div className="button-row">
                <select value={item.status} onChange={(event) => void updateStatus(item.id, event.target.value as InboxStatus)} aria-label={`حالة ${item.title}`}>
                  {(Object.keys(statusLabels) as InboxStatus[]).map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
                </select>
                <a className="button button-secondary button-sm" href={`/search?q=${encodeURIComponent(normalizeText(item.title))}`}>بحث مشابه</a>
                {item.status === "ready" ? <a className="button button-primary button-sm" href="/uploads">بدء الأرشفة</a> : null}
                {item.status === "done" ? <a className="button button-secondary button-sm" href="/archive">فتح الأرشيف</a> : null}
                <button className="button button-danger button-sm" type="button" onClick={() => void removeItem(item.id)}>حذف</button>
              </div>
              <div className="button-row">
                <input className="search-input" value={departmentTargets[item.id] || ""} onChange={(event) => setDepartmentTargets((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="معرّف القسم المستهدف" aria-label={`القسم المستهدف لـ ${item.title}`} />
                <button className="button button-secondary button-sm" type="button" onClick={() => void previewRouting(item)} disabled={routingBusyId === item.id || !(departmentTargets[item.id] || "").trim()}>معاينة التوجيه</button>
                {canRouteInbox ? <button className="button button-primary button-sm" type="button" onClick={() => void applyRouting(item)} disabled={routingBusyId === item.id || !(departmentTargets[item.id] || "").trim()}>توجيه للقسم</button> : null}
              </div>
              {routingPreviews[item.id] ? <p className="helper-text" role="status">{routingPreviews[item.id]}</p> : null}
            </article>
          ))}
        </section>
      )}
    </AppShell>
  );
}

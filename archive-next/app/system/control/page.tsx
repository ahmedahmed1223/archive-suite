"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ArchiveRestore, LockKeyhole, RefreshCw, ServerCog, ShieldCheck, Trash2 } from "lucide-react";
import AppShell from "@/components/AppShell";
import PageToolbar from "@/components/PageToolbar";
import { Button } from "@/components/ui/Button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/Dialog";
import { createArchiveApiClient, type SystemControlAction, type SystemControlResult } from "@/lib/archive-api";

type GateState =
  | { status: "loading" }
  | { status: "enabled" }
  | { status: "disabled" }
  | { status: "forbidden" }
  | { status: "error"; message: string };

type ActionState =
  | { status: "idle" }
  | { status: "running"; action: SystemControlAction }
  | { status: "success"; action: SystemControlAction; result: SystemControlResult }
  | { status: "error"; action: SystemControlAction; message: string };

const ACTIONS: { id: SystemControlAction; label: string; description: string; audit: string; icon: typeof Trash2 }[] = [
  {
    id: "clear-cache",
    label: "تفريغ ذاكرة التخزين المؤقت",
    description: "يفرّغ ذاكرة التخزين المؤقت وإعدادات الخادم المخبأة.",
    audit: "يسجل محاولة system_control.allowed أو blocked",
    icon: Trash2
  },
  {
    id: "run-backup",
    label: "تشغيل نسخة احتياطية فورية",
    description: "يُنشئ نسخة احتياطية جديدة فورًا (مطابق لزر النسخ الاحتياطي).",
    audit: "يرتبط بسجل النسخ الاحتياطي والتدقيق",
    icon: ArchiveRestore
  }
];

function gateLabel(status: GateState["status"]) {
  const labels: Record<GateState["status"], string> = {
    loading: "جار التحقق",
    enabled: "مفعلة للمشرف",
    disabled: "معطلة من الخادم",
    forbidden: "صلاحية مرفوضة",
    error: "تعذر الفحص"
  };

  return labels[status];
}

export default function SystemControlPage() {
  const [gate, setGate] = useState<GateState>({ status: "loading" });
  const [actionState, setActionState] = useState<ActionState>({ status: "idle" });
  const [isClearCacheConfirmOpen, setIsClearCacheConfirmOpen] = useState(false);
  const apiRef = useRef(createArchiveApiClient());

  // Probe the gate by attempting a harmless status read; the definitive,
  // server-side enforcement lives in SystemControlService — this page only
  // reflects that state, it never enables anything on its own.
  const loadGate = useCallback(async () => {
    setGate({ status: "loading" });
    try {
      const response = await apiRef.current.systemStatus();
      if (!response.ok) {
        // ponytail: `error === "Forbidden."` is a transitional fallback for
        // an older API that predates the `code` field — drop once the API
        // is guaranteed to always send `code`.
        if (response.code === "FORBIDDEN" || response.error === "Forbidden.") {
          setGate({ status: "forbidden" });
          return;
        }
        setGate({ status: "error", message: response.error || "تعذر التحقق من حالة النظام." });
        return;
      }
      // systemStatus succeeding only confirms admin access; the actual
      // enabled/disabled gate is discovered on first action attempt below,
      // since there is no separate "is control enabled" read endpoint.
      setGate({ status: "enabled" });
    } catch (error) {
      setGate({ status: "error", message: error instanceof Error ? error.message : "خطأ غير معروف" });
    }
  }, []);

  useEffect(() => {
    void loadGate();
  }, [loadGate]);

  const runAction = async (action: SystemControlAction) => {
    setActionState({ status: "running", action });
    try {
      const response = await apiRef.current.runSystemControlAction(action);
      if (!response.ok) {
        // ponytail: `error === "..."` is a transitional fallback for an
        // older API that predates the `code` field — drop once the API is
        // guaranteed to always send `code`.
        if (response.code === "SYSTEM_CONTROL_DISABLED" || response.error === "System control actions are disabled.") {
          setGate({ status: "disabled" });
        }
        setActionState({ status: "error", action, message: response.error || "تعذر تنفيذ الإجراء." });
        return;
      }
      setActionState({ status: "success", action, result: response.result });
    } catch (error) {
      setActionState({ status: "error", action, message: error instanceof Error ? error.message : "خطأ غير معروف" });
    }
  };

  const isDisabledGate = gate.status === "disabled";
  const clearCacheDisabled = gate.status !== "enabled" || actionState.status === "running";

  const requestAction = (action: SystemControlAction) => {
    if (action === "clear-cache") {
      setIsClearCacheConfirmOpen(true);
      return;
    }
    void runAction(action);
  };

  return (
    <AppShell subtitle="التحكم بالنظام" navLabel="التحكم بالنظام" contentClassName="observability-content">
      <PageToolbar
        icon={<ServerCog size={24} />}
        eyebrow={<span className="badge badge-danger">إجراء عالي الخطورة</span>}
        title="التحكم بالنظام"
        description="إجراءات تؤثر مباشرة على المضيف. معطّلة تمامًا افتراضيًا؛ يجب تفعيلها صراحة من متغير بيئة على الخادم (SYSTEM_CONTROL_ENABLED)، وهي متاحة للمشرفين فقط، وكل محاولة (ناجحة أو مرفوضة) تُسجَّل في سجل التدقيق."
        meta={
          <>
            <span className={gate.status === "enabled" ? "badge badge-success" : "badge badge-warning"}>{gateLabel(gate.status)}</span>
            <span className="badge">Audit enforced</span>
          </>
        }
        actions={
          <button type="button" className="button button-secondary" onClick={() => void loadGate()} disabled={gate.status === "loading"}>
            <RefreshCw size={16} aria-hidden="true" />
            تحديث الحالة
          </button>
        }
      />

      <section className="control-gate-grid" aria-label="حالة التحكم بالنظام">
        <article className="system-health-strip" data-tone={gate.status === "enabled" ? "success" : "danger"}>
          <span className="system-health-strip__icon" aria-hidden="true">
            {gate.status === "enabled" ? <ShieldCheck size={20} /> : <LockKeyhole size={20} />}
          </span>
          <div>
            <strong>{gateLabel(gate.status)}</strong>
            <p>{gate.status === "enabled" ? "الصلاحية متاحة، لكن كل إجراء لا يزال يتحقق من الخادم." : "الأزرار تبقى مقيدة حتى يسمح الخادم بذلك."}</p>
          </div>
        </article>
        <article className="system-health-strip" data-tone="danger">
          <span className="system-health-strip__icon" aria-hidden="true">
            <AlertTriangle size={20} />
          </span>
          <div>
            <strong>نطاق حساس</strong>
            <p>لا توجد محاكاة في الواجهة؛ التنفيذ الحقيقي يمر عبر الخادم فقط.</p>
          </div>
        </article>
      </section>

      {gate.status === "forbidden" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>هذه الصفحة للمشرفين فقط</strong>
          <p>لا تملك صلاحية الوصول إلى إجراءات التحكم بالنظام.</p>
        </div>
      ) : null}

      {gate.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>تعذر التحقق من حالة النظام</strong>
          <p>{gate.message}</p>
        </div>
      ) : null}

      {isDisabledGate ? (
        <div className="state-banner state-banner-error" role="alert" data-testid="system-control-disabled-banner">
          <strong>إجراءات التحكم بالنظام معطّلة</strong>
          <p>لم يتم تفعيل SYSTEM_CONTROL_ENABLED على الخادم. جميع الأزرار أدناه غير فعّالة حتى يُفعَّل المتغير صراحة من إعدادات النشر.</p>
        </div>
      ) : null}

      {actionState.status === "success" ? (
        <div className="state-banner state-banner-success" role="status">
          <strong>تم تنفيذ الإجراء: {actionState.result.action}</strong>
          <pre className="mono-text text-sm wrap-anywhere">{JSON.stringify(actionState.result.detail, null, 2)}</pre>
          <div className="button-row">
            <a className="button button-secondary" href="/status">تحقق من نتيجة الإجراء</a>
            <a className="button button-secondary" href="/first-run">متابعة رحلة الإعداد</a>
          </div>
        </div>
      ) : null}

      {actionState.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>تعذر تنفيذ الإجراء</strong>
          <p>{actionState.message}</p>
          <a className="button button-secondary" href="/status">راجع حالة النظام وخطوات الإصلاح</a>
        </div>
      ) : null}

      <section className="panel" aria-label="إجراءات التحكم">
        <div className="panel-title-row">
          <div>
            <h2>الإجراءات المتاحة</h2>
            <p>كل إجراء يتحقق من التفعيل والصلاحية على الخادم قبل التنفيذ، بصرف النظر عن حالة هذه الواجهة.</p>
          </div>
        </div>
        <div className="system-action-grid">
          {ACTIONS.map((action) => {
            const isRunning = actionState.status === "running" && actionState.action === action.id;
            const disallowed = gate.status !== "enabled" || actionState.status === "running";
            const Icon = action.icon;

            return (
              <article key={action.id} className="system-action-card" data-disabled={disallowed ? "true" : "false"}>
                <div className="system-action-card__header">
                  <span aria-hidden="true"><Icon size={20} /></span>
                  <strong>{action.label}</strong>
                </div>
                <p className="helper-text">{action.description}</p>
                <span className="badge">{action.audit}</span>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => requestAction(action.id)}
                  disabled={disallowed}
                  title={isDisabledGate ? "غير مفعّل من إعدادات الخادم" : action.label}
                >
                  {isRunning ? "جاري التنفيذ..." : "تنفيذ"}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <Dialog open={isClearCacheConfirmOpen} onOpenChange={setIsClearCacheConfirmOpen}>
        <DialogContent
          className="system-control-confirmation"
          title="تأكيد تفريغ الذاكرة المؤقتة"
          description="سيتم تنفيذ الإجراء مباشرة على الخادم وتسجيله في سجل التدقيق. قد تتأخر الاستجابة التالية مؤقتًا أثناء إعادة بناء الإعدادات المخبأة."
        >
          <div className="system-control-confirmation__body">
            <p>تأكد من أنك تريد متابعة الإجراء في بيئة الإنتاج.</p>
            <div className="system-control-confirmation__actions">
              <DialogClose asChild>
                <Button type="button" variant="secondary">إلغاء</Button>
              </DialogClose>
              <Button
                type="button"
                variant="danger"
                disabled={clearCacheDisabled}
                onClick={() => {
                  setIsClearCacheConfirmOpen(false);
                  void runAction("clear-cache");
                }}
              >
                <Trash2 size={16} aria-hidden="true" />
                تأكيد التفريغ
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

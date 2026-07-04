"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AppShell from "@/components/AppShell";
import PageToolbar from "@/components/PageToolbar";
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

const ACTIONS: { id: SystemControlAction; label: string; description: string }[] = [
  { id: "clear-cache", label: "تفريغ ذاكرة التخزين المؤقت", description: "يفرّغ ذاكرة التخزين المؤقت وإعدادات Laravel المخبأة." },
  { id: "run-backup", label: "تشغيل نسخة احتياطية فورية", description: "يُنشئ نسخة احتياطية جديدة فورًا (مطابق لزر النسخ الاحتياطي)." }
];

export default function SystemControlPage() {
  const [gate, setGate] = useState<GateState>({ status: "loading" });
  const [actionState, setActionState] = useState<ActionState>({ status: "idle" });
  const apiRef = useRef(createArchiveApiClient());

  // Probe the gate by attempting a harmless status read; the definitive,
  // server-side enforcement lives in SystemControlService — this page only
  // reflects that state, it never enables anything on its own.
  const loadGate = useCallback(async () => {
    setGate({ status: "loading" });
    try {
      const response = await apiRef.current.systemStatus();
      if (!response.ok) {
        if ("error" in response && response.error === "Forbidden.") {
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
        if (response.error === "System control actions are disabled.") {
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

  return (
    <AppShell subtitle="التحكم بالنظام" navLabel="التحكم بالنظام" contentClassName="observability-content">
      <PageToolbar
        eyebrow={<span className="badge badge-danger">إجراء عالي الخطورة</span>}
        title="التحكم بالنظام"
        description="إجراءات تؤثر مباشرة على المضيف. معطّلة تمامًا افتراضيًا؛ يجب تفعيلها صراحة من متغير بيئة على الخادم (SYSTEM_CONTROL_ENABLED)، وهي متاحة للمشرفين فقط، وكل محاولة (ناجحة أو مرفوضة) تُسجَّل في سجل التدقيق."
        actions={
          <button type="button" className="button button-secondary" onClick={() => void loadGate()} disabled={gate.status === "loading"}>
            تحديث الحالة
          </button>
        }
      />

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
        </div>
      ) : null}

      {actionState.status === "error" ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>تعذر تنفيذ الإجراء</strong>
          <p>{actionState.message}</p>
        </div>
      ) : null}

      <section className="panel" aria-label="إجراءات التحكم">
        <div className="panel-title-row">
          <div>
            <h2>الإجراءات المتاحة</h2>
            <p>كل إجراء يتحقق من التفعيل والصلاحية على الخادم قبل التنفيذ، بصرف النظر عن حالة هذه الواجهة.</p>
          </div>
        </div>
        <div className="button-row">
          {ACTIONS.map((action) => {
            const isRunning = actionState.status === "running" && actionState.action === action.id;
            const disallowed = gate.status !== "enabled" || actionState.status === "running";

            return (
              <div key={action.id} className="panel panel-compact">
                <strong>{action.label}</strong>
                <p className="helper-text">{action.description}</p>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => void runAction(action.id)}
                  disabled={disallowed}
                  title={isDisabledGate ? "غير مفعّل من إعدادات الخادم" : action.label}
                >
                  {isRunning ? "جاري التنفيذ..." : "تنفيذ"}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}

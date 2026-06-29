import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { Cog, Database, Rocket, ShieldCheck, Sparkles } from "lucide-react";

import { useAppStore, useAuthStore } from "../../stores/index.js";

/**
 * BootChoiceScreen — the first thing a brand-new user sees.
 *
 * Replaces the 9-step wizard as the front door. Two choices only:
 *   • Quick Start    — admin account + local DB + local storage, one click.
 *   • Advanced Setup — opens the full V1OnboardingWizard for power users.
 *
 * Quick Start mirrors the V1 wizard's "quick" branch (skipPasswordSetup +
 * mark onboarding complete) so the user lands on the dashboard immediately.
 */
export function BootChoiceScreen({ onAdvanced, onComplete }: any) {
  const { updateSettings, settings, skipPasswordSetup } = useAppStore();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  const handleQuick = async () => {
    setBusy(true);
    setError("");
    try {
      await skipPasswordSetup?.();
      const adminUser = (useAppStore.getState().users || [])
        .find((user: any) => user.username === "admin" && user.isActive !== false)
        || (useAppStore.getState().users || []).find((user: any) => user.isActive !== false);
      if (adminUser) {
        useAuthStore.setState({ currentUser: adminUser, isAuthenticated: true, authError: null });
      }
      await updateSettings({
        ui: {
          ...(settings?.ui || {}),
          onboardingCompleted: true,
          v1OnboardingCompleted: true,
          firstTaskChoice: "dashboard",
          firstTaskChoiceUsed: true,
          onboardingSecurityMode: "quick",
          lastOnboardingStep: "boot-quick",
          bootChoice: "quick"
        }
      });
      onComplete?.({ securityMode: "quick", bootChoice: "quick" });
    } catch (e: any) {
      setError(e?.message || "تعذّر إكمال البدء السريع.");
    } finally {
      setBusy(false);
    }
  };

  const handleAdvanced = () => {
    updateSettings({ ui: { ...(settings?.ui || {}), bootChoice: "advanced" } });
    onAdvanced?.();
  };

  return jsxs("div", {
    dir: "rtl",
    role: "dialog",
    "aria-modal": "true",
    "aria-label": "اختيار نمط الإطلاق",
    className: "fixed inset-0 z-[120] flex items-center justify-center bg-black/70 p-6",
    children: [
      jsxs("section", {
        className: "w-full max-w-3xl space-y-6 rounded-3xl border border-white/10 bg-[var(--va-surface,#0e1117)] p-8 shadow-2xl",
        children: [
          jsxs("header", {
            className: "space-y-2 text-center",
            children: [
              jsx("div", { className: "mx-auto flex h-14 w-14 items-center justify-center rounded-2xl va-accent-bg-soft va-accent-text", children: jsx(Sparkles, { className: "h-6 w-6" }) }),
              jsx("h1", { className: "text-2xl font-semibold text-[var(--va-text,#fff)]", children: "مرحباً — كيف تريد البدء؟" }),
              jsx("p", { className: "text-sm text-[var(--va-text-muted,#9aa0a6)]", children: "خياران لا أكثر. يمكنك تغيير أي إعداد لاحقاً من الإعدادات." })
            ]
          }),
          error ? jsx("p", { role: "alert", className: "rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200", children: error }) : null,
          jsxs("div", {
            className: "grid gap-4 md:grid-cols-2",
            children: [
              jsxs("button", {
                type: "button",
                disabled: busy,
                onClick: handleQuick,
                "aria-label": "بدء سريع — حساب admin افتراضي + قاعدة بيانات محلية + تخزين محلي",
                className: "group flex flex-col items-start gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/5 p-5 text-right transition-colors hover:bg-emerald-500/10 disabled:cursor-wait disabled:opacity-60",
                children: [
                  jsxs("div", {
                    className: "flex items-center gap-2 text-emerald-300",
                    children: [
                      jsx(Rocket, { className: "h-5 w-5" }),
                      jsx("span", { className: "text-xs font-semibold uppercase tracking-wide", children: "موصى به" })
                    ]
                  }),
                  jsx("h2", { className: "text-lg font-semibold text-[var(--va-text,#fff)]", children: "بدء سريع" }),
                  jsx("p", { className: "text-sm leading-6 text-[var(--va-text-muted,#9aa0a6)]", children: "نقرة واحدة. حساب مدير افتراضي، قاعدة بيانات محلية، تخزين محلي، وثيم النظام. تدخل لوحة التحكم فوراً." }),
                  jsxs("ul", {
                    className: "mt-1 space-y-1 text-xs text-[var(--va-text-muted,#9aa0a6)]",
                    children: [
                      jsxs("li", { className: "flex items-center gap-2", children: [jsx(ShieldCheck, { className: "h-3.5 w-3.5" }), "صلاحيات admin افتراضية"] }),
                      jsxs("li", { className: "flex items-center gap-2", children: [jsx(Database, { className: "h-3.5 w-3.5" }), "قاعدة بيانات + تخزين محلي"] })
                    ]
                  }),
                  jsx("span", { className: "mt-2 text-sm font-semibold text-emerald-300 group-hover:underline", children: busy ? "...جاري التهيئة" : "ابدأ الآن →" })
                ]
              }),
              jsxs("button", {
                type: "button",
                disabled: busy,
                onClick: handleAdvanced,
                "aria-label": "إعداد متقدم — كل الخيارات",
                className: "group flex flex-col items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-right transition-colors hover:bg-white/[0.05] disabled:cursor-wait disabled:opacity-60",
                children: [
                  jsx("div", {
                    className: "flex items-center gap-2 text-[var(--va-text-muted,#9aa0a6)]",
                    children: jsx(Cog, { className: "h-5 w-5" })
                  }),
                  jsx("h2", { className: "text-lg font-semibold text-[var(--va-text,#fff)]", children: "إعداد متقدم" }),
                  jsx("p", { className: "text-sm leading-6 text-[var(--va-text-muted,#9aa0a6)]", children: "اختر التخزين (محلي/SQL/PocketBase/Firebase)، نمط الحماية، الثيم، والمهمة الأولى — كل الخيارات بالتفصيل." }),
                  jsx("span", { className: "mt-2 text-sm font-semibold text-[var(--va-text,#fff)] group-hover:underline", children: "افتح المعالج →" })
                ]
              })
            ]
          }),
          jsx("p", { className: "text-center text-xs text-[var(--va-text-muted,#9aa0a6)]", children: "يمكنك تغيير الإعدادات لاحقاً من الإعدادات أو إعادة تشغيل جولة الميزات من صفحة المساعدة." })
        ]
      })
    ]
  });
}

export default BootChoiceScreen;

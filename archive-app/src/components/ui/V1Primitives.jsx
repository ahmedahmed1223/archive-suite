import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import * as React from "react";
import { AnimatedNumber } from "./AnimatedNumber.jsx";

export function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

export function SaveIndicator({ state = "idle", message, onRetry, className = "" }) {
  const prefersReducedMotion = useReducedMotion();
  let content = null;
  if (state === "saving") {
    content = (
      <span key="saving" className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-300">
        <Loader2 className={cx("h-3.5 w-3.5", prefersReducedMotion ? "" : "animate-spin")} aria-hidden="true" />
        <span>{message || "يحفظ..."}</span>
      </span>
    );
  } else if (state === "saved") {
    content = (
      <span key="saved" className="inline-flex items-center gap-1.5 text-xs font-medium va-accent-text">
        <Check className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{message || "تم الحفظ"}</span>
      </span>
    );
  } else if (state === "error") {
    content = (
      <span key="error" className="inline-flex items-center gap-2 text-xs font-medium text-red-300">
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{message || "فشل الحفظ"}</span>
        {typeof onRetry === "function" && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md border border-red-400/30 bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-100 hover:bg-red-500/20"
          >
            إعادة
          </button>
        )}
      </span>
    );
  }
  return (
    <span
      className={cx("inline-flex min-h-[1.5rem] items-center", className)}
      role={state === "error" ? "alert" : "status"}
      aria-live={state === "error" ? "assertive" : "polite"}
    >
      <AnimatePresence initial={false} mode="popLayout">
        {content && (
          <motion.span
            key={state}
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: prefersReducedMotion ? 0 : -4 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.18 }}
          >
            {content}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

export const pageMotion = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] }
};

export const staggerContainer = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.045,
      delayChildren: 0.02
    }
  }
};

export const staggerItem = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] }
};

const toneClasses = {
  accent: "va-tone-accent",
  emerald: "va-accent-border va-accent-bg-soft va-accent-text-on-soft",
  cyan: "border-cyan-500/20 bg-cyan-500/10 text-cyan-200",
  amber: "border-amber-500/20 bg-amber-500/10 text-amber-200",
  rose: "border-rose-500/20 bg-rose-500/10 text-rose-200",
  violet: "border-violet-500/20 bg-violet-500/10 text-violet-200",
  slate: "border-white/10 bg-white/5 text-gray-300"
};

function renderWorkflowIcon(icon) {
  if (!icon) return null;
  if (React.isValidElement(icon)) return icon;
  if (typeof icon === "string") return <span aria-hidden="true">{icon}</span>;
  return React.createElement(icon, { className: "h-4 w-4 shrink-0" });
}

export function StatusBadge({ tone = "slate", children, className = "" }) {
  return (
    <span className={cx("badge badge-sm badge-soft va-status-badge inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", toneClasses[tone] || toneClasses.slate, className)}>
      {children}
    </span>
  );
}

export function PageShell({ children, className = "", as: Component = "div", ...props }) {
  return (
    <Component className={cx("va-page-shell", className)} dir="rtl" {...props}>
      {children}
    </Component>
  );
}

export function MotionPage({ children, className = "", ...props }) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      className={cx("va-page-shell va-motion-page", className)}
      dir="rtl"
      initial={reducedMotion ? false : pageMotion.initial}
      animate={pageMotion.animate}
      exit={reducedMotion ? undefined : pageMotion.exit}
      transition={reducedMotion ? { duration: 0 } : pageMotion.transition}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function PageHero({ icon, title, description, actions, children, className = "", compact = false }) {
  return (
    <section className={cx("va-page-hero rounded-2xl border border-white/10 bg-gradient-to-l from-gray-900 via-gray-900/95 to-gray-950 text-right shadow-2xl shadow-black/10", compact ? "va-page-hero-compact p-3" : "p-5", className)} dir="rtl">
      <div className={cx("flex flex-wrap justify-between", compact ? "items-center gap-3" : "items-start gap-4")}>
        <div className="min-w-0">
          <h2 className={cx("va-title flex items-center gap-2 font-bold text-white", compact ? "text-lg" : "text-2xl")}>
            {icon}
            {title}
          </h2>
          {description && <p className={cx("max-w-3xl leading-relaxed text-gray-400", compact ? "mt-1 text-xs" : "mt-2 text-sm")}>{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export function Stepper({ steps, activeStepId, className = "" }) {
  const activeIndex = Math.max(0, steps.findIndex((step) => step.id === activeStepId));
  return (
    <ol className={cx("va-stepper-rtl grid gap-2 rounded-2xl border border-white/10 bg-white/[0.035] p-2 text-right", className)} dir="rtl">
      {steps.map((step, index) => (
        <li
          key={step.id}
          className={cx(
            "rounded-xl border px-3 py-2",
            index === activeIndex
              ? "va-accent-border va-accent-bg-soft text-white"
              : index < activeIndex
                ? "va-accent-border va-accent-bg-soft text-gray-200"
                : "border-white/5 bg-white/[0.02] text-gray-500"
          )}
        >
          <span className="va-number-badge text-xs">{String(index + 1).padStart(2, "0")}</span>
          <p className="mt-1 text-sm font-semibold">{step.label}</p>
          {step.detail && <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-gray-500">{step.detail}</p>}
        </li>
      ))}
    </ol>
  );
}

export function WorkflowStepper({
  steps,
  activeStepId,
  completedStepIds = [],
  onStepClick,
  className = "",
  compact = false
}) {
  const reducedMotion = useReducedMotion();
  const activeIndex = Math.max(0, steps.findIndex((step) => step.id === activeStepId));

  return (
    <motion.ol
      className={cx("va-workflow-stepper va-stepper-rtl grid gap-3 text-right", compact ? "va-workflow-stepper-compact" : "", className)}
      dir="rtl"
      variants={reducedMotion ? undefined : staggerContainer}
      initial={reducedMotion ? false : "initial"}
      animate="animate"
    >
      {steps.map((step, index) => {
        const active = step.id === activeStepId;
        const done = completedStepIds.includes(step.id) || step.status === "done" || index < activeIndex;
        const warning = step.status === "warning";
        const error = step.status === "error";
        const clickable = typeof onStepClick === "function";
        const stepIcon = renderWorkflowIcon(step.icon);
        const content = (
          <>
            <span className="va-workflow-step-index" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 font-semibold">
                {stepIcon}
                <span>{step.label}</span>
              </span>
              {(step.detail || step.description) && (
                <span className="mt-1 block text-xs leading-5 text-gray-500">{step.detail || step.description}</span>
              )}
            </span>
          </>
        );

        return (
          <motion.li
            key={step.id}
            variants={reducedMotion ? undefined : staggerItem}
            className={cx(
              "va-workflow-step rounded-2xl border",
              active ? "va-workflow-step-active" : "",
              done ? "va-workflow-step-done" : "",
              warning ? "va-workflow-step-warning" : "",
              error ? "va-workflow-step-error" : ""
            )}
            aria-current={active ? "step" : undefined}
          >
            {clickable ? (
              <button type="button" onClick={() => onStepClick(step.id)} className="flex w-full items-start gap-3 rounded-2xl p-3 text-right">
                {content}
              </button>
            ) : (
              <div className="flex items-start gap-3 rounded-2xl p-3">{content}</div>
            )}
          </motion.li>
        );
      })}
    </motion.ol>
  );
}

export function MetricCard({ label, value, hint, icon, tone = "accent", className = "" }) {
  return (
    <section className={cx("card card-border va-metric-card rounded-xl border p-4 text-right", className)} dir="rtl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-gray-400">{label}</p>
          <p className="mt-2 text-3xl font-bold text-white">{value}</p>
          {hint && <p className="mt-2 text-xs leading-relaxed text-gray-500">{hint}</p>}
        </div>
        {icon && (
          <span className={cx("va-icon-tile flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border", toneClasses[tone] || toneClasses.accent)}>
            {icon}
          </span>
        )}
      </div>
    </section>
  );
}

export function ActionCard({ label, detail, icon, onClick, tone = "accent", className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx("card card-border va-action-card group flex min-h-[92px] w-full items-center gap-3 rounded-xl border border-white/10 bg-gray-800/30 p-4 text-right transition-colors hover:border-emerald-500/25 hover:bg-white/5", className)}
    >
      {icon && (
        <span className={cx("va-icon-tile flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border", toneClasses[tone] || toneClasses.accent)}>
          {icon}
        </span>
      )}
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-white group-hover:text-emerald-100">{label}</span>
        {detail && <span className="mt-1 block text-xs leading-relaxed text-gray-500">{detail}</span>}
      </span>
    </button>
  );
}

export function FormSection({ title, description, icon, actions, children, className = "" }) {
  return (
    <section className={cx("card card-border va-card rounded-2xl border border-white/10 bg-gray-900/50 p-5 text-right backdrop-blur-sm", className)} dir="rtl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-base font-bold text-white">
            {icon}
            {title}
          </h3>
          {description && <p className="mt-1 text-sm leading-relaxed text-gray-500">{description}</p>}
        </div>
        {actions}
      </div>
      {children && <div className="mt-4 space-y-3">{children}</div>}
    </section>
  );
}

export function SectionToolbar({ title, description, icon, actions, children, className = "" }) {
  return (
    <header className={cx("va-section-toolbar flex flex-wrap items-start justify-between gap-3 rounded-2xl border p-4 text-right", className)} dir="rtl">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-base font-bold text-white">
          {icon}
          {title}
        </h2>
        {description && <p className="mt-1 text-sm leading-6 text-gray-500">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function CommandPanel({ title, description, icon, actions, children, highlight = false, className = "" }) {
  return (
    <section
      className={cx(
        "card card-border va-command-panel rounded-2xl border p-4 text-right",
        highlight ? "va-command-panel-highlight" : "",
        className
      )}
      dir="rtl"
    >
      {(title || description || icon || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {title && (
              <h2 className="flex items-center gap-2 text-base font-bold text-white">
                {icon}
                {title}
              </h2>
            )}
            {description && <p className="mt-1 text-sm leading-6 text-gray-500">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      {children && <div className={(title || description || icon || actions) ? "mt-4" : ""}>{children}</div>}
    </section>
  );
}

export function ReportStrip({ items = [], className = "" }) {
  // DaisyUI `stats` — semantic stat display replacing custom grid (§1881 Phase 2)
  return (
    <section
      className={cx("stats stats-vertical sm:stats-horizontal w-full overflow-visible rounded-2xl border border-white/10 bg-white/[0.02] text-right shadow-none", className)}
      dir="rtl"
      aria-label="ملخص التقارير"
    >
      {items.map((item) => (
        <div key={item.id || item.label} className="stat px-4 py-3">
          {item.icon && (
            <div className={cx("stat-figure va-icon-tile flex h-9 w-9 items-center justify-center rounded-xl border", toneClasses[item.tone] || toneClasses.accent)}>
              {item.icon}
            </div>
          )}
          <div className="stat-title text-xs text-gray-500">{item.label}</div>
          <div className="stat-value mt-1 text-2xl font-bold text-white">
            {Number.isFinite(item.animateTo)
              ? <AnimatedNumber value={item.animateTo} format={item.format} />
              : item.value}
          </div>
          {item.hint && <div className="stat-desc mt-1 text-xs leading-5 text-gray-500">{item.hint}</div>}
        </div>
      ))}
    </section>
  );
}

export function QuickActionGrid({ actions = [], className = "" }) {
  return (
    <div className={cx("grid gap-2 sm:grid-cols-2", className)} dir="rtl">
      {actions.map((action) => (
        <button
          key={action.id || action.label}
          type="button"
          onClick={action.onClick}
          disabled={action.disabled}
          className="card card-border va-action-card group flex min-h-[4.8rem] w-full items-center gap-3 rounded-xl border border-white/10 bg-gray-800/30 p-3 text-right transition-colors hover:border-emerald-500/25 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {action.icon && (
            <span className={cx("va-icon-tile flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border", toneClasses[action.tone] || toneClasses.accent)}>
              {action.icon}
            </span>
          )}
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-white group-hover:text-emerald-100">{action.label}</span>
            {action.detail && <span className="mt-1 block text-xs leading-5 text-gray-500">{action.detail}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}

export function ResultPreview({ title, meta, icon, actions, children, onClick, className = "" }) {
  const Wrapper = onClick ? "button" : "article";
  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cx("card card-border va-result-preview block w-full rounded-xl border p-3 text-right transition-colors hover:border-emerald-500/25", className)}
      dir="rtl"
    >
      <span className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 items-start gap-3">
          {icon && <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] text-gray-300">{icon}</span>}
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-white">{title}</span>
            {meta && <span className="mt-1 block truncate text-xs text-gray-500">{meta}</span>}
          </span>
        </span>
        {actions && <span className="flex shrink-0 flex-wrap gap-2">{actions}</span>}
      </span>
      {children && <span className="mt-3 block">{children}</span>}
    </Wrapper>
  );
}

export function RiskActionPanel({ title, description, icon, actions, children, className = "" }) {
  return (
    <section className={cx("alert alert-warning alert-soft va-risk-action-panel rounded-2xl border p-4 text-right", className)} dir="rtl">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {icon && <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-200">{icon}</span>}
          <div className="min-w-0">
            <h2 className="text-base font-bold text-white">{title}</h2>
            {description && <p className="mt-1 text-sm leading-6 text-gray-400">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </section>
  );
}

export function SkeletonBlock({ className = "" }) {
  return <div className={cx("skeleton va-skeleton rounded-xl", className)} aria-hidden="true" />;
}

export function UXStateBlock({
  state = "empty",
  icon,
  title,
  description,
  actionLabel,
  onAction,
  retryLabel = "إعادة المحاولة",
  onRetry,
  children,
  className = ""
}) {
  if (state === "loading") {
    return (
      <section className={cx("card card-border rounded-2xl border border-white/10 bg-gray-900/30 p-4", className)} role="status" aria-live="polite" dir="rtl">
        <div className="space-y-3">
          <SkeletonBlock className="h-5 w-40" />
          <SkeletonBlock className="h-20 w-full" />
          <SkeletonBlock className="h-10 w-2/3" />
        </div>
      </section>
    );
  }

  if (state === "error") {
    return (
      <section className={cx("alert alert-error alert-soft rounded-2xl border border-red-500/25 bg-red-500/10 p-5 text-right", className)} role="alert" aria-live="assertive" dir="rtl">
        <h3 className="text-base font-bold text-red-100">{title || "تعذر تحميل البيانات"}</h3>
        {description && <p className="mt-2 text-sm leading-7 text-red-100/80">{description}</p>}
        {onRetry && (
          <button type="button" onClick={onRetry} className="btn btn-sm btn-error btn-soft mt-4 rounded-xl border border-red-500/30 bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-50 hover:bg-red-500/20">
            {retryLabel}
          </button>
        )}
      </section>
    );
  }

  if (state === "success") {
    return (
      <section className={cx("alert alert-success alert-soft rounded-2xl border va-accent-border va-accent-bg-soft p-4 text-right", className)} role="status" aria-live="polite" dir="rtl">
        <h3 className="text-sm font-bold va-accent-text-on-soft">{title || "تمت العملية"}</h3>
        {description && <p className="mt-1 text-xs leading-6 va-accent-text-on-soft">{description}</p>}
        {children}
      </section>
    );
  }

  return <UXEmptyState icon={icon} title={title} description={description} actions={actionLabel && onAction ? <button type="button" onClick={onAction} className="btn btn-primary">{actionLabel}</button> : null} className={className} />;
}

export function FloatingActionBar({ children, className = "", label = "إجراءات سريعة" }) {
  return (
    <div className={cx("va-floating-action-bar", className)} dir="rtl" aria-label={label}>
      {children}
    </div>
  );
}

export function InsightPanel({ icon, title, description, actions, children, tone = "accent", className = "" }) {
  return (
    <section className={cx("card card-border va-insight-panel rounded-2xl border p-4 text-right", `va-insight-panel-${tone}`, className)} dir="rtl">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {icon && <span className={cx("va-icon-tile flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border", toneClasses[tone] || toneClasses.accent)}>{icon}</span>}
          <div className="min-w-0">
            {title && <h3 className="text-base font-bold text-white">{title}</h3>}
            {description && <p className="mt-1 text-sm leading-7 text-gray-400">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </section>
  );
}

export function UXEmptyState({ icon, title, description, actions, className = "" }) {
  return (
    <section className={cx("card card-border va-ux-empty-state rounded-2xl border border-dashed p-8 text-center", className)} dir="rtl">
      {icon && <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-gray-400">{icon}</div>}
      {title && <h3 className="mt-4 text-lg font-bold text-white">{title}</h3>}
      {description && <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-gray-500">{description}</p>}
      {actions && <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div>}
    </section>
  );
}

export function ResponsiveTabs({ tabs, activeTab, onChange, ariaLabel = "تبويبات", className = "" }) {
  return (
    <nav className={cx("va-tab-surface rounded-2xl border border-white/10 bg-gray-900/50 p-2", className)} dir="rtl" aria-label={ariaLabel}>
      {tabs.map((tab) => {
        const selected = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cx("relative mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right text-sm transition-colors", selected ? "va-accent-text-on-soft" : "text-gray-400 hover:bg-white/5 hover:text-white")}
            aria-current={selected ? "page" : undefined}
          >
            {selected && <motion.span layoutId={`${ariaLabel}-active-tab`} className="absolute inset-0 rounded-xl border va-accent-border va-accent-bg-soft" />}
            {Icon && <Icon className="relative h-4 w-4" />}
            <span className="relative">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function EntityCard({ title, description, icon, meta, actions, selected = false, onClick, children, className = "" }) {
  const Wrapper = onClick ? "button" : "article";
  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cx(
        "card card-border va-entity-card va-card-subtle block w-full rounded-2xl border p-4 text-right transition-colors",
        selected ? "va-accent-border va-accent-bg-soft" : "border-white/10 bg-gray-950/30 hover:border-emerald-500/25 hover:bg-white/[0.04]",
        className
      )}
      dir="rtl"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-base font-bold text-white">
            {icon}
            <span className="truncate">{title}</span>
          </h3>
          {description && <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-gray-500">{description}</p>}
          {meta && <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-400">{meta}</div>}
        </div>
        {actions}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </Wrapper>
  );
}

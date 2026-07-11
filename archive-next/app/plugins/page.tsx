"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import MetricStrip from "@/components/MetricStrip";
import PageToolbar from "@/components/PageToolbar";
import {
  createArchiveApiClient,
  type PluginCatalogItem,
  type PluginCategory,
  type PluginPermissionRisk,
  type PluginPermissionScopeSummary,
  type PluginRuntimePolicy,
  type PluginStatus
} from "@/lib/archive-api";

const statusOptions: Array<{ value: PluginStatus | ""; label: string }> = [
  { value: "", label: "كل الحالات" },
  { value: "reviewed", label: "مراجعة ومقبولة" },
  { value: "draft", label: "مسودة" },
  { value: "blocked", label: "محظورة" }
];

const categoryOptions: Array<{ value: PluginCategory | ""; label: string }> = [
  { value: "", label: "كل الفئات" },
  { value: "metadata", label: "بيانات وصفية" },
  { value: "workflow", label: "سير عمل" },
  { value: "ai", label: "ذكاء اصطناعي" },
  { value: "integration", label: "تكامل" }
];

const statusLabels: Record<string, string> = {
  reviewed: "مراجعة ومقبولة",
  draft: "مسودة",
  blocked: "محظورة"
};

const categoryLabels: Record<string, string> = {
  metadata: "بيانات وصفية",
  workflow: "سير عمل",
  ai: "ذكاء اصطناعي",
  integration: "تكامل"
};

const riskLabels: Record<string, string> = {
  low: "منخفض",
  medium: "متوسط",
  high: "عالٍ"
};

function riskLabel(risk: PluginPermissionRisk) {
  return riskLabels[String(risk)] ?? String(risk);
}

function riskTone(risk: PluginPermissionRisk) {
  if (risk === "high") return "danger";
  if (risk === "medium") return "warning";
  return "success";
}

function booleanLabel(value: boolean) {
  return value ? "نعم" : "لا";
}

function PolicyCard({ policy }: Readonly<{ policy: PluginRuntimePolicy | null }>) {
  if (!policy) {
    return (
      <section className="panel stack">
        <h2>سياسة التشغيل</h2>
        <p className="helper-text">لم تُحمّل سياسة التشغيل بعد.</p>
      </section>
    );
  }

  return (
    <section className="panel stack" aria-label="سياسة تشغيل الإضافات">
      <div className="panel-title-row">
        <div>
          <h2>سياسة التشغيل</h2>
          <p>{policy.description}</p>
        </div>
        <span className="badge">{policy.mode}</span>
      </div>
      <div className="record-grid">
        <article className="mini-card">
          <strong>التثبيت البعيد</strong>
          <span>{booleanLabel(policy.allowsRemoteInstall)}</span>
        </article>
        <article className="mini-card">
          <strong>تنفيذ كود</strong>
          <span>{booleanLabel(policy.allowsCodeExecution)}</span>
        </article>
        <article className="mini-card">
          <strong>مراجعة مسؤول</strong>
          <span>{booleanLabel(policy.requiresAdminReview)}</span>
        </article>
      </div>
    </section>
  );
}

function PermissionScopes({ scopes }: Readonly<{ scopes: PluginPermissionScopeSummary[] }>) {
  return (
    <section className="panel stack" aria-label="ملخص الصلاحيات">
      <div className="panel-title-row">
        <div>
          <h2>الصلاحيات المطلوبة</h2>
          <p>تجميع scopes التي تطلبها الإضافات حتى تظهر المخاطر قبل أي اعتماد.</p>
        </div>
      </div>
      {scopes.length ? (
        <div className="record-grid">
          {scopes.map((scope) => (
            <article className="mini-card" key={scope.scope}>
              <strong dir="ltr">{scope.scope}</strong>
              <span className="tag-list">
                <span className="badge" data-tone={riskTone(scope.risk)}>
                  {riskLabel(scope.risk)}
                </span>
                <span className="badge">{scope.pluginCount} إضافات</span>
              </span>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="لا توجد صلاحيات" description="غيّر الفلاتر لعرض صلاحيات إضافات أخرى." />
      )}
    </section>
  );
}

function PluginCard({ plugin }: Readonly<{ plugin: PluginCatalogItem }>) {
  const flags = [
    ["شبكة", plugin.securityReview.networkAccess],
    ["نظام ملفات", plugin.securityReview.fileSystemAccess],
    ["تنفيذ كود", plugin.securityReview.executesCode],
    ["خروج بيانات", plugin.securityReview.dataLeavesTenant],
    ["موافقة مسؤول", plugin.securityReview.adminApprovalRequired]
  ] as const;

  return (
    <article className="panel stack">
      <div className="panel-title-row">
        <div>
          <h2>{plugin.name}</h2>
          <p>{plugin.summary}</p>
        </div>
        <span className="badge">{statusLabels[plugin.status] ?? plugin.status}</span>
      </div>
      <div className="tag-list">
        <span className="badge">{plugin.vendor}</span>
        <span className="badge">{plugin.version}</span>
        <span className="badge">{categoryLabels[plugin.category] ?? plugin.category}</span>
        <span className="badge">{plugin.trustLevel}</span>
      </div>
      <div className="record-grid">
        {flags.map(([label, value]) => (
          <div className="mini-card" key={label}>
            <strong>{label}</strong>
            <span>{booleanLabel(value)}</span>
          </div>
        ))}
      </div>
      <div className="stack">
        <h3>تفاصيل الصلاحيات</h3>
        {plugin.permissions.length ? (
          <div className="record-grid">
            {plugin.permissions.map((permission) => (
              <div className="mini-card" key={`${plugin.id}-${permission.scope}`}>
                <strong dir="ltr">{permission.scope}</strong>
                <span className="badge" data-tone={riskTone(permission.risk)}>
                  {riskLabel(permission.risk)}
                </span>
                <p className="helper-text">{permission.reason}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="helper-text">لا توجد صلاحيات موثقة لهذه الإضافة.</p>
        )}
      </div>
    </article>
  );
}

export default function PluginsPage() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [status, setStatus] = useState<PluginStatus | "">("");
  const [category, setCategory] = useState<PluginCategory | "">("");
  const [policy, setPolicy] = useState<PluginRuntimePolicy | null>(null);
  const [plugins, setPlugins] = useState<PluginCatalogItem[]>([]);
  const [permissionScopes, setPermissionScopes] = useState<PluginPermissionScopeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadPlugins() {
      setLoading(true);
      setError(null);
      const response = await api.plugins({ status, category });
      if (!active) return;

      if (response.ok) {
        setPolicy(response.runtimePolicy);
        setPlugins(response.plugins);
        setPermissionScopes(response.permissionScopes);
      } else {
        setError(response.error);
      }

      setLoading(false);
    }

    void loadPlugins();

    return () => {
      active = false;
    };
  }, [api, category, status]);

  const reviewedCount = plugins.filter((plugin) => plugin.status === "reviewed").length;
  const blockedCount = plugins.filter((plugin) => plugin.status === "blocked").length;
  const highRiskCount = permissionScopes.filter((scope) => scope.risk === "high").length;

  return (
    <AppShell subtitle="الإضافات" navLabel="الإضافات" contentClassName="stack">
      <PageToolbar
        eyebrow={<span className="badge">كتالوج آمن</span>}
        title="سوق الإضافات ومراجعة الصلاحيات"
        description="استعراض إضافات مراجعة فقط مع سياسة تمنع التثبيت البعيد وتنفيذ الكود داخل هذا التشغيل المحلي."
        meta={
          <>
            <span className="badge">Catalog only</span>
            <span className="badge">لا تنفيذ كود</span>
            <span className="badge">مراجعة مسؤول</span>
          </>
        }
      />

      <MetricStrip
        items={[
          { label: "الإضافات المعروضة", value: plugins.length },
          { label: "مراجعة ومقبولة", value: reviewedCount },
          { label: "محظورة", value: blockedCount },
          { label: "Scopes عالية المخاطر", value: highRiskCount }
        ]}
      />

      {error ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>تعذر تحميل كتالوج الإضافات</strong>
          <p className="helper-text">{error}</p>
        </div>
      ) : null}

      <section className="panel form-grid" aria-label="فلاتر الإضافات">
        <label>
          الحالة
          <select value={status} onChange={(event) => setStatus(event.target.value as PluginStatus | "")}>
            {statusOptions.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          الفئة
          <select value={category} onChange={(event) => setCategory(event.target.value as PluginCategory | "")}>
            {categoryOptions.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <PolicyCard policy={policy} />
      <PermissionScopes scopes={permissionScopes} />

      <section className="stack" aria-label="قائمة الإضافات">
        {loading ? (
          <EmptyState title="جار تحميل الإضافات" description="نقرأ الكتالوج المحلي وسياسة التشغيل." />
        ) : plugins.length ? (
          plugins.map((plugin) => <PluginCard key={plugin.id} plugin={plugin} />)
        ) : (
          <EmptyState title="لا توجد إضافات مطابقة" description="جرّب إزالة فلتر الحالة أو الفئة." />
        )}
      </section>
    </AppShell>
  );
}

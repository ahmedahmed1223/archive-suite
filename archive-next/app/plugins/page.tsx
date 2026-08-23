"use client";

import { useEffect, useMemo, useState } from "react";
import type { plugins as pluginsDictionary } from "@/lib/i18n/dictionaries/ar/pages/plugins";
import AppShell from "@/components/AppShell";
import { useLocale } from "@/lib/i18n/LocaleProvider";
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
import { redactAdminSecrets } from "@/lib/admin-action-summary";
import type { DictionaryShape } from "@/lib/i18n/types";
import { Skeleton } from "@/components/ui/Skeleton";

type PluginsCopy = DictionaryShape<typeof pluginsDictionary>;

function labelFor(labels: object, value: string): string {
  const label = (labels as Record<string, unknown>)[value];
  return typeof label === "string" ? label : value;
}

function riskLabel(risk: PluginPermissionRisk, copy: PluginsCopy) {
  return labelFor(copy.risk, String(risk));
}

function riskTone(risk: PluginPermissionRisk) {
  if (risk === "high") return "danger";
  if (risk === "medium") return "warning";
  return "success";
}

function booleanLabel(value: boolean, copy: PluginsCopy) {
  return value ? copy.boolean.yes : copy.boolean.no;
}

function PolicyCard({ policy, copy }: Readonly<{ policy: PluginRuntimePolicy | null; copy: PluginsCopy }>) {
  if (!policy) {
    return (
      <section className="panel stack">
        <h2>{copy.policy.unavailableTitle}</h2>
        <p className="helper-text">{copy.policy.unavailableDescription}</p>
      </section>
    );
  }

  return (
    <section className="panel stack" aria-label={copy.policy.ariaLabel}>
      <div className="panel-title-row">
        <div>
          <h2>{copy.policy.title}</h2>
          <p>{policy.description}</p>
        </div>
        <span className="badge">{policy.mode}</span>
      </div>
      <div className="record-grid">
        <article className="mini-card">
          <strong>{copy.policy.remoteInstall}</strong>
          <span>{booleanLabel(policy.allowsRemoteInstall, copy)}</span>
        </article>
        <article className="mini-card">
          <strong>{copy.policy.codeExecution}</strong>
          <span>{booleanLabel(policy.allowsCodeExecution, copy)}</span>
        </article>
        <article className="mini-card">
          <strong>{copy.policy.adminReview}</strong>
          <span>{booleanLabel(policy.requiresAdminReview, copy)}</span>
        </article>
      </div>
    </section>
  );
}

function PermissionScopes({ scopes, copy }: Readonly<{ scopes: PluginPermissionScopeSummary[]; copy: PluginsCopy }>) {
  return (
    <section className="panel stack" aria-label={copy.permissions.ariaLabel}>
      <div className="panel-title-row">
        <div>
          <h2>{copy.permissions.title}</h2>
          <p>{copy.permissions.description}</p>
        </div>
      </div>
      {scopes.length ? (
        <div className="record-grid">
          {scopes.map((scope) => (
            <article className="mini-card" data-testid="plugin-permission-scope" key={scope.scope}>
              <strong dir="ltr">{scope.scope}</strong>
              <span className="tag-list">
                <span className="badge" data-tone={riskTone(scope.risk)}>
                  {riskLabel(scope.risk, copy)}
                </span>
                <span className="badge">{copy.permissions.pluginCount.replace("{count}", String(scope.pluginCount))}</span>
              </span>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title={copy.permissions.emptyTitle} description={copy.permissions.emptyDescription} />
      )}
    </section>
  );
}

function PluginCard({ plugin, copy }: Readonly<{ plugin: PluginCatalogItem; copy: PluginsCopy }>) {
  const flags = [
    [copy.card.network, plugin.securityReview.networkAccess],
    [copy.card.fileSystem, plugin.securityReview.fileSystemAccess],
    [copy.card.codeExecution, plugin.securityReview.executesCode],
    [copy.card.dataLeavesTenant, plugin.securityReview.dataLeavesTenant],
    [copy.card.adminApproval, plugin.securityReview.adminApprovalRequired]
  ] as const;

  return (
    <article className="panel stack">
      <div className="panel-title-row">
        <div>
          <h2>{plugin.name}</h2>
          <p>{plugin.summary}</p>
        </div>
        <span className="badge">{labelFor(copy.filters.status, plugin.status)}</span>
      </div>
      <div className="tag-list">
        <span className="badge">{plugin.vendor}</span>
        <span className="badge">{plugin.version}</span>
        <span className="badge">{labelFor(copy.filters.category, plugin.category)}</span>
        <span className="badge">{plugin.trustLevel}</span>
      </div>
      <div className="record-grid">
        {flags.map(([label, value]) => (
          <div className="mini-card" key={label}>
            <strong>{label}</strong>
            <span>{booleanLabel(value, copy)}</span>
          </div>
        ))}
      </div>
      <div className="stack">
        <h3>{copy.card.permissionDetails}</h3>
        {plugin.permissions.length ? (
          <div className="record-grid">
            {plugin.permissions.map((permission) => (
              <div className="mini-card" key={`${plugin.id}-${permission.scope}`}>
                <strong dir="ltr">{permission.scope}</strong>
                <span className="badge" data-tone={riskTone(permission.risk)}>
                  {riskLabel(permission.risk, copy)}
                </span>
                <p className="helper-text">{permission.reason}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="helper-text">{copy.card.noPermissions}</p>
        )}
      </div>
    </article>
  );
}

export default function PluginsPage() {
  const { t } = useLocale();
  const copy = t.pages.plugins;
  const statusOptions: Array<{ value: PluginStatus | ""; label: string }> = [
    { value: "", label: copy.filters.status.all },
    { value: "reviewed", label: copy.filters.status.reviewed },
    { value: "draft", label: copy.filters.status.draft },
    { value: "blocked", label: copy.filters.status.blocked }
  ];
  const categoryOptions: Array<{ value: PluginCategory | ""; label: string }> = [
    { value: "", label: copy.filters.category.all },
    { value: "metadata", label: copy.filters.category.metadata },
    { value: "workflow", label: copy.filters.category.workflow },
    { value: "ai", label: copy.filters.category.ai },
    { value: "integration", label: copy.filters.category.integration }
  ];
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
    <AppShell subtitle={t.pageTitles.plugins} navLabel={t.pageTitles.plugins} contentClassName="stack" tipsPage="plugins">
      <PageToolbar
        eyebrow={<span className="badge">{copy.toolbar.eyebrow}</span>}
        title={copy.toolbar.title}
        description={copy.toolbar.description}
        meta={
          <>
            <span className="badge">{copy.toolbar.readOnlyCatalog}</span>
            <span className="badge">{copy.toolbar.noCodeExecution}</span>
            <span className="badge">{copy.toolbar.adminReview}</span>
          </>
        }
      />

      <MetricStrip
        items={[
          { label: copy.metrics.displayed, value: plugins.length },
          { label: copy.metrics.reviewed, value: reviewedCount },
          { label: copy.metrics.blocked, value: blockedCount },
          { label: copy.metrics.highRiskScopes, value: highRiskCount }
        ]}
      />

      {error ? (
        <div className="state-banner state-banner-error" role="alert">
          <strong>{copy.error.title}</strong>
          <p className="helper-text">{copy.error.description.replace("{error}", redactAdminSecrets(error))}</p>
        </div>
      ) : null}

      <section className="panel form-grid" aria-label={copy.form.ariaLabel}>
        <label>
          {copy.form.status}
          <select value={status} onChange={(event) => setStatus(event.target.value as PluginStatus | "")}>
            {statusOptions.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          {copy.form.category}
          <select value={category} onChange={(event) => setCategory(event.target.value as PluginCategory | "")}>
            {categoryOptions.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <PolicyCard policy={policy} copy={copy} />
      <PermissionScopes scopes={permissionScopes} copy={copy} />

      <section className="stack" aria-label={copy.list.ariaLabel}>
        {loading ? (
          // V14-AUDIT-022: loading state must be announced to screen readers.
          <div role="status" aria-live="polite">
            <Skeleton label={copy.list.loadingTitle} />
          </div>
        ) : plugins.length ? (
          plugins.map((plugin) => <PluginCard key={plugin.id} plugin={plugin} copy={copy} />)
        ) : (
          <EmptyState title={copy.list.emptyTitle} description={copy.list.emptyDescription} />
        )}
      </section>
    </AppShell>
  );
}

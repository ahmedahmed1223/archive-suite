"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useCapability } from "@/components/RoleGate";
import {
  createArchiveApiClient,
  type DelegatedAccess,
  type MentionableUser
} from "@/lib/archive-api";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useDisplaySettings } from "@/lib/display-settings-context";
import { formatDateTime } from "@/lib/display-settings";

type Direction = "granted" | "received";

type ListState =
  | { status: "loading" }
  | { status: "ready"; delegations: DelegatedAccess[] }
  | { status: "error"; message: string };

type FormState = { status: "idle" } | { status: "saving" } | { status: "error"; message: string };

function statusLabel(status: DelegatedAccess["status"], labels: Record<DelegatedAccess["status"], string>): string {
  return labels[status];
}

function formatDate(value: string | null | undefined, settings: import("@/lib/display-settings").DisplaySettings, locale: import("@/lib/i18n/types").AppLocale) {
  if (!value) return "-";
  return formatDateTime(value, settings, locale, value);
}

export default function DelegationsPage() {
  const { locale, t } = useLocale();
  const { settings: displaySettings } = useDisplaySettings();
  const api = useMemo(() => createArchiveApiClient(), []);
  const dialogs = useConfirmDialog();
  const canManageDelegations = useCapability("delegations.manage");

  const [direction, setDirection] = useState<Direction>("granted");
  const [state, setState] = useState<ListState>({ status: "loading" });
  const [colleagues, setColleagues] = useState<MentionableUser[]>([]);

  const [granteeId, setGranteeId] = useState("");
  const [itemIds, setItemIds] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [formState, setFormState] = useState<FormState>({ status: "idle" });

  const load = useCallback(async (nextDirection: Direction) => {
    setState({ status: "loading" });
    try {
      const response = await api.delegatedAccessList(nextDirection);
      if (response.ok) {
        setState({ status: "ready", delegations: response.delegations });
      } else {
        setState({ status: "error", message: response.error || t.pages.delegations.loadErrorMessage });
      }
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : t.pages.delegations.loadErrorMessage });
    }
  }, [api, t]);

  useEffect(() => {
    void load(direction);
  }, [load, direction]);

  useEffect(() => {
    void api.mentionableUsers().then((response) => {
      if (response.ok) setColleagues(response.users);
    });
  }, [api]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedGranteeId = Number(granteeId);
    const parsedItemIds = itemIds.split(",").map((value) => value.trim()).filter(Boolean);

    if (!parsedGranteeId || parsedItemIds.length === 0 || !expiresAt) {
      setFormState({ status: "error", message: t.pages.delegations.requiredFieldsMessage });
      return;
    }

    setFormState({ status: "saving" });
    try {
      const response = await api.createDelegatedAccess({
        granteeId: parsedGranteeId,
        itemIds: parsedItemIds,
        expiresAt: new Date(expiresAt).toISOString()
      });
      if (response.ok) {
        setFormState({ status: "idle" });
        setGranteeId("");
        setItemIds("");
        setExpiresAt("");
        if (direction === "granted") await load("granted");
      } else {
        setFormState({ status: "error", message: response.error || t.pages.delegations.createErrorTitle });
      }
    } catch (error) {
      setFormState({ status: "error", message: error instanceof Error ? error.message : t.pages.delegations.createErrorTitle });
    }
  };

  const handleRevoke = async (delegation: DelegatedAccess) => {
    const confirmed = await dialogs.confirm({
      title: t.pages.delegations.revokeDialogTitle,
      message: t.pages.delegations.revokeDialogMessage.replace("{name}", String(delegation.grantee.name || delegation.grantee.id)),
      confirmLabel: t.pages.delegations.revokeConfirmLabel,
      destructive: true
    });
    if (!confirmed) return;
    await api.revokeDelegatedAccess(delegation.id);
    await load(direction);
  };

  const delegations = state.status === "ready" ? state.delegations : [];

  return (
    <AppShell subtitle={t.pageTitles.temporaryAccessDelegation} navLabel={t.pageTitles.delegations} contentClassName="observability-content">
      <PageToolbar
        eyebrow={<span className="badge">{t.pages.delegations.eyebrow}</span>}
        title={t.pages.delegations.title}
        description={t.pages.delegations.description}
        meta={
          <>
            <span className="badge">{delegations.length} {t.pages.delegations.countSuffix}</span>
          </>
        }
        actions={
          <div className="button-row">
            <button
              type="button"
              className={`button ${direction === "granted" ? "" : "button-secondary"} button-sm`}
              onClick={() => setDirection("granted")}
            >
              {t.pages.delegations.grantedByMe}
            </button>
            <button
              type="button"
              className={`button ${direction === "received" ? "" : "button-secondary"} button-sm`}
              onClick={() => setDirection("received")}
            >
              {t.pages.delegations.grantedToMe}
            </button>
          </div>
        }
      />

      {direction === "granted" ? (
        <section className="panel" aria-label={t.pages.delegations.grantFormAriaLabel}>
          <div className="panel-title-row">
            <div>
              <h2>{t.pages.delegations.grantFormTitle}</h2>
              <p>{t.pages.delegations.grantFormDescription}</p>
            </div>
          </div>
          {canManageDelegations ? (
            <form className="form-grid" onSubmit={handleCreate}>
              <label>
                {t.pages.delegations.colleagueLabel}
                <select value={granteeId} onChange={(event) => setGranteeId(event.target.value)} required>
                  <option value="">{t.pages.delegations.colleaguePlaceholder}</option>
                  {colleagues.map((user) => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))}
                </select>
              </label>
              <label>
                {t.pages.delegations.itemIdsLabel}
                <input
                  type="text"
                  value={itemIds}
                  onChange={(event) => setItemIds(event.target.value)}
                  placeholder={t.pages.delegations.itemIdsPlaceholder}
                  required
                />
              </label>
              <label>
                {t.pages.delegations.expiresAtLabel}
                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                  required
                />
              </label>
              {formState.status === "error" ? <p className="form-error">{formState.message}</p> : null}
              <button type="submit" className="button" disabled={formState.status === "saving"}>
                {formState.status === "saving" ? t.pages.delegations.granting : t.pages.delegations.grantAccess}
              </button>
            </form>
          ) : (
            <p className="helper-text">{t.pages.delegations.noPermission}</p>
          )}
        </section>
      ) : null}

      {state.status === "error" ? (
        <EmptyState title={t.pages.delegations.loadErrorTitle} description={state.message} />
      ) : delegations.length === 0 && state.status === "ready" ? (
        <EmptyState
          title={direction === "granted" ? t.pages.delegations.emptyGrantedTitle : t.pages.delegations.emptyReceivedTitle}
          description={t.pages.delegations.emptyDescription}
        />
      ) : (
        <section className="panel" aria-label={t.pages.delegations.listAriaLabel}>
          <div className="scroll-x desktop-table-wrap">
            <table className="data-table" role="grid" aria-label={t.pages.delegations.tableAriaLabel}>
              <thead>
                <tr>
                  <th>{direction === "granted" ? t.pages.delegations.colColleague : t.pages.delegations.colGrantedBy}</th>
                  <th>{t.pages.delegations.colItems}</th>
                  <th>{t.pages.delegations.colStatus}</th>
                  <th>{t.pages.delegations.colExpiry}</th>
                  {direction === "granted" ? <th className="data-table-sticky-end">{t.pages.delegations.colActions}</th> : null}
                </tr>
              </thead>
              <tbody>
                {delegations.map((delegation) => (
                  <tr key={delegation.id}>
                    <td>{direction === "granted" ? (delegation.grantee.name || delegation.grantee.id) : (delegation.grantor.name || delegation.grantor.id)}</td>
                    <td className="mono-text">{(delegation.scope.itemIds || []).join(", ")}</td>
                    <td><span className={`badge ${delegation.status === "active" ? "" : "badge-danger"}`}>{statusLabel(delegation.status, t.pages.delegations.status)}</span></td>
                    <td className="mono-text">{formatDate(delegation.expiresAt, displaySettings, locale)}</td>
                    {direction === "granted" ? (
                      <td className="data-table-sticky-end">
                        {delegation.status === "active" ? (
                          <button type="button" className="button button-danger button-sm" onClick={() => void handleRevoke(delegation)}>
                            {t.pages.delegations.revoke}
                          </button>
                        ) : (
                          <span className="helper-text">-</span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </AppShell>
  );
}

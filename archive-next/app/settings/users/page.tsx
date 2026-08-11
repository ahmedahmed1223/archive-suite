"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import AppShell from "@/components/AppShell";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { useDisplaySettings } from "@/lib/display-settings-context";
import { formatDate as formatDisplayDate } from "@/lib/display-settings";
import PageToolbar from "@/components/PageToolbar";
import DataTable from "@/components/ui/DataTable";
import { FieldError } from "@/components/ui/Form";
import { useCapability } from "@/components/RoleGate";
import { createArchiveApiClient, type ManagedUser, type ManagedUserRole, type PendingInvitation } from "@/lib/archive-api";
import { Skeleton } from "@/components/ui/Skeleton";

function formatLocalDate(value: string | undefined, settings: import("@/lib/display-settings").DisplaySettings, locale: import("@/lib/i18n/types").AppLocale) {
  if (!value) return "-";
  return formatDisplayDate(value, settings, locale, value);
}

type LoadState =
  | { status: "loading" }
  | { status: "ready"; users: ManagedUser[]; invitations: PendingInvitation[] }
  | { status: "error"; message: string };

type ActionState = { status: "idle" } | { status: "error"; message: string } | { status: "success"; message: string };

function createInviteSchema(strings: { emailRequired: string; emailInvalid: string }) {
  return z.object({
    email: z.string().trim().min(1, strings.emailRequired).email(strings.emailInvalid),
    role: z.enum(["admin", "editor", "viewer"])
  });
}

type InviteFormValues = z.input<ReturnType<typeof createInviteSchema>>;

export default function UsersSettingsPage() {
  const { locale, t } = useLocale();
  const { settings: displaySettings } = useDisplaySettings();
  const roleLabels: Record<ManagedUserRole, string> = t.pages.settingsUsers.roles;
  const inviteSchema = useMemo(
    () => createInviteSchema(t.pages.settingsUsers),
    [t]
  );
  const api = useMemo(() => createArchiveApiClient(), []);
  const canManageUsers = useCapability("users.manage");
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [actionState, setActionState] = useState<ActionState>({ status: "idle" });
  const inviteForm = useForm<InviteFormValues>({
    defaultValues: {
      email: "",
      role: "editor"
    }
  });
  const inviteErrors = inviteForm.formState.errors;

  const load = useCallback(async () => {
    setState({ status: "loading" });
    const response = await api.listUsers();
    if (!response.ok) {
      setState({ status: "error", message: response.error });
      return;
    }
    setState({ status: "ready", users: response.users, invitations: response.invitations });
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleInvite = inviteForm.handleSubmit(async (values) => {
    setActionState({ status: "idle" });
    inviteForm.clearErrors();
    const parsed = inviteSchema.safeParse(values);

    if (!parsed.success) {
      parsed.error.issues.forEach((issue) => {
        const field = issue.path[0];
        if (field && typeof field === "string") {
          inviteForm.setError(field as keyof InviteFormValues, { type: "zod", message: issue.message });
        }
      });
      setActionState({ status: "error", message: parsed.error.issues[0]?.message || t.pages.settingsUsers.reviewInviteError });
      return;
    }

    const response = await api.inviteUser({ email: parsed.data.email, role: parsed.data.role });
    if (!response.ok) {
      setActionState({ status: "error", message: response.error });
      return;
    }
    setActionState({ status: "success", message: t.pages.settingsUsers.inviteSentMessage.replace("{email}", response.invitation.email) });
    inviteForm.reset({ email: "", role: "editor" });
    void load();
  });

  const handleRoleChange = useCallback(
    async (user: ManagedUser, role: ManagedUserRole) => {
      const response = await api.updateUserRole(user.id, { role });
      if (!response.ok) {
        setActionState({ status: "error", message: response.error });
        return;
      }
      void load();
    },
    [api, load]
  );

  const handleDelete = useCallback(
    async (user: ManagedUser) => {
      const response = await api.deleteUser(user.id);
      if (!response.ok) {
        setActionState({ status: "error", message: response.error });
        return;
      }
      void load();
    },
    [api, load]
  );
  const userColumns = useMemo<Array<ColumnDef<ManagedUser, unknown>>>(
    () => [
      {
        accessorKey: "name",
        header: t.pages.settingsUsers.nameColumnHeader
      },
      {
        accessorKey: "email",
        header: t.pages.settingsUsers.emailColumnHeader,
        cell: ({ row }) => <span dir="ltr">{row.original.email}</span>
      },
      {
        accessorKey: "role",
        header: t.pages.settingsUsers.roleColumnHeader,
        cell: ({ row }) =>
          canManageUsers ? (
            <select aria-label={t.pages.settingsUsers.roleAriaLabel.replace("{email}", row.original.email)} value={row.original.role} onChange={(event) => void handleRoleChange(row.original, event.target.value as ManagedUserRole)}>
              {(Object.keys(roleLabels) as ManagedUserRole[]).map((role) => (
                <option key={role} value={role}>
                  {roleLabels[role]}
                </option>
              ))}
            </select>
          ) : (
            roleLabels[row.original.role]
          )
      },
      {
        id: "actions",
        header: t.pages.settingsUsers.actionsColumnHeader,
        cell: ({ row }) =>
          canManageUsers ? (
            <button type="button" className="button button-secondary" onClick={() => void handleDelete(row.original)}>
              {t.pages.settingsUsers.removeButton}
            </button>
          ) : null,
        enableSorting: false
      }
    ],
    [canManageUsers, handleDelete, handleRoleChange, roleLabels, t]
  );
  const invitationColumns = useMemo<Array<ColumnDef<PendingInvitation, unknown>>>(
    () => [
      {
        accessorKey: "email",
        header: t.pages.settingsUsers.emailColumnHeader,
        cell: ({ row }) => <span dir="ltr">{row.original.email}</span>
      },
      {
        accessorKey: "role",
        header: t.pages.settingsUsers.roleColumnHeader,
        cell: ({ row }) => roleLabels[row.original.role]
      },
      {
        accessorKey: "expiresAt",
        header: t.pages.settingsUsers.expiresAtLabel,
        cell: ({ row }) => formatLocalDate(row.original.expiresAt, displaySettings, locale)
      }
    ],
    [roleLabels, t, displaySettings, locale]
  );

  return (
    <AppShell subtitle={t.pageTitles.usersAndRoles} contentClassName="stack" tipsPage="settings-users">
      <PageToolbar
        title={t.pages.settingsUsers.pageTitle}
        description={t.pages.settingsUsers.pageDescription}
        meta={<span className="badge">{t.pages.settingsUsers.adminOnlyBadge}</span>}
      />
      <div className="state-banner state-banner-info" role="status">
        <strong>{t.pages.settingsUsers.onboardingBannerTitle}</strong>
        <p>{t.pages.settingsUsers.onboardingBannerBody}</p>
        <a className="button button-secondary button-small" href="/first-run">{t.pages.settingsUsers.onboardingBannerLink}</a>
      </div>

      <article className="panel">
        <div className="toolbar-row">
          <div>
            <h2>{t.pages.settingsUsers.inviteHeading}</h2>
            <p className="field-note">{t.pages.settingsUsers.inviteNote}</p>
          </div>
        </div>

        {canManageUsers ? (
          <form className="auth-form" onSubmit={handleInvite}>
            <label>
              {t.pages.settingsUsers.emailLabel}
              <input
                type="email"
                dir="ltr"
                {...inviteForm.register("email")}
              />
              <FieldError>{inviteErrors.email?.message}</FieldError>
            </label>

            <label>
              {t.pages.settingsUsers.roleLabel}
              <select {...inviteForm.register("role")}>
                {(Object.keys(roleLabels) as ManagedUserRole[]).map((role) => (
                  <option key={role} value={role}>
                    {roleLabels[role]}
                  </option>
                ))}
              </select>
              <FieldError>{inviteErrors.role?.message}</FieldError>
            </label>

            <button type="submit" className="button button-primary">
              {t.pages.settingsUsers.inviteSubmit}
            </button>

            <p className="form-status" role={actionState.status === "error" ? "alert" : "status"}>
              {actionState.status === "idle" ? "" : actionState.message}
            </p>
          </form>
        ) : (
          <p className="helper-text">{t.pages.settingsUsers.inviteRestrictedNote}</p>
        )}
      </article>

      <article className="panel">
        <h2>{t.pages.settingsUsers.membersHeading}</h2>

        {state.status === "loading" && <Skeleton label={t.pages.settingsUsers.loadingMembers} />}
        {state.status === "error" && <p className="helper-text status-error">{t.pages.settingsUsers.errorPrefix.replace("{message}", state.message)}</p>}

        {state.status === "ready" && (
          <>
            <div className="mobile-card-list" role="list" aria-label={t.pages.settingsUsers.membersCardListLabel}>
              {state.users.map((user) => (
                <article className="local-list-card" key={user.id} role="listitem">
                  <div className="local-list-card__main">
                    <div>
                      <span className="badge">{roleLabels[user.role]}</span>
                      <h3>{user.name}</h3>
                    </div>
                    <span className="badge">{formatLocalDate(user.createdAt, displaySettings, locale)}</span>
                  </div>
                  <dl className="mobile-field-list">
                    <div>
                      <dt>{t.pages.settingsUsers.emailColumnHeader}</dt>
                      <dd dir="ltr">{user.email}</dd>
                    </div>
                    <div>
                      <dt>{t.pages.settingsUsers.idLabel}</dt>
                      <dd dir="ltr">{user.id}</dd>
                    </div>
                  </dl>
                  {canManageUsers ? (
                    <>
                      <label className="toolbar-field">
                        {t.pages.settingsUsers.roleLabel}
                        <select aria-label={t.pages.settingsUsers.roleAriaLabel.replace("{email}", user.email)} value={user.role} onChange={(event) => void handleRoleChange(user, event.target.value as ManagedUserRole)}>
                          {(Object.keys(roleLabels) as ManagedUserRole[]).map((role) => (
                            <option key={role} value={role}>
                              {roleLabels[role]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button type="button" className="button button-danger button-sm" onClick={() => void handleDelete(user)}>
                        {t.pages.settingsUsers.removeButton}
                      </button>
                    </>
                  ) : (
                    <span className="badge">{roleLabels[user.role]}</span>
                  )}
                </article>
              ))}
            </div>

            <div className="desktop-table-wrap">
              <DataTable
                ariaLabel={t.pages.settingsUsers.membersTableAriaLabel}
                columns={userColumns}
                data={state.users}
                emptyMessage={t.pages.settingsUsers.noMembers}
                getRowId={(user) => user.id}
              />
            </div>
          </>
        )}
      </article>

      {state.status === "ready" && state.invitations.length > 0 && (
        <article className="panel">
          <h2>{t.pages.settingsUsers.pendingInvitationsHeading}</h2>
          <div className="mobile-card-list" role="list" aria-label={t.pages.settingsUsers.pendingInvitationsCardListLabel}>
            {state.invitations.map((invitation) => (
              <article className="local-list-card" key={invitation.id} role="listitem">
                <div className="local-list-card__main">
                  <div>
                    <span className="badge">{t.pages.settingsUsers.pendingBadge}</span>
                    <h3 dir="ltr">{invitation.email}</h3>
                  </div>
                  <span className="badge">{roleLabels[invitation.role]}</span>
                </div>
                <dl className="mobile-field-list">
                  <div>
                    <dt>{t.pages.settingsUsers.expiresAtLabel}</dt>
                    <dd>{formatLocalDate(invitation.expiresAt, displaySettings, locale)}</dd>
                  </div>
                  <div>
                    <dt>{t.pages.settingsUsers.createdAtLabel}</dt>
                    <dd>{formatLocalDate(invitation.createdAt, displaySettings, locale)}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
          <div className="desktop-table-wrap">
            <DataTable
              ariaLabel={t.pages.settingsUsers.invitationsTableAriaLabel}
              columns={invitationColumns}
              data={state.invitations}
              emptyMessage={t.pages.settingsUsers.noInvitations}
              getRowId={(invitation) => invitation.id}
            />
          </div>
        </article>
      )}
    </AppShell>
  );
}

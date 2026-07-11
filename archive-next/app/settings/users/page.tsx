"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import AppShell from "@/components/AppShell";
import PageToolbar from "@/components/PageToolbar";
import DataTable from "@/components/ui/DataTable";
import { FieldError } from "@/components/ui/Form";
import { createArchiveApiClient, type ManagedUser, type ManagedUserRole, type PendingInvitation } from "@/lib/archive-api";

const roleLabels: Record<ManagedUserRole, string> = {
  admin: "مدير",
  editor: "محرّر",
  viewer: "مشاهد"
};

function formatLocalDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("ar-SA");
}

type LoadState =
  | { status: "loading" }
  | { status: "ready"; users: ManagedUser[]; invitations: PendingInvitation[] }
  | { status: "error"; message: string };

type ActionState = { status: "idle" } | { status: "error"; message: string } | { status: "success"; message: string };

const inviteSchema = z.object({
  email: z.string().trim().min(1, "أدخل البريد الإلكتروني.").email("اكتب بريدًا إلكترونيًا صحيحًا."),
  role: z.enum(["admin", "editor", "viewer"])
});

type InviteFormValues = z.input<typeof inviteSchema>;

export default function UsersSettingsPage() {
  const api = useMemo(() => createArchiveApiClient(), []);
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
      setActionState({ status: "error", message: parsed.error.issues[0]?.message || "راجع بيانات الدعوة." });
      return;
    }

    const response = await api.inviteUser({ email: parsed.data.email, role: parsed.data.role });
    if (!response.ok) {
      setActionState({ status: "error", message: response.error });
      return;
    }
    setActionState({ status: "success", message: `تم إرسال الدعوة إلى ${response.invitation.email}` });
    inviteForm.reset({ email: "", role: "editor" });
    void load();
  });

  async function handleRoleChange(user: ManagedUser, role: ManagedUserRole) {
    const response = await api.updateUserRole(user.id, { role });
    if (!response.ok) {
      setActionState({ status: "error", message: response.error });
      return;
    }
    void load();
  }

  async function handleDelete(user: ManagedUser) {
    const response = await api.deleteUser(user.id);
    if (!response.ok) {
      setActionState({ status: "error", message: response.error });
      return;
    }
    void load();
  }
  const userColumns = useMemo<Array<ColumnDef<ManagedUser, unknown>>>(
    () => [
      {
        accessorKey: "name",
        header: "الاسم"
      },
      {
        accessorKey: "email",
        header: "البريد الإلكتروني",
        cell: ({ row }) => <span dir="ltr">{row.original.email}</span>
      },
      {
        accessorKey: "role",
        header: "الدور",
        cell: ({ row }) => (
          <select value={row.original.role} onChange={(event) => void handleRoleChange(row.original, event.target.value as ManagedUserRole)}>
            {(Object.keys(roleLabels) as ManagedUserRole[]).map((role) => (
              <option key={role} value={role}>
                {roleLabels[role]}
              </option>
            ))}
          </select>
        )
      },
      {
        id: "actions",
        header: "إجراءات",
        cell: ({ row }) => (
          <button type="button" className="button button-secondary" onClick={() => void handleDelete(row.original)}>
            إزالة
          </button>
        ),
        enableSorting: false
      }
    ],
    []
  );
  const invitationColumns = useMemo<Array<ColumnDef<PendingInvitation, unknown>>>(
    () => [
      {
        accessorKey: "email",
        header: "البريد الإلكتروني",
        cell: ({ row }) => <span dir="ltr">{row.original.email}</span>
      },
      {
        accessorKey: "role",
        header: "الدور",
        cell: ({ row }) => roleLabels[row.original.role]
      },
      {
        accessorKey: "expiresAt",
        header: "تنتهي في",
        cell: ({ row }) => formatLocalDate(row.original.expiresAt)
      }
    ],
    []
  );

  return (
    <AppShell subtitle="المستخدمون والأدوار" contentClassName="stack">
      <PageToolbar
        title="المستخدمون والأدوار"
        description="إدارة أعضاء الفريق وأدوارهم، ودعوة أعضاء جدد بالبريد الإلكتروني. مقتصر على المدراء."
        meta={<span className="badge">مدير فقط</span>}
      />
      <div className="state-banner state-banner-info" role="status">
        <strong>رحلة الإعداد: جهّز الفريق بعد التحقق من حساب المدير</strong>
        <p>أضف المستخدمين والأدوار، ثم ارجع إلى الجاهزية لمراجعة الإجراء التالي.</p>
        <a className="button button-secondary button-small" href="/first-run">عرض رحلة الإعداد</a>
      </div>

      <article className="panel">
        <div className="toolbar-row">
          <div>
            <h2>دعوة عضو جديد</h2>
            <p className="field-note">تُنشأ دعوة صالحة لمدة 7 أيام؛ يشارك المدير الرابط/الرمز يدويًا حتى تفعيل البريد الإلكتروني.</p>
          </div>
        </div>

        <form className="auth-form" onSubmit={handleInvite}>
          <label>
            البريد الإلكتروني
            <input
              type="email"
              dir="ltr"
              {...inviteForm.register("email")}
            />
            <FieldError>{inviteErrors.email?.message}</FieldError>
          </label>

          <label>
            الدور
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
            إرسال الدعوة
          </button>

          <p className="form-status" role={actionState.status === "error" ? "alert" : "status"}>
            {actionState.status === "idle" ? "" : actionState.message}
          </p>
        </form>
      </article>

      <article className="panel">
        <h2>الأعضاء</h2>

        {state.status === "loading" && <div className="empty-state">جار التحميل...</div>}
        {state.status === "error" && <p className="helper-text status-error">خطأ: {state.message}</p>}

        {state.status === "ready" && (
          <>
            <div className="mobile-card-list" role="list" aria-label="بطاقات أعضاء الفريق">
              {state.users.map((user) => (
                <article className="local-list-card" key={user.id} role="listitem">
                  <div className="local-list-card__main">
                    <div>
                      <span className="badge">{roleLabels[user.role]}</span>
                      <h3>{user.name}</h3>
                    </div>
                    <span className="badge">{formatLocalDate(user.createdAt)}</span>
                  </div>
                  <dl className="mobile-field-list">
                    <div>
                      <dt>البريد الإلكتروني</dt>
                      <dd dir="ltr">{user.email}</dd>
                    </div>
                    <div>
                      <dt>المعرّف</dt>
                      <dd dir="ltr">{user.id}</dd>
                    </div>
                  </dl>
                  <label className="toolbar-field">
                    الدور
                    <select value={user.role} onChange={(event) => void handleRoleChange(user, event.target.value as ManagedUserRole)}>
                      {(Object.keys(roleLabels) as ManagedUserRole[]).map((role) => (
                        <option key={role} value={role}>
                          {roleLabels[role]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="button" className="button button-danger button-sm" onClick={() => void handleDelete(user)}>
                    إزالة
                  </button>
                </article>
              ))}
            </div>

            <div className="desktop-table-wrap">
              <DataTable
                ariaLabel="أعضاء الفريق"
                columns={userColumns}
                data={state.users}
                emptyMessage="لا يوجد أعضاء."
                getRowId={(user) => user.id}
              />
            </div>
          </>
        )}
      </article>

      {state.status === "ready" && state.invitations.length > 0 && (
        <article className="panel">
          <h2>الدعوات المعلّقة</h2>
          <div className="mobile-card-list" role="list" aria-label="بطاقات الدعوات المعلقة">
            {state.invitations.map((invitation) => (
              <article className="local-list-card" key={invitation.id} role="listitem">
                <div className="local-list-card__main">
                  <div>
                    <span className="badge">دعوة معلّقة</span>
                    <h3 dir="ltr">{invitation.email}</h3>
                  </div>
                  <span className="badge">{roleLabels[invitation.role]}</span>
                </div>
                <dl className="mobile-field-list">
                  <div>
                    <dt>تنتهي في</dt>
                    <dd>{formatLocalDate(invitation.expiresAt)}</dd>
                  </div>
                  <div>
                    <dt>تاريخ الإنشاء</dt>
                    <dd>{formatLocalDate(invitation.createdAt)}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
          <div className="desktop-table-wrap">
            <DataTable
              ariaLabel="الدعوات المعلقة"
              columns={invitationColumns}
              data={state.invitations}
              emptyMessage="لا توجد دعوات معلقة."
              getRowId={(invitation) => invitation.id}
            />
          </div>
        </article>
      )}
    </AppShell>
  );
}

"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import PageToolbar from "@/components/PageToolbar";
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

export default function UsersSettingsPage() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<ManagedUserRole>("editor");
  const [actionState, setActionState] = useState<ActionState>({ status: "idle" });

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

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionState({ status: "idle" });
    const response = await api.inviteUser({ email: inviteEmail, role: inviteRole });
    if (!response.ok) {
      setActionState({ status: "error", message: response.error });
      return;
    }
    setActionState({ status: "success", message: `تم إرسال الدعوة إلى ${response.invitation.email}` });
    setInviteEmail("");
    void load();
  }

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

  return (
    <AppShell subtitle="المستخدمون والأدوار" contentClassName="stack">
      <PageToolbar
        title="المستخدمون والأدوار"
        description="إدارة أعضاء الفريق وأدوارهم، ودعوة أعضاء جدد بالبريد الإلكتروني. مقتصر على المدراء."
        meta={<span className="badge">مدير فقط</span>}
      />

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
              required
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
            />
          </label>

          <label>
            الدور
            <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as ManagedUserRole)}>
              {(Object.keys(roleLabels) as ManagedUserRole[]).map((role) => (
                <option key={role} value={role}>
                  {roleLabels[role]}
                </option>
              ))}
            </select>
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

            <div className="scroll-x desktop-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">الاسم</th>
                    <th scope="col">البريد الإلكتروني</th>
                    <th scope="col">الدور</th>
                    <th scope="col">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {state.users.map((user) => (
                    <tr key={user.id}>
                      <td>{user.name}</td>
                      <td dir="ltr">{user.email}</td>
                      <td>
                        <select value={user.role} onChange={(event) => void handleRoleChange(user, event.target.value as ManagedUserRole)}>
                          {(Object.keys(roleLabels) as ManagedUserRole[]).map((role) => (
                            <option key={role} value={role}>
                              {roleLabels[role]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <button type="button" className="button button-secondary" onClick={() => void handleDelete(user)}>
                          إزالة
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
          <div className="scroll-x desktop-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">البريد الإلكتروني</th>
                  <th scope="col">الدور</th>
                  <th scope="col">تنتهي في</th>
                </tr>
              </thead>
              <tbody>
                {state.invitations.map((invitation) => (
                  <tr key={invitation.id}>
                    <td dir="ltr">{invitation.email}</td>
                    <td>{roleLabels[invitation.role]}</td>
                    <td>{formatLocalDate(invitation.expiresAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      )}
    </AppShell>
  );
}

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
          <div className="scroll-x">
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
        )}
      </article>

      {state.status === "ready" && state.invitations.length > 0 && (
        <article className="panel">
          <h2>الدعوات المعلّقة</h2>
          <div className="scroll-x">
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
                    <td>{new Date(invitation.expiresAt).toLocaleDateString("ar")}</td>
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

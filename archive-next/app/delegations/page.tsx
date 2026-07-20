"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import EmptyState from "@/components/EmptyState";
import PageToolbar from "@/components/PageToolbar";
import { useConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  createArchiveApiClient,
  type DelegatedAccess,
  type MentionableUser
} from "@/lib/archive-api";

type Direction = "granted" | "received";

type ListState =
  | { status: "loading" }
  | { status: "ready"; delegations: DelegatedAccess[] }
  | { status: "error"; message: string };

type FormState = { status: "idle" } | { status: "saving" } | { status: "error"; message: string };

function statusLabel(status: DelegatedAccess["status"]): string {
  if (status === "active") return "نشطة";
  if (status === "revoked") return "أُلغيت";
  return "منتهية";
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("ar-SA");
}

export default function DelegationsPage() {
  const api = useMemo(() => createArchiveApiClient(), []);
  const dialogs = useConfirmDialog();

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
        setState({ status: "error", message: response.error || "تعذر تحميل التفويضات." });
      }
    } catch (error) {
      setState({ status: "error", message: error instanceof Error ? error.message : "تعذر تحميل التفويضات." });
    }
  }, [api]);

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
      setFormState({ status: "error", message: "اختر الزميل، وأدخل معرّف مادة واحدة على الأقل، وتاريخ انتهاء." });
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
        setFormState({ status: "error", message: response.error || "تعذر إنشاء التفويض." });
      }
    } catch (error) {
      setFormState({ status: "error", message: error instanceof Error ? error.message : "تعذر إنشاء التفويض." });
    }
  };

  const handleRevoke = async (delegation: DelegatedAccess) => {
    const confirmed = await dialogs.confirm({
      title: "إلغاء التفويض",
      message: `إلغاء وصول ${delegation.grantee.name || delegation.grantee.id} الآن بدل انتظار انتهائه تلقائياً؟`,
      confirmLabel: "إلغاء الوصول",
      destructive: true
    });
    if (!confirmed) return;
    await api.revokeDelegatedAccess(delegation.id);
    await load(direction);
  };

  const delegations = state.status === "ready" ? state.delegations : [];

  return (
    <AppShell subtitle="تفويض الوصول المؤقت" navLabel="التفويضات" contentClassName="observability-content">
      <PageToolbar
        eyebrow={<span className="badge">V1-726</span>}
        title="تفويض وصول مؤقت لزميل"
        description="امنح زميلاً صلاحية تعديل مؤقتة على مواد محددة، تنتهي تلقائياً في الموعد الذي تحدده دون تغيير دوره العام."
        meta={
          <>
            <span className="badge">{delegations.length} تفويض</span>
          </>
        }
        actions={
          <div className="button-row">
            <button
              type="button"
              className={`button ${direction === "granted" ? "" : "button-secondary"} button-sm`}
              onClick={() => setDirection("granted")}
            >
              الممنوحة مني
            </button>
            <button
              type="button"
              className={`button ${direction === "received" ? "" : "button-secondary"} button-sm`}
              onClick={() => setDirection("received")}
            >
              الممنوحة لي
            </button>
          </div>
        }
      />

      {direction === "granted" ? (
        <section className="panel" aria-label="منح تفويض جديد">
          <div className="panel-title-row">
            <div>
              <h2>منح تفويض جديد</h2>
              <p>يحصل الزميل على صلاحية تعديل هذه المواد فقط، حتى موعد الانتهاء المحدد.</p>
            </div>
          </div>
          <form className="form-grid" onSubmit={handleCreate}>
            <label>
              الزميل
              <select value={granteeId} onChange={(event) => setGranteeId(event.target.value)} required>
                <option value="">اختر زميلاً</option>
                {colleagues.map((user) => (
                  <option key={user.id} value={user.id}>{user.name}</option>
                ))}
              </select>
            </label>
            <label>
              معرّفات المواد (مفصولة بفواصل)
              <input
                type="text"
                value={itemIds}
                onChange={(event) => setItemIds(event.target.value)}
                placeholder="item-1, item-2"
                required
              />
            </label>
            <label>
              تاريخ ووقت الانتهاء
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
                required
              />
            </label>
            {formState.status === "error" ? <p className="form-error">{formState.message}</p> : null}
            <button type="submit" className="button" disabled={formState.status === "saving"}>
              {formState.status === "saving" ? "جارٍ المنح..." : "منح التفويض"}
            </button>
          </form>
        </section>
      ) : null}

      {state.status === "error" ? (
        <EmptyState title="تعذر تحميل التفويضات" description={state.message} />
      ) : delegations.length === 0 && state.status === "ready" ? (
        <EmptyState
          title={direction === "granted" ? "لم تمنح أي تفويض بعد" : "لا توجد تفويضات ممنوحة لك"}
          description="تظهر هنا التفويضات المؤقتة بمجرد إنشائها."
        />
      ) : (
        <section className="panel" aria-label="قائمة التفويضات">
          <div className="scroll-x desktop-table-wrap">
            <table className="data-table" role="grid" aria-label="قائمة تفويضات الوصول">
              <thead>
                <tr>
                  <th>{direction === "granted" ? "الزميل" : "منحها"}</th>
                  <th>المواد</th>
                  <th>الحالة</th>
                  <th>الانتهاء</th>
                  {direction === "granted" ? <th>الإجراءات</th> : null}
                </tr>
              </thead>
              <tbody>
                {delegations.map((delegation) => (
                  <tr key={delegation.id}>
                    <td>{direction === "granted" ? (delegation.grantee.name || delegation.grantee.id) : (delegation.grantor.name || delegation.grantor.id)}</td>
                    <td className="mono-text">{(delegation.scope.itemIds || []).join(", ")}</td>
                    <td><span className={`badge ${delegation.status === "active" ? "" : "badge-danger"}`}>{statusLabel(delegation.status)}</span></td>
                    <td className="mono-text">{formatDate(delegation.expiresAt)}</td>
                    {direction === "granted" ? (
                      <td>
                        {delegation.status === "active" ? (
                          <button type="button" className="button button-danger button-sm" onClick={() => void handleRevoke(delegation)}>
                            إلغاء
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

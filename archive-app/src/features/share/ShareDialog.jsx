import { jsx, jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Share2, X, Loader2, Copy, Check, Mail, ShieldCheck, ShieldOff } from "lucide-react";

import { inviteShareByEmail, mintShareLink, revokeShareLink } from "./shareClient.js";
import {
  SHARE_PERMISSIONS,
  DEFAULT_SHARE_PERMISSION,
  createShareGrant,
  describeShareGrant
} from "./sharePermissions.js";

// §1697 — share dialog slice. Lets the user pick a PERMISSION level (view /
// comment / download / edit) and an expiry, previews the grant via
// describeShareGrant, then threads the permission into the existing
// mintShareLink scope. Server-side invite/comment workflows are DEFERRED (see
// §1697); this slice normalizes item shares to the server's `items` scope and
// carries the permission choice in the signed link. FAILURE-SAFE.

const EXPIRY_OPTIONS = Object.freeze([
  { value: 7, label: "7 أيام" },
  { value: 30, label: "30 يوماً" },
  { value: 90, label: "90 يوماً" },
  { value: 0, label: "بدون انتهاء" }
]);

function PermissionPicker({ permission, onChange, disabled }) {
  return jsx("div", {
    className: "grid grid-cols-2 gap-2 sm:grid-cols-4",
    role: "radiogroup",
    "aria-label": "مستوى الصلاحية",
    children: SHARE_PERMISSIONS.map((level) => {
      const active = level.id === permission;
      return jsxs("label", {
        className: `btn h-auto flex-col gap-1 px-2 py-2.5 text-xs ${active ? "btn-primary" : "btn-outline border-white/15 text-gray-300"}`,
        title: level.description,
        children: [
          jsx("input", {
            type: "radio",
            name: "share-permission",
            className: "radio radio-xs sr-only",
            value: level.id,
            checked: active,
            disabled,
            onChange: () => onChange(level.id)
          }),
          jsx("span", { className: "font-semibold", children: level.label })
        ]
      }, level.id);
    })
  });
}

/**
 * Share dialog for an item / collection.
 *
 * @param {{
 *   scopeType: "item"|"items"|"collection",
 *   scopeIds: string[]|string,
 *   label?: string,
 *   title?: string,
 *   defaultExpiryDays?: number,
 *   baseUrl?: string,
 *   getToken: () => string,
 *   onClose: () => void,
 *   onShared?: (result: { url: string, permission: string, jti?: string }) => void,
 * }} props
 */
export function ShareDialog({
  scopeType,
  scopeIds,
  label = "",
  title = "",
  defaultExpiryDays = 30,
  baseUrl = "",
  getToken,
  onClose,
  onShared
}) {
  const [permission, setPermission] = useState(DEFAULT_SHARE_PERMISSION);
  const [expiresInDays, setExpiresInDays] = useState(Number(defaultExpiryDays) || 0);
  const [password, setPassword] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteMessage, setInviteMessage] = useState("");
  const [state, setState] = useState({ status: "idle", url: "", jti: "", error: "" });
  const [revokeState, setRevokeState] = useState({ status: "idle", error: "" });
  const [copied, setCopied] = useState(false);

  let grant = null;
  let grantError = "";
  try {
    grant = createShareGrant({ scopeType, scopeIds, permission, expiresInDays, label });
  } catch (err) {
    grantError = err?.message || "تعذّر إعداد المشاركة.";
  }

  const handleConfirm = async () => {
    if (!grant) {
      setState({ status: "error", url: "", jti: "", error: grantError });
      return;
    }
    setState({ status: "minting", url: "", jti: "", error: "" });
    setRevokeState({ status: "idle", error: "" });
    try {
      const scope = { type: grant.scopeType, ids: grant.scopeIds, label: grant.label, permission: grant.permission };
      const cleanTitle = String(title || grant.label || "").trim();
      const cleanEmail = inviteEmail.trim();
      const result = cleanEmail
        ? await inviteShareByEmail({
            email: cleanEmail,
            message: inviteMessage,
            scope,
            title: cleanTitle,
            expiresInDays: grant.expiresInDays,
            password,
            baseUrl,
            getToken
          })
        : await mintShareLink({
            scope,
            title: cleanTitle,
            expiresInDays: grant.expiresInDays,
            password,
            baseUrl,
            getToken
          });
      const { url, jti } = result;
      setState({ status: "ready", url, jti: jti || "", error: "", invitedEmail: result.invitation?.email || cleanEmail });
      onShared?.({ url, permission: grant.permission, jti: jti || "" });
    } catch (err) {
      setState({ status: "error", url: "", jti: "", error: err?.message || "تعذّر إنشاء رابط المشاركة." });
    }
  };

  const handleCopy = async () => {
    if (!state.url) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(state.url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      setCopied(false);
    }
  };

  const handleRevoke = async () => {
    if (!state.jti || revokeState.status === "revoking" || revokeState.status === "revoked") return;
    setRevokeState({ status: "revoking", error: "" });
    try {
      await revokeShareLink({ jti: state.jti, baseUrl, getToken });
      setRevokeState({ status: "revoked", error: "" });
    } catch (err) {
      setRevokeState({ status: "error", error: err?.message || "تعذّر إلغاء رابط المشاركة." });
    }
  };

  const isBusy = state.status === "minting";
  const isRevoking = revokeState.status === "revoking";

  return jsx("div", {
    role: "dialog",
    "aria-modal": "true",
    "aria-label": "مشاركة مع صلاحيات",
    dir: "rtl",
    className: "modal modal-open fixed inset-0 z-[3000] flex items-end justify-center p-4 sm:items-center",
    children: jsxs("div", {
      className: "modal-box relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0d0d0d] p-0 text-right shadow-2xl",
      children: [
        jsxs("div", {
          className: "flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4",
          children: [
            jsxs("div", { className: "flex items-center gap-2.5", children: [
              jsx("span", { className: "flex h-9 w-9 items-center justify-center rounded-xl va-accent-bg-soft va-accent-text", children: jsx(Share2, { className: "h-4 w-4" }) }),
              jsxs("div", { children: [
                jsx("h2", { className: "text-base font-bold text-white", children: "مشاركة مع صلاحيات" }),
                jsx("p", { className: "text-xs text-gray-500", children: label || "اختر مستوى الوصول ومدة الصلاحية." })
              ] })
            ] }),
            jsx("button", {
              type: "button",
              onClick: onClose,
              className: "rounded-lg border border-white/10 p-1.5 text-gray-500 transition-colors hover:text-gray-300",
              "aria-label": "إغلاق",
              children: jsx(X, { className: "h-4 w-4" })
            })
          ]
        }),

        jsxs("div", { className: "space-y-4 px-5 py-4", children: [
          jsxs("div", { className: "space-y-2", children: [
            jsx("span", { className: "text-xs font-semibold text-gray-400", children: "مستوى الصلاحية" }),
            jsx(PermissionPicker, { permission, onChange: setPermission, disabled: isBusy })
          ] }),

          jsxs("div", { className: "space-y-2", children: [
            jsx("span", { className: "text-xs font-semibold text-gray-400", children: "مدة الصلاحية" }),
            jsx("select", {
              className: "select select-bordered w-full bg-white/5 text-sm text-gray-200",
              value: expiresInDays,
              disabled: isBusy,
              onChange: (e) => setExpiresInDays(Number(e.target.value)),
              children: EXPIRY_OPTIONS.map((opt) => jsx("option", { value: opt.value, children: opt.label }, opt.value))
            })
          ] }),

          jsxs("label", { className: "block space-y-2", children: [
            jsx("span", { className: "text-xs font-semibold text-gray-400", children: "كلمة مرور اختيارية" }),
            jsx("input", {
              type: "password",
              value: password,
              disabled: isBusy,
              onChange: (e) => setPassword(e.target.value),
              className: "input input-bordered w-full bg-white/5 text-sm text-gray-200",
              placeholder: "اتركها فارغة لرابط مفتوح"
            })
          ] }),

          jsxs("div", { className: "rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-3", children: [
            jsxs("label", { className: "block space-y-2", children: [
              jsxs("span", { className: "inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400", children: [
                jsx(Mail, { className: "h-3.5 w-3.5", "aria-hidden": true }),
                "دعوة بالبريد الإلكتروني"
              ] }),
              jsx("input", {
                type: "email",
                value: inviteEmail,
                disabled: isBusy,
                onChange: (e) => setInviteEmail(e.target.value),
                className: "input input-bordered w-full bg-white/5 text-sm text-gray-200",
                placeholder: "reviewer@example.com",
                "aria-label": "بريد المستلم"
              })
            ] }),
            jsxs("label", { className: "block space-y-2", children: [
              jsx("span", { className: "text-xs font-semibold text-gray-400", children: "رسالة اختيارية" }),
              jsx("textarea", {
                value: inviteMessage,
                disabled: isBusy,
                onChange: (e) => setInviteMessage(e.target.value),
                rows: 2,
                className: "textarea textarea-bordered w-full bg-white/5 text-sm text-gray-200",
                placeholder: "اكتب سياقاً قصيراً للمستلم",
                "aria-label": "رسالة الدعوة"
              })
            ] })
          ] }),

          grant && jsxs("div", {
            className: "badge badge-ghost h-auto w-full justify-start gap-2 whitespace-normal rounded-xl border-white/10 bg-white/5 px-3 py-2 text-xs text-gray-300",
            children: [jsx(ShieldCheck, { className: "h-3.5 w-3.5 shrink-0 va-accent-text" }), jsx("span", { children: describeShareGrant(grant) })]
          }),

          state.status === "ready" && jsxs("div", { className: "space-y-2", children: [
            state.invitedEmail && jsx("div", {
              role: "status",
              className: "alert alert-info rounded-xl px-3 py-2 text-xs",
              children: `تم إرسال الدعوة إلى ${state.invitedEmail}`
            }),
            jsxs("div", {
              role: "alert",
              className: "alert alert-success flex items-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2.5",
              children: [
                jsx("input", { readOnly: true, value: state.url, className: "input input-sm flex-1 truncate bg-transparent text-xs text-emerald-100", "aria-label": "رابط المشاركة" }),
                jsxs("button", {
                  type: "button",
                  onClick: handleCopy,
                  className: "btn btn-sm btn-ghost gap-1 text-emerald-100",
                  children: [copied ? jsx(Check, { className: "h-3.5 w-3.5" }) : jsx(Copy, { className: "h-3.5 w-3.5" }), copied ? "تم النسخ" : "نسخ"]
                }),
                state.jti && jsxs("button", {
                  type: "button",
                  onClick: handleRevoke,
                  disabled: isRevoking || revokeState.status === "revoked",
                  className: "btn btn-sm btn-error btn-outline gap-1",
                  children: [
                    isRevoking ? jsx(Loader2, { className: "h-3.5 w-3.5 animate-spin" }) : jsx(ShieldOff, { className: "h-3.5 w-3.5" }),
                    revokeState.status === "revoked" ? "تم الإلغاء" : "إلغاء الرابط"
                  ]
                })
              ]
            }),
            revokeState.status === "revoked" && jsx("div", {
              role: "status",
              className: "alert alert-warning rounded-xl px-3 py-2 text-xs",
              children: "تم إلغاء الرابط"
            }),
            revokeState.status === "error" && jsx("div", {
              role: "alert",
              className: "alert alert-error rounded-xl px-3 py-2 text-xs",
              children: revokeState.error
            })
          ] }),

          (state.status === "error" || grantError) && state.status !== "ready" && jsx("div", {
            role: "alert",
            className: "alert alert-error rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2.5 text-xs text-red-100",
            children: state.error || grantError
          })
        ] }),

        jsxs("div", {
          className: "flex items-center justify-end gap-3 border-t border-white/10 px-5 py-4",
          children: [
            jsx("button", {
              type: "button",
              onClick: onClose,
              className: "btn btn-ghost btn-sm text-gray-300",
              children: state.status === "ready" ? "إغلاق" : "إلغاء"
            }),
            state.status !== "ready" && jsxs("button", {
              type: "button",
              onClick: handleConfirm,
              disabled: isBusy || !grant,
              className: "btn btn-primary btn-sm gap-2",
              children: [
                isBusy ? jsx(Loader2, { className: "h-4 w-4 animate-spin" }) : jsx(Share2, { className: "h-4 w-4" }),
                isBusy ? "جارٍ الإنشاء…" : (inviteEmail.trim() ? "إرسال الدعوة" : "إنشاء الرابط")
              ]
            })
          ]
        })
      ]
    })
  });
}

export default ShareDialog;

import {
  useAppStore
} from "../stores/index.js";
import { EntityFormModal } from "../components/common/EntityFormModal.jsx";
import {
  Activity,
  PenLine,
  Plus,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  Users
} from "lucide-react";
import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { motion } from "framer-motion";
import { appConfirm } from "../components/common/ConfirmDialog.js";
import { EmptyState } from "../components/common/EmptyState.jsx";
import { MotionPage, PageHero } from "../components/ui/V1Primitives.jsx";
import { reportError } from "../utils/errorReporting.js";
import { hashPassword, validatePasswordStrength } from "../utils/passwordHash.js";
import { useCanPerform } from "../features/users/useCanPerform.js";
import { ACTIONS } from "../features/users/permissions.js";
import {
  USER_ROLES,
  canDeactivateUser,
  createInvitationMetadata,
  createTemporaryPassword,
  createUserValue,
  getFilteredUsers,
  getUserSummary,
  isValidInviteEmail,
  normalizeUserRole
} from "../features/users/viewModel.js";
import { formatDateTime, formatNumber } from "../utils/formatting.js";


function getRole(roleId) {
  return USER_ROLES.find((role) => role.id === roleId) || USER_ROLES[USER_ROLES.length - 1];
}

function UserForm({ user, users, onCancel, onSave }) {
  const [username, setUsername] = React.useState(user?.username || "");
  const [displayName, setDisplayName] = React.useState(user?.displayName || "");
  const [email, setEmail] = React.useState(user?.email || "");
  const [role, setRole] = React.useState(normalizeUserRole(user?.role || "viewer"));
  const [password, setPassword] = React.useState("");
  const [inviteByEmail, setInviteByEmail] = React.useState(false);
  const usernameId = React.useId();
  const displayNameId = React.useId();
  const emailId = React.useId();
  const passwordId = React.useId();
  const roleGroupId = React.useId();
  const displayNameRef = React.useRef(null);

  const usernameExists = !user && users.some((item) => item.username.trim().toLowerCase() === username.trim().toLowerCase());
  const canSave = Boolean(
    username.trim() &&
    displayName.trim() &&
    !usernameExists &&
    (user || (inviteByEmail ? isValidInviteEmail(email) : password.length >= 6))
  );

  const submit = async (keepOpen) => {
    if (!canSave) return;
    const ok = await onSave({ ...user, username, displayName, email: email.trim() || undefined, role, password, inviteByEmail }, { keepOpen });
    if (ok && keepOpen) {
      setUsername("");
      setDisplayName("");
      setEmail("");
      setPassword("");
      setInviteByEmail(false);
      setRole(normalizeUserRole("viewer"));
      window.requestAnimationFrame(() => displayNameRef.current?.focus());
    }
  };

  return jsx(EntityFormModal, {
    title: user ? "تعديل مستخدم" : "مستخدم جديد",
    icon: jsx(Users, { className: "h-4 w-4" }),
    onCancel,
    onSubmit: () => submit(false),
    onSubmitAndNew: () => submit(true),
    canSubmit: canSave,
    submitLabel: user ? "حفظ التعديل" : "إنشاء المستخدم",
    isEditing: Boolean(user),
    children: jsxs("div", {
      className: "space-y-4",
      children: [
        jsx("p", { className: "text-xs leading-relaxed text-gray-500", children: user ? "لا يتم تغيير كلمة المرور من هنا؛ استخدم تبويب الأمان عند الحاجة." : "يمكن إنشاء مستخدم بكلمة مرور أولية أو دعوة بريدية معلّقة مع إلزام تغيير كلمة المرور." }),
        jsxs("div", {
          className: "grid gap-3 md:grid-cols-2",
          children: [
            jsxs("div", { className: "space-y-1 text-sm text-gray-300", children: [
              jsx("label", { htmlFor: usernameId, className: "block", children: "اسم المستخدم" }),
              jsx("input", {
                id: usernameId,
                value: username,
                onChange: (event) => setUsername(event.target.value),
                disabled: !!user,
                dir: "ltr",
                className: "input input-bordered min-h-11 w-full va-surface-deep rounded-xl border px-3 text-sm text-white outline-none focus:border-emerald-500/40 disabled:opacity-60",
                placeholder: "username"
              }),
              usernameExists && jsx("span", { className: "text-xs text-red-300", children: "اسم المستخدم موجود بالفعل" })
            ] }),
            jsxs("div", { className: "space-y-1 text-sm text-gray-300", children: [
              jsx("label", { htmlFor: displayNameId, className: "block", children: "الاسم المعروض" }),
              jsx("input", {
                id: displayNameId,
                ref: displayNameRef,
                "data-autofocus": true,
                value: displayName,
                onChange: (event) => setDisplayName(event.target.value),
                className: "input input-bordered min-h-11 w-full va-surface-deep rounded-xl border px-3 text-sm text-white outline-none focus:border-emerald-500/40",
                placeholder: "اسم المستخدم داخل الواجهة"
              })
            ] }),
            jsxs("div", { className: "space-y-1 text-sm text-gray-300", children: [
              jsx("label", { htmlFor: emailId, className: "block", children: "البريد الإلكتروني" }),
              jsx("input", {
                id: emailId,
                value: email,
                onChange: (event) => setEmail(event.target.value),
                type: "email",
                dir: "ltr",
                className: "input input-bordered min-h-11 w-full va-surface-deep rounded-xl border px-3 text-sm text-white outline-none focus:border-emerald-500/40",
                placeholder: "user@example.com"
              })
            ] }),
            !user && jsxs("div", { className: "space-y-2 text-sm text-gray-300", children: [
              jsxs("label", { className: "flex items-center gap-2 rounded-xl border border-white/10 bg-gray-950/25 px-3 py-2 text-xs text-gray-300", children: [
                jsx("input", {
                  type: "checkbox",
                  checked: inviteByEmail,
                  onChange: (event) => setInviteByEmail(event.target.checked),
                  className: "h-4 w-4 rounded border-white/20 bg-gray-900"
                }),
                "دعوة بالبريد وإنشاء كلمة مرور مؤقتة"
              ] }),
              jsx("label", { htmlFor: passwordId, className: "block", children: "كلمة المرور الأولية" }),
              jsx("input", {
                id: passwordId,
                value: password,
                onChange: (event) => setPassword(event.target.value),
                type: "password",
                dir: "ltr",
                disabled: inviteByEmail,
                className: "input input-bordered min-h-11 w-full va-surface-deep rounded-xl border px-3 text-sm text-white outline-none focus:border-emerald-500/40",
                placeholder: inviteByEmail ? "سيتم توليدها تلقائيًا" : "6 أحرف على الأقل"
              })
            ] }),
            jsxs("div", { className: `space-y-2 ${user ? "md:col-span-2" : ""}`, children: [
              jsx("span", { id: roleGroupId, className: "text-sm text-gray-300", children: "الدور" }),
              jsx("div", { role: "radiogroup", "aria-labelledby": roleGroupId, className: "flex flex-wrap gap-2", children: USER_ROLES.map((item) => jsxs("button", {
                type: "button",
                role: "radio",
                "aria-checked": role === item.id,
                onClick: () => setRole(item.id),
                className: `btn btn-sm inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${role === item.id ? "text-white" : "border-white/10 bg-gray-950/35 text-gray-400 hover:bg-white/5"}`,
                style: role === item.id ? { borderColor: `${item.color}55`, backgroundColor: `${item.color}18` } : undefined,
                children: [
                  jsx("span", { className: "inline-block h-2.5 w-2.5 shrink-0 rounded-full", style: { backgroundColor: item.color } }),
                  item.label
                ]
              }, item.id)) })
            ] })
          ]
        })
      ]
    })
  });
}

function UserCard({ user, currentUser, users, index, recentOpsCount = 0, onEdit, onToggle, onDelete }) {
  const role = getRole(user.role);
  const isCurrent = currentUser?.id === user.id;
  const canToggle = canDeactivateUser(user, users) && !isCurrent;
  const accentColor = user.isActive ? (role.color || "#10b981") : "#6b7280";
  return jsxs(motion.article, {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.18, delay: Math.min(index, 10) * 0.025 },
    className: "va-entity-card rounded-2xl va-surface-muted border p-4 text-right transition-all hover:border-white/20",
    style: { boxShadow: `inset -3px 0 0 0 ${accentColor}44` },
    dir: "rtl",
    children: [
      jsxs("div", { className: "flex items-start justify-between gap-3", children: [
        jsxs("div", { className: "flex min-w-0 items-start gap-3", children: [
          jsx("span", {
            className: "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
            style: { backgroundColor: `${accentColor}22`, color: accentColor, boxShadow: `0 0 0 1px ${accentColor}30` },
            children: user.role === "admin" ? jsx(ShieldCheck, { className: "h-5 w-5" }) : jsx(Users, { className: "h-5 w-5" })
          }),
          jsxs("div", { className: "min-w-0", children: [
            jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [
              jsx("h3", { className: "truncate text-base font-bold text-white", children: user.displayName || user.username }),
              jsx("span", { className: "badge badge-sm rounded-full border px-2 py-0.5 text-xs font-medium", style: { borderColor: `${accentColor}45`, backgroundColor: `${accentColor}18`, color: accentColor }, children: role.label }),
              !user.isActive && jsx("span", { className: "badge badge-sm rounded-full border border-red-500/20 bg-red-500/10 px-2 py-0.5 text-xs text-red-200", children: "معطل" }),
              user.inviteStatus === "pending" && jsx("span", { className: "badge badge-sm rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-200", children: "دعوة معلّقة" }),
              isCurrent && jsx("span", { className: "badge badge-sm rounded-full border va-accent-border va-accent-bg-soft px-2 py-0.5 text-xs va-accent-text-on-soft", children: "الحالي" })
            ] }),
            jsx("p", { className: "mt-1 truncate text-xs text-gray-500 font-mono", dir: "ltr", children: `@${user.username}` }),
            user.email && jsx("p", { className: "mt-0.5 truncate text-xs text-gray-500", dir: "ltr", children: user.email }),
            user.lastLoginAt && jsx("p", { className: "mt-2 text-xs text-gray-600", children: `آخر دخول: ${formatDateTime(user.lastLoginAt)}` }),
            user.invitedAt && jsx("p", { className: "mt-2 text-xs text-amber-300/80", children: `أُنشئت الدعوة: ${formatDateTime(user.invitedAt)}` }),
            jsxs("p", {
              className: "mt-1 flex items-center gap-1.5 text-xs text-gray-500",
              children: [
                jsx(Activity, { className: "h-3.5 w-3.5 va-accent-text/80" }),
                recentOpsCount > 0
                  ? `${formatNumber(recentOpsCount)} عملية خلال آخر 7 أيام`
                  : "لا توجد عمليات في آخر 7 أيام"
              ]
            })
          ] })
        ] }),
        jsxs("div", { className: "flex shrink-0 gap-1", children: [
          jsx("button", { type: "button", onClick: onToggle, disabled: !canToggle, className: `btn btn-ghost btn-sm rounded-lg px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${user.isActive ? "text-gray-300 hover:bg-white/5" : "va-accent-text hover:bg-emerald-500/10"}`, children: user.isActive ? "تعطيل" : "تفعيل" }),
          jsx("button", { type: "button", onClick: onEdit, className: "btn btn-ghost btn-sm btn-square rounded-lg p-2 text-gray-500 hover:bg-white/5 hover:text-white", "aria-label": `تعديل ${user.displayName || user.username || "المستخدم"}`, children: jsx(PenLine, { className: "h-4 w-4" }) }),
          jsx("button", { type: "button", onClick: onDelete, disabled: !canToggle, className: "btn btn-ghost btn-sm btn-square rounded-lg p-2 text-gray-500 hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40", "aria-label": `حذف ${user.displayName || user.username || "المستخدم"}`, children: jsx(Trash2, { className: "h-4 w-4" }) })
        ] })
      ] }),
      jsx("p", { className: "mt-3 text-xs leading-relaxed text-gray-600", children: role.description })
    ]
  }, user.id);
}

export function UsersPage() {
  const {
    users = [],
    currentUser,
    settings = {},
    auditLogs = [],
    addUser,
    updateUser,
    deleteUser,
    showToast,
    showNotification
  } = useAppStore();

  // Count CUD-style audit events per user over the last 7 days so the
  // user cards can surface a quick activity signal alongside role and
  // last-login info. The audit log already truncates to the most recent
  // 1000 entries, so this stays O(n) on a small n.
  const recentOpsByUserId = React.useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const counts = new Map();
    for (const log of auditLogs) {
      if (!log?.userId || !log?.timestamp) continue;
      if (new Date(log.timestamp).getTime() < cutoff) continue;
      counts.set(log.userId, (counts.get(log.userId) || 0) + 1);
    }
    return counts;
  }, [auditLogs]);

  const canManageUsers = useCanPerform(ACTIONS.USER_MANAGE);
  const [query, setQuery] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState("all");
  const [showForm, setShowForm] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState(null);

  const summary = React.useMemo(() => getUserSummary(users), [users]);
  const filteredUsers = React.useMemo(() => getFilteredUsers(users, query, roleFilter), [query, roleFilter, users]);

  const saveUser = async (draft, opts = {}) => {
    try {
      if (editingUser) {
        await updateUser?.(createUserValue({
          ...editingUser,
          displayName: draft.displayName,
          role: draft.role,
          createdAt: editingUser.createdAt
        }));
        showToast?.("تم تحديث المستخدم", "success");
      } else {
        const temporaryPassword = draft.inviteByEmail ? createTemporaryPassword() : "";
        const passwordForHash = draft.inviteByEmail ? temporaryPassword : draft.password;
        const policyErrors = validatePasswordStrength(passwordForHash);
        if (policyErrors.length > 0) {
          showToast?.(policyErrors[0], "error");
          return false;
        }
        const invitation = draft.inviteByEmail
          ? createInvitationMetadata({ email: draft.email, invitedBy: currentUser?.id || currentUser?.username })
          : null;
        const passwordHash = await hashPassword(passwordForHash);
        await addUser?.(createUserValue({
          username: draft.username,
          displayName: draft.displayName,
          email: draft.email,
          passwordHash,
          role: draft.role,
          isActive: true,
          mustChangePassword: true,
          ...(invitation || {})
        }));
        if (draft.inviteByEmail) {
          showNotification?.(`كلمة المرور المؤقتة لـ ${draft.username}: ${temporaryPassword}`, {
            type: "success",
            title: "تم إنشاء دعوة المستخدم",
            category: "users",
            persistent: true,
            targetLabel: draft.email,
            action: {
              label: "نسخ",
              run: () => navigator.clipboard?.writeText?.(temporaryPassword)
            }
          });
        } else {
          showToast?.("تم إنشاء المستخدم", "success");
        }
      }
      if (!opts.keepOpen) {
        setShowForm(false);
        setEditingUser(null);
      }
      return true;
    } catch (error) {
      reportError(showNotification, error, {
        context: "حفظ المستخدم",
        recovery: { run: () => saveUser(draft, opts) }
      });
      return false;
    }
  };

  const toggleUser = async (user) => {
    if (!canDeactivateUser(user, users) || currentUser?.id === user.id) {
      showToast?.("لا يمكن تعطيل المستخدم الحالي أو آخر مدير نشط", "error");
      return;
    }
    await updateUser?.({ ...user, isActive: !user.isActive, updatedAt: new Date().toISOString() });
  };

  const disableUser = async (user) => {
    if (!canDeactivateUser(user, users) || currentUser?.id === user.id) return;
    const confirmed = await appConfirm(`هل تريد تعطيل المستخدم "${user.displayName || user.username}"؟`, {
      title: "تعطيل مستخدم",
      kind: "warning",
      confirmLabel: "تعطيل"
    });
    if (!confirmed) return;
    await deleteUser?.(user.id);
  };

  return jsxs(MotionPage, {
    className: "space-y-6 p-4 sm:p-6",
    children: [
      jsx(PageHero, {
        icon: jsx(Users, { className: "h-6 w-6 va-accent-text" }),
        title: "المستخدمون",
        description: "إدارة الحسابات والأدوار مع حماية آخر مدير نشط ومنع تغيير كلمات المرور من صفحة المستخدمين.",
        actions: canManageUsers ? jsxs("button", { type: "button", onClick: () => { setEditingUser(null); setShowForm(true); }, className: "btn btn-sm va-primary-button inline-flex min-h-10 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white", children: [jsx(Plus, { className: "h-4 w-4" }), "مستخدم جديد"] }) : null
      }),
      showForm && jsx(UserForm, { user: editingUser, users, onCancel: () => { setShowForm(false); setEditingUser(null); }, onSave: saveUser }),
      jsx("section", { className: "grid gap-3 sm:grid-cols-4", children: [
        ["كل المستخدمين", summary.total, Users],
        ["نشط", summary.active, ShieldCheck],
        ["معطل", summary.inactive, Trash2],
        ["مدير نشط", summary.activeAdmins, Shield]
      ].map(([label, value, Icon]) => jsxs("div", { className: "card va-metric-card rounded-2xl va-surface-muted border p-4 text-right", children: [
        jsxs("div", { className: "flex items-start justify-between gap-3", children: [
          jsxs("div", { className: "min-w-0", children: [
            jsx("p", { className: "text-xs text-gray-500", children: label }),
            jsx("p", { className: "mt-2 text-2xl font-bold text-white", children: formatNumber(value, settings.numberSystem) })
          ] }),
          jsx("span", { className: "va-icon-tile flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", children: jsx(Icon, { className: "h-5 w-5" }) })
        ] })
      ] }, label)) }),
      jsxs("section", { className: "va-filter-surface rounded-2xl va-surface-muted border p-4", children: [
        jsxs("div", { className: "grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]", children: [
          jsxs("label", { className: "relative block", children: [
            jsx(Search, { className: "pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" }),
            jsx("input", { value: query, onChange: (event) => setQuery(event.target.value), placeholder: "بحث بالاسم أو اسم المستخدم...", className: "input input-bordered min-h-11 w-full va-surface-deep rounded-xl border py-2 pl-3 pr-10 text-sm text-white outline-none transition-colors placeholder:text-gray-600 focus:border-emerald-500/40" })
          ] }),
          jsxs("select", { value: roleFilter, onChange: (event) => setRoleFilter(event.target.value), className: "select select-bordered min-h-11 va-surface-deep rounded-xl border px-3 text-sm text-white outline-none", children: [
            jsx("option", { value: "all", children: "كل الأدوار" }),
            ...USER_ROLES.map((role) => jsx("option", { value: role.id, children: role.label }, role.id))
          ] })
        ] }),
        jsxs("div", { role: "group", "aria-label": "تصفية حسب الدور", className: "mt-4 flex flex-wrap gap-2", children: [
          jsxs("button", { type: "button", onClick: () => setRoleFilter("all"), className: `btn btn-sm rounded-xl border px-3 py-2 text-sm gap-2 inline-flex items-center ${roleFilter === "all" ? "va-accent-border va-accent-bg-soft va-accent-text-on-soft" : "border-white/10 bg-gray-950/35 text-gray-400 hover:bg-white/5"}`, children: [
            "كل الأدوار",
            jsx("span", { className: "badge badge-sm rounded-full bg-black/20 px-2 py-0.5 text-xs", children: formatNumber(summary.total) })
          ] }),
          ...USER_ROLES.map((role) => jsxs("button", { type: "button", onClick: () => setRoleFilter(role.id), className: `btn btn-sm rounded-xl border px-3 py-2 text-sm gap-2 inline-flex items-center ${roleFilter === role.id ? "text-white" : "border-white/10 bg-gray-950/35 text-gray-400 hover:bg-white/5"}`, style: roleFilter === role.id ? { borderColor: `${role.color}55`, backgroundColor: `${role.color}18` } : undefined, children: [
            jsx("span", { className: "inline-block h-2.5 w-2.5 rounded-full", style: { backgroundColor: role.color } }),
            role.label,
            jsx("span", { className: "badge badge-sm rounded-full bg-black/20 px-2 py-0.5 text-xs", children: formatNumber(summary.byRole[role.id] || 0) })
          ] }, role.id))
        ] })
      ] }),
      filteredUsers.length ? jsx("section", { className: "grid gap-3 lg:grid-cols-2", children: filteredUsers.map((user, index) => jsx(UserCard, {
        user,
        users,
        currentUser,
        index,
        recentOpsCount: recentOpsByUserId.get(user.id) || 0,
        onEdit: () => { setEditingUser(user); setShowForm(true); },
        onToggle: () => toggleUser(user),
        onDelete: () => disableUser(user)
      }, user.id)) }) : jsx("section", { className: "rounded-2xl border border-dashed border-white/10 bg-gray-900/35", children: jsx(EmptyState, {
        icon: jsx(Users, { className: "h-16 w-16" }),
        title: users.length ? "لا توجد نتائج مطابقة" : "لا يوجد مستخدمون بعد",
        description: users.length ? "خفف البحث أو اختر كل الأدوار." : "أنشئ مستخدمًا جديدًا وحدد دوره الأولي."
      }) })
    ]
  });
}

UsersPage.pageId = "users";
UsersPage.migrationStatus = "native";

export default UsersPage;

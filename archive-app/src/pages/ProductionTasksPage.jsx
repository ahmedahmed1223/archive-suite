import * as React from "react";
import { jsx, jsxs } from "react/jsx-runtime";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  ClipboardList,
  Clapperboard,
  Link2,
  Plus,
  Trash2,
  UserRound
} from "lucide-react";

import { PageHero } from "../components/ui/V1Primitives.jsx";
import { EmptyState } from "../components/common/EmptyState.jsx";
import { useAppStore } from "../stores/index.js";
import { formatDateTime, formatNumber } from "../utils/formatting.js";
import {
  addProjectTask,
  getProjectDuration,
  getProjectTasksByStatus,
  moveProjectTask,
  PROJECT_TASK_STATUSES,
  removeProjectTask
} from "../features/projects/viewModel.js";

const TASK_META = {
  todo: { label: "للعمل", tone: "border-sky-500/20 bg-sky-500/10 text-sky-100" },
  doing: { label: "قيد التنفيذ", tone: "border-amber-500/20 bg-amber-500/10 text-amber-100" },
  review: { label: "مراجعة", tone: "border-violet-500/20 bg-violet-500/10 text-violet-100" },
  done: { label: "منجز", tone: "va-accent-border va-accent-bg-soft va-accent-text-on-soft" }
};

function formatClock(totalSeconds) {
  const s = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const p2 = (n) => String(n).padStart(2, "0");
  return hh > 0 ? `${hh}:${p2(mm)}:${p2(ss)}` : `${mm}:${p2(ss)}`;
}

function itemLabel(item) {
  return (item?.title || "").trim() || item?.path || item?.id || "عنصر";
}

function projectLabel(project) {
  return project?.name || "مشروع بدون اسم";
}

function TaskBuilder({ projects, items, users, activeProjectId, onProjectChange, onAdd }) {
  const [title, setTitle] = React.useState("");
  const [status, setStatus] = React.useState("todo");
  const [itemId, setItemId] = React.useState("");
  const [assigneeId, setAssigneeId] = React.useState("");
  const titleId = React.useId();
  const projectId = React.useId();
  const itemIdField = React.useId();
  const assigneeIdField = React.useId();

  const submit = () => {
    const clean = title.trim();
    if (!clean || !activeProjectId) return;
    onAdd?.({ title: clean, status, itemId, assigneeId });
    setTitle("");
    setItemId("");
  };

  return jsxs("section", {
    className: "rounded-2xl border border-[var(--va-border-soft)] bg-[var(--va-surface)] p-4",
    children: [
      jsxs("div", { className: "mb-3 flex items-center justify-between gap-2", children: [
        jsxs("h2", { className: "flex items-center gap-2 text-sm font-semibold text-[var(--va-text)]", children: [jsx(ClipboardList, { className: "h-4 w-4 va-accent-text" }), "إضافة مهمة إنتاج"] }),
        activeProjectId && jsx("span", { className: "rounded-full border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] px-2 py-0.5 text-xs text-[var(--va-text-2)]", children: projectLabel(projects.find((project) => project.id === activeProjectId)) })
      ] }),
      jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [
        jsxs("label", { className: "space-y-1 text-sm text-[var(--va-text-2)] sm:col-span-2", htmlFor: projectId, children: [
          jsx("span", { children: "المشروع" }),
          jsx("select", {
            id: projectId,
            value: activeProjectId || "",
            onChange: (event) => onProjectChange?.(event.target.value),
            className: "select select-bordered w-full",
            children: projects.map((project) => jsx("option", { value: project.id, children: projectLabel(project) }, project.id))
          })
        ] }),
        jsxs("label", { className: "space-y-1 text-sm text-[var(--va-text-2)] sm:col-span-2", htmlFor: titleId, children: [
          jsx("span", { children: "عنوان المهمة" }),
          jsx("input", { id: titleId, value: title, onChange: (event) => setTitle(event.target.value), placeholder: "مثال: مراجعة لقطة الافتتاح", className: "input input-bordered w-full" })
        ] }),
        jsxs("label", { className: "space-y-1 text-sm text-[var(--va-text-2)]", children: [
          jsx("span", { children: "الحالة" }),
          jsx("select", { value: status, onChange: (event) => setStatus(event.target.value), className: "select select-bordered w-full", children: PROJECT_TASK_STATUSES.map((key) => jsx("option", { value: key, children: TASK_META[key].label }, key)) })
        ] }),
        jsxs("label", { className: "space-y-1 text-sm text-[var(--va-text-2)]", htmlFor: itemIdField, children: [
          jsx("span", { children: "مادة مرتبطة" }),
          jsxs("select", { id: itemIdField, value: itemId, onChange: (event) => setItemId(event.target.value), className: "select select-bordered w-full", children: [
            jsx("option", { value: "", children: "بدون ربط" }),
            ...items.slice(0, 500).map((item) => jsx("option", { value: item.id, children: itemLabel(item) }, item.id))
          ] })
        ] }),
        jsxs("label", { className: "space-y-1 text-sm text-[var(--va-text-2)] sm:col-span-2", htmlFor: assigneeIdField, children: [
          jsx("span", { children: "المسؤول" }),
          jsxs("select", { id: assigneeIdField, value: assigneeId, onChange: (event) => setAssigneeId(event.target.value), className: "select select-bordered w-full", children: [
            jsx("option", { value: "", children: "غير مسندة" }),
            ...users.filter((user) => user.isActive !== false).map((user) => jsx("option", { value: user.id, children: user.displayName || user.username || user.id }, user.id))
          ] })
        ] })
      ] }),
      jsx("div", { className: "mt-3 flex justify-end", children: jsxs("button", {
        type: "button",
        onClick: submit,
        disabled: !activeProjectId || !title.trim(),
        className: "btn btn-primary gap-2",
        children: [jsx(Plus, { className: "h-4 w-4" }), "إضافة للوحة"]
      }) })
    ]
  });
}

function ProjectPicker({ projects, selectedId, onSelect }) {
  return jsx("section", {
    className: "grid gap-3 lg:grid-cols-3",
    children: projects.map((project) => {
      const active = project.id === selectedId;
      const openTasks = (project.tasks || []).filter((task) => task.status !== "done").length;
      return jsxs("button", {
        type: "button",
        onClick: () => onSelect(project.id),
        className: `rounded-2xl border p-4 text-right transition-colors ${active ? "va-accent-border va-accent-bg-soft" : "border-[var(--va-border-soft)] bg-[var(--va-surface)] hover:border-[var(--va-border-strong)]"}`,
        children: [
          jsxs("div", { className: "flex items-start justify-between gap-3", children: [
            jsxs("div", { className: "min-w-0", children: [
              jsx("p", { className: "truncate text-sm font-bold text-[var(--va-text)]", children: projectLabel(project) }),
              project.updatedAt && jsx("p", { className: "mt-1 text-xs text-[var(--va-text-muted)]", children: formatDateTime(project.updatedAt) })
            ] }),
            jsx(Clapperboard, { className: "h-5 w-5 shrink-0 va-accent-text" })
          ] }),
          jsxs("div", { className: "mt-3 grid grid-cols-3 gap-2 text-xs", children: [
            jsxs("span", { className: "rounded-lg border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] p-2", children: [jsx("b", { className: "block text-[var(--va-text)]", children: formatNumber(project.tasks?.length || 0) }), jsx("span", { className: "text-[var(--va-text-muted)]", children: "مهام" })] }),
            jsxs("span", { className: openTasks ? "rounded-lg border border-amber-500/20 bg-amber-500/10 p-2" : "rounded-lg border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] p-2", children: [jsx("b", { className: openTasks ? "block text-amber-200" : "block text-[var(--va-text)]", children: formatNumber(openTasks) }), jsx("span", { className: "text-[var(--va-text-muted)]", children: "مفتوحة" })] }),
            jsxs("span", { className: "rounded-lg border border-[var(--va-border-soft)] bg-[var(--va-surface-2)] p-2", children: [jsx("b", { className: "block text-[var(--va-text)]", children: formatClock(getProjectDuration(project)) }), jsx("span", { className: "text-[var(--va-text-muted)]", children: "مدة" })] })
          ] })
        ]
      }, project.id);
    })
  });
}

function TaskBoard({ project, itemsById, usersById, onMoveTask, onRemoveTask }) {
  const grouped = getProjectTasksByStatus(project);
  return jsx("section", {
    className: "grid gap-3 xl:grid-cols-4",
    "aria-label": "لوحة مهام الإنتاج",
    children: PROJECT_TASK_STATUSES.map((status) => {
      const meta = TASK_META[status];
      const tasks = grouped[status] || [];
      return jsxs("div", {
        className: "min-h-48 rounded-2xl border border-[var(--va-border-soft)] bg-[var(--va-surface)] p-3",
        children: [
          jsxs("header", { className: "mb-3 flex items-center justify-between gap-2", children: [
            jsx("h2", { className: `rounded-full border px-2 py-1 text-xs ${meta.tone}`, children: meta.label }),
            jsx("span", { className: "rounded-full bg-[var(--va-surface-2)] px-2 py-0.5 text-xs text-[var(--va-text-2)]", children: formatNumber(tasks.length) })
          ] }),
          tasks.length ? jsx("div", {
            className: "space-y-2",
            children: tasks.map((task) => {
              const linked = task.itemId ? itemsById.get(task.itemId) : null;
              const assignee = task.assigneeId ? usersById.get(task.assigneeId) : null;
              return jsxs("article", {
                className: "rounded-xl border border-[var(--va-border-soft)] bg-[var(--va-elevated)] p-3",
                children: [
                  jsxs("div", { className: "flex items-start justify-between gap-2", children: [
                    jsxs("div", { className: "min-w-0", children: [
                      jsx("p", { className: "text-sm font-semibold text-[var(--va-text)]", children: task.title }),
                      linked && jsxs("p", { className: "mt-1 flex items-center gap-1.5 truncate text-xs text-[var(--va-text-muted)]", children: [jsx(Link2, { className: "h-3.5 w-3.5" }), itemLabel(linked)] }),
                      assignee && jsxs("p", { className: "mt-1 flex items-center gap-1.5 truncate text-xs text-[var(--va-text-muted)]", children: [jsx(UserRound, { className: "h-3.5 w-3.5" }), assignee.displayName || assignee.username || assignee.id] })
                    ] }),
                    jsx("button", { type: "button", onClick: () => onRemoveTask(task.id), "aria-label": "حذف المهمة", className: "shrink-0 rounded-lg p-1.5 text-[var(--va-text-muted)] hover:bg-red-500/10 hover:text-red-300", children: jsx(Trash2, { className: "h-4 w-4" }) })
                  ] }),
                  jsx("select", { value: task.status, onChange: (event) => onMoveTask(task.id, event.target.value), className: "select select-bordered mt-3 w-full", children: PROJECT_TASK_STATUSES.map((key) => jsx("option", { value: key, children: TASK_META[key].label }, key)) })
                ]
              }, task.id);
            })
          }) : jsx("p", { className: "rounded-xl border border-dashed border-[var(--va-border-soft)] p-4 text-center text-xs text-[var(--va-text-muted)]", children: "لا توجد مهام" })
        ]
      }, status);
    })
  });
}

export function ProductionTasksPage() {
  const {
    projects = [],
    videoItems = [],
    users = [],
    updateProject,
    showToast,
    showNotification
  } = useAppStore();
  const activeProjects = React.useMemo(() => projects.filter((project) => project.status !== "archived"), [projects]);
  const activeItems = React.useMemo(() => videoItems.filter((item) => !item.isDeleted), [videoItems]);
  const itemsById = React.useMemo(() => new Map(activeItems.map((item) => [item.id, item])), [activeItems]);
  const usersById = React.useMemo(() => new Map((users || []).map((user) => [user.id, user])), [users]);
  const [selectedProjectId, setSelectedProjectId] = React.useState(activeProjects[0]?.id || "");
  const selectedProject = activeProjects.find((project) => project.id === selectedProjectId) || activeProjects[0] || null;

  React.useEffect(() => {
    if (selectedProjectId && activeProjects.some((project) => project.id === selectedProjectId)) return;
    setSelectedProjectId(activeProjects[0]?.id || "");
  }, [activeProjects, selectedProjectId]);

  const persist = async (next) => {
    try {
      await updateProject?.(next);
    } catch (error) {
      showToast?.(error?.message || "تعذّر حفظ مهام الإنتاج.", "error");
    }
  };

  const addTask = (taskPartial) => {
    if (!selectedProject) return;
    persist(addProjectTask(selectedProject, taskPartial));
    const assignee = usersById.get(taskPartial.assigneeId);
    showNotification?.(assignee ? `أُضيفت مهمة مسندة إلى ${assignee.displayName || assignee.username || "مستخدم"}.` : "أُضيفت مهمة إلى لوحة الإنتاج.", {
      type: "success",
      category: "task",
      title: "مهمة إنتاج جديدة",
      targetLabel: selectedProject.name || "مشروع"
    });
  };

  const moveTask = (taskId, status) => {
    if (!selectedProject) return;
    persist(moveProjectTask(selectedProject, taskId, status));
  };

  const removeTask = (taskId) => {
    if (!selectedProject) return;
    persist(removeProjectTask(selectedProject, taskId));
  };

  const totalTasks = activeProjects.reduce((sum, project) => sum + (project.tasks?.length || 0), 0);
  const openTasks = activeProjects.reduce((sum, project) => sum + (project.tasks || []).filter((task) => task.status !== "done").length, 0);
  const reviewTasks = activeProjects.reduce((sum, project) => sum + (project.tasks || []).filter((task) => task.status === "review").length, 0);
  const doneTasks = activeProjects.reduce((sum, project) => sum + (project.tasks || []).filter((task) => task.status === "done").length, 0);

  return jsxs(motion.div, {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.2 },
    className: "va-page-shell space-y-6 p-4 sm:p-6",
    dir: "rtl",
    children: [
      jsx(PageHero, {
        icon: jsx(ClipboardList, { className: "h-6 w-6 va-accent-text" }),
        title: "مهام الإنتاج",
        description: "قسم مستقل لإدارة مهام مشاريع المونتاج، المسؤولين، المواد المرتبطة، وحالات المراجعة بدون ازدحام صفحة الخط الزمني."
      }),
      activeProjects.length === 0 ? jsx(EmptyState, {
        icon: jsx(Clapperboard, { className: "h-16 w-16" }),
        title: "لا توجد مشاريع إنتاج",
        description: "أنشئ مشروع مونتاج أولًا، ثم ارجع هنا لإدارة المهام المرتبطة به."
      }) : jsxs(React.Fragment, {
        children: [
          jsxs("section", { className: "grid gap-3 sm:grid-cols-4", children: [
            jsxs("div", { className: "rounded-2xl border border-[var(--va-border-soft)] bg-[var(--va-surface)] p-4", children: [jsx("p", { className: "text-sm text-[var(--va-text-muted)]", children: "كل المهام" }), jsx("p", { className: "mt-2 text-2xl font-bold text-[var(--va-text)]", children: formatNumber(totalTasks) })] }),
            jsxs("div", { className: "rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4", children: [jsx("p", { className: "text-sm text-amber-100/80", children: "مفتوحة" }), jsx("p", { className: "mt-2 text-2xl font-bold text-amber-100", children: formatNumber(openTasks) })] }),
            jsxs("div", { className: "rounded-2xl border border-violet-500/20 bg-violet-500/10 p-4", children: [jsx("p", { className: "text-sm text-violet-100/80", children: "في المراجعة" }), jsx("p", { className: "mt-2 text-2xl font-bold text-violet-100", children: formatNumber(reviewTasks) })] }),
            jsxs("div", { className: "rounded-2xl border va-accent-border va-accent-bg-soft p-4", children: [jsxs("p", { className: "flex items-center gap-2 text-sm va-accent-text-on-soft", children: [jsx(CheckCircle2, { className: "h-4 w-4" }), "منجزة"] }), jsx("p", { className: "mt-2 text-2xl font-bold va-accent-text-on-soft", children: formatNumber(doneTasks) })] })
          ] }),
          jsx(ProjectPicker, { projects: activeProjects, selectedId: selectedProject?.id, onSelect: setSelectedProjectId }),
          jsxs("div", { className: "grid gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]", children: [
            jsx(TaskBuilder, {
              projects: activeProjects,
              items: activeItems,
              users,
              activeProjectId: selectedProject?.id || "",
              onProjectChange: setSelectedProjectId,
              onAdd: addTask
            }),
            selectedProject ? jsx(TaskBoard, {
              project: selectedProject,
              itemsById,
              usersById,
              onMoveTask: moveTask,
              onRemoveTask: removeTask
            }) : null
          ] })
        ]
      })
    ]
  });
}

ProductionTasksPage.pageId = "production-tasks";
ProductionTasksPage.migrationStatus = "native";

export default ProductionTasksPage;

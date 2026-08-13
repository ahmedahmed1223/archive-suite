// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";

const projects = vi.fn();
const projectTasks = vi.fn();
const createProjectTask = vi.fn();
const updateProjectTask = vi.fn();

vi.mock("@/lib/archive-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/archive-api")>("@/lib/archive-api");
  return { ...actual, createArchiveApiClient: () => ({ projects, projectTasks, createProjectTask, updateProjectTask }) };
});
vi.mock("@/components/AppShell", () => ({ default: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/PageToolbar", () => ({ default: ({ title, description }: { title: string; description: string }) => <header><h1>{title}</h1><p>{description}</p></header> }));
vi.mock("@/components/EmptyState", () => ({ default: ({ title }: { title: string }) => <p>{title}</p> }));

import ProjectTasksPage from "./page";

function renderPage() {
  return render(
    <LocaleProvider initialLocale="ar" hasLocaleCookie={false}>
      <ProjectTasksPage />
    </LocaleProvider>
  );
}

afterEach(cleanup);
beforeEach(() => {
  projects.mockResolvedValue({ ok: true, projects: [{ id: "project-1", name: "وثائقي", notes: null, sortOrder: 0, createdAt: "2026-01-01", updatedAt: "2026-01-01" }] });
  projectTasks.mockResolvedValue({ ok: true, tasks: [] });
  createProjectTask.mockReset();
  updateProjectTask.mockReset();

  const values = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      get length() {
        return values.size;
      },
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      key: (index: number) => [...values.keys()][index] ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    } satisfies Storage,
  });
});

test("creates a project task with its optional due date", async () => {
  createProjectTask.mockResolvedValue({ ok: true, task: { id: "task-1", projectId: "project-1", title: "مراجعة", status: "todo", assignee: null, recordId: null, dueDate: "2026-08-15", createdAt: "2026-01-01", updatedAt: "2026-01-01" } });
  renderPage();
  await screen.findByRole("option", { name: "وثائقي" });

  fireEvent.change(screen.getByLabelText("المشروع"), { target: { value: "project-1" } });
  fireEvent.change(screen.getByLabelText("المهمة"), { target: { value: "مراجعة" } });
  fireEvent.change(screen.getByLabelText("تاريخ الاستحقاق"), { target: { value: "2026-08-15" } });
  fireEvent.click(screen.getByRole("button", { name: "إضافة مهمة" }));

  await waitFor(() => expect(createProjectTask).toHaveBeenCalledWith(expect.objectContaining({ projectId: "project-1", dueDate: "2026-08-15" })));
  expect(await screen.findByText(/الاستحقاق:/)).toBeTruthy();
});

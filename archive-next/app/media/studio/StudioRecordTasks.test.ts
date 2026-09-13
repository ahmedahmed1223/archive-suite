import { describe, expect, test } from "vitest";
import type { ProjectTask } from "@/lib/archive-api";
import { tasksForRecord } from "./StudioRecordTasks";

const task = (overrides: Partial<ProjectTask>): ProjectTask => ({
  id: "task-1",
  projectId: "project-1",
  title: "مراجعة النسخة البديلة",
  status: "todo",
  assignee: null,
  recordId: "record-1",
  dueDate: null,
  createdAt: "2026-09-01T10:00:00Z",
  updatedAt: "2026-09-01T10:00:00Z",
  ...overrides
});

describe("tasksForRecord", () => {
  test("keeps only tasks linked to the selected record and prioritizes incomplete work", () => {
    const result = tasksForRecord("record-1", [
      task({ id: "done", title: "فحص سابق", status: "done", dueDate: "2026-09-01" }),
      task({ id: "review", title: "اعتماد النتيجة", status: "review", dueDate: "2026-09-03" }),
      task({ id: "other", recordId: "record-2", title: "مهمة مادة أخرى", dueDate: "2026-09-01" }),
      task({ id: "active", title: "فحص جودة", status: "in_progress", dueDate: "2026-09-02" }),
      task({ id: "unscheduled", title: "توصيف", status: "todo", dueDate: null })
    ]);

    expect(result.map((item) => item.id)).toEqual(["active", "review", "unscheduled", "done"]);
  });

  test("returns no task when there is no record context", () => {
    expect(tasksForRecord("", [task({})])).toEqual([]);
  });
});

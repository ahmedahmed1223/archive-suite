// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import type { WorkInboxCounts, WorkInboxItem } from "@/lib/archive-api";

const workInbox = vi.fn();
let contextRecordingEnabled = true;

vi.mock("@/lib/archive-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/archive-api")>("@/lib/archive-api");
  return { ...actual, createArchiveApiClient: () => ({ workInbox }) };
});
vi.mock("@/components/AppShell", () => ({ default: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock("@/components/PageToolbar", () => ({
  default: ({ title, description, children }: { title: string; description: string; children?: ReactNode }) => (
    <header><h1>{title}</h1><p>{description}</p>{children}</header>
  ),
}));
vi.mock("@/components/EmptyState", () => ({ default: ({ title }: { title: string }) => <p>{title}</p> }));
vi.mock("@/lib/auth-session", () => ({ useAuthSession: () => ({ user: { id: "user-1" }, status: "authenticated" }) }));
vi.mock("@/lib/personal-context", () => ({ isContextRecordingEnabled: () => contextRecordingEnabled }));

import WorkInboxPage from "./page";

function renderPage() {
  return render(
    <LocaleProvider initialLocale="en" hasLocaleCookie={false}>
      <WorkInboxPage />
    </LocaleProvider>
  );
}

function makeItem(overrides: Partial<WorkInboxItem> = {}): WorkInboxItem {
  return {
    id: "task:1",
    type: "task",
    title: "Caption the segment",
    status: "todo",
    dueAt: null,
    createdAt: "2026-08-01T00:00:00Z",
    href: "/project-tasks?projectId=project-1",
    ...overrides,
  };
}

function makeCounts(overrides: Partial<WorkInboxCounts> = {}): WorkInboxCounts {
  return { task: 0, review: 0, rights: 0, notification: 0, processing: 0, export: 0, ...overrides };
}

afterEach(cleanup);
beforeEach(() => {
  workInbox.mockReset();
  contextRecordingEnabled = true;
  window.localStorage.clear();
});

test("renders aggregated items with their source-type badge and links back to the real record", async () => {
  workInbox.mockResolvedValue({
    ok: true,
    items: [makeItem(), makeItem({ id: "notification:2", type: "notification", title: "Backup finished", href: "/notifications" })],
    pagination: { total: 2, page: 1, limit: 20, hasMore: false },
    counts: makeCounts({ task: 1, notification: 1 }),
  });

  renderPage();

  await screen.findByText("Caption the segment");
  expect(screen.getByText("Backup finished")).toBeTruthy();
  const link = screen.getByText("Caption the segment").closest("a");
  expect(link?.getAttribute("href")).toBe("/project-tasks?projectId=project-1");
});

test("filter chips narrow the list to a single source type without re-fetching", async () => {
  workInbox.mockResolvedValue({
    ok: true,
    items: [
      makeItem({ id: "task:1", title: "A task" }),
      makeItem({ id: "notification:2", type: "notification", title: "A notification", href: "/notifications" }),
    ],
    pagination: { total: 2, page: 1, limit: 20, hasMore: false },
    counts: makeCounts({ task: 1, notification: 1 }),
  });

  renderPage();
  await screen.findByText("A task");

  fireEvent.click(screen.getByRole("button", { name: /Tasks/ }));

  expect(screen.getByText("A task")).toBeTruthy();
  expect(screen.queryByText("A notification")).toBeNull();
  expect(workInbox).toHaveBeenCalledTimes(1);
});

test("shows the empty state when there is nothing pending", async () => {
  workInbox.mockResolvedValue({ ok: true, items: [], pagination: { total: 0, page: 1, limit: 20, hasMore: false }, counts: makeCounts() });

  renderPage();

  expect(await screen.findByText("Nothing here right now.")).toBeTruthy();
});

test("load more appends the next page and stays on the current filter", async () => {
  workInbox.mockResolvedValueOnce({
    ok: true,
    items: [makeItem({ id: "task:1", title: "First task" })],
    pagination: { total: 2, page: 1, limit: 1, hasMore: true },
    counts: makeCounts({ task: 2 }),
  });

  renderPage();
  await screen.findByText("First task");

  workInbox.mockResolvedValueOnce({
    ok: true,
    items: [makeItem({ id: "task:2", title: "Second task" })],
    pagination: { total: 2, page: 2, limit: 1, hasMore: false },
    counts: makeCounts({ task: 2 }),
  });

  fireEvent.click(screen.getByRole("button", { name: "Load more" }));

  await waitFor(() => expect(screen.getByText("Second task")).toBeTruthy());
  expect(screen.getByText("First task")).toBeTruthy();
  expect(workInbox).toHaveBeenCalledTimes(2);
  expect(workInbox).toHaveBeenLastCalledWith({ page: 2, limit: 20 });
});

test("shows an error state with a retry action when the request fails", async () => {
  workInbox.mockResolvedValue({ ok: false, error: "network down" });

  renderPage();

  expect(await screen.findByText("Unable to load the work inbox")).toBeTruthy();
  expect(screen.getByText("network down")).toBeTruthy();
});

test("restores and persists the user-scoped inbox source filter without another fetch", async () => {
  window.localStorage.setItem("masar.workspace-preferences:user-1", JSON.stringify({
    version: 3,
    routes: { "/work-inbox": { filters: { source: "review" } } },
  }));
  workInbox.mockResolvedValue({
    ok: true,
    items: [makeItem({ id: "task:1", title: "Task" }), makeItem({ id: "review:1", type: "review", title: "Review" })],
    pagination: { total: 2, page: 1, limit: 20, hasMore: false },
    counts: makeCounts({ task: 1, review: 1 }),
  });

  renderPage();

  expect(await screen.findByRole("heading", { name: "Review", level: 3 })).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Task", level: 3 })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /Tasks/ }));
  await screen.findByRole("heading", { name: "Task", level: 3 });

  expect(workInbox).toHaveBeenCalledTimes(1);
  const saved = JSON.parse(window.localStorage.getItem("masar.workspace-preferences:user-1") || "{}");
  expect(saved.routes["/work-inbox"].filters.source).toBe("task");
});

test("does not restore or retain the inbox filter when personal-context recording is disabled", async () => {
  contextRecordingEnabled = false;
  window.localStorage.setItem("masar.workspace-preferences:user-1", JSON.stringify({
    version: 3,
    routes: { "/work-inbox": { filters: { source: "review" } } },
  }));
  workInbox.mockResolvedValue({
    ok: true,
    items: [makeItem({ id: "task:1", title: "Task" }), makeItem({ id: "review:1", type: "review", title: "Review" })],
    pagination: { total: 2, page: 1, limit: 20, hasMore: false },
    counts: makeCounts({ task: 1, review: 1 }),
  });

  renderPage();

  await screen.findByRole("heading", { name: "Task", level: 3 });
  expect(screen.getByRole("heading", { name: "Review", level: 3 })).toBeTruthy();
  const saved = JSON.parse(window.localStorage.getItem("masar.workspace-preferences:user-1") || "{}");
  expect(saved.routes["/work-inbox"]?.filters).toBeUndefined();
});

test("does not migrate an unscoped inbox context while personal-context recording is disabled", async () => {
  contextRecordingEnabled = false;
  window.localStorage.setItem("masar.workspace-preferences", JSON.stringify({
    version: 2,
    routes: { "/work-inbox": { filters: { source: "review" } } },
  }));
  workInbox.mockResolvedValue({ ok: true, items: [], pagination: { total: 0, page: 1, limit: 20, hasMore: false }, counts: makeCounts() });

  renderPage();
  await screen.findByText("Nothing here right now.");

  expect(window.localStorage.getItem("masar.workspace-preferences:user-1")).toBeNull();
  expect(window.localStorage.getItem("masar.workspace-preferences")).not.toBeNull();
});

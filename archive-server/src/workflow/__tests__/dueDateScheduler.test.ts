import { describe, it, expect, vi, beforeEach } from "vitest";
import { runDueDateCheck, clearSentToday } from "../dueDateScheduler.js";

// Minimal prisma stub — sendPushToUser only needs it as a pass-through.
const prisma = { pushSubscription: {} };

interface WorkflowRecord {
  id: string;
  title: string;
  workflowStatus: string;
  workflowDueDate: string | null;
  createdBy: string;
  [key: string]: unknown;
}

function makeRecord(overrides: Partial<WorkflowRecord> = {}): WorkflowRecord {
  return {
    id: "rec-1",
    title: "Test Record",
    workflowStatus: "editing",
    workflowDueDate: null,
    createdBy: "user-abc",
    ...overrides,
  };
}

/**
 * Provider that returns `records` ONLY for `video_items` and empty for other stores.
 * This keeps notification counts predictable (1 per logical record, not 5).
 */
function makeProvider(records: WorkflowRecord[] = []) {
  return {
    getAll: vi.fn(async (store: string) => (store === "video_items" ? records : [])),
  };
}

describe("runDueDateCheck", () => {
  let pushCalls: any[];
  let sendPushToUser: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    pushCalls = [];
    sendPushToUser = vi.fn((opts) => pushCalls.push(opts));
    clearSentToday(); // reset dedup between tests
  });

  it("sends no notifications when no records have a dueDate", async () => {
    const provider = makeProvider([makeRecord()]);
    await runDueDateCheck(provider as any, prisma, sendPushToUser);
    expect(pushCalls).toHaveLength(0);
  });

  it("sends overdue notification for a record past its dueDate", async () => {
    const yesterday = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
    const provider = makeProvider([makeRecord({ workflowDueDate: yesterday })]);
    await runDueDateCheck(provider as any, prisma, sendPushToUser);
    expect(pushCalls).toHaveLength(1);
    expect(pushCalls[0].title).toContain("متأخر");
    expect(pushCalls[0].userId).toBe("user-abc");
    expect(pushCalls[0].tag).toContain("workflow-overdue");
  });

  it("sends upcoming notification for a record due within 24 h", async () => {
    const soon = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour from now
    const provider = makeProvider([makeRecord({ workflowDueDate: soon })]);
    await runDueDateCheck(provider as any, prisma, sendPushToUser);
    expect(pushCalls).toHaveLength(1);
    expect(pushCalls[0].title).toContain("استحقاق قريب");
    expect(pushCalls[0].tag).toContain("workflow-upcoming");
  });

  it("sends no notification for a record due more than 24 h from now", async () => {
    const future = new Date(Date.now() + 48 * 3_600_000).toISOString();
    const provider = makeProvider([makeRecord({ workflowDueDate: future })]);
    await runDueDateCheck(provider as any, prisma, sendPushToUser);
    expect(pushCalls).toHaveLength(0);
  });

  it("skips records in terminal states (published, archived)", async () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const provider = makeProvider([
      makeRecord({ workflowDueDate: yesterday, workflowStatus: "published" }),
      makeRecord({ id: "rec-2", workflowDueDate: yesterday, workflowStatus: "archived" }),
    ]);
    await runDueDateCheck(provider as any, prisma, sendPushToUser);
    expect(pushCalls).toHaveLength(0);
  });

  it("skips records with no owner (no createdBy or ownerId)", async () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const record = { ...makeRecord({ workflowDueDate: yesterday }), createdBy: undefined, ownerId: undefined } as Partial<WorkflowRecord>;
    const provider = makeProvider([record as WorkflowRecord]);
    await runDueDateCheck(provider as any, prisma, sendPushToUser);
    expect(pushCalls).toHaveLength(0);
  });

  it("uses ownerId as fallback when createdBy is absent", async () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const record = { ...makeRecord({ workflowDueDate: yesterday }), createdBy: undefined, ownerId: "owner-xyz" } as Partial<WorkflowRecord>;
    const provider = makeProvider([record as WorkflowRecord]);
    await runDueDateCheck(provider as any, prisma, sendPushToUser);
    expect(pushCalls).toHaveLength(1);
    expect(pushCalls[0].userId).toBe("owner-xyz");
  });

  it("skips records with invalid dueDate strings", async () => {
    const provider = makeProvider([makeRecord({ workflowDueDate: "not-a-date" as any })]);
    await runDueDateCheck(provider as any, prisma, sendPushToUser);
    expect(pushCalls).toHaveLength(0);
  });

  it("does not crash when provider.getAll throws", async () => {
    const provider = { getAll: vi.fn(async () => { throw new Error("DB error"); }) };
    await expect(runDueDateCheck(provider as any, prisma, sendPushToUser)).resolves.toBeUndefined();
    expect(pushCalls).toHaveLength(0);
  });

  it("handles null/missing provider or prisma gracefully", async () => {
    await expect(runDueDateCheck(null, prisma, sendPushToUser)).resolves.toBeUndefined();
    await expect(runDueDateCheck(makeProvider([]) as any, null, sendPushToUser)).resolves.toBeUndefined();
    expect(pushCalls).toHaveLength(0);
  });

  it("queries all five content stores", async () => {
    const provider = { getAll: vi.fn(async () => []) };
    await runDueDateCheck(provider as any, prisma, sendPushToUser);
    const queried = provider.getAll.mock.calls.map(([s]: any) => s);
    expect(queried).toEqual(
      expect.arrayContaining(["video_items", "media_items", "document_items", "audio_items", "image_items"])
    );
  });

  it("deduplicates: same record gets at most one alert per type per day", async () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const provider = makeProvider([makeRecord({ workflowDueDate: yesterday })]);
    await runDueDateCheck(provider as any, prisma, sendPushToUser);
    await runDueDateCheck(provider as any, prisma, sendPushToUser); // second run same day
    expect(pushCalls).toHaveLength(1); // only one notification despite two runs
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createInboxActions, inboxInitialState, INBOX_SORT } from "./inboxSlice.js";

vi.mock("../../services/storageAccess.js", () => ({
  STORES: { INBOX: "inbox_items" },
  dbGetAll: vi.fn(),
  dbPut: vi.fn(),
  dbDelete: vi.fn(),
  dbPutBatch: vi.fn()
}));

import * as storage from "../../services/storageAccess.js";

function makeStore(extra = {}) {
  let state = { ...inboxInitialState, ...extra };
  const get = () => state;
  const set = (patch) => {
    state = typeof patch === "function" ? { ...state, ...patch(state) } : { ...state, ...patch };
  };
  const actions = createInboxActions({ set, get });
  return { get, set, actions };
}

beforeEach(() => {
  vi.clearAllMocks();
  storage.dbGetAll.mockResolvedValue([]);
  storage.dbPut.mockResolvedValue(undefined);
  storage.dbDelete.mockResolvedValue(undefined);
  storage.dbPutBatch.mockResolvedValue(undefined);
});

describe("inboxInitialState", () => {
  it("has correct shape", () => {
    expect(inboxInitialState).toMatchObject({
      inboxItems: [],
      inboxLoading: false,
      inboxError: null,
      inboxSort: INBOX_SORT.NEWEST
    });
  });
});

describe("captureInboxItem", () => {
  it("adds item to list and persists", async () => {
    const { get, actions } = makeStore();
    const item = await actions.captureInboxItem({ title: "اختبار", url: "", tags: [] });
    expect(item).toBeTruthy();
    expect(item.title).toBe("اختبار");
    expect(get().inboxItems).toHaveLength(1);
    expect(storage.dbPut).toHaveBeenCalledOnce();
  });

  it("rejects empty title", async () => {
    const { get, actions } = makeStore();
    const item = await actions.captureInboxItem({ title: "   ", url: "", tags: [] });
    expect(item).toBeNull();
    expect(get().inboxItems).toHaveLength(0);
    expect(storage.dbPut).not.toHaveBeenCalled();
  });

  it("prepends new item so newest is first", async () => {
    const { get, actions } = makeStore();
    await actions.captureInboxItem({ title: "أول", url: "", tags: [] });
    await actions.captureInboxItem({ title: "ثاني", url: "", tags: [] });
    expect(get().inboxItems[0].title).toBe("ثاني");
  });
});

describe("dismissInboxItem", () => {
  it("removes item from list and calls dbDelete", async () => {
    const existingItem = {
      id: "abc",
      key: "inbox:abc",
      title: "قيد المراجعة",
      notes: "",
      url: "",
      tags: [],
      capturedAt: new Date().toISOString(),
      archived: false,
      archivedItemId: null
    };
    const { get, actions } = makeStore({ inboxItems: [existingItem] });
    await actions.dismissInboxItem("abc");
    expect(get().inboxItems).toHaveLength(0);
    expect(storage.dbDelete).toHaveBeenCalledOnce();
  });
});

describe("archiveInboxItem", () => {
  it("marks item archived and removes from list", async () => {
    const item = {
      id: "xyz",
      key: "inbox:xyz",
      title: "للأرشفة",
      notes: "",
      url: "",
      tags: [],
      capturedAt: new Date().toISOString(),
      archived: false,
      archivedItemId: null
    };
    const { get, actions } = makeStore({ inboxItems: [item] });
    await actions.archiveInboxItem("xyz", "archive-99");
    expect(get().inboxItems).toHaveLength(0);
    expect(storage.dbPut).toHaveBeenCalledOnce();
  });
});

describe("archiveAllInboxItems", () => {
  it("archives all items and returns count", async () => {
    const items = ["أ", "ب", "ج"].map((title, i) => ({
      id: `id${i}`,
      key: `inbox:id${i}`,
      title,
      notes: "",
      url: "",
      tags: [],
      capturedAt: new Date().toISOString(),
      archived: false,
      archivedItemId: null
    }));
    const { get, actions } = makeStore({ inboxItems: items });
    const count = await actions.archiveAllInboxItems();
    expect(count).toBe(3);
    expect(get().inboxItems).toHaveLength(0);
    expect(storage.dbPutBatch).toHaveBeenCalledOnce();
  });

  it("returns 0 when list is empty", async () => {
    const { actions } = makeStore();
    const count = await actions.archiveAllInboxItems();
    expect(count).toBe(0);
    expect(storage.dbPutBatch).not.toHaveBeenCalled();
  });
});

describe("setInboxSort", () => {
  it("changes sort to title and reorders items", () => {
    const items = ["ب", "أ", "ج"].map((title, i) => ({
      id: `id${i}`,
      key: `inbox:id${i}`,
      title,
      notes: "",
      url: "",
      tags: [],
      capturedAt: new Date(Date.now() - i * 1000).toISOString(),
      archived: false,
      archivedItemId: null
    }));
    const { get, actions } = makeStore({ inboxItems: items });
    actions.setInboxSort(INBOX_SORT.TITLE);
    expect(get().inboxSort).toBe(INBOX_SORT.TITLE);
    const titles = get().inboxItems.map((i) => i.title);
    expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b, "ar")));
  });

  it("ignores invalid sort value", () => {
    const { get, actions } = makeStore();
    actions.setInboxSort("bogus");
    expect(get().inboxSort).toBe(INBOX_SORT.NEWEST);
  });
});

describe("loadInboxFromStorage", () => {
  it("filters out archived items", async () => {
    const active = { id: "a1", key: "inbox:a1", title: "نشط", archived: false, capturedAt: new Date().toISOString() };
    const archived = { id: "a2", key: "inbox:a2", title: "مؤرشف", archived: true, capturedAt: new Date().toISOString() };
    storage.dbGetAll.mockResolvedValue([active, archived]);
    const { get, actions } = makeStore();
    await actions.loadInboxFromStorage();
    expect(get().inboxItems).toHaveLength(1);
    expect(get().inboxItems[0].id).toBe("a1");
  });
});

describe("updateInboxItem", () => {
  it("merges patch immutably", async () => {
    const item = {
      id: "upd1",
      key: "inbox:upd1",
      title: "قديم",
      notes: "",
      url: "",
      tags: [],
      capturedAt: new Date().toISOString(),
      archived: false,
      archivedItemId: null
    };
    const { get, actions } = makeStore({ inboxItems: [item] });
    await actions.updateInboxItem("upd1", { title: "جديد" });
    expect(get().inboxItems[0].title).toBe("جديد");
    expect(get().inboxItems[0].notes).toBe("");
    expect(storage.dbPut).toHaveBeenCalledOnce();
  });
});

describe("clearInboxStore", () => {
  it("resets to initial state", async () => {
    const item = {
      id: "c1",
      key: "inbox:c1",
      title: "مؤقت",
      notes: "",
      url: "",
      tags: [],
      capturedAt: new Date().toISOString(),
      archived: false,
      archivedItemId: null
    };
    const { get, actions } = makeStore({ inboxItems: [item] });
    actions.clearInboxStore();
    expect(get().inboxItems).toHaveLength(0);
    expect(get().inboxLoading).toBe(false);
  });
});

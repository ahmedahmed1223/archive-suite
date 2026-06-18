/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import { DetailPage } from "./DetailPage.jsx";
import { useAppStore } from "../stores/index.js";

vi.mock("../stores/index.js", () => ({
  useAppStore: vi.fn()
}));

vi.mock("../features/ai/useAiAssist.js", () => ({
  useAiAssist: () => ({
    available: false,
    busy: false,
    summarize: vi.fn(),
    suggestTags: vi.fn(),
    proofread: vi.fn()
  })
}));

const cloudState = vi.hoisted(() => ({
  backendChoice: { backend: "local", url: "" },
  token: ""
}));

vi.mock("../bootstrap/backendChoice.js", () => ({
  resolveBackendChoice: () => cloudState.backendChoice
}));

vi.mock("../bootstrap/cloudSession.js", () => ({
  getCloudToken: () => cloudState.token
}));

const baseItems = [
  {
    id: "item-source",
    title: "Source Video",
    type: "video",
    subtype: "interview",
    tags: ["history"],
    metadata: {},
    updatedAt: "2026-01-03T00:00:00.000Z"
  },
  {
    id: "item-related",
    title: "Transcript File",
    type: "document",
    tags: ["transcript"],
    metadata: {},
    updatedAt: "2026-01-02T00:00:00.000Z"
  },
  {
    id: "item-suggested",
    title: "Suggested Context",
    type: "video",
    subtype: "interview",
    tags: ["history"],
    metadata: {},
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "item-candidate",
    title: "Candidate Link",
    type: "document",
    tags: [],
    metadata: {},
    updatedAt: "2026-01-04T00:00:00.000Z"
  }
];

function renderDetailPage(overrides = {}, cloudOverrides = {}) {
  cloudState.backendChoice = cloudOverrides.backendChoice || { backend: "local", url: "" };
  cloudState.token = cloudOverrides.token || "";
  const state = {
    videoItems: baseItems,
    contentTypes: [],
    changeHistory: [],
    bookmarks: [],
    auditLogs: [],
    users: [],
    currentUser: { id: "user-1", role: "admin" },
    selectedItemId: "item-source",
    itemRelations: [
      {
        id: "rel-1",
        sourceId: "item-source",
        targetId: "item-related",
        type: "references",
        note: "verified transcript"
      }
    ],
    setSelectedItemId: vi.fn(),
    setCurrentPage: vi.fn(),
    updateVideoItem: vi.fn(),
    deleteVideoItem: vi.fn(),
    restoreVideoItem: vi.fn(),
    toggleFavorite: vi.fn(),
    markItemViewed: vi.fn(),
    addBookmark: vi.fn(),
    removeBookmark: vi.fn(),
    addItemComment: vi.fn(),
    deleteItemComment: vi.fn(),
    showToast: vi.fn(),
    showNotification: vi.fn(),
    loadRelationsFromStorage: vi.fn(),
    addRelation: vi.fn(),
    removeRelation: vi.fn(),
    getRelationsForItem: vi.fn((itemId) => ({
      outgoing: state.itemRelations.filter((relation) => relation.sourceId === itemId),
      incoming: state.itemRelations.filter((relation) => relation.targetId === itemId)
    })),
    ...overrides
  };
  useAppStore.mockReturnValue(state);
  return { ...render(<DetailPage />), state };
}

describe("DetailPage relations tab", () => {
  it("shows explicit relations, keeps suggestions, and wires add/remove actions", async () => {
    const { state } = renderDetailPage();

    fireEvent.click(screen.getByRole("button", { name: /العلاقات/ }));

    expect(state.loadRelationsFromStorage).toHaveBeenCalledTimes(1);
    const region = screen.getByRole("region", { name: "علاقات العنصر" });
    expect(within(region).getByText("Transcript File")).toBeInTheDocument();
    expect(within(region).getByText("verified transcript")).toBeInTheDocument();
    expect(screen.getByText("مواد قد ترتبط بهذا السياق")).toBeInTheDocument();
    expect(screen.getByText("Suggested Context")).toBeInTheDocument();
    expect(screen.getByText("اقتراحات تحسين هذا العنصر")).toBeInTheDocument();
    expect(screen.getByText("ثبّت أفضل عنصر مشابه كعلاقة")).toBeInTheDocument();
    expect(screen.getByText("أضف مصدر الملف أو رابط الوصول")).toBeInTheDocument();

    fireEvent.click(within(region).getByRole("button", { name: "إضافة علاقة" }));
    const dialog = screen.getByRole("dialog", { name: "إضافة علاقة" });
    fireEvent.click(within(dialog).getByRole("option", { name: "Candidate Link" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "إضافة علاقة" }));

    expect(state.addRelation).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceId: "item-source",
        targetId: "item-candidate"
      })
    );

    fireEvent.click(within(region).getByRole("button", { name: "حذف العلاقة مع Transcript File" }));

    expect(state.removeRelation).toHaveBeenCalledWith("rel-1");
  });

  it("renders the workflow status menu on the detail header", () => {
    renderDetailPage({
      videoItems: [
        { ...baseItems[0], workflowStatus: "review" },
        ...baseItems.slice(1)
      ]
    });

    expect(screen.getByRole("button", { name: /حالة السجل: مراجعة.*تغيير الحالة/ })).toBeInTheDocument();
  });

  it("opens item sharing from the detail header when cloud sharing is available", () => {
    renderDetailPage({}, {
      backendChoice: { backend: "postgres", url: "https://archive.example" },
      token: "jwt"
    });

    fireEvent.click(screen.getAllByRole("button", { name: "مشاركة" })[0]);

    const dialog = screen.getByRole("dialog", { name: "مشاركة مع صلاحيات" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("Source Video")).toBeInTheDocument();
  });
});

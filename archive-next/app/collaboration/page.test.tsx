// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import CollaborationPage from "./page";

const mocks = vi.hoisted(() => ({
  search: "",
  collaborationDocument: vi.fn(),
  collaborationLocks: vi.fn(),
  sendCollaborationHeartbeat: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mocks.search)
}));

vi.mock("@/components/AppShell", () => ({
  default: ({ children }: { children: ReactNode }) => <main>{children}</main>
}));

vi.mock("@/components/ui/ConfirmDialog", () => ({
  useConfirmDialog: () => ({ confirm: vi.fn() })
}));

vi.mock("@/lib/echo", () => ({ getEchoClient: () => null }));

vi.mock("@/lib/archive-api", () => ({
  createArchiveApiClient: () => ({
    collaborationDocument: mocks.collaborationDocument,
    collaborationLocks: mocks.collaborationLocks,
    sendCollaborationHeartbeat: mocks.sendCollaborationHeartbeat
  })
}));

function renderPage(search = "") {
  mocks.search = search;
  return render(
    <LocaleProvider initialLocale="en" hasLocaleCookie>
      <CollaborationPage />
    </LocaleProvider>
  );
}

describe("live collaboration resource context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.search = "";
    mocks.sendCollaborationHeartbeat.mockResolvedValue({ ok: true, participants: [], activeWindowSeconds: 45 });
    mocks.collaborationLocks.mockResolvedValue({ ok: true, locks: [] });
    mocks.collaborationDocument.mockResolvedValue({ ok: true, document: { content: "", version: 0 } });
  });

  afterEach(() => cleanup());

  test("does not load a draft before a resourceId is supplied", async () => {
    renderPage();

    await waitFor(() => expect(mocks.sendCollaborationHeartbeat).toHaveBeenCalled());
    expect(mocks.collaborationDocument).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Resource")).toHaveValue("");
  });

  test("loads the draft for the explicit resourceId query parameter", async () => {
    renderPage("resourceId=ingest%2Freel.mov");

    await waitFor(() => expect(mocks.collaborationDocument).toHaveBeenCalledWith("review-1", "ingest/reel.mov"));
    expect(screen.getByLabelText("Resource")).toHaveValue("ingest/reel.mov");
  });
});

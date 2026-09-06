// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import BroadcastSimulationPage from "./page";

const mocks = vi.hoisted(() => ({
  search: "",
  collaborationDocument: vi.fn(),
  collaborationLocks: vi.fn(),
  reviewComments: vi.fn(),
  sendCollaborationHeartbeat: vi.fn()
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mocks.search)
}));

vi.mock("@/components/AppShell", () => ({
  default: ({ children }: { children: ReactNode }) => <main>{children}</main>
}));

vi.mock("@/components/MediaPlayer", () => ({
  default: ({ path }: { path: string }) => <div data-testid="media-player">{path}</div>
}));

vi.mock("@/components/ui/ConfirmDialog", () => ({
  useConfirmDialog: () => ({ confirm: vi.fn() })
}));

vi.mock("@/lib/archive-api", () => ({
  createArchiveApiClient: () => ({
    collaborationDocument: mocks.collaborationDocument,
    collaborationLocks: mocks.collaborationLocks,
    reviewComments: mocks.reviewComments,
    sendCollaborationHeartbeat: mocks.sendCollaborationHeartbeat
  })
}));

function renderPage(search = "") {
  mocks.search = search;
  return render(
    <LocaleProvider initialLocale="en" hasLocaleCookie>
      <BroadcastSimulationPage />
    </LocaleProvider>
  );
}

describe("broadcast room media context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.search = "";
    mocks.sendCollaborationHeartbeat.mockResolvedValue({ ok: true, participants: [] });
    mocks.collaborationLocks.mockResolvedValue({ ok: true, locks: [] });
    mocks.collaborationDocument.mockResolvedValue({ ok: true, document: { content: "", version: 0 } });
    mocks.reviewComments.mockResolvedValue({ ok: true, comments: [] });
  });

  afterEach(() => cleanup());

  test("does not invent a media resource or load review data without a resourceId query parameter", async () => {
    renderPage();

    expect(await screen.findByText("Enter a media path to begin")).toBeVisible();
    await waitFor(() => expect(mocks.sendCollaborationHeartbeat).toHaveBeenCalled());
    expect(mocks.reviewComments).not.toHaveBeenCalled();
    expect(mocks.collaborationDocument).not.toHaveBeenCalled();
    expect(screen.queryByTestId("media-player")).not.toBeInTheDocument();
  });

  test("loads the review context supplied by the resourceId query parameter", async () => {
    renderPage("resourceId=ingest%2Freel.mov");

    await waitFor(() => expect(mocks.reviewComments).toHaveBeenCalledWith("ingest/reel.mov"));
    expect(screen.getByTestId("media-player")).toHaveTextContent("ingest/reel.mov");
  });
});

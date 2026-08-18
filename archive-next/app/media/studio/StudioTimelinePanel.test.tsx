// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";

const { mediaReviewComments, createMediaReviewComment, resolveMediaReviewComment, reopenMediaReviewComment, deleteMediaReviewComment } = vi.hoisted(() => ({
  mediaReviewComments: vi.fn(),
  createMediaReviewComment: vi.fn(),
  resolveMediaReviewComment: vi.fn(),
  reopenMediaReviewComment: vi.fn(),
  deleteMediaReviewComment: vi.fn()
}));
vi.mock("@/lib/archive-api", () => ({
  createArchiveApiClient: () => ({
    mediaReviewComments,
    createMediaReviewComment,
    resolveMediaReviewComment,
    reopenMediaReviewComment,
    deleteMediaReviewComment
  })
}));

// V3-MEDIA-003: no Reverb key configured in tests, so getEchoClient() returns
// null -- this exercises the "poll from the start" fallback branch exactly
// as it behaves when Echo is unconfigured/unreachable in production.
vi.mock("@/lib/echo", () => ({
  getEchoClient: vi.fn(() => null),
  onConnectionStateChange: vi.fn(() => () => {})
}));

import { getEchoClient, onConnectionStateChange } from "@/lib/echo";
import StudioTimelinePanel from "./StudioTimelinePanel";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

function renderPanel(node: ReactNode) {
  return render(<LocaleProvider initialLocale="en" hasLocaleCookie>{node}</LocaleProvider>);
}

const baseComment = {
  id: "c1",
  recordStore: "archive-items",
  recordUid: "record-1",
  attachmentId: null,
  reviewSessionId: null,
  type: "issue" as const,
  startSeconds: 12.5,
  endSeconds: null,
  body: "Audio glitch here",
  state: "open" as const,
  createdBy: null,
  resolvedBy: null,
  resolvedAt: null,
  createdAt: "2026-08-18T00:00:00Z",
  updatedAt: "2026-08-18T00:00:00Z"
};

describe("StudioTimelinePanel", () => {
  test("lists comments and jumps to the exact marker timestamp on click", async () => {
    mediaReviewComments.mockResolvedValue({ ok: true, comments: [baseComment] });
    const onSeek = vi.fn();

    renderPanel(
      <StudioTimelinePanel recordId="record-1" store="archive-items" attachmentId={null} durationSeconds={120} currentTime={0} onSeek={onSeek} />
    );

    const jumpButton = await screen.findByLabelText("Jump to this marker's timestamp");
    fireEvent.click(jumpButton);

    expect(onSeek).toHaveBeenCalledWith(12.5);
    expect(onSeek).toHaveBeenCalledTimes(1);
  });

  test("creates a point-in-time comment at the current playback position", async () => {
    mediaReviewComments.mockResolvedValue({ ok: true, comments: [] });
    createMediaReviewComment.mockResolvedValue({ ok: true, comment: { ...baseComment, id: "c2", startSeconds: 42, body: "New issue" } });

    renderPanel(
      <StudioTimelinePanel recordId="record-1" store="archive-items" attachmentId={null} durationSeconds={120} currentTime={42} onSeek={vi.fn()} />
    );

    await screen.findByText("No timeline markers yet.");

    fireEvent.change(screen.getByPlaceholderText("Describe what happens at this point…"), { target: { value: "New issue" } });
    fireEvent.click(screen.getByRole("button", { name: "Add marker" }));

    await waitFor(() =>
      expect(createMediaReviewComment).toHaveBeenCalledWith(
        "record-1",
        expect.objectContaining({ type: "issue", startSeconds: 42, body: "New issue", endSeconds: undefined })
      )
    );
    expect(await screen.findByText("New issue")).toBeTruthy();
  });

  test("resolve and reopen call the matching API action and update the badge", async () => {
    mediaReviewComments.mockResolvedValue({ ok: true, comments: [baseComment] });
    resolveMediaReviewComment.mockResolvedValue({ ok: true, comment: { ...baseComment, state: "resolved", resolvedBy: 1, resolvedAt: "2026-08-18T01:00:00Z" } });
    reopenMediaReviewComment.mockResolvedValue({ ok: true, comment: { ...baseComment, state: "open", resolvedBy: null, resolvedAt: null } });

    renderPanel(
      <StudioTimelinePanel recordId="record-1" store="archive-items" attachmentId={null} durationSeconds={120} currentTime={0} onSeek={vi.fn()} />
    );

    fireEvent.click(await screen.findByRole("button", { name: "Resolve" }));
    await waitFor(() => expect(resolveMediaReviewComment).toHaveBeenCalledWith("c1"));
    await screen.findByText("Resolved");

    fireEvent.click(await screen.findByRole("button", { name: "Reopen" }));
    await waitFor(() => expect(reopenMediaReviewComment).toHaveBeenCalledWith("c1"));
    await waitFor(() => expect(screen.queryByText("Resolved")).toBeNull());
  });

  test("falls back to polling on an interval when the realtime client is unavailable", async () => {
    vi.useFakeTimers();
    mediaReviewComments.mockResolvedValue({ ok: true, comments: [] });

    renderPanel(
      <StudioTimelinePanel recordId="record-1" store="archive-items" attachmentId={null} durationSeconds={120} currentTime={0} onSeek={vi.fn()} />
    );

    await vi.waitFor(() => expect(mediaReviewComments).toHaveBeenCalledTimes(1));

    await vi.advanceTimersByTimeAsync(8000);
    expect(mediaReviewComments.mock.calls.length).toBeGreaterThanOrEqual(2);

    await vi.advanceTimersByTimeAsync(8000);
    expect(mediaReviewComments.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  // No Reverb server is wired into this repo's e2e harness yet (nothing
  // starts `php artisan reverb:start` for scripts/verify-next-laravel-live.mjs),
  // so the live-broadcast path can't be exercised over a real socket in
  // Playwright. It is covered here instead, driving the exact Echo/Reverb
  // contract the component depends on: channel.listen(".media-review-comment.updated", ...)
  // and onConnectionStateChange(...).
  test("live path: an incoming broadcast event updates the list without a network refetch, and stops polling while connected", async () => {
    // shouldAdvanceTime keeps Testing Library's internal waitFor polling
    // working (it relies on real timer ticks) while still letting
    // advanceTimersByTimeAsync fast-forward the component's own interval.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mediaReviewComments.mockResolvedValue({ ok: true, comments: [baseComment] });

    let pushedEvent: ((payload: unknown) => void) | undefined;
    let connectionCallback: ((state: string) => void) | undefined;
    const leave = vi.fn();
    const fakeEcho = {
      private: vi.fn(() => ({
        listen: (_eventName: string, callback: (payload: unknown) => void) => {
          pushedEvent = callback;
        }
      })),
      leave
    };
    vi.mocked(getEchoClient).mockReturnValue(fakeEcho as never);
    vi.mocked(onConnectionStateChange).mockImplementation((callback) => {
      connectionCallback = callback as (state: string) => void;
      connectionCallback("connecting");
      return () => {};
    });

    renderPanel(
      <StudioTimelinePanel recordId="record-1" store="archive-items" attachmentId={null} durationSeconds={120} currentTime={0} onSeek={vi.fn()} />
    );

    await screen.findByText("Audio glitch here");
    expect(screen.getByText("Polling")).toBeTruthy();

    // Connection comes up: switches to "Live" and does one reconciling refetch.
    mediaReviewComments.mockClear();
    connectionCallback?.("connected");
    await waitFor(() => expect(screen.getByText("Live")).toBeTruthy());
    await waitFor(() => expect(mediaReviewComments).toHaveBeenCalledTimes(1));

    // A pushed "created" event is applied locally -- no extra fetch needed.
    mediaReviewComments.mockClear();
    pushedEvent?.({ action: "created", comment: { ...baseComment, id: "c9", startSeconds: 77, body: "Pushed live" }, commentId: "c9" });
    expect(await screen.findByText("Pushed live")).toBeTruthy();
    expect(mediaReviewComments).not.toHaveBeenCalled();

    // While connected, the polling timer must not be running.
    await vi.advanceTimersByTimeAsync(16000);
    expect(mediaReviewComments).not.toHaveBeenCalled();
  });
});

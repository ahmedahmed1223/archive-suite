// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";
import ReviewPage from "./page";

const mocks = vi.hoisted(() => ({
  reviewComments: vi.fn(),
  search: ""
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

vi.mock("@/components/AnnotationCanvas", () => ({
  default: () => <div data-testid="annotation-canvas" />
}));

vi.mock("@/lib/echo", () => ({
  getEchoClient: () => null
}));

vi.mock("@/lib/archive-api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/archive-api")>();
  return {
    ...original,
    createArchiveApiClient: () => ({
      reviewComments: mocks.reviewComments,
      createReviewComment: vi.fn(),
      updateReviewComment: vi.fn()
    })
  };
});

function renderReview(search = "") {
  mocks.search = search;
  return render(
    <LocaleProvider initialLocale="en" hasLocaleCookie>
      <ReviewPage />
    </LocaleProvider>
  );
}

describe("visual review context", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.search = "";
    mocks.reviewComments.mockResolvedValue({ ok: true, comments: [] });
  });

  afterEach(() => cleanup());

  test("does not request or render review controls without a mediaUid query parameter", async () => {
    renderReview();

    expect(await screen.findByText("Select media for visual review")).toBeVisible();
    expect(mocks.reviewComments).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Add comment" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("media-player")).not.toBeInTheDocument();
  });

  test("loads comments only for the mediaUid supplied in the URL", async () => {
    renderReview("mediaUid=ingest%2Freel.mov");

    await waitFor(() => expect(mocks.reviewComments).toHaveBeenCalledWith("ingest/reel.mov"));
    expect(screen.getByLabelText("Review media identifier")).toHaveValue("ingest/reel.mov");
    expect(screen.getByLabelText("Review media identifier")).toHaveAttribute("readonly");
    expect(screen.getByTestId("media-player")).toHaveTextContent("ingest/reel.mov");
  });
});

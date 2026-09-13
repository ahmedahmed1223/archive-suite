// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import ProtectedDerivativeImage from "./ProtectedDerivativeImage";

const api = vi.hoisted(() => ({ mediaDerivativeContent: vi.fn() }));

vi.mock("@/lib/archive-api", () => ({
  createArchiveApiClient: () => api,
}));

const createObjectURL = vi.fn(() => "blob:archive-thumbnail");
const revokeObjectURL = vi.fn();

beforeEach(() => {
  api.mediaDerivativeContent.mockResolvedValue({
    ok: true,
    blob: new Blob(["thumbnail"], { type: "image/jpeg" }),
  });
  Object.defineProperties(URL, {
    createObjectURL: { configurable: true, value: createObjectURL },
    revokeObjectURL: { configurable: true, value: revokeObjectURL },
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ProtectedDerivativeImage", () => {
  test("fetches a protected derivative with the session token and revokes its temporary URL", async () => {
    const view = render(
      <ProtectedDerivativeImage derivativeId="derivative-1" accessToken="session-token" alt="لقطة من الفيديو" />,
    );

    const image = await screen.findByRole("img", { name: "لقطة من الفيديو" });

    expect(image).toHaveAttribute("src", "blob:archive-thumbnail");
    expect(api.mediaDerivativeContent).toHaveBeenCalledWith("derivative-1", { accessToken: "session-token" });

    view.unmount();
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith("blob:archive-thumbnail"));
  });
});

// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import ProtectedDerivativeImage from "./ProtectedDerivativeImage";
import { LocaleProvider } from "@/lib/i18n/LocaleProvider";

const api = vi.hoisted(() => ({ mediaDerivativeContent: vi.fn() }));

// Only the client factory is faked: rightsRefusal stays real so this test
// fails if the refusal contract drifts, instead of agreeing with a local copy
// of it. The locale provider is real for the same reason -- the assertions
// below are the shipped dictionary text, not a fixture's.
vi.mock("@/lib/archive-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/archive-api")>()),
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
      <LocaleProvider initialLocale="ar" hasLocaleCookie>
        <ProtectedDerivativeImage derivativeId="derivative-1" accessToken="session-token" alt="لقطة من الفيديو" />
      </LocaleProvider>,
    );

    const image = await screen.findByRole("img", { name: "لقطة من الفيديو" });

    expect(image).toHaveAttribute("src", "blob:archive-thumbnail");
    expect(api.mediaDerivativeContent).toHaveBeenCalledWith("derivative-1", { accessToken: "session-token" });

    view.unmount();
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith("blob:archive-thumbnail"));
  });

  test("shows localized rights refusal message when media is refused by rights policy", async () => {
    api.mediaDerivativeContent.mockResolvedValueOnce({
      ok: false,
      error: "Rights refused",
      code: "http_403",
      reason: "لا توجد بيانات حقوق مسجّلة",
      decidedBy: "no_record",
    });

    render(
      <LocaleProvider initialLocale="ar" hasLocaleCookie>
        <ProtectedDerivativeImage derivativeId="derivative-1" accessToken="session-token" alt="لقطة من الفيديو" />
      </LocaleProvider>,
    );

    const status = await screen.findByRole("status");
    expect(status).toHaveAttribute("data-decided-by", "no_record");
    expect(status).toHaveTextContent("لا توجد بيانات حقوق مسجّلة لهذه المادة بعد.");
  });
});

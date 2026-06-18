/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ShareDialog } from "./ShareDialog.jsx";

function jsonResponse(body, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

describe("ShareDialog", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("mints a collection share with the selected permission", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({
      ok: true,
      result: { token: "share-token", title: "مراجعة: مجموعة", expiresAt: "2026-07-18T00:00:00.000Z" }
    }));
    globalThis.fetch = fetchImpl;
    const onShared = vi.fn();

    render(
      <ShareDialog
        scopeType="collection"
        scopeIds={["c1"]}
        label="مجموعة"
        title="مراجعة: مجموعة"
        defaultExpiryDays={30}
        baseUrl="https://api.example.test"
        getToken={() => "jwt-token"}
        onClose={() => {}}
        onShared={onShared}
      />
    );

    fireEvent.click(screen.getByLabelText("تحميل"));
    fireEvent.change(screen.getByLabelText("كلمة مرور اختيارية"), { target: { value: "client-secret" } });
    fireEvent.click(screen.getByRole("button", { name: "إنشاء الرابط" }));

    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.example.test/api/share");
    expect(init.headers.Authorization).toBe("Bearer jwt-token");
    expect(JSON.parse(init.body)).toMatchObject({
      title: "مراجعة: مجموعة",
      expiresInDays: 30,
      password: "client-secret",
      scope: {
        type: "collection",
        ids: ["c1"],
        label: "مجموعة",
        permission: "download"
      }
    });
    await waitFor(() => expect(onShared).toHaveBeenCalledWith(expect.objectContaining({
      url: expect.stringContaining("?share=share-token"),
      permission: "download"
    })));
  });
});

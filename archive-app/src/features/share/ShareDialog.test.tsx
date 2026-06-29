/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ShareDialog } from "./ShareDialog.jsx";

function jsonResponse(body: unknown, ok = true, status = 200) {
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
    const fetchImpl: any = vi.fn(async () => jsonResponse({
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

  it("lets the user revoke a freshly minted share link", async () => {
    const fetchImpl: any = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({
        ok: true,
        result: {
          token: "share-token",
          title: "مراجعة: مجموعة",
          expiresAt: "2026-07-18T00:00:00.000Z",
          jti: "share-jti"
        }
      }))
      .mockResolvedValueOnce(jsonResponse({
        ok: true,
        result: { revoked: true, jti: "share-jti" }
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

    fireEvent.click(screen.getByRole("button", { name: "إنشاء الرابط" }));

    await waitFor(() => expect(onShared).toHaveBeenCalledWith(expect.objectContaining({
      jti: "share-jti"
    })));

    fireEvent.click(screen.getByRole("button", { name: "إلغاء الرابط" }));

    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(2));
    const [url, init] = fetchImpl.mock.calls[1];
    expect(url).toBe("https://api.example.test/api/share/revoke");
    expect(init.headers.Authorization).toBe("Bearer jwt-token");
    expect(JSON.parse(init.body)).toEqual({ jti: "share-jti" });
    expect(await screen.findByText("تم إلغاء الرابط")).toBeInTheDocument();
  });

  it("sends an email invitation when a recipient email is provided", async () => {
    const fetchImpl: any = vi.fn(async () => jsonResponse({
      ok: true,
      result: {
        token: "invite-token",
        invitation: { email: "reviewer@example.test", shareJti: "invite-jti" },
        emailStatus: { sent: true }
      }
    }));
    globalThis.fetch = fetchImpl;
    const onShared = vi.fn();

    render(
      <ShareDialog
        scopeType="item"
        scopeIds="v1"
        label="مادة"
        title="مراجعة مادة"
        defaultExpiryDays={7}
        baseUrl="https://api.example.test"
        getToken={() => "jwt-token"}
        onClose={() => {}}
        onShared={onShared}
      />
    );

    fireEvent.click(screen.getByLabelText("تعليق"));
    fireEvent.change(screen.getByLabelText("بريد المستلم"), {
      target: { value: "reviewer@example.test" }
    });
    fireEvent.change(screen.getByLabelText("رسالة الدعوة"), {
      target: { value: "راجع هذه المادة" }
    });
    fireEvent.click(screen.getByRole("button", { name: "إرسال الدعوة" }));

    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.example.test/api/share/invitations");
    expect(JSON.parse(init.body)).toMatchObject({
      email: "reviewer@example.test",
      message: "راجع هذه المادة",
      title: "مراجعة مادة",
      expiresInDays: 7,
      scope: {
        type: "items",
        ids: ["v1"],
        label: "مادة",
        permission: "comment"
      }
    });
    await waitFor(() => expect(onShared).toHaveBeenCalledWith(expect.objectContaining({
      url: expect.stringContaining("?share=invite-token"),
      permission: "comment",
      jti: "invite-jti"
    })));
    expect(await screen.findByText("تم إرسال الدعوة إلى reviewer@example.test")).toBeInTheDocument();
  });
});

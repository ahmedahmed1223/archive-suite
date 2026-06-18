/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { SharedView } from "./SharedView.jsx";

describe("SharedView permissions", () => {
  it("shows the public share permission level and capabilities", async () => {
    const fetchImpl = async () => ({
      ok: true,
      json: async () => ({
        ok: true,
        result: {
          share: {
            title: "مراجعة عامة",
            permission: "download",
            capabilities: { canView: true, canComment: true, canDownload: true, canEdit: false }
          },
          scope: { label: "للمراجعة" },
          counts: { items: 1 },
          videoItems: [{ id: "v1", title: "Clip", type: "video" }],
          contentTypes: [{ id: "video", name: "فيديو" }]
        }
      })
    });

    render(<SharedView token="share-token" fetchImpl={fetchImpl} />);

    await waitFor(() => expect(screen.getByText("مراجعة عامة")).toBeInTheDocument());
    expect(screen.getByText("صلاحية: تحميل")).toBeInTheDocument();
    expect(screen.getByText("تعليق")).toBeInTheDocument();
    expect(screen.getByText("تنزيل")).toBeInTheDocument();
    expect(screen.queryByText("تعديل")).not.toBeInTheDocument();
  });

  it("prompts for a protected share password and retries with the password header", async () => {
    const fetchImpl = vi.fn(async (_url, init = {}) => {
      if (init.headers?.["x-share-password"] !== "secret") {
        return {
          ok: false,
          status: 401,
          json: async () => ({ ok: false, error: "كلمة مرور المشاركة مطلوبة أو غير صحيحة." })
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          result: {
            share: { title: "مشاركة محمية", permission: "view", capabilities: {}, passwordProtected: true },
            counts: { items: 1 },
            videoItems: [{ id: "v1", title: "Clip", type: "video" }],
            contentTypes: [{ id: "video", name: "فيديو" }]
          }
        })
      };
    });

    render(<SharedView token="share-token" fetchImpl={fetchImpl} />);

    await waitFor(() => expect(screen.getByText("هذه المشاركة محمية بكلمة مرور")).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText("كلمة مرور المشاركة"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "فتح المشاركة" }));

    await waitFor(() => expect(screen.getByText("مشاركة محمية")).toBeInTheDocument());
    expect(fetchImpl).toHaveBeenLastCalledWith("/api/share/share-token", {
      headers: { "x-share-password": "secret" }
    });
  });
});

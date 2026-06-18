/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

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
});

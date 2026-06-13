/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { StatusTransitionMenu } from "./StatusTransitionMenu.jsx";

describe("StatusTransitionMenu", () => {
  it("renders a plain badge (no menu) for viewers", () => {
    render(<StatusTransitionMenu item={{ id: "r1", workflowStatus: "review" }} role="viewer" />);
    expect(screen.getByText("مراجعة")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("lets an admin open the menu and post a transition", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, result: { id: "r1", status: "approved" } }),
    }));
    const onChanged = vi.fn();

    render(
      <StatusTransitionMenu
        item={{ id: "r1", workflowStatus: "review" }}
        role="admin"
        baseUrl="https://api.test"
        fetchImpl={fetchImpl}
        onChanged={onChanged}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /تغيير الحالة/ }));
    // review + admin → editing & approved
    expect(screen.getByRole("menuitem", { name: "تحرير" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "معتمد" }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledWith({ id: "r1", status: "approved" }));
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://api.test/api/workflow/transition");
    expect(JSON.parse(init.body)).toEqual({ store: "video_items", id: "r1", to: "approved" });
  });

  it("shows the server error when a transition fails", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 403,
      json: async () => ({ ok: false, error: "الانتقال غير مسموح لدورك." }),
    }));

    render(
      <StatusTransitionMenu
        item={{ id: "r1", workflowStatus: "editing" }}
        role="editor"
        fetchImpl={fetchImpl}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /تغيير الحالة/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "مراجعة" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("غير مسموح"));
  });
});

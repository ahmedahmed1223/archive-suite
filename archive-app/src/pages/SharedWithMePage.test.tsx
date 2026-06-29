/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import SharedWithMePage from "./SharedWithMePage.jsx";

describe("SharedWithMePage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("location", { origin: "https://archive.example" });
  });

  it("stores a pasted share URL and opens the public share viewer", () => {
    const openShareUrl = vi.fn();

    render(<SharedWithMePage openShareUrl={openShareUrl} />);

    fireEvent.change(screen.getByLabelText("رابط أو رمز المشاركة"), {
      target: { value: "https://archive.example/?share=share-token" }
    });
    fireEvent.click(screen.getByRole("button", { name: /فتح/ }));

    expect(openShareUrl).toHaveBeenCalledWith("https://archive.example/?share=share-token", expect.objectContaining({
      token: "share-token",
      label: "archive.example"
    }));
    expect(JSON.parse(localStorage.getItem("archive_accessed_share_links") ?? "[]")).toHaveLength(1);
    expect(screen.getByText("archive.example")).toBeInTheDocument();
  });
});

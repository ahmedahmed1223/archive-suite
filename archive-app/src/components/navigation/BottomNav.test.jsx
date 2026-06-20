// @vitest-environment jsdom
import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAppStore } from "../../stores/appStore.js";
import { BottomNav } from "./BottomNav.jsx";

describe("BottomNav", () => {
  beforeEach(() => {
    useAppStore.setState({
      currentPage: "dashboard",
      inboxItems: [],
      notifications: [],
      setSidebarOpen: vi.fn(),
      setSelectedItemId: vi.fn(),
      setCurrentPage: vi.fn()
    });
  });

  it("is the single quick navigation and exposes More for the full drawer", () => {
    render(<BottomNav />);
    expect(screen.getAllByRole("navigation", { name: "التنقل السريع" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "المزيد" }));
    expect(useAppStore.getState().setSidebarOpen).toHaveBeenCalledWith(true);
  });
});

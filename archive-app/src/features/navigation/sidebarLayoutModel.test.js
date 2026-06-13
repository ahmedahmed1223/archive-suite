import { describe, expect, it } from "vitest";
import { resolveSidebarResponsiveState } from "./sidebarLayoutModel.js";

describe("resolveSidebarResponsiveState", () => {
  it("keeps the mobile drawer state separate from desktop collapse state", () => {
    expect(resolveSidebarResponsiveState({
      isMobile: true,
      requestedOpen: true,
      persistedCollapsed: true,
      editing: false
    })).toEqual({ mode: "drawer", drawerOpen: true, collapsed: false });

    expect(resolveSidebarResponsiveState({
      isMobile: false,
      requestedOpen: true,
      persistedCollapsed: true,
      editing: false
    })).toEqual({ mode: "desktop", drawerOpen: false, collapsed: true });

    expect(resolveSidebarResponsiveState({
      isMobile: false,
      requestedOpen: false,
      persistedCollapsed: true,
      editing: true
    })).toEqual({ mode: "desktop", drawerOpen: false, collapsed: false });
  });
});

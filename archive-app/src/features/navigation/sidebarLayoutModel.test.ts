// @ts-nocheck
import { describe, expect, it } from "vitest";
import {
  normalizeSidebarLayout,
  getSidebarDrawerFrame,
  resolveSidebarLayoutMode,
  resolveSidebarResponsiveState
} from "./sidebarLayoutModel.js";

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

describe("getSidebarDrawerFrame", () => {
  it("returns a mobile-only fixed overlay shell that is interactive only when open", () => {
    const opened = getSidebarDrawerFrame({ open: true });
    const closed = getSidebarDrawerFrame({ open: false });

    expect(opened.rootClassName).toContain("md:hidden");
    expect(closed.rootClassName).toContain("pointer-events-none");
    expect(opened.rootClassName).not.toContain("pointer-events-none");
    expect(opened.sideClassName).toContain("fixed inset-0");
    expect(opened.overlayClassName).toContain("pointer-events-auto");
    expect(opened.panelClassName).toContain("start-0");
    expect(opened.panelClassName).toContain("overflow-y-auto");
  });
});

describe("normalizeSidebarLayout", () => {
  it("keeps legacy settings sidebar mode compatible with the new layout shape", () => {
    expect(normalizeSidebarLayout({ mode: "collapsed" }, ["dashboard"])).toEqual({
      version: 1,
      collapsed: true,
      items: {
        dashboard: { order: 0, hidden: false, pinned: false }
      }
    });

    expect(resolveSidebarLayoutMode({ collapsed: true })).toBe("collapsed");
    expect(resolveSidebarLayoutMode({ mode: "expanded" })).toBe("expanded");
  });

  it("prefers explicit collapsed over legacy mode when both exist", () => {
    expect(normalizeSidebarLayout({
      version: 1,
      collapsed: false,
      mode: "collapsed",
      items: {
        dashboard: { order: 2, hidden: true, pinned: true }
      }
    }, ["dashboard"])).toEqual({
      version: 1,
      collapsed: false,
      items: {
        dashboard: { order: 2, hidden: true, pinned: true }
      }
    });
  });
});

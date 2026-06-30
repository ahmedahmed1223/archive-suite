import { describe, expect, it } from "vitest";

import { getDefaultDashboardLayout, setPanelHidden } from "./dashboardLayoutModel.js";
import {
  addWidget,
  listWidgets,
  removeWidget,
  toggleWidgetVisibility
} from "./widgetGalleryModel.js";

const TITLES = { hero: "مركز التحكم", reportStrip: "المؤشرات", dailyFocus: "أولويات اليوم" };

describe("listWidgets", () => {
  it("lists all widgets from panelTitles with their visibility", () => {
    const layout = getDefaultDashboardLayout();
    const widgets = listWidgets(layout, TITLES);
    expect(widgets.map((w) => w.id)).toEqual(["hero", "reportStrip", "dailyFocus"]);
    expect(widgets.every((w) => w.visible)).toBe(true);
  });

  it("reflects hidden state from layout", () => {
    const layout = setPanelHidden(getDefaultDashboardLayout(), "reportStrip", true);
    const widgets = listWidgets(layout, TITLES);
    expect(widgets.find((w) => w.id === "reportStrip")?.visible).toBe(false);
    expect(widgets.find((w) => w.id === "hero")?.visible).toBe(true);
  });

  it("uses panelTitles label on the descriptor", () => {
    const layout = getDefaultDashboardLayout();
    const w = listWidgets(layout, TITLES).find((x) => x.id === "hero");
    expect(w?.label).toBe("مركز التحكم");
  });

  it("handles null layout gracefully", () => {
    const widgets = listWidgets(null, TITLES);
    expect(widgets.every((w) => w.visible)).toBe(true);
  });
});

describe("toggleWidgetVisibility", () => {
  it("hides a visible widget", () => {
    const layout = getDefaultDashboardLayout();
    const next = toggleWidgetVisibility(layout, "hero");
    expect(next.items.hero.hidden).toBe(true);
  });

  it("shows a hidden widget", () => {
    const layout = setPanelHidden(getDefaultDashboardLayout(), "hero", true);
    const next = toggleWidgetVisibility(layout, "hero");
    expect(next.items.hero.hidden).toBe(false);
  });

  it("does not mutate the original layout", () => {
    const layout = getDefaultDashboardLayout();
    toggleWidgetVisibility(layout, "hero");
    expect(layout.items.hero.hidden).toBe(false);
  });
});

describe("addWidget / removeWidget", () => {
  it("addWidget makes a hidden panel visible", () => {
    const layout = setPanelHidden(getDefaultDashboardLayout(), "dailyFocus", true);
    const next = addWidget(layout, "dailyFocus");
    expect(next.items.dailyFocus.hidden).toBe(false);
  });

  it("removeWidget makes a visible panel hidden", () => {
    const layout = getDefaultDashboardLayout();
    const next = removeWidget(layout, "dailyFocus");
    expect(next.items.dailyFocus.hidden).toBe(true);
  });

  it("addWidget is idempotent (already visible)", () => {
    const layout = getDefaultDashboardLayout();
    const next = addWidget(layout, "hero");
    expect(next.items.hero.hidden).toBe(false);
  });

  it("removeWidget is idempotent (already hidden)", () => {
    const layout = setPanelHidden(getDefaultDashboardLayout(), "hero", true);
    const next = removeWidget(layout, "hero");
    expect(next.items.hero.hidden).toBe(true);
  });
});

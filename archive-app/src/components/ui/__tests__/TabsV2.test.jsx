/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TabsV2 } from "../TabsV2.jsx";

function renderTabs(props = {}) {
  return render(
    <TabsV2 defaultValue="tab1" {...props}>
      <TabsV2.List>
        <TabsV2.Tab value="tab1">التبويب الأول</TabsV2.Tab>
        <TabsV2.Tab value="tab2">التبويب الثاني</TabsV2.Tab>
        <TabsV2.Tab value="tab3">التبويب الثالث</TabsV2.Tab>
      </TabsV2.List>
      <TabsV2.Panel value="tab1">محتوى التبويب 1</TabsV2.Panel>
      <TabsV2.Panel value="tab2">محتوى التبويب 2</TabsV2.Panel>
      <TabsV2.Panel value="tab3">محتوى التبويب 3</TabsV2.Panel>
    </TabsV2>
  );
}

describe("TabsV2", () => {
  it("renders tablist with correct ARIA role", () => {
    renderTabs();
    expect(screen.getByRole("tablist")).toBeInTheDocument();
  });

  it("renders all tabs with role=tab", () => {
    renderTabs();
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
  });

  it("renders panels with role=tabpanel", () => {
    renderTabs();
    const panels = screen.getAllByRole("tabpanel");
    expect(panels.length).toBeGreaterThan(0);
  });

  it("active tab has aria-selected=true", () => {
    renderTabs();
    const activeTab = screen.getByRole("tab", { name: "التبويب الأول" });
    expect(activeTab).toHaveAttribute("aria-selected", "true");
  });

  it("inactive tabs have aria-selected=false", () => {
    renderTabs();
    const tab2 = screen.getByRole("tab", { name: "التبويب الثاني" });
    expect(tab2).toHaveAttribute("aria-selected", "false");
  });

  it("shows panel content for active tab", () => {
    renderTabs();
    expect(screen.getByText("محتوى التبويب 1")).toBeVisible();
  });

  it("hides panel content for inactive tabs", () => {
    renderTabs();
    // hidden panels use the `hidden` attribute
    const panel2 = document.getElementById("panel-tab2");
    expect(panel2).toHaveAttribute("hidden");
  });

  it("switches panel on tab click", async () => {
    const user = userEvent.setup();
    renderTabs();
    await user.click(screen.getByRole("tab", { name: "التبويب الثاني" }));
    expect(screen.getByText("محتوى التبويب 2")).toBeVisible();
  });

  it("calls onChange when a tab is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderTabs({ onChange, defaultValue: "tab1" });
    await user.click(screen.getByRole("tab", { name: "التبويب الثاني" }));
    expect(onChange).toHaveBeenCalledWith("tab2");
  });

  it("navigates to next tab with ArrowRight key", async () => {
    const user = userEvent.setup();
    renderTabs();
    const firstTab = screen.getByRole("tab", { name: "التبويب الأول" });
    firstTab.focus();
    await user.keyboard("{ArrowRight}");
    const secondTab = screen.getByRole("tab", { name: "التبويب الثاني" });
    expect(secondTab).toHaveAttribute("aria-selected", "true");
  });

  it("navigates to previous tab with ArrowLeft key", async () => {
    const user = userEvent.setup();
    renderTabs({ defaultValue: "tab2" });
    const secondTab = screen.getByRole("tab", { name: "التبويب الثاني" });
    secondTab.focus();
    await user.keyboard("{ArrowLeft}");
    const firstTab = screen.getByRole("tab", { name: "التبويب الأول" });
    expect(firstTab).toHaveAttribute("aria-selected", "true");
  });

  it("wraps from last tab to first on ArrowRight", async () => {
    const user = userEvent.setup();
    renderTabs({ defaultValue: "tab3" });
    const thirdTab = screen.getByRole("tab", { name: "التبويب الثالث" });
    thirdTab.focus();
    await user.keyboard("{ArrowRight}");
    const firstTab = screen.getByRole("tab", { name: "التبويب الأول" });
    expect(firstTab).toHaveAttribute("aria-selected", "true");
  });

  it("navigates to first tab with Home key", async () => {
    const user = userEvent.setup();
    renderTabs({ defaultValue: "tab3" });
    const thirdTab = screen.getByRole("tab", { name: "التبويب الثالث" });
    thirdTab.focus();
    await user.keyboard("{Home}");
    const firstTab = screen.getByRole("tab", { name: "التبويب الأول" });
    expect(firstTab).toHaveAttribute("aria-selected", "true");
  });

  it("navigates to last tab with End key", async () => {
    const user = userEvent.setup();
    renderTabs();
    const firstTab = screen.getByRole("tab", { name: "التبويب الأول" });
    firstTab.focus();
    await user.keyboard("{End}");
    const lastTab = screen.getByRole("tab", { name: "التبويب الثالث" });
    expect(lastTab).toHaveAttribute("aria-selected", "true");
  });

  it("panel is aria-labelledby the corresponding tab id", () => {
    renderTabs();
    const panel = document.getElementById("panel-tab1");
    expect(panel).toHaveAttribute("aria-labelledby", "tab-tab1");
  });

  it("tab aria-controls matches panel id", () => {
    renderTabs();
    const tab = screen.getByRole("tab", { name: "التبويب الأول" });
    expect(tab).toHaveAttribute("aria-controls", "panel-tab1");
  });

  it("renders filled variant with correct class", () => {
    renderTabs({ variant: "filled" });
    const tablist = screen.getByRole("tablist");
    // filled variant wraps tabs in a rounded surface container
    expect(tablist.className).toMatch(/va-surface-2/);
  });
});

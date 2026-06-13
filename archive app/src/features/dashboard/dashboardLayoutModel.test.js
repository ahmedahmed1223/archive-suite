import { describe, expect, it } from "vitest";

import {
  DASHBOARD_LAYOUT_VERSION,
  resetDashboardLayout
} from "./dashboardLayoutModel.js";

describe("dashboard layout model", () => {
  it("resets to the available widgets and shows panels that were hidden", () => {
    const layout = resetDashboardLayout(["hero", "recentItems"]);

    expect(layout).toEqual({
      version: DASHBOARD_LAYOUT_VERSION,
      items: {
        hero: expect.objectContaining({ x: 0, y: 0, w: 12, hidden: false }),
        recentItems: expect.objectContaining({ x: 0, y: 10, w: 7, hidden: false })
      }
    });
    expect(Object.keys(layout.items)).toEqual(["hero", "recentItems"]);
  });
});

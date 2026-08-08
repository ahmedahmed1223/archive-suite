import { describe, expect, it } from "vitest";

import { localizePageLabel } from "./page-labels";

describe("localizePageLabel", () => {
  it("keeps Arabic labels and translates shared page titles to English", () => {
    expect(localizePageLabel("مركز الإعدادات", "ar")).toBe("مركز الإعدادات");
    expect(localizePageLabel("مركز الإعدادات", "en")).toBe("Settings center");
    expect(localizePageLabel("مركز السجلات", "en")).toBe("Records center");
    expect(localizePageLabel("المساعدة", "en")).toBe("Help");
  });
});

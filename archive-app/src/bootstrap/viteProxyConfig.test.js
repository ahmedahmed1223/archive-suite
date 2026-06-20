import { describe, expect, it } from "vitest";

import createViteConfig from "../../vite.config.js";

describe("Vite API proxy", () => {
  it("proxies API calls for cloud preview and development", () => {
    const config = createViteConfig({ mode: "cloud" });
    expect(config.server?.proxy?.["/api"]?.target).toBe("http://127.0.0.1:8787");
    expect(config.preview?.proxy?.["/api"]?.target).toBe("http://127.0.0.1:8787");
  });
});

import { describe, expect, it } from "vitest";

import createViteConfig from "../../vite.config.js";

describe("Vite API proxy", () => {
  it("proxies API calls for cloud preview and development", () => {
    const config = createViteConfig({ mode: "cloud", command: "build" });
    const serverApiProxy = config.server?.proxy?.["/api"] as { target?: string } | undefined;
    const previewApiProxy = config.preview?.proxy?.["/api"] as { target?: string } | undefined;
    expect(serverApiProxy?.target).toBe("http://127.0.0.1:8787");
    expect(previewApiProxy?.target).toBe("http://127.0.0.1:8787");
  });
});

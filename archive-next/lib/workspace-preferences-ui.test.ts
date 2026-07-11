import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const searchPageSource = readFileSync(resolve(process.cwd(), "app/search/page.tsx"), "utf8");
const positionRestorerSource = readFileSync(resolve(process.cwd(), "components/WorkspacePositionRestorer.tsx"), "utf8");

describe("search workspace preference source contract", () => {
  it("runs a restored search instead of leaving saved filters in the idle state", () => {
    expect(searchPageSource).toContain("void search(restoredQuery, restoredStore, restoredPage, restoredType, restoredTag);");
  });

  it("completes a no-URL restore attempt before persisting search preferences", () => {
    expect(searchPageSource).toContain("const hasCompletedWorkspacePreferenceRestore = useRef(false);");
    expect(searchPageSource).toContain("if (!searchParams.toString() && !hasCompletedWorkspacePreferenceRestore.current) return;");
    expect(searchPageSource).toContain("hasCompletedWorkspacePreferenceRestore.current = true;");
  });

  it("does not persist a scroll position from effect cleanup during pathname changes", () => {
    expect(positionRestorerSource).not.toContain("savePosition();\n        window.removeEventListener");
  });
});

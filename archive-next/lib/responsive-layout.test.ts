import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

const baseCss = readSource("app/styles/01-base.css");
const layoutCss = readSource("app/styles/02-layout.css");
const foundationCss = readSource("app/styles/08-foundation.css");
const componentsCss = readSource("app/styles/03-components.css");
const notificationsCss = readSource("app/notifications/notifications.css");
const statusCss = readSource("app/styles/05-status.css");
const appShell = readSource("components/AppShell.tsx");
const appHeader = readSource("components/AppHeader.tsx");
const commandBar = readSource("components/WorkspaceCommandBar.tsx");

describe("responsive RTL workspace source contract", () => {
  it("keeps the viewport and shared shell regions inline-size safe", () => {
    expect(baseCss).toMatch(/html,\s*body\s*{[^}]*overflow-x:\s*clip;/s);
    expect(baseCss).toMatch(/\.content\s*{[^}]*min-inline-size:\s*0;[^}]*max-inline-size:\s*100%;/s);
    expect(foundationCss).toMatch(/\.app-shell\s*{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);[^}]*min-inline-size:\s*0;[^}]*max-inline-size:\s*100%;/s);
    expect(layoutCss).toMatch(/\.workspace-commandbar\s*{[^}]*min-inline-size:\s*0;[^}]*max-inline-size:\s*100%;/s);
    expect(foundationCss).toMatch(/\.mobile-primary-nav\s*{[^}]*max-inline-size:\s*100%;/s);
    expect(foundationCss).toMatch(/\.app-shell\s*>\s*\*,\s*\.app-content\s*>\s*\*,\s*\.workspace-commandbar\s*>\s*\*\s*{[^}]*min-inline-size:\s*0;[^}]*max-inline-size:\s*100%;/s);
  });

  it("uses mobile-first sizing and 44px minimum interactive targets", () => {
    expect(baseCss).toMatch(/button,\s*input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\),\s*select,\s*textarea\s*{[^}]*min-block-size:\s*2\.75rem;/s);
    expect(baseCss).toMatch(/:where\(label:has\(input\[type="checkbox"\]\),\s*label:has\(input\[type="radio"\]\)\)\s*{[^}]*display:\s*inline-flex;[^}]*min-block-size:\s*2\.75rem;/s);
    expect(foundationCss).toMatch(/\.mobile-primary-nav\s+(?:a|:where\()[^{]*{[^}]*min-block-size:\s*2\.75rem;/s);
    expect(foundationCss).toMatch(/@media\s*\(min-width:\s*1120px\)\s*{[\s\S]*\.app-shell\s*{[^}]*grid-template-columns:/s);
    expect(foundationCss).toMatch(/\.workspace-commandbar__quick-link\s*{[^}]*min-block-size:\s*2\.75rem;/s);
    expect(layoutCss).toMatch(/\.workspace-commandbar__tools\s+\.icon-action\s*{[^}]*min-block-size:\s*2\.75rem;/s);
    expect(foundationCss).toMatch(/@media\s*\(max-width:\s*760px\)\s*{[\s\S]*input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\),\s*select,\s*textarea\s*{[^}]*font-size:\s*1rem;/s);
  });

  it("keeps the mobile command bar focused on its primary command", () => {
    expect(foundationCss).toMatch(/@media\s*\(max-width:\s*760px\)\s*{[\s\S]*\.workspace-commandbar__context,\s*\.workspace-commandbar__quick\s*{[^}]*display:\s*none;/s);
    expect(foundationCss).toMatch(/@media\s*\(max-width:\s*760px\)\s*{[\s\S]*\.workspace-commandbar\s*{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+auto;/s);
  });

  it("keeps reusable checklist controls at a 44px hit area", () => {
    expect(componentsCss).toMatch(/\.checklist-control\s*{[^}]*min-block-size:\s*2\.75rem;/s);
    expect(componentsCss).toMatch(/\.checklist-item input\[type="checkbox"\]\s*{[^}]*inline-size:\s*1\.05rem;[^}]*block-size:\s*1\.05rem;/s);
  });

  it("marks the semantic shell regions used by the responsive layout", () => {
    expect(appShell).toContain('data-layout="app-shell"');
    expect(appHeader).toContain('data-layout="app-header"');
    expect(commandBar).toContain('data-layout="workspace-commandbar"');
  });

  // Collapsible functional groups replace the single overflow menu. The hidden
  // links must not remain visible or focusable when any group is closed.
  it("hides grouped nav sections while their disclosure is closed", () => {
    expect(baseCss).toMatch(/\.nav-group:not\(\[open\]\)\s+\.nav-section\s*{[^}]*display:\s*none/s);
  });

  it("keeps notification and help surfaces within the visual viewport", () => {
    expect(notificationsCss).toMatch(/100dvh/);
    expect(statusCss).toMatch(/\.help-content\s*{[^}]*max-inline-size:\s*min\(100%,/s);
  });
});

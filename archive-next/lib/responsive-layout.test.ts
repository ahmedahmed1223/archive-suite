import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

const baseCss = readSource("app/styles/01-base.css");
const layoutCss = readSource("app/styles/02-layout.css");
const foundationCss = readSource("app/styles/08-foundation.css");
const componentsCss = readSource("app/styles/03-components.css");
const appShell = readSource("components/AppShell.tsx");
const appHeader = readSource("components/AppHeader.tsx");
const commandBar = readSource("components/WorkspaceCommandBar.tsx");
const helpPage = readSource("app/help/page.tsx");

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

  it("gives standalone checklist checkboxes a labelled 44px hit area", () => {
    expect(helpPage).toMatch(/<li className="checklist-item"[^>]*>\s*<label className="checklist-control">\s*<input type="checkbox"[^>]*\/>\s*<span>{item}<\/span>\s*<\/label>/s);
    expect(componentsCss).toMatch(/\.checklist-control\s*{[^}]*min-block-size:\s*2\.75rem;/s);
    expect(componentsCss).toMatch(/\.checklist-item input\[type="checkbox"\]\s*{[^}]*inline-size:\s*1\.05rem;[^}]*block-size:\s*1\.05rem;/s);
  });

  it("marks the semantic shell regions used by the responsive layout", () => {
    expect(appShell).toContain('data-layout="app-shell"');
    expect(appHeader).toContain('data-layout="app-header"');
    expect(commandBar).toContain('data-layout="workspace-commandbar"');
  });
});

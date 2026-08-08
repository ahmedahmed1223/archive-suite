// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import GuideHtml from "./GuideHtml";
import { sanitizeGuideHtml } from "@/lib/guide-html";

afterEach(cleanup);

describe("GuideHtml", () => {
  it("renders semantic guide HTML after server sanitization", () => {
    const html = sanitizeGuideHtml(`
      <h2>Procedure</h2>
      <p>Run <code>pnpm verify</code> and review the result.</p>
      <table><thead><tr><th>Check</th><th>Expected</th></tr></thead><tbody><tr><td>API</td><td>Pass</td></tr></tbody></table>
    `);

    render(<GuideHtml html={html} locale="en" />);

    expect(screen.getByRole("heading", { name: "Procedure", level: 3 })).toBeInTheDocument();
    expect(screen.getByText("pnpm verify").tagName).toBe("CODE");
    const table = screen.getByRole("table");
    expect(within(table).getByText("API")).toBeInTheDocument();
    expect(within(table).getByText("Pass")).toBeInTheDocument();
  });

  it("removes executable HTML and blocks unsafe links", () => {
    const html = sanitizeGuideHtml(`
      <p onclick="alert(1)">Safe text</p>
      <script>window.compromised = true</script>
      <img src="x" onerror="alert(1)">
      <a href="/search">Local</a>
      <a href="https://example.com/guide">External</a>
      <a href="javascript:alert(1)">Unsafe</a>
    `);
    const { container } = render(<GuideHtml html={html} locale="en" />);

    expect(container.querySelector("script, img, [onclick], [onerror]")).toBeNull();
    expect(screen.getByRole("link", { name: "Local" })).toHaveAttribute("href", "/search");
    expect(screen.getByRole("link", { name: "External" })).toHaveAttribute("rel", "noreferrer");
    expect(screen.queryByRole("link", { name: "Unsafe" })).not.toBeInTheDocument();
  });
});

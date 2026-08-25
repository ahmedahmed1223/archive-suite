import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import WorkResumeLink from "./WorkResumeLink";

describe("WorkResumeLink", () => {
  const label = "متابعة العمل: {name}";

  it("renders nothing when disabled", () => {
    const { container } = render(
      <WorkResumeLink target={{ pathname: "/archive", label: "الأرشيف", visitedAt: new Date().toISOString() }} pathname="/x" enabled={false} resumeLabel={label} />
    );
    expect(container.querySelector(".workspace-resume-link")).toBeNull();
  });

  it("renders nothing when target matches current page", () => {
    const { container } = render(
      <WorkResumeLink target={{ pathname: "/archive", label: "الأرشيف", visitedAt: new Date().toISOString() }} pathname="/archive" enabled resumeLabel={label} />
    );
    expect(container.querySelector(".workspace-resume-link")).toBeNull();
  });

  it("renders a link to the saved workspace when recent and different", () => {
    const now = new Date().toISOString();
    render(
      <WorkResumeLink target={{ pathname: "/archive", label: "الأرشيف", visitedAt: now }} pathname="/work-inbox" enabled resumeLabel={label} />
    );
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/archive");
    expect(link.textContent).toContain("الأرشيف");
  });

  it("hides a stale target older than 30 days", () => {
    const old = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    const { container } = render(
      <WorkResumeLink target={{ pathname: "/archive", label: "الأرشيف", visitedAt: old }} pathname="/work-inbox" enabled resumeLabel={label} />
    );
    expect(container.querySelector(".workspace-resume-link")).toBeNull();
  });
});

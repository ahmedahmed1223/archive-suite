// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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

  it("never offers the home page as a resume destination", () => {
    const { container } = render(
      <WorkResumeLink target={{ pathname: "/", label: "الرئيسية", visitedAt: new Date().toISOString() }} pathname="/work-inbox" enabled resumeLabel={label} />
    );
    expect(container.querySelector(".workspace-resume-link")).toBeNull();
  });

  it("rejects a missing or invalid visit timestamp", () => {
    const { container } = render(
      <WorkResumeLink target={{ pathname: "/archive", label: "الأرشيف", visitedAt: "invalid" }} pathname="/work-inbox" enabled resumeLabel={label} />
    );
    expect(container.querySelector(".workspace-resume-link")).toBeNull();
  });

  it("lets the command surface dismiss a suggestion for the current session", () => {
    const onDismiss = vi.fn();
    render(
      <WorkResumeLink
        target={{ pathname: "/archive", label: "الأرشيف", visitedAt: new Date().toISOString() }}
        pathname="/work-inbox"
        enabled
        resumeLabel={label}
        dismissLabel="إخفاء الاقتراح"
        onDismiss={onDismiss}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "إخفاء الاقتراح" }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});

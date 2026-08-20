// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ReleaseNotesDocument from "./ReleaseNotesDocument";

describe("ReleaseNotesDocument", () => {
  it("marks change lists for enhanced release-note scanning", () => {
    render(<ReleaseNotesDocument markdown={"# الإصدار 1.3.1\n\n## التحسينات\n\n- تحسين التصفح\n- دعم RTL"} />);

    expect(screen.getByRole("list")).toHaveClass("release-notes-list");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });
});

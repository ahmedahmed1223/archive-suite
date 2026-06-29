/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { StatusBadge } from "./StatusBadge.jsx";

describe("StatusBadge", () => {
  it("renders the current workflow label", () => {
    render(<StatusBadge item={{ workflowStatus: "published", tags: ["منشور"] }} />);

    expect(screen.getByText("منشور")).toBeInTheDocument();
  });

  it("marks overdue in-flight items", () => {
    render(<StatusBadge item={{ workflowStatus: "review", workflowDueDate: "2026-01-01" }} now={() => Date.parse("2026-06-11")} />);

    expect(screen.getByTitle("تجاوز تاريخ الاستحقاق")).toBeInTheDocument();
  });
});

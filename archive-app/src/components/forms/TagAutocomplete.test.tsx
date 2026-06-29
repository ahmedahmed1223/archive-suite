// @vitest-environment jsdom
import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAppStore } from "../../stores/appStore.js";
import { TagAutocomplete } from "./TagAutocomplete.jsx";

describe("TagAutocomplete discovery", () => {
  beforeEach(() => {
    useAppStore.setState({ vocabulary: [], hierarchicalTags: [], videoItems: [], users: [], settings: {} });
  });

  it("explains both triggers and inserts them from visible controls", () => {
    const onChange = vi.fn();
    render(<TagAutocomplete value="" onChange={onChange} />);
    expect(screen.getByPlaceholderText("اكتب # للوسوم أو @ للقاموس")).toBeInTheDocument();
    expect(screen.getByText("# الوسوم")).toBeInTheDocument();
    expect(screen.getByText("@ القاموس")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "إدراج رمز استدعاء الوسوم" }));
    expect(onChange).toHaveBeenCalledWith("#");
  });
});

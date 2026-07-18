// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SearchAutocomplete from "./SearchAutocomplete";

describe("SearchAutocomplete", () => {
  it("selects an option with the keyboard", async () => {
    const onSelect = vi.fn();
    render(<SearchAutocomplete value="riy" onChange={() => {}} onSelect={onSelect} fetchSuggestions={async () => [{ kind: "record", label: "Riyadh archive interview", value: "Riyadh archive interview", recordId: "clip-001" }]} />);
    const input = screen.getByRole("combobox");
    await screen.findByRole("option", { name: "Riyadh archive interview" });
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ recordId: "clip-001" }));
  });
});

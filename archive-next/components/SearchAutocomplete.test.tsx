// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SearchAutocomplete from "./SearchAutocomplete";

describe("SearchAutocomplete", () => {
  afterEach(cleanup);

  it("selects an option with the keyboard", async () => {
    const onSelect = vi.fn();
    render(<SearchAutocomplete value="riy" onChange={() => {}} onSelect={onSelect} fetchSuggestions={async () => [{ kind: "record", label: "Riyadh archive interview", value: "Riyadh archive interview", recordId: "clip-001" }]} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    await screen.findByRole("option", { name: "Riyadh archive interview" });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ recordId: "clip-001" }));
  });

  it("closes its suggestion list when focus leaves the field", async () => {
    render(<SearchAutocomplete value="riy" onChange={() => {}} onSelect={() => {}} fetchSuggestions={async () => [{ kind: "record", label: "Riyadh archive interview", value: "Riyadh archive interview", recordId: "clip-001" }]} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    await screen.findByRole("option", { name: "Riyadh archive interview" });

    fireEvent.blur(input);

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("does not restore suggestions when a pending request resolves after blur", async () => {
    let releaseSuggestions: ((items: { kind: "record"; label: string; value: string; recordId: string }[]) => void) | undefined;
    render(<SearchAutocomplete value="riy" onChange={() => {}} onSelect={() => {}} fetchSuggestions={() => new Promise((resolve) => { releaseSuggestions = resolve; })} />);
    const input = screen.getByRole("combobox");

    fireEvent.focus(input);
    await waitFor(() => expect(releaseSuggestions).toBeDefined());
    fireEvent.blur(input);
    releaseSuggestions?.([{ kind: "record", label: "Riyadh archive interview", value: "Riyadh archive interview", recordId: "clip-001" }]);

    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});

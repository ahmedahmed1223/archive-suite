// @vitest-environment jsdom
import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SearchAutocomplete from "./SearchAutocomplete";

describe("SearchAutocomplete", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

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
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
  });

  it("does not restore suggestions when a pending request resolves after blur", async () => {
    let releaseSuggestions: ((items: { kind: "record"; label: string; value: string; recordId: string }[]) => void) | undefined;
    render(<SearchAutocomplete value="riy" onChange={() => {}} onSelect={() => {}} fetchSuggestions={() => new Promise((resolve) => { releaseSuggestions = resolve; })} />);
    const input = screen.getByRole("combobox");

    fireEvent.focus(input);
    await waitFor(() => expect(releaseSuggestions).toBeDefined());
    fireEvent.blur(input);
    releaseSuggestions?.([{ kind: "record", label: "Riyadh archive interview", value: "Riyadh archive interview", recordId: "clip-001" }]);

    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
  });

  it("keeps suggestions mounted until the search-button pointer interaction can finish", async () => {
    vi.useFakeTimers();
    const fetchSuggestions = vi.fn().mockResolvedValue([{ value: "سجل اختبار", label: "سجل اختبار", kind: "record" }]);

    function Harness() {
      const [value, setValue] = useState("");
      return <form><SearchAutocomplete value={value} onChange={setValue} onSelect={() => undefined} fetchSuggestions={fetchSuggestions} /><button type="submit">بحث</button></form>;
    }

    render(<Harness />);
    const input = screen.getByRole("combobox", { name: "اقتراحات البحث" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "سجل" } });
    await act(async () => { vi.advanceTimersByTime(180); await Promise.resolve(); });
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    fireEvent.blur(input, { relatedTarget: screen.getByRole("button", { name: "بحث" }) });

    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });
});

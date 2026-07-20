// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

const { mentionableUsers } = vi.hoisted(() => ({
  mentionableUsers: vi.fn()
}));

vi.mock("@/lib/archive-api", () => ({
  createArchiveApiClient: () => ({ mentionableUsers })
}));

import MentionTextarea from "./MentionTextarea";

// A real useState wrapper — MentionTextarea reads its own `value` prop when
// resolving a selection, so a plain non-reactive closure variable (never
// re-rendering the component) would silently exercise a stale empty value.
function ControlledMentionTextarea({ onChange }: { onChange: (value: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <MentionTextarea
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
      aria-label="نص الملاحظة"
    />
  );
}

function renderTextarea(onChange = vi.fn()) {
  return render(<ControlledMentionTextarea onChange={onChange} />);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("MentionTextarea", () => {
  test("shows no suggestions until an @ is typed", async () => {
    mentionableUsers.mockResolvedValue({ ok: true, users: [{ id: "u1", name: "سارة المحررة" }] });
    renderTextarea();

    const textarea = await screen.findByLabelText("نص الملاحظة");
    fireEvent.change(textarea, { target: { value: "مرحباً", selectionStart: 6 } });

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  test("filters mentionable users after @ and inserts the selected name on click", async () => {
    mentionableUsers.mockResolvedValue({
      ok: true,
      users: [
        { id: "u1", name: "سارة المحررة" },
        { id: "u2", name: "محرر أحمد" }
      ]
    });
    const onChange = vi.fn();
    renderTextarea(onChange);

    const textarea = await screen.findByLabelText("نص الملاحظة");
    fireEvent.change(textarea, { target: { value: "مرحباً @سا", selectionStart: 10 } });

    const listbox = await screen.findByRole("listbox");
    expect(listbox).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "سارة المحررة" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "محرر أحمد" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("option", { name: "سارة المحررة" }));

    expect(onChange).toHaveBeenLastCalledWith("مرحباً @سارة المحررة ");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});

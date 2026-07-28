// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import StorageBrowser, { type StorageProvider } from "./StorageBrowser";

const providers: StorageProvider[] = [
  { id: "local", label: "التخزين المحلي", type: "local", status: "ready", capabilities: ["browse", "download", "upload", "move"] },
  { id: "dropbox", label: "Dropbox", type: "dropbox", status: "ready", capabilities: ["browse", "download"] },
];

afterEach(cleanup);

describe("StorageBrowser", () => {
  it("changes the selected provider and gates unsupported actions", () => {
    const onProviderChange = vi.fn();
    render(<StorageBrowser providers={providers} providerId="local" path="" entries={[]} onProviderChange={onProviderChange} onNavigate={vi.fn()} />);

    expect(screen.getByRole("button", { name: "نقل" })).toBeEnabled();
    fireEvent.change(screen.getByLabelText("وحدة التخزين"), { target: { value: "dropbox" } });

    expect(onProviderChange).toHaveBeenCalledWith("dropbox");
    expect(screen.getByRole("button", { name: "نقل" })).toBeDisabled();
    expect(screen.getByText("غير متاح في وحدة التخزين المحددة")).toBeInTheDocument();
  });

  it("keeps its provider and current folder semantics in sync with the workspace", () => {
    const { rerender } = render(<StorageBrowser providers={providers} providerId="local" path="reports/2026" entries={[]} onProviderChange={vi.fn()} onNavigate={vi.fn()} />);

    expect(screen.getByRole("button", { name: "2026" })).toHaveAttribute("aria-current", "location");
    rerender(<StorageBrowser providers={providers} providerId="dropbox" path="reports/2026" entries={[]} onProviderChange={vi.fn()} onNavigate={vi.fn()} />);

    expect(screen.getByLabelText("وحدة التخزين")).toHaveValue("dropbox");
  });

  // V1-306B: the UI is RTL, so "back one level" points right. A left-pointing
  // chevron here reads as "forward" to an Arabic user. lucide renders the icon
  // name into `class`, which is what lets this assert direction without a
  // screenshot.
  it("points the parent-folder affordance rightwards for RTL", () => {
    const { container } = render(
      <StorageBrowser providers={providers} providerId="local" path="reports/2026" entries={[]} onProviderChange={vi.fn()} onNavigate={vi.fn()} />,
    );

    const parentButton = screen.getByRole("button", { name: /المجلد السابق/ });

    expect(parentButton.querySelector(".lucide-chevron-right")).not.toBeNull();
    expect(container.querySelector(".lucide-chevron-left")).toBeNull();
  });
});

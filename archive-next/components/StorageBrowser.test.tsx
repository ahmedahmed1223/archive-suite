// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import StorageBrowser, { type StorageProvider } from "./StorageBrowser";

const providers: StorageProvider[] = [
  { id: "local", label: "التخزين المحلي", type: "local", status: "ready", capabilities: ["browse", "download", "upload", "move"] },
  { id: "dropbox", label: "Dropbox", type: "dropbox", status: "ready", capabilities: ["browse", "download"] },
];

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
});

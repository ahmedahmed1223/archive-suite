// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ExportDrawer from "./ExportDrawer";
import MediaBin, { type MaterialBinItem } from "./MediaBin";

afterEach(cleanup);

const exportCopy = {
  drawerAriaLabel: "Export drawer",
  title: "Export project",
  presetGroupLabel: "Choose export quality",
  runQc: "Check project",
  startExport: "Start export",
  qcRequiredHint: "QC must pass first",
};

const binCopy = {
  binAriaLabel: "Material bin",
  listLabel: "Available materials",
  emptyBin: "No materials yet",
};

describe("ExportDrawer (Task 6)", () => {
  it("keeps the export button disabled until the server QC response is ready", async () => {
    let qcReady = false;
    const onRunQc = vi.fn(async () => {
      qcReady = true;
    });
    const { rerender } = render(
      <ExportDrawer
        projectId="p1"
        currentRevision={7}
        qcReady={qcReady}
        onRunQc={onRunQc}
        onRequestExport={vi.fn()}
        copy={exportCopy}
      />,
    );

    const start = screen.getByRole("button", { name: exportCopy.startExport });
    expect(start).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: exportCopy.runQc }));
    await waitFor(() => expect(onRunQc).toHaveBeenCalled());

    rerender(
      <ExportDrawer
        projectId="p1"
        currentRevision={7}
        qcReady={qcReady}
        onRunQc={onRunQc}
        onRequestExport={vi.fn()}
        copy={exportCopy}
      />,
    );
    await waitFor(() => expect(start).toBeEnabled());
  });

  it("requests an export with the allowlisted preset only", () => {
    const onRequestExport = vi.fn();
    render(
      <ExportDrawer
        projectId="p1"
        currentRevision={7}
        qcReady
        onRequestExport={onRequestExport}
        copy={exportCopy}
      />,
    );
    fireEvent.click(screen.getByLabelText("Archive master"));
    fireEvent.click(screen.getByRole("button", { name: exportCopy.startExport }));
    expect(onRequestExport).toHaveBeenCalledWith("archive-master");
  });
});

const binItems: MaterialBinItem[] = [
  {
    id: "m1",
    name: "مقابلة التاريخ الشفوي",
    durationSeconds: 634.5,
    source: { recordId: "r1", sourceVersionToken: "sha256:a" },
  },
];

describe("MediaBin (Task 5)", () => {
  it("lists materials as selectable options with LTR durations", () => {
    const onSelect = vi.fn();
    render(<MediaBin items={binItems} selectedId={null} onSelect={onSelect} copy={binCopy} />);
    const option = screen.getByRole("option");
    fireEvent.click(option);
    expect(onSelect).toHaveBeenCalledWith(binItems[0]);
    const duration = screen.getByText(/s$/);
    expect(duration.getAttribute("dir")).toBe("ltr");
  });

  it("shows the localized empty state without items", () => {
    render(<MediaBin items={[]} selectedId={null} onSelect={vi.fn()} copy={binCopy} />);
    expect(screen.getByText(binCopy.emptyBin)).toBeInTheDocument();
  });
});

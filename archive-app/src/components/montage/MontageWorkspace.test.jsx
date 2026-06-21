// @vitest-environment jsdom
import * as React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MontageToolStrip } from "./MontageToolStrip.jsx";
import { MontageWorkspace } from "./MontageWorkspace.jsx";

describe("MontageWorkspace", () => {
  it("renders the complete workstation as named semantic regions", () => {
    render(<MontageWorkspace
      header={<div>Header</div>}
      toolbar={<div>Tools</div>}
      mediaBin={<div>Media</div>}
      monitor={<div>Monitor</div>}
      inspector={<div>Inspector</div>}
      timeline={<div>Timeline</div>}
    />);

    expect(screen.getByRole("banner")).toHaveTextContent("Header");
    expect(screen.getByRole("toolbar", { name: "أدوات المونتاج" })).toHaveTextContent("Tools");
    expect(screen.getByRole("region", { name: "مكتبة مواد المشروع" })).toHaveTextContent("Media");
    expect(screen.getByRole("region", { name: "شاشة البرنامج" })).toHaveTextContent("Monitor");
    expect(screen.getByRole("region", { name: "مفتش القصاصة" })).toHaveTextContent("Inspector");
    expect(screen.getByRole("region", { name: "الخط الزمني" })).toHaveTextContent("Timeline");
  });

  it("opens compact media and inspector drawers without unmounting the monitor", async () => {
    const user = userEvent.setup();
    render(<MontageWorkspace
      mediaBin={<div>Media</div>}
      monitor={<div>Monitor</div>}
      inspector={<div>Inspector</div>}
      timeline={<div>Timeline</div>}
    />);

    await user.click(screen.getByRole("button", { name: "فتح مكتبة المواد" }));
    expect(screen.getByRole("region", { name: "مكتبة مواد المشروع" })).toHaveAttribute("data-open", "true");
    expect(screen.getByRole("region", { name: "شاشة البرنامج" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "فتح مفتش القصاصة" }));
    expect(screen.getByRole("region", { name: "مفتش القصاصة" })).toHaveAttribute("data-open", "true");
  });
});

describe("MontageToolStrip", () => {
  it("updates snapping and ripple preferences", async () => {
    const user = userEvent.setup();
    const onPreferencesChange = vi.fn();
    render(<MontageToolStrip
      preferences={{ snapping: true, rippleMode: "primary", linkAudioVideo: true }}
      onPreferencesChange={onPreferencesChange}
    />);

    await user.click(screen.getByRole("button", { name: "الالتقاط المغناطيسي" }));
    expect(onPreferencesChange).toHaveBeenCalledWith(expect.objectContaining({ snapping: false }));

    await user.selectOptions(screen.getByLabelText("نطاق Ripple"), "all-unlocked");
    expect(onPreferencesChange).toHaveBeenLastCalledWith(expect.objectContaining({ rippleMode: "all-unlocked" }));
  });

  it("dispatches editing tool and history commands", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<MontageToolStrip preferences={{}} onAction={onAction} canUndo />);

    await user.click(screen.getByRole("button", { name: "أداة القطع" }));
    await user.click(screen.getByRole("button", { name: "تراجع" }));

    expect(onAction).toHaveBeenNthCalledWith(1, { type: "tool.select", tool: "blade" });
    expect(onAction).toHaveBeenNthCalledWith(2, { type: "history.undo" });
  });
});

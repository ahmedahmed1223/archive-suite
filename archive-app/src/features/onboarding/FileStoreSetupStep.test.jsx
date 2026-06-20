// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FileStoreSetupStep } from "./FileStoreSetupStep.jsx";

describe("FileStoreSetupStep", () => {
  it("shows every provider and reports the selected one", () => {
    const onChange = vi.fn();
    const providers = [
      "disk", "s3", "dropbox", "azure", "gdrive", "ftp", "smb", "sftp", "webdav"
    ].map((id) => ({ id, label: id.toUpperCase(), configured: id === "disk", active: id === "disk", missingEnv: [] }));

    render(<FileStoreSetupStep providers={providers} value="disk" onChange={onChange} />);

    expect(screen.getAllByRole("radio")).toHaveLength(9);
    fireEvent.click(screen.getByRole("radio", { name: /SFTP/i }));
    expect(onChange).toHaveBeenCalledWith("sftp");
  });
});

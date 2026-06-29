/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock the rights client so tests stay network-free
vi.mock("../../../features/rights/rightsClient.js", () => ({
  fetchItemRights: vi.fn(),
  saveItemRights: vi.fn(),
}));

// Mock backendChoice so we can control cloud vs local
vi.mock("../../../bootstrap/backendChoice.js", () => ({
  getBackendChoice: vi.fn(() => "postgres"),
  resolveBackendChoice: vi.fn(() => ({ backend: "postgres", url: "http://localhost:3000" })),
}));

// Mock cloudSession so getToken resolves
vi.mock("../../../bootstrap/cloudSession.js", () => ({
  getCloudToken: vi.fn(() => "test-token"),
}));

import { fetchItemRights, saveItemRights } from "../../../features/rights/rightsClient.js";
import { getBackendChoice } from "../../../bootstrap/backendChoice.js";
import { RightsPanel } from "../RightsPanel.jsx";

const mockedFetchItemRights = vi.mocked(fetchItemRights);
const mockedSaveItemRights = vi.mocked(saveItemRights);
const mockedGetBackendChoice = vi.mocked(getBackendChoice);

const EMPTY_RECORD = { ok: true, record: null };
const FULL_RECORD = {
  ok: true,
  record: {
    id: "r1",
    itemId: "item-42",
    rightsHolder: "وكالة الأنباء",
    licenseType: "LICENSED",
    embargoStart: "2025-01-01",
    embargoEnd: "2025-06-30",
    expiresAt: null,
    geoRestrictions: ["SA", "AE"],
    notes: "ملاحظة اختبار",
  },
};
const EXPIRED_RECORD = {
  ok: true,
  record: {
    id: "r2",
    itemId: "item-99",
    rightsHolder: "مصدر قديم",
    licenseType: "OWNED",
    embargoStart: null,
    embargoEnd: null,
    expiresAt: "2020-01-01",
    geoRestrictions: [],
    notes: "",
  },
};
const EMBARGO_ACTIVE_RECORD = {
  ok: true,
  record: {
    id: "r3",
    itemId: "item-77",
    rightsHolder: "ناشر",
    licenseType: "LICENSED",
    embargoStart: "2000-01-01",
    embargoEnd: "2099-12-31",
    expiresAt: null,
    geoRestrictions: [],
    notes: "",
  },
};

describe("RightsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFetchItemRights.mockResolvedValue(EMPTY_RECORD);
    mockedSaveItemRights.mockResolvedValue({ ok: true, record: {} });
    mockedGetBackendChoice.mockReturnValue("postgres");
  });

  it("renders nothing when backend is local", async () => {
    mockedGetBackendChoice.mockReturnValue("local");
    const { container } = render(<RightsPanel itemId="item-1" />);
    // Should render null / empty — no heading
    expect(container.firstChild).toBeNull();
  });

  it("shows loading state initially then renders panel heading", async () => {
    mockedFetchItemRights.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(EMPTY_RECORD), 50))
    );
    render(<RightsPanel itemId="item-1" />);
    // Should eventually show the panel heading once loaded
    await screen.findByText("الحقوق والترخيص");
  });

  it("renders all form fields when cloud mode", async () => {
    render(<RightsPanel itemId="item-1" />);
    await screen.findByText("الحقوق والترخيص");
    expect(screen.getByLabelText(/صاحب الحق/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/نوع الترخيص/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/الدول المقيدة/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/ملاحظات/i)).toBeInTheDocument();
  });

  it("populates fields from fetched record", async () => {
    mockedFetchItemRights.mockResolvedValue(FULL_RECORD);
    render(<RightsPanel itemId="item-42" />);
    await screen.findByDisplayValue("وكالة الأنباء");
    // Select shows Arabic label; verify by combobox value
    const select = screen.getByRole("combobox", { name: /نوع الترخيص/i });
    expect(select).toHaveValue("LICENSED");
    expect(screen.getByDisplayValue("SA, AE")).toBeInTheDocument();
    expect(screen.getByDisplayValue("ملاحظة اختبار")).toBeInTheDocument();
  });

  it("shows expired warning when expiresAt is in the past", async () => {
    mockedFetchItemRights.mockResolvedValue(EXPIRED_RECORD);
    render(<RightsPanel itemId="item-99" />);
    await screen.findByText(/منتهية/i);
  });

  it("shows embargo warning when currently under embargo", async () => {
    mockedFetchItemRights.mockResolvedValue(EMBARGO_ACTIVE_RECORD);
    render(<RightsPanel itemId="item-77" />);
    // The warning badge text is exactly "🔒 تحت الحجب" — query by role to distinguish it from the field labels
    await screen.findByRole("status");
    expect(screen.getByRole("status")).toHaveTextContent("تحت الحجب");
  });

  it("calls saveItemRights when Save button is clicked", async () => {
    const user = userEvent.setup();
    render(<RightsPanel itemId="item-1" />);
    await screen.findByText("الحقوق والترخيص");
    const saveBtn = screen.getByRole("button", { name: /حفظ/i });
    await user.click(saveBtn);
    await waitFor(() => expect(saveItemRights).toHaveBeenCalledTimes(1));
  });

  it("renders license type badge", async () => {
    mockedFetchItemRights.mockResolvedValue(FULL_RECORD);
    render(<RightsPanel itemId="item-42" />);
    // Wait for the panel to finish loading (heading is always rendered post-load)
    await screen.findByRole("heading", { name: "الحقوق والترخيص" });
    // Multiple elements with "مرخّص" may exist (badge span + select option)
    const matches = screen.getAllByText("مرخّص");
    expect(matches.length).toBeGreaterThanOrEqual(1);
    // At least one match should be a span (the badge), not an option
    const hasSpan = matches.some((el) => el.tagName.toLowerCase() === "span");
    expect(hasSpan).toBe(true);
  });

  it("expiry date input updates on change", async () => {
    const user = userEvent.setup();
    render(<RightsPanel itemId="item-1" />);
    await screen.findByText("الحقوق والترخيص");
    const expiryInput = screen.getByLabelText(/تاريخ الانتهاء/i);
    await user.clear(expiryInput);
    await user.type(expiryInput, "2099-12-31");
    expect(expiryInput).toHaveValue("2099-12-31");
  });

  it("shows near-expiry warning badge when expiry is within 30 days", async () => {
    const soon = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    mockedFetchItemRights.mockResolvedValue({
      ok: true,
      record: {
        id: "r4",
        itemId: "item-10",
        rightsHolder: "",
        licenseType: "OWNED",
        embargoStart: null,
        embargoEnd: null,
        expiresAt: soon,
        geoRestrictions: [],
        notes: "",
      },
    });
    render(<RightsPanel itemId="item-10" />);
    await screen.findByText(/تنتهي قريباً/i);
  });
});

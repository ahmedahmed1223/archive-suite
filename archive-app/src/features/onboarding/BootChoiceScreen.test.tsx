// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const updateSettings = vi.fn().mockResolvedValue(true);
  const skipPasswordSetup = vi.fn().mockResolvedValue(true);
  const storeState = {
    settings: { ui: {} },
    users: [{ id: "u1", username: "admin", isActive: true }],
    updateSettings,
    skipPasswordSetup
  };
  const authSetState = vi.fn();
  return { updateSettings, skipPasswordSetup, storeState, authSetState };
});

vi.mock("../../stores/index.js", () => ({
  useAppStore: Object.assign(() => mocks.storeState, { getState: () => mocks.storeState }),
  useAuthStore: Object.assign(() => ({}), { setState: mocks.authSetState })
}));

const { updateSettings, skipPasswordSetup, authSetState } = mocks;

import { BootChoiceScreen } from "./BootChoiceScreen.jsx";

describe("BootChoiceScreen", () => {
  it("Quick Start finishes inline: skipPasswordSetup + onboardingCompleted + onComplete", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const onAdvanced = vi.fn();
    updateSettings.mockClear();
    skipPasswordSetup.mockClear();
    authSetState.mockClear();
    render(<BootChoiceScreen onComplete={onComplete} onAdvanced={onAdvanced} />);

    await user.click(screen.getByRole("button", { name: /بدء سريع/ }));

    await waitFor(() => expect(onComplete).toHaveBeenCalled());
    expect(skipPasswordSetup).toHaveBeenCalled();
    expect(updateSettings).toHaveBeenCalledWith(expect.objectContaining({
      ui: expect.objectContaining({
        onboardingCompleted: true,
        v1OnboardingCompleted: true,
        firstTaskChoice: "dashboard",
        onboardingSecurityMode: "quick",
        bootChoice: "quick"
      })
    }));
    expect(authSetState).toHaveBeenCalledWith(expect.objectContaining({
      currentUser: expect.objectContaining({ username: "admin" }),
      isAuthenticated: true
    }));
    expect(onAdvanced).not.toHaveBeenCalled();
  });

  it("Advanced Setup records the choice and invokes onAdvanced", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    const onAdvanced = vi.fn();
    updateSettings.mockClear();
    render(<BootChoiceScreen onComplete={onComplete} onAdvanced={onAdvanced} />);

    await user.click(screen.getByRole("button", { name: /إعداد متقدم/ }));

    expect(onAdvanced).toHaveBeenCalled();
    expect(updateSettings).toHaveBeenCalledWith(expect.objectContaining({
      ui: expect.objectContaining({ bootChoice: "advanced" })
    }));
    expect(onComplete).not.toHaveBeenCalled();
  });
});

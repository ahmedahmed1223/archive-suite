// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import FirstRunTour from "@/components/FirstRunTour";
import { firstRunTourSteps, hasTourBeenCompleted } from "@/lib/first-run-tour";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("FirstRunTour (V1-765)", () => {
  test("does not open on render - manually triggered only", () => {
    render(<FirstRunTour />);
    expect(screen.queryByText(firstRunTourSteps[0].description)).toBeNull();
  });

  test("opens on the first step when the trigger is clicked", () => {
    render(<FirstRunTour />);
    fireEvent.click(screen.getByRole("button", { name: "بدء جولة تعريفية" }));

    expect(screen.getByText("خطوة 1 من " + firstRunTourSteps.length)).toBeTruthy();
    expect(screen.getByRole("button", { name: "السابق" })).toBeDisabled();
  });

  test("advances through steps and marks completion on the last step", () => {
    render(<FirstRunTour />);
    fireEvent.click(screen.getByRole("button", { name: "بدء جولة تعريفية" }));

    for (let i = 0; i < firstRunTourSteps.length - 1; i++) {
      fireEvent.click(screen.getByRole("button", { name: "التالي" }));
    }

    expect(screen.getByText(`خطوة ${firstRunTourSteps.length} من ${firstRunTourSteps.length}`)).toBeTruthy();
    expect(hasTourBeenCompleted()).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "إنهاء الجولة" }));
    expect(hasTourBeenCompleted()).toBe(true);
  });

  test("skip closes the dialog without marking completion", () => {
    render(<FirstRunTour />);
    fireEvent.click(screen.getByRole("button", { name: "بدء جولة تعريفية" }));
    fireEvent.click(screen.getByRole("button", { name: "تخطي" }));

    expect(hasTourBeenCompleted()).toBe(false);
    expect(screen.queryByText(firstRunTourSteps[0].description)).toBeNull();
  });
});

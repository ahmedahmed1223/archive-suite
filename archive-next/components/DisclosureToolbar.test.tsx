// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import DisclosureToolbar from "./DisclosureToolbar";

// V14-UX-005 (Task 5): advanced options stay behind a semantic disclosure.
describe("DisclosureToolbar", () => {
  test("hides advanced controls until the summary is activated", () => {
    render(
      <DisclosureToolbar summary="خيارات متقدمة">
        <label>
          النوع
          <input />
        </label>
      </DisclosureToolbar>
    );

    const trigger = screen.getByText("خيارات متقدمة");
    expect(trigger).toBeVisible();
    // Hidden content stays in the DOM (semantic <details>) but is not visible.
    expect(screen.getByLabelText("النوع")).not.toBeVisible();

    fireEvent.click(trigger);
    expect(screen.getByLabelText("النوع")).toBeVisible();
  });

  test("respects defaultOpen for desktop toolbars", () => {
    render(
      <DisclosureToolbar summary="خيارات متقدمة" defaultOpen>
        <p>محتوى متقدم</p>
      </DisclosureToolbar>
    );

    expect(screen.getByText("محتوى متقدم").closest(".disclosure-toolbar__content")).toBeVisible();
  });
});

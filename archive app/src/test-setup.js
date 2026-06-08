import { expect, afterEach } from "vitest";
import * as jestDomMatchers from "@testing-library/jest-dom/matchers";
import { toHaveNoViolations } from "vitest-axe/matchers";
import { cleanup } from "@testing-library/react";

// Register @testing-library/jest-dom DOM matchers (toBeInTheDocument, etc.)
expect.extend(jestDomMatchers);

// Register vitest-axe a11y matcher (toHaveNoViolations)
expect.extend({ toHaveNoViolations });

// Clean up DOM after each test to avoid test pollution
afterEach(() => {
  cleanup();
});

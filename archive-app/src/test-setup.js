import { expect, afterEach } from "vitest";
import * as jestDomMatchers from "@testing-library/jest-dom/matchers";
import { toHaveNoViolations } from "vitest-axe/matchers";
import { cleanup } from "@testing-library/react";

// Register @testing-library/jest-dom DOM matchers (toBeInTheDocument, etc.)
expect.extend(jestDomMatchers);

// Register vitest-axe a11y matcher (toHaveNoViolations)
expect.extend({ toHaveNoViolations });

const canvasGetContext = typeof HTMLCanvasElement !== "undefined"
  ? HTMLCanvasElement.prototype.getContext
  : null;
if (typeof HTMLCanvasElement !== "undefined" && !canvasGetContext?.__videoArchiveMock) {
  const getContext = () => ({
    canvas: null,
    clearRect: () => {},
    drawImage: () => {},
    fillRect: () => {},
    getImageData: () => ({ data: new Uint8ClampedArray(0) }),
    measureText: (text = "") => ({ width: String(text).length * 8 }),
    putImageData: () => {},
    restore: () => {},
    save: () => {},
    scale: () => {},
    setTransform: () => {},
    translate: () => {}
  });
  getContext.__videoArchiveMock = true;
  HTMLCanvasElement.prototype.getContext = getContext;
}

// Clean up DOM after each test to avoid test pollution
afterEach(() => {
  cleanup();
});

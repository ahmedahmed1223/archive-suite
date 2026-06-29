import { expect, afterEach } from "vitest";
import * as jestDomMatchers from "@testing-library/jest-dom/matchers";
import { cleanup } from "@testing-library/react";

declare module "vitest" {
  interface Assertion<T = any> {
    toHaveNoViolations(): T;
  }

  interface AsymmetricMatchersContaining {
    toHaveNoViolations(): unknown;
  }
}

// Register @testing-library/jest-dom DOM matchers (toBeInTheDocument, etc.)
expect.extend(jestDomMatchers as any);

// Register vitest-axe a11y matcher (toHaveNoViolations)
const axeMatchers = (await import("vitest-axe/matchers")) as any;
expect.extend({ toHaveNoViolations: axeMatchers.toHaveNoViolations } as any);

const canvasGetContext = typeof HTMLCanvasElement !== "undefined"
  ? HTMLCanvasElement.prototype.getContext
  : null;
if (typeof HTMLCanvasElement !== "undefined" && !(canvasGetContext as any)?.__videoArchiveMock) {
  const getContext = (() => ({
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
  })) as any;
  getContext.__videoArchiveMock = true;
  HTMLCanvasElement.prototype.getContext = getContext as HTMLCanvasElement["getContext"];
}

// Clean up DOM after each test to avoid test pollution
afterEach(() => {
  cleanup();
});

/**
 * @vitest-environment jsdom
 *
 * ArchiveImage component tests.
 * TDD: these tests drive the implementation in ../ArchiveImage.tsx
 */
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ArchiveImage } from "../ArchiveImage.js";

describe("ArchiveImage", () => {
  it("renders an img with the given src and alt", () => {
    render(
      <ArchiveImage
        src="https://cdn.example/thumb.jpg"
        alt="وصف الصورة"
        width={320}
        height={180}
      />
    );
    const img = screen.getByRole("img", { name: "وصف الصورة" });
    expect(img).toBeTruthy();
    expect(img.getAttribute("src")).toBe("https://cdn.example/thumb.jpg");
  });

  it("defaults to loading=lazy", () => {
    render(
      <ArchiveImage src="https://cdn.example/a.jpg" alt="" width={160} height={90} />
    );
    const img = document.querySelector("img");
    // Use getAttribute — jsdom may not reflect loading as a DOM property
    expect(img?.getAttribute("loading")).toBe("lazy");
  });

  it("accepts loading=eager (above-the-fold / hero use)", () => {
    render(
      <ArchiveImage
        src="https://cdn.example/hero.jpg"
        alt="hero"
        width={640}
        height={360}
        loading="eager"
        fetchPriority="high"
      />
    );
    const img = document.querySelector("img");
    expect(img?.getAttribute("loading")).toBe("eager");
    // fetchpriority is lowercased in HTML; check both spellings jsdom may use
    const fp = img?.getAttribute("fetchpriority") ?? img?.getAttribute("fetchPriority");
    expect(fp).toBe("high");
  });

  it("passes srcSet and sizes when provided", () => {
    const srcSet = "https://cdn.example/t-320.jpg 320w, https://cdn.example/t-640.jpg 640w";
    const sizes = "(max-width: 600px) 320px, 640px";
    render(
      <ArchiveImage
        src="https://cdn.example/t-640.jpg"
        alt=""
        width={640}
        height={360}
        srcSet={srcSet}
        sizes={sizes}
      />
    );
    const img = document.querySelector("img");
    expect(img?.getAttribute("srcset")).toBe(srcSet);
    expect(img?.getAttribute("sizes")).toBe(sizes);
  });

  it("sets explicit width and height to prevent layout shift", () => {
    render(
      <ArchiveImage src="https://cdn.example/b.jpg" alt="" width={200} height={112} />
    );
    const img = document.querySelector("img");
    expect(img?.getAttribute("width")).toBe("200");
    expect(img?.getAttribute("height")).toBe("112");
  });

  it("shows fallback placeholder on error", async () => {
    render(
      <ArchiveImage src="https://cdn.example/broken.jpg" alt="صورة" width={160} height={90} />
    );
    const img = document.querySelector("img") as HTMLImageElement;
    // Fire error event
    img.dispatchEvent(new Event("error"));
    // After error, the src should be replaced with a placeholder (empty or data-uri)
    // and the img should still be in the DOM
    expect(img).toBeTruthy();
    expect(img.getAttribute("data-errored")).toBe("true");
  });

  it("applies className when provided", () => {
    render(
      <ArchiveImage
        src="https://cdn.example/c.jpg"
        alt=""
        width={160}
        height={90}
        className="h-full w-full object-cover"
      />
    );
    const img = document.querySelector("img");
    expect(img?.className).toContain("object-cover");
  });

  it("has decoding=async by default for performance", () => {
    render(
      <ArchiveImage src="https://cdn.example/d.jpg" alt="" width={160} height={90} />
    );
    const img = document.querySelector("img");
    expect(img?.getAttribute("decoding")).toBe("async");
  });
});

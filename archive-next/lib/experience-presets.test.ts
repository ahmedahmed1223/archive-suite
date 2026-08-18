import { describe, expect, it } from "vitest";
import { buildPresetPatch, getPresetDefinition, PRESET_IDS } from "./experience-presets";
import { MANDATORY_NAV_HREFS } from "./navigation";

describe("experience presets", () => {
  it.each(PRESET_IDS)("%s produces a patch touching only homePage/navigation/views", (id) => {
    const patch = buildPresetPatch(id);
    expect(Object.keys(patch).sort()).toEqual(["homePage", "navigation", "views"]);
    expect(typeof patch.homePage).toBe("string");
    expect(Array.isArray(patch.navigation?.order)).toBe(true);
    expect(Array.isArray(patch.navigation?.hiddenModules)).toBe(true);
    expect(["table", "grid"]).toContain(patch.views?.archive?.mode);
  });

  it.each(PRESET_IDS)("%s never asks to hide a mandatory nav href", (id) => {
    const patch = buildPresetPatch(id);
    for (const mandatory of MANDATORY_NAV_HREFS) {
      expect(patch.navigation?.hiddenModules).not.toContain(mandatory);
    }
  });

  it("homePage values match the server-side validation pattern (^/[A-Za-z0-9_-/.]*$)", () => {
    const pattern = /^\/[A-Za-z0-9_\-/.]*$/;
    for (const id of PRESET_IDS) {
      expect(buildPresetPatch(id).homePage).toMatch(pattern);
    }
  });

  it("is a one-time copy: mutating the source definition after building a patch does not change the patch", () => {
    const patch = buildPresetPatch("archivist");
    const snapshotHidden = [...(patch.navigation?.hiddenModules ?? [])];
    const snapshotColumns = [...(patch.views?.archive?.columns ?? [])];

    // Simulate a later release editing the preset definition in place --
    // buildPresetPatch always reads from the live definition, so this proves
    // the *already built* patch (what actually got PATCHed to the server and
    // persisted into the user's profile) is an independent copy, not a
    // reference that would change if the definition changed after the fact.
    const definition = getPresetDefinition("archivist");
    (definition.hiddenModules as string[]).push("/settings");
    (definition.archiveView.columns as string[]).push("injected");

    expect(patch.navigation?.hiddenModules).toEqual(snapshotHidden);
    expect(patch.views?.archive?.columns).toEqual(snapshotColumns);
  });

  it("building the same preset twice returns two independent array instances", () => {
    const first = buildPresetPatch("simple");
    const second = buildPresetPatch("simple");

    expect(first.navigation).not.toBe(second.navigation);
    expect(first.navigation?.hiddenModules).not.toBe(second.navigation?.hiddenModules);
    expect(first.navigation?.hiddenModules).toEqual(second.navigation?.hiddenModules);
  });

  it("the four required personas exist with distinct home pages", () => {
    expect(PRESET_IDS).toEqual(["archivist", "reviewer", "media-editor", "simple"]);
    const homePages = new Set(PRESET_IDS.map((id) => buildPresetPatch(id).homePage));
    expect(homePages.size).toBe(PRESET_IDS.length);
  });
});

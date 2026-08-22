import { MANDATORY_NAV_HREFS } from "./navigation";
import type { UpdateExperienceProfileRequest } from "./experience-profile";

/**
 * V3-SET-006 preset profiles.
 *
 * Each preset is a plain, literal patch of the existing 14-field experience
 * registry (see lib/experience-profile.ts) -- no new settings store. Applying
 * a preset means `updateExperience(buildPresetPatch(id, capabilities))`: the
 * values are copied into the user's own profile row by the normal PATCH
 * /account/experience call and persisted there. Nothing keeps a reference
 * back to the preset id or this array, so editing PRESET_DEFINITIONS in a
 * later release never retroactively changes a user who already applied one
 * (see experience-presets.test.ts for a test that pins this down).
 */
export type PresetId = "archivist" | "reviewer" | "media-editor" | "simple";

export const PRESET_IDS: readonly PresetId[] = ["archivist", "reviewer", "media-editor", "simple"];

type PresetDefinition = {
  id: PresetId;
  homePage: string;
  navigationOrder: readonly string[];
  /**
   * Modules this preset wants hidden. buildPresetPatch() still strips any
   * mandatory href from this list defensively before it ever reaches the
   * server -- belt-and-suspenders on top of the render-time gate in
   * lib/navigation.ts, which is the actual enforcement point.
   */
  hiddenModules: readonly string[];
  archiveView: { mode: "table" | "grid"; columns: readonly string[] };
};

// Arabic labels live in the i18n dictionary (lib/i18n/dictionaries/*/pages/settings.ts,
// hub.presets.items.<id>), not here -- this module only carries data/behavior.
const PRESET_DEFINITIONS: Readonly<Record<PresetId, PresetDefinition>> = {
  archivist: {
    id: "archivist",
    homePage: "/work-inbox",
    navigationOrder: ["capture", "organize", "library", "insights", "collaborate", "system"],
    hiddenModules: ["/kanban", "/projects", "/copilot"],
    archiveView: { mode: "table", columns: ["title", "store", "type", "updated"] }
  },
  reviewer: {
    id: "reviewer",
    homePage: "/daily",
    navigationOrder: ["collaborate", "library", "insights", "organize", "capture", "system"],
    hiddenModules: ["/ingest", "/media/jobs", "/transcriber", "/kanban"],
    archiveView: { mode: "table", columns: ["title", "type", "updated"] }
  },
  "media-editor": {
    id: "media-editor",
    homePage: "/media/jobs",
    navigationOrder: ["capture", "library", "collaborate", "organize", "insights", "system"],
    hiddenModules: ["/system/control", "/data-center", "/backup", "/kanban"],
    archiveView: { mode: "grid", columns: ["title", "type", "updated"] }
  },
  simple: {
    id: "simple",
    homePage: "/",
    navigationOrder: [],
    hiddenModules: [
      "/graph", "/map", "/kanban", "/timeline", "/duplicates",
      "/automation", "/copilot", "/data-center", "/plugins", "/reading-lists"
    ],
    archiveView: { mode: "grid", columns: ["title", "updated"] }
  }
};

/**
 * Builds the one-time patch for a preset. The "never hide /settings or
 * /safety-preview" guarantee is enforced defensively here (strip before it
 * ever reaches the server); the "never show a capability-disabled module"
 * guarantee lives entirely in lib/navigation.ts's render-time gate, which
 * applies uniformly to every hiddenModules source (preset or manual edit) --
 * a preset has no way to force a locked module visible because the gate
 * doesn't consult hiddenModules for those hrefs at all.
 */
export function buildPresetPatch(id: PresetId): UpdateExperienceProfileRequest {
  const preset = PRESET_DEFINITIONS[id];
  const hiddenModules = preset.hiddenModules.filter((href) => !MANDATORY_NAV_HREFS.includes(href));

  return {
    homePage: preset.homePage,
    navigation: {
      order: [...preset.navigationOrder],
      hiddenModules
    },
    views: {
      archive: {
        mode: preset.archiveView.mode,
        columns: [...preset.archiveView.columns]
      }
    }
  };
}

export function getPresetDefinition(id: PresetId): Readonly<PresetDefinition> {
  return PRESET_DEFINITIONS[id];
}

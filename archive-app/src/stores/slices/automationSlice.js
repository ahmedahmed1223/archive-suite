import { STORES, dbDelete, dbGetAll, dbPut } from "../../services/storageAccess.js";
import { createAutomationRule } from "../../features/automation/automationModel.js";

/**
 * Automation rules store slice (§1758).
 *
 * Holds the user's "when <trigger> [if <conditions>] then <actions>" rules and
 * persists them to the automation_rules IndexedDB store. This slice does NOT
 * auto-run actions on item add/update — wiring the live trigger into
 * archiveSlice is deferred (the risky part). The model stays pure; this slice
 * is storage + CRUD only.
 */

export const automationInitialState = {
  automationRules: [],
  automationLoading: false,
  automationError: null
};

export const automationActionKeys = [
  "loadAutomationFromStorage",
  "addAutomationRule",
  "updateAutomationRule",
  "removeAutomationRule",
  "toggleAutomationRule",
  "clearAutomationStore"
];

let _loadAutomationInFlight = false;

export function createAutomationActions({ set, get }) {
  return {
    loadAutomationFromStorage: async () => {
      if (_loadAutomationInFlight) return get().automationRules;
      _loadAutomationInFlight = true;
      set({ automationLoading: true, automationError: null });
      try {
        const stored = await dbGetAll(STORES.AUTOMATION_RULES).catch(() => []);
        const rules = (Array.isArray(stored) ? stored : []).map((raw) =>
          createAutomationRule(raw)
        );
        rules.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        set({ automationRules: rules, automationLoading: false });
        return rules;
      } catch (err) {
        set({
          automationLoading: false,
          automationError: err?.message || "تعذّر تحميل قواعد الأتمتة"
        });
        return get().automationRules;
      } finally {
        _loadAutomationInFlight = false;
      }
    },

    addAutomationRule: async (partial = {}) => {
      const rule = createAutomationRule(partial);
      if (!rule.name) return null;
      set((state) => ({
        automationRules: [rule, ...state.automationRules],
        automationError: null
      }));
      await dbPut(STORES.AUTOMATION_RULES, rule).catch(() => {});
      return rule;
    },

    updateAutomationRule: async (id, patch = {}) => {
      if (!id) return false;
      const rules = get().automationRules;
      const idx = rules.findIndex((rule) => rule.id === id);
      if (idx === -1) return false;
      const updated = createAutomationRule({ ...rules[idx], ...patch, id });
      const next = [...rules];
      next[idx] = updated;
      set({ automationRules: next });
      await dbPut(STORES.AUTOMATION_RULES, updated).catch(() => {});
      return true;
    },

    removeAutomationRule: async (id) => {
      if (!id) return false;
      const exists = get().automationRules.some((rule) => rule.id === id);
      if (!exists) return false;
      set((state) => ({
        automationRules: state.automationRules.filter((rule) => rule.id !== id)
      }));
      await dbDelete(STORES.AUTOMATION_RULES, id).catch(() => {});
      return true;
    },

    toggleAutomationRule: async (id) => {
      if (!id) return false;
      const rule = get().automationRules.find((entry) => entry.id === id);
      if (!rule) return false;
      return get().updateAutomationRule(id, { enabled: !rule.enabled });
    },

    clearAutomationStore: () => set({ ...automationInitialState })
  };
}

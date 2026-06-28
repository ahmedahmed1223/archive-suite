import { STORES, dbDelete, dbGetAll, dbPut } from "../../services/storageAccess.js";
import { createAutomationRule } from "../../features/automation/automationModel.js";

type StoreCtx = { set: any; get: () => any };

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

export function createAutomationActions({ set, get }: StoreCtx) {
  return {
    loadAutomationFromStorage: async () => {
      if (_loadAutomationInFlight) return get().automationRules;
      _loadAutomationInFlight = true;
      set({ automationLoading: true, automationError: null });
      try {
        const stored: any = await dbGetAll(STORES.AUTOMATION_RULES).catch(() => []);
        const rules = (Array.isArray(stored) ? stored : []).map((raw: any) =>
          createAutomationRule(raw as any)
        );
        rules.sort((a: any, b: any) => Number(new Date(b.createdAt || 0)) - Number(new Date(a.createdAt || 0)));
        set({ automationRules: rules, automationLoading: false });
        return rules;
      } catch (err: any) {
        set({
          automationLoading: false,
          automationError: err?.message || "تعذّر تحميل قواعد الأتمتة"
        });
        return get().automationRules;
      } finally {
        _loadAutomationInFlight = false;
      }
    },

    addAutomationRule: async (partial: Record<string, any> = {}) => {
      const rule = createAutomationRule(partial as any);
      if (!rule.name) return null;
      set((state: any) => ({
        automationRules: [rule, ...state.automationRules],
        automationError: null
      }));
      await dbPut(STORES.AUTOMATION_RULES, rule).catch(() => {});
      return rule;
    },

    updateAutomationRule: async (id: string, patch: Record<string, any> = {}) => {
      if (!id) return false;
      const rules = get().automationRules;
      const idx = rules.findIndex((rule: any) => rule.id === id);
      if (idx === -1) return false;
      const updated = createAutomationRule({ ...rules[idx], ...patch, id } as any);
      const next = [...rules];
      next[idx] = updated;
      set({ automationRules: next });
      await dbPut(STORES.AUTOMATION_RULES, updated).catch(() => {});
      return true;
    },

    removeAutomationRule: async (id: string) => {
      if (!id) return false;
      const exists = get().automationRules.some((rule: any) => rule.id === id);
      if (!exists) return false;
      set((state: any) => ({
        automationRules: state.automationRules.filter((rule: any) => rule.id !== id)
      }));
      await dbDelete(STORES.AUTOMATION_RULES, id).catch(() => {});
      return true;
    },

    toggleAutomationRule: async (id: string) => {
      if (!id) return false;
      const rule = get().automationRules.find((entry: any) => entry.id === id);
      if (!rule) return false;
      return get().updateAutomationRule(id, { enabled: !rule.enabled });
    },

    clearAutomationStore: () => set({ ...automationInitialState })
  };
}

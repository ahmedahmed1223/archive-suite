import { STORES, dbDelete, dbGetAll, dbPut } from "../../services/storageAccess.js";
import { nowIso } from "../storeCore.js";
import { BUILT_IN_TEMPLATES, createItemTemplate } from "../../features/templates/viewModel.js";

export const templatesInitialState = {
  templates: [],
  templatesLoading: false,
  templatesError: null
};

export const templatesActionKeys = [
  "createTemplate",
  "updateTemplate",
  "deleteTemplate",
  "incrementTemplateUsage",
  "loadTemplatesFromStorage",
  "getBuiltInTemplates"
];

export function createTemplatesActions({ set, get }) {
  return {
    loadTemplatesFromStorage: async () => {
      set({ templatesLoading: true, templatesError: null });
      try {
        const stored = await dbGetAll(STORES.TEMPLATES).catch(() => []);
        set({ templates: Array.isArray(stored) ? stored : [], templatesLoading: false });
        return stored;
      } catch (error) {
        set({ templatesLoading: false, templatesError: error?.message || "تعذر تحميل القوالب" });
        return [];
      }
    },
    createTemplate: async (template) => {
      const value = createItemTemplate({ ...template, isBuiltIn: false });
      set((state) => ({ templates: [value, ...state.templates] }));
      await dbPut(STORES.TEMPLATES, value).catch(() => {});
      get().addAuditLog?.("template.create", value.id, "template", { name: value.name });
      return value;
    },
    updateTemplate: async (template) => {
      const existing = get().templates.find((item) => item.id === template.id);
      if (existing?.isBuiltIn) return existing;
      const updated = createItemTemplate({
        ...existing,
        ...template,
        id: template.id,
        isBuiltIn: false,
        createdAt: existing?.createdAt
      });
      set((state) => ({ templates: state.templates.map((item) => (item.id === updated.id ? updated : item)) }));
      await dbPut(STORES.TEMPLATES, updated).catch(() => {});
      return updated;
    },
    deleteTemplate: async (id) => {
      const target = get().templates.find((item) => item.id === id);
      if (!target || target.isBuiltIn) return false;
      set((state) => ({ templates: state.templates.filter((item) => item.id !== id) }));
      await dbDelete(STORES.TEMPLATES, id).catch(() => {});
      get().addAuditLog?.("template.delete", id, "template", { name: target.name });
      return true;
    },
    incrementTemplateUsage: async (id) => {
      const target = get().templates.find((item) => item.id === id);
      if (!target) return false;
      const updated = { ...target, usageCount: (Number(target.usageCount) || 0) + 1, updatedAt: nowIso() };
      set((state) => ({ templates: state.templates.map((item) => (item.id === id ? updated : item)) }));
      if (!target.isBuiltIn) await dbPut(STORES.TEMPLATES, updated).catch(() => {});
      return updated;
    },
    getBuiltInTemplates: () => BUILT_IN_TEMPLATES
  };
}

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

export function createTemplatesActions({ set, get }: { set: any; get: () => any }) {
  return {
    loadTemplatesFromStorage: async () => {
      set({ templatesLoading: true, templatesError: null });
      try {
        const stored = await dbGetAll(STORES.TEMPLATES).catch(() => []);
        set({ templates: Array.isArray(stored) ? stored : [], templatesLoading: false });
        return stored;
      } catch (error: any) {
        set({ templatesLoading: false, templatesError: error?.message || "تعذر تحميل القوالب" });
        return [];
      }
    },
    createTemplate: async (template: Record<string, any>) => {
      const value: any = createItemTemplate({ ...template, isBuiltIn: false });
      set((state: any) => ({ templates: [value, ...state.templates] }));
      await dbPut(STORES.TEMPLATES, value).catch(() => {});
      get().addAuditLog?.("template.create", value.id, "template", { name: value.name });
      return value;
    },
    updateTemplate: async (template: Record<string, any>) => {
      const existing = get().templates.find((item: any) => item.id === template.id) as any;
      if (existing?.isBuiltIn) return existing;
      const updated: any = createItemTemplate({
        ...existing,
        ...template,
        id: template.id,
        isBuiltIn: false,
        createdAt: existing?.createdAt
      });
      set((state: any) => ({ templates: state.templates.map((item: any) => (item.id === updated.id ? updated : item)) }));
      await dbPut(STORES.TEMPLATES, updated).catch(() => {});
      return updated;
    },
    deleteTemplate: async (id: string) => {
      const target = get().templates.find((item: any) => item.id === id) as any;
      if (!target || target.isBuiltIn) return false;
      set((state: any) => ({ templates: state.templates.filter((item: any) => item.id !== id) }));
      await dbDelete(STORES.TEMPLATES, id).catch(() => {});
      get().addAuditLog?.("template.delete", id, "template", { name: target.name });
      return true;
    },
    incrementTemplateUsage: async (id: string) => {
      const target = get().templates.find((item: any) => item.id === id) as any;
      if (!target) return false;
      const updated = { ...target, usageCount: (Number(target.usageCount) || 0) + 1, updatedAt: nowIso() };
      set((state: any) => ({ templates: state.templates.map((item: any) => (item.id === id ? updated : item)) }));
      if (!target.isBuiltIn) await dbPut(STORES.TEMPLATES, updated).catch(() => {});
      return updated;
    },
    getBuiltInTemplates: () => BUILT_IN_TEMPLATES
  };
}
